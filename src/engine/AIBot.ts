import { GAME_CONFIG } from '../config/gameConfig';
import { ARCHETYPES } from '../data/archetypes';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { RESOURCE_DEFINITIONS } from '../data/resources';
import { computePlayerUtilityAndResourceBalance } from './BalanceSystem';
import {
  checkBuildingRequirements,
  constructBuildingOnPlot,
  demolishBuildingOnPlot,
  getBuildingConstructionCost,
  getPowerPlantFuelSpec,
  repairBuilding,
  startBuildingTechResearch,
  toggleBuildingInsurance,
} from './BuildingSystem';
import { acceptB2BContract, proposeB2BContract } from './ContractSystem';
import { getResourcePrice, repayBankLoan, takeBankLoan } from './EconomyEngine';
import { lobbyGovernmentElection, placeLiveAuctionBid, submitTenderDelivery } from './EventSystem';
import { buyServiceVehicleForPlayer } from './HazardSystem';
import { hireWorkersForBuilding, trainBuildingWorkers } from './HRSystem';
import { executeInfluenceAction } from './InfluenceSystem';
import {
  buildPlayerRoadOnPlot,
  buyPlotForPlayer,
  getPlotPurchasePrice,
  getRoadBuildCostForPlot,
  getSuggestedPlotBuyoutValuation,
  hasPlayerDiscoveredPlot,
  hasPlayerSurveyedPlot,
  respondPlotOfferForPlayer,
  sellPlotForPlayer,
  surveyAreaForPlayer,
  surveyPlotForPlayer,
} from './PlotSystem';
import { tradeCorporateStock } from './StockMarketSystem';
import { previewBuildingSynergyAtPlot } from './SynergySystem';
import {
  canTransportGoodsBetweenPlots,
  computeNetworkClusters,
  hasExternalMarketAccess,
  hasRoadAccess,
  isRoadExemptBuilding,
  isRoadPassableFor,
} from './TransportSystem';
import type {
  AIStrategy,
  Building,
  BuildingTechNode,
  BuildingType,
  GameState,
  GovernmentKind,
  Player,
  Plot,
  ResourceType,
  UtilityBalanceReport,
} from './types';

const STRATEGY_PRIORITIES: Record<AIStrategy, BuildingType[]> = {
  industrialist: [
    'corporateHQ',
    'highSchool',
    'coalMine',
    'ironMine',
    'quarry',
    'steelMill',
    'prefabFactory',
    'copperMine',
    'copperCablePlant',
    'lithiumMine',
    'batteryFactory',
    'oilWell',
    'oilRefinery',
    'compositeShipyard',
    'fireStation',
    'hazmatBase',
  ],
  energyMagnate: [
    'corporateHQ',
    'highSchool',
    'solarFarm',
    'windFarm',
    'geothermalPlant',
    'coalMine',
    'gasPowerPlant',
    'university',
    'dataCenter',
    'coalPowerPlant',
    'uraniumMine',
    'uraniumEnrichment',
    'nuclearPowerPlant',
    'hazmatBase',
  ],
  realEstate: [
    'corporateHQ',
    'apartmentComplex',
    'shoppingMall',
    'gastronomyBoulevard',
    'busDepot',
    'cityPark',
    'hotel',
    'officeTower',
    'metroStation',
    'arenaStadium',
    'conventionCenter',
    'casino',
    'resort',
    'policeStation',
    'investmentBank',
  ],
  shadowBroker: [
    'corporateHQ',
    'highSchool',
    'mediaAgency',
    'prAgency',
    'lawFirm',
    'churchFoundation',
    'lobbyOffice',
    'officeTower',
    'casino',
    'policeStation',
    'hospital',
    'investmentBank',
  ],
  military: [
    'corporateHQ',
    'highSchool',
    'university',
    'ironMine',
    'coalMine',
    'steelMill',
    'weaponsComplex',
    'militaryBase',
    'intelligenceCenter',
    'cargoAirport',
    'fireStation',
  ],
  supplyChain: [
    'corporateHQ',
    'highSchool',
    'university',
    'rdLab',
    'warehouse',
    'busDepot',
    'trainStation',
    'cargoPort',
    'cargoAirport',
    'oilRefinery',
    'chemicalPlant',
    'copperCablePlant',
    'semiconductorFab',
    'electronicsFactory',
    'batteryFactory',
    'verticalFarm',
    'biotechLab',
  ],
};

const SMOG_EMITTING_TYPES = new Set<BuildingType>([
  'coalMine',
  'ironMine',
  'copperMine',
  'uraniumMine',
  'quarry',
  'steelMill',
  'oilRefinery',
  'chemicalPlant',
  'coalPowerPlant',
  'gasPowerPlant',
  'wasteIncinerator',
  'wasteLandfill',
  'uraniumEnrichment',
  'batteryFactory',
  'compositeShipyard',
]);

const RESIDENTIAL_OR_TOURISM_TYPES = new Set<BuildingType>([
  'hotel',
  'resort',
  'apartmentComplex',
  'shoppingMall',
  'gastronomyBoulevard',
  'cityPark',
]);

const PASSENGER_RECIPIENT_TYPES = new Set<BuildingType>([
  'shoppingMall',
  'gastronomyBoulevard',
  'hotel',
  'resort',
  'apartmentComplex',
  'officeTower',
  'casino',
  'arenaStadium',
  'conventionCenter',
]);

const HIGH_VAL_MINERALS = new Set<ResourceType>(['gold', 'diamonds', 'uranium', 'lithium', 'rareMetals']);

export function executeAITurn(state: GameState, ai: Player, slotOffset = 0): void {
  if (!ai.isAI || ai.isEliminated) return;
  const difficulty = Math.max(1, Math.min(5, ai.aiDifficulty ?? state.settings.aiDifficulty ?? 2));
  // Rozłożenie decyzji na różne ticki (staggered ticks) zależnie od trudności
  const cadence = difficulty === 1 ? 7 : difficulty === 2 ? 5 : difficulty === 3 ? 4 : 3;
  if ((state.time.tick + slotOffset) % cadence !== 0) return;

  const strategy: AIStrategy = ai.aiStrategy ?? 'industrialist';
  let ownedPlots = state.plots.filter((p) => p.ownerId === ai.id);

  // 1. Porządki po katastrofach (ruiny)
  for (const plot of ownedPlots) {
    if (plot.building?.destroyedRuins && ai.cash > 45_000) {
      demolishBuildingOnPlot(state, ai, plot);
    }
  }

  let ownedBuildings = ownedPlots
    .filter((p) => p.building !== null && !p.building.destroyedRuins)
    .map((p) => p.building!);

  // 2. Zdrowie finansowe: spłata kredytów, obrona przed komornikiem, wycena ofert wykupu
  manageFinancialSafety(state, ai, difficulty, ownedPlots, ownedBuildings);

  ownedPlots = state.plots.filter((p) => p.ownerId === ai.id);
  ownedBuildings = ownedPlots
    .filter((p) => p.building !== null && !p.building.destroyedRuins)
    .map((p) => p.building!);

  const cashReserve = computeCashReserve(ai, difficulty, ownedBuildings.length);
  const util = computePlayerUtilityAndResourceBalance(state, ai);

  let emptyOwned = getEmptyOwnedPlots(ownedPlots);

  // 2b. Fizyczne paliwo elektrowni: B2B lub tymczasowy import awaryjny zamiast blackoutu
  ensurePowerPlantFuelSupply(state, ai, ownedPlots);

  // 3. PRIORYTET #1: Podstawowe media i przetrwanie (Prąd, Woda, Ścieki, Odpady <18% zapasu, również w odizolowanych klastrach!)
  const utilityBlocked = ensureUtilitiesSurvival(
    state,
    ai,
    difficulty,
    util,
    ownedPlots,
    ownedBuildings,
    emptyOwned
  );

  // Odśwież działki i natychmiast doprowadź drogi/mosty do odizolowanych stacji/fabryk
  ownedPlots = state.plots.filter((p) => p.ownerId === ai.id);
  ensureContinuousRoads(state, ai, difficulty, ownedPlots, getEmptyOwnedPlots(ownedPlots), cashReserve, true);

  ownedPlots = state.plots.filter((p) => p.ownerId === ai.id);
  ownedBuildings = ownedPlots
    .filter((p) => p.building !== null && !p.building.destroyedRuins)
    .map((p) => p.building!);
  emptyOwned = getEmptyOwnedPlots(ownedPlots);

  const postUtil = computePlayerUtilityAndResourceBalance(state, ai);
  const stillHasDeficit =
    postUtil.electricityNet < 0 ||
    postUtil.waterNet < 0 ||
    postUtil.sewageNet < 0 ||
    postUtil.wasteNet < 0 ||
    (postUtil.clusters ?? []).some(
      (c) => c.electricityNet < 0 || c.waterNet < 0 || c.sewageNet < 0 || c.wasteNet < 0
    );

  // 4. Kadry, naprawy i opłacalne ulepszenia (wstrzymaj płatne ulepszenia/szkolenia przy aktywnym deficycie mediów)
  maintainAndUpgradeBuildings(state, ai, difficulty, ownedBuildings, cashReserve, !stillHasDeficit);

  // Gdy media są zagrożone lub właśnie zbudowano elektrownię/stację, najpierw spróbuj spiąć odizolowane klastry mostem i zabezpiecz paliwo
  if (utilityBlocked || stillHasDeficit) {
    tryBridgeSeparatedClusters(state, ai, ownedPlots, cashReserve, true);
    return;
  }

  // 5. Globalne badania R&D i Drzewko Prezesa
  researchTechAndSkills(state, ai, difficulty, strategy, cashReserve);

  // 6. Ciągła sieć dróg, arterie startowe i autostrady dla obiektów
  ensureContinuousRoads(state, ai, difficulty, ownedPlots, emptyOwned, cashReserve, false);

  ownedPlots = state.plots.filter((p) => p.ownerId === ai.id);
  emptyOwned = getEmptyOwnedPlots(ownedPlots);

  // 7. Geologia i mądry zakup działek (złoża, przyległość do drogi i sieci)
  runGeologyAndExpansion(state, ai, difficulty, strategy, ownedPlots, emptyOwned, cashReserve);

  ownedPlots = state.plots.filter((p) => p.ownerId === ai.id);
  ownedBuildings = ownedPlots
    .filter((p) => p.building !== null && !p.building.destroyedRuins)
    .map((p) => p.building!);
  emptyOwned = getEmptyOwnedPlots(ownedPlots);

  // 8. Budowa najbardziej opłacalnego obiektu (Utility Score + Synergie + Łańcuchy dostaw + Dostęp do drogi)
  if (emptyOwned.length > 0 && ai.cash > cashReserve + 80_000) {
    evaluateAndBuildBestStructure(
      state,
      ai,
      difficulty,
      strategy,
      util,
      ownedPlots,
      ownedBuildings,
      emptyOwned,
      cashReserve
    );
    ownedPlots = state.plots.filter((p) => p.ownerId === ai.id);
    ensureContinuousRoads(state, ai, difficulty, ownedPlots, getEmptyOwnedPlots(ownedPlots), cashReserve, true);
  }

  // 9. Aukcje na żywo, przetargi rządowe, kontrakty B2B, giełda i lobbing wyborczy
  handleDiplomacyMarketAndAuctions(state, ai, difficulty, strategy, util, ownedBuildings, cashReserve);
}

function getEmptyOwnedPlots(ownedPlots: Plot[]): Plot[] {
  return ownedPlots.filter(
    (p) => p.building === null && !p.hasRoad && p.terrain !== 'water' && (p.irradiatedTicks ?? 0) <= 0
  );
}

function computeCashReserve(ai: Player, difficulty: number, buildingCount: number): number {
  if (buildingCount <= 1) {
    return difficulty >= 3 ? 65_000 : 75_000;
  }
  const basePerBld = difficulty === 1 ? 48_000 : difficulty === 2 ? 40_000 : 35_000;
  const upkeepBuffer = Math.max(0, buildingCount * basePerBld);
  const debtBuffer = ai.loans.length > 0 ? 75_000 : 0;
  return Math.min(1_050_000, Math.max(95_000, upkeepBuffer + debtBuffer));
}

function manageFinancialSafety(
  state: GameState,
  ai: Player,
  difficulty: number,
  ownedPlots: Plot[],
  ownedBuildings: Building[]
): void {
  // Akceptacja lub odrzucenie nadchodzących ofert wykupu działek rywali
  const incomingOffers = state.plotOffers.filter(
    (o) => o.toPlayerId === ai.id && (o.status === 'pending' || o.status === 'countered')
  );
  for (const offer of incomingOffers) {
    const plot = state.plots.find((p) => p.id === offer.plotId);
    if (!plot) continue;
    const minRatio = difficulty >= 3 ? 1.25 : 1.1;
    const fairVal = getSuggestedPlotBuyoutValuation(plot, offer.includeBuilding);
    const isCriticalAsset =
      plot.building?.type === 'corporateHQ' ||
      plot.building?.category === 'energy' ||
      plot.building?.category === 'waste';
    if (!isCriticalAsset && offer.offeredPrice >= fairVal * minRatio) {
      respondPlotOfferForPlayer(state, ai, offer.id, 'accept');
    } else if (offer.offeredPrice < fairVal * 0.9) {
      respondPlotOfferForPlayer(state, ai, offer.id, 'reject');
    }
  }

  // Spłata pożyczek przy bezpiecznej nadwyżce gotówki
  if (ai.loans.length > 0) {
    const sortedLoans = [...ai.loans].sort((a, b) => a.remainingAmount - b.remainingAmount);
    const targetLoan = sortedLoans[0];
    const safetyAfterPay = difficulty >= 3 ? 130_000 : 190_000;
    if (ai.cash >= targetLoan.remainingAmount + safetyAfterPay) {
      repayBankLoan(ai, targetLoan.id);
    }
  }

  // Ratunek przed komornikiem (ujemne saldo / groźba egzekucji)
  if ((ai.insolvencyGraceTicks ?? 0) > 0 || ai.cash < 0) {
    const sellCandidates = ownedPlots
      .filter((p) => !p.building && !p.hasRoad && p.deposits.length === 0)
      .sort((a, b) => b.price - a.price);
    for (const ep of sellCandidates) {
      if (ai.cash >= 60_000) break;
      sellPlotForPlayer(state, ai, ep);
    }
    if (ai.cash < -40_000) {
      const coalCount = ownedBuildings.filter((b) => b.type === 'coalPowerPlant').length;
      const bleeding = ownedPlots
        .filter(
          (p) =>
            p.building &&
            !p.building.destroyedRuins &&
            p.building.category !== 'waste' &&
            p.building.type !== 'waterPlant' &&
            (p.building.category !== 'energy' || (p.building.type === 'coalPowerPlant' && coalCount >= 2)) &&
            p.building.netProfit < -1_200
        )
        .sort((a, b) => a.building!.netProfit - b.building!.netProfit);
      if (bleeding[0]) {
        demolishBuildingOnPlot(state, ai, bleeding[0]);
      }
    }
  }

  // Ubezpieczanie kluczowych aktywów (Trudny / Ekspert)
  if (difficulty >= 3 && ai.cash > 650_000) {
    const highValueUninsured = ownedBuildings.find(
      (b) =>
        !b.insured &&
        (b.visualTier ?? 0) >= 2 &&
        BUILDING_DEFINITIONS[b.type].baseCost >= 500_000
    );
    if (highValueUninsured) {
      toggleBuildingInsurance(highValueUninsured);
    }
  }
}

function ensurePowerPlantFuelSupply(
  state: GameState,
  ai: Player,
  ownedPlots: Plot[]
): void {
  const minePlots = ownedPlots.filter(
    (p) =>
      p.building &&
      p.building.isActive &&
      !p.building.destroyedRuins &&
      Object.keys(BUILDING_DEFINITIONS[p.building.type].outputs).length > 0
  );

  for (const plantPlot of ownedPlots) {
    const b = plantPlot.building;
    if (!b || !b.isActive || b.destroyedRuins) continue;
    const spec = getPowerPlantFuelSpec(b.type);
    if (!spec) continue;

    const hasReachableMine = minePlots.some((mp) => {
      const outs = Object.keys(BUILDING_DEFINITIONS[mp.building!.type].outputs) as ResourceType[];
      if (!outs.some((r) => spec.acceptedResources.includes(r))) return false;
      return canTransportGoodsBetweenPlots(state, mp, plantPlot, ai.id).reachable;
    });

    const fuelLvl = b.fuelLevel ?? 50;
    if (hasReachableMine && fuelLvl >= 85 && b.emergencyMarketImport) {
      b.emergencyMarketImport = false;
      continue;
    }

    if (!hasReachableMine && (fuelLvl < 40 || b.status.noFuel)) {
      const openSell = state.contracts.find(
        (c) =>
          c.status === 'open_listing' &&
          c.listingSide === 'sell' &&
          c.sellerId !== ai.id &&
          spec.acceptedResources.includes(c.resource) &&
          ai.cash >= c.pricePerUnit * c.quantityPerTick * 2
      );
      if (openSell) {
        acceptB2BContract(state, ai, openSell.id);
      }

      if (!b.emergencyMarketImport && hasExternalMarketAccess(state, plantPlot, ai.id) && ai.cash > 65_000) {
        b.emergencyMarketImport = true;
      }
    }
  }
}

function ensureUtilitiesSurvival(
  state: GameState,
  ai: Player,
  difficulty: number,
  util: UtilityBalanceReport,
  ownedPlots: Plot[],
  ownedBuildings: Building[],
  emptyOwned: Plot[]
): boolean {
  const clusters = computeNetworkClusters(state);
  const clusterSummaries = util.clusters ?? [];
  const elecDeficitClusters = new Set(
    clusterSummaries.filter((c) => c.electricityNet < 0).map((c) => c.clusterId)
  );
  const waterDeficitClusters = new Set(
    clusterSummaries.filter((c) => c.waterNet < 0).map((c) => c.clusterId)
  );
  const sewageDeficitClusters = new Set(
    clusterSummaries.filter((c) => c.sewageNet < 0).map((c) => c.clusterId)
  );
  const wasteDeficitClusters = new Set(
    clusterSummaries.filter((c) => c.wasteNet < 0).map((c) => c.clusterId)
  );

  const headroomPct = difficulty >= 3 ? 0.2 : 0.16;
  const minElecMargin = ownedBuildings.length >= 2 ? 22 : 12;
  const needElec =
    elecDeficitClusters.size > 0 ||
    util.electricityNet < 0 ||
    (util.electricityConsumed > 0 &&
      util.electricityNet < Math.max(minElecMargin, util.electricityProduced * headroomPct));
  const needWater =
    waterDeficitClusters.size > 0 ||
    util.waterNet < 0 ||
    (util.waterConsumed > 0 && util.waterNet < Math.max(12, util.waterProduced * headroomPct));
  const needSewage =
    sewageDeficitClusters.size > 0 ||
    util.sewageNet < 0 ||
    (util.sewageProduced > 0 && util.sewageNet < Math.max(16, util.sewageProduced * headroomPct));
  const needWaste =
    wasteDeficitClusters.size > 0 ||
    util.wasteNet < 0 ||
    (util.wasteProduced > 0 && util.wasteNet < Math.max(16, util.wasteProduced * headroomPct));

  if (!needElec && !needWater && !needSewage && !needWaste) {
    return false;
  }

  const hasDeficit =
    elecDeficitClusters.size > 0 ||
    waterDeficitClusters.size > 0 ||
    sewageDeficitClusters.size > 0 ||
    wasteDeficitClusters.size > 0 ||
    util.electricityNet < 0 ||
    util.waterNet < 0 ||
    util.sewageNet < 0 ||
    util.wasteNet < 0;
  const isEco = ai.archetype === 'eco_innovator' || state.government?.currentGov === 'ecological';

  const hasOwnCoal = ownedBuildings.some((b) => b.type === 'coalMine');
  const hasOwnOilOrFuel = ownedBuildings.some((b) => b.type === 'oilWell' || b.type === 'oilRefinery');
  const hasOwnUranium = ownedBuildings.some((b) => b.type === 'uraniumMine' || b.type === 'uraniumEnrichment');

  const windCount = ownedBuildings.filter((b) => b.type === 'windFarm').length;
  const solarCount = ownedBuildings.filter((b) => b.type === 'solarFarm').length;
  const elecCandidates: BuildingType[] =
    windCount <= solarCount
      ? ['windFarm', 'solarFarm', 'geothermalPlant']
      : ['solarFarm', 'windFarm', 'geothermalPlant'];
  if (hasOwnOilOrFuel) elecCandidates.push('gasPowerPlant');
  if (
    difficulty >= 4 &&
    hasOwnUranium &&
    ownedBuildings.some((b) => b.type === 'hazmatBase') &&
    util.waterNet > 25
  ) {
    elecCandidates.push('nuclearPowerPlant');
  }
  if (!isEco && !state.greenTransitionEntered && hasOwnCoal) elecCandidates.push('coalPowerPlant');
  if (!elecCandidates.includes('gasPowerPlant')) elecCandidates.push('gasPowerPlant');

  const waterCandidates: BuildingType[] = [];
  if (needSewage && ai.corporationLevel >= 4) waterCandidates.push('closedLoopSewagePlant');
  waterCandidates.push('waterPlant', 'bioSewagePlant');

  const sewageCandidates: BuildingType[] = [];
  if (ai.corporationLevel >= 4) sewageCandidates.push('closedLoopSewagePlant');
  if (ai.corporationLevel >= 2) sewageCandidates.push('bioSewagePlant');
  sewageCandidates.push('sewagePlant');

  const wasteCandidates: BuildingType[] = [];
  if (ai.corporationLevel >= 4) wasteCandidates.push('plasmaGasificationPlant');
  if (ai.corporationLevel >= 3) wasteCandidates.push('recyclingPlant');
  if (isEco || ai.cash < 200_000 || state.greenTransitionEntered) {
    wasteCandidates.push('wasteLandfill');
  } else {
    wasteCandidates.push('wasteIncinerator', 'wasteLandfill');
  }

  // Awaryjny kredyt jeśli brakuje gotówki na naprawę lub budowę krytycznych mediów i mutator pozwala
  if (
    ai.cash < 240_000 &&
    !state.settings.mutators?.noLoans &&
    ai.loans.length < 2 &&
    ai.netWorth > 380_000 &&
    ownedBuildings.length >= 1
  ) {
    takeBankLoan(state, ai, 300_000, 12);
  }

  // Napraw i uzupełnij załogę istniejących stacji mediów ZANIM postawisz duplikaty (bez przerywania budowy brakujących stacji!)
  for (const b of ownedBuildings) {
    const isUtilBld =
      BUILDING_DEFINITIONS[b.type].category === 'energy' ||
      BUILDING_DEFINITIONS[b.type].category === 'waste' ||
      b.type === 'waterPlant';
    if (!isUtilBld) continue;
    if (b.damagePercent > 15 && ai.cash > 25_000) {
      repairBuilding(b, ai);
    }
    if (b.workers < b.maxWorkers && ai.cash > 20_000) {
      hireWorkersForBuilding(b, ai, Math.min(4, b.maxWorkers - b.workers));
    }
  }

  const plotsByCoord = new Map<string, Plot>();
  for (const p of state.plots) plotsByCoord.set(`${p.gridX}_${p.gridY}`, p);

  const getDeficitClustersForKind = (kind: 'elec' | 'water' | 'sewage' | 'waste'): Set<number> => {
    if (kind === 'elec') return elecDeficitClusters;
    if (kind === 'water') return waterDeficitClusters;
    if (kind === 'sewage') return sewageDeficitClusters;
    return wasteDeficitClusters;
  };

  // Zbuduj grupy według pilności: realne deficyty (globalne lub lokalne klastry < 0) przed buforami; prąd pierwszy
  const kindOrder: Record<'elec' | 'water' | 'sewage' | 'waste', number> = {
    elec: 0,
    water: 1,
    waste: 2,
    sewage: 3,
  };
  const utilityGroups: { activeDeficit: boolean; kind: 'elec' | 'water' | 'sewage' | 'waste'; list: BuildingType[] }[] = [];
  if (needElec) {
    utilityGroups.push({
      activeDeficit: util.electricityNet < 0 || elecDeficitClusters.size > 0,
      kind: 'elec',
      list: elecCandidates,
    });
  }
  if (needWater) {
    utilityGroups.push({
      activeDeficit: util.waterNet < 0 || waterDeficitClusters.size > 0,
      kind: 'water',
      list: waterCandidates,
    });
  }
  if (needSewage) {
    utilityGroups.push({
      activeDeficit: util.sewageNet < 0 || sewageDeficitClusters.size > 0,
      kind: 'sewage',
      list: sewageCandidates,
    });
  }
  if (needWaste) {
    utilityGroups.push({
      activeDeficit: util.wasteNet < 0 || wasteDeficitClusters.size > 0,
      kind: 'waste',
      list: wasteCandidates,
    });
  }
  utilityGroups.sort(
    (a, b) => Number(b.activeDeficit) - Number(a.activeDeficit) || kindOrder[a.kind] - kindOrder[b.kind]
  );

  // Jeśli mamy tylko ostrzeżenie o zapasie (bez ujemnego salda), najpierw spróbuj ulepszyć istniejący obiekt
  if (!hasDeficit) {
    for (const grp of utilityGroups) {
      for (const b of ownedBuildings) {
        if (b.activeResearchId) continue;
        for (const n of b.techTree) {
          if (n.status !== 'available' || ai.cash < n.cost + 25_000) continue;
          const matchesKind =
            (grp.kind === 'elec' && BUILDING_DEFINITIONS[b.type].electricityUsage < 0 && n.effects.productionBonus) ||
            (grp.kind === 'water' && b.type === 'waterPlant' && n.effects.productionBonus) ||
            (grp.kind === 'sewage' && n.effects.sewageTreatmentBonus) ||
            (grp.kind === 'waste' && n.effects.wasteProcessingBonus);
          if (!matchesKind) continue;
          if (startBuildingTechResearch(b, ai, n.id, state).ok) {
            return true;
          }
        }
      }
    }
  }

  const plotTouchesDeficitCluster = (p: Plot, deficitClusters: Set<number>): boolean => {
    if (deficitClusters.size === 0) return false;
    const directCid = clusters.clusterByPlotId.get(p.id) ?? 0;
    if (directCid > 0 && deficitClusters.has(directCid)) return true;
    for (const [dx, dy] of ROAD_DIRS) {
      const nb = plotsByCoord.get(`${p.gridX + dx}_${p.gridY + dy}`);
      if (!nb) continue;
      const nbCid = clusters.clusterByPlotId.get(nb.id) ?? 0;
      if (nbCid > 0 && deficitClusters.has(nbCid)) return true;
    }
    return false;
  };

  // Działki puste posortowane inteligentnie (najwyższy priorytet: klaster z deficytem + dostęp do drogi/HQ!)
  const rankPlotForUtility = (p: Plot, bType: BuildingType): number => {
    let s = 0;
    const isWasteOrSewage = BUILDING_DEFINITIONS[bType].category === 'waste';
    const isPower = BUILDING_DEFINITIONS[bType].electricityUsage < 0;
    if (isPower && plotTouchesDeficitCluster(p, elecDeficitClusters)) s += 380;
    if ((bType === 'waterPlant' || bType === 'closedLoopSewagePlant') && plotTouchesDeficitCluster(p, waterDeficitClusters)) s += 380;
    if (isWasteOrSewage && (plotTouchesDeficitCluster(p, sewageDeficitClusters) || plotTouchesDeficitCluster(p, wasteDeficitClusters))) {
      s += 340;
    }
    if (hasRoadAccess(state, p, ai.id)) s += 110;
    else if (p.distanceToRoad <= 1) s += 45;
    else if (p.distanceToRoad <= 2) s += 20;
    if (isWasteOrSewage && (p.terrain === 'forest' || p.terrain === 'desert')) s += 45;
    if (bType === 'waterPlant' && (p.terrain === 'coastal' || p.terrain === 'grass')) s += 30;
    if ((bType === 'solarFarm' || bType === 'windFarm') && (p.terrain === 'desert' || p.terrain === 'grass' || p.terrain === 'coastal')) {
      s += 25;
    }
    if (p.terrain === 'urban' && (isWasteOrSewage || bType === 'coalPowerPlant')) s -= 35;
    if ((bType === 'wasteLandfill' || bType === 'wasteIncinerator') && hasNearbySensitivePlot(state.plots, p)) {
      s -= 40;
    }
    return s;
  };

  const maxUtilOwned = state.settings.mapSize >= 28 ? 88 : 48;

  for (const grp of utilityGroups) {
    // Gdy brakuje prądu, nie spamuj kolejnych pomp wody/oczyszczalni (one stoją przez blackout), ale spalarnia śmieci (+42 MW) wręcz pomaga!
    if ((grp.kind === 'water' || grp.kind === 'sewage') && util.electricityNet < -4 && ownedBuildings.length >= 2) {
      continue;
    }

    const grpDeficitClusters = getDeficitClustersForKind(grp.kind);
    const localOnlyDeficit =
      grpDeficitClusters.size > 0 &&
      ((grp.kind === 'elec' && util.electricityNet >= 0) ||
        (grp.kind === 'water' && util.waterNet >= 0) ||
        (grp.kind === 'sewage' && util.sewageNet >= 0) ||
        (grp.kind === 'waste' && util.wasteNet >= 0));

    for (const bType of grp.list) {
      const def = BUILDING_DEFINITIONS[bType];
      if (def.requiredCorpLevel > ai.corporationLevel) continue;
      if (state.settings.weeklyBannedBuildings?.includes(bType)) continue;
      if (state.settings.scenarioId === 'green_transition' && state.greenTransitionEntered && bType === 'wasteIncinerator') {
        continue;
      }
      if (bType === 'gasPowerPlant') {
        if (!hasOwnOilOrFuel && ai.cash < 550_000) continue;
      }
      if (bType === 'coalPowerPlant') {
        if (isEco || state.greenTransitionEntered) continue;
        const hasCoalMine = ownedBuildings.some((b) => b.type === 'coalMine');
        const windSolarBanned =
          state.settings.weeklyBannedBuildings?.includes('windFarm') &&
          state.settings.weeklyBannedBuildings?.includes('solarFarm');
        if (!windSolarBanned && !hasCoalMine && ai.cash < 850_000) continue;
      }

      // 1) Najpierw własna pusta działka pasująca terenem i warunkami (przy lokalnym deficycie: wyłącznie w/przy brakującym klastrze!)
      const ranked = [...emptyOwned]
        .filter((p) => !localOnlyDeficit || plotTouchesDeficitCluster(p, grpDeficitClusters))
        .sort((a, b) => rankPlotForUtility(b, bType) - rankPlotForUtility(a, bType));
      for (const plot of ranked) {
        if (checkBuildingRequirements(ai, plot, bType, state).ok) {
          if (constructBuildingOnPlot(state, ai, plot, bType).ok) {
            return true;
          }
        }
      }

      // 2) Jeśli brak odpowiedniej własnej działki → kup działkę (priorytet: granicząca z brakującym klastrem lub drogą/HQ)
      if (ownedPlots.length < maxUtilOwned) {
        const buildCost = getBuildingConstructionCost(bType, state, ai);
        const matchingPlots = state.plots
          .filter(
            (p) =>
              p.purchasable &&
              p.ownerId === null &&
              p.terrain !== 'water' &&
              (p.irradiatedTicks ?? 0) <= 0 &&
              def.requiredTerrain.includes(p.terrain) &&
              (!localOnlyDeficit || plotTouchesDeficitCluster(p, grpDeficitClusters)) &&
              ai.cash >= getPlotPurchasePrice(p, ai, state) + buildCost + (hasRoadAccess(state, p, ai.id) ? 0 : 35_000)
          )
          .sort((a, b) => {
            const adjOwnA = ownedPlots.some((op) => Math.abs(op.gridX - a.gridX) + Math.abs(op.gridY - a.gridY) <= 2) ? 24 : 0;
            const adjOwnB = ownedPlots.some((op) => Math.abs(op.gridX - b.gridX) + Math.abs(op.gridY - b.gridY) <= 2) ? 24 : 0;
            const scoreA = rankPlotForUtility(a, bType) + adjOwnA - getPlotPurchasePrice(a, ai, state) / 8_000;
            const scoreB = rankPlotForUtility(b, bType) + adjOwnB - getPlotPurchasePrice(b, ai, state) / 8_000;
            return scoreB - scoreA;
          });

        const buyCand = matchingPlots[0];
        if (buyCand) {
          const bought = buyPlotForPlayer(state, ai, buyCand);
          if (bought.ok) {
            if (checkBuildingRequirements(ai, buyCand, bType, state).ok) {
              if (constructBuildingOnPlot(state, ai, buyCand, bType).ok) {
                return true;
              }
            }
            return true;
          }
        }
      }
    }
  }

  // Fallback przy deficycie bez środków na nową działkę/budynek: ulepsz istniejący obiekt mediów jeśli możliwy
  if (hasDeficit) {
    for (const grp of utilityGroups) {
      for (const b of ownedBuildings) {
        if (b.activeResearchId) continue;
        for (const n of b.techTree) {
          if (n.status !== 'available' || ai.cash < n.cost + 20_000) continue;
          const matchesKind =
            (grp.kind === 'elec' && BUILDING_DEFINITIONS[b.type].electricityUsage < 0 && n.effects.productionBonus) ||
            (grp.kind === 'water' && b.type === 'waterPlant' && n.effects.productionBonus) ||
            (grp.kind === 'sewage' && n.effects.sewageTreatmentBonus) ||
            (grp.kind === 'waste' && n.effects.wasteProcessingBonus);
          if (matchesKind && startBuildingTechResearch(b, ai, n.id, state).ok) {
            return true;
          }
        }
      }
    }
  }

  // Blokuj inne inwestycje dopóki istnieje aktywny deficyt mediów
  return hasDeficit;
}

function hasNearbySensitivePlot(allPlots: Plot[], center: Plot): boolean {
  for (const p of allPlots) {
    if (!p.building) continue;
    if (!RESIDENTIAL_OR_TOURISM_TYPES.has(p.building.type)) continue;
    const d = Math.hypot(p.gridX - center.gridX, p.gridY - center.gridY);
    if (d <= 2.4) return true;
  }
  return false;
}

function maintainAndUpgradeBuildings(
  state: GameState,
  ai: Player,
  difficulty: number,
  ownedBuildings: Building[],
  cashReserve: number,
  allowDiscretionarySpend: boolean
): void {
  const repairThreshold = difficulty >= 3 ? 28 : 42;
  const targetSkill = difficulty === 1 ? 52 : difficulty === 2 ? 66 : difficulty === 3 ? 75 : 82;
  const maxUpgradeTier = difficulty === 1 ? 2 : difficulty === 2 ? 3 : 4;

  const hasProfitGen = ownedBuildings.some(
    (ob) => ob.category !== 'energy' && ob.category !== 'waste' && ob.type !== 'waterPlant' && ob.type !== 'corporateHQ'
  );
  const upgradeReserve = cashReserve + (hasProfitGen ? 0 : 220_000);
  const upgradeCandidates: { building: Building; node: BuildingTechNode; score: number }[] = [];

  for (const b of ownedBuildings) {
    if (!b.autoRepairEnabled) {
      b.autoRepairEnabled = true;
      b.autoRepairThreshold = 38;
    }
    if (b.damagePercent > repairThreshold && ai.cash > 45_000) {
      repairBuilding(b, ai);
    }

    // Zatrudnianie brakującej załogi (zawsze priorytetowe dla stacji mediów i rentownych obiektów)
    if (b.workers < b.maxWorkers && ai.cash > 25_000) {
      const targetRatio = b.netProfit >= 0 || b.category === 'energy' || b.category === 'waste' || b.workers < 2 ? 1.0 : 0.75;
      const targetWorkers = Math.ceil(b.maxWorkers * targetRatio);
      if (b.workers < targetWorkers) {
        hireWorkersForBuilding(b, ai, Math.min(4, targetWorkers - b.workers));
      }
    }

    if (!allowDiscretionarySpend) continue;

    // Szkolenie kadr jeśli poniżej celu
    if (b.workerSkill < targetSkill && ai.cash > cashReserve + 30_000 && Math.random() < 0.35) {
      trainBuildingWorkers(b, ai);
    }

    // Dodatkowe pojazdy dla stacji służb na wyższych poziomach
    if (
      difficulty >= 2 &&
      (b.type === 'fireStation' || b.type === 'hazmatBase' || b.type === 'policeStation' || b.type === 'hospital') &&
      (b.fleetSize ?? 2) < 4 &&
      ai.cash > cashReserve + 220_000
    ) {
      buyServiceVehicleForPlayer(b, ai);
    }

    // Ocena najkorzystniejszego ulepszenia wewnętrznego (Utility AI)
    if (!b.activeResearchId && (b.netProfit > 0 || b.category === 'energy' || b.category === 'waste' || b.category === 'education')) {
      for (const node of b.techTree) {
        if (node.status !== 'available') continue;
        if (node.tier > maxUpgradeTier) continue;
        if (ai.cash - node.cost < upgradeReserve) continue;

        let score = 0;
        if (node.effects.productionBonus) score += node.effects.productionBonus * 90;
        if (node.effects.costReduction) score += node.effects.costReduction * 60;
        if (node.effects.cleanFilter && SMOG_EMITTING_TYPES.has(b.type)) score += 40;
        if (node.effects.helicopterDispatch) score += 45;
        if (node.effects.sewageTreatmentBonus) score += node.effects.sewageTreatmentBonus * 50;
        if (node.effects.wasteProcessingBonus) score += node.effects.wasteProcessingBonus * 50;
        if (node.tier === 4 || node.isFlagship) score += 35;
        score += Math.min(40, Math.max(0, b.netProfit / 400));
        score -= node.cost / 65_000;

        if (score > 10) {
          upgradeCandidates.push({ building: b, node, score });
        }
      }
    }
  }

  upgradeCandidates.sort((a, b) => b.score - a.score);
  for (const cand of upgradeCandidates) {
    if (startBuildingTechResearch(cand.building, ai, cand.node.id, state).ok) {
      break;
    }
  }
}

function researchTechAndSkills(
  state: GameState,
  ai: Player,
  difficulty: number,
  strategy: AIStrategy,
  cashReserve: number
): void {
  // 1. Globalne Drzewko Technologii R&D
  const activeGlobal = Object.values(ai.globalTech).some((g) => g.status === 'researching');
  if (!activeGlobal) {
    const scoredTech = state.globalTechDefs
      .filter(
        (def) =>
          ai.globalTech[def.id]?.status === 'available' &&
          ai.researchPoints >= def.cost &&
          ai.cash - def.moneyCost >= Math.max(30_000, cashReserve * 0.7)
      )
      .map((def) => {
        let score = 15;
        if (def.id === 'ind_geology') score += 50;
        if (def.id === 'mod_grid' || def.id === 'mod_hydro_shield') score += 28;
        if (def.id === 'saf_fire_prevention' || def.id === 'saf_hazmat') score += 26;
        if (def.id === 'ind_recycling') score += ai.archetype === 'eco_innovator' ? 45 : 22;
        if (strategy === 'industrialist' && def.branch === 'industrial') score += 25;
        if (strategy === 'energyMagnate' && def.branch === 'modern') score += 25;
        if (strategy === 'supplyChain' && (def.branch === 'logistics' || def.branch === 'industrial')) score += 22;
        if (strategy === 'military' && def.branch === 'military') score += 25;
        score -= def.cost * 0.05;
        return { def, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = scoredTech[0]?.def;
    if (best) {
      ai.cash -= best.moneyCost;
      ai.researchPoints -= best.cost;
      ai.globalTech[best.id] = { status: 'researching', progress: 0 };
    }
  }

  // 2. Drzewko Umiejętności Prezesa (Skill Points)
  if (difficulty >= 2 && ai.skillPoints > 0) {
    const totalInf = ai.influence.financial + ai.influence.military + ai.influence.social;
    const doneTechCount = Object.values(ai.globalTech).filter((t) => t.status === 'done').length;
    const availSkills = state.entrepreneurSkillDefs
      .filter((sk) => {
        if (ai.entrepreneurSkills[sk.id] !== 'available') return false;
        if (ai.skillPoints < sk.skillPointCost) return false;
        if (ai.cash - sk.cashCost < cashReserve) return false;
        if (sk.requiredCorpLevel && ai.corporationLevel < sk.requiredCorpLevel) return false;
        if (sk.requiredInfluenceScore && totalInf < sk.requiredInfluenceScore) return false;
        if (sk.requiredGlobalTechCount && doneTechCount < sk.requiredGlobalTechCount) return false;
        return true;
      })
      .map((sk) => {
        let score = 20;
        if (sk.modifiers.profitBonus) score += sk.modifiers.profitBonus * 140;
        if (sk.modifiers.sellPriceBonus) score += sk.modifiers.sellPriceBonus * 130;
        if (sk.modifiers.buyPriceDiscount) score += sk.modifiers.buyPriceDiscount * 120;
        if (sk.modifiers.researchDiscount) score += sk.modifiers.researchDiscount * 90;
        if (sk.modifiers.researchSpeedBonus) score += sk.modifiers.researchSpeedBonus * 90;
        if (sk.modifiers.taxReduction) score += sk.modifiers.taxReduction * 150;
        if (sk.modifiers.warehouseDiscount) score += sk.modifiers.warehouseDiscount * 80;
        if (sk.modifiers.safetyDiscount) score += sk.modifiers.safetyDiscount * 70;
        if (sk.modifiers.influencePowerBonus) score += sk.modifiers.influencePowerBonus * 90;
        return { sk, score };
      })
      .sort((a, b) => b.score - a.score);

    const picked = availSkills[0]?.sk;
    if (picked) {
      ai.skillPoints -= picked.skillPointCost;
      ai.cash -= picked.cashCost;
      ai.entrepreneurSkills[picked.id] = 'done';
      if (picked.modifiers.socialInfluenceStart) ai.influence.social += picked.modifiers.socialInfluenceStart;
      if (picked.modifiers.militaryInfluenceBonus) ai.militaryPower += picked.modifiers.militaryInfluenceBonus;
      for (const other of state.entrepreneurSkillDefs) {
        if (
          ai.entrepreneurSkills[other.id] === 'locked' &&
          other.prerequisites.every((pid) => ai.entrepreneurSkills[pid] === 'done')
        ) {
          ai.entrepreneurSkills[other.id] = 'available';
        }
      }
    }
  }
}

const ROAD_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function tryBridgeSeparatedClusters(
  state: GameState,
  ai: Player,
  ownedPlots: Plot[],
  cashReserve: number,
  allowDeficitRescue: boolean
): boolean {
  const minCashForOneBridge = allowDeficitRescue
    ? GAME_CONFIG.bridgeCost + 25_000
    : cashReserve + GAME_CONFIG.bridgeCost + 45_000;
  if (ai.cash < minCashForOneBridge) return false;

  const clusters = computeNetworkClusters(state);
  const ownedCids = new Set<number>();
  for (const op of ownedPlots) {
    const cid = clusters.clusterByPlotId.get(op.id) ?? 0;
    if (cid > 0) ownedCids.add(cid);
  }
  if (!allowDeficitRescue && ownedCids.size < 2) return false;

  const byCoord = new Map<string, Plot>();
  for (const p of state.plots) byCoord.set(`${p.gridX}_${p.gridY}`, p);

  for (const requireOwnedTarget of [true, false]) {
    if (!requireOwnedTarget && !allowDeficitRescue) break;
    for (const op of ownedPlots) {
      const c1 = clusters.clusterByPlotId.get(op.id) ?? 0;
      if (c1 === 0) continue;
      for (const [dx, dy] of ROAD_DIRS) {
        const w1 = byCoord.get(`${op.gridX + dx}_${op.gridY + dy}`);
        if (!w1 || w1.terrain !== 'water' || w1.hasRoad || (w1.irradiatedTicks ?? 0) > 0) continue;
        const b1 = byCoord.get(`${op.gridX + dx * 2}_${op.gridY + dy * 2}`);
        if (b1 && b1.terrain !== 'water') {
          const c2 = clusters.clusterByPlotId.get(b1.id) ?? 0;
          const validTarget =
            c2 > 0 &&
            c2 !== c1 &&
            (requireOwnedTarget ? ownedCids.has(c2) : ownedCids.has(c2) || b1.terrain === 'urban');
          if (validTarget && buildPlayerRoadOnPlot(state, ai, w1, 'bridge').ok) {
            return true;
          }
        } else if (b1 && b1.terrain === 'water' && !b1.hasRoad && (b1.irradiatedTicks ?? 0) <= 0) {
          const b2 = byCoord.get(`${op.gridX + dx * 3}_${op.gridY + dy * 3}`);
          const c2 = b2 ? clusters.clusterByPlotId.get(b2.id) ?? 0 : 0;
          const validTarget =
            c2 > 0 &&
            c2 !== c1 &&
            (requireOwnedTarget ? ownedCids.has(c2) : ownedCids.has(c2) || b2?.terrain === 'urban');
          const minCashTwo = allowDeficitRescue
            ? GAME_CONFIG.bridgeCost * 2 + 25_000
            : cashReserve + GAME_CONFIG.bridgeCost * 2 + 45_000;
          if (validTarget && ai.cash >= minCashTwo) {
            if (buildPlayerRoadOnPlot(state, ai, w1, 'bridge').ok) {
              buildPlayerRoadOnPlot(state, ai, b1, 'bridge');
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

function findRoadPathFromDisconnectedPlot(
  state: GameState,
  targetPlot: Plot,
  aiId: string,
  allowWaterBridges = false
): Plot[] {
  const byCoord = new Map<string, Plot>();
  let anyPassableOrHQ = false;
  for (const p of state.plots) {
    byCoord.set(`${p.gridX}_${p.gridY}`, p);
    if (
      isRoadPassableFor(p, aiId, state) ||
      (p.ownerId === aiId && p.building && !p.building.destroyedRuins && p.building.type === 'corporateHQ')
    ) {
      anyPassableOrHQ = true;
    }
  }

  // Gdy na mapie nie ma jeszcze żadnej drogi ani HQ — postaw drogę bezpośrednio obok obiektu
  if (!anyPassableOrHQ) {
    const directCandidates: Plot[] = [];
    for (const [dx, dy] of ROAD_DIRS) {
      const nb = byCoord.get(`${targetPlot.gridX + dx}_${targetPlot.gridY + dy}`);
      if (
        nb &&
        nb.terrain !== 'water' &&
        (nb.irradiatedTicks ?? 0) <= 0 &&
        !nb.building &&
        (nb.ownerId === aiId || (nb.ownerId === null && nb.purchasable))
      ) {
        directCandidates.push(nb);
      }
    }
    directCandidates.sort((a, b) => (a.ownerId === aiId ? -1 : b.ownerId === aiId ? 1 : a.price - b.price));
    return directCandidates[0] ? [directCandidates[0]] : [];
  }

  // BFS od sąsiednich pól budynku do najbliższej drogi lub HQ (obsługuje również krótkie mosty przez wodę!)
  interface SearchNode {
    plot: Plot;
    cost: number;
    waterSteps: number;
  }
  const dist = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const plotById = new Map<string, Plot>();
  const queue: SearchNode[] = [];

  for (const [dx, dy] of ROAD_DIRS) {
    const nb = byCoord.get(`${targetPlot.gridX + dx}_${targetPlot.gridY + dy}`);
    if (!nb || (nb.irradiatedTicks ?? 0) > 0) continue;
    const isWater = nb.terrain === 'water';
    if (isWater && (!allowWaterBridges || nb.hasRoad)) continue;
    plotById.set(nb.id, nb);
    if (isRoadPassableFor(nb, aiId, state) || (nb.ownerId === aiId && nb.building?.type === 'corporateHQ')) {
      return [];
    }
    if (nb.building) continue;
    if (!isWater && nb.ownerId !== aiId && (nb.ownerId !== null || !nb.purchasable)) continue;
    const stepCost = isWater
      ? 5.0 + GAME_CONFIG.bridgeCost / 45_000
      : nb.ownerId === aiId
        ? 1
        : 2.2 + nb.price / 55_000;
    dist.set(nb.id, stepCost);
    parent.set(nb.id, null);
    queue.push({ plot: nb, cost: stepCost, waterSteps: isWater ? 1 : 0 });
  }

  let bestAnchorId: string | null = null;
  let bestAnchorCost = Infinity;

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const cur = queue.shift()!;
    if (cur.cost >= bestAnchorCost) break;

    for (const [dx, dy] of ROAD_DIRS) {
      const nb = byCoord.get(`${cur.plot.gridX + dx}_${cur.plot.gridY + dy}`);
      if (!nb || (nb.irradiatedTicks ?? 0) > 0) continue;
      plotById.set(nb.id, nb);

      if (
        isRoadPassableFor(nb, aiId, state) ||
        (nb.ownerId === aiId && nb.building && !nb.building.destroyedRuins && nb.building.type === 'corporateHQ')
      ) {
        if (cur.cost < bestAnchorCost) {
          bestAnchorCost = cur.cost;
          bestAnchorId = cur.plot.id;
        }
        continue;
      }

      const isWater = nb.terrain === 'water';
      const nextWaterSteps = cur.waterSteps + (isWater ? 1 : 0);
      if (isWater && (!allowWaterBridges || nb.hasRoad || nextWaterSteps > 3)) continue;
      if (nb.building) continue;
      if (!isWater && nb.ownerId !== aiId && (nb.ownerId !== null || !nb.purchasable)) continue;

      const stepCost = isWater
        ? 5.0 + GAME_CONFIG.bridgeCost / 45_000
        : nb.ownerId === aiId
          ? 1
          : 2.2 + nb.price / 55_000;
      const nextCost = cur.cost + stepCost;
      if (nextCost > 26) continue;
      const prevBest = dist.get(nb.id);
      if (prevBest === undefined || nextCost < prevBest) {
        dist.set(nb.id, nextCost);
        parent.set(nb.id, cur.plot.id);
        queue.push({ plot: nb, cost: nextCost, waterSteps: nextWaterSteps });
      }
    }
  }

  if (bestAnchorId) {
    const chain: Plot[] = [];
    let curId: string | null = bestAnchorId;
    while (curId !== null) {
      const p = plotById.get(curId);
      if (p) chain.unshift(p);
      curId = parent.get(curId) ?? null;
    }
    return chain;
  }

  // Fallback awaryjny: jeśli brak dojścia przez tereny rywali/wodę, postaw co najmniej 1 odcinek drogi tuż przy obiekcie
  for (const [dx, dy] of ROAD_DIRS) {
    const nb = byCoord.get(`${targetPlot.gridX + dx}_${targetPlot.gridY + dy}`);
    if (
      nb &&
      nb.terrain !== 'water' &&
      (nb.irradiatedTicks ?? 0) <= 0 &&
      !nb.building &&
      (nb.ownerId === aiId || (nb.ownerId === null && nb.purchasable))
    ) {
      return [nb];
    }
  }
  return [];
}

function ensureContinuousRoads(
  state: GameState,
  ai: Player,
  difficulty: number,
  ownedPlots: Plot[],
  emptyOwned: Plot[],
  cashReserve: number,
  isPriorityPass = false
): void {
  const disconnectedPlots = ownedPlots.filter(
    (p) =>
      p.building &&
      !p.building.destroyedRuins &&
      !isRoadExemptBuilding(p.building.type) &&
      !hasRoadAccess(state, p, ai.id)
  );

  // Połóż do 3 odcinków drogi łączących odizolowane zakłady z najbliższą drogą lub HQ (kupuje działki przelotowe w razie potrzeby!)
  if (disconnectedPlots.length > 0) {
    // Priorytet: najpierw odblokuj elektrownie, stacje wody/ścieków/odpadów i kopalnie
    const sortedTargets = [...disconnectedPlots].sort((a, b) => {
      const bA = a.building!;
      const bB = b.building!;
      const utilA = bA.category === 'energy' || bA.category === 'waste' || bA.type === 'waterPlant' ? 1 : 0;
      const utilB = bB.category === 'energy' || bB.category === 'waste' || bB.type === 'waterPlant' ? 1 : 0;
      return utilB - utilA;
    });

    let segmentsBuilt = 0;
    const allowWaterBridges = ai.cash > 220_000;
    for (const target of sortedTargets.slice(0, 2)) {
      if (segmentsBuilt >= 3) break;
      const path = findRoadPathFromDisconnectedPlot(state, target, ai.id, allowWaterBridges);
      for (const stepPlot of path) {
        if (segmentsBuilt >= 3) break;
        if (stepPlot.hasRoad) continue;

        const isBridgeStep = stepPlot.terrain === 'water';
        const wantHighway =
          !isBridgeStep &&
          !isPriorityPass &&
          difficulty >= 3 &&
          ai.cash - 85_000 >= cashReserve &&
          (target.building?.category === 'mining' || target.building?.category === 'processing');
        const roadClass: 'local' | 'highway' | 'bridge' = isBridgeStep
          ? 'bridge'
          : wantHighway
            ? 'highway'
            : 'local';
        const roadCost = getRoadBuildCostForPlot(state, ai, stepPlot, roadClass);
        const totalStepCost =
          (!isBridgeStep && stepPlot.ownerId === null ? getPlotPurchasePrice(stepPlot, ai, state) : 0) + roadCost;

        if (
          ai.cash < totalStepCost &&
          !state.settings.mutators?.noLoans &&
          ai.loans.length < 2 &&
          ai.netWorth > 320_000
        ) {
          takeBankLoan(state, ai, 250_000, 12);
        }
        if (ai.cash < totalStepCost) break;

        if (!isBridgeStep && stepPlot.ownerId === null) {
          const bought = buyPlotForPlayer(state, ai, stepPlot);
          if (!bought.ok) break;
        }
        const r = buildPlayerRoadOnPlot(state, ai, stepPlot, roadClass);
        if (!r.ok) break;
        if (roadClass === 'highway') {
          stepPlot.tollRate = difficulty >= 4 ? 'high' : 'standard';
        }
        segmentsBuilt++;
      }
    }
    if (segmentsBuilt > 0) return;
  }

  // Jeśli wyspy/klastry gracza są rozdzielone wąską rzeką (1-2 pola wody), wybuduj Most Drogowy!
  if (!isPriorityPass && tryBridgeSeparatedClusters(state, ai, ownedPlots, cashReserve, false)) {
    return;
  }

  if (isPriorityPass) return;

  // Wybuduj startową arterię drogową wokół HQ / obiektów (żeby odblokować kolejne działki przylegające do drogi)
  const ownedRoadsCount = ownedPlots.filter((p) => p.hasRoad).length;
  const activeBuildingsCount = ownedPlots.filter((p) => p.building && !p.building.destroyedRuins).length;
  if (ownedRoadsCount < 2 && activeBuildingsCount >= 2 && ai.cash > 45_000) {
    const anchor =
      ownedPlots.find((p) => p.building?.type === 'corporateHQ' && !p.building.destroyedRuins) ??
      ownedPlots.find((p) => p.building && !p.building.destroyedRuins);
    if (anchor) {
      const roadCandidates: Plot[] = [];
      for (const ep of emptyOwned) {
        if (Math.abs(ep.gridX - anchor.gridX) + Math.abs(ep.gridY - anchor.gridY) <= 2) {
          roadCandidates.push(ep);
        }
      }
      if (roadCandidates.length === 0 && ownedPlots.length < 34) {
        for (const [dx, dy] of ROAD_DIRS) {
          const nb = state.plots.find((p) => p.gridX === anchor.gridX + dx && p.gridY === anchor.gridY + dy);
          if (
            nb &&
            nb.terrain !== 'water' &&
            (nb.irradiatedTicks ?? 0) <= 0 &&
            !nb.building &&
            !nb.hasRoad &&
            ((nb.ownerId === null && nb.purchasable) || nb.ownerId === ai.id)
          ) {
            roadCandidates.push(nb);
          }
        }
      }
      roadCandidates.sort((a, b) =>
        a.ownerId === ai.id
          ? -1
          : b.ownerId === ai.id
            ? 1
            : getPlotPurchasePrice(a, ai, state) - getPlotPurchasePrice(b, ai, state)
      );
      const starter = roadCandidates[0];
      if (starter) {
        const roadCost = getRoadBuildCostForPlot(state, ai, starter, 'local');
        const totalCost = (starter.ownerId === null ? getPlotPurchasePrice(starter, ai, state) : 0) + roadCost;
        if (ai.cash >= totalCost + Math.min(40_000, cashReserve * 0.4)) {
          if (starter.ownerId !== ai.id) {
            buyPlotForPlayer(state, ai, starter);
          }
          if (starter.ownerId === ai.id) {
            buildPlayerRoadOnPlot(state, ai, starter, 'local');
          }
        }
      }
    }
  }

  // Na trudniejszym AI ulepsza kluczowe własne drogi przy kopalniach/fabrykach do autostrad
  if (difficulty >= 3 && ai.cash > cashReserve + 480_000) {
    const upgradeRoad = ownedPlots.find(
      (p) =>
        p.hasRoad &&
        p.roadType === 'local' &&
        ownedPlots.some(
          (q) =>
            q.building &&
            (q.building.category === 'mining' || q.building.category === 'processing') &&
            Math.hypot(q.gridX - p.gridX, q.gridY - p.gridY) <= 2.5
        )
    );
    if (upgradeRoad) {
      const r = buildPlayerRoadOnPlot(state, ai, upgradeRoad, 'highway');
      if (r.ok) {
        upgradeRoad.tollRate = difficulty >= 4 ? 'high' : 'standard';
      }
    }
  }
}

function runGeologyAndExpansion(
  state: GameState,
  ai: Player,
  difficulty: number,
  strategy: AIStrategy,
  ownedPlots: Plot[],
  emptyOwned: Plot[],
  cashReserve: number
): void {
  // Najpierw badania geologiczne (georadar 3x3 jeśli dostępny, albo pojedyncze odwierty)
  if (ai.globalTech['ind_geology']?.status === 'done' && difficulty >= 2 && ai.cash > cashReserve + 22_000) {
    const radarCenter = ownedPlots.find(
      (p) =>
        p.terrain !== 'water' &&
        !p.hasRoad &&
        state.plots.filter(
          (n) =>
            Math.abs(n.gridX - p.gridX) <= 1 &&
            Math.abs(n.gridY - p.gridY) <= 1 &&
            n.terrain !== 'water' &&
            (n.ownerId === null || n.ownerId === ai.id) &&
            !hasPlayerSurveyedPlot(n, ai.id)
        ).length >= 3
    );
    if (radarCenter) {
      surveyAreaForPlayer(state, ai, radarCenter);
    }
  }

  const maxSurveys = difficulty >= 3 ? 2 : 1;
  let surveyedCount = 0;
  for (const p of ownedPlots) {
    if (surveyedCount >= maxSurveys) break;
    if (
      !p.building &&
      !p.hasRoad &&
      p.terrain !== 'water' &&
      !hasPlayerSurveyedPlot(p, ai.id) &&
      ai.cash > 16_000
    ) {
      const sr = surveyPlotForPlayer(state, ai, p);
      if (sr.ok) surveyedCount++;
    }
  }

  // Zewnętrzny odwiert na perspektywicznych sąsiednich działkach przed kupnem (Normalny+)
  if (surveyedCount === 0 && difficulty >= 2 && ai.cash > cashReserve + 40_000) {
    const prospect = state.plots.find(
      (p) =>
        p.purchasable &&
        p.ownerId === null &&
        (p.irradiatedTicks ?? 0) <= 0 &&
        !hasPlayerSurveyedPlot(p, ai.id) &&
        (p.terrain === 'mountain' || p.terrain === 'desert' || p.terrain === 'coastal')
    );
    if (prospect) {
      surveyPlotForPlayer(state, ai, prospect);
    }
  }

  // Zakup najbardziej perspektywicznej działki jeśli potrzebujemy miejsca lub złoża
  const maxPlots = difficulty === 1 ? 12 : difficulty === 2 ? 18 : difficulty === 3 ? 24 : 32;
  const hasRichUnbuiltDeposit = emptyOwned.some(
    (p) => hasPlayerDiscoveredPlot(p, ai.id, ai, state) && p.deposits.length > 0
  );

  if (
    ownedPlots.length < maxPlots &&
    (emptyOwned.length < 2 || !hasRichUnbuiltDeposit) &&
    ai.cash > cashReserve + 90_000
  ) {
    const candidate = pickBestPlotForAI(state, ai, difficulty, strategy, ownedPlots, cashReserve);
    if (candidate) {
      const res = buyPlotForPlayer(state, ai, candidate);
      if (
        res.ok &&
        !hasPlayerSurveyedPlot(candidate, ai.id) &&
        ai.cash > 18_000 &&
        candidate.terrain !== 'urban'
      ) {
        surveyPlotForPlayer(state, ai, candidate);
      }
    }
  }
}

function pickBestPlotForAI(
  state: GameState,
  ai: Player,
  difficulty: number,
  strategy: AIStrategy,
  ownedPlots: Plot[],
  cashReserve: number
): Plot | null {
  const maxSpend = Math.max(0, ai.cash - cashReserve);
  const candidates = state.plots.filter(
    (p) =>
      p.purchasable &&
      p.ownerId === null &&
      p.terrain !== 'water' &&
      (p.irradiatedTicks ?? 0) <= 0 &&
      getPlotPurchasePrice(p, ai, state) <= maxSpend * 0.72
  );
  if (candidates.length === 0) return null;

  let best: Plot | null = null;
  let bestScore = -9999;

  const step = candidates.length > 140 ? Math.floor(candidates.length / 140) : 1;
  for (let i = 0; i < candidates.length; i += step) {
    const p = candidates[i];
    let score = 0;

    const roadAdjacent = hasRoadAccess(state, p, ai.id);
    if (roadAdjacent) score += 85;
    else if (p.distanceToRoad <= 1) score += 38;
    else if (p.distanceToRoad <= 2) score += 16;
    else score -= 18;
    if (p.hasElectricity) score += 12;
    if (p.hasWater) score += 10;

    // Odkryte złoża surowców (zwłaszcza cenne jak złoto, diamenty, uran, lit)
    const discovered = hasPlayerDiscoveredPlot(p, ai.id, ai, state);
    if (discovered && p.deposits.length > 0) {
      let depBonus = 65;
      for (const d of p.deposits) {
        if (HIGH_VAL_MINERALS.has(d.type)) depBonus += difficulty >= 3 ? 50 : 25;
        else depBonus += 18;
      }
      score += depBonus;
    } else if (!roadAdjacent && getPlotPurchasePrice(p, ai, state) + 60_000 > maxSpend * 0.72) {
      // Jeśli brak dostępu do drogi i brak złoża, a budżet ledwo wystarcza — unikaj bezdroży
      score -= 35;
    } else if (
      (strategy === 'industrialist' || strategy === 'supplyChain' || strategy === 'energyMagnate') &&
      (p.terrain === 'mountain' || p.terrain === 'desert')
    ) {
      score += 22;
    }

    // Bliskość do własnych obiektów (ciągłość sieci + synergie dzielnicowe)
    for (const op of ownedPlots) {
      const dist = Math.abs(op.gridX - p.gridX) + Math.abs(op.gridY - p.gridY);
      if (dist <= 2) {
        score += 18;
        break;
      }
      if (dist <= 4) score += 8;
    }

    if (strategy === 'realEstate' || strategy === 'shadowBroker') {
      if (p.terrain === 'urban' || p.terrain === 'coastal') score += 38;
      score += p.attractiveness * 0.55;
      score += ((p.passengerDemandPercent ?? 100) - 100) * 0.45;
    }

    score -= getPlotPurchasePrice(p, ai, state) / 30_000;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function evaluateAndBuildBestStructure(
  state: GameState,
  ai: Player,
  difficulty: number,
  strategy: AIStrategy,
  util: UtilityBalanceReport,
  ownedPlots: Plot[],
  ownedBuildings: Building[],
  emptyOwned: Plot[],
  cashReserve: number
): void {
  const isClosedMp = state.settings.mode === 'mp_fast' || state.settings.mode === 'mp_long';
  const priorities = STRATEGY_PRIORITIES[strategy];
  const archMods = ARCHETYPES[ai.archetype ?? 'standard'].modifiers;

  // Co AI faktycznie produkuje i magazynuje (dla dopasowania przetwórstwa do łańcuchów dostaw!)
  const producedRes = new Map<ResourceType, number>();
  for (const rb of util.resourceBalances) {
    if (rb.produced + rb.b2bImport > 0) {
      producedRes.set(rb.resource, rb.produced + rb.b2bImport);
    }
  }

  const countOfType = (bt: BuildingType): number => ownedBuildings.filter((b) => b.type === bt).length;
  const hasHQ = countOfType('corporateHQ') > 0;
  const hasFire = countOfType('fireStation') > 0;
  const hasHazmat = countOfType('hazmatBase') > 0;
  const hasHospital = countOfType('hospital') > 0;
  const hasPolice = countOfType('policeStation') > 0;
  const needsHazmat = ownedBuildings.some(
    (b) =>
      b.type === 'chemicalPlant' ||
      b.type === 'oilRefinery' ||
      b.type === 'uraniumEnrichment' ||
      b.type === 'nuclearPowerPlant' ||
      b.type === 'batteryFactory'
  );
  const needsPolice = ownedBuildings.some(
    (b) =>
      b.type === 'casino' ||
      b.type === 'jewelryLuxury' ||
      b.type === 'investmentBank' ||
      b.type === 'shoppingMall'
  );

  // Zbuduj listę kandydatów (Zero losowości — celowa ocena potrzeb i zysków)
  const candidateTypes = new Set<BuildingType>(priorities);
  if (!hasHQ) candidateTypes.add('corporateHQ');
  if (ownedBuildings.length >= 2 && !hasFire) candidateTypes.add('fireStation');
  if (needsHazmat && !hasHazmat) candidateTypes.add('hazmatBase');
  if (ownedBuildings.length >= 4 && !hasHospital) candidateTypes.add('hospital');
  if (needsPolice && !hasPolice) candidateTypes.add('policeStation');
  if (countOfType('highSchool') === 0) candidateTypes.add('highSchool');
  if (ai.corporationLevel >= 2 && countOfType('university') === 0) candidateTypes.add('university');
  if (ai.corporationLevel >= 3 && countOfType('rdLab') === 0) candidateTypes.add('rdLab');
  if (difficulty >= 3 && ownedBuildings.some((b) => PASSENGER_RECIPIENT_TYPES.has(b.type)) && countOfType('busDepot') === 0) {
    candidateTypes.add('busDepot');
  }
  if (difficulty >= 3 && ai.corporationLevel >= 3 && countOfType('metroStation') === 0) {
    candidateTypes.add('metroStation');
  }
  if (ai.archetype === 'tech_incubator') {
    candidateTypes.add('dataCenter');
    candidateTypes.add('biotechLab');
    candidateTypes.add('verticalFarm');
  }

  // Dodaj kopalnie dla odkrytych już złóż na własnych działkach!
  for (const ep of emptyOwned) {
    if (!hasPlayerDiscoveredPlot(ep, ai.id, ai, state)) continue;
    for (const dep of ep.deposits) {
      if (dep.amount <= 0) continue;
      for (const bDef of Object.values(BUILDING_DEFINITIONS)) {
        if (bDef.requiredDeposit === dep.type) {
          candidateTypes.add(bDef.type);
        }
      }
    }
  }

  let bestChoice: { bType: BuildingType; plot: Plot; score: number } | null = null;
  const maxPlotsEval = emptyOwned.length > 10 ? emptyOwned.slice(0, 10) : emptyOwned;

  for (const bType of candidateTypes) {
    const def = BUILDING_DEFINITIONS[bType];
    if (!def) continue;
    if (bType === 'corporateHQ' && hasHQ) continue;

    // Ekologiczny archetyp lub scenariusz Zielona Transformacja unikają węgla i spalarni
    if (
      (ai.archetype === 'eco_innovator' || state.settings.scenarioId === 'green_transition') &&
      (bType === 'wasteIncinerator' || bType === 'coalPowerPlant')
    ) {
      continue;
    }
    // Nie spamuj elektrowni przy dużym zapasie MW ani paliwowych bez własnego paliwa / funduszy
    if (def.category === 'energy') {
      const fSpec = getPowerPlantFuelSpec(bType);
      if (fSpec) {
        const hasFuelSup = fSpec.acceptedResources.some(
          (r) => (producedRes.get(r) ?? 0) > 0 || (ai.warehouseStockpile[r] ?? 0) >= fSpec.consumptionPerTick * 3
        );
        if (!hasFuelSup && (isClosedMp || bType === 'coalPowerPlant' || ai.cash < cashReserve + 550_000)) {
          continue;
        }
      }
      if (util.electricityNet > 40 && (strategy !== 'energyMagnate' || ai.cash < cashReserve + 550_000)) continue;
    }

    const buildCost = getBuildingConstructionCost(bType, state, ai);
    if (ai.cash - buildCost < cashReserve && bType !== 'corporateHQ') continue;

    // Nie stawiaj dużego odbiorcy energii/wody/ścieków jeśli po budowie wywołałby głęboki deficyt sieci
    const isUtilityBld = def.category === 'energy' || def.category === 'waste' || bType === 'waterPlant';
    if (!isUtilityBld && bType !== 'corporateHQ' && ownedBuildings.length >= 2) {
      const projElec = util.electricityNet - Math.max(0, def.electricityUsage);
      const projWater = util.waterNet - Math.max(0, def.waterUsage);
      const projSewage = util.sewageNet - Math.max(0, def.sewageUsage ?? 0);
      const projWaste = util.wasteNet - Math.max(0, def.wasteUsage ?? 0);
      if (projElec < -6 || projWater < -6 || projSewage < -14 || projWaste < -14) {
        continue;
      }
    }

    // Sprawdź łańcuch dostaw surowców (nigdy nie stawiaj ślepych fabryk bez surowców)
    const inputKeys = Object.keys(def.inputs) as ResourceType[];
    let supplyScoreAdj = 0;
    let missingCriticalSupply = false;
    for (const inRes of inputKeys) {
      const reqQty = def.inputs[inRes] ?? 0;
      const mySup = (producedRes.get(inRes) ?? 0) + (ai.warehouseStockpile[inRes] ?? 0) * 0.1;
      if (mySup >= reqQty * 0.7) {
        supplyScoreAdj += 36;
      } else if (mySup > 0) {
        supplyScoreAdj += 14;
      } else if (isClosedMp) {
        // W gospodarce zamkniętej MP sprawdź czy w ogóle ktoś na rynku to sprzedaje (albo odrzuć)
        const hasSeller = state.contracts.some((c) => c.resource === inRes && c.status === 'open_listing');
        if (!hasSeller) {
          missingCriticalSupply = true;
          break;
        }
        supplyScoreAdj -= 15;
      } else {
        // W SP na niskim/normalnym AI unika zakładów wymagających wielu drogich importowanych surowców jeśli nic nie wydobywa
        supplyScoreAdj -= difficulty >= 3 ? 12 : 28;
      }
    }
    if (missingCriticalSupply) continue;

    // Bazowa ocena opłacalności ROI (uwzględnia realny koszt wsadu surowcowego!)
    let outputMarketVal = def.baseRevenue;
    for (const [resKey, qty] of Object.entries(def.outputs)) {
      const r = resKey as ResourceType;
      outputMarketVal += (qty ?? 0) * getResourcePrice(state, r);
    }
    let inputCostVal = 0;
    for (const [resKey, qty] of Object.entries(def.inputs)) {
      const r = resKey as ResourceType;
      if (!qty) continue;
      const hasLocal = (producedRes.get(r) ?? 0) >= qty * 0.5;
      inputCostVal += qty * getResourcePrice(state, r) * (hasLocal ? 0.6 : 1.18);
    }
    const estUpkeep = def.baseMaintenance + def.maxWorkers * 30;
    const estNetTick = outputMarketVal - inputCostVal - estUpkeep;
    const roiScore = Math.max(-20, Math.min(85, (estNetTick / Math.max(80_000, buildCost)) * 1_600));

    let rolePriority = 0;
    const idxInStrat = priorities.indexOf(bType);
    if (idxInStrat !== -1) rolePriority += Math.max(8, 36 - idxInStrat * 2);

    // Jeśli firma nie ma jeszcze dochodowych zakładów/komercji, preferuj szybki generator gotówki
    const hasProfitGenerator = ownedBuildings.some(
      (b) => b.category !== 'energy' && b.category !== 'waste' && b.type !== 'waterPlant' && b.type !== 'corporateHQ'
    );
    if (!hasProfitGenerator && !isUtilityBld && bType !== 'corporateHQ' && estNetTick > 400) {
      rolePriority += 48;
    }

    // Krytyczne braki strategiczne: HQ, Służby, Edukacja, Transport Pasażerski
    if (bType === 'corporateHQ' && !hasHQ) rolePriority += 120;
    if (bType === 'fireStation' && !hasFire && ownedBuildings.length >= 2) rolePriority += 92;
    if (bType === 'hazmatBase' && !hasHazmat && needsHazmat) rolePriority += 110;
    if (bType === 'policeStation' && !hasPolice && needsPolice) rolePriority += 68;
    if (bType === 'hospital' && !hasHospital && ownedBuildings.length >= 4) rolePriority += 58;
    if (bType === 'highSchool' && countOfType('highSchool') === 0) rolePriority += 52;
    if (bType === 'university' && countOfType('university') === 0) rolePriority += 48;
    if (bType === 'rdLab' && countOfType('rdLab') === 0) rolePriority += 45;
    if ((bType === 'busDepot' || bType === 'metroStation') && ownedBuildings.some((b) => PASSENGER_RECIPIENT_TYPES.has(b.type))) {
      rolePriority += difficulty >= 3 ? 52 : 24;
    }

    // Kara i limit dublowania tego samego obiektu (dywersyfikacja portfela i łańcucha dostaw)
    const existingSame = countOfType(bType);
    if (existingSame >= 3 && !isUtilityBld) continue;
    rolePriority -=
      existingSame *
      (bType === 'fireStation' || bType === 'hospital' || bType === 'university' || bType === 'highSchool' || bType === 'rdLab'
        ? 95
        : 38);

    // Dopasowanie do Archetypu
    if (def.category === 'mining' && archMods.miningYieldMult > 1) rolePriority += 22;
    if ((bType === 'busDepot' || bType === 'metroStation' || bType === 'trainStation' || bType === 'cargoPort') && archMods.passengerFleetCostMult < 1) {
      rolePriority += 24;
    }
    if ((bType === 'solarFarm' || bType === 'windFarm' || bType === 'recyclingPlant' || bType === 'bioSewagePlant') && archMods.renewableRecycleMult > 1) {
      rolePriority += 26;
    }

    for (const plot of maxPlotsEval) {
      if (!checkBuildingRequirements(ai, plot, bType, state).ok) continue;

      let totalScore = roiScore + rolePriority + supplyScoreAdj;

      // Kopalnia na bogatym odkrytym złożu dostaje duży priorytet
      if (def.requiredDeposit) {
        const dep = plot.deposits.find((d) => d.type === def.requiredDeposit);
        if (dep) {
          totalScore += 42 + dep.richness * 14 + (HIGH_VAL_MINERALS.has(dep.type) ? 28 : 0);
        }
      }

      // Synergie sąsiedztwa (na Łatwym AI pomija zaawansowane optymalizacje synergii)
      if (difficulty >= 2) {
        const syn = previewBuildingSynergyAtPlot(state, plot, bType);
        totalScore += syn.netPercent * (difficulty >= 3 ? 1.8 : 1.0);
        if (PASSENGER_RECIPIENT_TYPES.has(bType)) {
          totalScore += ((plot.passengerDemandPercent ?? 100) - 100) * 0.4;
        }
      }

      // Unikaj stawiania smogu/składowisk przy mieszkaniach i hotelach
      if (SMOG_EMITTING_TYPES.has(bType) && hasNearbySensitivePlot(state.plots, plot)) {
        totalScore -= 70;
      }
      if (SMOG_EMITTING_TYPES.has(bType) && (plot.terrain === 'forest' || plot.terrain === 'desert')) {
        totalScore += 14;
      }

      // Dostęp do drogi jest kluczowy do zarabiania — premiuj działki przy drodze/HQ lub rezerwuj budżet na drogę
      const plotRoadReady = isRoadExemptBuilding(bType) || hasRoadAccess(state, plot, ai.id);
      if (plotRoadReady) {
        totalScore += 65;
      } else {
        if (ai.cash - buildCost < cashReserve + 55_000) continue;
        totalScore -= 28;
      }
      if (plot.hasElectricity) totalScore += 8;
      if (plot.hasWater) totalScore += 8;

      if (!bestChoice || totalScore > bestChoice.score) {
        bestChoice = { bType, plot, score: totalScore };
      }
    }
  }

  if (bestChoice && bestChoice.score > 5) {
    constructBuildingOnPlot(state, ai, bestChoice.plot, bestChoice.bType);
  }
}

function handleDiplomacyMarketAndAuctions(
  state: GameState,
  ai: Player,
  difficulty: number,
  strategy: AIStrategy,
  util: UtilityBalanceReport,
  ownedBuildings: Building[],
  cashReserve: number
): void {
  // 1. Licytacje Komornicze na żywo (Normalny i wyżej)
  const auc = state.liveAuction;
  if (
    difficulty >= 2 &&
    auc &&
    auc.status === 'active' &&
    auc.highestBidderId !== ai.id &&
    auc.secondsRemaining <= 24
  ) {
    const aucPlot = state.plots.find((p) => p.id === auc.plotId);
    if (aucPlot) {
      const estValue =
        aucPlot.price +
        (aucPlot.building ? BUILDING_DEFINITIONS[aucPlot.building.type].baseCost * 0.9 : 0);
      const wtpMult = difficulty >= 4 ? 1.18 : difficulty === 3 ? 1.0 : 0.85;
      const nextBid = auc.currentBid + auc.minIncrement;
      if (nextBid <= estValue * wtpMult && ai.cash - nextBid >= cashReserve) {
        placeLiveAuctionBid(state, ai, auc.id, nextBid);
      }
    }
  }

  // 2. Przetargi Rządowe (Normalny i wyżej)
  if (difficulty >= 2 && state.tenders && state.tenders.length > 0) {
    const activeTender = state.tenders.find(
      (t) => t.status === 'open' && t.kind === 'resource_delivery'
    );
    if (activeTender) {
      const playerProg = activeTender.deliveredByPlayer[ai.id] ?? {};
      const canDeliver = Object.entries(activeTender.requirements).some(([rKey, neededRaw]) => {
        const res = rKey as ResourceType;
        const needed = neededRaw ?? 0;
        const already = playerProg[res] ?? 0;
        if (needed - already <= 0) return false;
        const surplus = ai.warehouseStockpile[res] ?? 0;
        const consumedBySelf =
          util.resourceBalances.find((rb) => rb.resource === res)?.consumed ?? 0;
        return surplus >= Math.max(4, consumedBySelf * 1.5);
      });
      if (canDeliver) {
        submitTenderDelivery(state, ai, activeTender.id);
      }
    }
  }

  // 3. Przychodzące kontrakty B2B oraz inteligentne proponowanie nadwyżek
  if (difficulty >= 2) {
    const incomingB2B = state.contracts.find(
      (c) =>
        (c.status === 'pending' || c.status === 'proposed') &&
        c.proposerId !== ai.id &&
        (c.responderId ? c.responderId === ai.id : c.buyerId === ai.id || c.sellerId === ai.id)
    );
    if (incomingB2B) {
      const mktPrice = getResourcePrice(state, incomingB2B.resource);
      const isSelling = incomingB2B.sellerId === ai.id;
      const fair = isSelling
        ? incomingB2B.pricePerUnit >= mktPrice * 0.88
        : incomingB2B.pricePerUnit <= mktPrice * 1.12;
      if (fair) {
        acceptB2BContract(state, ai, incomingB2B.id);
      }
    } else if (Math.random() < 0.1 && ownedBuildings.length > 0 && state.contracts.length < 14) {
      const surplusItem = util.resourceBalances.find(
        (rb) =>
          rb.net >= 3 &&
          RESOURCE_DEFINITIONS[rb.resource]?.tradeable !== false
      );
      const partner = state.players.find((p) => p.id !== ai.id && !p.isEliminated);
      if (surplusItem && partner) {
        const mktPrice = getResourcePrice(state, surplusItem.resource);
        proposeB2BContract(
          state,
          ai,
          partner.id,
          surplusItem.resource,
          Math.max(2, Math.min(8, Math.floor(surplusItem.net * 0.5))),
          Math.round(mktPrice * 0.96),
          25,
          true
        );
      }
    }
  }

  // 4. Polityka i lobbing wyborczy przed wyborami (Trudny / Ekspert)
  if (difficulty >= 3 && state.government && ai.cash > cashReserve + 420_000) {
    const ticksToElection = state.government.nextElectionTick - state.time.tick;
    if (ticksToElection <= 16 && ticksToElection > 0 && Math.random() < 0.25) {
      const preferredGov: GovernmentKind =
        ai.archetype === 'eco_innovator'
          ? 'ecological'
          : strategy === 'realEstate' || ai.archetype === 'investment_fund' || ai.archetype === 'logistics_cartel'
            ? 'free_market'
            : 'interventionist';
      if (state.government.currentGov !== preferredGov) {
        lobbyGovernmentElection(state, ai, preferredGov, false);
      }
    } else if (Math.random() < 0.08) {
      if (strategy === 'shadowBroker') {
        executeInfluenceAction(state, ai, 'church_donation');
      } else if (strategy === 'military') {
        const rival = state.players.find((p) => p.id !== ai.id && !p.isEliminated);
        if (rival) executeInfluenceAction(state, ai, 'espionage', rival.id);
      } else {
        executeInfluenceAction(state, ai, 'lobbying');
      }
    }
  }

  // 5. Giełda spółek (Ekspert/Rekin)
  if (difficulty >= 4 && ai.cash > cashReserve + 900_000 && Math.random() < 0.14) {
    const targetStock = (state.stocks ?? [])
      .filter((s) => s.companyId !== ai.id && (s.holdings[s.companyId] ?? 0) >= 10)
      .sort((a, b) => a.sharePrice - b.sharePrice)[0];
    if (targetStock) {
      tradeCorporateStock(state, ai, targetStock.companyId, 5);
    }
  }
}
