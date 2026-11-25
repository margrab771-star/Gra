import { CORPORATION_LEVELS, GAME_CONFIG, TERRAIN_NAMES } from '../config/gameConfig';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { RESOURCE_DEFINITIONS } from '../data/resources';
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
import { evaluatePlotLogisticsMode } from './TransportSystem';
import type {
  Building,
  BuildingTechNode,
  BuildingType,
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
  let materialsCost = 0;
  for (const [res, qty] of Object.entries(def.buildConstructionInputs)) {
    if (!qty) continue;
    const stock = player.warehouseStockpile[res as ResourceType] ?? 0;
    const missing = Math.max(0, qty - stock);
    materialsCost += missing * getResourcePrice(state, res as ResourceType) * (1 - mods.buyPriceDiscount);
  }
  return Math.round(def.baseCost + materialsCost);
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
  const logiMode = evaluatePlotLogisticsMode(state, player.id, plot);

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
      noRoadLink: logiMode === 'isolated',
      robberyActive: false,
      missingInputs: false,
      sewageCrisis: false,
      wasteCrisis: false,
      disasterStruck: false,
    },
    activeHazard: null,
    hasRoadConnection: logiMode === 'road',
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
  return { ok: true };
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
    if (e.isApex || node.tier === 4) isApex = true;
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

export interface UtilityTickSnapshot {
  elecRatio: number;
  waterRatio: number;
  sewageNet: number;
  wasteNet: number;
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

  // Sprawdź logistykę wielomodalną i aktualizuj warstwę wizualną (visualTier 0..4 Apex)
  const logiMode = evaluatePlotLogisticsMode(state, player.id, plot);
  building.logisticsMode = logiMode;
  building.hasRoadConnection = logiMode === 'road';
  building.status.noRoadLink = logiMode === 'isolated';
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

  // 1. Rozwój wewnętrznego drzewka
  if (building.activeResearchId) {
    const activeNode = building.techTree.find((n) => n.id === building.activeResearchId);
    if (activeNode) {
      const speedMult = 1 + entMods.researchSpeedBonus + techMods.researchSpeed;
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

  // 3. Zasilanie, woda, ścieki i śmieci (nieliniowa krzywa kar v4.0)
  const elecNeeded = def.electricityUsage * (1 + bMods.electricityDelta);
  const waterNeeded = def.waterUsage * (1 + bMods.waterDelta);
  const sewageNeeded = (def.sewageUsage ?? 0) * Math.max(0.2, 1 + bMods.sewageDelta);
  const wasteNeeded = (def.wasteUsage ?? 0) * Math.max(0.2, 1 + bMods.wasteDelta);

  const playerHasOwnPower =
    plot.hasElectricity ||
    state.plots.some(
      (p) =>
        p.ownerId === player.id &&
        p.building &&
        p.building.isActive &&
        !p.building.destroyedRuins &&
        (p.building.category === 'energy' || p.building.type === 'wasteIncinerator')
    );
  const playerHasOwnWater =
    plot.hasWater ||
    state.plots.some(
      (p) => p.ownerId === player.id && p.building?.type === 'waterPlant' && p.building.isActive && !p.building.destroyedRuins
    );

  let elecRatio = 1;
  if (elecNeeded > 0 && !bMods.blackoutProtection) {
    elecRatio = !playerHasOwnPower
      ? 0
      : utilitySnapshot?.elecRatio ??
        (player.electricityBalance >= 0
          ? 1
          : Math.max(0, 1 + player.electricityBalance / Math.max(50, Math.abs(player.electricityBalance) + elecNeeded)));
  }

  let waterRatio = 1;
  if (waterNeeded > 0 && !bMods.droughtProtection) {
    waterRatio = !playerHasOwnWater
      ? 0
      : utilitySnapshot?.waterRatio ??
        (player.waterBalance >= 0
          ? 1
          : Math.max(0, 1 + player.waterBalance / Math.max(40, Math.abs(player.waterBalance) + waterNeeded)));
  }

  const powerFactor = computeNonLinearUtilityFactor(elecRatio);
  const waterFactor = computeNonLinearUtilityFactor(waterRatio);

  building.status.noPower = elecNeeded > 0 && elecRatio < 0.99 && !bMods.blackoutProtection;
  building.status.noWater = waterNeeded > 0 && waterRatio < 0.99 && !bMods.droughtProtection;

  const sewageNet = utilitySnapshot?.sewageNet ?? player.sewageBalance ?? 0;
  const wasteNet = utilitySnapshot?.wasteNet ?? player.wasteBalance ?? 0;
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

  // 4. Susza, katastrofy naturalne i strajki
  let droughtFactor = 1.0;
  let strikeFactor = 1.0;
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
  const sanitationFactor =
    (building.status.sewageCrisis ? 0.78 : 1.0) * (building.status.wasteCrisis ? 0.82 : 1.0);
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

  let realEstateFactor = 1.0;
  if (
    building.category === 'real_estate' ||
    building.category === 'attractions' ||
    building.type === 'jewelryWorkshop' ||
    building.type === 'jewelryLuxury'
  ) {
    const attractionBoost = 1 + plot.attractionBonus * 0.014;
    realEstateFactor = Math.max(0.35, (plot.attractiveness / 65) * attractionBoost * (1 + state.voterMood / 250));
  }

  const boycottFactor = building.boycottedTicks > 0 ? 0.65 : 1.0;
  const disasterPlotFactor = (plot.disasterDamagedTicks ?? 0) > 0 ? 0.78 : 1.0;

  const rawEfficiency =
    utilityFactor <= 0.001
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
        (1 + bMods.productionBonus + categoryBonus + entMods.profitBonus);

  building.efficiency = Math.round(rawEfficiency * 100);

  // 6. Wsad i gospodarka zamknięta MP
  const isMpClosedEconomy = state.settings.mode === 'mp_fast' || state.settings.mode === 'mp_long';
  let inputCost = 0;
  let totalGoodsVolume = 0;
  let inputFulfillment = rawEfficiency <= 0.001 ? 0 : 1.0;
  building.status.missingInputs = false;
  const consumptionPerTick: Partial<Record<ResourceType, number>> = {};

  for (const [resKey, baseQty] of Object.entries(def.inputs)) {
    const res = resKey as ResourceType;
    if (rawEfficiency <= 0.001) {
      consumptionPerTick[res] = 0;
      continue;
    }
    const qty = (baseQty ?? 0) * Math.max(0.2, rawEfficiency) * econMult;
    consumptionPerTick[res] = Number(qty.toFixed(2));
    demandAccum[res] = (demandAccum[res] ?? 0) + qty;
    totalGoodsVolume += qty;

    let remainingNeed = qty;
    const localStock = building.storage[res] ?? 0;
    const fromLocal = Math.min(localStock, remainingNeed);
    if (fromLocal > 0) {
      building.storage[res] = localStock - fromLocal;
      remainingNeed -= fromLocal;
    }
    const ownedStock = player.warehouseStockpile[res] ?? 0;
    const fromStock = Math.min(ownedStock, remainingNeed);
    if (fromStock > 0) {
      player.warehouseStockpile[res] = ownedStock - fromStock;
      remainingNeed -= fromStock;
    }
    if (remainingNeed > 0.001) {
      if (isMpClosedEconomy) {
        // Gospodarka zamknięta MP: ZERO zakupów spot od NPC! Zakład staje lub zwalnia proporcjonalnie do wkładu własnego.
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

  // 7. Produkcja i przychód
  const depositRichness = def.requiredDeposit
    ? plot.deposits.find((d) => d.type === def.requiredDeposit)?.richness ?? 1
    : 1;

  let grossRevenue =
    rawEfficiency <= 0.001 ? 0 : def.baseRevenue * rawEfficiency * econMult * boycottFactor * (Object.keys(def.inputs).length > 0 ? Math.max(0.15, inputFulfillment) : 1);
  const productionPerTick: Partial<Record<ResourceType, number>> = {};

  for (const [resKey, baseOut] of Object.entries(def.outputs)) {
    const res = resKey as ResourceType;
    const produced =
      rawEfficiency <= 0.001 ? 0 : (baseOut ?? 0) * rawEfficiency * depositRichness * inputFulfillment * econMult;
    productionPerTick[res] = Number(produced.toFixed(2));
    if (produced <= 0) continue;

    supplyAccum[res] = (supplyAccum[res] ?? 0) + produced;
    totalGoodsVolume += produced;

    // Sortownia z Recyklingiem odzyskuje metale bezpośrednio do magazynu (lub do obrotu)
    if (bMods.recyclesResources || building.type === 'recyclingPlant') {
      player.warehouseStockpile[res] = (player.warehouseStockpile[res] ?? 0) + produced;
      continue;
    }

    if (building.stockpileOutput) {
      const currentStorageTotal = Object.values(building.storage).reduce((a, b) => a + (b ?? 0), 0);
      if (currentStorageTotal + produced <= building.storageCapacity) {
        building.storage[res] = (building.storage[res] ?? 0) + produced;
        building.status.storageFull = false;
      } else {
        const hasWarehouse = state.plots.some(
          (p) => p.ownerId === player.id && p.building?.type === 'warehouse'
        );
        if (hasWarehouse || isMpClosedEconomy) {
          player.warehouseStockpile[res] = (player.warehouseStockpile[res] ?? 0) + produced;
          building.status.storageFull = false;
        } else {
          building.status.storageFull = true;
          const unitPrice = getResourcePrice(state, res) * (1 + entMods.sellPriceBonus + bMods.tariffBonus);
          grossRevenue += produced * unitPrice * 0.85;
        }
      }
    } else {
      building.status.storageFull = false;
      const unitPrice = getResourcePrice(state, res) * (1 + entMods.sellPriceBonus + bMods.tariffBonus);
      grossRevenue += produced * unitPrice;
    }
  }
  building.productionPerTick = productionPerTick;

  // 8. Punkty badań, nastroje, reputacja i wpływy
  if (building.category === 'education' || building.type === 'spaceCenter' || building.type === 'intelligenceCenter') {
    const baseRP =
      building.type === 'highSchool'
        ? 2
        : building.type === 'university'
          ? 6
          : building.type === 'rdLab'
            ? 9
            : building.type === 'spaceCenter'
              ? 4
              : 2;
    const grantMult = state.activeEvents.some((e) => e.effects.some((ef) => ef.kind === 'researchBoost'))
      ? 1.5
      : 1;
    player.researchPoints += baseRP * (1 + bMods.researchBonus) * Math.min(1.5, rawEfficiency) * grantMult;
  }

  if (building.category === 'attractions' && building.type !== 'casino') {
    state.voterMood = Math.min(100, state.voterMood + 0.18);
    player.reputation = Math.min(100, player.reputation + 0.15);
  }
  if (building.type === 'hospital') {
    state.voterMood = Math.min(100, state.voterMood + 0.22);
    player.reputation = Math.min(100, player.reputation + 0.2);
  }
  if (building.type === 'casino') {
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
      grossRevenue = Math.round(grossRevenue * 1.24);
    }
  }
  if (building.type === 'corporateHQ') {
    player.researchPoints += 1.5;
    player.influence.financial += 0.35;
  }
  if (building.type === 'jewelryWorkshop' || building.type === 'jewelryLuxury') {
    player.reputation = Math.min(100, player.reputation + (building.type === 'jewelryLuxury' ? 0.25 : 0.12));
  }
  if (building.type === 'coldStorage') {
    state.voterMood = Math.min(100, state.voterMood + 0.1);
  }
  if (building.type === 'lobbyOffice' || building.type === 'investmentBank') {
    player.influence.financial += 0.65 * Math.min(1.5, rawEfficiency);
  }
  if (building.type === 'mediaAgency') {
    player.influence.mediaControl = Math.min(100, player.influence.mediaControl + 0.55);
    player.influence.social += 0.5;
    player.influence.voterApproval = Math.min(100, player.influence.voterApproval + 0.15);
  }
  if (building.type === 'churchFoundation') {
    player.influence.churchSupport = Math.min(100, player.influence.churchSupport + 0.6);
    player.influence.social += 0.55;
    state.voterMood = Math.min(100, state.voterMood + 0.25);
  }
  if (building.type === 'weaponsComplex' || building.type === 'intelligenceCenter' || building.type === 'militaryBase') {
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
  const transportCost = calculateTransportCostForBuilding(
    effectiveRoadDist,
    totalGoodsVolume,
    fuelPrice,
    player,
    state,
    logiMode
  );

  const fleetUpkeep = building.fleetSize ? building.fleetSize * 210 : 0;
  const hasHQDiscount = state.plots.some(
    (p) => p.ownerId === player.id && p.building?.type === 'corporateHQ' && p.building.isActive
  )
    ? 0.9
    : 1.0;
  const safetyMaintenanceFactor =
    building.category === 'safety' ? Math.max(0.5, 1 - entMods.safetyDiscount) : safetyCov.hasFireStation ? 0.85 : 1.0;

  const maintenance =
    (def.baseMaintenance + fleetUpkeep) *
    (1 - Math.min(0.4, bMods.costReduction)) *
    safetyMaintenanceFactor *
    hasHQDiscount *
    (building.type === 'warehouse' ? 1 - entMods.warehouseDiscount : 1);

  const effectivePollution = Math.max(0, def.pollutionLevel + bMods.pollutionDelta);
  const envShield = player.actionCooldowns['env_shield'] ? 0.1 : 1;
  const greenPolicyMult = state.activeEvents.some((e) => e.id === 'green_subsidies') ? 1.5 : 1;
  const sanitationFine =
    (building.status.sewageCrisis ? 420 : 0) + (building.status.wasteCrisis ? 360 : 0);
  const environmentalFine =
    (effectivePollution > 3 && !bMods.cleanFilter
      ? effectivePollution * 115 * envShield * greenPolicyMult * (1 - techMods.taxReduction)
      : 0) + sanitationFine;

  const operatingCosts = inputCost + hr.wages + hr.zus + energyCost + waterCost + transportCost + maintenance + environmentalFine;
  const taxableProfit = Math.max(0, grossRevenue - operatingCosts);
  const effectiveCIT = Math.max(
    0.04,
    state.taxRate *
      (1 - entMods.taxReduction - techMods.taxReduction) *
      (player.activeTaxReliefTicks > 0 ? 0.6 : 1)
  );
  const taxes = taxableProfit * effectiveCIT + (building.category === 'processing' ? grossRevenue * GAME_CONFIG.vatExciseRate * 0.25 : 0);

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
