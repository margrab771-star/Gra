import { BUILDING_DEFINITIONS } from '../data/buildings';
import { RESOURCE_LIST } from '../data/resources';
import { getCurrentLanguage } from '../i18n';
import { BUILDINGS_EN } from '../i18n/buildingsEn';
import {
  getAggregatedBuildingModifiers,
  getPowerPlantFuelSpec,
  type UtilityTickSnapshot,
} from './BuildingSystem';
import {
  computeNetworkClusters,
  getCargoTransportModeBetweenPlayers,
  hasRoadAccess,
  isRoadExemptBuilding,
  type NetworkClusterMap,
} from './TransportSystem';
import type {
  ClusterUtilitySummary,
  GameState,
  Player,
  Plot,
  ResourceType,
  UtilityBalanceReport,
} from './types';

interface ClusterAccum {
  clusterId: number;
  electricityProduced: number;
  electricityConsumed: number;
  waterProduced: number;
  waterConsumed: number;
  sewageProduced: number;
  sewageTreated: number;
  wasteProduced: number;
  wasteProcessed: number;
  buildingCount: number;
}

function getOrCreateClusterAccum(map: Map<number, ClusterAccum>, clusterId: number): ClusterAccum {
  let entry = map.get(clusterId);
  if (!entry) {
    entry = {
      clusterId,
      electricityProduced: 0,
      electricityConsumed: 0,
      waterProduced: 0,
      waterConsumed: 0,
      sewageProduced: 0,
      sewageTreated: 0,
      wasteProduced: 0,
      wasteProcessed: 0,
      buildingCount: 0,
    };
    map.set(clusterId, entry);
  }
  return entry;
}

export function getUtilitySnapshotForPlot(
  report: UtilityBalanceReport,
  clusters: NetworkClusterMap,
  plot: Plot
): UtilityTickSnapshot {
  const cid = clusters.clusterByPlotId.get(plot.id) ?? 0;
  const cluster = report.clusters?.find((c) => c.clusterId === cid);
  if (!cluster) {
    return { elecRatio: 0, waterRatio: 0, sewageNet: 0, wasteNet: 0 };
  }
  return {
    elecRatio: cluster.electricityCoverageRatio,
    waterRatio: cluster.waterCoverageRatio,
    sewageNet: cluster.sewageNet,
    wasteNet: cluster.wasteNet,
  };
}

export function computePlayerUtilityAndResourceBalance(
  state: GameState,
  player: Player
): UtilityBalanceReport {
  let electricityProduced = 0;
  let electricityConsumed = 0;
  const electricityByPlant: { label: string; produced: number }[] = [];
  const electricityConsumers: { label: string; consumed: number }[] = [];

  let waterProduced = 0;
  let waterConsumed = 0;
  const waterSources: { label: string; produced: number }[] = [];
  const waterConsumers: { label: string; consumed: number }[] = [];

  let sewageProduced = 0;
  let sewageTreated = 0;
  let wasteProduced = 0;
  let wasteProcessed = 0;

  const resProduced: Partial<Record<ResourceType, number>> = {};
  const resConsumed: Partial<Record<ResourceType, number>> = {};
  const resImport: Partial<Record<ResourceType, number>> = {};
  const resExport: Partial<Record<ResourceType, number>> = {};

  const clusters = computeNetworkClusters(state);
  const clusterAcc = new Map<number, ClusterAccum>();
  const playerOwnedPlots: Plot[] = [];

  for (const plot of state.plots) {
    if (plot.ownerId !== player.id) continue;
    playerOwnedPlots.push(plot);
    if (!plot.building || !plot.building.isActive || plot.building.destroyedRuins) continue;
    const b = plot.building;
    const def = BUILDING_DEFINITIONS[b.type];
    const mods = getAggregatedBuildingModifiers(b);
    const roadAccessOk = isRoadExemptBuilding(b.type) || hasRoadAccess(state, plot, player.id);
    const cid = clusters.clusterByPlotId.get(plot.id) ?? 0;
    const ca = getOrCreateClusterAccum(clusterAcc, cid);
    ca.buildingCount++;

    // Energia elektryczna (MWh/MW) — elektrownie paliwowe wymagają fizycznego zapasu paliwa > 0
    const fuelSpec = getPowerPlantFuelSpec(b.type);
    const hasFuelForPower = !fuelSpec || ((b.fuelStored ?? b.fuelMax ?? 0) > 0.05 && !b.status?.noFuel);
    const elecOutput =
      roadAccessOk && hasFuelForPower
        ? (b.productionPerTick.electricity ??
            (def.electricityUsage < 0 ? Math.abs(def.electricityUsage) * (b.efficiency / 100) : 0))
        : 0;
    const bLabelName = getCurrentLanguage() === 'en' ? BUILDINGS_EN[b.type]?.name ?? b.name : b.name;
    if (def.electricityUsage < 0 || b.type === 'copperCablePlant') {
      const prodMW =
        roadAccessOk && hasFuelForPower
          ? Math.round(Math.max(elecOutput, Math.abs(def.electricityUsage) * 0.4 * Math.max(0.15, b.efficiency / 100)))
          : 0;
      electricityProduced += prodMW;
      ca.electricityProduced += prodMW;
      if (prodMW > 0) {
        electricityByPlant.push({
          label: `${b.icon} ${bLabelName} (${plot.gridX},${plot.gridY})`,
          produced: prodMW,
        });
      }
    } else if (def.electricityUsage > 0) {
      const consMW = Math.round(def.electricityUsage * Math.max(0.2, 1 + mods.electricityDelta));
      electricityConsumed += consMW;
      ca.electricityConsumed += consMW;
      electricityConsumers.push({
        label: `${b.icon} ${bLabelName} (${plot.gridX},${plot.gridY})`,
        consumed: consMW,
      });
    }

    // Woda przemysłowa (m3)
    if (b.type === 'waterPlant' || def.waterUsage < 0) {
      const prodW = roadAccessOk
        ? Math.round(Math.max(b.productionPerTick.water ?? 0, Math.abs(def.waterUsage) * (b.efficiency / 100)))
        : 0;
      waterProduced += prodW;
      ca.waterProduced += prodW;
      if (prodW > 0) {
        waterSources.push({
          label: `${b.icon} ${bLabelName} (${plot.gridX},${plot.gridY})`,
          produced: prodW,
        });
      }
    } else if (def.waterUsage > 0) {
      const consW = Math.round(def.waterUsage * Math.max(0.2, 1 + mods.waterDelta));
      waterConsumed += consW;
      ca.waterConsumed += consW;
      waterConsumers.push({
        label: `${b.icon} ${bLabelName} (${plot.gridX},${plot.gridY})`,
        consumed: consW,
      });
    }

    // Ścieki przemysłowe (m3)
    const rawSewage = def.sewageUsage ?? 0;
    if (rawSewage < 0) {
      if (roadAccessOk) {
        const treated = Math.round(Math.abs(rawSewage) * (1 + mods.sewageTreatmentBonus) * Math.max(0.25, b.efficiency / 100));
        sewageTreated += treated;
        ca.sewageTreated += treated;
      }
    } else if (rawSewage > 0) {
      const produced = Math.round(rawSewage * Math.max(0.2, 1 + mods.sewageDelta));
      sewageProduced += produced;
      ca.sewageProduced += produced;
    }

    // Odpady i śmieci (t)
    const rawWaste = def.wasteUsage ?? 0;
    if (rawWaste < 0) {
      if (roadAccessOk) {
        const processed = Math.round(Math.abs(rawWaste) * (1 + mods.wasteProcessingBonus) * Math.max(0.25, b.efficiency / 100));
        wasteProcessed += processed;
        ca.wasteProcessed += processed;
      }
    } else if (rawWaste > 0) {
      const produced = Math.round(rawWaste * Math.max(0.2, 1 + mods.wasteDelta));
      wasteProduced += produced;
      ca.wasteProduced += produced;
    }

    // Surowce i półprodukty
    for (const [rKey, val] of Object.entries(b.productionPerTick)) {
      const r = rKey as ResourceType;
      resProduced[r] = (resProduced[r] ?? 0) + (val ?? 0);
    }
    for (const [rKey, val] of Object.entries(b.consumptionPerTick)) {
      const r = rKey as ResourceType;
      resConsumed[r] = (resConsumed[r] ?? 0) + (val ?? 0);
    }
  }

  // Kontrakty B2B import/export — prąd i woda przenikają WYŁĄCZNIE przez wspólne połączenie lądowe/mostowe ('road')
  for (const c of state.contracts) {
    if (c.status !== 'active') continue;
    const involvesPlayer = c.buyerId === player.id || c.sellerId === player.id;
    if (!involvesPlayer) continue;
    const isPipeUtility = c.resource === 'electricity' || c.resource === 'water';
    const route = isPipeUtility
      ? getCargoTransportModeBetweenPlayers(state, c.sellerId, c.buyerId, c.resource)
      : null;
    if (isPipeUtility && route?.mode !== 'road') continue;

    if (c.buyerId === player.id) {
      resImport[c.resource] = (resImport[c.resource] ?? 0) + c.quantityPerTick;
      if (isPipeUtility && route) {
        const cid = clusters.clusterByPlotId.get(route.toPlotId) ?? 0;
        const ca = getOrCreateClusterAccum(clusterAcc, cid);
        if (c.resource === 'electricity') {
          electricityProduced += c.quantityPerTick;
          ca.electricityProduced += c.quantityPerTick;
        }
        if (c.resource === 'water') {
          waterProduced += c.quantityPerTick;
          ca.waterProduced += c.quantityPerTick;
        }
      }
    }
    if (c.sellerId === player.id) {
      resExport[c.resource] = (resExport[c.resource] ?? 0) + c.quantityPerTick;
      if (isPipeUtility && route) {
        const cid = clusters.clusterByPlotId.get(route.fromPlotId) ?? 0;
        const ca = getOrCreateClusterAccum(clusterAcc, cid);
        if (c.resource === 'electricity') {
          electricityConsumed += c.quantityPerTick;
          ca.electricityConsumed += c.quantityPerTick;
        }
        if (c.resource === 'water') {
          waterConsumed += c.quantityPerTick;
          ca.waterConsumed += c.quantityPerTick;
        }
      }
    }
  }

  const sortedClusters = Array.from(clusterAcc.values()).sort((a, b) => b.buildingCount - a.buildingCount);
  const clusterSummaries: ClusterUtilitySummary[] = sortedClusters.map((ca, idx) => {
    const elecRatio =
      ca.electricityConsumed > 0
        ? Math.min(1, Number((ca.electricityProduced / ca.electricityConsumed).toFixed(3)))
        : ca.electricityProduced > 0
          ? 1
          : 0;
    const waterRatio =
      ca.waterConsumed > 0
        ? Math.min(1, Number((ca.waterProduced / ca.waterConsumed).toFixed(3)))
        : ca.waterProduced > 0
          ? 1
          : 0;
    return {
      clusterId: ca.clusterId,
      label:
        ca.clusterId === 0
          ? getCurrentLanguage() === 'en'
            ? 'Isolated Plots'
            : 'Odizolowane działki'
          : getCurrentLanguage() === 'en'
            ? `Grid #${idx + 1}`
            : `Sieć #${idx + 1}`,
      electricityProduced: ca.electricityProduced,
      electricityConsumed: ca.electricityConsumed,
      electricityNet: ca.electricityProduced - ca.electricityConsumed,
      electricityCoverageRatio: elecRatio,
      waterProduced: ca.waterProduced,
      waterConsumed: ca.waterConsumed,
      waterNet: ca.waterProduced - ca.waterConsumed,
      waterCoverageRatio: waterRatio,
      sewageProduced: ca.sewageProduced,
      sewageTreated: ca.sewageTreated,
      sewageNet: ca.sewageTreated - ca.sewageProduced,
      wasteProduced: ca.wasteProduced,
      wasteProcessed: ca.wasteProcessed,
      wasteNet: ca.wasteProcessed - ca.wasteProduced,
      buildingCount: ca.buildingCount,
    };
  });

  // Oznacz realną dostępność prądu i wody na działkach gracza według ICH klastra
  const clusterById = new Map<number, ClusterUtilitySummary>();
  for (const cs of clusterSummaries) clusterById.set(cs.clusterId, cs);
  for (const op of playerOwnedPlots) {
    const cid = clusters.clusterByPlotId.get(op.id) ?? 0;
    const cs = clusterById.get(cid);
    op.hasElectricity = Boolean(cs && cs.electricityProduced > 0);
    op.hasWater = Boolean(cs && cs.waterProduced > 0);
  }

  const resourceBalances = RESOURCE_LIST.map((r) => {
    const produced = Number((resProduced[r] ?? 0).toFixed(1));
    const b2bImport = Number((resImport[r] ?? 0).toFixed(1));
    const consumed = Number((resConsumed[r] ?? 0).toFixed(1));
    const b2bExport = Number((resExport[r] ?? 0).toFixed(1));
    return {
      resource: r,
      produced,
      b2bImport,
      consumed,
      b2bExport,
      net: Number((produced + b2bImport - consumed - b2bExport).toFixed(1)),
    };
  }).filter((rb) => rb.produced > 0 || rb.consumed > 0 || rb.b2bImport > 0 || rb.b2bExport > 0);

  const electricityCoverageRatio =
    electricityConsumed > 0 ? Math.min(1, Number((electricityProduced / electricityConsumed).toFixed(3))) : 1;
  const waterCoverageRatio =
    waterConsumed > 0 ? Math.min(1, Number((waterProduced / waterConsumed).toFixed(3))) : 1;

  return {
    electricityProduced,
    electricityConsumed,
    electricityNet: electricityProduced - electricityConsumed,
    electricityCoverageRatio,
    electricityByPlant,
    electricityConsumers,
    waterProduced,
    waterConsumed,
    waterNet: waterProduced - waterConsumed,
    waterCoverageRatio,
    waterSources,
    waterConsumers,
    sewageProduced,
    sewageTreated,
    sewageNet: sewageTreated - sewageProduced,
    wasteProduced,
    wasteProcessed,
    wasteNet: wasteProcessed - wasteProduced,
    clusters: clusterSummaries,
    isolatedClusterCount: clusterSummaries.length,
    resourceBalances,
  };
}
