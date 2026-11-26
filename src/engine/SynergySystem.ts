import { BUILDING_DEFINITIONS } from '../data/buildings';
import { computeNetworkClusters, type NetworkClusterMap } from './TransportSystem';
import type { BuildingType, GameState, Plot, SynergyBreakdownItem } from './types';

const RETAIL_ZONE_TYPES = new Set<BuildingType>([
  'shoppingMall',
  'jewelryWorkshop',
  'jewelryLuxury',
  'gastronomyBoulevard',
  'casino',
  'hotel',
  'apartmentComplex',
  'prAgency',
  'conventionCenter',
]);

const ENTERTAINMENT_ANCHORS = new Set<BuildingType>([
  'casino',
  'marinaPromenade',
  'arenaStadium',
  'conventionCenter',
  'amusementPark',
  'culturalCenter',
  'cityPark',
  'gastronomyBoulevard',
]);

const TOURISM_RECIPIENTS = new Set<BuildingType>([
  'hotel',
  'resort',
  'casino',
  'arenaStadium',
  'gastronomyBoulevard',
  'shoppingMall',
  'jewelryLuxury',
]);

const INNOVATION_TYPES = new Set<BuildingType>([
  'university',
  'highSchool',
  'rdLab',
  'dataCenter',
  'biotechLab',
  'spaceCenter',
]);

const HEAVY_SMOG_TYPES = new Set<BuildingType>([
  'coalMine',
  'ironMine',
  'copperMine',
  'uraniumMine',
  'quarry',
  'oilWell',
  'oilRefinery',
  'steelMill',
  'chemicalPlant',
  'coalPowerPlant',
  'gasPowerPlant',
  'wasteIncinerator',
  'uraniumEnrichment',
  'batteryFactory',
  'compositeShipyard',
]);

const SMOG_SENSITIVE_TYPES = new Set<BuildingType>([
  'hotel',
  'resort',
  'apartmentComplex',
  'shoppingMall',
  'gastronomyBoulevard',
  'hospital',
  'culturalCenter',
  'amusementPark',
  'marinaPromenade',
  'verticalFarm',
]);

function isClusterIndustrial(type: BuildingType): boolean {
  const cat = BUILDING_DEFINITIONS[type]?.category;
  return (
    type === 'warehouse' ||
    type === 'coldStorage' ||
    type === 'cargoPort' ||
    type === 'cargoAirport' ||
    type === 'compositeShipyard' ||
    cat === 'mining' ||
    cat === 'processing'
  );
}

export interface SynergyComputationResult {
  netPercent: number;
  passengerDemandPercent: number;
  items: SynergyBreakdownItem[];
  internalTransportDiscount: number;
  researchClusterBonus: number;
}

interface SynergySpatialIndex {
  rows: Map<number, Plot[]>;
  trainClusterIds: Set<number>;
  airportVipClusterIds: Set<number>;
  airportOrPortClusterIds: Set<number>;
  hasAnyTrain: boolean;
  hasAnyAirportVip: boolean;
}

let cachedSynSig = '';
let cachedSynPlotsLen = -1;
let cachedSynIndex: SynergySpatialIndex | null = null;

function buildSynergySpatialIndex(plots: Plot[], clusters?: NetworkClusterMap): SynergySpatialIndex {
  const rows = new Map<number, Plot[]>();
  const trainClusterIds = new Set<number>();
  const airportVipClusterIds = new Set<number>();
  const airportOrPortClusterIds = new Set<number>();
  let hasAnyTrain = false;
  let hasAnyAirportVip = false;

  for (let i = 0; i < plots.length; i++) {
    const p = plots[i];
    const ob = p.building;
    if (!ob || !ob.isActive || ob.destroyedRuins) continue;

    let row = rows.get(p.gridY);
    if (!row) {
      row = [];
      rows.set(p.gridY, row);
    }
    row.push(p);

    const cid = clusters ? (clusters.clusterByPlotId.get(p.id) ?? 0) : 0;
    const ot = ob.type;
    if (ot === 'trainStation') {
      hasAnyTrain = true;
      if (cid !== 0) trainClusterIds.add(cid);
    } else if (ot === 'passengerTerminal') {
      hasAnyAirportVip = true;
      if (cid !== 0) {
        airportVipClusterIds.add(cid);
        airportOrPortClusterIds.add(cid);
      }
    } else if (ot === 'cargoAirport' || ot === 'cargoPort') {
      if (cid !== 0) airportOrPortClusterIds.add(cid);
    }
  }

  return {
    rows,
    trainClusterIds,
    airportVipClusterIds,
    airportOrPortClusterIds,
    hasAnyTrain,
    hasAnyAirportVip,
  };
}

function getSynergySpatialIndexCached(plots: Plot[], clusters?: NetworkClusterMap): SynergySpatialIndex {
  let activeSig = 0;
  for (let i = 0; i < plots.length; i++) {
    const ob = plots[i].building;
    if (ob && ob.isActive && !ob.destroyedRuins) {
      let doneHash = 0;
      for (let t = 0; t < ob.techTree.length; t++) {
        if (ob.techTree[t].status === 'done') doneHash++;
      }
      activeSig = (activeSig * 31 + i + 1 + doneHash * 7) | 0;
    }
  }
  const sig = `${plots.length}_${clusters?.clusterCount ?? -1}_${activeSig}`;
  if (cachedSynIndex && cachedSynPlotsLen === plots.length && cachedSynSig === sig) {
    return cachedSynIndex;
  }
  cachedSynSig = sig;
  cachedSynPlotsLen = plots.length;
  cachedSynIndex = buildSynergySpatialIndex(plots, clusters);
  return cachedSynIndex;
}

export function evaluateSynergyForPlotAndType(
  plots: Plot[],
  targetPlot: Plot,
  targetType: BuildingType,
  clusters?: NetworkClusterMap
): SynergyComputationResult {
  const index = getSynergySpatialIndexCached(plots, clusters);
  return evaluateSynergyWithIndex(index, targetPlot, targetType, clusters);
}

function evaluateSynergyWithIndex(
  index: SynergySpatialIndex,
  targetPlot: Plot,
  targetType: BuildingType,
  clusters?: NetworkClusterMap
): SynergyComputationResult {
  const items: SynergyBreakdownItem[] = [];
  let retailPercent = 0;
  let entertainmentPercent = 0;
  let industrialPercent = 0;
  let innovationPercent = 0;
  let smogPenalty = 0;
  let parkCount = 0;

  const seenRetailTypes = new Set<BuildingType>();
  const seenEntTypes = new Set<BuildingType>();
  const seenClusterTypes = new Set<BuildingType>();
  const seenInnoTypes = new Set<BuildingType>();

  const targetClusterId = clusters ? (clusters.clusterByPlotId.get(targetPlot.id) ?? 0) : 0;
  const targetClusterHasAirportOrPort =
    clusters && targetClusterId !== 0 ? index.airportOrPortClusterIds.has(targetClusterId) : false;

  const hasGlobalTrain = clusters
    ? targetClusterId !== 0 && index.trainClusterIds.has(targetClusterId)
    : index.hasAnyTrain;
  const hasGlobalAirportVip = clusters
    ? index.hasAnyAirportVip &&
      (targetClusterHasAirportOrPort || (targetClusterId !== 0 && index.airportVipClusterIds.has(targetClusterId)))
    : index.hasAnyAirportVip;

  let hasBus = false;
  let hasMetro = false;
  let hasLocalTrain = false;
  let hasLocalAirportVip = false;
  let nearbyApartments = 0;

  for (let y = targetPlot.gridY - 6; y <= targetPlot.gridY + 6; y++) {
    const row = index.rows.get(y);
    if (!row) continue;

    for (let i = 0; i < row.length; i++) {
      const other = row[i];
      if (other.id === targetPlot.id) continue;
      if (Math.abs(other.gridX - targetPlot.gridX) > 6) continue;

      const ob = other.building!;
      const ot = ob.type;
      const dist = Math.hypot(other.gridX - targetPlot.gridX, other.gridY - targetPlot.gridY);
      if (dist > 6.2) continue;

      const otherClusterId = clusters ? (clusters.clusterByPlotId.get(other.id) ?? 0) : 0;
      const sameCluster =
        clusters && targetClusterId !== 0 && otherClusterId === targetClusterId;

      if (ot === 'busDepot' && dist <= 4.3 && (!clusters || sameCluster) && (targetPlot.distanceToRoad <= 2 || other.distanceToRoad <= 2)) {
        hasBus = true;
      }
      if (ot === 'metroStation' && dist <= 5.2 && (!clusters || sameCluster)) {
        hasMetro = true;
      }
      if (ot === 'trainStation' && dist <= 5.2 && (!clusters || sameCluster)) {
        hasLocalTrain = true;
      }
      if (ot === 'passengerTerminal' && dist <= 6.2 && (!clusters || sameCluster || targetClusterHasAirportOrPort)) {
        hasLocalAirportVip = true;
      }
      if (ot === 'apartmentComplex' && dist <= 3.1) {
        nearbyApartments++;
      }

      // Promień 1-2 pola (maks ~2.4 euklidesowo obejmuje skosy 2x2 / 3x3)
      if (dist <= 2.35) {
        // 1. Strefa Kupujących
        if (RETAIL_ZONE_TYPES.has(targetType) && RETAIL_ZONE_TYPES.has(ot) && ot !== targetType && !seenRetailTypes.has(ot)) {
          seenRetailTypes.add(ot);
          const add = 14;
          retailPercent += add;
          items.push({
            kind: 'retail_zone',
            label: `Strefa Kupujących (${BUILDING_DEFINITIONS[ot].shortName})`,
            percentDelta: add,
            sourcePlotId: other.id,
          });
        }

        // 2. Dzielnica Rozrywki i Turystyki
        if (
          TOURISM_RECIPIENTS.has(targetType) &&
          ENTERTAINMENT_ANCHORS.has(ot) &&
          ot !== targetType &&
          !seenEntTypes.has(ot)
        ) {
          seenEntTypes.add(ot);
          const add = ot === 'arenaStadium' || ot === 'casino' || ot === 'marinaPromenade' ? 16 : 11;
          entertainmentPercent += add;
          items.push({
            kind: 'entertainment_district',
            label: `Dzielnica Rozrywki (${BUILDING_DEFINITIONS[ot].shortName})`,
            percentDelta: add,
            sourcePlotId: other.id,
          });
        }

        // 3. Kampus Innowacji
        if (INNOVATION_TYPES.has(targetType) && INNOVATION_TYPES.has(ot) && ot !== targetType && !seenInnoTypes.has(ot)) {
          seenInnoTypes.add(ot);
          const add = 15;
          innovationPercent += add;
          items.push({
            kind: 'innovation_campus',
            label: `Kampus Innowacji (${BUILDING_DEFINITIONS[ot].shortName})`,
            percentDelta: add,
            sourcePlotId: other.id,
          });
        }

        // 4. Klaster Przemysłowy
        if (isClusterIndustrial(targetType) && isClusterIndustrial(ot) && !seenClusterTypes.has(ot)) {
          seenClusterTypes.add(ot);
          const add = 8;
          industrialPercent += add;
          items.push({
            kind: 'industrial_cluster',
            label: `Klaster Przemysłowy (${BUILDING_DEFINITIONS[ot].shortName})`,
            percentDelta: add,
            sourcePlotId: other.id,
          });
        }

        // 5. Park Miejski / Ogród Botaniczny (neutralizuje smog i dodaje urok)
        if (ot === 'cityPark' && SMOG_SENSITIVE_TYPES.has(targetType)) {
          parkCount++;
        }

        // 6. Konflikty sąsiedztwa (Smog, Zapach Składowiska i Hałas)
        if (SMOG_SENSITIVE_TYPES.has(targetType) && HEAVY_SMOG_TYPES.has(ot)) {
          const hasFilter = ob.techTree.some((t) => t.status === 'done' && t.effects.cleanFilter);
          const rawPen = dist <= 1.5 ? 16 : 11;
          smogPenalty += Math.round(rawPen * (hasFilter ? 0.35 : 1));
        } else if (SMOG_SENSITIVE_TYPES.has(targetType) && ot === 'wasteLandfill') {
          const hasFilter = ob.techTree.some((t) => t.status === 'done' && t.effects.cleanFilter);
          const rawPen = dist <= 1.5 ? 9 : 6;
          smogPenalty += Math.round(rawPen * (hasFilter ? 0.45 : 1));
        }
      }
    }
  }

  retailPercent = Math.min(36, retailPercent);
  entertainmentPercent = Math.min(34, entertainmentPercent);
  industrialPercent = Math.min(24, industrialPercent);
  innovationPercent = Math.min(35, innovationPercent);

  if (smogPenalty > 0) {
    const mitigationRatio = Math.min(0.65, parkCount * 0.38);
    const finalSmog = Math.min(40, Math.round(smogPenalty * (1 - mitigationRatio)));
    if (finalSmog > 0) {
      items.push({
        kind: 'smog_penalty',
        label: parkCount > 0 ? 'Smog i Hałas (częściowo osłonięty Parkiem)' : 'Smog i Hałas przemysłowy w sąsiedztwie',
        percentDelta: -finalSmog,
      });
    }
    if (mitigationRatio > 0) {
      items.push({
        kind: 'park_mitigation',
        label: 'Park Miejski: Ochrona zieleni',
        percentDelta: Math.round(smogPenalty * mitigationRatio),
      });
    }
    smogPenalty = finalSmog;
  }

  // Napływ Konsumentów / Popyt Lokalny (100% -> do 185%, zablokowana teleportacja przez wodę)
  let passengerDemandPercent = 100;
  if (hasBus) passengerDemandPercent += 18;
  if (hasMetro) passengerDemandPercent += 28;
  if (hasGlobalTrain) passengerDemandPercent += 12;
  if (hasLocalTrain) passengerDemandPercent += 12;
  if (hasGlobalAirportVip) passengerDemandPercent += TOURISM_RECIPIENTS.has(targetType) ? 16 : 10;
  if (hasLocalAirportVip) passengerDemandPercent += 14;
  if (nearbyApartments > 0) passengerDemandPercent += Math.min(20, nearbyApartments * 10);
  passengerDemandPercent = Math.min(185, passengerDemandPercent);

  if (passengerDemandPercent > 100 && (RETAIL_ZONE_TYPES.has(targetType) || TOURISM_RECIPIENTS.has(targetType))) {
    items.push({
      kind: 'passenger_hub',
      label: `Napływ Konsumentów / Transport (${passengerDemandPercent}%)`,
      percentDelta: Math.round((passengerDemandPercent - 100) * 0.4),
    });
  }

  const netPercent =
    retailPercent +
    entertainmentPercent +
    industrialPercent +
    innovationPercent -
    smogPenalty;

  return {
    netPercent,
    passengerDemandPercent,
    items,
    internalTransportDiscount: Math.min(0.32, industrialPercent * 0.012),
    researchClusterBonus: Math.min(0.35, innovationPercent * 0.01),
  };
}

export function recalculateSynergiesAndPassengerDemand(state: GameState): void {
  const clusters = computeNetworkClusters(state);
  const index = getSynergySpatialIndexCached(state.plots, clusters);
  for (const plot of state.plots) {
    if (!plot.building || plot.building.destroyedRuins) {
      plot.synergyPercent = 0;
      plot.activeSynergies = [];
      if (plot.terrain === 'water' || (plot.irradiatedTicks ?? 0) > 0) {
        plot.passengerDemandPercent = 100;
      } else {
        const probe = evaluateSynergyWithIndex(index, plot, 'shoppingMall', clusters);
        plot.passengerDemandPercent = probe.passengerDemandPercent;
      }
      continue;
    }
    const res = evaluateSynergyWithIndex(index, plot, plot.building.type, clusters);
    plot.synergyPercent = res.netPercent;
    plot.passengerDemandPercent = res.passengerDemandPercent;
    plot.activeSynergies = res.items;
  }
}

export function previewBuildingSynergyAtPlot(
  state: GameState,
  plot: Plot,
  buildingType: BuildingType
): {
  netPercent: number;
  passengerDemandPercent: number;
  items: SynergyBreakdownItem[];
} {
  const clusters = computeNetworkClusters(state);
  const res = evaluateSynergyForPlotAndType(state.plots, plot, buildingType, clusters);
  return {
    netPercent: res.netPercent,
    passengerDemandPercent: res.passengerDemandPercent,
    items: res.items,
  };
}
