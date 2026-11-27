import { TOLL_RATE_CONFIG } from '../config/gameConfig';
import { getArchetypeDefinition } from '../data/archetypes';
import { getCurrentLanguage } from '../i18n';
import { arePlayersAllied, hasActiveEmbargo } from './CoalitionSystem';
import type {
  Building,
  BuildingType,
  GameState,
  Player,
  Plot,
  ResourceType,
  TransportRouteLine,
  Vehicle,
} from './types';

const ROAD_EXEMPT_BUILDINGS = new Set<BuildingType>([
  'corporateHQ',
  'cityPark',
  'monumentFountain',
  'monumentObelisk',
  'monumentHelipad',
  'monumentFounder',
]);

export function isRoadExemptBuilding(type: BuildingType): boolean {
  return ROAD_EXEMPT_BUILDINGS.has(type);
}

/**
 * Twarda zasada dostępu do drogi:
 * Budynek ma dostęp do drogi wtedy, gdy na przynajmniej jednym z 4 sąsiednich pól (N/S/E/W)
 * znajduje się przejezdna droga lub autostrada (albo pole graniczy z aktywną Siedzibą Główną HQ właściciela).
 * Wyjątki: corporateHQ i cityPark.
 */
export function hasRoadAccess(
  state: GameState,
  plot: Plot,
  playerId?: string
): boolean {
  if (plot.building && ROAD_EXEMPT_BUILDINGS.has(plot.building.type)) {
    return true;
  }
  if ((plot.irradiatedTicks ?? 0) > 0) return false;
  if (plot.hasRoad) return true;

  const ownerId = playerId ?? plot.ownerId ?? plot.building?.ownerId ?? '';
  const plotsByCoord = getPlotsByCoordCached(state);
  for (const [dx, dy] of DIRS) {
    const nb = plotsByCoord.get(`${plot.gridX + dx}_${plot.gridY + dy}`);
    if (!nb || (nb.irradiatedTicks ?? 0) > 0) continue;
    if (isRoadPassableFor(nb, ownerId, state)) {
      return true;
    }
    if (
      nb.building &&
      !nb.building.destroyedRuins &&
      nb.building.type === 'corporateHQ' &&
      (!ownerId || nb.ownerId === ownerId || arePlayersAllied(state, nb.ownerId ?? '', ownerId))
    ) {
      return true;
    }
  }
  return false;
}

export function refreshBuildingsRoadStatus(state: GameState): void {
  for (const plot of state.plots) {
    const b = plot.building;
    if (!b || b.destroyedRuins) continue;
    const ownerId = plot.ownerId ?? b.ownerId;
    const roadOk = isRoadExemptBuilding(b.type) || hasRoadAccess(state, plot, ownerId);
    const logiMode = evaluatePlotLogisticsMode(state, ownerId, plot);
    b.hasRoadConnection = roadOk;
    b.status.noRoadLink = !roadOk;
    b.logisticsMode = !roadOk ? 'isolated' : logiMode === 'isolated' ? 'road' : logiMode;
  }
}

const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

let cachedStamp = '';
let cachedCoordMap = new Map<string, Plot>();
const cachedRoutes = new Map<string, DijkstraRouteResult | null>();
const cachedEtaByPlayer = new Map<string, Record<string, number>>();

function getNetworkStamp(state: GameState): string {
  return `${state.networkRevision ?? 0}_${state.plots.length}_${state.coalitions?.length ?? 0}_${state.embargoes?.length ?? 0}`;
}

function getPlotsByCoordCached(state: GameState): Map<string, Plot> {
  const stamp = getNetworkStamp(state);
  if (stamp !== cachedStamp || cachedCoordMap.size !== state.plots.length) {
    cachedStamp = stamp;
    cachedCoordMap = new Map<string, Plot>();
    for (const p of state.plots) cachedCoordMap.set(`${p.gridX}_${p.gridY}`, p);
    cachedRoutes.clear();
    cachedEtaByPlayer.clear();
  }
  return cachedCoordMap;
}

export function isRoadPassableFor(p: Plot | undefined, travelerId: string, state?: GameState): boolean {
  if (!p || !p.hasRoad) return false;
  if ((p.irradiatedTicks ?? 0) > 0) return false;
  if (!p.ownerId || p.ownerId === travelerId) return true;
  if (p.roadBlocked) return false;
  if (state && hasActiveEmbargo(state, p.ownerId, travelerId)) return false;
  if (state && arePlayersAllied(state, p.ownerId, travelerId)) return true;
  if (p.blockedPlayers && p.blockedPlayers.includes(travelerId)) return false;
  return true;
}

export function getRoadStepCost(
  p: Plot,
  travelerId: string,
  ignoreTolls = false,
  state?: GameState
): number {
  const speedWeight = p.roadType === 'highway' ? 1.0 : 2.2;
  if (ignoreTolls || !p.ownerId || p.ownerId === travelerId) {
    return speedWeight;
  }
  if (state && arePlayersAllied(state, p.ownerId, travelerId)) {
    return speedWeight;
  }
  const tollPenalty = TOLL_RATE_CONFIG[p.tollRate ?? 'free']?.weightPenalty ?? 0;
  return speedWeight + tollPenalty;
}

function isWaterPlot(p: Plot | undefined): boolean {
  return Boolean(p && p.terrain === 'water');
}

function getAdjacentPassableRoads(
  plot: Plot,
  plotsByCoord: Map<string, Plot>,
  travelerId: string,
  state?: GameState
): Plot[] {
  const out: Plot[] = [];
  for (const [dx, dy] of DIRS) {
    const nb = plotsByCoord.get(`${plot.gridX + dx}_${plot.gridY + dy}`);
    if (isRoadPassableFor(nb, travelerId, state)) out.push(nb!);
  }
  return out;
}

export interface DijkstraRouteResult {
  path: string[];
  weight: number;
  etaTicks: number;
  rivalTollPlots: Plot[];
  usesHighway: boolean;
}

/**
 * Ważony algorytm Dijkstry uwzględniający klasę drogi (Zwykła vs Autostrada),
 * wysokość myta oraz ewentualne blokady tranzytu dla danego gracza.
 */
export function computeWeightedRoadRoute(
  src: Plot,
  dst: Plot,
  travelerId: string,
  state: GameState,
  ignoreTolls = false
): DijkstraRouteResult | null {
  const plotsByCoord = getPlotsByCoordCached(state);
  const cacheKey = `${travelerId}|${src.id}|${dst.id}|${ignoreTolls ? 1 : 0}`;
  if (cachedRoutes.has(cacheKey)) {
    return cachedRoutes.get(cacheKey) ?? null;
  }

  const res = computeWeightedRoadRouteWithIndex(src, dst, travelerId, plotsByCoord, ignoreTolls, state);
  if (cachedRoutes.size > 600) cachedRoutes.clear();
  cachedRoutes.set(cacheKey, res);
  return res;
}

export function computeWeightedRoadRouteWithIndex(
  src: Plot,
  dst: Plot,
  travelerId: string,
  plotsByCoord: Map<string, Plot>,
  ignoreTolls = false,
  state?: GameState
): DijkstraRouteResult | null {
  if (src.id === dst.id) {
    return { path: [src.id], weight: 0, etaTicks: 1, rivalTollPlots: [], usesHighway: false };
  }

  if (state) {
    getPlotsByCoordCached(state);
    const cacheKey = `${travelerId}|${src.id}|${dst.id}|${ignoreTolls ? 1 : 0}`;
    if (cachedRoutes.has(cacheKey)) {
      return cachedRoutes.get(cacheKey) ?? null;
    }
  }

  const startRoads = isRoadPassableFor(src, travelerId, state)
    ? [src]
    : getAdjacentPassableRoads(src, plotsByCoord, travelerId, state);
  const endRoads = isRoadPassableFor(dst, travelerId, state)
    ? [dst]
    : getAdjacentPassableRoads(dst, plotsByCoord, travelerId, state);

  if (startRoads.length === 0 || endRoads.length === 0) return null;

  const endSet = new Set(endRoads.map((r) => r.id));
  const dist = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const plotRef = new Map<string, Plot>();
  const queue: { plot: Plot; cost: number }[] = [];

  for (const sr of startRoads) {
    const c = getRoadStepCost(sr, travelerId, ignoreTolls, state);
    dist.set(sr.id, c);
    parent.set(sr.id, null);
    plotRef.set(sr.id, sr);
    queue.push({ plot: sr, cost: c });
  }

  let reached: Plot | null = null;
  let finalCost = 0;

  while (queue.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].cost < queue[minIdx].cost) minIdx = i;
    }
    const { plot: cur, cost: curCost } = queue.splice(minIdx, 1)[0];
    if (curCost > (dist.get(cur.id) ?? Infinity)) continue;

    if (endSet.has(cur.id)) {
      reached = cur;
      finalCost = curCost;
      break;
    }

    for (const [dx, dy] of DIRS) {
      const nb = plotsByCoord.get(`${cur.gridX + dx}_${cur.gridY + dy}`);
      if (!nb || !isRoadPassableFor(nb, travelerId, state)) continue;
      const stepCost = curCost + getRoadStepCost(nb, travelerId, ignoreTolls, state);
      if (stepCost < (dist.get(nb.id) ?? Infinity)) {
        dist.set(nb.id, stepCost);
        parent.set(nb.id, cur.id);
        plotRef.set(nb.id, nb);
        queue.push({ plot: nb, cost: stepCost });
      }
    }
  }

  if (!reached) {
    if (state) cachedRoutes.set(`${travelerId}|${src.id}|${dst.id}|${ignoreTolls ? 1 : 0}`, null);
    return null;
  }

  const chain: string[] = [];
  const rivalTollPlots: Plot[] = [];
  let usesHighway = false;
  let curId: string | null = reached.id;
  let rawRoadTime = 0;

  while (curId !== null) {
    chain.unshift(curId);
    const rp = plotRef.get(curId);
    if (rp) {
      if (rp.roadType === 'highway') {
        usesHighway = true;
        rawRoadTime += 0.32;
      } else {
        rawRoadTime += 0.72;
      }
      if (
        rp.ownerId &&
        rp.ownerId !== travelerId &&
        rp.tollRate !== 'free' &&
        !(state && arePlayersAllied(state, rp.ownerId, travelerId))
      ) {
        rivalTollPlots.push(rp);
      }
    }
    curId = parent.get(curId) ?? null;
  }

  const full: string[] = [];
  if (src.id !== chain[0]) full.push(src.id);
  full.push(...chain);
  if (dst.id !== chain[chain.length - 1]) full.push(dst.id);

  const out: DijkstraRouteResult = {
    path: full.length >= 2 ? full : [src.id, dst.id],
    weight: finalCost,
    etaTicks: Math.max(1, Math.round(rawRoadTime)),
    rivalTollPlots,
    usesHighway,
  };
  if (state) {
    if (cachedRoutes.size > 600) cachedRoutes.clear();
    cachedRoutes.set(`${travelerId}|${src.id}|${dst.id}|${ignoreTolls ? 1 : 0}`, out);
  }
  return out;
}

export function evaluatePlotLogisticsMode(
  state: GameState,
  playerId: string,
  plot: Plot
): Building['logisticsMode'] {
  if ((plot.irradiatedTicks ?? 0) > 0) return 'isolated';
  if (plot.building && ROAD_EXEMPT_BUILDINGS.has(plot.building.type)) {
    return 'road';
  }

  const plotsByCoord = getPlotsByCoordCached(state);

  // Twarde sprawdzenie przyległości do drogi/autostrady lub HQ na 4 sąsiednich polach
  const directAccess = hasRoadAccess(state, plot, playerId);
  if (!directAccess) {
    return 'isolated';
  }

  const clusters = computeNetworkClusters(state);
  const plotCluster = clusters.clusterByPlotId.get(plot.id) ?? 0;

  // Połączenie drogowe z siecią (preferencja dla połączeń do strefy miejskiej / HQ / Portu / Lotniska / Magazynu)
  const startRoads = isRoadPassableFor(plot, playerId, state)
    ? [plot]
    : getAdjacentPassableRoads(plot, plotsByCoord, playerId, state);

  // Jeśli sąsiaduje bezpośrednio z HQ, od razu uznajemy połączenie drogowe
  if (startRoads.length === 0) {
    return 'road';
  }

  // Lotnisko Cargo dodaje tryb lotniczy TYLKO w obrębie tego samego klastra lądowo-mostowego
  const hasAirport =
    plotCluster !== 0 &&
    state.plots.some(
      (p) =>
        p.ownerId === playerId &&
        p.building?.type === 'cargoAirport' &&
        p.building.isActive &&
        !p.building.destroyedRuins &&
        clusters.clusterByPlotId.get(p.id) === plotCluster
    );
  if (hasAirport) return 'air';

  // Port Towarowy obsługuje ładunki w tym samym klastrze sieciowym (bez teleportacji przez wodę)
  const hasPort =
    plotCluster !== 0 &&
    state.plots.some(
      (p) =>
        p.ownerId === playerId &&
        p.building?.type === 'cargoPort' &&
        p.building.isActive &&
        !p.building.destroyedRuins &&
        clusters.clusterByPlotId.get(p.id) === plotCluster &&
        (plot.terrain === 'coastal' ||
          plot.hasWater ||
          Math.hypot(p.gridX - plot.gridX, p.gridY - plot.gridY) <= 4 ||
          computeWeightedRoadRouteWithIndex(plot, p, playerId, plotsByCoord, true, state) !== null)
    );
  if (hasPort) return 'sea';

  if (startRoads.length > 0) {
    const visited = new Set<string>();
    const q: Plot[] = [...startRoads];
    for (const r of startRoads) visited.add(r.id);

    while (q.length > 0) {
      const cur = q.shift()!;
      if (cur.terrain === 'urban') return 'road';
      for (const [dx, dy] of DIRS) {
        const nb = plotsByCoord.get(`${cur.gridX + dx}_${cur.gridY + dy}`);
        if (!nb || (nb.irradiatedTicks ?? 0) > 0) continue;
        if (
          nb.terrain === 'urban' ||
          (nb.ownerId === playerId &&
            (nb.building?.type === 'corporateHQ' ||
              nb.building?.type === 'cargoPort' ||
              nb.building?.type === 'cargoAirport' ||
              nb.building?.type === 'warehouse'))
        ) {
          return 'road';
        }
        if (visited.has(nb.id) || !isRoadPassableFor(nb, playerId, state)) continue;
        visited.add(nb.id);
        q.push(nb);
      }
    }
  }

  return 'road';
}

// ─── Network Connectivity Clusters (Zero Teleportation Over Water) ────────────

export interface NetworkClusterMap {
  clusterByPlotId: Map<string, number>;
  clusterPlots: Map<number, Plot[]>;
  clusterCount: number;
}

export interface CargoRouteCheckResult {
  reachable: boolean;
  mode: 'road' | 'sea' | 'air' | 'blocked';
  fromPlotId: string;
  toPlotId: string;
  routePlotIds?: string[];
  reason?: string;
}

let cachedClustersRevisionKey = '';
let cachedClustersMap: NetworkClusterMap | null = null;

export function isClusterNodePlot(p: Plot): boolean {
  if ((p.irradiatedTicks ?? 0) > 0) return false;
  if (p.terrain === 'water') {
    return Boolean(p.hasRoad && p.roadType === 'bridge');
  }
  return Boolean(p.hasRoad || p.building !== null || p.ownerId !== null || p.terrain === 'urban');
}

/**
 * Grupuje połączone lądowo / mostowo klastry sieci (prąd, woda, ścieki i transport kołowy).
 * Woda bez Mostu Drogowego ('bridge') zawsze izoluje wyspy i brzegi rzek.
 */
export function computeNetworkClusters(state: GameState): NetworkClusterMap {
  let structuralSig = 0;
  for (let i = 0; i < state.plots.length; i++) {
    const p = state.plots[i];
    if (p.hasRoad) structuralSig += p.roadType === 'bridge' ? 7 : 3;
    if (p.ownerId) structuralSig += 5;
    if (p.building) structuralSig += 11;
  }
  const key = `${state.networkRevision ?? 0}|${state.plots.length}|${structuralSig}`;
  if (cachedClustersMap && cachedClustersRevisionKey === key) {
    return cachedClustersMap;
  }

  const plotsByCoord = getPlotsByCoordCached(state);
  const clusterByPlotId = new Map<string, number>();
  const clusterPlots = new Map<number, Plot[]>();
  let nextClusterId = 1;

  for (const startPlot of state.plots) {
    if (clusterByPlotId.has(startPlot.id)) continue;
    if (!isClusterNodePlot(startPlot)) continue;

    const cid = nextClusterId++;
    const group: Plot[] = [];
    const queue: Plot[] = [startPlot];
    clusterByPlotId.set(startPlot.id, cid);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      group.push(cur);

      for (const [dx, dy] of DIRS) {
        const nb = plotsByCoord.get(`${cur.gridX + dx}_${cur.gridY + dy}`);
        if (!nb || clusterByPlotId.has(nb.id) || !isClusterNodePlot(nb)) continue;
        clusterByPlotId.set(nb.id, cid);
        queue.push(nb);
      }
    }

    clusterPlots.set(cid, group);
  }

  const res: NetworkClusterMap = {
    clusterByPlotId,
    clusterPlots,
    clusterCount: nextClusterId - 1,
  };
  cachedClustersRevisionKey = key;
  cachedClustersMap = res;
  return res;
}

export function getPlotClusterId(state: GameState, plot: Plot): number {
  return computeNetworkClusters(state).clusterByPlotId.get(plot.id) ?? 0;
}

function canUseClusterFacility(
  facilityOwnerId: string | null,
  ownerId: string,
  partnerId: string | undefined,
  state: GameState
): boolean {
  if (!facilityOwnerId) return false;
  if (facilityOwnerId === ownerId || arePlayersAllied(state, facilityOwnerId, ownerId)) return true;
  if (partnerId && (facilityOwnerId === partnerId || arePlayersAllied(state, facilityOwnerId, partnerId))) {
    return true;
  }
  return false;
}

/**
 * Sprawdza realną fizyczną trasę ładunku pomiędzy dwoma działkami:
 * 1) droga / most w tym samym klastrze, 2) para Portów Towarowych nad wodą, 3) para Lotnisk Cargo.
 */
export function canTransportGoodsBetweenPlots(
  state: GameState,
  srcPlot: Plot,
  dstPlot: Plot,
  ownerId: string,
  partnerId?: string
): CargoRouteCheckResult {
  const clusters = computeNetworkClusters(state);
  const c1 = clusters.clusterByPlotId.get(srcPlot.id) ?? 0;
  const c2 = clusters.clusterByPlotId.get(dstPlot.id) ?? 0;
  const plotsByCoord = getPlotsByCoordCached(state);

  if (c1 !== 0 && c1 === c2) {
    if (
      srcPlot.id === dstPlot.id ||
      Math.abs(srcPlot.gridX - dstPlot.gridX) + Math.abs(srcPlot.gridY - dstPlot.gridY) <= 1
    ) {
      return {
        reachable: true,
        mode: 'road',
        fromPlotId: srcPlot.id,
        toPlotId: dstPlot.id,
        routePlotIds: srcPlot.id === dstPlot.id ? [srcPlot.id] : [srcPlot.id, dstPlot.id],
      };
    }

    const r1 = computeWeightedRoadRouteWithIndex(srcPlot, dstPlot, ownerId, plotsByCoord, true, state);
    if (r1) {
      return {
        reachable: true,
        mode: 'road',
        fromPlotId: srcPlot.id,
        toPlotId: dstPlot.id,
        routePlotIds: r1.path,
      };
    }
    if (partnerId && partnerId !== ownerId) {
      const r2 = computeWeightedRoadRouteWithIndex(srcPlot, dstPlot, partnerId, plotsByCoord, true, state);
      if (r2) {
        return {
          reachable: true,
          mode: 'road',
          fromPlotId: srcPlot.id,
          toPlotId: dstPlot.id,
          routePlotIds: r2.path,
        };
      }
    }
  }

  // Droga morska (para Portów Towarowych)
  if (c1 !== 0 && c2 !== 0) {
    const srcPorts = (clusters.clusterPlots.get(c1) ?? []).filter(
      (p) =>
        p.building?.type === 'cargoPort' &&
        p.building.isActive &&
        !p.building.destroyedRuins &&
        canUseClusterFacility(p.ownerId, ownerId, undefined, state)
    );
    const dstPorts = (clusters.clusterPlots.get(c2) ?? []).filter(
      (p) =>
        p.building?.type === 'cargoPort' &&
        p.building.isActive &&
        !p.building.destroyedRuins &&
        canUseClusterFacility(p.ownerId, partnerId ?? ownerId, partnerId ? ownerId : undefined, state)
    );

    for (const sp of srcPorts) {
      for (const dp of dstPorts) {
        if (sp.id === dp.id) continue;
        const seaPath = computeSeaRoute(sp, dp, plotsByCoord);
        if (seaPath.length >= 2) {
          return {
            reachable: true,
            mode: 'sea',
            fromPlotId: sp.id,
            toPlotId: dp.id,
            routePlotIds: seaPath,
          };
        }
      }
    }

    // Droga lotnicza (para Lotnisk Cargo)
    const srcAir = (clusters.clusterPlots.get(c1) ?? []).find(
      (p) =>
        p.building?.type === 'cargoAirport' &&
        p.building.isActive &&
        !p.building.destroyedRuins &&
        canUseClusterFacility(p.ownerId, ownerId, undefined, state)
    );
    const dstAir = (clusters.clusterPlots.get(c2) ?? []).find(
      (p) =>
        p.building?.type === 'cargoAirport' &&
        p.building.isActive &&
        !p.building.destroyedRuins &&
        canUseClusterFacility(p.ownerId, partnerId ?? ownerId, partnerId ? ownerId : undefined, state)
    );
    if (srcAir && dstAir && srcAir.id !== dstAir.id) {
      return {
        reachable: true,
        mode: 'air',
        fromPlotId: srcAir.id,
        toPlotId: dstAir.id,
        routePlotIds: [srcAir.id, dstAir.id],
      };
    }
  }

  const en = getCurrentLanguage() === 'en';
  return {
    reachable: false,
    mode: 'blocked',
    fromPlotId: srcPlot.id,
    toPlotId: dstPlot.id,
    reason:
      c1 !== c2
        ? en
          ? 'Water blocks the connection — build a Road Bridge, Cargo Ports, or Cargo Airports.'
          : 'Woda odcina połączenie — wybuduj Most Drogowy, parę Portów Towarowych lub Lotnisk Cargo.'
        : en
          ? 'No passable road route (roadblock or isolated plot).'
          : 'Brak przejezdnej drogi (blokada przejazdu lub odizolowana działka).',
  };
}

/**
 * Wyznacza fizyczną trasę dla kontraktu B2B pomiędzy sprzedającym a kupującym.
 */
export function getCargoTransportModeBetweenPlayers(
  state: GameState,
  sellerId: string,
  buyerId: string,
  resource?: ResourceType
): CargoRouteCheckResult {
  const sellerActive = state.plots.filter(
    (p) =>
      p.ownerId === sellerId &&
      p.building &&
      p.building.isActive &&
      !p.building.destroyedRuins &&
      !p.building.status?.noRoadLink
  );
  const buyerActive = state.plots.filter(
    (p) =>
      p.ownerId === buyerId &&
      p.building &&
      p.building.isActive &&
      !p.building.destroyedRuins &&
      !p.building.status?.noRoadLink
  );

  const sellerPlayer = state.players.find((p) => p.id === sellerId);
  const sellerPlotsWithSupply =
    resource != null
      ? state.plots.filter((p) => {
          const hasLocStock = (sellerPlayer?.stockLocations?.[p.id]?.[resource] ?? 0) > 0.01;
          const isSellerMineOrFactory =
            p.ownerId === sellerId &&
            p.building &&
            p.building.isActive &&
            !p.building.destroyedRuins &&
            !p.building.status?.noRoadLink &&
            ((p.building.productionPerTick?.[resource] ?? 0) > 0 ||
              (p.building.storage?.[resource] ?? 0) > 0.01 ||
              (resource === 'electricity' && p.building.category === 'energy') ||
              (resource === 'water' && p.building.type === 'waterPlant'));
          return hasLocStock || Boolean(isSellerMineOrFactory);
        })
      : [];

  const sellerPool = sellerPlotsWithSupply.length > 0 ? sellerPlotsWithSupply : sellerActive;
  const buyerPool =
    resource != null
      ? buyerActive
          .slice()
          .sort(
            (a, b) =>
              ((b.building?.consumptionPerTick?.[resource] ?? 0) > 0 || b.building?.fuelResource === resource ? 1 : 0) -
              ((a.building?.consumptionPerTick?.[resource] ?? 0) > 0 || a.building?.fuelResource === resource ? 1 : 0)
          )
      : buyerActive;

  const fallbackSeller = sellerPool.length > 0 ? sellerPool : state.plots.filter((p) => p.ownerId === sellerId);
  const fallbackBuyer = buyerPool.length > 0 ? buyerPool : state.plots.filter((p) => p.ownerId === buyerId);

  if (fallbackSeller.length === 0 || fallbackBuyer.length === 0) {
    return {
      reachable: false,
      mode: 'blocked',
      fromPlotId: fallbackSeller[0]?.id ?? '',
      toPlotId: fallbackBuyer[0]?.id ?? '',
      reason:
        getCurrentLanguage() === 'en'
          ? 'No active plots on one of the sides.'
          : 'Brak aktywnych działek po jednej ze stron.',
    };
  }

  let bestSeaAir: CargoRouteCheckResult | null = null;
  for (const sPlot of fallbackSeller.slice(0, 6)) {
    for (const bPlot of fallbackBuyer.slice(0, 6)) {
      const check = canTransportGoodsBetweenPlots(state, sPlot, bPlot, sellerId, buyerId);
      if (check.reachable && check.mode === 'road') return check;
      if (check.reachable && !bestSeaAir) bestSeaAir = check;
    }
  }

  if (bestSeaAir) return bestSeaAir;
  return {
    reachable: false,
    mode: 'blocked',
    fromPlotId: fallbackSeller[0].id,
    toPlotId: fallbackBuyer[0].id,
    reason:
      getCurrentLanguage() === 'en'
        ? 'No land bridge, sea port, or cargo air link between shores.'
        : 'Brak połączenia lądowego (mostu), morskiego lub lotniczego między brzegami.',
  };
}

/**
 * Sprawdza, czy budynek ma fizyczne wyjście na Rynek Centralny / strefę miejską
 * (własnym klastrem z miastem lub przez aktywny Port Towarowy / Lotnisko Cargo).
 */
export function hasExternalMarketAccess(state: GameState, plot: Plot, playerId: string): boolean {
  if (!hasRoadAccess(state, plot, playerId)) return false;
  const clusters = computeNetworkClusters(state);
  const cid = clusters.clusterByPlotId.get(plot.id) ?? 0;
  if (cid === 0) return false;
  const group = clusters.clusterPlots.get(cid) ?? [];
  for (const p of group) {
    if (p.terrain === 'urban') return true;
    if (
      p.building &&
      p.building.isActive &&
      !p.building.destroyedRuins &&
      (p.building.type === 'cargoPort' || p.building.type === 'cargoAirport') &&
      canUseClusterFacility(p.ownerId, playerId, undefined, state)
    ) {
      return true;
    }
  }
  return false;
}

export function addPlotWarehouseStock(
  player: Player,
  plotId: string,
  resource: ResourceType,
  qty: number
): void {
  if (qty <= 0) return;
  player.warehouseStockpile[resource] = Number(((player.warehouseStockpile[resource] ?? 0) + qty).toFixed(2));
  if (!player.stockLocations) player.stockLocations = {};
  if (!player.stockLocations[plotId]) player.stockLocations[plotId] = {};
  player.stockLocations[plotId][resource] = Number(
    ((player.stockLocations[plotId][resource] ?? 0) + qty).toFixed(2)
  );
}

export function consumePlotWarehouseStock(
  player: Player,
  plotId: string,
  resource: ResourceType,
  qty: number
): number {
  if (qty <= 0) return 0;
  const totalStock = player.warehouseStockpile[resource] ?? 0;
  const locAvail = player.stockLocations?.[plotId]?.[resource] ?? 0;
  const take = Math.min(qty, totalStock, locAvail);
  if (take <= 0) return 0;
  player.warehouseStockpile[resource] = Math.max(0, Number((totalStock - take).toFixed(2)));
  if (player.stockLocations?.[plotId]) {
    const remLoc = Math.max(0, Number((locAvail - take).toFixed(2)));
    if (remLoc <= 0.001) {
      delete player.stockLocations[plotId][resource];
    } else {
      player.stockLocations[plotId][resource] = remLoc;
    }
  }
  return take;
}

export function consumeReachableWarehouseStock(
  state: GameState,
  player: Player,
  dstPlot: Plot,
  resource: ResourceType,
  needed: number,
  partnerId?: string
): {
  consumed: number;
  deliveries: { fromPlotId: string; mode: 'road' | 'sea' | 'air'; qty: number }[];
} {
  if (needed <= 0) return { consumed: 0, deliveries: [] };
  const locs: Record<string, Partial<Record<ResourceType, number>>> = player.stockLocations ?? {};
  const plotsById = new Map<string, Plot>();
  for (const p of state.plots) plotsById.set(p.id, p);

  let remaining = needed;
  let totalConsumed = 0;
  const deliveries: { fromPlotId: string; mode: 'road' | 'sea' | 'air'; qty: number }[] = [];

  for (const [locPlotId, stockMap] of Object.entries(locs)) {
    if (remaining <= 0.001) break;
    const avail = stockMap[resource] ?? 0;
    if (avail <= 0.001) continue;
    const srcPlot = plotsById.get(locPlotId);
    if (!srcPlot) continue;
    const route = canTransportGoodsBetweenPlots(state, srcPlot, dstPlot, player.id, partnerId);
    if (!route.reachable || route.mode === 'blocked') continue;

    const take = consumePlotWarehouseStock(player, locPlotId, resource, remaining);
    if (take > 0) {
      remaining -= take;
      totalConsumed += take;
      deliveries.push({
        fromPlotId: route.fromPlotId || locPlotId,
        mode: route.mode,
        qty: take,
      });
    }
  }

  return { consumed: totalConsumed, deliveries };
}

function appendLogisticsDispatchVehicles(
  state: GameState,
  plotsByCoord: Map<string, Plot>,
  vehicles: Vehicle[],
  routeLines: TransportRouteLine[]
): void {
  const plotsById = new Map<string, Plot>();
  for (const p of state.plots) plotsById.set(p.id, p);

  const seenRoutes = new Set<string>();

  for (const fd of (state.fuelDeliveries ?? []).slice(0, 14)) {
    const src = plotsById.get(fd.fromPlotId);
    const dst = plotsById.get(fd.toPlotId);
    if (!src || !dst) continue;
    const key = `fuel|${fd.fromPlotId}|${fd.toPlotId}|${fd.resource}`;
    if (seenRoutes.has(key)) continue;
    seenRoutes.add(key);

    if (fd.mode === 'road') {
      const roadRoute = computeWeightedRoadRouteWithIndex(src, dst, fd.ownerId, plotsByCoord, true, state);
      if (roadRoute && roadRoute.path.length >= 2) {
        vehicles.push({
          id: `fuel_trk_${fd.fromPlotId}_${fd.toPlotId}`,
          sourcePlotId: src.id,
          destinationPlotId: dst.id,
          routePlotIds: roadRoute.path,
          routeSegment: (state.time.tick + vehicles.length) % Math.max(1, roadRoute.path.length - 1),
          progress: 0.25,
          speed: roadRoute.usesHighway ? 1.85 : 1.4,
          type: 'truck',
          cargo: fd.resource,
          ownerId: fd.ownerId,
        });
      }
    } else if (fd.mode === 'sea') {
      const seaPath = computeSeaRoute(src, dst, plotsByCoord);
      if (seaPath.length >= 2) {
        vehicles.push({
          id: `fuel_ship_${fd.fromPlotId}_${fd.toPlotId}`,
          sourcePlotId: src.id,
          destinationPlotId: dst.id,
          routePlotIds: seaPath,
          routeSegment: 0,
          progress: 0.2,
          speed: 1.05,
          type: 'ship',
          cargo: fd.resource,
          ownerId: fd.ownerId,
        });
      }
    } else if (fd.mode === 'air') {
      vehicles.push({
        id: `fuel_air_${fd.fromPlotId}_${fd.toPlotId}`,
        sourcePlotId: src.id,
        destinationPlotId: dst.id,
        routePlotIds: [src.id, dst.id],
        routeSegment: 0,
        progress: 0.35,
        speed: 3.1,
        type: 'plane',
        cargo: fd.resource,
        ownerId: fd.ownerId,
      });
    }

    if (fd.ownerId === state.currentPlayerId) {
      routeLines.push({
        fromPlotId: src.id,
        toPlotId: dst.id,
        mode: fd.mode,
        ownerId: fd.ownerId,
      });
    }
  }

  for (const br of (state.b2bRoutes ?? []).slice(0, 10)) {
    const src = plotsById.get(br.fromPlotId);
    const dst = plotsById.get(br.toPlotId);
    if (!src || !dst) continue;
    const key = `b2b|${br.contractId}`;
    if (seenRoutes.has(key)) continue;
    seenRoutes.add(key);

    if (br.mode === 'road') {
      const roadRoute = computeWeightedRoadRouteWithIndex(src, dst, br.ownerId, plotsByCoord, true, state);
      if (roadRoute && roadRoute.path.length >= 2) {
        vehicles.push({
          id: `b2b_trk_${br.contractId}`,
          sourcePlotId: src.id,
          destinationPlotId: dst.id,
          routePlotIds: roadRoute.path,
          routeSegment: 0,
          progress: 0.4,
          speed: roadRoute.usesHighway ? 1.8 : 1.35,
          type: 'truck',
          cargo: br.resource,
          ownerId: br.ownerId,
        });
      }
    } else if (br.mode === 'sea') {
      const seaPath = computeSeaRoute(src, dst, plotsByCoord);
      if (seaPath.length >= 2) {
        vehicles.push({
          id: `b2b_ship_${br.contractId}`,
          sourcePlotId: src.id,
          destinationPlotId: dst.id,
          routePlotIds: seaPath,
          routeSegment: 0,
          progress: 0.25,
          speed: 1.0,
          type: 'ship',
          cargo: br.resource,
          ownerId: br.ownerId,
        });
      }
    } else if (br.mode === 'air') {
      vehicles.push({
        id: `b2b_air_${br.contractId}`,
        sourcePlotId: src.id,
        destinationPlotId: dst.id,
        routePlotIds: [src.id, dst.id],
        routeSegment: 0,
        progress: 0.45,
        speed: 3.1,
        type: 'plane',
        cargo: br.resource,
        ownerId: br.ownerId,
      });
    }

    routeLines.push({
      fromPlotId: src.id,
      toPlotId: dst.id,
      mode: br.mode,
      ownerId: br.ownerId,
    });
  }
}

/**
 * Rozlicza myto drogowe w czasie rzeczywistym, gdy transport graczy i botów AI
 * przejeżdża przez drogi i płatne autostrady innych właścicieli.
 */
export function processTollsAndLogisticsTick(state: GameState): void {
  if (state.plots.length === 0) return;

  const plotsByCoord = getPlotsByCoordCached(state);
  const playerById = new Map<string, Player>();
  for (const pl of state.players) playerById.set(pl.id, pl);

  let urbanAnchor: Plot | undefined;
  const hqOrWarehouseAnchor = new Map<string, Plot>();
  const supplyByOwner = new Map<string, Plot[]>();

  for (const p of state.plots) {
    if (!urbanAnchor && p.terrain === 'urban') urbanAnchor = p;
    if (!p.ownerId || !p.building || !p.building.isActive || p.building.destroyedRuins) continue;
    const b = p.building;
    if (b.type === 'corporateHQ' || b.type === 'warehouse') {
      const prev = hqOrWarehouseAnchor.get(p.ownerId);
      if (!prev || b.type === 'corporateHQ') hqOrWarehouseAnchor.set(p.ownerId, p);
    }
    if (
      b.logisticsMode === 'road' &&
      (Object.keys(b.productionPerTick).length > 0 || Object.keys(b.consumptionPerTick).length > 0)
    ) {
      let arr = supplyByOwner.get(p.ownerId);
      if (!arr) {
        arr = [];
        supplyByOwner.set(p.ownerId, arr);
      }
      arr.push(p);
    }
  }
  if (!urbanAnchor) return;

  for (const player of state.players) {
    if (player.isEliminated) continue;
    const targetAnchor = hqOrWarehouseAnchor.get(player.id) ?? urbanAnchor;
    const supplyBuildings = supplyByOwner.get(player.id);
    if (!supplyBuildings || supplyBuildings.length === 0) continue;

    const roadPassesThisTick = new Map<string, number>();
    for (const srcPlot of supplyBuildings.slice(0, 8)) {
      const route = computeWeightedRoadRouteWithIndex(
        srcPlot,
        targetAnchor,
        player.id,
        plotsByCoord,
        false,
        state
      );
      if (!route || route.rivalTollPlots.length === 0) continue;

      for (const rp of route.rivalTollPlots) {
        const passes = roadPassesThisTick.get(rp.id) ?? 0;
        if (passes >= 3) continue;
        roadPassesThisTick.set(rp.id, passes + 1);

        const owner = rp.ownerId ? playerById.get(rp.ownerId) : undefined;
        if (!owner || owner.id === player.id || owner.isEliminated) continue;
        if (arePlayersAllied(state, player.id, owner.id)) continue;
        const tollCfg = TOLL_RATE_CONFIG[rp.tollRate ?? 'free'];
        const tollArchMult = getArchetypeDefinition(owner.archetype).modifiers.tollRevenueMult;
        const fee = Math.round((tollCfg?.feePerPass ?? 0) * tollArchMult);
        if (fee <= 0) continue;

        const actualFee = Math.min(Math.max(0, player.cash), fee);
        if (actualFee > 0) {
          player.cash -= actualFee;
          owner.cash += actualFee;
          owner.totalRevenueEarned += actualFee;
          rp.tollRevenueTotal = (rp.tollRevenueTotal ?? 0) + actualFee;
          if (owner.statsAccum) {
            owner.statsAccum.tollEarned = (owner.statsAccum.tollEarned ?? 0) + actualFee;
          }

          owner.lastTickRevenueByCategory['Opłaty Drogowe (Myto)'] =
            (owner.lastTickRevenueByCategory['Opłaty Drogowe (Myto)'] ?? 0) + actualFee;
          player.lastTickCostsByCategory['Logistyka i Media'] =
            (player.lastTickCostsByCategory['Logistyka i Media'] ?? 0) + actualFee;
        }
      }
    }
  }
}

/**
 * Oblicza czas reakcji służb (w cyklach) dla każdej działki na potrzeby heatmapy
 * "Czas Reakcji Służb" (z użyciem Dijkstry po drogach i autostradach + śmigłowców).
 */
export function computeEmergencyResponseEtaGrid(
  state: GameState,
  playerId: string
): void {
  const plotsByCoord = getPlotsByCoordCached(state);
  const etaCached = cachedEtaByPlayer.get(playerId);
  if (etaCached) {
    for (const p of state.plots) p.responseEta = etaCached[p.id] ?? 99;
    return;
  }

  const stations = state.plots.filter(
    (p) =>
      p.ownerId === playerId &&
      p.building &&
      p.building.isActive &&
      (p.building.type === 'fireStation' ||
        p.building.type === 'hospital' ||
        p.building.type === 'hazmatBase' ||
        p.building.type === 'policeStation')
  );

  if (stations.length === 0) {
    for (const p of state.plots) p.responseEta = 99;
    return;
  }

  const heliStations = stations.filter((s) =>
    s.building?.techTree.some((n) => n.status === 'done' && n.effects.helicopterDispatch)
  );

  // Dijkstra z wielu stacji jednocześnie dla sieci dróg
  const roadEta = new Map<string, number>();
  const q: { plot: Plot; eta: number }[] = [];

  for (const st of stations) {
    const startRoads = isRoadPassableFor(st, playerId, state)
      ? [st]
      : getAdjacentPassableRoads(st, plotsByCoord, playerId, state);
    for (const sr of startRoads) {
      const baseCost = sr.roadType === 'highway' ? 0.35 : 0.75;
      if (baseCost < (roadEta.get(sr.id) ?? Infinity)) {
        roadEta.set(sr.id, baseCost);
        q.push({ plot: sr, eta: baseCost });
      }
    }
  }

  while (q.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < q.length; i++) {
      if (q[i].eta < q[minIdx].eta) minIdx = i;
    }
    const { plot: cur, eta: curEta } = q.splice(minIdx, 1)[0];
    if (curEta > (roadEta.get(cur.id) ?? Infinity)) continue;

    for (const [dx, dy] of DIRS) {
      const nb = plotsByCoord.get(`${cur.gridX + dx}_${cur.gridY + dy}`);
      if (!nb || !isRoadPassableFor(nb, playerId, state)) continue;
      const step = nb.roadType === 'highway' ? 0.35 : 0.75;
      const nextEta = curEta + step;
      if (nextEta < (roadEta.get(nb.id) ?? Infinity)) {
        roadEta.set(nb.id, nextEta);
        q.push({ plot: nb, eta: nextEta });
      }
    }
  }

  const savedEta: Record<string, number> = {};
  for (const p of state.plots) {
    if (p.terrain === 'water') {
      p.responseEta = 99;
      savedEta[p.id] = 99;
      continue;
    }

    let bestEta = 99;
    // Bezpośrednia obecność stacji na działce lub obok niej
    for (const st of stations) {
      if (Math.abs(st.gridX - p.gridX) + Math.abs(st.gridY - p.gridY) <= 1) {
        bestEta = 1;
        break;
      }
    }

    if (bestEta > 1) {
      const ownRoadEta = roadEta.get(p.id);
      if (ownRoadEta !== undefined) {
        bestEta = Math.min(bestEta, Math.max(1, Math.round(ownRoadEta)));
      }
      for (const [dx, dy] of DIRS) {
        const nb = plotsByCoord.get(`${p.gridX + dx}_${p.gridY + dy}`);
        if (nb) {
          const nbEta = roadEta.get(nb.id);
          if (nbEta !== undefined) {
            bestEta = Math.min(bestEta, Math.max(1, Math.round(nbEta + 0.5)));
          }
        }
      }
    }

    // Jeśli którakolwiek stacja ma śmigłowce/drony — dolot nad brakami dróg!
    for (const hs of heliStations) {
      const d = Math.hypot(hs.gridX - p.gridX, hs.gridY - p.gridY);
      bestEta = Math.min(bestEta, Math.max(1, Math.round(d * 0.45)));
    }

    p.responseEta = bestEta;
    savedEta[p.id] = bestEta;
  }
  cachedEtaByPlayer.set(playerId, savedEta);
}

function computeSeaRoute(
  srcPort: Plot,
  dstWaterOrPort: Plot,
  plotsByCoord: Map<string, Plot>
): string[] {
  const findWaterAdj = (p: Plot) => {
    for (const [dx, dy] of DIRS) {
      const nb = plotsByCoord.get(`${p.gridX + dx}_${p.gridY + dy}`);
      if (isWaterPlot(nb)) return nb!;
    }
    return null;
  };

  const wStart = findWaterAdj(srcPort);
  const wEnd = isWaterPlot(dstWaterOrPort) ? dstWaterOrPort : findWaterAdj(dstWaterOrPort);
  if (!wStart || !wEnd) return [srcPort.id, dstWaterOrPort.id];

  const q: Plot[] = [wStart];
  const parent = new Map<string, string | null>();
  parent.set(wStart.id, null);
  let found = wStart.id === wEnd.id;

  while (q.length > 0 && !found) {
    const cur = q.shift()!;
    for (const [dx, dy] of DIRS) {
      const nb = plotsByCoord.get(`${cur.gridX + dx}_${cur.gridY + dy}`);
      if (!nb || !isWaterPlot(nb) || parent.has(nb.id)) continue;
      parent.set(nb.id, cur.id);
      if (nb.id === wEnd.id) {
        found = true;
        break;
      }
      q.push(nb);
    }
  }

  if (!found) return [srcPort.id, dstWaterOrPort.id];

  const chain: string[] = [];
  let cur: string | null = wEnd.id;
  while (cur !== null) {
    chain.unshift(cur);
    cur = parent.get(cur) ?? null;
  }
  return [srcPort.id, ...chain, dstWaterOrPort.id];
}

export function syncVehiclesForWorld(state: GameState): void {
  const activePlots = state.plots.filter((p) => p.building && p.building.isActive);
  const roadPlots = state.plots.filter((p) => p.hasRoad);
  const waterPlots = state.plots.filter((p) => isWaterPlot(p));

  const plotsByCoord = getPlotsByCoordCached(state);

  const vehicles: Vehicle[] = [];
  const routeLines: TransportRouteLine[] = [];

  // 1. Aktywne wyjazdy alarmowe służb (Straż, HAZMAT, Karetki, Policja, Śmigłowce)
  for (const disp of state.dispatches ?? []) {
    if (disp.status === 'queued') continue;
    const stPlot = state.plots.find((p) => p.id === disp.stationPlotId);
    const targetPlot = state.plots.find((p) => p.id === disp.targetPlotId);
    if (!stPlot || !targetPlot) continue;

    const ownerId = stPlot.ownerId ?? 'neutral';
    const vehType: Vehicle['type'] = disp.usesHelicopter
      ? 'helicopter'
      : disp.serviceKind === 'fire'
        ? 'fireTruck'
        : disp.serviceKind === 'hazmat'
          ? 'hazmatTruck'
          : disp.serviceKind === 'medical'
            ? 'ambulance'
            : 'policeCar';

    const routeRes = disp.usesHelicopter
      ? null
      : computeWeightedRoadRouteWithIndex(stPlot, targetPlot, ownerId, plotsByCoord, true, state);

    const routePath = routeRes ? routeRes.path : [stPlot.id, targetPlot.id];
    const progressRatio =
      disp.status === 'on_scene'
        ? 0.95
        : Math.max(0.08, Math.min(0.92, 1 - disp.etaTicks / Math.max(1, disp.totalEtaTicks)));

    vehicles.push({
      id: `disp_${disp.id}`,
      sourcePlotId: stPlot.id,
      destinationPlotId: targetPlot.id,
      routePlotIds: routePath,
      routeSegment: Math.min(routePath.length - 2, Math.floor(progressRatio * (routePath.length - 1))),
      progress: progressRatio,
      speed: disp.usesHelicopter ? 1.8 : 2.6,
      type: vehType,
      cargo: null,
      ownerId,
    });
  }

  // 2. Patrole prewencyjne Policji PPP na całej sieci dróg
  const policeStations = activePlots.filter((p) => p.building?.type === 'policeStation');
  for (const ps of policeStations.slice(0, 6)) {
    if (roadPlots.length < 2) break;
    const ownerId = ps.ownerId ?? 'neutral';
    const patrolCount = Math.min(2, ps.building?.fleetSize ?? 1);
    for (let i = 0; i < patrolCount; i++) {
      const dst = roadPlots[(i * 7 + state.time.tick) % roadPlots.length];
      if (!dst || dst.id === ps.id) continue;
      const routeRes = computeWeightedRoadRouteWithIndex(ps, dst, ownerId, plotsByCoord, true, state);
      if (!routeRes) continue;
      vehicles.push({
        id: `patrol_${ps.id}_${i}`,
        sourcePlotId: ps.id,
        destinationPlotId: dst.id,
        routePlotIds: routeRes.path,
        routeSegment: 0,
        progress: (i * 0.33) % 1,
        speed: 1.65,
        type: 'policeCar',
        cargo: null,
        ownerId,
      });
    }
  }

  // 3. Statki towarowe z Portów Towarowych
  const ports = activePlots.filter((p) => p.building?.type === 'cargoPort');
  for (const port of ports) {
    if (waterPlots.length === 0) break;
    const remoteWater = waterPlots[Math.floor(waterPlots.length * 0.7)] ?? waterPlots[0];
    const targetPort = ports.find((p) => p.id !== port.id && p.ownerId === port.ownerId) ?? remoteWater;
    const seaRoute = computeSeaRoute(port, targetPort, plotsByCoord);
    vehicles.push({
      id: `ship_${port.id}`,
      sourcePlotId: port.id,
      destinationPlotId: targetPort.id,
      routePlotIds: seaRoute,
      routeSegment: 0,
      progress: Math.random() * 0.5,
      speed: 1.15,
      type: 'ship',
      cargo: 'ironOre',
      ownerId: port.ownerId ?? 'neutral',
    });
    routeLines.push({
      fromPlotId: port.id,
      toPlotId: targetPort.id,
      mode: 'sea',
      ownerId: port.ownerId ?? 'neutral',
    });
  }

  // 4. Samoloty Cargo i Pasażerskie VIP z Lotnisk
  const airports = activePlots.filter(
    (p) => p.building?.type === 'cargoAirport' || p.building?.type === 'passengerTerminal'
  );
  for (const ap of airports) {
    const targets = activePlots.filter((p) => p.id !== ap.id && p.ownerId === ap.ownerId);
    const dst = targets[0] ?? activePlots.find((p) => p.id !== ap.id);
    if (!dst) continue;
    const isPassengerVip = ap.building?.type === 'passengerTerminal';
    vehicles.push({
      id: `plane_${ap.id}`,
      sourcePlotId: ap.id,
      destinationPlotId: dst.id,
      routePlotIds: [ap.id, dst.id],
      routeSegment: 0,
      progress: Math.random() * 0.6,
      speed: isPassengerVip ? 0.5 : 0.42,
      type: 'plane',
      cargo: isPassengerVip ? null : 'semiconductors',
      ownerId: ap.ownerId ?? 'neutral',
    });
    routeLines.push({
      fromPlotId: ap.id,
      toPlotId: dst.id,
      mode: 'air',
      ownerId: ap.ownerId ?? 'neutral',
    });
  }

  // 4b. Zajezdnie Autobusowe, Stacje Metra i Dworce Kolejowe — gwarantowane animowane kursy pasażerskie
  const busDepots = activePlots.filter((p) => p.building?.type === 'busDepot');
  for (const bd of busDepots.slice(0, 6)) {
    if (roadPlots.length < 2) break;
    const ownerId = bd.ownerId ?? 'neutral';
    const commercialTargets = activePlots.filter(
      (p) =>
        p.id !== bd.id &&
        (p.building?.category === 'real_estate' ||
          p.building?.category === 'attractions' ||
          p.building?.type === 'officeTower')
    );
    const dstPool = commercialTargets.length > 0 ? commercialTargets : roadPlots;
    const dst = dstPool[state.time.tick % dstPool.length];
    if (!dst || dst.id === bd.id) continue;
    const routeRes = computeWeightedRoadRouteWithIndex(bd, dst, ownerId, plotsByCoord, true, state);
    if (routeRes) {
      vehicles.push({
        id: `pax_bus_${bd.id}`,
        sourcePlotId: bd.id,
        destinationPlotId: dst.id,
        routePlotIds: routeRes.path,
        routeSegment: 0,
        progress: Math.random() * 0.5,
        speed: 1.9,
        type: 'bus',
        cargo: null,
        ownerId,
      });
    }
  }

  const railStations = activePlots.filter(
    (p) => p.building?.type === 'metroStation' || p.building?.type === 'trainStation'
  );
  for (const rs of railStations.slice(0, 6)) {
    const targets = activePlots.filter(
      (p) =>
        p.id !== rs.id &&
        (p.building?.type === 'metroStation' ||
          p.building?.type === 'trainStation' ||
          p.building?.category === 'real_estate' ||
          p.building?.category === 'attractions')
    );
    const dst = targets[0] ?? activePlots.find((p) => p.id !== rs.id);
    if (!dst) continue;
    const isMetro = rs.building?.type === 'metroStation';
    vehicles.push({
      id: `rail_${rs.id}`,
      sourcePlotId: rs.id,
      destinationPlotId: dst.id,
      routePlotIds: [rs.id, dst.id],
      routeSegment: 0,
      progress: Math.random() * 0.5,
      speed: isMetro ? 1.4 : 1.0,
      type: isMetro ? 'metro' : 'train',
      cargo: null,
      ownerId: rs.ownerId ?? 'neutral',
    });
  }

  // 5. Ciężarówki i autobusy po ważonych trasach Dijkstry (z pominięciem zablokowanych dróg!)
  const roadConnectedBuildings = activePlots.filter((p) => p.building?.hasRoadConnection);
  const maxRoadVehicles = Math.min(14, Math.max(2, roadConnectedBuildings.length * 2));
  let attempts = 0;

  while (
    vehicles.length < maxRoadVehicles + ports.length + airports.length + Math.min(6, policeStations.length) &&
    attempts < 36 &&
    roadConnectedBuildings.length > 0 &&
    roadPlots.length >= 2
  ) {
    attempts++;
    const src = roadConnectedBuildings[Math.floor(Math.random() * roadConnectedBuildings.length)];
    const ownerId = src.ownerId ?? 'neutral';
    const sameOwner = roadConnectedBuildings.filter((p) => p.id !== src.id && p.ownerId === src.ownerId);
    const dstPool = sameOwner.length > 0 ? sameOwner : roadPlots;
    const dst = dstPool[Math.floor(Math.random() * dstPool.length)];
    if (!dst || dst.id === src.id) continue;

    const routeRes = computeWeightedRoadRouteWithIndex(src, dst, ownerId, plotsByCoord, false, state);
    if (!routeRes) continue;

    const producedKeys = Object.keys(src.building?.productionPerTick ?? {}) as ResourceType[];
    const isBus = producedKeys.length === 0 || Math.random() < 0.3;

    vehicles.push({
      id: `veh_${attempts}_${src.id}`,
      sourcePlotId: src.id,
      destinationPlotId: dst.id,
      routePlotIds: routeRes.path,
      routeSegment: Math.floor(Math.random() * Math.max(1, routeRes.path.length - 1)),
      progress: Math.random() * 0.5,
      speed: (isBus ? 1.75 : 1.3) * (routeRes.usesHighway ? 1.45 : 1.0),
      type: isBus ? 'bus' : 'truck',
      cargo: isBus ? null : producedKeys[0] ?? 'steel',
      ownerId,
    });

    if (src.ownerId === state.currentPlayerId && sameOwner.length > 0) {
      routeLines.push({
        fromPlotId: src.id,
        toPlotId: dst.id,
        mode: 'road',
        ownerId: src.ownerId,
      });
    }
  }

  appendLogisticsDispatchVehicles(state, plotsByCoord, vehicles, routeLines);

  state.vehicles = vehicles;
  state.transportLines = routeLines.slice(0, 18);
}

export function stepVehiclePositions(
  vehicles: Vehicle[],
  deltaSeconds: number,
  speedMultiplier: number
): void {
  if (speedMultiplier <= 0) return;
  const effMult = Math.min(3.5, Math.max(0.7, Math.sqrt(speedMultiplier)));

  for (const v of vehicles) {
    const route = v.routePlotIds;
    if (!route || route.length < 2) continue;
    v.progress += v.speed * deltaSeconds * effMult;
    while (v.progress >= 1) {
      v.progress -= 1;
      v.routeSegment += 1;
      if (v.routeSegment >= route.length - 1) {
        v.routePlotIds = [...route].reverse();
        v.routeSegment = 0;
        const tmp = v.sourcePlotId;
        v.sourcePlotId = v.destinationPlotId;
        v.destinationPlotId = tmp;
      }
    }
  }
}
