import { GAME_CONFIG, GOVERNMENT_CONFIGS, TOLL_RATE_CONFIG } from '../config/gameConfig';
import { getArchetypeDefinition } from '../data/archetypes';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { getPlayerCoalition } from './CoalitionSystem';
import { getPlayerEntrepreneurModifiers } from './EconomyEngine';
import { refreshBuildingsRoadStatus } from './TransportSystem';
import type {
  GameState,
  Player,
  Plot,
  PlotOffer,
  ResourceDeposit,
  ResourceType,
  TerrainType,
  TollRate,
} from './types';

function hash2D(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function generateMap(
  size: number,
  seed = Math.floor(Math.random() * 10000),
  opts?: { goldRush?: boolean; playerCount?: number }
): Plot[] {
  const goldRush = Boolean(opts?.goldRush);
  const playerCount = opts?.playerCount ?? 2;
  const crowdedBonus = playerCount >= 6 ? 0.08 : 0;
  const plots: Plot[] = [];
  const center = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const elevation =
        smoothNoise(x * 0.16, y * 0.16, seed) * 0.7 +
        smoothNoise(x * 0.35, y * 0.35, seed + 17) * 0.3;
      const moisture = smoothNoise(x * 0.18, y * 0.18, seed + 43);

      const riverCurve = Math.sin(x * 0.25 + seed * 0.05) * 2.5 + size * 0.72;
      const distToRiver = Math.abs(y - riverCurve);
      const distFromCenter = Math.hypot(x - center, y - center);

      let terrain: TerrainType = 'grass';
      if (distToRiver < 1.25 || (x === size - 1 && y > size * 0.4)) {
        terrain = 'water';
      } else if (distToRiver < 2.4) {
        terrain = 'coastal';
      } else if (distFromCenter < size * 0.17) {
        terrain = 'urban';
      } else if (elevation > 0.72) {
        terrain = 'mountain';
      } else if (moisture < 0.3 && elevation < 0.65) {
        terrain = 'desert';
      } else if (moisture > 0.56 && elevation > 0.38) {
        terrain = 'forest';
      }

      // Wszystkie złoża na mapie są domyślnie w 100% ukryte — odkrycie wymaga Badania Geologicznego!
      const deposits: ResourceDeposit[] = [];
      const rRoll = hash2D(x, y, seed + 91);
      const rRoll2 = hash2D(x, y, seed + 151);

      if (terrain === 'mountain') {
        if (rRoll > 0.38) {
          const depType: ResourceType =
            rRoll > 0.76 ? 'ironOre' : rRoll > 0.56 ? 'copper' : 'coal';
          deposits.push({
            type: depType,
            amount: Math.round(4500 + rRoll * 6000),
            richness: Number((0.9 + rRoll * 0.6).toFixed(2)),
            discovered: false,
          });
        }
        if (rRoll2 > (goldRush ? 0.56 : 0.8 - crowdedBonus)) {
          deposits.push({
            type: rRoll2 > (goldRush ? 0.82 : 0.9 - crowdedBonus * 0.5) ? 'uranium' : 'gold',
            amount: goldRush ? 3800 : 2600,
            richness: goldRush ? 1.45 : 1.25,
            discovered: false,
          });
        }
        if (hash2D(x, y, seed + 177) > 0.78 - crowdedBonus) {
          deposits.push({
            type: 'rareMetals',
            amount: 2800,
            richness: 1.2,
            discovered: false,
          });
        }
        if (hash2D(x, y, seed + 241) > (goldRush ? 0.68 : 0.87 - crowdedBonus * 0.75)) {
          deposits.push({
            type: 'diamonds',
            amount: Math.round((goldRush ? 1500 : 900) + rRoll2 * 1100),
            richness: goldRush ? 1.4 : 1.15,
            discovered: false,
          });
        }
      } else if (terrain === 'desert') {
        if (rRoll > 0.46) {
          deposits.push({
            type: rRoll > 0.7 ? 'oil' : 'copper',
            amount: Math.round(5000 + rRoll * 7000),
            richness: Number((0.95 + rRoll * 0.55).toFixed(2)),
            discovered: false,
          });
        }
        if (hash2D(x, y, seed + 205) > (goldRush ? 0.62 : 0.82 - crowdedBonus)) {
          deposits.push({
            type: rRoll2 > (goldRush ? 0.35 : 0.5 - crowdedBonus * 0.5) ? 'gold' : 'uranium',
            amount: goldRush ? 3200 : 2300,
            richness: goldRush ? 1.38 : 1.18,
            discovered: false,
          });
        }
        if (hash2D(x, y, seed + 263) > (goldRush ? 0.68 : 0.77 - crowdedBonus * 0.75)) {
          deposits.push({
            type: 'lithium',
            amount: Math.round(2400 + rRoll * 2600),
            richness: 1.22,
            discovered: false,
          });
        }
      } else if (terrain === 'grass' || terrain === 'forest') {
        if (rRoll > 0.74 - crowdedBonus * 0.5) {
          const types: ResourceType[] = ['coal', 'ironOre', 'copper', 'oil', 'rareMetals', 'lithium'];
          const chosen = types[Math.floor(hash2D(x, y, seed + 303) * types.length)];
          deposits.push({
            type: chosen,
            amount: chosen === 'lithium' ? 2800 : 4200,
            richness: 1.08,
            discovered: false,
          });
        }
        if (terrain === 'forest' && hash2D(x, y, seed + 319) > (goldRush ? 0.76 : 0.91 - crowdedBonus * 0.75)) {
          deposits.push({
            type: 'diamonds',
            amount: goldRush ? 1550 : 1050,
            richness: goldRush ? 1.32 : 1.1,
            discovered: false,
          });
        }
      } else if (terrain === 'coastal') {
        if (rRoll > 0.76) {
          deposits.push({
            type: 'oil',
            amount: 4500,
            richness: 1.15,
            discovered: false,
          });
        }
        if (hash2D(x, y, seed + 347) > 0.84 - crowdedBonus * 0.75) {
          deposits.push({
            type: 'lithium',
            amount: 2400,
            richness: 1.15,
            discovered: false,
          });
        }
      }

      const baseAttr =
        terrain === 'coastal'
          ? 82
          : terrain === 'urban'
            ? 78
            : terrain === 'forest'
              ? 68
              : terrain === 'grass'
                ? 55
                : terrain === 'mountain'
                  ? 42
                  : terrain === 'desert'
                    ? 28
                    : 50;

      const basePrice =
        terrain === 'water'
          ? 0
          : terrain === 'urban'
            ? 88_000
            : terrain === 'coastal'
              ? 74_000
              : terrain === 'mountain'
                ? 55_000
                : terrain === 'desert'
                  ? 42_000
                  : 48_000;

      plots.push({
        id: `plot_${x}_${y}`,
        gridX: x,
        gridY: y,
        terrain,
        ownerId: null,
        basePrice,
        price: basePrice,
        deposits,
        surveyed: false,
        surveyedBy: {},
        building: null,
        hasRoad: false,
        roadType: 'none',
        tollRate: 'free',
        roadBlocked: false,
        blockedPlayers: [],
        tollRevenueTotal: 0,
        hasElectricity: terrain === 'urban',
        hasWater: terrain === 'coastal' || terrain === 'urban',
        attractiveness: baseAttr,
        neighborPenalty: 0,
        attractionBonus: 0,
        crimeScore: terrain === 'urban' ? 12 : 4,
        purchasable: terrain !== 'water',
        distanceToRoad: terrain === 'urban' ? 0 : 4,
      });
    }
  }

  recalculateSpatialNetwork(plots);
  return plots;
}

export function hasPlayerSurveyedPlot(plot: Plot, playerId: string): boolean {
  return Boolean(plot.surveyedBy?.[playerId]);
}

export function isPlotBuildingVisibleToViewer(
  plot: Plot,
  viewerId: string,
  viewerPlayer?: Player,
  state?: GameState
): boolean {
  if (!plot.building) return true;
  if (!state?.settings.mutators?.fogOfWar) return true;
  if (plot.building.ownerId === viewerId) return true;
  if (viewerPlayer?.revealedFogPlots?.[plot.id]) return true;
  if (viewerPlayer?.spiedPlayers?.[plot.building.ownerId]) return true;
  if (state) {
    const col = getPlayerCoalition(state, viewerId);
    if (col && col.memberIds.includes(plot.building.ownerId)) return true;
  }
  return false;
}

export function revealFogPlotForPlayer(
  state: GameState,
  player: Player,
  plot: Plot
): { ok: boolean; error?: string; revealedCount: number } {
  const hasIntel = state.plots.some(
    (p) =>
      p.ownerId === player.id &&
      p.building?.type === 'intelligenceCenter' &&
      p.building.isActive &&
      !p.building.destroyedRuins
  );
  const cost = hasIntel ? 15_000 : 35_000;
  if (player.cash < cost) {
    return {
      ok: false,
      revealedCount: 0,
      error: `Raport wywiadowczy kosztuje ${cost.toLocaleString('pl-PL')} zł.`,
    };
  }
  player.cash -= cost;
  player.revealedFogPlots = player.revealedFogPlots ?? {};
  let revealedCount = 0;
  for (const p of state.plots) {
    if (Math.hypot(p.gridX - plot.gridX, p.gridY - plot.gridY) <= 1.5) {
      if (!player.revealedFogPlots[p.id]) {
        player.revealedFogPlots[p.id] = true;
        revealedCount++;
      }
    }
  }
  state.networkRevision = (state.networkRevision ?? 0) + 1;
  return { ok: true, revealedCount };
}

export function hasPlayerDiscoveredPlot(
  plot: Plot,
  viewerId: string,
  viewerPlayer?: Player,
  state?: GameState
): boolean {
  if (hasPlayerSurveyedPlot(plot, viewerId)) return true;
  if (plot.building && plot.building.category === 'mining' && !plot.building.destroyedRuins) return true;
  if (plot.ownerId && viewerPlayer?.spiedPlayers?.[plot.ownerId]) return true;
  if (state) {
    const col = getPlayerCoalition(state, viewerId);
    if (col?.shareGeology) {
      for (const allyId of col.memberIds) {
        if (allyId !== viewerId && hasPlayerSurveyedPlot(plot, allyId)) return true;
      }
    }
  }
  return false;
}

export function recalculateSpatialNetwork(plots: Plot[]): void {
  const size = Math.round(Math.sqrt(plots.length));
  const roadPlots = plots.filter((p) => p.hasRoad);
  const powerGenerators = plots.filter(
    (p) =>
      p.building &&
      p.building.isActive &&
      !p.building.destroyedRuins &&
      (p.building.category === 'energy' ||
        p.building.type === 'copperCablePlant' ||
        p.building.type === 'wasteIncinerator' ||
        p.building.type === 'plasmaGasificationPlant')
  );
  const waterSources = plots.filter(
    (p) =>
      p.terrain === 'water' ||
      p.terrain === 'coastal' ||
      (p.building &&
        p.building.isActive &&
        !p.building.destroyedRuins &&
        (p.building.type === 'waterPlant' ||
          p.building.type === 'bioSewagePlant' ||
          p.building.type === 'closedLoopSewagePlant'))
  );
  const heavyIndustry = plots.filter(
    (p) =>
      p.building &&
      p.building.isActive &&
      !p.building.destroyedRuins &&
      (p.building.category === 'mining' ||
        p.building.type === 'oilRefinery' ||
        p.building.type === 'steelMill' ||
        p.building.type === 'chemicalPlant' ||
        p.building.type === 'coalPowerPlant' ||
        p.building.type === 'gasPowerPlant' ||
        p.building.type === 'wasteIncinerator' ||
        p.building.type === 'wasteLandfill' ||
        p.building.type === 'uraniumEnrichment' ||
        p.building.type === 'batteryFactory')
  );
  const attractions = plots.filter(
    (p) =>
      p.building &&
      p.building.isActive &&
      !p.building.destroyedRuins &&
      (p.building.type === 'amusementPark' ||
        p.building.type === 'culturalCenter' ||
        p.building.type === 'marinaPromenade' ||
        p.building.type === 'casino' ||
        p.building.type === 'cityPark' ||
        p.building.type === 'arenaStadium' ||
        p.building.type === 'gastronomyBoulevard')
  );
  const parks = plots.filter(
    (p) => p.building && p.building.isActive && !p.building.destroyedRuins && p.building.type === 'cityPark'
  );
  const casinos = plots.filter(
    (p) => p.building && p.building.isActive && !p.building.destroyedRuins && p.building.type === 'casino'
  );
  const policeStations = plots.filter(
    (p) =>
      p.building &&
      p.building.isActive &&
      !p.building.destroyedRuins &&
      (p.building.type === 'policeStation' || p.building.type === 'militaryBase')
  );
  const devBoosters = plots.filter(
    (p) =>
      p.building &&
      !p.building.destroyedRuins &&
      (p.building.category === 'real_estate' ||
        p.building.category === 'attractions' ||
        p.building.category === 'education')
  );

  for (const plot of plots) {
    if (plot.hasRoad || plot.terrain === 'urban') {
      plot.distanceToRoad = 0;
    } else if (roadPlots.length > 0) {
      let minD = 99;
      for (const rp of roadPlots) {
        const d = Math.abs(rp.gridX - plot.gridX) + Math.abs(rp.gridY - plot.gridY);
        if (d < minD) minD = d;
        if (minD <= 1) break;
      }
      plot.distanceToRoad = minD;
    } else {
      plot.distanceToRoad = 5;
    }

    let hasPower = plot.terrain === 'urban';
    if (!hasPower) {
      for (const gp of powerGenerators) {
        const range = gp.building?.type === 'nuclearPowerPlant' ? 16 : 9;
        const d = Math.hypot(gp.gridX - plot.gridX, gp.gridY - plot.gridY);
        if (d <= range) {
          hasPower = true;
          break;
        }
      }
    }
    plot.hasElectricity = hasPower;

    let hasWater = plot.terrain === 'urban' || plot.terrain === 'coastal';
    if (!hasWater) {
      for (const wp of waterSources) {
        const range = wp.building?.type === 'waterPlant' ? 11 : 4;
        const d = Math.hypot(wp.gridX - plot.gridX, wp.gridY - plot.gridY);
        if (d <= range) {
          hasWater = true;
          break;
        }
      }
    }
    plot.hasWater = hasWater;

    let penalty = 0;
    for (const hp of heavyIndustry) {
      if (hp.id === plot.id) continue;
      const d = Math.hypot(hp.gridX - plot.gridX, hp.gridY - plot.gridY);
      if (d <= 3.6) {
        const hasCleanFilter = hp.building?.techTree.some(
          (n) => n.status === 'done' && n.effects.cleanFilter
        );
        const hazmatLeak =
          hp.building?.activeHazard &&
          (hp.building.activeHazard.kind === 'chemical_leak' ||
            hp.building.activeHazard.kind === 'radiation') &&
          !hp.building.activeHazard.contained;
        const baseWeight = hp.building?.type === 'wasteLandfill' ? 5.5 : 10;
        const factor = hazmatLeak ? 1.8 : hasCleanFilter ? 0.2 : 1.0;
        penalty += Math.round((4.0 - d) * baseWeight * factor);
      }
    }
    let parkMitigation = 0;
    for (const pk of parks) {
      const d = Math.hypot(pk.gridX - plot.gridX, pk.gridY - plot.gridY);
      if (d <= 2.6) parkMitigation += 0.35;
    }
    plot.neighborPenalty = Math.min(75, Math.round(penalty * Math.max(0.35, 1 - parkMitigation)));

    let attrBonus = 0;
    for (const ap of attractions) {
      if (ap.id === plot.id) continue;
      const d = Math.hypot(ap.gridX - plot.gridX, ap.gridY - plot.gridY);
      if (d <= 4.2) {
        attrBonus += Math.round((4.5 - d) * 7);
      }
    }
    plot.attractionBonus = Math.min(35, attrBonus);

    // Przestępczość lokalna (Kasyna / duże centra vs Policja)
    let crime = plot.terrain === 'urban' ? 14 : 5;
    for (const cp of casinos) {
      const d = Math.hypot(cp.gridX - plot.gridX, cp.gridY - plot.gridY);
      if (d <= 6) {
        crime += Math.round((6.5 - d) * 9);
      }
    }
    if (
      plot.building &&
      (plot.building.type === 'jewelryWorkshop' ||
        plot.building.type === 'jewelryLuxury' ||
        plot.building.type === 'investmentBank' ||
        plot.building.type === 'shoppingMall')
    ) {
      crime += 15;
    }
    for (const pp of policeStations) {
      const fleet = pp.building?.fleetSize ?? 2;
      const patrolFactor = Math.min(45, fleet * 10);
      crime = Math.max(0, crime - Math.round(patrolFactor * 0.7));
    }
    plot.crimeScore = Math.max(0, Math.min(100, crime));

    const baseAttr =
      plot.terrain === 'coastal'
        ? 84
        : plot.terrain === 'urban'
          ? 78
          : plot.terrain === 'forest'
            ? 68
            : plot.terrain === 'grass'
              ? 56
              : plot.terrain === 'mountain'
                ? 42
                : plot.terrain === 'desert'
                  ? 28
                  : 50;

    let devBoost = 0;
    for (const p2 of devBoosters) {
      if (p2.id === plot.id) continue;
      const d = Math.hypot(p2.gridX - plot.gridX, p2.gridY - plot.gridY);
      if (d <= 3.5) devBoost += 6;
    }

    const radPenalty = (plot.irradiatedTicks ?? 0) > 0 ? 50 : 0;
    plot.attractiveness = Math.max(
      5,
      Math.min(
        100,
        baseAttr + Math.min(20, devBoost) + Math.round(plot.attractionBonus * 0.6) - plot.neighborPenalty - radPenalty
      )
    );

    if (plot.terrain === 'water') {
      plot.price = 0;
      plot.purchasable = false;
    } else {
      const roadFactor = plot.distanceToRoad <= 1 ? 1.18 : plot.distanceToRoad <= 3 ? 1.04 : 0.92;
      const visibleMineBonus =
        plot.building && plot.building.category === 'mining' ? 35_000 : 0;
      const devFactor = 1 + Math.min(1.0, (devBoost + plot.attractionBonus) * 0.035);
      const pollutionFactor = Math.max(0.6, 1 - plot.neighborPenalty * 0.004);
      const distCenter = Math.hypot(plot.gridX - size / 2, plot.gridY - size / 2);
      const locationBonus = Math.max(0.85, 1.32 - distCenter / (size * 1.15));

      plot.price =
        Math.round(
          (plot.basePrice * roadFactor * devFactor * pollutionFactor * locationBonus +
            visibleMineBonus) /
            500
        ) * 500;
      plot.purchasable = plot.ownerId === null && (plot.irradiatedTicks ?? 0) <= 0;
    }
  }
}

export function getPlayerOwnedPlotCount(state: GameState, playerId: string): number {
  let count = 0;
  for (let i = 0; i < state.plots.length; i++) {
    if (state.plots[i].ownerId === playerId) count++;
  }
  return count;
}

export function getExpansionPriceMultiplier(ownedCount: number): number {
  return Math.pow(1.075, Math.max(0, ownedCount));
}

export function getPlotPurchasePrice(
  plot: Plot,
  playerOrOwnedCount: Player | number,
  state?: GameState
): number {
  if (plot.terrain === 'water') return 0;
  const ownedCount =
    typeof playerOrOwnedCount === 'number'
      ? playerOrOwnedCount
      : state
        ? getPlayerOwnedPlotCount(state, playerOrOwnedCount.id)
        : (playerOrOwnedCount.ownedPlotCount ?? 0);
  return Math.round(plot.price * getExpansionPriceMultiplier(ownedCount));
}

function executeSinglePlotBuyCore(
  state: GameState,
  player: Player,
  plot: Plot,
  refreshRoads = true
): { ok: boolean; pricePaid: number; error?: string } {
  if (plot.terrain === 'water') {
    return { ok: false, pricePaid: 0, error: 'Nie można kupić akwenu wodnego.' };
  }
  if ((plot.irradiatedTicks ?? 0) > 0) {
    return {
      ok: false,
      pricePaid: 0,
      error: `Działka znajduje się w strefie skażenia nuklearnego (jeszcze ${plot.irradiatedTicks} tur).`,
    };
  }
  if (plot.ownerId !== null) {
    return { ok: false, pricePaid: 0, error: 'Działka ma już właściciela.' };
  }

  const purchasePrice = getPlotPurchasePrice(plot, player, state);
  if (player.cash < purchasePrice) {
    return {
      ok: false,
      pricePaid: 0,
      error: `Niewystarczająca gotówka na zakup działki (${purchasePrice.toLocaleString('pl-PL')} zł).`,
    };
  }

  player.cash -= purchasePrice;
  plot.ownerId = player.id;
  plot.purchasable = false;
  player.ownedPlotCount = getPlayerOwnedPlotCount(state, player.id);

  for (const neighbor of state.plots) {
    if (neighbor.id === plot.id || neighbor.terrain === 'water') continue;
    const d = Math.hypot(neighbor.gridX - plot.gridX, neighbor.gridY - plot.gridY);
    if (d <= 2.5) {
      neighbor.basePrice = Math.round(neighbor.basePrice * 1.03);
    }
  }
  state.networkRevision = (state.networkRevision ?? 0) + 1;
  recalculateSpatialNetwork(state.plots);
  if (refreshRoads) {
    refreshBuildingsRoadStatus(state);
  }
  return { ok: true, pricePaid: purchasePrice };
}

export function estimateBatchPlotsPurchaseCost(
  state: GameState,
  player: Player,
  candidatePlots: Plot[]
): { count: number; totalCost: number; perPlotPrices: number[] } {
  if (candidatePlots.length === 0) {
    return { count: 0, totalCost: 0, perPlotPrices: [] };
  }
  const simPlots = state.plots.map((p) => ({
    ...p,
    deposits: p.deposits,
  }));
  const simPlotById = new Map<string, Plot>();
  for (const p of simPlots) simPlotById.set(p.id, p);

  let ownedCount = getPlayerOwnedPlotCount(state, player.id);
  let totalCost = 0;
  const perPlotPrices: number[] = [];

  for (const orig of candidatePlots) {
    const plot = simPlotById.get(orig.id);
    if (
      !plot ||
      !plot.purchasable ||
      plot.ownerId !== null ||
      plot.terrain === 'water' ||
      (plot.irradiatedTicks ?? 0) > 0
    ) {
      continue;
    }
    const price = getPlotPurchasePrice(plot, ownedCount);
    perPlotPrices.push(price);
    totalCost += price;
    plot.ownerId = player.id;
    plot.purchasable = false;
    ownedCount++;

    for (const neighbor of simPlots) {
      if (neighbor.id === plot.id || neighbor.terrain === 'water') continue;
      const d = Math.hypot(neighbor.gridX - plot.gridX, neighbor.gridY - plot.gridY);
      if (d <= 2.5) {
        neighbor.basePrice = Math.round(neighbor.basePrice * 1.03);
      }
    }
    recalculateSpatialNetwork(simPlots);
  }

  return { count: perPlotPrices.length, totalCost, perPlotPrices };
}

export function buyPlotForPlayer(
  state: GameState,
  player: Player,
  plot: Plot
): { ok: boolean; error?: string } {
  const res = executeSinglePlotBuyCore(state, player, plot, true);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export function sellPlotForPlayer(
  state: GameState,
  player: Player,
  plot: Plot
): { ok: boolean; error?: string } {
  if (plot.ownerId !== player.id) return { ok: false, error: 'Nie jesteś właścicielem tej działki.' };
  if (plot.building) return { ok: false, error: 'Najpierw wyburz budynek stojący na działce.' };

  const saleValue = Math.round(plot.price * 0.92);
  player.cash += saleValue;
  plot.ownerId = null;
  plot.hasRoad = false;
  plot.roadType = 'none';
  plot.tollRate = 'free';
  plot.roadBlocked = false;
  plot.blockedPlayers = [];
  plot.isPlayerRoad = false;
  plot.purchasable = plot.terrain !== 'water' && (plot.irradiatedTicks ?? 0) <= 0;
  player.ownedPlotCount = getPlayerOwnedPlotCount(state, player.id);
  state.networkRevision = (state.networkRevision ?? 0) + 1;
  recalculateSpatialNetwork(state.plots);
  refreshBuildingsRoadStatus(state);
  return { ok: true };
}

export function getRoadBuildCostForPlot(
  state: GameState,
  player: Player,
  plot: Plot,
  roadClass: 'local' | 'highway' | 'bridge' = 'local'
): number {
  if (roadClass === 'local' && state.settings.mutators?.freeLocalRoads) {
    return 0;
  }
  const archMult = getArchetypeDefinition(player.archetype).modifiers.roadBuildCostMult;
  const govKind = state.government?.currentGov;
  const govDisc = govKind ? GOVERNMENT_CONFIGS[govKind].roadDiscount : 0;
  const baseCash =
    roadClass === 'bridge'
      ? GAME_CONFIG.bridgeCost
      : roadClass === 'highway'
        ? plot.hasRoad
          ? GAME_CONFIG.highwayCost - Math.round(GAME_CONFIG.playerRoadCost * 0.6)
          : GAME_CONFIG.highwayCost
        : GAME_CONFIG.playerRoadCost;

  let cashCost = Math.round(baseCash * archMult * (1 - govDisc));
  if (roadClass === 'highway') {
    for (const [resKey, needed] of Object.entries(GAME_CONFIG.highwayInputs)) {
      const res = resKey as ResourceType;
      const stock = player.warehouseStockpile[res] ?? 0;
      const missing = Math.max(0, needed - stock);
      if (missing > 0) {
        const mktPrice =
          state.resourcePrices.find((p) => p.type === res)?.price ?? 120;
        cashCost += Math.round(missing * mktPrice);
      }
    }
  }
  return Math.max(0, cashCost);
}

export function buildPlayerRoadOnPlot(
  state: GameState,
  player: Player,
  plot: Plot,
  roadClass: 'local' | 'highway' | 'bridge' = 'local'
): { ok: boolean; error?: string } {
  if ((plot.irradiatedTicks ?? 0) > 0) {
    return {
      ok: false,
      error: `Strefa skażenia nuklearnego — zakaz budowy dróg jeszcze przez ${plot.irradiatedTicks} tur.`,
    };
  }
  if (roadClass === 'bridge') {
    if (plot.terrain !== 'water') {
      return { ok: false, error: 'Most Drogowy można zbudować wyłącznie na polu wodnym.' };
    }
    if (plot.hasRoad) {
      return { ok: false, error: 'Na tym polu wodnym stoi już Most Drogowy.' };
    }
  } else {
    if (plot.terrain === 'water') {
      return { ok: false, error: 'Na wodzie można zbudować wyłącznie Most Drogowy (lub użyć Portu Towarowego).' };
    }
    if (plot.ownerId !== player.id) {
      return { ok: false, error: 'Najpierw kup działkę, aby wybudować na niej drogę.' };
    }
  }
  if (plot.building) {
    return { ok: false, error: 'Na działce stoi już struktura — drogi kładzie się na pustych działkach.' };
  }
  if (plot.hasRoad && plot.roadType === 'highway') {
    return { ok: false, error: 'Na tej działce znajduje się już Autostrada Płatna.' };
  }
  if (plot.hasRoad && roadClass === 'local') {
    return { ok: false, error: 'Na tej działce istnieje już Droga Zwykła. Możesz rozbudować ją do Autostrady.' };
  }

  const cashCost = getRoadBuildCostForPlot(state, player, plot, roadClass);

  if (player.cash < cashCost) {
    const label =
      roadClass === 'bridge' ? 'Mostu Drogowego' : roadClass === 'highway' ? 'Autostrady' : 'Drogi';
    return {
      ok: false,
      error: `Brak środków na budowę ${label} (${cashCost.toLocaleString('pl-PL')} zł).`,
    };
  }

  if (roadClass === 'highway') {
    for (const [resKey, needed] of Object.entries(GAME_CONFIG.highwayInputs)) {
      const res = resKey as ResourceType;
      const stock = player.warehouseStockpile[res] ?? 0;
      if (stock > 0) {
        player.warehouseStockpile[res] = Math.max(0, stock - needed);
      }
    }
  }

  player.cash -= cashCost;
  if (roadClass === 'bridge' && !plot.ownerId) {
    plot.ownerId = player.id;
    plot.purchasable = false;
  }
  plot.hasRoad = true;
  plot.isPlayerRoad = true;
  plot.roadType = roadClass;
  if (roadClass === 'highway' && plot.tollRate === 'free') {
    plot.tollRate = 'standard';
  }
  state.networkRevision = (state.networkRevision ?? 0) + 1;
  recalculateSpatialNetwork(state.plots);
  refreshBuildingsRoadStatus(state);
  return { ok: true };
}

export function setRoadPolicyForPlayer(
  player: Player,
  plot: Plot,
  opts: { tollRate?: TollRate; roadBlocked?: boolean; toggleBlockedPlayerId?: string }
): { ok: boolean; message: string } {
  if (plot.ownerId !== player.id || !plot.hasRoad) {
    return { ok: false, message: 'Możesz zarządzać mytem i blokadami wyłącznie na własnych drogach.' };
  }
  if (opts.tollRate) {
    plot.tollRate = opts.tollRate;
  }
  if (typeof opts.roadBlocked === 'boolean') {
    plot.roadBlocked = opts.roadBlocked;
  }
  if (opts.toggleBlockedPlayerId) {
    const cur = plot.blockedPlayers ?? [];
    if (cur.includes(opts.toggleBlockedPlayerId)) {
      plot.blockedPlayers = cur.filter((id) => id !== opts.toggleBlockedPlayerId);
    } else {
      plot.blockedPlayers = [...cur, opts.toggleBlockedPlayerId];
    }
  }
  const tollLabel = TOLL_RATE_CONFIG[plot.tollRate].label;
  return {
    ok: true,
    message: `Zaktualizowano odc. (${plot.gridX},${plot.gridY}): Stawka ${tollLabel}, Blokada: ${plot.roadBlocked ? 'WŁĄCZONA' : 'OTWARTA'}.`,
  };
}

export function surveyPlotForPlayer(
  state: GameState,
  player: Player,
  plot: Plot
): { ok: boolean; foundCount: number; error?: string } {
  if (plot.terrain === 'water') {
    return { ok: false, foundCount: 0, error: 'Akweny wodne nie podlegają badaniu geologicznemu.' };
  }
  if (plot.ownerId !== null && plot.ownerId !== player.id) {
    return { ok: false, foundCount: 0, error: 'Działka należy do konkurenta — użyj centrum wywiadu.' };
  }
  if (hasPlayerSurveyedPlot(plot, player.id)) {
    return { ok: false, foundCount: 0, error: 'Twoja firma już przebadała tę działkę.' };
  }

  const hasGeoTech = player.globalTech['ind_geology']?.status === 'done';
  const archGeoMult = getArchetypeDefinition(player.archetype).modifiers.surveyCostMult;
  const cost = Math.round(GAME_CONFIG.surveyCost * (hasGeoTech ? 0.7 : 1) * archGeoMult);
  if (player.cash < cost) {
    return { ok: false, foundCount: 0, error: 'Brak środków na badanie geologiczne.' };
  }

  player.cash -= cost;
  if (!plot.surveyedBy) plot.surveyedBy = {};
  plot.surveyedBy[player.id] = true;
  if (player.id === state.currentPlayerId) {
    plot.surveyed = true;
  }

  return { ok: true, foundCount: plot.deposits.length };
}

export function surveyAreaForPlayer(
  state: GameState,
  player: Player,
  centerPlot: Plot
): { ok: boolean; scannedPlots: number; foundCount: number; error?: string } {
  if (player.globalTech['ind_geology']?.status !== 'done') {
    return {
      ok: false,
      scannedPlots: 0,
      foundCount: 0,
      error: 'Skan Obszarowy 3×3 wymaga technologii "Geofizyka Złożowa i Georadar".',
    };
  }

  const candidates = state.plots.filter(
    (p) =>
      Math.abs(p.gridX - centerPlot.gridX) <= 1 &&
      Math.abs(p.gridY - centerPlot.gridY) <= 1 &&
      p.terrain !== 'water' &&
      (p.ownerId === null || p.ownerId === player.id) &&
      !hasPlayerSurveyedPlot(p, player.id)
  );

  if (candidates.length === 0) {
    return {
      ok: false,
      scannedPlots: 0,
      foundCount: 0,
      error: 'Wszystkie dostępne działki w obszarze 3×3 zostały już przez Ciebie zbadane.',
    };
  }

  const archGeoMult = getArchetypeDefinition(player.archetype).modifiers.surveyCostMult;
  const totalCost = Math.round(
    GAME_CONFIG.surveyCost * 0.7 * GAME_CONFIG.areaSurveyMultiplier * archGeoMult
  );
  if (player.cash < totalCost) {
    return {
      ok: false,
      scannedPlots: 0,
      foundCount: 0,
      error: `Brak środków na Skan Georadarowy 3×3 (${totalCost.toLocaleString('pl-PL')} zł).`,
    };
  }

  player.cash -= totalCost;
  let foundCount = 0;
  for (const p of candidates) {
    if (!p.surveyedBy) p.surveyedBy = {};
    p.surveyedBy[player.id] = true;
    if (player.id === state.currentPlayerId) {
      p.surveyed = true;
    }
    foundCount += p.deposits.length;
  }

  return { ok: true, scannedPlots: candidates.length, foundCount };
}

// ─── Oferty wykupu działek od innych graczy (PvP i AI) ────────────────────────

export function getSuggestedPlotBuyoutValuation(plot: Plot, includeBuilding: boolean): number {
  let total = plot.price;
  if (plot.hasRoad) {
    total += plot.roadType === 'highway' ? GAME_CONFIG.highwayCost : GAME_CONFIG.playerRoadCost;
  }
  if (includeBuilding && plot.building) {
    const def = BUILDING_DEFINITIONS[plot.building.type];
    total += Math.round(def.baseCost * (plot.building.condition / 100) * 1.1);
  }
  return Math.round(total / 1000) * 1000;
}

export function proposePlotOfferForPlayer(
  state: GameState,
  buyer: Player,
  plot: Plot,
  offeredPrice: number,
  includeBuilding: boolean
): { ok: boolean; offer?: PlotOffer; message: string } {
  if (!plot.ownerId || plot.ownerId === buyer.id) {
    return { ok: false, message: 'Możesz składać oferty wyłącznie na działki innych graczy.' };
  }
  if (offeredPrice <= 0) return { ok: false, message: 'Oferowana kwota musi być dodatnia.' };
  if (buyer.cash < offeredPrice) {
    return { ok: false, message: 'Nie masz wystarczającej gotówki na pokrycie tej oferty.' };
  }

  const seller = state.players.find((p) => p.id === plot.ownerId);
  if (!seller) return { ok: false, message: 'Nie znaleziono właściciela działki.' };

  const offer: PlotOffer = {
    id: `poff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    plotId: plot.id,
    gridX: plot.gridX,
    gridY: plot.gridY,
    fromPlayerId: buyer.id,
    fromName: buyer.companyName,
    toPlayerId: seller.id,
    toName: seller.companyName,
    offeredPrice: Math.round(offeredPrice),
    includeBuilding: Boolean(plot.building && includeBuilding),
    status: 'pending',
    createdTick: state.time.tick,
  };

  if (seller.isAI) {
    const aiEval = evaluateAIPlotOffer(state, buyer, seller, plot, offer);
    if (aiEval.decision === 'accept') {
      executePlotOwnershipTransfer(state, buyer, seller, plot, offer.offeredPrice, offer.includeBuilding);
      offer.status = 'accepted';
      state.plotOffers = [offer, ...state.plotOffers].slice(0, 30);
      return {
        ok: true,
        offer,
        message: `${seller.companyName} zaakceptowała ofertę wykupu działki (${plot.gridX},${plot.gridY}) za ${offer.offeredPrice.toLocaleString('pl-PL')} zł!`,
      };
    }
    if (aiEval.decision === 'counter' && aiEval.counterPrice) {
      offer.status = 'countered';
      offer.counterPrice = aiEval.counterPrice;
      state.plotOffers = [offer, ...state.plotOffers].slice(0, 30);
      return {
        ok: true,
        offer,
        message: `${seller.companyName} złożyła kontrofertę: ${aiEval.counterPrice.toLocaleString('pl-PL')} zł! Sprawdź w oknie Negocjacji.`,
      };
    }
    offer.status = 'rejected';
    state.plotOffers = [offer, ...state.plotOffers].slice(0, 30);
    return {
      ok: false,
      offer,
      message: `${seller.companyName} odrzuciła ofertę — uważa działkę za zbyt cenną lub zbyt niską wycenę.`,
    };
  }

  state.plotOffers = [offer, ...state.plotOffers].slice(0, 30);
  return {
    ok: true,
    offer,
    message: `Wysłano ofertę wykupu działki (${plot.gridX},${plot.gridY}) do ${seller.companyName}.`,
  };
}

function evaluateAIPlotOffer(
  state: GameState,
  buyer: Player,
  ai: Player,
  plot: Plot,
  offer: PlotOffer
): { decision: 'accept' | 'reject' | 'counter'; counterPrice?: number } {
  const baseVal = getSuggestedPlotBuyoutValuation(plot, offer.includeBuilding);
  const aiKnowsStrategic =
    hasPlayerSurveyedPlot(plot, ai.id) &&
    plot.deposits.some((d) => d.type === 'uranium' || d.type === 'oil' || d.type === 'gold' || d.type === 'rareMetals');
  const strategicMult = aiKnowsStrategic ? 1.75 : plot.building ? 1.32 : plot.hasRoad ? 1.4 : 1.12;
  const buyerNegBonus = getPlayerEntrepreneurModifiers(state, buyer).plotNegotiationBonus;
  const requiredPrice = Math.round(baseVal * strategicMult * Math.max(0.7, 1 - buyerNegBonus));

  if (offer.offeredPrice >= requiredPrice) {
    return { decision: 'accept' };
  }
  if (offer.offeredPrice >= requiredPrice * 0.72) {
    return {
      decision: 'counter',
      counterPrice: Math.round((requiredPrice * 1.05) / 1000) * 1000,
    };
  }
  return { decision: 'reject' };
}

export function respondPlotOfferForPlayer(
  state: GameState,
  responder: Player,
  offerId: string,
  response: 'accept' | 'reject' | 'counter',
  counterPrice?: number
): { ok: boolean; message: string } {
  const offer = state.plotOffers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, message: 'Nie znaleziono oferty wykupu.' };

  const plot = state.plots.find((p) => p.id === offer.plotId);
  const buyer = state.players.find((p) => p.id === offer.fromPlayerId);
  const seller = state.players.find((p) => p.id === offer.toPlayerId);
  if (!plot || !buyer || !seller) return { ok: false, message: 'Nieaktualne strony transakcji.' };

  if (offer.status === 'countered' && responder.id === buyer.id) {
    if (response === 'reject') {
      offer.status = 'rejected';
      return { ok: true, message: 'Odrzucono kontrofertę właściciela.' };
    }
    if (response === 'accept') {
      const price = offer.counterPrice ?? offer.offeredPrice;
      if (buyer.cash < price) return { ok: false, message: 'Brak środków na przyjęcie kontroferty.' };
      executePlotOwnershipTransfer(state, buyer, seller, plot, price, offer.includeBuilding);
      offer.status = 'accepted';
      return {
        ok: true,
        message: `Kupiono działkę (${plot.gridX},${plot.gridY}) po kontrofercie za ${price.toLocaleString('pl-PL')} zł!`,
      };
    }
  }

  if (offer.status !== 'pending' || responder.id !== seller.id) {
    return { ok: false, message: 'Nie masz uprawnień do odpowiedzi na tę ofertę.' };
  }

  if (response === 'reject') {
    offer.status = 'rejected';
    return { ok: true, message: 'Odrzucono ofertę wykupu działki.' };
  }

  if (response === 'counter') {
    if (!counterPrice || counterPrice <= 0) return { ok: false, message: 'Podaj poprawną kwotę kontroferty.' };
    offer.status = 'countered';
    offer.counterPrice = Math.round(counterPrice);
    return { ok: true, message: `Wysłano kontrofertę ${offer.counterPrice.toLocaleString('pl-PL')} zł.` };
  }

  if (buyer.cash < offer.offeredPrice) {
    offer.status = 'rejected';
    return { ok: false, message: 'Kupujący nie posiada już wystarczających środków.' };
  }
  executePlotOwnershipTransfer(state, buyer, seller, plot, offer.offeredPrice, offer.includeBuilding);
  offer.status = 'accepted';
  return {
    ok: true,
    message: `Sprzedano działkę (${plot.gridX},${plot.gridY}) do ${buyer.companyName} za ${offer.offeredPrice.toLocaleString('pl-PL')} zł!`,
  };
}

function executePlotOwnershipTransfer(
  state: GameState,
  buyer: Player,
  seller: Player,
  plot: Plot,
  price: number,
  includeBuilding: boolean
): void {
  buyer.cash -= price;
  seller.cash += price;
  plot.ownerId = buyer.id;
  plot.roadBlocked = false;
  plot.blockedPlayers = [];
  if (plot.building) {
    if (includeBuilding) {
      plot.building.ownerId = buyer.id;
    } else {
      const def = BUILDING_DEFINITIONS[plot.building.type];
      seller.cash += Math.round(def.baseCost * 0.35);
      plot.building = null;
    }
  }
  recalculateSpatialNetwork(state.plots);
}

// ─── Zbiorcze akcje QoL (v6.0 · Atomowe pakiety pod PeerJS/TURN) ──────────────

export function batchBuyPlotsForPlayer(
  state: GameState,
  player: Player,
  plotIds: string[]
): { ok: boolean; boughtCount: number; totalSpent: number; error?: string } {
  const uniqueIds = Array.from(new Set(plotIds));
  const candidates = uniqueIds
    .map((id) => state.plots.find((p) => p.id === id))
    .filter(
      (p): p is Plot =>
        Boolean(p && p.purchasable && p.ownerId === null && p.terrain !== 'water' && (p.irradiatedTicks ?? 0) <= 0)
    );

  if (candidates.length === 0) {
    return { ok: false, boughtCount: 0, totalSpent: 0, error: 'Brak wolnych działek do zakupu w zaznaczeniu.' };
  }

  let boughtCount = 0;
  let totalSpent = 0;
  for (const plot of candidates) {
    const bought = executeSinglePlotBuyCore(state, player, plot, false);
    if (!bought.ok) break;
    totalSpent += bought.pricePaid;
    boughtCount++;
  }

  if (boughtCount === 0) {
    return { ok: false, boughtCount: 0, totalSpent: 0, error: 'Niewystarczająca gotówka na zakup zaznaczonych działek.' };
  }

  refreshBuildingsRoadStatus(state);
  return { ok: true, boughtCount, totalSpent };
}

export function batchSurveyPlotsForPlayer(
  state: GameState,
  player: Player,
  plotIds: string[]
): { ok: boolean; scannedCount: number; foundCount: number; totalCost: number; error?: string } {
  const uniqueIds = Array.from(new Set(plotIds));
  const candidates = uniqueIds
    .map((id) => state.plots.find((p) => p.id === id))
    .filter(
      (p): p is Plot =>
        Boolean(
          p &&
            p.terrain !== 'water' &&
            (p.ownerId === null || p.ownerId === player.id) &&
            !hasPlayerSurveyedPlot(p, player.id)
        )
    );

  if (candidates.length === 0) {
    return {
      ok: false,
      scannedCount: 0,
      foundCount: 0,
      totalCost: 0,
      error: 'Wszystkie dostępne działki w zaznaczeniu zostały już zbadane.',
    };
  }

  const hasGeoTech = player.globalTech['ind_geology']?.status === 'done';
  const archGeoMult = getArchetypeDefinition(player.archetype).modifiers.surveyCostMult;
  const perPlotCost = Math.round(GAME_CONFIG.surveyCost * (hasGeoTech ? 0.7 : 1) * archGeoMult * 0.88);
  const fullCost = perPlotCost * candidates.length;

  let scannedCount = 0;
  let foundCount = 0;
  let totalCost = 0;

  for (const p of candidates) {
    if (player.cash < perPlotCost) break;
    player.cash -= perPlotCost;
    totalCost += perPlotCost;
    if (!p.surveyedBy) p.surveyedBy = {};
    p.surveyedBy[player.id] = true;
    if (player.id === state.currentPlayerId) {
      p.surveyed = true;
    }
    foundCount += p.deposits.length;
    scannedCount++;
  }

  if (scannedCount === 0) {
    return {
      ok: false,
      scannedCount: 0,
      foundCount: 0,
      totalCost: 0,
      error: `Brak środków na hurtową geologię (${fullCost.toLocaleString('pl-PL')} zł).`,
    };
  }

  return { ok: true, scannedCount, foundCount, totalCost };
}

export function batchBuildRoadForPlayer(
  state: GameState,
  player: Player,
  plotIds: string[],
  roadClass: 'local' | 'highway' | 'bridge'
): { ok: boolean; builtCount: number; totalCost: number; error?: string } {
  const uniqueIds = Array.from(new Set(plotIds));
  let builtCount = 0;
  let totalCost = 0;

  for (const id of uniqueIds) {
    const plot = state.plots.find((p) => p.id === id);
    if (!plot || (plot.irradiatedTicks ?? 0) > 0) continue;

    if (roadClass === 'bridge' && plot.terrain === 'water') {
      if (plot.hasRoad || plot.building) continue;
      const cost = getRoadBuildCostForPlot(state, player, plot, 'bridge');
      if (player.cash < cost) break;
      player.cash -= cost;
      totalCost += cost;
      if (!plot.ownerId) {
        plot.ownerId = player.id;
        plot.purchasable = false;
      }
      plot.hasRoad = true;
      plot.isPlayerRoad = true;
      plot.roadType = 'bridge';
      plot.tollRate = 'free';
      builtCount++;
      continue;
    }

    const effectiveClass: 'local' | 'highway' = roadClass === 'bridge' ? 'local' : roadClass;

    // W trybie Drag-to-Build pozwalamy najpierw automatycznie kupić wolną działkę, jeśli nie ma właściciela,
    // LUB budować bezpośrednio na własnych działkach bez budynku
    if (plot.ownerId === null && plot.purchasable && plot.terrain !== 'water') {
      const roadCost = getRoadBuildCostForPlot(state, player, plot, effectiveClass);
      const landPrice = getPlotPurchasePrice(plot, player, state);
      if (player.cash < landPrice + roadCost) break;
      const bought = executeSinglePlotBuyCore(state, player, plot, false);
      if (!bought.ok) break;
      totalCost += bought.pricePaid;
    }
    if (plot.ownerId !== player.id || plot.building || plot.terrain === 'water') {
      continue;
    }
    if (plot.hasRoad && (effectiveClass === 'local' || plot.roadType === 'highway')) {
      continue;
    }
    const cost = getRoadBuildCostForPlot(state, player, plot, effectiveClass);
    if (player.cash < cost) break;
    player.cash -= cost;
    totalCost += cost;
    plot.hasRoad = true;
    plot.isPlayerRoad = true;
    plot.roadType = effectiveClass;
    if (effectiveClass === 'highway' && plot.tollRate === 'free') {
      plot.tollRate = 'standard';
    }
    builtCount++;
  }

  if (builtCount === 0) {
    return {
      ok: false,
      builtCount: 0,
      totalCost: 0,
      error: 'Nie wybudowano żadnego odcinka (brak środków lub zajęte działki).',
    };
  }

  state.networkRevision = (state.networkRevision ?? 0) + 1;
  recalculateSpatialNetwork(state.plots);
  refreshBuildingsRoadStatus(state);
  return { ok: true, builtCount, totalCost };
}

export function applyHighwayPolicyToAllForPlayer(
  state: GameState,
  player: Player,
  tollRate: TollRate,
  roadBlocked: boolean
): { ok: boolean; updatedCount: number; message: string } {
  let updatedCount = 0;
  for (const p of state.plots) {
    if (p.ownerId === player.id && p.hasRoad && p.roadType === 'highway') {
      p.tollRate = tollRate;
      p.roadBlocked = roadBlocked;
      updatedCount++;
    }
  }
  if (updatedCount === 0) {
    return { ok: false, updatedCount: 0, message: 'Nie posiadasz jeszcze żadnych autostrad płatnych.' };
  }
  state.networkRevision = (state.networkRevision ?? 0) + 1;
  return {
    ok: true,
    updatedCount,
    message: `Zastosowano stawkę "${TOLL_RATE_CONFIG[tollRate].label}" i blokadę (${roadBlocked ? 'WŁ' : 'WYŁ'}) do ${updatedCount} odcinków autostrad.`,
  };
}
