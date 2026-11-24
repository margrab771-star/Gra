import { GAME_CONFIG, TOLL_RATE_CONFIG } from '../config/gameConfig';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { getPlayerEntrepreneurModifiers } from './EconomyEngine';
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

export function generateMap(size: number, seed = Math.floor(Math.random() * 10000)): Plot[] {
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
        if (rRoll2 > 0.8) {
          deposits.push({
            type: rRoll2 > 0.9 ? 'uranium' : 'gold',
            amount: 2600,
            richness: 1.25,
            discovered: false,
          });
        }
        if (hash2D(x, y, seed + 177) > 0.78) {
          deposits.push({
            type: 'rareMetals',
            amount: 2800,
            richness: 1.2,
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
        if (hash2D(x, y, seed + 205) > 0.82) {
          deposits.push({
            type: rRoll2 > 0.5 ? 'gold' : 'uranium',
            amount: 2300,
            richness: 1.18,
            discovered: false,
          });
        }
      } else if (terrain === 'grass' || terrain === 'forest') {
        if (rRoll > 0.74) {
          const types: ResourceType[] = ['coal', 'ironOre', 'copper', 'oil', 'rareMetals'];
          const chosen = types[Math.floor(hash2D(x, y, seed + 303) * types.length)];
          deposits.push({
            type: chosen,
            amount: 4200,
            richness: 1.08,
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

export function hasPlayerDiscoveredPlot(
  plot: Plot,
  viewerId: string,
  viewerPlayer?: Player
): boolean {
  if (hasPlayerSurveyedPlot(plot, viewerId)) return true;
  if (plot.building && plot.building.category === 'mining') return true;
  if (plot.ownerId && viewerPlayer?.spiedPlayers?.[plot.ownerId]) return true;
  return false;
}

export function recalculateSpatialNetwork(plots: Plot[]): void {
  const size = Math.round(Math.sqrt(plots.length));
  const roadPlots = plots.filter((p) => p.hasRoad);
  const powerGenerators = plots.filter(
    (p) =>
      p.building &&
      p.building.isActive &&
      (p.building.category === 'energy' || p.building.type === 'copperCablePlant')
  );
  const waterSources = plots.filter(
    (p) =>
      p.terrain === 'water' ||
      p.terrain === 'coastal' ||
      (p.building && p.building.isActive && p.building.type === 'waterPlant')
  );
  const heavyIndustry = plots.filter(
    (p) =>
      p.building &&
      p.building.isActive &&
      (p.building.category === 'mining' ||
        p.building.type === 'oilRefinery' ||
        p.building.type === 'steelMill' ||
        p.building.type === 'chemicalPlant' ||
        p.building.type === 'coalPowerPlant')
  );
  const attractions = plots.filter(
    (p) =>
      p.building &&
      p.building.isActive &&
      (p.building.type === 'amusementPark' ||
        p.building.type === 'culturalCenter' ||
        p.building.type === 'marinaPromenade' ||
        p.building.type === 'casino')
  );
  const casinos = plots.filter(
    (p) => p.building && p.building.isActive && p.building.type === 'casino'
  );
  const policeStations = plots.filter(
    (p) =>
      p.building &&
      p.building.isActive &&
      (p.building.type === 'policeStation' || p.building.type === 'militaryBase')
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
        const factor = hazmatLeak ? 1.8 : hasCleanFilter ? 0.2 : 1.0;
        penalty += Math.round((4.0 - d) * 10 * factor);
      }
    }
    plot.neighborPenalty = Math.min(75, penalty);

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
    for (const p2 of plots) {
      if (!p2.building || p2.id === plot.id) continue;
      if (
        p2.building.category === 'real_estate' ||
        p2.building.category === 'attractions' ||
        p2.building.category === 'education'
      ) {
        const d = Math.hypot(p2.gridX - plot.gridX, p2.gridY - plot.gridY);
        if (d <= 3.5) devBoost += 6;
      }
    }

    plot.attractiveness = Math.max(
      5,
      Math.min(
        100,
        baseAttr + Math.min(20, devBoost) + Math.round(plot.attractionBonus * 0.6) - plot.neighborPenalty
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
      plot.purchasable = plot.ownerId === null;
    }
  }
}

export function buyPlotForPlayer(
  state: GameState,
  player: Player,
  plot: Plot
): { ok: boolean; error?: string } {
  if (plot.terrain === 'water') return { ok: false, error: 'Nie można kupić akwenu wodnego.' };
  if (plot.ownerId !== null) return { ok: false, error: 'Działka ma już właściciela.' };
  if (player.cash < plot.price) return { ok: false, error: 'Niewystarczająca gotówka na zakup działki.' };

  player.cash -= plot.price;
  plot.ownerId = player.id;
  plot.purchasable = false;

  for (const neighbor of state.plots) {
    if (neighbor.id === plot.id || neighbor.terrain === 'water') continue;
    const d = Math.hypot(neighbor.gridX - plot.gridX, neighbor.gridY - plot.gridY);
    if (d <= 2.5) {
      neighbor.basePrice = Math.round(neighbor.basePrice * 1.03);
    }
  }
  recalculateSpatialNetwork(state.plots);
  return { ok: true };
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
  plot.purchasable = plot.terrain !== 'water';
  recalculateSpatialNetwork(state.plots);
  return { ok: true };
}

export function buildPlayerRoadOnPlot(
  state: GameState,
  player: Player,
  plot: Plot,
  roadClass: 'local' | 'highway' = 'local'
): { ok: boolean; error?: string } {
  if (plot.terrain === 'water') {
    return { ok: false, error: 'Nie można budować drogi na wodzie (użyj Portu Towarowego).' };
  }
  if (plot.ownerId !== player.id) {
    return { ok: false, error: 'Najpierw kup działkę, aby wybudować na niej drogę.' };
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

  let cashCost =
    roadClass === 'highway'
      ? plot.hasRoad
        ? GAME_CONFIG.highwayCost - Math.round(GAME_CONFIG.playerRoadCost * 0.6)
        : GAME_CONFIG.highwayCost
      : GAME_CONFIG.playerRoadCost;

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

  if (player.cash < cashCost) {
    return {
      ok: false,
      error: `Brak środków na budowę ${roadClass === 'highway' ? 'Autostrady' : 'Drogi'} (${cashCost.toLocaleString('pl-PL')} zł).`,
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
  plot.hasRoad = true;
  plot.isPlayerRoad = true;
  plot.roadType = roadClass;
  if (roadClass === 'highway' && plot.tollRate === 'free') {
    plot.tollRate = 'standard';
  }
  recalculateSpatialNetwork(state.plots);
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
  const cost = Math.round(GAME_CONFIG.surveyCost * (hasGeoTech ? 0.7 : 1));
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

  const totalCost = Math.round(
    GAME_CONFIG.surveyCost * 0.7 * GAME_CONFIG.areaSurveyMultiplier
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
