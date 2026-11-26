import { INFLUENCE_ACTIONS } from '../data/influenceActions';
import { formatGameDate } from '../utils/formatters';
import { arePlayersAllied, hasActiveNAP } from './CoalitionSystem';
import { handleBuildingDestructionInsurance } from './BuildingSystem';
import { getPlayerEntrepreneurModifiers, getPlayerGlobalTechModifiers } from './EconomyEngine';
import { recalculateSpatialNetwork } from './PlotSystem';
import type { GameState, Player } from './types';

export function evaluateSecretNuclearUnlock(state: GameState, player: Player): boolean {
  if (player.secretNuclearRevealed) return true;
  const required: Array<'uraniumMine' | 'uraniumEnrichment' | 'university' | 'rdLab' | 'militaryBase'> = [
    'uraniumMine',
    'uraniumEnrichment',
    'university',
    'rdLab',
    'militaryBase',
  ];
  const ownedTypes = new Set(
    state.plots
      .filter((p) => p.ownerId === player.id && p.building && !p.building.destroyedRuins)
      .map((p) => p.building!.type)
  );
  if (required.every((req) => ownedTypes.has(req))) {
    player.secretNuclearRevealed = true;
    if (player.id === state.currentPlayerId) {
      state.notifications = [
        {
          id: `nuke_unlock_${state.time.tick}_${player.id}`,
          title: '☢️ Odblokowano Tajny Program Nuklearny!',
          message:
            'Połączenie kopalni i wzbogacania uranu z kampusem R&D oraz Bazą PMC otworzyło dostęp do projektu broni jądrowej w panelu Wpływy / Technologie.',
          severity: 'warning' as const,
          tick: state.time.tick,
        },
        ...state.notifications,
      ].slice(0, 6);
    }
    return true;
  }
  return false;
}

export function startSecretNuclearProject(
  state: GameState,
  player: Player
): { ok: boolean; message: string } {
  if (!evaluateSecretNuclearUnlock(state, player)) {
    return {
      ok: false,
      message:
        'Wymaga jednoczesnego posiadania Kopalni Uranu, Wzbogacania Uranu, Uniwersytetu, Centrum R&D i Bazy PMC.',
    };
  }
  if (player.nuclearProjectActive) {
    return { ok: false, message: 'Tajny montaż głowicy jądrowej jest już w toku.' };
  }
  const cashCost = 8_500_000;
  const uraniumCost = 25;
  const stockU = player.warehouseStockpile.uranium ?? 0;

  if (player.cash < cashCost) {
    return { ok: false, message: `Budowa głowicy wymaga ${cashCost.toLocaleString('pl-PL')} zł.` };
  }
  if (stockU < uraniumCost) {
    return {
      ok: false,
      message: `Brak wzbogaconego/surowego uranu w magazynie (${stockU.toFixed(1)} / ${uraniumCost} kg).`,
    };
  }

  player.cash -= cashCost;
  player.warehouseStockpile.uranium = Number((stockU - uraniumCost).toFixed(2));
  player.nuclearProjectActive = true;
  player.nuclearProjectProgress = 0;

  return {
    ok: true,
    message: 'Rozpoczęto tajny projekt budowy głowicy jądrowej (ok. 20 tur). Uważaj na wywiady rywali!',
  };
}

export function processNuclearProjectTick(state: GameState): void {
  const intelPlayers = state.players.filter(
    (p) =>
      !p.isEliminated &&
      state.plots.some((pl) => pl.ownerId === p.id && pl.building?.type === 'intelligenceCenter' && pl.building.isActive && !pl.building.destroyedRuins)
  );

  for (const player of state.players) {
    if (player.isEliminated) continue;
    evaluateSecretNuclearUnlock(state, player);

    if (!player.nuclearProjectActive) continue;
    player.nuclearProjectProgress = Math.min(100, (player.nuclearProjectProgress ?? 0) + 5);

    // Szansa wykrycia przez centra wywiadu rywali
    for (const spy of intelPlayers) {
      if (spy.id === player.id) continue;
      const detected = player.nuclearDetectedByPlayers ?? [];
      if (detected.includes(spy.id)) continue;
      if (Math.random() < 0.065) {
        player.nuclearDetectedByPlayers = [...detected, spy.id];
        if (spy.id === state.currentPlayerId) {
          state.notifications = [
            {
              id: `nuke_spy_${state.time.tick}_${player.id}`,
              title: '🕵️ ALARM WYWIADOWCZY: Program Nuklearny!',
              message: `Twoje Centrum Wywiadu wykryło tajną budowę głowicy atomowej w korporacji ${player.companyName}!`,
              severity: 'danger' as const,
              tick: state.time.tick,
            },
            ...state.notifications,
          ].slice(0, 6);
        }
      }
    }

    if ((player.nuclearProjectProgress ?? 0) >= 100) {
      player.nuclearProjectActive = false;
      player.nuclearProjectProgress = 0;
      player.nuclearWarheadsReady = (player.nuclearWarheadsReady ?? 0) + 1;
      if (player.id === state.currentPlayerId) {
        state.notifications = [
          {
            id: `nuke_ready_${state.time.tick}`,
            title: '☢️ Głowica Nuklearna Gotowa!',
            message: `Posiadasz ${player.nuclearWarheadsReady} szt. broni jądrowej gotowej do użycia w panelu Wpływy.`,
            severity: 'warning' as const,
            tick: state.time.tick,
          },
          ...state.notifications,
        ].slice(0, 6);
      }
    }
  }
}

export function executeTacticalMissileStrike(
  state: GameState,
  player: Player,
  targetPlotId: string
): { ok: boolean; message: string } {
  const cooldown = player.actionCooldowns['tactical_missile'] ?? 0;
  if (cooldown > 0) {
    return { ok: false, message: `Wyrzutnia rakiet taktycznych ładuje się (${cooldown} tur).` };
  }

  const hasUnlockedBase = state.plots.some(
    (p) =>
      p.ownerId === player.id &&
      p.building?.type === 'militaryBase' &&
      p.building.isActive &&
      !p.building.destroyedRuins &&
      p.building.techTree.some((t) => t.status === 'done' && t.effects.tacticalMissileUnlocked)
  );
  if (!hasUnlockedBase) {
    return {
      ok: false,
      message: 'Wymaga Bazy PMC z ulepszeniem EKSTRA: "Taktyczna Bateria Rakietowa (3×3)".',
    };
  }

  const targetPlot = state.plots.find((p) => p.id === targetPlotId);
  if (!targetPlot) return { ok: false, message: 'Nie wybrano poprawnego celu na mapie.' };

  const strikeArea = state.plots.filter(
    (p) => Math.abs(p.gridX - targetPlot.gridX) <= 1 && Math.abs(p.gridY - targetPlot.gridY) <= 1
  );
  for (const p of strikeArea) {
    if (p.ownerId && (arePlayersAllied(state, player.id, p.ownerId) || hasActiveNAP(state, player.id, p.ownerId))) {
      if (p.ownerId !== player.id) {
        return {
          ok: false,
          message: 'W strefie rażenia 3×3 znajdują się aktywa koalicjanta lub partnera NAP!',
        };
      }
    }
  }

  const cost = 1_800_000;
  if (player.cash < cost) {
    return { ok: false, message: `Wystrzelenie rakiety kosztuje ${cost.toLocaleString('pl-PL')} zł.` };
  }

  player.cash -= cost;
  player.actionCooldowns['tactical_missile'] = 60;
  player.influence.voterApproval = Math.max(0, player.influence.voterApproval - 12);
  state.voterMood = Math.max(-100, state.voterMood - 10);

  let destroyedCount = 0;
  for (const p of strikeArea) {
    if (p.building && !p.building.destroyedRuins) {
      if (p.building.type === 'corporateHQ') {
        p.building.damagePercent = Math.min(95, p.building.damagePercent + 55);
        p.building.condition = Math.max(5, 100 - p.building.damagePercent);
      } else {
        const tgtOwner = state.players.find((pl) => pl.id === p.building!.ownerId);
        handleBuildingDestructionInsurance(p.building, tgtOwner, state);
        p.building.destroyedRuins = true;
        p.building.isActive = false;
        p.building.damagePercent = 100;
        p.building.condition = 0;
        p.building.workers = 0;
        p.building.efficiency = 0;
        p.building.revenue = 0;
        p.building.activeHazard = null;
        destroyedCount++;
      }
    }
    if (p.hasRoad && !p.building) {
      p.hasRoad = false;
      p.roadType = 'none';
      p.isPlayerRoad = false;
    }
  }

  state.blastEffects = state.blastEffects ?? [];
  state.blastEffects.push({
    id: `missile_${state.time.tick}_${targetPlot.id}`,
    kind: 'missile',
    centerX: targetPlot.gridX,
    centerY: targetPlot.gridY,
    radius: 1.5,
    createdTick: state.time.tick,
    ticksRemaining: 10,
  });

  state.networkRevision = (state.networkRevision ?? 0) + 1;
  recalculateSpatialNetwork(state.plots);

  pushInfluenceNews(
    state,
    `🚀 UDERZENIE RAKIETOWE 3×3! ${player.companyName} zaatakowała sektor (${targetPlot.gridX}, ${targetPlot.gridY})`,
    `Taktyczna rakieta balistyczna zniszczyła ${destroyedCount} obiektów i zerwała szlaki drogowe w promieniu 3×3.`,
    targetPlot.id
  );

  return {
    ok: true,
    message: `Uderzenie taktyczne w (${targetPlot.gridX}, ${targetPlot.gridY})! Zniszczono ${destroyedCount} struktur.`,
  };
}

export function executeNuclearStrike(
  state: GameState,
  player: Player,
  targetPlotId: string
): { ok: boolean; message: string } {
  if ((player.nuclearWarheadsReady ?? 0) < 1) {
    return { ok: false, message: 'Brak gotowej głowicy jądrowej w arsenale.' };
  }
  const hasBase = state.plots.some(
    (p) => p.ownerId === player.id && p.building?.type === 'militaryBase' && p.building.isActive && !p.building.destroyedRuins
  );
  if (!hasBase) {
    return { ok: false, message: 'Odpalenie wymaga aktywnej Bazy PMC.' };
  }
  const targetPlot = state.plots.find((p) => p.id === targetPlotId);
  if (!targetPlot) return { ok: false, message: 'Niepoprawny cel ataku nuklearnego.' };

  const zone5x5 = state.plots.filter(
    (p) => Math.abs(p.gridX - targetPlot.gridX) <= 2 && Math.abs(p.gridY - targetPlot.gridY) <= 2
  );
  for (const p of zone5x5) {
    if (p.ownerId && p.ownerId !== player.id && (arePlayersAllied(state, player.id, p.ownerId) || hasActiveNAP(state, player.id, p.ownerId))) {
      return {
        ok: false,
        message: 'W strefie opadu radioaktywnego 5×5 znajduje się terytorium sojusznika lub partnera NAP!',
      };
    }
  }

  player.nuclearWarheadsReady = (player.nuclearWarheadsReady ?? 1) - 1;
  player.influence.voterApproval = Math.max(0, player.influence.voterApproval - 35);
  player.reputation = Math.max(0, player.reputation - 45);
  state.voterMood = Math.max(-100, state.voterMood - 28);

  let wipedCount = 0;
  for (const p of zone5x5) {
    if (p.building && !p.building.destroyedRuins) {
      const tgtOwner = state.players.find((pl) => pl.id === p.building!.ownerId);
      handleBuildingDestructionInsurance(p.building, tgtOwner, state);
      p.building.destroyedRuins = true;
      p.building.isActive = false;
      p.building.damagePercent = 100;
      p.building.condition = 0;
      p.building.workers = 0;
      p.building.efficiency = 0;
      p.building.revenue = 0;
      p.building.activeHazard = null;
      wipedCount++;
    }
    p.hasRoad = false;
    p.roadType = 'none';
    p.isPlayerRoad = false;
    if (p.terrain !== 'water') {
      p.irradiatedTicks = 180;
      p.purchasable = false;
    }
  }

  state.blastEffects = state.blastEffects ?? [];
  state.blastEffects.push({
    id: `nuke_${state.time.tick}_${targetPlot.id}`,
    kind: 'nuke',
    centerX: targetPlot.gridX,
    centerY: targetPlot.gridY,
    radius: 2.8,
    createdTick: state.time.tick,
    ticksRemaining: 16,
  });

  state.networkRevision = (state.networkRevision ?? 0) + 1;
  recalculateSpatialNetwork(state.plots);

  pushInfluenceNews(
    state,
    `☢️ KATASTROFA NUKLEARNA! ${player.companyName} zrzuciła głowicę na (${targetPlot.gridX}, ${targetPlot.gridY})!`,
    `Eksplozja zrównała z ziemią ${wipedCount} obiektów w strefie 5×5 i pozostawiła silne skażenie promieniotwórcze na 180 tur.`,
    targetPlot.id
  );

  return {
    ok: true,
    message: `☢️ Detonacja na (${targetPlot.gridX}, ${targetPlot.gridY})! Zniszczono ${wipedCount} obiektów i skażono obszar 5×5.`,
  };
}

export function executeInfluenceAction(
  state: GameState,
  player: Player,
  actionId: string,
  targetPlayerId?: string,
  targetPlotId?: string,
  targetBuildingId?: string
): { ok: boolean; message: string } {
  const action = INFLUENCE_ACTIONS.find((a) => a.id === actionId);
  if (!action) return { ok: false, message: 'Nieznana operacja wpływu.' };

  const cd = player.actionCooldowns[actionId] ?? 0;
  if (cd > 0) return { ok: false, message: `Operacja w trakcie odnowienia (${cd} tur).` };

  if (action.requiredTech && player.globalTech[action.requiredTech]?.status !== 'done') {
    return { ok: false, message: 'Wymaga odblokowania odpowiedniej technologii w drzewku.' };
  }

  const pillarScore =
    action.pillar === 'financial'
      ? player.influence.financial
      : action.pillar === 'military'
        ? player.influence.military
        : player.influence.social;

  if (pillarScore < action.requiredScore) {
    return {
      ok: false,
      message: `Wymaga min. ${action.requiredScore} pkt w tym Filarze (masz ${Math.round(pillarScore)}).`,
    };
  }

  const targetPlayer = targetPlayerId ? state.players.find((p) => p.id === targetPlayerId) : undefined;
  const isHostile =
    actionId === 'forced_buyout' ||
    actionId === 'sabotage' ||
    actionId === 'corporate_raid' ||
    actionId === 'organize_boycott';
  if (isHostile && targetPlayer) {
    if (arePlayersAllied(state, player.id, targetPlayer.id)) {
      return { ok: false, message: 'Nie możesz atakować członka własnej koalicji!' };
    }
    if (hasActiveNAP(state, player.id, targetPlayer.id)) {
      return { ok: false, message: 'Aktywny Pakt o Nieagresji (NAP) blokuje agresywne operacje!' };
    }
  }

  const entMods = getPlayerEntrepreneurModifiers(state, player);
  const stockStake = targetPlayerId
    ? state.stocks?.find((s) => s.companyId === targetPlayerId)?.holdings[player.id] ?? 0
    : 0;
  const majorityHostileDiscount = stockStake >= 50 ? 0.45 : 0;
  const effectiveCost =
    action.id === 'forced_buyout' || action.id === 'corporate_raid'
      ? Math.round(action.cost * Math.max(0.2, 1 - entMods.buyoutDiscount - majorityHostileDiscount))
      : action.cost;

  if (player.cash < effectiveCost) {
    return {
      ok: false,
      message: `Brak środków (${effectiveCost.toLocaleString('pl-PL')} zł).`,
    };
  }

  const powerMult = 1 + entMods.influencePowerBonus;
  const techMods = getPlayerGlobalTechModifiers(state, player);

  switch (actionId) {
    case 'bribery': {
      player.cash -= effectiveCost;
      player.influence.financial += Math.round(12 * powerMult);
      player.actionCooldowns['env_shield'] = 10;
      player.actionCooldowns[actionId] = action.cooldownTicks;
      return { ok: true, message: 'Urzędnicy przyjęli argumenty finansowe — 10 tur ochrony przed karami.' };
    }

    case 'lobbying': {
      player.cash -= effectiveCost;
      player.influence.financial += Math.round(15 * powerMult);
      player.activeTaxReliefTicks = 20;
      player.actionCooldowns[actionId] = action.cooldownTicks;
      return { ok: true, message: 'Lobbing zakończony sukcesem: -40% CIT przez 20 tur.' };
    }

    case 'buy_law': {
      player.cash -= effectiveCost;
      player.influence.financial += Math.round(25 * powerMult);
      if (!state.activeLaws.includes('corporate_deregulation')) {
        state.activeLaws.push('corporate_deregulation');
      }
      state.taxRate = Math.max(0.11, Number((state.taxRate - 0.02).toFixed(2)));
      player.actionCooldowns[actionId] = action.cooldownTicks;
      pushInfluenceNews(
        state,
        'Przełomowa ustawa deregulacyjna uchwalona przez parlament',
        `${player.companyName} przeforsowała korzystne regulacje obniżające podatek CIT w gospodarce.`
      );
      return { ok: true, message: 'Ustawa przeszła! CIT w gospodarce spadł o 2 p.p.' };
    }

    case 'forced_buyout': {
      if (player.corporationLevel < 4) {
        return { ok: false, message: 'Przymusowy wykup wymaga min. 4. Poziomu Korporacji.' };
      }
      if (!targetPlayer || !targetPlotId) {
        return { ok: false, message: 'Wybierz rywala oraz działkę do przymusowego wykupu.' };
      }
      const plot = state.plots.find((p) => p.id === targetPlotId && p.ownerId === targetPlayer.id);
      if (!plot) return { ok: false, message: 'Wybrana działka nie należy do wskazanego rywala.' };
      if (plot.building?.type === 'corporateHQ') {
        return { ok: false, message: 'Siedziba Główna (HQ) konkurenta jest chroniona przed wywłaszczeniem.' };
      }

      const statutoryCompensation = Math.round(plot.price * 0.85);
      const total = effectiveCost + statutoryCompensation;
      if (player.cash < total) {
        return {
          ok: false,
          message: `Łączny koszt przejęcia z odszkodowaniem to ${total.toLocaleString('pl-PL')} zł.`,
        };
      }

      // Obrona prawna i kontrwywiadowcza celu (Lobby, Policja Cyber lub Kancelaria Prawna)!
      const targetHasLegalShield = state.plots.some(
        (p) =>
          p.ownerId === targetPlayer.id &&
          p.building?.isActive &&
          !p.building.destroyedRuins &&
          (p.building.type === 'lawFirm' ||
            (p.building.type === 'lobbyOffice' && p.building.techTree.some((t) => t.status === 'done' && (t.id === 'lobby_legal' || t.id === 'lobby_apex'))) ||
            (p.building.type === 'policeStation' && p.building.techTree.some((t) => t.status === 'done' && t.id === 'police_cyber')))
      );
      const defenseChance = Math.min(0.68, (targetHasLegalShield ? 0.38 : 0.08) + getPlayerGlobalTechModifiers(state, targetPlayer).sabotageDefense * 0.4);

      player.actionCooldowns[actionId] = action.cooldownTicks;

      if (Math.random() < defenseChance) {
        const legalPenalty = Math.round(effectiveCost * 0.35);
        player.cash -= legalPenalty;
        if (targetPlayer.id === state.currentPlayerId) {
          state.notifications = [
            {
              id: `buyout_blocked_${state.time.tick}`,
              title: '⚖️ Zablokowano próbę wrogiego przejęcia!',
              message: `${player.companyName} próbowała wywłaszczyć Twoją działkę (${plot.gridX}, ${plot.gridY}), ale dział prawny i służby obroniły majątek.`,
              severity: 'warning' as const,
              tick: state.time.tick,
            },
            ...state.notifications,
          ].slice(0, 6);
        }
        pushInfluenceNews(
          state,
          `⚖️ Odparto Przymusowy Wykup w ${targetPlayer.companyName}!`,
          `Prawnicy i kontrwywiad zablokowali wniosek wywłaszczeniowy ${player.companyName} dla działki (${plot.gridX}, ${plot.gridY}).`,
          plot.id
        );
        return {
          ok: false,
          message: `Wniosek zablokowany przez dział prawny rywala! Poniesiono koszty sądowe ${legalPenalty.toLocaleString('pl-PL')} zł.`,
        };
      }

      player.cash -= total;
      targetPlayer.cash += statutoryCompensation;
      plot.ownerId = player.id;
      if (plot.building) {
        plot.building.ownerId = player.id;
      }
      state.networkRevision = (state.networkRevision ?? 0) + 1;
      recalculateSpatialNetwork(state.plots);
      pushInfluenceNews(
        state,
        `PRZYMUSOWY WYKUP! ${player.companyName} przejmuje aktywa ${targetPlayer.companyName}`,
        `Na mocy nowej ustawy specinwestycyjnej działka (${plot.gridX},${plot.gridY}) zmieniła właściciela za odszkodowaniem.`,
        plot.id
      );
      return { ok: true, message: `Przejęto działkę (${plot.gridX},${plot.gridY}) od ${targetPlayer.companyName}!` };
    }

    case 'espionage': {
      if (!targetPlayer) return { ok: false, message: 'Wybierz cel wywiadowczy.' };
      player.cash -= effectiveCost;
      player.spiedPlayers[targetPlayer.id] = 20;
      player.researchPoints += 15;
      player.influence.military += Math.round(14 * powerMult);
      player.actionCooldowns[actionId] = action.cooldownTicks;
      return {
        ok: true,
        message: `Wywiad zinfiltrował ${targetPlayer.companyName} (+15 pkt badań, wgląd w finanse).`,
      };
    }

    case 'sabotage': {
      if (!targetPlayer || !targetBuildingId) {
        return { ok: false, message: 'Wybierz rywala i konkretny budynek do sabotażu.' };
      }
      const targetPlot = state.plots.find(
        (p) => p.ownerId === targetPlayer.id && p.building?.id === targetBuildingId
      );
      if (!targetPlot || !targetPlot.building) {
        return { ok: false, message: 'Nie znaleziono wskazanego budynku przeciwnika.' };
      }
      const enemySecurityDefense = state.plots
        .filter(
          (p) =>
            p.ownerId === targetPlayer.id &&
            p.building?.isActive &&
            !p.building.destroyedRuins &&
            (p.building.type === 'policeStation' || p.building.type === 'militaryBase')
        )
        .reduce((acc, p) => {
          const b = p.building!;
          const mod = b.techTree.reduce(
            (s, t) => s + (t.status === 'done' ? t.effects.espionageDefenseBonus ?? 0 : 0),
            0
          );
          return acc + 0.08 + mod;
        }, 0);
      const enemyDefense =
        getPlayerGlobalTechModifiers(state, targetPlayer).sabotageDefense +
        Math.min(0.45, enemySecurityDefense);
      const successChance = Math.max(0.2, Math.min(0.95, 0.72 + techMods.sabotageAttack - enemyDefense));

      player.cash -= effectiveCost;
      player.actionCooldowns[actionId] = action.cooldownTicks;
      player.influence.military += Math.round(12 * powerMult);

      if (Math.random() <= successChance) {
        targetPlot.building.condition = Math.max(15, targetPlot.building.condition - 45);
        targetPlot.building.sabotagedTicks = 8;
        targetPlot.building.status.breakdown = true;
        pushInfluenceNews(
          state,
          `Awaria i podejrzenie sabotażu w zakładzie ${targetPlot.building.name}!`,
          `Obiekt należący do ${targetPlayer.companyName} stanął w miejscu na skutek tajemniczej usterki sieci sterującej.`,
          targetPlot.id
        );
        return { ok: true, message: `Sabotaż udany! ${targetPlot.building.name} wstrzymany na 8 tur.` };
      }
      return { ok: false, message: 'Kontrwywiad rywala udaremnił akcję dywersyjną.' };
    }

    case 'corporate_raid': {
      if (!targetPlayer || !targetBuildingId) {
        return { ok: false, message: 'Wybierz rywala oraz obiekt do abordażu.' };
      }
      const targetPlot = state.plots.find(
        (p) => p.ownerId === targetPlayer.id && p.building?.id === targetBuildingId
      );
      if (!targetPlot || !targetPlot.building) {
        return { ok: false, message: 'Nie znaleziono wskazanego obiektu przeciwnika.' };
      }
      player.cash -= effectiveCost;
      player.actionCooldowns[actionId] = action.cooldownTicks;
      const milRatio = (player.militaryPower + 30) / Math.max(25, targetPlayer.militaryPower + 25);
      if (milRatio >= 0.9 || Math.random() < 0.75) {
        targetPlot.ownerId = player.id;
        targetPlot.building.ownerId = player.id;
        state.networkRevision = (state.networkRevision ?? 0) + 1;
        recalculateSpatialNetwork(state.plots);
        pushInfluenceNews(
          state,
          `KORPORACYJNY ABORDAŻ! ${player.companyName} siłowo przejmuje ${targetPlot.building.name}`,
          `Oddziały kondotierów i komorników korporacyjnych zajęły obiekt firmy ${targetPlayer.companyName}.`,
          targetPlot.id
        );
        return { ok: true, message: `Abordaż zakończony przejęciem ${targetPlot.building.name}!` };
      }
      return { ok: false, message: 'Ochrona obiektu odparła próbę korporacyjnego abordażu.' };
    }

    case 'coup_attempt': {
      player.cash -= effectiveCost;
      player.actionCooldowns[actionId] = action.cooldownTicks;
      if (player.militaryPower < 100 && player.influence.military < 95) {
        return { ok: false, message: 'Zbyt słabe zaplecze militarne na udany zamach stanu.' };
      }
      player.influence.financial += 120;
      player.influence.military += 120;
      player.influence.social += 80;
      state.taxRate = 0.08;
      let seized = 0;
      for (const p of state.plots) {
        if (
          p.ownerId &&
          p.ownerId !== player.id &&
          p.building &&
          !p.building.destroyedRuins &&
          p.building.type !== 'corporateHQ' &&
          !arePlayersAllied(state, player.id, p.ownerId)
        ) {
          p.ownerId = player.id;
          p.building.ownerId = player.id;
          seized++;
          if (seized >= 3) break;
        }
      }
      state.networkRevision = (state.networkRevision ?? 0) + 1;
      recalculateSpatialNetwork(state.plots);
      pushInfluenceNews(
        state,
        `ZAMACH STANU! Konsorcjum ${player.companyName} przejmuje władzę w państwie!`,
        `Siły korporacyjne obaliły dotychczasowy gabinet. Przejęto strategiczne aktywa konkurencji i narzucono nowy ład podatkowy.`
      );
      return { ok: true, message: `Zamach stanu udany! Przejęto ${seized} strategiczne zakłady i obcięto CIT do 8%!` };
    }

    case 'church_donation': {
      player.cash -= effectiveCost;
      player.influence.churchSupport = Math.min(100, player.influence.churchSupport + Math.round(20 * powerMult));
      player.influence.social += Math.round(15 * powerMult);
      state.voterMood = Math.min(100, state.voterMood + 8);
      player.actionCooldowns[actionId] = action.cooldownTicks;
      return { ok: true, message: 'Sojusz z duchowieństwem umocniony — rośnie poparcie społeczne!' };
    }

    case 'media_campaign': {
      player.cash -= effectiveCost;
      player.influence.mediaControl = Math.min(100, player.influence.mediaControl + Math.round(20 * powerMult));
      player.influence.social += Math.round(18 * powerMult);
      player.reputation = Math.min(100, player.reputation + 10);
      player.actionCooldowns[actionId] = action.cooldownTicks;
      return { ok: true, message: 'Narracja medialna przechylona na korzyść Twojego imperium.' };
    }

    case 'voter_mobilization': {
      player.cash -= effectiveCost;
      player.influence.social += Math.round(25 * powerMult);
      player.influence.voterApproval = Math.min(100, player.influence.voterApproval + 18);
      if (!state.activeLaws.includes('lower_zus')) {
        state.activeLaws.push('lower_zus');
      }
      player.actionCooldowns[actionId] = action.cooldownTicks;
      return { ok: true, message: 'Wyborcy wymusili na rządzie obniżkę składek ZUS o 10%!' };
    }

    case 'organize_boycott': {
      if (!targetPlayer) return { ok: false, message: 'Wybierz konkurenta do objęcia bojkotem.' };
      player.cash -= effectiveCost;
      player.influence.social += Math.round(12 * powerMult);
      player.actionCooldowns[actionId] = action.cooldownTicks;
      let hitCount = 0;
      for (const p of state.plots) {
        if (p.ownerId === targetPlayer.id && p.building) {
          p.building.boycottedTicks = 12;
          hitCount++;
        }
      }
      pushInfluenceNews(
        state,
        `Masowy bojkot konsumencki uderza w ${targetPlayer.companyName}!`,
        `Organizacje społeczne i media wzywają do unikania usług i towarów koncernu (${hitCount} obiektów objętych presją).`
      );
      return { ok: true, message: `Bojkot ogłoszony! Przychody ${targetPlayer.companyName} spadają o 35% na 12 tur.` };
    }

    default:
      return { ok: false, message: 'Nieobsługiwana operacja.' };
  }
}

function pushInfluenceNews(state: GameState, headline: string, body: string, focusPlotId?: string): void {
  state.news = [
    {
      id: `inf_news_${state.time.tick}_${Math.random().toString(36).slice(2, 6)}`,
      headline,
      brief: body,
      fullText: body,
      analysis: 'Działanie z obszaru trzech filarów wpływów zmienia układ sił rynkowych.',
      hints: ['Monitoruj wskaźniki wpływów innych graczy w panelu Wpływy.'],
      type: 'neutral' as const,
      dateLabel: formatGameDate(state.time),
      tick: state.time.tick,
      read: false,
      focusPlotId,
    },
    ...state.news,
  ].slice(0, 40);
}
