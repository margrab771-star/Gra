import { CORPORATION_LEVELS, DIFFICULTY_PRESETS, GAME_CONFIG, GOVERNMENT_CONFIGS, SERVICE_VEHICLE_COST, TERRAIN_NAMES } from '../config/gameConfig';
import { getArchetypeDefinition } from '../data/archetypes';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { RESOURCE_DEFINITIONS } from '../data/resources';
import { formatGameDate } from '../utils/formatters';
import {
  calculateTransportCostForBuilding,
  getPlayerEntrepreneurModifiers,
  getPlayerGlobalTechModifiers,
  getResourcePrice,
} from './EconomyEngine';
import { getSafetyCoverageForPlot } from './HazardSystem';
import { calculateBuildingHRPayroll } from './HRSystem';
import { hasPlayerDiscoveredPlot, recalculateSpatialNetwork } from './PlotSystem';
import { consumeRequiredResources, evaluateNonFinancialRequirements } from './RequirementsSystem';
import { evaluateSynergyForPlotAndType, recalculateSynergiesAndPassengerDemand } from './SynergySystem';
import {
  addPlotWarehouseStock,
  canTransportGoodsBetweenPlots,
  computeNetworkClusters,
  consumePlotWarehouseStock,
  consumeReachableWarehouseStock,
  evaluatePlotLogisticsMode,
  hasExternalMarketAccess,
  hasRoadAccess,
  isRoadExemptBuilding,
  refreshBuildingsRoadStatus,
} from './TransportSystem';
import type { B2BFuelReceipt } from './ContractSystem';
export { hasRoadAccess, isRoadExemptBuilding } from './TransportSystem';

export interface PowerPlantFuelSpec {
  primaryResource: ResourceType;
  acceptedResources: ResourceType[];
  consumptionPerTick: number;
  maxStock: number;
  label: string;
}

export function getPowerPlantFuelSpec(type: BuildingType): PowerPlantFuelSpec | null {
  switch (type) {
    case 'coalPowerPlant':
      return {
        primaryResource: 'coal',
        acceptedResources: ['coal'],
        consumptionPerTick: 7.5,
        maxStock: 36,
        label: 'Węgiel',
      };
    case 'gasPowerPlant':
      return {
        primaryResource: 'fuel',
        acceptedResources: ['fuel', 'oil'],
        consumptionPerTick: 3.5,
        maxStock: 18,
        label: 'Paliwo / Ropa',
      };
    case 'nuclearPowerPlant':
      return {
        primaryResource: 'uranium',
        acceptedResources: ['uranium'],
        consumptionPerTick: 2.2,
        maxStock: 12,
        label: 'Uran',
      };
    case 'fusionReactor':
      return {
        primaryResource: 'lithium',
        acceptedResources: ['lithium', 'rareMetals'],
        consumptionPerTick: 1.5,
        maxStock: 9,
        label: 'Lit / Metale ziem rzadkich',
      };
    default:
      return null;
  }
}

export function toggleEmergencyFuelImport(
  building: Building
): { ok: boolean; enabled: boolean; message: string } {
  const spec = getPowerPlantFuelSpec(building.type);
  if (!spec) {
    return { ok: false, enabled: false, message: 'Ten obiekt nie zużywa fizycznego paliwa elektrowni.' };
  }
  building.emergencyMarketImport = !building.emergencyMarketImport;
  return {
    ok: true,
    enabled: Boolean(building.emergencyMarketImport),
    message: building.emergencyMarketImport
      ? `Włączono awaryjny import ${spec.label} z rynku (+35% narzutu) dla ${building.name}.`
      : `Wyłączono awaryjny import z rynku dla ${building.name}.`,
  };
}
import type {
  Building,
  BuildingTechNode,
  BuildingType,
  CloneBlueprint,
  CorporationLevel,
  EmergencyServiceKind,
  GameState,
  Player,
  Plot,
  ResourceType,
} from './types';

export function computeCorporationLevel(state: GameState, player: Player): CorporationLevel {
  const ownedBlds = state.plots.filter((p) => p.ownerId === player.id && p.building).map((p) => p.building!);
  const count = ownedBlds.length;
  const hasHighSchool = ownedBlds.some((b) => b.type === 'highSchool' || b.type === 'university');
  const hasUniv = ownedBlds.some((b) => b.type === 'university');
  const hasLab = ownedBlds.some((b) => b.type === 'rdLab');

  if (player.netWorth >= 17_000_000 && count >= 8 && hasLab) return 5;
  if (player.netWorth >= 11_500_000 && count >= 6 && hasUniv) return 4;
  if (player.netWorth >= 7_800_000 && count >= 4 && hasHighSchool) return 3;
  if (player.netWorth >= 5_400_000 && count >= 2) return 2;
  return 1;
}

export function checkBuildingRequirements(
  player: Player,
  plot: Plot,
  buildingType: BuildingType,
  state: GameState
): { ok: boolean; reason?: string } {
  const def = BUILDING_DEFINITIONS[buildingType];
  if (!def) return { ok: false, reason: 'Nieznany typ struktury.' };
  if (state.settings.weeklyBannedBuildings?.includes(buildingType)) {
    return { ok: false, reason: `Reguły Wyzwania Tygodnia zakazują budowy obiektu "${def.name}".` };
  }
  if (state.settings.scenarioId === 'green_transition' && state.greenTransitionEntered && buildingType === 'wasteIncinerator') {
    return { ok: false, reason: 'Scenariusz Zielona Transformacja: zakaz budowy nowych spalarni odpadów!' };
  }
  if (player.corporationLevel < def.requiredCorpLevel) {
    const lvlInfo = CORPORATION_LEVELS[def.requiredCorpLevel];
    return {
      ok: false,
      reason: `Wymaga Poziomu Korporacji ${def.requiredCorpLevel} (${lvlInfo.name}: ${lvlInfo.requiresTechOrEdu}).`,
    };
  }
  if (plot.ownerId !== player.id) return { ok: false, reason: 'Działka nie należy do Ciebie.' };
  if ((plot.irradiatedTicks ?? 0) > 0) {
    return {
      ok: false,
      reason: `Działka skażona promieniowaniem nuklearnym (jeszcze ${plot.irradiatedTicks} tur).`,
    };
  }
  if (plot.building !== null) return { ok: false, reason: 'Na działce stoi już obiekt.' };
  if (
    buildingType === 'corporateHQ' &&
    state.plots.some((p) => p.ownerId === player.id && p.building?.type === 'corporateHQ')
  ) {
    return { ok: false, reason: 'Możesz posiadać tylko jedną Siedzibę Główną (HQ) na imperium.' };
  }
  if (!def.requiredTerrain.includes(plot.terrain)) {
    const allowed = def.requiredTerrain.map((t) => TERRAIN_NAMES[t]).join(', ');
    return { ok: false, reason: `Wymagany teren: ${allowed}.` };
  }
  if (def.requiredDeposit) {
    const hasDeposit =
      hasPlayerDiscoveredPlot(plot, player.id, player, state) &&
      plot.deposits.some((d) => d.type === def.requiredDeposit);
    if (!hasDeposit) {
      const genName = RESOURCE_DEFINITIONS[def.requiredDeposit].genitiveName;
      return {
        ok: false,
        reason: `Wymaga odkrytego złoża ${genName}. Wykonaj Badanie Geologiczne, aby sprawdzić grunt.`,
      };
    }
  }

  const reqEval = evaluateNonFinancialRequirements(def.requirements, player, state, undefined, plot);
  if (!reqEval.allMet) {
    const firstMissing = reqEval.items.find((i) => !i.met);
    return { ok: false, reason: firstMissing?.label ?? 'Niespełnione wymagania.' };
  }

  const buildPrice = getBuildingConstructionCost(buildingType, state, player);
  if (player.cash < buildPrice) {
    return { ok: false, reason: `Brak kapitału (${buildPrice.toLocaleString('pl-PL')} zł).` };
  }
  return { ok: true };
}

export function getBuildingConstructionCost(
  buildingType: BuildingType,
  state: GameState,
  player: Player
): number {
  const def = BUILDING_DEFINITIONS[buildingType];
  const mods = getPlayerEntrepreneurModifiers(state, player);
  const archMods = getArchetypeDefinition(player.archetype).modifiers;
  let buildMult = 1.0;
  if (def.category === 'mining' || def.category === 'processing') {
    buildMult *= archMods.heavyBuildCostMult;
  }
  if (buildingType === 'coalPowerPlant' || buildingType === 'coalMine' || buildingType === 'wasteIncinerator' || def.category === 'processing') {
    buildMult *= archMods.coalHeavyCostMult;
  }
  if (buildingType === 'rdLab' || buildingType === 'university' || buildingType === 'dataCenter') {
    buildMult *= archMods.labPatentCostMult;
  }
  if (buildingType === 'busDepot' || buildingType === 'metroStation' || buildingType === 'trainStation' || buildingType === 'passengerTerminal' || buildingType === 'warehouse') {
    buildMult *= archMods.passengerFleetCostMult;
  }
  if (state.government?.currentGov === 'free_market') {
    buildMult *= 0.92;
  }
  let materialsCost = 0;
  for (const [res, qty] of Object.entries(def.buildConstructionInputs)) {
    if (!qty) continue;
    const stock = player.warehouseStockpile[res as ResourceType] ?? 0;
    const missing = Math.max(0, qty - stock);
    materialsCost += missing * getResourcePrice(state, res as ResourceType) * (1 - mods.buyPriceDiscount);
  }
  return Math.round(def.baseCost * buildMult + materialsCost);
}

export function constructBuildingOnPlot(
  state: GameState,
  player: Player,
  plot: Plot,
  buildingType: BuildingType
): { ok: boolean; error?: string; building?: Building } {
  const check = checkBuildingRequirements(player, plot, buildingType, state);
  if (!check.ok) return { ok: false, error: check.reason };

  const def = BUILDING_DEFINITIONS[buildingType];
  const totalCost = getBuildingConstructionCost(buildingType, state, player);

  for (const [resKey, qty] of Object.entries(def.buildConstructionInputs)) {
    const res = resKey as ResourceType;
    if (!qty) continue;
    const stock = player.warehouseStockpile[res] ?? 0;
    if (stock > 0) {
      player.warehouseStockpile[res] = Math.max(0, stock - qty);
    }
  }

  player.cash -= totalCost;

  const techTree: BuildingTechNode[] = def.internalTechTree.map((n) => ({
    ...n,
    progress: 0,
    status: n.prerequisites.length === 0 ? 'available' : 'locked',
  }));

  const initialWorkers = Math.max(1, Math.round(def.maxWorkers * 0.65));
  const roadOk = isRoadExemptBuilding(buildingType) || hasRoadAccess(state, plot, player.id);
  const rawLogiMode = roadOk ? evaluatePlotLogisticsMode(state, player.id, plot) : 'isolated';
  const logiMode: Building['logisticsMode'] = !roadOk
    ? 'isolated'
    : rawLogiMode === 'isolated'
      ? 'road'
      : rawLogiMode;

  const isFleetStation =
    buildingType === 'fireStation' ||
    buildingType === 'hazmatBase' ||
    buildingType === 'hospital' ||
    buildingType === 'policeStation';
  const fleetType: EmergencyServiceKind | undefined =
    buildingType === 'fireStation'
      ? 'fire'
      : buildingType === 'hazmatBase'
        ? 'hazmat'
        : buildingType === 'hospital'
          ? 'medical'
          : buildingType === 'policeStation'
            ? 'police'
            : undefined;

  const fuelSpec = getPowerPlantFuelSpec(buildingType);

  const building: Building = {
    id: `bld_${plot.gridX}_${plot.gridY}_${Date.now().toString(36)}`,
    type: buildingType,
    plotId: plot.id,
    ownerId: player.id,
    name: def.name,
    category: def.category,
    icon: def.icon,
    level: 1,
    visualTier:
      buildingType === 'corporateHQ'
        ? Math.min(3, Math.floor((player.corporationLevel - 1) * 0.75))
        : 0,
    upgradeFlashTicks: 0,
    condition: 100,
    damagePercent: 0,
    autoRepairEnabled: player.defaultAutoRepair.enabled,
    autoRepairThreshold: player.defaultAutoRepair.threshold,
    insured: false,
    insuranceClaimsCount: 0,
    strikeTicks: 0,
    hqVariant: buildingType === 'corporateHQ' ? (player.hqVariant ?? 'classic') : undefined,
    workers: initialWorkers,
    maxWorkers: def.maxWorkers,
    workerSkill: 40,
    efficiency: 100,
    isActive: true,
    selected: false,
    stockpileOutput: false,
    storage: {},
    storageCapacity: def.storageCapacity,
    techTree,
    activeResearchId: null,
    revenue: 0,
    costs: {
      inputs: 0,
      wages: 0,
      zus: 0,
      energy: 0,
      water: 0,
      transport: 0,
      maintenance: 0,
      environmentalFine: 0,
      taxes: 0,
      total: 0,
    },
    netProfit: 0,
    productionPerTick: {},
    consumptionPerTick: {},
    status: {
      noPower: false,
      noWater: false,
      breakdown: false,
      storageFull: false,
      upgradeActive: false,
      understaffed: false,
      droughtHit: false,
      boycotted: false,
      onFire: false,
      hazmatIncident: false,
      noRoadLink: !roadOk,
      robberyActive: false,
      missingInputs: false,
      sewageCrisis: false,
      wasteCrisis: false,
      disasterStruck: false,
      noFuel: false,
    },
    fuelResource: fuelSpec?.primaryResource,
    fuelMax: fuelSpec?.maxStock,
    fuelStored: fuelSpec ? Number((fuelSpec.maxStock * 0.5).toFixed(2)) : undefined,
    fuelLevel: fuelSpec ? 50 : undefined,
    fuelSourceMode: fuelSpec ? 'none' : undefined,
    emergencyMarketImport: fuelSpec ? false : undefined,
    activeHazard: null,
    hasRoadConnection: roadOk,
    logisticsMode: logiMode,
    fleetSize: isFleetStation ? 2 : undefined,
    maxFleetSize: isFleetStation ? 3 : undefined,
    fleetType,
    crimeLevel: plot.crimeScore,
    sabotagedTicks: 0,
    boycottedTicks: 0,
  };

  plot.building = building;
  state.networkRevision = (state.networkRevision ?? 0) + 1;
  recalculateSpatialNetwork(state.plots);
  refreshBuildingsRoadStatus(state);
  recalculateSynergiesAndPassengerDemand(state);
  return { ok: true, building };
}

export function demolishBuildingOnPlot(
  state: GameState,
  player: Player,
  plot: Plot
): { ok: boolean; error?: string } {
  if (plot.ownerId !== player.id || !plot.building) {
    return { ok: false, error: 'Brak własnego budynku do wyburzenia.' };
  }
  const def = BUILDING_DEFINITIONS[plot.building.type];
  if (plot.building.destroyedRuins) {
    const clearanceCost = Math.max(5_000, Math.round(def.baseCost * 0.12));
    if (player.cash < clearanceCost) {
      return {
        ok: false,
        error: `Uprzątnięcie ruin po katastrofie kosztuje ${clearanceCost.toLocaleString('pl-PL')} zł.`,
      };
    }
    player.cash -= clearanceCost;
  } else {
    const refund = Math.round(def.baseCost * 0.35 * (plot.building.condition / 100));
    player.cash += refund;
  }
  plot.building = null;
  state.networkRevision = (state.networkRevision ?? 0) + 1;
  recalculateSpatialNetwork(state.plots);
  recalculateSynergiesAndPassengerDemand(state);
  return { ok: true };
}

// ─── Zaawansowane Klonowanie 1:1 (Blueprint bez żadnych rabatów) i Polisa ────

export function computeCloneBlueprint(
  state: GameState,
  player: Player,
  source: Building,
  includeUpgrades = true
): CloneBlueprint {
  const baseCost = getBuildingConstructionCost(source.type, state, player);
  const doneNodes = includeUpgrades ? source.techTree.filter((n) => n.status === 'done') : [];
  const unlockedTechIds = doneNodes.map((n) => n.id);
  const upgradesCost = doneNodes.reduce((sum, n) => sum + n.cost, 0);

  let fleetCost = 0;
  const initialDefaultFleet = source.fleetType ? 2 : 0;
  const copiedFleet = includeUpgrades ? (source.fleetSize ?? initialDefaultFleet) : initialDefaultFleet;
  const extraVehicles = Math.max(0, copiedFleet - initialDefaultFleet);
  if (includeUpgrades && source.fleetType && extraVehicles > 0) {
    const vehicleCost = SERVICE_VEHICLE_COST[source.fleetType] ?? 55_000;
    fleetCost = extraVehicles * vehicleCost;
  }

  return {
    buildingType: source.type,
    unlockedTechIds,
    fleetSize: copiedFleet,
    insured: Boolean(source.insured),
    stockpileOutput: source.stockpileOutput,
    autoRepairEnabled: source.autoRepairEnabled,
    autoRepairThreshold: source.autoRepairThreshold,
    baseCost,
    upgradesCost,
    fleetCost,
    totalCost: baseCost + upgradesCost + fleetCost,
    includeUpgrades,
  };
}

export function cloneBuildingOnPlot(
  state: GameState,
  player: Player,
  targetPlot: Plot,
  source: Building,
  includeUpgrades: boolean
): { ok: boolean; error?: string; building?: Building; blueprint?: CloneBlueprint } {
  if (source.type === 'corporateHQ') {
    return { ok: false, error: 'Siedziby Głównej (HQ) nie można klonować — limit 1 na korporację.' };
  }
  if (source.destroyedRuins) {
    return { ok: false, error: 'Nie można sklonować zawalonych ruin.' };
  }
  const check = checkBuildingRequirements(player, targetPlot, source.type, state);
  if (!check.ok) return { ok: false, error: check.reason };

  const blueprint = computeCloneBlueprint(state, player, source, includeUpgrades);
  if (player.cash < blueprint.totalCost) {
    return {
      ok: false,
      error: `Klonowanie 1:1 wymaga pełnego budżetu ${blueprint.totalCost.toLocaleString('pl-PL')} zł (baza + ulepszenia + flota).`,
    };
  }

  // Odejmij osobno koszt ulepszeń i floty, a baza zostanie pobrana przez constructBuildingOnPlot
  const extraCost = blueprint.upgradesCost + blueprint.fleetCost;
  player.cash -= extraCost;
  const res = constructBuildingOnPlot(state, player, targetPlot, source.type);
  if (!res.ok || !res.building) {
    player.cash += extraCost;
    return { ok: false, error: res.error };
  }

  const cloned = res.building;
  cloned.autoRepairEnabled = blueprint.autoRepairEnabled;
  cloned.autoRepairThreshold = blueprint.autoRepairThreshold;
  cloned.stockpileOutput = blueprint.stockpileOutput;
  cloned.insured = blueprint.insured;

  if (includeUpgrades && blueprint.unlockedTechIds.length > 0) {
    for (const node of cloned.techTree) {
      if (blueprint.unlockedTechIds.includes(node.id)) {
        node.status = 'done';
        node.progress = 100;
        cloned.level = Math.min(10, cloned.level + 1);
      }
    }
    for (const node of cloned.techTree) {
      if (
        node.status === 'locked' &&
        node.prerequisites.every((pid) => cloned.techTree.find((x) => x.id === pid)?.status === 'done')
      ) {
        const excludedByDone = node.exclusiveWith?.some((eid) => cloned.techTree.find((x) => x.id === eid)?.status === 'done');
        node.status = excludedByDone ? 'excluded' : 'available';
      }
    }
    const bMods = getAggregatedBuildingModifiers(cloned);
    cloned.storageCapacity = Math.round(BUILDING_DEFINITIONS[cloned.type].storageCapacity * bMods.storageMultiplier);
    cloned.visualTier = bMods.isApex ? 4 : Math.min(3, cloned.techTree.filter((t) => t.status === 'done').length);
  }

  if (includeUpgrades && cloned.fleetType && blueprint.fleetSize > (cloned.fleetSize ?? 0)) {
    cloned.fleetSize = blueprint.fleetSize;
    cloned.maxFleetSize = Math.max(cloned.maxFleetSize ?? 3, blueprint.fleetSize);
  }

  recalculateSpatialNetwork(state.plots);
  recalculateSynergiesAndPassengerDemand(state);
  return { ok: true, building: cloned, blueprint };
}

export function getInsurancePremiumPerTick(building: Building): number {
  const def = BUILDING_DEFINITIONS[building.type];
  const claims = building.insuranceClaimsCount ?? 0;
  return Math.max(250, Math.round(def.baseCost * 0.0014 * (1 + claims * 0.45)));
}

export function toggleBuildingInsurance(
  building: Building
): { ok: boolean; insured: boolean; message: string } {
  if (building.destroyedRuins) {
    return { ok: false, insured: false, message: 'Nie można ubezpieczyć zawalonych ruin.' };
  }
  building.insured = !building.insured;
  const prem = getInsurancePremiumPerTick(building);
  return {
    ok: true,
    insured: Boolean(building.insured),
    message: building.insured
      ? `Polisa ubezpieczeniowa WŁĄCZONA (składka ${prem.toLocaleString('pl-PL')} zł/T, zwrot 65% przy szkodzie).`
      : 'Polisa ubezpieczeniowa WYŁĄCZONA.',
  };
}

export function handleBuildingDestructionInsurance(
  building: Building,
  player: Player | undefined,
  state: GameState
): number {
  if (!building.insured || !player || player.isEliminated) return 0;
  const def = BUILDING_DEFINITIONS[building.type];
  const payout = Math.round(def.baseCost * 0.65);
  player.cash += payout;
  player.totalRevenueEarned += payout;
  building.insuranceClaimsCount = (building.insuranceClaimsCount ?? 0) + 1;
  state.news = [
    {
      id: `ins_pay_${state.time.tick}_${building.id}`,
      headline: `🛡️ Wypłata z Polisy: ${player.companyName} otrzymuje ${payout.toLocaleString('pl-PL')} zł`,
      brief: `Ubezpieczyciel wypłacił 65% wartości zniszczonego obiektu ${building.name}. Składka dla kolejnych ryzyk wzrasta o 45%.`,
      fullText: `Polisa korporacyjna pokryła 65% wartości odtworzeniowej obiektu ${building.name}.`,
      analysis: 'Kolejne roszczenia podnoszą koszt składek w koncernie.',
      hints: [],
      type: 'positive' as const,
      dateLabel: formatGameDate(state.time),
      tick: state.time.tick,
      read: false,
    },
    ...state.news,
  ].slice(0, 40);
  return payout;
}

export function getRepairCost(building: Building): number {
  const def = BUILDING_DEFINITIONS[building.type];
  const dmg = Math.max(0, building.damagePercent);
  return Math.max(1_500, Math.round(def.baseCost * 0.14 * (dmg / 100)));
}

export function repairBuilding(
  building: Building,
  player: Player
): { ok: boolean; error?: string; cost?: number } {
  if (building.destroyedRuins) {
    return {
      ok: false,
      error: 'Obiekt uległ całkowitemu zniszczeniu (Ruiny). Uprzątnij działkę za pomocą rozbiórki gruzu.',
    };
  }
  if (building.damagePercent <= 0.5 && !building.activeHazard) {
    return { ok: false, error: 'Obiekt ma 0% zniszczenia i jest w idealnym stanie.' };
  }
  const cost = getRepairCost(building);
  if (player.cash < cost) {
    return { ok: false, error: `Brak środków na remont (${cost.toLocaleString('pl-PL')} zł).` };
  }

  player.cash -= cost;
  building.damagePercent = 0;
  building.condition = 100;
  building.status.breakdown = false;
  building.sabotagedTicks = 0;
  return { ok: true, cost };
}

export function startBuildingTechResearch(
  building: Building,
  player: Player,
  nodeId: string,
  state: GameState,
  plot?: Plot
): { ok: boolean; error?: string } {
  if (building.activeResearchId) {
    return { ok: false, error: 'W budynku trwa już wdrażanie innego modułu.' };
  }
  const node = building.techTree.find((n) => n.id === nodeId);
  if (!node) return { ok: false, error: 'Nie znaleziono modułu technologicznego.' };
  if (node.status !== 'available') return { ok: false, error: 'Moduł nie jest dostępny.' };

  const targetPlot = plot ?? state.plots.find((p) => p.id === building.plotId);
  const reqEval = evaluateNonFinancialRequirements(node.requirements, player, state, building, targetPlot);
  if (!reqEval.allMet) {
    const first = reqEval.items.find((i) => !i.met);
    return { ok: false, error: first ? `Niespełniony warunek: ${first.label}` : 'Niespełnione wymagania.' };
  }

  const entMods = getPlayerEntrepreneurModifiers(state, player);
  const actualCost = Math.round(node.cost * (1 - entMods.researchDiscount));
  if (player.cash < actualCost) {
    return { ok: false, error: `Brak kapitału na wdrożenie (${actualCost.toLocaleString('pl-PL')} zł).` };
  }

  player.cash -= actualCost;
  consumeRequiredResources(node.requirements, player, building);
  node.status = 'researching';
  node.progress = 0;
  building.activeResearchId = node.id;
  building.status.upgradeActive = true;

  for (const other of building.techTree) {
    if (node.exclusiveWith?.includes(other.id) && other.status !== 'done') {
      other.status = 'excluded';
    }
  }

  return { ok: true };
}

export function getAggregatedBuildingModifiers(building: Building) {
  let productionBonus = 0;
  let costReduction = 0;
  let workerReduction = 0;
  let electricityDelta = 0;
  let waterDelta = 0;
  let sewageDelta = 0;
  let wasteDelta = 0;
  let sewageTreatmentBonus = 0;
  let wasteProcessingBonus = 0;
  let recyclesResources = false;
  let pollutionDelta = 0;
  let breakdownRiskDelta = 0;
  let wearRateDelta = 0;
  let influenceBonus = 0;
  let tariffBonus = 0;
  let droughtProtection = false;
  let blackoutProtection = false;
  let cleanFilter = false;
  let researchBonus = 0;
  let storageMultiplier = 1;
  let espionageDefenseBonus = 0;
  let crimeReductionBonus = 0;
  let tacticalMissileUnlocked = false;
  let isApex = false;

  for (const node of building.techTree) {
    if (node.status !== 'done') continue;
    const e = node.effects;
    if (e.productionBonus) productionBonus += e.productionBonus;
    if (e.costReduction) costReduction += e.costReduction;
    if (e.workerReduction) workerReduction += e.workerReduction;
    if (e.electricityDelta) electricityDelta += e.electricityDelta;
    if (e.waterDelta) waterDelta += e.waterDelta;
    if (e.sewageDelta) sewageDelta += e.sewageDelta;
    if (e.wasteDelta) wasteDelta += e.wasteDelta;
    if (e.sewageTreatmentBonus) sewageTreatmentBonus += e.sewageTreatmentBonus;
    if (e.wasteProcessingBonus) wasteProcessingBonus += e.wasteProcessingBonus;
    if (e.recyclesResources) recyclesResources = true;
    if (e.pollutionDelta) pollutionDelta += e.pollutionDelta;
    if (e.breakdownRiskDelta) breakdownRiskDelta += e.breakdownRiskDelta;
    if (e.wearRateDelta) wearRateDelta += e.wearRateDelta;
    if (e.influenceBonus) influenceBonus += e.influenceBonus;
    if (e.tariffBonus) tariffBonus += e.tariffBonus;
    if (e.droughtProtection) droughtProtection = true;
    if (e.blackoutProtection) blackoutProtection = true;
    if (e.cleanFilter) cleanFilter = true;
    if (e.researchBonus) researchBonus += e.researchBonus;
    if (e.storageMultiplier) storageMultiplier = Math.max(storageMultiplier, e.storageMultiplier);
    if (e.espionageDefenseBonus) espionageDefenseBonus += e.espionageDefenseBonus;
    if (e.crimeReductionBonus) crimeReductionBonus += e.crimeReductionBonus;
    if (e.tacticalMissileUnlocked) tacticalMissileUnlocked = true;
    if (e.isApex || node.isFlagship || node.tier === 4) isApex = true;
  }

  return {
    productionBonus,
    costReduction,
    workerReduction,
    electricityDelta,
    waterDelta,
    sewageDelta,
    wasteDelta,
    sewageTreatmentBonus,
    wasteProcessingBonus,
    recyclesResources,
    pollutionDelta,
    breakdownRiskDelta,
    wearRateDelta,
    influenceBonus,
    tariffBonus,
    droughtProtection,
    blackoutProtection,
    cleanFilter,
    researchBonus,
    storageMultiplier,
    espionageDefenseBonus,
    crimeReductionBonus,
    tacticalMissileUnlocked,
    isApex,
  };
}

function computeNonLinearUtilityFactor(coverageRatio: number): number {
  if (coverageRatio >= 0.99) return 1.0;
  if (coverageRatio >= 0.5) {
    // 50% pokrycia daje ~26% wydajności, poniżej szybko spada
    return 0.26 + ((coverageRatio - 0.5) / 0.49) * 0.74;
  }
  if (coverageRatio >= 0.2) {
    // 20-50% pokrycia daje ledwo 6%-26%
    return 0.06 + ((coverageRatio - 0.2) / 0.3) * 0.2;
  }
  // Poniżej 20% następuje całkowity paraliż zakładu (0% produkcji, koszty stałe zostają!)
  return 0;
}

export interface ProducedResourceLot {
  resource: ResourceType;
  plotId: string;
  playerId: string;
  qty: number;
  unitPrice: number;
  storedInWarehouse: boolean;
  revCat: string;
}

export interface UtilityTickSnapshot {
  elecRatio: number;
  waterRatio: number;
  sewageNet: number;
  wasteNet: number;
  byCluster?: Record<number, { elecRatio: number; waterRatio: number; sewageNet: number; wasteNet: number }>;
  producedLots?: ProducedResourceLot[];
  b2bDivertRemaining?: Partial<Record<ResourceType, number>>;
}

export function processBuildingTick(
  building: Building,
  plot: Plot,
  player: Player,
  state: GameState,
  supplyAccum: Partial<Record<ResourceType, number>>,
  demandAccum: Partial<Record<ResourceType, number>>,
  utilitySnapshot?: UtilityTickSnapshot
): void {
  if (building.destroyedRuins) {
    building.isActive = false;
    building.efficiency = 0;
    building.revenue = 0;
    building.netProfit = 0;
    building.productionPerTick = {};
    building.consumptionPerTick = {};
    building.activeResearchId = null;
    building.costs = {
      inputs: 0,
      wages: 0,
      zus: 0,
      energy: 0,
      water: 0,
      transport: 0,
      maintenance: 0,
      environmentalFine: 0,
      taxes: 0,
      total: 0,
    };
    return;
  }

  const def = BUILDING_DEFINITIONS[building.type];
  let bMods = getAggregatedBuildingModifiers(building);
  const entMods = getPlayerEntrepreneurModifiers(state, player);
  const techMods = getPlayerGlobalTechModifiers(state, player);
  const econMult = state.settings.economyMultiplier;
  const safetyCov = getSafetyCoverageForPlot(state, player.id, plot);

  // Twarde sprawdzenie dostępu do drogi (N/S/E/W droga/autostrada lub HQ; wyjątki: corporateHQ i cityPark)
  const roadAccessOk = isRoadExemptBuilding(building.type) || hasRoadAccess(state, plot, player.id);
  const rawLogiMode = roadAccessOk ? evaluatePlotLogisticsMode(state, player.id, plot) : 'isolated';
  const logiMode: Building['logisticsMode'] = !roadAccessOk
    ? 'isolated'
    : rawLogiMode === 'isolated'
      ? 'road'
      : rawLogiMode;
  building.logisticsMode = logiMode;
  building.hasRoadConnection = roadAccessOk;
  building.status.noRoadLink = !roadAccessOk;
  building.crimeLevel = plot.crimeScore;
  if ((building.upgradeFlashTicks ?? 0) > 0) {
    building.upgradeFlashTicks = (building.upgradeFlashTicks ?? 0) - 1;
  }
  const doneModules = building.techTree.filter((t) => t.status === 'done').length;
  building.visualTier = bMods.isApex
    ? 4
    : building.type === 'corporateHQ'
      ? Math.min(3, Math.floor((player.corporationLevel - 1) * 0.75 + doneModules * 0.35))
      : Math.min(3, doneModules);
  if (building.type === 'corporateHQ') {
    building.hqVariant = player.hqVariant ?? building.hqVariant ?? 'classic';
  }

  // 1. Rozwój wewnętrznego drzewka
  if (building.activeResearchId) {
    const activeNode = building.techTree.find((n) => n.id === building.activeResearchId);
    if (activeNode) {
      const archResearchMult = getArchetypeDefinition(player.archetype).modifiers.researchSpeedMult;
      const speedMult = (1 + entMods.researchSpeedBonus + techMods.researchSpeed) * archResearchMult;
      activeNode.progress = Math.min(
        100,
        activeNode.progress + (100 / activeNode.researchTicks) * speedMult
      );
      if (activeNode.progress >= 100) {
        activeNode.status = 'done';
        building.activeResearchId = null;
        building.status.upgradeActive = false;
        building.level = Math.min(10, building.level + 1);
        building.upgradeFlashTicks = 6;
        bMods = getAggregatedBuildingModifiers(building);
        building.storageCapacity = Math.round(def.storageCapacity * bMods.storageMultiplier);

        for (const other of building.techTree) {
          if (activeNode.exclusiveWith?.includes(other.id) && other.status !== 'done') {
            other.status = 'excluded';
          }
          if (
            other.status === 'locked' &&
            other.prerequisites.every((pid) => building.techTree.find((x) => x.id === pid)?.status === 'done')
          ) {
            const excludedByDone = other.exclusiveWith?.some((eid) => {
              const ex = building.techTree.find((x) => x.id === eid);
              return ex?.status === 'done' || ex?.status === 'researching';
            });
            other.status = excludedByDone ? 'excluded' : 'available';
          }
        }

        if (activeNode.effects.influenceBonus) {
          player.influence.financial += Math.round(activeNode.effects.influenceBonus * 0.5);
          player.influence.social += Math.round(activeNode.effects.influenceBonus * 0.5);
        }
      }
    }
  }

  // 2. Degradacja i Autonaprawa
  if (building.sabotagedTicks > 0) building.sabotagedTicks--;
  if (building.boycottedTicks > 0) building.boycottedTicks--;
  building.status.boycotted = building.boycottedTicks > 0;

  const hospitalWearReduction = safetyCov.hasHospital ? 0.72 : 1.0;
  const baseWear = building.isActive ? 0.45 : 0.08;
  const wearMultiplier = Math.max(0.35, 1 + bMods.wearRateDelta) * hospitalWearReduction;
  const dmgIncrement = baseWear * wearMultiplier * (0.7 + Math.max(0, bMods.breakdownRiskDelta));
  building.damagePercent = Math.min(95, Number((building.damagePercent + dmgIncrement).toFixed(2)));
  building.condition = Math.max(5, Number((100 - building.damagePercent).toFixed(2)));

  if (building.autoRepairEnabled && building.damagePercent >= building.autoRepairThreshold) {
    const repairCost = getRepairCost(building);
    if (player.cash >= repairCost) {
      player.cash -= repairCost;
      building.damagePercent = 0;
      building.condition = 100;
      building.status.breakdown = false;
      building.sabotagedTicks = 0;
    } else if (player.id === state.currentPlayerId && state.time.tick % 8 === 0) {
      state.notifications = [
        {
          id: `autorep_fail_${building.id}_${state.time.tick}`,
          title: 'Autonaprawa wstrzymana (ochrona przed debetem)',
          message: `${building.name} osiągnął ${Math.round(building.damagePercent)}% zniszczenia, ale brakuje ${repairCost.toLocaleString('pl-PL')} zł.`,
          severity: 'warning' as const,
          tick: state.time.tick,
        },
        ...state.notifications,
      ].slice(0, 6);
    }
  }

  if (building.damagePercent >= 70 && Math.random() < 0.08 + Math.max(0, bMods.breakdownRiskDelta)) {
    building.status.breakdown = true;
  } else if (building.damagePercent < 65 && building.sabotagedTicks === 0) {
    building.status.breakdown = false;
  }

  // 3. Zasilanie, woda, ścieki i śmieci (nieliniowa krzywa kar v4.0 + Archetyp Inkubator + Poziom Trudności)
  const archMods = getArchetypeDefinition(player.archetype).modifiers;
  const preset = DIFFICULTY_PRESETS[state.settings.difficultyPreset ?? 'standard'] ?? DIFFICULTY_PRESETS.standard;
  const isAdvancedElecTarget =
    building.category === 'processing' ||
    building.type === 'dataCenter' ||
    building.type === 'biotechLab' ||
    building.type === 'semiconductorFab' ||
    building.type === 'metroStation';
  const elecNeeded =
    def.electricityUsage *
    (1 + bMods.electricityDelta) *
    (isAdvancedElecTarget ? archMods.advancedPowerUsageMult : 1);
  const waterNeeded = def.waterUsage * (1 + bMods.waterDelta);
  const sewageNeeded = (def.sewageUsage ?? 0) * Math.max(0.2, 1 + bMods.sewageDelta);
  const wasteNeeded = (def.wasteUsage ?? 0) * Math.max(0.2, 1 + bMods.wasteDelta);

  const clusters = computeNetworkClusters(state);
  const myClusterId = clusters.clusterByPlotId.get(plot.id) ?? 0;
  const clusterSnap = utilitySnapshot?.byCluster?.[myClusterId];
  const effSnap = clusterSnap ?? utilitySnapshot;

  const playerHasOwnPower =
    plot.hasElectricity ||
    (myClusterId !== 0 &&
      state.plots.some(
        (p) =>
          p.ownerId === player.id &&
          clusters.clusterByPlotId.get(p.id) === myClusterId &&
          p.building &&
          p.building.isActive &&
          !p.building.destroyedRuins &&
          (p.building.category === 'energy' ||
            p.building.type === 'wasteIncinerator' ||
            p.building.type === 'plasmaGasificationPlant') &&
          (!getPowerPlantFuelSpec(p.building.type) ||
            ((p.building.fuelStored ?? p.building.fuelMax ?? 0) > 0.05 && !p.building.status?.noFuel))
      ));
  const playerHasOwnWater =
    plot.hasWater ||
    (myClusterId !== 0 &&
      state.plots.some(
        (p) =>
          p.ownerId === player.id &&
          clusters.clusterByPlotId.get(p.id) === myClusterId &&
          p.building &&
          p.building.isActive &&
          !p.building.destroyedRuins &&
          (p.building.type === 'waterPlant' ||
            p.building.type === 'bioSewagePlant' ||
            p.building.type === 'closedLoopSewagePlant')
      ));

  let elecRatio = 1;
  if (elecNeeded > 0 && !bMods.blackoutProtection) {
    elecRatio = !playerHasOwnPower
      ? 0
      : effSnap?.elecRatio ??
        (player.electricityBalance >= 0
          ? 1
          : Math.max(0, 1 + player.electricityBalance / Math.max(50, Math.abs(player.electricityBalance) + elecNeeded)));
  }

  let waterRatio = 1;
  if (waterNeeded > 0 && !bMods.droughtProtection) {
    waterRatio = !playerHasOwnWater
      ? 0
      : effSnap?.waterRatio ??
        (player.waterBalance >= 0
          ? 1
          : Math.max(0, 1 + player.waterBalance / Math.max(40, Math.abs(player.waterBalance) + waterNeeded)));
  }

  const powerFactor = computeNonLinearUtilityFactor(elecRatio);
  const rawWaterFactor = computeNonLinearUtilityFactor(waterRatio);
  const isFuelPlantBlackStart = getPowerPlantFuelSpec(building.type) !== null && playerHasOwnWater;
  const waterFactor = isFuelPlantBlackStart ? Math.max(0.55, rawWaterFactor) : rawWaterFactor;

  building.status.noPower = elecNeeded > 0 && elecRatio < 0.99 && !bMods.blackoutProtection;
  building.status.noWater = waterNeeded > 0 && waterRatio < 0.99 && !bMods.droughtProtection;

  const sewageNet = effSnap?.sewageNet ?? player.sewageBalance ?? 0;
  const wasteNet = effSnap?.wasteNet ?? player.wasteBalance ?? 0;
  building.status.sewageCrisis = sewageNeeded > 0 && sewageNet < -8;
  building.status.wasteCrisis = wasteNeeded > 0 && wasteNet < -8;

  if (building.status.sewageCrisis) {
    player.influence.voterApproval = Math.max(0, player.influence.voterApproval - 0.08);
    state.voterMood = Math.max(-100, state.voterMood - 0.05);
  }
  if (building.status.wasteCrisis) {
    player.influence.voterApproval = Math.max(0, player.influence.voterApproval - 0.06);
    state.voterMood = Math.max(-100, state.voterMood - 0.04);
  }

  // Dodatkowe zużycie przy krytycznym paraliżu zasilania (<20%)
  if ((elecNeeded > 0 && powerFactor === 0) || (waterNeeded > 0 && waterFactor === 0)) {
    building.damagePercent = Math.min(95, Number((building.damagePercent + 0.65).toFixed(2)));
    building.condition = Math.max(5, Number((100 - building.damagePercent).toFixed(2)));
  }

  // 4. Susza, katastrofy naturalne i strajki (lokalne + rządowe)
  if ((building.strikeTicks ?? 0) > 0) {
    building.strikeTicks = (building.strikeTicks ?? 1) - 1;
  } else if (
    building.isActive &&
    building.workers >= 4 &&
    building.damagePercent > 52 &&
    building.category !== 'safety' &&
    building.type !== 'prAgency'
  ) {
    const govStrikeMult = state.government ? GOVERNMENT_CONFIGS[state.government.currentGov].strikeRiskMult : 1;
    const hasPR = state.plots.some(
      (p) => p.ownerId === player.id && p.building?.type === 'prAgency' && p.building.isActive && !p.building.destroyedRuins
    );
    const strikeChance = 0.012 * govStrikeMult * (hasPR ? 0.35 : 1);
    if (Math.random() < strikeChance) {
      building.strikeTicks = 6;
    }
  }
  building.status.onStrike = (building.strikeTicks ?? 0) > 0;

  let droughtFactor = 1.0;
  let strikeFactor = building.status.onStrike ? 0.35 : 1.0;
  let weatherEnergyFactor = 1.0;
  for (const ev of state.activeEvents) {
    for (const eff of ev.effects) {
      if (eff.kind === 'hydroPenalty' && building.type === 'hydroPowerPlant') {
        const shield = bMods.droughtProtection ? 0.68 : techMods.droughtShield;
        droughtFactor *= 1 - eff.value * (1 - shield);
        building.status.droughtHit = !bMods.droughtProtection;
      } else if (eff.kind === 'waterPenalty' && waterNeeded > 15) {
        const shield = bMods.droughtProtection ? 0.75 : techMods.droughtShield;
        droughtFactor *= 1 - eff.value * (1 - shield);
        if (!bMods.droughtProtection) building.status.droughtHit = true;
      }
      if (eff.kind === 'weatherCloudy' && building.type === 'solarFarm') {
        weatherEnergyFactor *= Math.max(0.35, 1 - eff.value);
      }
      if (eff.kind === 'energyPenalty' && (building.category === 'energy' || building.type === 'solarFarm' || building.type === 'windFarm')) {
        if (building.type !== 'geothermalPlant' && !bMods.blackoutProtection) {
          weatherEnergyFactor *= Math.max(0.25, 1 - eff.value);
        }
      }
      if (eff.kind === 'strikeRisk' && building.category !== 'education' && building.category !== 'influence') {
        const socialShield = Math.min(0.75, (player.influence.churchSupport + player.influence.mediaControl) / 140);
        strikeFactor *= 1 - eff.value * (1 - socialShield);
      }
    }
  }
  if (state.activeEvents.every((e) => e.category !== 'weather')) {
    building.status.droughtHit = false;
  }

  // 5. Efektywność (Szpital + Atrakcje + Pożar/HAZMAT + Logistyka + Nieliniowe media)
  const effectiveRequiredWorkers = Math.max(1, Math.round(building.maxWorkers * (1 - bMods.workerReduction)));
  building.status.understaffed = building.workers < effectiveRequiredWorkers * 0.5;
  const staffingRatio = Math.min(1.2, building.workers / Math.max(1, effectiveRequiredWorkers));
  const skillFactor = 0.72 + (building.workerSkill / 100) * 0.65;
  const hospitalHRBonus = safetyCov.hasHospital ? 1.12 : 1.0;
  const damageFactor = Math.max(0.2, 1 - (building.damagePercent / 100) * 0.65);
  const conditionFactor = building.status.breakdown
    ? building.sabotagedTicks > 0
      ? 0.15
      : 0.45 * damageFactor
    : damageFactor;
  const sanitationPenaltyBase =
    (building.status.sewageCrisis ? 0.22 : 0) + (building.status.wasteCrisis ? 0.18 : 0);
  const sanitationFactor = Math.max(0.25, 1 - sanitationPenaltyBase * preset.utilityPenaltyMult);
  const utilityFactor = powerFactor * waterFactor * sanitationFactor;

  let hazardFactor = 1.0;
  if (building.activeHazard) {
    hazardFactor = building.activeHazard.contained ? 0.65 : 0.12;
  }

  const isolationFactor = logiMode === 'isolated' && (Object.keys(def.inputs).length > 0 || Object.keys(def.outputs).length > 0)
    ? 0.62
    : logiMode === 'air'
      ? 1.08
      : 1.0;

  let categoryBonus = 0;
  if (building.category === 'mining') categoryBonus += techMods.miningBonus;
  if (building.category === 'processing') categoryBonus += techMods.processingBonus;
  if (building.category === 'energy') categoryBonus += techMods.energyBonus;

  const isCommercialConsumer =
    building.category === 'real_estate' ||
    building.category === 'attractions' ||
    building.type === 'jewelryWorkshop' ||
    building.type === 'jewelryLuxury';

  let realEstateFactor = 1.0;
  if (isCommercialConsumer) {
    const attractionBoost = 1 + Math.min(25, plot.attractionBonus) * 0.008;
    realEstateFactor = Math.max(
      0.55,
      Math.min(1.38, (plot.attractiveness / 65) * attractionBoost * (1 + state.voterMood / 350))
    );
  }

  const synergyRes = evaluateSynergyForPlotAndType(state.plots, plot, building.type, clusters);
  const synPctVal = (plot.synergyPercent ?? synergyRes.netPercent) / 100;
  const demPctVal = isCommercialConsumer
    ? ((plot.passengerDemandPercent ?? synergyRes.passengerDemandPercent) - 100) / 100
    : 0;
  // Sumaryczna premia synergii i popytu pasażerskiego (koniec z podwójnym mnożeniem i kasynem w 2 tury)
  const combinedSynDem = isCommercialConsumer ? synPctVal + demPctVal * 0.65 : synPctVal;
  const cappedSynDem =
    combinedSynDem > 0.55
      ? 0.55 + (combinedSynDem - 0.55) * 0.42
      : combinedSynDem;
  const synergyFactor = Math.max(0.55, Math.min(1.95, 1 + cappedSynDem));

  let archetypeProdMult = 1.0;
  if (building.category === 'mining') archetypeProdMult *= archMods.miningYieldMult;
  if (isCommercialConsumer) archetypeProdMult *= 1 + archMods.retailMarginDelta;
  if (
    building.type === 'windFarm' ||
    building.type === 'solarFarm' ||
    building.type === 'geothermalPlant' ||
    building.type === 'fusionReactor' ||
    building.type === 'recyclingPlant' ||
    building.type === 'bioSewagePlant' ||
    building.type === 'closedLoopSewagePlant' ||
    building.type === 'plasmaGasificationPlant' ||
    building.type === 'renewableFarm'
  ) {
    archetypeProdMult *= archMods.renewableRecycleMult;
    if (state.government?.currentGov === 'ecological') {
      archetypeProdMult *= GOVERNMENT_CONFIGS.ecological.greenSubsidyMult;
    }
  }

  const boycottFactor = building.boycottedTicks > 0 ? 0.65 : 1.0;
  const disasterPlotFactor = (plot.disasterDamagedTicks ?? 0) > 0 ? 0.78 : 1.0;

  const techStackBonus = bMods.productionBonus + categoryBonus + entMods.profitBonus;
  const effectiveTechMult =
    techStackBonus <= 0.6
      ? 1 + techStackBonus
      : 1.6 + (techStackBonus - 0.6) * 0.35;

  const rawPreCap =
    !roadAccessOk || utilityFactor <= 0.001
      ? 0
      : staffingRatio *
        skillFactor *
        hospitalHRBonus *
        conditionFactor *
        utilityFactor *
        hazardFactor *
        isolationFactor *
        droughtFactor *
        strikeFactor *
        boycottFactor *
        weatherEnergyFactor *
        disasterPlotFactor *
        realEstateFactor *
        synergyFactor *
        archetypeProdMult *
        effectiveTechMult;

  const effPivot = isCommercialConsumer ? 1.72 : 1.58;
  const effCeiling = isCommercialConsumer ? 2.2 : 1.98;
  const rawEfficiency =
    rawPreCap <= effPivot
      ? rawPreCap
      : Math.min(effCeiling, effPivot + (rawPreCap - effPivot) * 0.36);

  building.efficiency = Math.round(rawEfficiency * 100);

  // 6. Wsad, fizyczne paliwo elektrowni i gospodarka zamknięta MP
  const isMpClosedEconomy = state.settings.mode === 'mp_fast' || state.settings.mode === 'mp_long';
  const fuelSpec = getPowerPlantFuelSpec(building.type);
  let inputCost = 0;
  let totalGoodsVolume = 0;
  let inputFulfillment = rawEfficiency <= 0.001 ? 0 : 1.0;
  building.status.missingInputs = false;
  building.status.noFuel = false;
  const consumptionPerTick: Partial<Record<ResourceType, number>> = {};

  for (const [resKey, baseQty] of Object.entries(def.inputs)) {
    const res = resKey as ResourceType;
    if (rawEfficiency <= 0.001) {
      consumptionPerTick[res] = 0;
      continue;
    }

    if (fuelSpec && (fuelSpec.acceptedResources.includes(res) || res === fuelSpec.primaryResource)) {
      const targetBurn = fuelSpec.consumptionPerTick * Math.max(0.2, rawEfficiency) * econMult;
      consumptionPerTick[res] = Number(targetBurn.toFixed(2));
      demandAccum[res] = (demandAccum[res] ?? 0) + targetBurn;
      totalGoodsVolume += targetBurn;

      const maxStock = building.fuelMax ?? fuelSpec.maxStock;
      building.fuelMax = maxStock;
      building.fuelResource = building.fuelResource ?? fuelSpec.primaryResource;
      const availFuel = Math.max(0, building.fuelStored ?? 0);
      const burned = Math.min(availFuel, targetBurn);
      building.fuelStored = Math.max(0, Number((availFuel - burned).toFixed(2)));
      building.fuelLevel = Math.max(0, Math.min(100, Math.round((building.fuelStored / maxStock) * 100)));

      if (burned <= 0.005) {
        building.status.noFuel = true;
        building.status.missingInputs = true;
        inputFulfillment = 0;
        building.efficiency = 0;
      } else if (burned < targetBurn * 0.98) {
        const burnRatio = burned / Math.max(0.01, targetBurn);
        building.status.noFuel = building.fuelStored <= 0.005;
        inputFulfillment = Math.min(inputFulfillment, burnRatio);
        building.efficiency = Math.round(rawEfficiency * 100 * burnRatio);
      } else {
        building.status.noFuel = false;
      }
      continue;
    }

    const qty = (baseQty ?? 0) * Math.max(0.2, rawEfficiency) * econMult;
    consumptionPerTick[res] = Number(qty.toFixed(2));
    demandAccum[res] = (demandAccum[res] ?? 0) + qty;
    totalGoodsVolume += qty;

    if (res === 'water') {
      const coveredByPipe = qty * Math.min(1, waterRatio);
      if (coveredByPipe >= qty * 0.96) continue;
    }

    let remainingNeed = qty;
    const localStock = building.storage[res] ?? 0;
    const fromLocal = Math.min(localStock, remainingNeed);
    if (fromLocal > 0) {
      building.storage[res] = localStock - fromLocal;
      remainingNeed -= fromLocal;
    }
    const warehouseTaken = consumeReachableWarehouseStock(state, player, plot, res, remainingNeed);
    if (warehouseTaken.consumed > 0) {
      remainingNeed -= warehouseTaken.consumed;
    }
    if (remainingNeed > 0.001 && (!player.stockLocations || Object.keys(player.stockLocations).length === 0)) {
      const ownedStock = player.warehouseStockpile[res] ?? 0;
      const fromStock = Math.min(ownedStock, remainingNeed);
      if (fromStock > 0) {
        player.warehouseStockpile[res] = ownedStock - fromStock;
        remainingNeed -= fromStock;
      }
    }
    if (remainingNeed > 0.001) {
      if (isMpClosedEconomy || !hasExternalMarketAccess(state, plot, player.id)) {
        // Gospodarka zamknięta MP lub działka bez dostępu do rynku: brak zakupów spot z powietrza!
        building.status.missingInputs = true;
        const coveredRatio = Math.max(0, (qty - remainingNeed) / Math.max(0.01, qty));
        inputFulfillment = Math.min(inputFulfillment, coveredRatio);
      } else {
        const mktPrice = getResourcePrice(state, res) * (1 - entMods.buyPriceDiscount);
        const cost = remainingNeed * mktPrice * (1 - Math.min(0.4, bMods.costReduction));
        if (player.cash >= cost || player.cash > -200_000) {
          inputCost += cost;
        } else {
          building.status.missingInputs = true;
          inputFulfillment = Math.min(inputFulfillment, 0.35);
        }
      }
    }
  }
  building.consumptionPerTick = consumptionPerTick;

  const revCat =
    building.category === 'mining'
      ? 'Wydobycie'
      : building.category === 'processing'
        ? 'Przetwórstwo'
        : building.category === 'energy'
          ? 'Energetyka'
          : building.category === 'waste'
            ? 'Gospodarka Odpadami i Ścieki'
            : building.category === 'real_estate' || building.category === 'attractions' || building.category === 'finance'
              ? 'Nieruchomości, Atrakcje i Finanse'
              : 'Usługi i Bezpieczeństwo';

  // 7. Produkcja i przychód
  const depositRichness = def.requiredDeposit
    ? plot.deposits.find((d) => d.type === def.requiredDeposit)?.richness ?? 1
    : 1;

  let grossRevenue =
    !roadAccessOk || rawEfficiency <= 0.001
      ? 0
      : def.baseRevenue *
        rawEfficiency *
        econMult *
        boycottFactor *
        (Object.keys(def.inputs).length > 0
          ? fuelSpec
            ? inputFulfillment
            : Math.max(0.15, inputFulfillment)
          : 1);
  const productionPerTick: Partial<Record<ResourceType, number>> = {};
  if (fuelSpec && (building.status.noFuel || inputFulfillment <= 0.01)) {
    productionPerTick.electricity = 0;
  }

  for (const [resKey, baseOut] of Object.entries(def.outputs)) {
    const res = resKey as ResourceType;
    const produced =
      !roadAccessOk || rawEfficiency <= 0.001
        ? 0
        : (baseOut ?? 0) * rawEfficiency * depositRichness * inputFulfillment * econMult;
    productionPerTick[res] = Number(produced.toFixed(2));
    if (produced <= 0) continue;

    supplyAccum[res] = (supplyAccum[res] ?? 0) + produced;
    totalGoodsVolume += produced;

    // Sortownia z Recyklingiem i Gazyfikacja Plazmowa odzyskują metale bezpośrednio do magazynu
    if (
      bMods.recyclesResources ||
      building.type === 'recyclingPlant' ||
      building.type === 'plasmaGasificationPlant'
    ) {
      addPlotWarehouseStock(player, plot.id, res, produced);
      utilitySnapshot?.producedLots?.push({
        resource: res,
        plotId: plot.id,
        playerId: player.id,
        qty: produced,
        unitPrice: 0,
        storedInWarehouse: true,
        revCat,
      });
      continue;
    }

    if (building.stockpileOutput) {
      const currentStorageTotal = Object.values(building.storage).reduce((a, b) => a + (b ?? 0), 0);
      if (currentStorageTotal + produced <= building.storageCapacity) {
        building.storage[res] = (building.storage[res] ?? 0) + produced;
        building.status.storageFull = false;
        utilitySnapshot?.producedLots?.push({
          resource: res,
          plotId: plot.id,
          playerId: player.id,
          qty: produced,
          unitPrice: 0,
          storedInWarehouse: true,
          revCat,
        });
      } else {
        const hasWarehouse = state.plots.some(
          (p) => p.ownerId === player.id && p.building?.type === 'warehouse'
        );
        if (hasWarehouse || isMpClosedEconomy) {
          addPlotWarehouseStock(player, plot.id, res, produced);
          building.status.storageFull = false;
          utilitySnapshot?.producedLots?.push({
            resource: res,
            plotId: plot.id,
            playerId: player.id,
            qty: produced,
            unitPrice: 0,
            storedInWarehouse: true,
            revCat,
          });
        } else {
          building.status.storageFull = true;
          const unitPrice = getResourcePrice(state, res) * (1 + entMods.sellPriceBonus + bMods.tariffBonus) * 0.85;
          grossRevenue += produced * unitPrice;
          utilitySnapshot?.producedLots?.push({
            resource: res,
            plotId: plot.id,
            playerId: player.id,
            qty: produced,
            unitPrice,
            storedInWarehouse: false,
            revCat,
          });
        }
      }
    } else {
      building.status.storageFull = false;
      const needB2B = res !== 'electricity' ? (utilitySnapshot?.b2bDivertRemaining?.[res] ?? 0) : 0;
      const diverted = needB2B > 0.001 ? Math.min(produced, needB2B) : 0;
      if (diverted > 0.001 && utilitySnapshot?.b2bDivertRemaining) {
        utilitySnapshot.b2bDivertRemaining[res] = Math.max(0, Number((needB2B - diverted).toFixed(2)));
        addPlotWarehouseStock(player, plot.id, res, diverted);
        utilitySnapshot.producedLots?.push({
          resource: res,
          plotId: plot.id,
          playerId: player.id,
          qty: diverted,
          unitPrice: 0,
          storedInWarehouse: true,
          revCat,
        });
      }
      const marketSold = Math.max(0, produced - diverted);
      if (marketSold > 0.001) {
        const unitPrice = getResourcePrice(state, res) * (1 + entMods.sellPriceBonus + bMods.tariffBonus);
        grossRevenue += marketSold * unitPrice;
        utilitySnapshot?.producedLots?.push({
          resource: res,
          plotId: plot.id,
          playerId: player.id,
          qty: marketSold,
          unitPrice,
          storedInWarehouse: false,
          revCat,
        });
      }
    }
  }
  building.productionPerTick = productionPerTick;

  // 8. Punkty badań (zrebalansowane pod realne placówki + Kampus Innowacji), nastroje i wpływy
  if (
    roadAccessOk &&
    (building.category === 'education' ||
      building.type === 'spaceCenter' ||
      building.type === 'intelligenceCenter' ||
      building.type === 'biotechLab') &&
    utilityFactor > 0.25
  ) {
    const baseRP =
      building.type === 'highSchool'
        ? 2.2
        : building.type === 'university'
          ? 6.5
          : building.type === 'rdLab'
            ? 9.5
            : building.type === 'dataCenter'
              ? 7.2
              : building.type === 'spaceCenter'
                ? 4.0
                : building.type === 'biotechLab'
                  ? 3.0
                  : 1.8;
    const grantMult = state.activeEvents.some((e) => e.effects.some((ef) => ef.kind === 'researchBoost'))
      ? 1.5
      : 1;
    player.researchPoints +=
      baseRP *
      (1 + bMods.researchBonus + synergyRes.researchClusterBonus) *
      archMods.researchSpeedMult *
      Math.min(1.5, rawEfficiency) *
      grantMult;
  }

  if (roadAccessOk && ((building.category === 'attractions' && building.type !== 'casino') || building.type === 'biotechLab' || building.type === 'verticalFarm')) {
    state.voterMood = Math.min(100, state.voterMood + 0.18);
    player.reputation = Math.min(100, player.reputation + 0.15);
  }
  if (roadAccessOk && building.type === 'wasteIncinerator' && archMods.incineratorApprovalPenalty > 0) {
    player.influence.voterApproval = Math.max(0, player.influence.voterApproval - archMods.incineratorApprovalPenalty);
  }
  if (roadAccessOk && building.type === 'hospital') {
    state.voterMood = Math.min(100, state.voterMood + 0.22);
    player.reputation = Math.min(100, player.reputation + 0.2);
  }
  if (roadAccessOk && building.type === 'casino') {
    player.influence.churchSupport = Math.max(0, player.influence.churchSupport - 0.35);
    state.voterMood = Math.max(-100, state.voterMood - 0.14);
    const nearbyLuxury = state.plots.some(
      (p) =>
        p.id !== plot.id &&
        p.building?.isActive &&
        (p.building.type === 'hotel' ||
          p.building.type === 'resort' ||
          p.building.type === 'jewelryWorkshop') &&
        Math.hypot(p.gridX - plot.gridX, p.gridY - plot.gridY) <= 4.5
    );
    if (nearbyLuxury) {
      grossRevenue = Math.round(grossRevenue * 1.08);
    }
  }
  if (building.type === 'corporateHQ') {
    // Drastycznie spowolnione pasywne punkty z centrali — wymagane są prawdziwe szkoły/uczelnie/Data Center!
    player.researchPoints += 0.45 * archMods.researchSpeedMult;
    player.influence.financial += 0.35;
  }
  if (roadAccessOk && (building.type === 'jewelryWorkshop' || building.type === 'jewelryLuxury')) {
    player.reputation = Math.min(100, player.reputation + (building.type === 'jewelryLuxury' ? 0.25 : 0.12));
  }
  if (roadAccessOk && building.type === 'coldStorage') {
    state.voterMood = Math.min(100, state.voterMood + 0.1);
  }
  if (roadAccessOk && (building.type === 'lobbyOffice' || building.type === 'investmentBank')) {
    player.influence.financial += 0.65 * Math.min(1.5, rawEfficiency);
  }
  if (roadAccessOk && building.type === 'mediaAgency') {
    player.influence.mediaControl = Math.min(100, player.influence.mediaControl + 0.55);
    player.influence.social += 0.5;
    player.influence.voterApproval = Math.min(100, player.influence.voterApproval + 0.15);
  }
  if (roadAccessOk && building.type === 'churchFoundation') {
    player.influence.churchSupport = Math.min(100, player.influence.churchSupport + 0.6);
    player.influence.social += 0.55;
    state.voterMood = Math.min(100, state.voterMood + 0.25);
  }
  if (roadAccessOk && (building.type === 'weaponsComplex' || building.type === 'intelligenceCenter' || building.type === 'militaryBase')) {
    const milMult = building.type === 'militaryBase' ? 1.65 : 1.0;
    player.influence.military += 0.65 * milMult * Math.min(1.5, rawEfficiency);
    player.militaryPower = Math.min(350, player.militaryPower + 0.6 * milMult);
    if (building.type === 'militaryBase') {
      state.voterMood = Math.max(-100, state.voterMood - 0.08);
    }
  }

  // 9. Koszty operacyjne
  const hr = calculateBuildingHRPayroll(building, state, player);
  const elecPrice = getResourcePrice(state, 'electricity');
  const waterPrice = getResourcePrice(state, 'water');
  const energyCost = elecNeeded > 0 && powerFactor > 0 ? elecNeeded * (elecPrice / 10) : 0;
  const waterCost = waterNeeded > 0 && waterFactor > 0 ? waterNeeded * (waterPrice / 5) : 0;

  const fuelPrice = getResourcePrice(state, 'fuel');
  const hasAdjacentHighway = state.plots.some(
    (p) =>
      p.roadType === 'highway' &&
      Math.hypot(p.gridX - plot.gridX, p.gridY - plot.gridY) <= 1.5
  );
  const effectiveRoadDist = hasAdjacentHighway
    ? Math.max(0.4, plot.distanceToRoad * 0.65)
    : plot.distanceToRoad;
  const rawTransportCost = calculateTransportCostForBuilding(
    effectiveRoadDist,
    totalGoodsVolume,
    fuelPrice,
    player,
    state,
    logiMode
  );
  const transportCost = rawTransportCost * (1 - synergyRes.internalTransportDiscount);

  const fleetUpkeep = building.fleetSize
    ? building.fleetSize * 210 * (building.category === 'logistics' ? archMods.passengerFleetCostMult : 1)
    : 0;
  const hasHQDiscount = state.plots.some(
    (p) => p.ownerId === player.id && p.building?.type === 'corporateHQ' && p.building.isActive
  )
    ? 0.9
    : 1.0;
  const safetyMaintenanceFactor =
    building.category === 'safety' ? Math.max(0.5, 1 - entMods.safetyDiscount) : safetyCov.hasFireStation ? 0.85 : 1.0;
  const upkeepArchMult =
    building.category === 'mining' || building.category === 'processing'
      ? archMods.industrialUpkeepMult
      : building.category === 'logistics'
        ? archMods.passengerFleetCostMult
        : 1.0;
  const insurancePremium = building.insured ? getInsurancePremiumPerTick(building) : 0;

  const maintenance =
    (def.baseMaintenance + fleetUpkeep) *
    (1 - Math.min(0.4, bMods.costReduction)) *
    safetyMaintenanceFactor *
    hasHQDiscount *
    upkeepArchMult *
    preset.maintenanceMult *
    (building.type === 'warehouse' ? 1 - entMods.warehouseDiscount : 1) +
    insurancePremium;

  const effectivePollution = Math.max(0, def.pollutionLevel + bMods.pollutionDelta);
  const envShield = player.actionCooldowns['env_shield'] ? 0.1 : 1;
  const greenPolicyMult = state.activeEvents.some((e) => e.id === 'green_subsidies') ? 1.5 : 1;
  const govEcoPenaltyMult =
    state.government?.currentGov === 'ecological'
      ? GOVERNMENT_CONFIGS.ecological.coalPenaltyMult
      : state.government?.currentGov === 'free_market'
        ? GOVERNMENT_CONFIGS.free_market.coalPenaltyMult
        : 1.0;
  const carbonTaxExtra =
    state.carbonTaxActive &&
    (building.type === 'coalPowerPlant' || building.type === 'coalMine' || building.type === 'wasteIncinerator')
      ? 2_600
      : 0;
  const sanitationFine =
    ((building.status.sewageCrisis ? 420 : 0) + (building.status.wasteCrisis ? 360 : 0)) * preset.utilityPenaltyMult;
  const environmentalFine =
    (effectivePollution > 3 && !bMods.cleanFilter
      ? effectivePollution * 115 * envShield * greenPolicyMult * govEcoPenaltyMult * archMods.pollutionFineMult * (1 - techMods.taxReduction)
      : 0) +
    sanitationFine +
    carbonTaxExtra;

  const hasLawFirm = state.plots.some(
    (p) => p.ownerId === player.id && p.building?.type === 'lawFirm' && p.building.isActive && !p.building.destroyedRuins
  );
  const operatingCosts = inputCost + hr.wages + hr.zus + energyCost + waterCost + transportCost + maintenance + environmentalFine;
  const taxableProfit = Math.max(0, grossRevenue - operatingCosts);
  const effectiveCIT = Math.max(
    0.04,
    state.taxRate *
      (1 - entMods.taxReduction - techMods.taxReduction - (hasLawFirm ? 0.1 : 0)) *
      (player.activeTaxReliefTicks > 0 ? 0.6 : 1)
  );
  const taxes =
    taxableProfit * effectiveCIT +
    (building.category === 'processing' ? grossRevenue * GAME_CONFIG.vatExciseRate * 0.25 : 0);

  const totalCosts = operatingCosts + taxes;
  const netProfit = grossRevenue - totalCosts;

  building.revenue = Math.round(grossRevenue);
  building.costs = {
    inputs: Math.round(inputCost),
    wages: Math.round(hr.wages),
    zus: Math.round(hr.zus),
    energy: Math.round(energyCost),
    water: Math.round(waterCost),
    transport: Math.round(transportCost),
    maintenance: Math.round(maintenance),
    environmentalFine: Math.round(environmentalFine),
    taxes: Math.round(taxes),
    total: Math.round(totalCosts),
  };
  building.netProfit = Math.round(netProfit);

  player.cash += netProfit;
  player.totalRevenueEarned += grossRevenue;

  player.lastTickRevenueByCategory[revCat] =
    (player.lastTickRevenueByCategory[revCat] ?? 0) + grossRevenue;

  player.lastTickCostsByCategory['Surowce i Wsad'] =
    (player.lastTickCostsByCategory['Surowce i Wsad'] ?? 0) + inputCost;
  player.lastTickCostsByCategory['Kadry i Składki ZUS'] =
    (player.lastTickCostsByCategory['Kadry i Składki ZUS'] ?? 0) + hr.wages + hr.zus;
  player.lastTickCostsByCategory['Logistyka i Media'] =
    (player.lastTickCostsByCategory['Logistyka i Media'] ?? 0) + transportCost + energyCost + waterCost;
  player.lastTickCostsByCategory['Utrzymanie i Kary'] =
    (player.lastTickCostsByCategory['Utrzymanie i Kary'] ?? 0) + maintenance + environmentalFine;

  player.lastTickTaxes.cit += taxes;
  player.lastTickTaxes.environmental += environmentalFine;

  if (effectivePollution >= 6) {
    state.voterMood = Math.max(-100, state.voterMood - 0.08);
  }
}

/**
 * Fizyczna logistyka paliwa do elektrowni w 3 priorytetach:
 * 1) Własne połączone kopalnie/rafinerie lub magazyn klastra,
 * 2) Aktywne osiągalne kontrakty B2B,
 * 3) Opcjonalny awaryjny import z rynku (+35% kosztów przy połączeniu z rynkiem/portem).
 */
export function processPowerPlantFuelDeliveriesTick(
  state: GameState,
  producedLots: ProducedResourceLot[],
  b2bReceipts: B2BFuelReceipt[]
): void {
  state.fuelDeliveries = [];
  const plotsById = new Map<string, Plot>();
  for (const p of state.plots) plotsById.set(p.id, p);
  const clusters = computeNetworkClusters(state);

  for (const plantPlot of state.plots) {
    const b = plantPlot.building;
    if (!b || !b.isActive || b.destroyedRuins) continue;
    const spec = getPowerPlantFuelSpec(b.type);
    if (!spec) continue;

    const owner = plantPlot.ownerId ? state.players.find((pl) => pl.id === plantPlot.ownerId) : undefined;
    if (!owner || owner.isEliminated) continue;

    const maxStock = b.fuelMax ?? spec.maxStock;
    b.fuelMax = maxStock;
    b.fuelResource = b.fuelResource ?? spec.primaryResource;
    let stored = Math.max(0, b.fuelStored ?? maxStock * 0.5);

    const roadOk = isRoadExemptBuilding(b.type) || hasRoadAccess(state, plantPlot, owner.id);
    if (!roadOk) {
      b.fuelStored = stored;
      b.fuelLevel = Math.max(0, Math.min(100, Math.round((stored / maxStock) * 100)));
      b.fuelSourceMode = 'none';
      continue;
    }

    const headroom = Math.max(0, maxStock - stored);
    let need = Math.min(headroom, spec.consumptionPerTick * 1.65);
    let sourceMode: NonNullable<Building['fuelSourceMode']> = 'none';

    // Priorytet 1a: Bieżąca produkcja własnych połączonych kopalń / rafinerii
    if (need > 0.01) {
      const candidateLots = producedLots
        .filter((lot) => lot.playerId === owner.id && lot.qty > 0.01 && spec.acceptedResources.includes(lot.resource))
        .sort((a, z) => {
          const ap = a.resource === spec.primaryResource ? 0 : 1;
          const zp = z.resource === spec.primaryResource ? 0 : 1;
          return ap - zp;
        });

      for (const lot of candidateLots) {
        if (need <= 0.01) break;
        const srcPlot = plotsById.get(lot.plotId);
        if (!srcPlot) continue;
        const route = canTransportGoodsBetweenPlots(state, srcPlot, plantPlot, owner.id);
        if (!route.reachable || route.mode === 'blocked') continue;

        const take = Math.min(need, lot.qty);
        lot.qty -= take;
        if (!lot.storedInWarehouse) {
          const refund = take * lot.unitPrice;
          owner.cash -= refund;
          owner.totalRevenueEarned = Math.max(0, owner.totalRevenueEarned - refund);
          if (lot.revCat) {
            owner.lastTickRevenueByCategory[lot.revCat] = Math.max(
              0,
              (owner.lastTickRevenueByCategory[lot.revCat] ?? 0) - refund
            );
          }
          if (srcPlot.building) {
            srcPlot.building.revenue = Math.max(0, Math.round(srcPlot.building.revenue - refund));
            srcPlot.building.netProfit = Math.round(srcPlot.building.netProfit - refund);
          }
        } else if (srcPlot.building && (srcPlot.building.storage[lot.resource] ?? 0) >= take) {
          srcPlot.building.storage[lot.resource] = Math.max(
            0,
            (srcPlot.building.storage[lot.resource] ?? 0) - take
          );
        } else {
          consumePlotWarehouseStock(owner, srcPlot.id, lot.resource, take);
        }

        stored += take;
        need -= take;
        sourceMode = 'mine';
        state.fuelDeliveries.push({
          fromPlotId: route.fromPlotId || srcPlot.id,
          toPlotId: route.toPlotId || plantPlot.id,
          resource: lot.resource,
          mode: route.mode,
          ownerId: owner.id,
        });
      }
    }

    // Priorytet 1b: Zapas z własnego magazynu klastra / połączonego portu lub lotniska
    if (need > 0.01) {
      for (const res of spec.acceptedResources) {
        if (need <= 0.01) break;
        const taken = consumeReachableWarehouseStock(state, owner, plantPlot, res, need);
        if (taken.consumed > 0) {
          stored += taken.consumed;
          need -= taken.consumed;
          sourceMode = 'mine';
          for (const d of taken.deliveries) {
            state.fuelDeliveries.push({
              fromPlotId: d.fromPlotId,
              toPlotId: plantPlot.id,
              resource: res,
              mode: d.mode,
              ownerId: owner.id,
            });
          }
        }
      }
    }

    // Priorytet 2: Dostawy z aktywnych kontraktów B2B w zasięgu transportu
    if (need > 0.01) {
      for (const rcpt of b2bReceipts) {
        if (need <= 0.01) break;
        if (rcpt.buyerId !== owner.id || rcpt.remainingQty <= 0.01) continue;
        if (!spec.acceptedResources.includes(rcpt.resource)) continue;
        const arrivalPlot = plotsById.get(rcpt.arrivalPlotId);
        if (!arrivalPlot) continue;
        const route = canTransportGoodsBetweenPlots(state, arrivalPlot, plantPlot, owner.id);
        if (!route.reachable || route.mode === 'blocked') continue;

        const take = Math.min(need, rcpt.remainingQty);
        rcpt.remainingQty -= take;
        consumePlotWarehouseStock(owner, arrivalPlot.id, rcpt.resource, take);
        stored += take;
        need -= take;
        if (sourceMode === 'none') sourceMode = 'b2b';
        state.fuelDeliveries.push({
          fromPlotId: rcpt.fromPlotId || route.fromPlotId || arrivalPlot.id,
          toPlotId: plantPlot.id,
          resource: rcpt.resource,
          mode: route.mode,
          ownerId: owner.id,
        });
      }
    }

    // Priorytet 3: Opcjonalny awaryjny import z rynku (+35% narzutu)
    if (need > 0.01 && b.emergencyMarketImport && hasExternalMarketAccess(state, plantPlot, owner.id)) {
      const entMods = getPlayerEntrepreneurModifiers(state, owner);
      const unitCost =
        getResourcePrice(state, spec.primaryResource) * (1 - entMods.buyPriceDiscount) * 1.35;
      const buyQty = owner.cash > -150_000 ? Number(need.toFixed(2)) : 0;
      if (buyQty > 0) {
        const totalCost = buyQty * unitCost;
        owner.cash -= totalCost;
        owner.lastTickCostsByCategory['Surowce i Wsad'] =
          (owner.lastTickCostsByCategory['Surowce i Wsad'] ?? 0) + totalCost;
        b.costs.inputs = Math.round((b.costs.inputs ?? 0) + totalCost);
        b.costs.total = Math.round((b.costs.total ?? 0) + totalCost);
        stored += buyQty;
        need = Math.max(0, need - buyQty);
        if (sourceMode === 'none') sourceMode = 'market';

        const cid = clusters.clusterByPlotId.get(plantPlot.id) ?? 0;
        const clusterPlots = clusters.clusterPlots.get(cid) ?? [];
        const entryPlot =
          clusterPlots.find((p) => p.terrain === 'urban') ??
          clusterPlots.find(
            (p) =>
              p.building?.isActive &&
              (p.building.type === 'cargoPort' || p.building.type === 'cargoAirport')
          ) ??
          plantPlot;
        if (entryPlot.id !== plantPlot.id) {
          state.fuelDeliveries.push({
            fromPlotId: entryPlot.id,
            toPlotId: plantPlot.id,
            resource: spec.primaryResource,
            mode: 'road',
            ownerId: owner.id,
          });
        }
      }
    }

    b.fuelStored = Math.min(maxStock, Number(stored.toFixed(2)));
    b.fuelLevel = Math.max(0, Math.min(100, Math.round((b.fuelStored / maxStock) * 100)));
    b.fuelSourceMode = sourceMode;
    b.status.noFuel = b.fuelStored <= 0.005;
  }
}
