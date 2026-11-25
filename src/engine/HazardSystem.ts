import { SERVICE_VEHICLE_COST } from '../config/gameConfig';
import { formatGameDate } from '../utils/formatters';
import { getPlayerGlobalTechModifiers } from './EconomyEngine';
import { recalculateSpatialNetwork } from './PlotSystem';
import { computeWeightedRoadRouteWithIndex } from './TransportSystem';
import type {
  Building,
  EmergencyServiceKind,
  GameState,
  HazardState,
  Player,
  Plot,
  ServiceDispatch,
} from './types';

export interface SafetyCoverage {
  hasFireStation: boolean;
  fireStationPlotId?: string;
  fireEta?: number;
  hasHazmat: boolean;
  hazmatPlotId?: string;
  hazmatEta?: number;
  hasHospital: boolean;
  hospitalPlotId?: string;
  hospitalEta?: number;
  hasPolice: boolean;
  policePlotId?: string;
  policePatrolRatio: number;
}

export function getStationEffectiveMaxFleet(b: Building): number {
  const base = b.maxFleetSize ?? 3;
  const bonus = b.techTree.reduce(
    (acc, n) => acc + (n.status === 'done' ? n.effects.fleetCapacityBonus ?? 0 : 0),
    0
  );
  return base + bonus;
}

export function getStationSpeedMultiplier(b: Building): number {
  const bonus = b.techTree.reduce(
    (acc, n) => acc + (n.status === 'done' ? n.effects.fleetSpeedBonus ?? 0 : 0),
    0
  );
  return 1 + bonus;
}

export function stationCanHandleKind(b: Building, serviceKind: EmergencyServiceKind): boolean {
  if (!b.isActive) return false;
  if (serviceKind === 'fire') return b.type === 'fireStation';
  if (serviceKind === 'hazmat') {
    return (
      b.type === 'hazmatBase' ||
      (b.type === 'fireStation' &&
        b.techTree.some((t) => t.status === 'done' && t.effects.hazmatUnlocked))
    );
  }
  if (serviceKind === 'medical') return b.type === 'hospital';
  if (serviceKind === 'police') return b.type === 'policeStation';
  return false;
}

export function getServiceKindForHazard(kind: HazardState['kind']): EmergencyServiceKind {
  if (kind === 'fire') return 'fire';
  if (kind === 'chemical_leak' || kind === 'radiation') return 'hazmat';
  if (kind === 'medical_accident') return 'medical';
  return 'police';
}

export function buyServiceVehicleForPlayer(
  building: Building,
  player: Player
): { ok: boolean; error?: string } {
  if (
    building.type !== 'fireStation' &&
    building.type !== 'hazmatBase' &&
    building.type !== 'hospital' &&
    building.type !== 'policeStation'
  ) {
    return { ok: false, error: 'Ten obiekt nie utrzymuje floty pojazdów służb.' };
  }
  const kind: EmergencyServiceKind =
    building.type === 'fireStation'
      ? 'fire'
      : building.type === 'hazmatBase'
        ? 'hazmat'
        : building.type === 'hospital'
          ? 'medical'
          : 'police';

  const cur = building.fleetSize ?? 1;
  const cap = getStationEffectiveMaxFleet(building);
  if (cur >= cap) {
    return {
      ok: false,
      error: `Osiągnięto limit garaży (${cur}/${cap}). Rozbuduj garaże w drzewku budynku!`,
    };
  }
  const cost = SERVICE_VEHICLE_COST[kind];
  if (player.cash < cost) {
    return {
      ok: false,
      error: `Brak gotówki na zakup pojazdu (${cost.toLocaleString('pl-PL')} zł).`,
    };
  }
  player.cash -= cost;
  building.fleetSize = cur + 1;
  return { ok: true };
}

/**
 * Służby bez sztywnego zasięgu — działa cała sieć drogowa mapy (Dijkstra)
 * plus śmigłowce LPR / drony po ulepszeniu drzewka budynku.
 */
export function getSafetyCoverageForPlot(
  state: GameState,
  playerId: string,
  targetPlot: Plot
): SafetyCoverage {
  const plotsByCoord = new Map<string, Plot>();
  for (const p of state.plots) plotsByCoord.set(`${p.gridX}_${p.gridY}`, p);

  let fireStationPlotId: string | undefined;
  let fireEta: number | undefined;
  let hazmatPlotId: string | undefined;
  let hazmatEta: number | undefined;
  let hospitalPlotId: string | undefined;
  let hospitalEta: number | undefined;
  let policePlotId: string | undefined;
  let totalPoliceFleet = 0;

  const findBestForKind = (
    kind: EmergencyServiceKind
  ): { plotId?: string; eta?: number } => {
    let bestId: string | undefined;
    let bestEta = Infinity;

    for (const p of state.plots) {
      if (p.ownerId !== playerId || !p.building || !stationCanHandleKind(p.building, kind)) {
        continue;
      }
      if (kind === 'police') {
        totalPoliceFleet += p.building.fleetSize ?? 1;
      }
      const hasHeli = p.building.techTree.some(
        (n) => n.status === 'done' && n.effects.helicopterDispatch
      );
      const speedMult = getStationSpeedMultiplier(p.building);

      let eta = Infinity;
      if (p.id === targetPlot.id || Math.abs(p.gridX - targetPlot.gridX) + Math.abs(p.gridY - targetPlot.gridY) <= 1) {
        eta = 1;
      } else {
        const route = computeWeightedRoadRouteWithIndex(p, targetPlot, playerId, plotsByCoord, true);
        if (route) {
          eta = Math.max(1, Math.round(route.etaTicks / speedMult));
        }
        if (hasHeli) {
          const directDist = Math.hypot(p.gridX - targetPlot.gridX, p.gridY - targetPlot.gridY);
          eta = Math.min(eta, Math.max(1, Math.round((directDist * 0.45) / speedMult)));
        }
      }

      if (eta < bestEta) {
        bestEta = eta;
        bestId = p.id;
      }
    }

    return bestId ? { plotId: bestId, eta: bestEta } : {};
  };

  const fireRes = findBestForKind('fire');
  fireStationPlotId = fireRes.plotId;
  fireEta = fireRes.eta;

  const hazRes = findBestForKind('hazmat');
  hazmatPlotId = hazRes.plotId;
  hazmatEta = hazRes.eta;

  const medRes = findBestForKind('medical');
  hospitalPlotId = medRes.plotId;
  hospitalEta = medRes.eta;

  const polRes = findBestForKind('police');
  policePlotId = polRes.plotId;

  const riskyCount = Math.max(
    1,
    state.plots.filter(
      (p) =>
        p.ownerId === playerId &&
        p.building &&
        (p.building.type === 'casino' ||
          p.building.type === 'jewelryWorkshop' ||
          p.building.type === 'investmentBank' ||
          p.building.type === 'resort' ||
          p.building.type === 'warehouse')
    ).length
  );

  return {
    hasFireStation: Boolean(fireStationPlotId),
    fireStationPlotId,
    fireEta,
    hasHazmat: Boolean(hazmatPlotId),
    hazmatPlotId,
    hazmatEta,
    hasHospital: Boolean(hospitalPlotId),
    hospitalPlotId,
    hospitalEta,
    hasPolice: Boolean(policePlotId),
    policePlotId,
    policePatrolRatio: totalPoliceFleet > 0 ? Math.min(1.5, totalPoliceFleet / riskyCount) : 0,
  };
}

function countActiveDispatchesFromStation(
  state: GameState,
  stationPlotId: string
): number {
  return (state.dispatches ?? []).filter(
    (d) => d.stationPlotId === stationPlotId && d.status !== 'queued'
  ).length;
}

export function triggerHazardForBuilding(
  building: Building,
  kind: HazardState['kind'],
  coverage?: SafetyCoverage,
  state?: GameState,
  targetPlot?: Plot
): void {
  if (building.activeHazard) return;

  const serviceKind = getServiceKindForHazard(kind);
  const responderId =
    serviceKind === 'fire'
      ? coverage?.fireStationPlotId
      : serviceKind === 'hazmat'
        ? coverage?.hazmatPlotId
        : serviceKind === 'medical'
          ? coverage?.hospitalPlotId
          : coverage?.policePlotId;

  const eta =
    serviceKind === 'fire'
      ? coverage?.fireEta
      : serviceKind === 'hazmat'
        ? coverage?.hazmatEta
        : serviceKind === 'medical'
          ? coverage?.hospitalEta
          : undefined;

  let dispatchedStatus: ServiceDispatch['status'] = 'queued';
  let dispatchEta = eta ?? 6;
  let usesHeli = false;

  if (state && targetPlot && responderId) {
    const stPlot = state.plots.find((p) => p.id === responderId);
    if (stPlot?.building) {
      const busyCount = countActiveDispatchesFromStation(state, responderId);
      const fleet = stPlot.building.fleetSize ?? 1;
      usesHeli = stPlot.building.techTree.some(
        (n) => n.status === 'done' && n.effects.helicopterDispatch
      );
      if (busyCount < fleet) {
        dispatchedStatus = dispatchEta <= 1 ? 'on_scene' : 'en_route';
      }
      state.dispatches = state.dispatches ?? [];
      state.dispatches.push({
        id: `disp_${state.time.tick}_${targetPlot.id}`,
        targetPlotId: targetPlot.id,
        incidentKind: kind,
        serviceKind,
        stationPlotId: responderId,
        status: dispatchedStatus,
        etaTicks: dispatchedStatus === 'on_scene' ? 0 : dispatchEta,
        totalEtaTicks: Math.max(1, dispatchEta),
        usesHelicopter: usesHeli,
      });
    }
  } else if (responderId) {
    // Bez stanu (wywołania testowe jednostkowe bez kolejkowania floty)
    dispatchedStatus = 'on_scene';
  }

  const immediatelyContained = dispatchedStatus === 'on_scene';
  building.activeHazard = {
    kind,
    severity: immediatelyContained ? 1 : 2,
    ticksRemaining: immediatelyContained ? 4 : 10,
    contained: immediatelyContained,
    responderBuildingId: responderId,
    destructionProgress: 0,
  };
  building.status.onFire = kind === 'fire';
  building.status.hazmatIncident = kind === 'chemical_leak' || kind === 'radiation';
  building.status.robberyActive = kind === 'robbery';
}

export function processHazardsTick(state: GameState): void {
  if (!state.dispatches) state.dispatches = [];

  const plotsByCoord = new Map<string, Plot>();
  for (const p of state.plots) plotsByCoord.set(`${p.gridX}_${p.gridY}`, p);

  // 1. Przetwarzanie floty w drodze i kolejki zdarzeń
  const remainingDispatches: ServiceDispatch[] = [];
  for (const d of state.dispatches) {
    const targetPlot = state.plots.find((p) => p.id === d.targetPlotId);
    const b = targetPlot?.building;
    if (!targetPlot || !b || !b.activeHazard) continue;

    if (d.status === 'queued') {
      const station = state.plots.find((p) => p.id === d.stationPlotId);
      if (station?.building && station.building.isActive) {
        const busy = countActiveDispatchesFromStation(state, d.stationPlotId);
        if (busy < (station.building.fleetSize ?? 1)) {
          d.status = 'en_route';
        }
      }
    }

    if (d.status === 'en_route') {
      d.etaTicks = Math.max(0, d.etaTicks - 1);
      if (d.etaTicks <= 0) {
        d.status = 'on_scene';
        b.activeHazard.contained = true;
        b.activeHazard.ticksRemaining = Math.min(b.activeHazard.ticksRemaining, 3);
      }
    } else if (d.status === 'on_scene') {
      b.activeHazard.contained = true;
    }

    remainingDispatches.push(d);
  }
  state.dispatches = remainingDispatches;

  // 2. Przetwarzanie aktywnych incydentów i generowanie nowych
  for (const plot of state.plots) {
    const b = plot.building;
    if (!b || !b.isActive || !b.ownerId || b.destroyedRuins) continue;
    const owner = state.players.find((p) => p.id === b.ownerId);
    if (!owner) continue;

    const coverage = getSafetyCoverageForPlot(state, owner.id, plot);
    const techMods = getPlayerGlobalTechModifiers(state, owner);

    if (b.activeHazard) {
      // Jeśli brakowało wyjazdu, a gracz zbudował/zwolnił pojazd lub stację — przypisz obsługę teraz!
      const sKind = getServiceKindForHazard(b.activeHazard.kind);
      const hasDisp = state.dispatches.some((d) => d.targetPlotId === plot.id);
      if (!hasDisp) {
        const respId =
          sKind === 'fire'
            ? coverage.fireStationPlotId
            : sKind === 'hazmat'
              ? coverage.hazmatPlotId
              : sKind === 'medical'
                ? coverage.hospitalPlotId
                : coverage.policePlotId;
        if (respId) {
          const stPlot = state.plots.find((p) => p.id === respId);
          if (stPlot?.building) {
            const busy = countActiveDispatchesFromStation(state, respId);
            const route = computeWeightedRoadRouteWithIndex(stPlot, plot, owner.id, plotsByCoord, true, state);
            const eta = route ? Math.max(1, Math.round(route.etaTicks / getStationSpeedMultiplier(stPlot.building))) : 3;
            const status = busy < (stPlot.building.fleetSize ?? 1) ? 'en_route' : 'queued';
            state.dispatches.push({
              id: `disp_${state.time.tick}_${plot.id}`,
              targetPlotId: plot.id,
              incidentKind: b.activeHazard.kind,
              serviceKind: sKind,
              stationPlotId: respId,
              status,
              etaTicks: eta,
              totalEtaTicks: eta,
              usesHelicopter: stPlot.building.techTree.some((t) => t.status === 'done' && t.effects.helicopterDispatch),
            });
            b.activeHazard.responderBuildingId = respId;
          }
        }
      }

      if (b.activeHazard.kind === 'fire') {
        const dmg = b.activeHazard.contained ? 1.2 : 8.5;
        b.damagePercent = Math.min(98, b.damagePercent + dmg);
        b.activeHazard.destructionProgress = b.activeHazard.contained
          ? Math.max(0, (b.activeHazard.destructionProgress ?? 0) - 7)
          : Math.min(100, (b.activeHazard.destructionProgress ?? 0) + 14);
      } else if (b.activeHazard.kind === 'chemical_leak' || b.activeHazard.kind === 'radiation') {
        if (!b.activeHazard.contained) {
          const fine = 35_000;
          owner.cash -= fine;
          owner.lastTickTaxes.environmental += fine;
          b.damagePercent = Math.min(98, b.damagePercent + 5.0);
          b.activeHazard.destructionProgress = Math.min(100, (b.activeHazard.destructionProgress ?? 0) + 11);
          state.voterMood = Math.max(-100, state.voterMood - 2.0);
        } else {
          b.damagePercent = Math.min(98, b.damagePercent + 1.0);
          b.activeHazard.destructionProgress = Math.max(0, (b.activeHazard.destructionProgress ?? 0) - 6);
        }
      } else if (b.activeHazard.kind === 'robbery') {
        if (!b.activeHazard.contained) {
          const stolen = Math.min(Math.max(0, owner.cash), Math.round(18_000 + b.revenue * 0.65));
          owner.cash -= stolen;
          owner.lastTickCostsByCategory['Utrzymanie i Kary'] =
            (owner.lastTickCostsByCategory['Utrzymanie i Kary'] ?? 0) + stolen;
        }
      } else if (b.activeHazard.kind === 'medical_accident') {
        if (!b.activeHazard.contained) {
          b.damagePercent = Math.min(95, b.damagePercent + 2.5);
        }
      }

      if ((b.activeHazard.destructionProgress ?? 0) >= 100) {
        b.destroyedRuins = true;
        b.isActive = false;
        b.damagePercent = 100;
        b.condition = 0;
        b.workers = 0;
        b.efficiency = 0;
        b.revenue = 0;
        b.activeHazard = null;
        b.status.onFire = false;
        b.status.hazmatIncident = false;
        b.status.robberyActive = false;
        state.networkRevision = (state.networkRevision ?? 0) + 1;
        recalculateSpatialNetwork(state.plots);

        state.news = [
          {
            id: `ruins_${state.time.tick}_${b.id}`,
            headline: `💥 Obiekt obrócił się w RUINY: ${b.name} (${owner.companyName})`,
            brief: `Nieugaszony incydent całkowicie zniszczył konstrukcję na działce (${plot.gridX}, ${plot.gridY}). Wymagane płatne uprzątnięcie gruzu.`,
            fullText: `Brak sprawnej interwencji Straży Pożarnej lub HAZMAT doprowadził do całkowitej destrukcji obiektu "${b.name}". Kliknij alert, aby przejść na działkę i uprzątnąć gruz.`,
            analysis: 'Zbuduj remizy lub bazy HAZMAT oraz inwestuj w drogi i śmigłowce ratownicze.',
            hints: ['Użyj przycisku "Uprzątnij Ruiny" w panelu działki.'],
            type: 'negative' as const,
            dateLabel: formatGameDate(state.time),
            tick: state.time.tick,
            read: false,
            focusPlotId: plot.id,
          },
          ...state.news,
        ].slice(0, 35);
        continue;
      }

      b.condition = Math.max(5, 100 - b.damagePercent);
      b.activeHazard.ticksRemaining -= 1;

      if (b.activeHazard.ticksRemaining <= 0) {
        b.activeHazard = null;
        b.status.onFire = false;
        b.status.hazmatIncident = false;
        b.status.robberyActive = false;
      }
      continue;
    }

    if (state.time.tick < 12) continue;

    // Rzadsze pożary i skażenia HAZMAT — wyłącznie w obiektach wysokiego ryzyka
    const fireProne =
      b.type === 'coalPowerPlant' ||
      b.type === 'gasPowerPlant' ||
      b.type === 'wasteIncinerator' ||
      b.type === 'oilRefinery' ||
      b.type === 'steelMill' ||
      b.type === 'chemicalPlant' ||
      b.type === 'semiconductorFab' ||
      b.type === 'batteryFactory' ||
      b.type === 'weaponsComplex';
    const hazmatProne =
      b.type === 'chemicalPlant' ||
      b.type === 'oilRefinery' ||
      b.type === 'semiconductorFab' ||
      b.type === 'uraniumMine' ||
      b.type === 'uraniumEnrichment' ||
      b.type === 'nuclearPowerPlant' ||
      b.type === 'fusionReactor' ||
      b.type === 'batteryFactory';
    const heistProne =
      b.type === 'casino' ||
      b.type === 'jewelryWorkshop' ||
      b.type === 'jewelryLuxury' ||
      b.type === 'investmentBank' ||
      b.type === 'resort';

    const safetyReduction = Math.max(0.2, 1 - techMods.safetyBonus * 0.5);
    const damageRisk = b.damagePercent > 45 ? 1.8 : 1.0;

    if (hazmatProne && Math.random() < 0.0022 * safetyReduction * damageRisk) {
      const kind =
        b.type === 'uraniumMine' ||
        b.type === 'uraniumEnrichment' ||
        b.type === 'nuclearPowerPlant' ||
        b.type === 'fusionReactor'
          ? 'radiation'
          : 'chemical_leak';
      triggerHazardForBuilding(b, kind, coverage, state, plot);
      if (owner.id === state.currentPlayerId) {
        pushHazardNews(state, plot, owner, kind, Boolean(coverage.hazmatPlotId));
      }
    } else if (fireProne && Math.random() < 0.0028 * safetyReduction * damageRisk) {
      triggerHazardForBuilding(b, 'fire', coverage, state, plot);
      if (owner.id === state.currentPlayerId) {
        pushHazardNews(state, plot, owner, 'fire', Boolean(coverage.fireStationPlotId));
      }
    } else if (heistProne) {
      const crimeFactor = 0.4 + plot.crimeScore / 60;
      const patrolShield = Math.max(0.18, 1 - coverage.policePatrolRatio * 0.58);
      if (Math.random() < 0.009 * crimeFactor * patrolShield) {
        triggerHazardForBuilding(b, 'robbery', coverage, state, plot);
        if (owner.id === state.currentPlayerId) {
          pushHazardNews(state, plot, owner, 'robbery', coverage.hasPolice);
        }
      }
    } else if (
      (b.category === 'mining' || b.category === 'processing') &&
      Math.random() < (coverage.hasHospital ? 0.002 : 0.005) * damageRisk
    ) {
      triggerHazardForBuilding(b, 'medical_accident', coverage, state, plot);
    }
  }
}

function pushHazardNews(
  state: GameState,
  plot: Plot,
  owner: Player,
  kind: HazardState['kind'],
  hasStation: boolean
): void {
  const b = plot.building!;
  const label =
    kind === 'fire'
      ? 'Pożar w zakładzie'
      : kind === 'radiation'
        ? 'Incydent radiacyjny'
        : kind === 'robbery'
          ? 'Napad na obiekt wysokiego ryzyka'
          : kind === 'medical_accident'
            ? 'Wypadek przy pracy'
            : 'Wyciek chemiczny';

  state.news = [
    {
      id: `haz_${state.time.tick}_${b.id}`,
      headline: `${label}: ${b.name} (${owner.companyName})`,
      brief: hasStation
        ? `Najbliższa jednostka ze stacji ruszyła po sieci dróg na miejsce zdarzenia.`
        : `Brak odpowiedniej służby ratunkowej / policji! Zdarzenie generuje pełne straty.`,
      fullText: hasStation
        ? `System dyspozytorski wysłał wolny pojazd ratunkowy lub patrol na działkę (${plot.gridX}, ${plot.gridY}). Im lepsza sieć autostrad i większa flota, tym szybsza interwencja.`
        : `Brak wolnych pojazdów lub brak dróg utrudnia dotarcie na działkę (${plot.gridX}, ${plot.gridY}). Rozważ budowę Remizy, Szpitala, Policji, HAZMAT lub odblokowanie śmigłowców.`,
      analysis: 'Służby działają na całej mapie w oparciu o faktyczną sieć dróg i liczebność floty.',
      hints: ['Dokup pojazdy w panelu służby i łącz zakłady autostradami, aby skrócić czas dojazdu.'],
      type: hasStation ? ('neutral' as const) : ('negative' as const),
      dateLabel: formatGameDate(state.time),
      tick: state.time.tick,
      read: false,
      focusPlotId: plot.id,
    },
    ...state.news,
  ].slice(0, 35);
}
