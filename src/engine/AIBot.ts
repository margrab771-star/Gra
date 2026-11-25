import { RESOURCE_DEFINITIONS } from '../data/resources';
import {
  checkBuildingRequirements,
  constructBuildingOnPlot,
  demolishBuildingOnPlot,
  repairBuilding,
  startBuildingTechResearch,
} from './BuildingSystem';
import { proposeB2BContract } from './ContractSystem';
import { getResourcePrice } from './EconomyEngine';
import { hireWorkersForBuilding, trainBuildingWorkers } from './HRSystem';
import { executeInfluenceAction } from './InfluenceSystem';
import {
  buildPlayerRoadOnPlot,
  buyPlotForPlayer,
  hasPlayerSurveyedPlot,
  surveyPlotForPlayer,
} from './PlotSystem';
import type { AIStrategy, BuildingType, GameState, Player, Plot } from './types';

const STRATEGY_PRIORITIES: Record<AIStrategy, BuildingType[]> = {
  industrialist: ['corporateHQ', 'coalMine', 'ironMine', 'steelMill', 'quarry', 'prefabFactory', 'copperMine', 'copperCablePlant', 'lithiumMine', 'batteryFactory', 'oilWell', 'oilRefinery', 'wasteIncinerator', 'fireStation'],
  energyMagnate: ['corporateHQ', 'highSchool', 'university', 'coalMine', 'coalPowerPlant', 'gasPowerPlant', 'windFarm', 'solarFarm', 'geothermalPlant', 'uraniumMine', 'nuclearPowerPlant', 'sewagePlant', 'hazmatBase'],
  realEstate: ['corporateHQ', 'officeTower', 'hotel', 'casino', 'policeStation', 'shoppingMall', 'amusementPark', 'culturalCenter', 'marinaPromenade', 'resort', 'coldStorage', 'jewelryLuxury', 'investmentBank'],
  shadowBroker: ['corporateHQ', 'mediaAgency', 'churchFoundation', 'lobbyOffice', 'casino', 'policeStation', 'officeTower', 'hospital', 'investmentBank', 'sewagePlant'],
  military: ['corporateHQ', 'highSchool', 'university', 'ironMine', 'steelMill', 'weaponsComplex', 'militaryBase', 'intelligenceCenter', 'cargoAirport', 'wasteIncinerator'],
  supplyChain: ['corporateHQ', 'warehouse', 'waterPlant', 'sewagePlant', 'recyclingPlant', 'coldStorage', 'cargoPort', 'oilRefinery', 'chemicalPlant', 'copperCablePlant', 'semiconductorFab', 'electronicsFactory', 'batteryFactory'],
};

export function executeAITurn(state: GameState, ai: Player, slotOffset = 0): void {
  if (!ai.isAI || ai.isEliminated) return;
  const difficulty = ai.aiDifficulty ?? 2;
  const cadence = Math.max(3, 8 - difficulty);
  if ((state.time.tick + slotOffset) % cadence !== 0) return;

  const strategy: AIStrategy = ai.aiStrategy ?? 'industrialist';
  const priorities = STRATEGY_PRIORITIES[strategy];
  const ownedPlots = state.plots.filter((p) => p.ownerId === ai.id);

  // Uprzątnij ewentualne ruiny po pożarach lub katastrofach
  for (const plot of ownedPlots) {
    if (plot.building?.destroyedRuins && ai.cash > 60_000) {
      demolishBuildingOnPlot(state, ai, plot);
    }
  }

  const ownedBuildings = ownedPlots
    .filter((p) => p.building !== null && !p.building.destroyedRuins)
    .map((p) => p.building!);

  for (const b of ownedBuildings) {
    if (b.damagePercent > 45 && ai.cash > 60_000) {
      repairBuilding(b, ai);
    }
    if (b.workers < b.maxWorkers * 0.75 && ai.cash > 30_000) {
      hireWorkersForBuilding(b, ai, Math.min(4, b.maxWorkers - b.workers));
    }
    if (b.workerSkill < 65 && ai.cash > 45_000 && Math.random() < 0.22) {
      trainBuildingWorkers(b, ai);
    }
    if (!b.activeResearchId && ai.cash > 180_000) {
      const availNode = b.techTree.find((t) => t.status === 'available' && ai.cash > t.cost * 1.45);
      if (availNode) {
        startBuildingTechResearch(b, ai, availNode.id, state);
      }
    }
  }

  const activeGlobal = Object.values(ai.globalTech).some((g) => g.status === 'researching');
  if (!activeGlobal) {
    const availTech = state.globalTechDefs.find(
      (def) =>
        ai.globalTech[def.id]?.status === 'available' &&
        ai.researchPoints >= def.cost &&
        ai.cash >= def.moneyCost * 1.3
    );
    if (availTech) {
      ai.cash -= availTech.moneyCost;
      ai.researchPoints -= availTech.cost;
      ai.globalTech[availTech.id] = { status: 'researching', progress: 0 };
    }
  }

  let emptyOwned = ownedPlots.filter((p) => p.building === null && !p.hasRoad && p.terrain !== 'water' && (p.irradiatedTicks ?? 0) <= 0);
  const ownedRoads = ownedPlots.filter((p) => p.hasRoad).length;

  const hasIsolatedBuilding = ownedBuildings.some((b) => b.status.noRoadLink || b.logisticsMode === 'isolated');
  if (
    emptyOwned.length >= 1 &&
    ownedBuildings.length >= 1 &&
    ownedRoads <= ownedBuildings.length + 1 &&
    ai.cash > 110_000 &&
    ((hasIsolatedBuilding && ownedRoads < ownedBuildings.length) || Math.random() < 0.22)
  ) {
    const roadCand =
      emptyOwned.find((p) => p.distanceToRoad <= 1) ??
      (hasIsolatedBuilding ? emptyOwned[0] : undefined);
    if (roadCand) {
      const asHighway = ai.cash > 650_000 && Math.random() < 0.35;
      const roadRes = buildPlayerRoadOnPlot(state, ai, roadCand, asHighway ? 'highway' : 'local');
      if (roadRes.ok) {
        if (asHighway) roadCand.tollRate = 'standard';
        emptyOwned = emptyOwned.filter((p) => p.id !== roadCand.id);
      }
    }
  }

  if (emptyOwned.length > 0 && ai.cash > 140_000) {
    // Reaktywne zapotrzebowanie na media: prąd, woda, ścieki, śmieci
    const urgentUtilities: BuildingType[] = [];
    if (ai.electricityBalance < -5) urgentUtilities.push('solarFarm', 'windFarm', 'gasPowerPlant', 'coalPowerPlant');
    if (ai.waterBalance < -5) urgentUtilities.push('waterPlant');
    if ((ai.sewageBalance ?? 0) < -5) urgentUtilities.push('sewagePlant');
    if ((ai.wasteBalance ?? 0) < -5) urgentUtilities.push('wasteIncinerator', 'recyclingPlant');

    const candidateQueue = [...urgentUtilities, ...priorities];
    let built = false;
    for (const bType of candidateQueue) {
      for (const plot of emptyOwned) {
        const req = checkBuildingRequirements(ai, plot, bType, state);
        if (req.ok) {
          constructBuildingOnPlot(state, ai, plot, bType);
          built = true;
          break;
        }
      }
      if (built) break;
    }
    if (!built) {
      const fallback: BuildingType[] = ['warehouse', 'solarFarm', 'windFarm', 'officeTower', 'highSchool', 'quarry', 'prefabFactory', 'fireStation', 'sewagePlant'];
      for (const bType of fallback) {
        const plot = emptyOwned[0];
        if (checkBuildingRequirements(ai, plot, bType, state).ok) {
          constructBuildingOnPlot(state, ai, plot, bType);
          break;
        }
      }
    }
  }

  // Badania geologiczne własnych działek
  const unsurveyedOwned = ownedPlots.find(
    (p) =>
      !p.building &&
      p.terrain !== 'water' &&
      !hasPlayerSurveyedPlot(p, ai.id) &&
      (p.terrain === 'mountain' || p.terrain === 'desert' || p.terrain === 'coastal' || p.terrain === 'forest')
  );
  if (unsurveyedOwned && ai.cash > 25_000) {
    surveyPlotForPlayer(state, ai, unsurveyedOwned);
  }

  if (emptyOwned.length < 2 && ownedPlots.length < 16 && ai.cash > 240_000) {
    const candidate = pickBestPlotForStrategy(state.plots, strategy, ai.cash, ai.id);
    if (candidate) {
      const res = buyPlotForPlayer(state, ai, candidate);
      if (res.ok && ai.cash > 25_000 && (candidate.terrain === 'mountain' || candidate.terrain === 'desert')) {
        surveyPlotForPlayer(state, ai, candidate);
      }
    }
  }

  if (difficulty >= 2 && Math.random() < 0.08 && ownedBuildings.length > 0 && state.contracts.length < 14) {
    const producing = ownedBuildings.find((b) => Object.keys(b.productionPerTick).length > 0);
    const humanOrRival = state.players.find((p) => p.id !== ai.id && !p.isEliminated);
    if (producing && humanOrRival) {
      const res = Object.keys(producing.productionPerTick).find(
        (rk) => RESOURCE_DEFINITIONS[rk as keyof typeof RESOURCE_DEFINITIONS]?.tradeable !== false
      ) as keyof typeof producing.productionPerTick | undefined;
      if (res) {
        const mktPrice = getResourcePrice(state, res);
        proposeB2BContract(state, ai, humanOrRival.id, res, 4, Math.round(mktPrice * 0.96), 25, true);
      }
    }
  }

  if (difficulty >= 3 && ai.cash > 600_000 && Math.random() < 0.06) {
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

function pickBestPlotForStrategy(
  plots: Plot[],
  strategy: AIStrategy,
  budget: number,
  aiId: string
): Plot | null {
  const candidates = plots.filter((p) => p.purchasable && p.ownerId === null && (p.irradiatedTicks ?? 0) <= 0 && p.price <= budget * 0.45);
  if (candidates.length === 0) return null;

  let best: Plot | null = null;
  let bestScore = -999;

  // Próbkuj maksymalnie 120 działek na dużych mapach dla zachowania 60 FPS
  const step = candidates.length > 120 ? Math.floor(candidates.length / 120) : 1;
  for (let i = 0; i < candidates.length; i += step) {
    const p = candidates[i];
    let score = 0;
    if (p.distanceToRoad <= 2) score += 22;
    if (p.hasElectricity) score += 12;
    if (p.hasWater) score += 10;

    const surveyedByAi = hasPlayerSurveyedPlot(p, aiId);
    if (strategy === 'industrialist' || strategy === 'supplyChain') {
      if (p.terrain === 'mountain' || p.terrain === 'desert') score += 28;
      if (surveyedByAi && p.deposits.length > 0) score += 45;
    } else if (strategy === 'realEstate') {
      if (p.terrain === 'urban' || p.terrain === 'coastal') score += 35;
      score += p.attractiveness * 0.6;
    } else if (strategy === 'energyMagnate') {
      if (p.terrain === 'coastal' || p.terrain === 'mountain' || p.terrain === 'forest') score += 24;
      if (surveyedByAi && p.deposits.some((d) => d.type === 'coal' || d.type === 'uranium' || d.type === 'lithium')) {
        score += 50;
      }
    } else {
      if (p.terrain === 'urban') score += 40;
    }

    score -= p.price / 25_000;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}
