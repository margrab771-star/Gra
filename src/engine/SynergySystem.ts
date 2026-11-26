import { BUILDING_DEFINITIONS } from '../data/buildings';
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

export function evaluateSynergyForPlotAndType(
  plots: Plot[],
  targetPlot: Plot,
  targetType: BuildingType
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

  let hasBus = false;
  let hasMetro = false;
  let hasLocalTrain = false;
  let hasGlobalTrain = false;
  let hasLocalAirportVip = false;
  let hasGlobalAirportVip = false;
  let nearbyApartments = 0;

  for (const other of plots) {
    const ob = other.building;
    if (!ob || !ob.isActive || ob.destroyedRuins) continue;
    const ot = ob.type;
    const dist = Math.hypot(other.gridX - targetPlot.gridX, other.gridY - targetPlot.gridY);

    if (ot === 'trainStation') hasGlobalTrain = true;
    if (ot === 'passengerTerminal') hasGlobalAirportVip = true;

    if (other.id === targetPlot.id) continue;

    if (ot === 'busDepot' && dist <= 4.3 && (targetPlot.distanceToRoad <= 2 || other.distanceToRoad <= 2)) {
      hasBus = true;
    }
    if (ot === 'metroStation' && dist <= 5.2) {
      hasMetro = true;
    }
    if (ot === 'trainStation' && dist <= 5.2) {
      hasLocalTrain = true;
    }
    if (ot === 'passengerTerminal' && dist <= 6.2) {
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

  retailPercent = Math.min(40, retailPercent);
  entertainmentPercent = Math.min(38, entertainmentPercent);
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

  // Napływ Konsumentów / Popyt Lokalny (100% -> do 220%)
  let passengerDemandPercent = 100;
  if (hasBus) passengerDemandPercent += 24;
  if (hasMetro) passengerDemandPercent += 42;
  if (hasGlobalTrain) passengerDemandPercent += 14;
  if (hasLocalTrain) passengerDemandPercent += 16;
  if (hasGlobalAirportVip) passengerDemandPercent += TOURISM_RECIPIENTS.has(targetType) ? 24 : 12;
  if (hasLocalAirportVip) passengerDemandPercent += 22;
  if (nearbyApartments > 0) passengerDemandPercent += Math.min(24, nearbyApartments * 12);
  passengerDemandPercent = Math.min(220, passengerDemandPercent);

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
  for (const plot of state.plots) {
    if (!plot.building || plot.building.destroyedRuins) {
      plot.synergyPercent = 0;
      plot.activeSynergies = [];
      // Nadal wylicz bazowy popyt pasażerski dla podglądu działki komercyjnej
      const probe = evaluateSynergyForPlotAndType(state.plots, plot, 'shoppingMall');
      plot.passengerDemandPercent = probe.passengerDemandPercent;
      continue;
    }
    const res = evaluateSynergyForPlotAndType(state.plots, plot, plot.building.type);
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
  const res = evaluateSynergyForPlotAndType(state.plots, plot, buildingType);
  return {
    netPercent: res.netPercent,
    passengerDemandPercent: res.passengerDemandPercent,
    items: res.items,
  };
}
