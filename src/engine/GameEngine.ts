import { AI_STRATEGY_LABELS, CORPORATION_LEVELS, GAME_CONFIG, PLAYER_COLORS } from '../config/gameConfig';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { DEFAULT_ENTREPRENEUR_SKILLS } from '../data/entrepreneurTree';
import { RESOURCE_DEFINITIONS, createInitialResourcePrices } from '../data/resources';
import { DEFAULT_GLOBAL_TECH_TREE } from '../data/techTrees';
import { formatGameDate } from '../utils/formatters';
import { executeAITurn } from './AIBot';
import { computePlayerUtilityAndResourceBalance } from './BalanceSystem';
import {
  computeCorporationLevel,
  constructBuildingOnPlot,
  demolishBuildingOnPlot,
  processBuildingTick,
  repairBuilding,
  startBuildingTechResearch,
  type UtilityTickSnapshot,
} from './BuildingSystem';
import {
  acceptNAPForPlayer,
  createCoalitionForPlayer,
  getPlayerCoalition,
  imposeEmbargoForPlayer,
  inviteToCoalitionForPlayer,
  leaveCoalitionForPlayer,
  processDiplomacyExpiryTick,
  proposeNAPForPlayer,
  respondToCoalitionInvite,
  toggleCoalitionGeology,
} from './CoalitionSystem';
import { acceptB2BContract, cancelB2BContract, processContractsTick, proposeB2BContract } from './ContractSystem';
import {
  calculateCoalitionNetWorthSum,
  calculatePlayerNetWorth,
  createInitialMarketCycles,
  getOverallDominanceScore,
  getPlayerEntrepreneurModifiers,
  getResourcePrice,
  processInsolvencyAndBailiffTick,
  processLoansTick,
  repayBankLoan,
  takeBankLoan,
  updateMarketCyclesTick,
  updateMarketPrices,
} from './EconomyEngine';
import {
  computeDynamicTaxAndZUS,
  processEventsTick,
  processPatentsAndTendersTick,
  submitTenderDelivery,
} from './EventSystem';
import { buyServiceVehicleForPlayer, processHazardsTick } from './HazardSystem';
import {
  computeLaborShortageIndex,
  fireWorkersFromBuilding,
  hireWorkersForBuilding,
  trainBuildingWorkers,
} from './HRSystem';
import {
  executeInfluenceAction,
  executeNuclearStrike,
  executeTacticalMissileStrike,
  processNuclearProjectTick,
  startSecretNuclearProject,
} from './InfluenceSystem';
import {
  buildPlayerRoadOnPlot,
  buyPlotForPlayer,
  generateMap,
  proposePlotOfferForPlayer,
  recalculateSpatialNetwork,
  respondPlotOfferForPlayer,
  sellPlotForPlayer,
  setRoadPolicyForPlayer,
  surveyAreaForPlayer,
  surveyPlotForPlayer,
} from './PlotSystem';
import {
  executeGreyMarketActionForPlayer,
  issueCorporateBondForPlayer,
  processStockDividendsAndBondsTick,
  syncCorporateStocks,
  tradeCorporateStock,
} from './StockMarketSystem';
import {
  computeEmergencyResponseEtaGrid,
  processTollsAndLogisticsTick,
  syncVehiclesForWorld,
} from './TransportSystem';
import type {
  AIStrategy,
  GameSettings,
  GameState,
  LastMpSession,
  LobbyState,
  Player,
  PlayerAction,
  ResourceType,
  SaveSlotId,
  SaveSlotMeta,
} from './types';

const AI_NAMES = [
  { name: 'Wiktor Kruk', company: 'Kruk Heavy Industries', strategy: 'industrialist' as AIStrategy },
  { name: 'Helena Vane', company: 'Vane Atom & Grid', strategy: 'energyMagnate' as AIStrategy },
  { name: 'Artur Sobieraj', company: 'Sobieraj Capital Estate', strategy: 'realEstate' as AIStrategy },
  { name: 'Marek Szary', company: 'Eminencja Media Group', strategy: 'shadowBroker' as AIStrategy },
  { name: 'Gen. Marek Wilk', company: 'Kondotier Tactical', strategy: 'military' as AIStrategy },
  { name: 'Zofia Lin', company: 'Nexus B2B Logistics', strategy: 'supplyChain' as AIStrategy },
  { name: 'Aleksander Novak', company: 'Novak Lithium & Tech', strategy: 'supplyChain' as AIStrategy },
];

export function createPlayerEntity(opts: {
  id: string;
  name: string;
  companyName: string;
  color: string;
  isAI: boolean;
  aiStrategy?: AIStrategy;
  aiDifficulty?: number;
  peerId?: string;
  connectionStatus?: Player['connectionStatus'];
}): Player {
  const globalTech: Player['globalTech'] = {};
  for (const node of DEFAULT_GLOBAL_TECH_TREE) {
    globalTech[node.id] = { status: node.prerequisites.length === 0 ? 'available' : 'locked', progress: 0 };
  }
  const entrepreneurSkills: Player['entrepreneurSkills'] = {};
  for (const sk of DEFAULT_ENTREPRENEUR_SKILLS) {
    entrepreneurSkills[sk.id] = sk.prerequisites.length === 0 ? 'available' : 'locked';
  }

  return {
    id: opts.id,
    name: opts.name,
    companyName: opts.companyName,
    color: opts.color,
    isAI: opts.isAI,
    aiStrategy: opts.aiStrategy,
    aiDifficulty: opts.aiDifficulty,
    peerId: opts.peerId,
    connectionStatus: opts.connectionStatus ?? (opts.isAI ? 'local' : 'connected'),
    corporationLevel: 1,
    cash: GAME_CONFIG.startingCash,
    netWorth: GAME_CONFIG.startingCash,
    incomePerMin: 0,
    expensesPerMin: 0,
    cashFlowPerMin: 0,
    electricityBalance: 0,
    waterBalance: 0,
    sewageBalance: 0,
    wasteBalance: 0,
    researchPoints: 35,
    skillPoints: 2,
    reputation: 50,
    militaryPower: 10,
    influence: {
      financial: 15,
      military: 10,
      social: 15,
      churchSupport: 15,
      mediaControl: 10,
      voterApproval: 50,
    },
    globalTech,
    entrepreneurSkills,
    loans: [],
    bonds: [],
    inspectionRisk: 0,
    warehouseStockpile: {},
    defaultAutoRepair: { enabled: true, threshold: 40 },
    activeTaxReliefTicks: 0,
    spiedPlayers: {},
    actionCooldowns: {},
    financialHistory: [
      {
        tick: 0,
        label: 'Start',
        revenue: 0,
        costs: 0,
        netIncome: 0,
        netWorth: GAME_CONFIG.startingCash,
      },
    ],
    lastTickRevenueByCategory: {},
    lastTickCostsByCategory: {},
    lastTickTaxes: { cit: 0, property: 0, environmental: 0 },
    dominantStrategy: opts.aiStrategy ? AI_STRATEGY_LABELS[opts.aiStrategy] : 'Strategia Zrównoważona',
    totalRevenueEarned: 0,
    isEliminated: false,
    insolvencyGraceTicks: 0,
    coalitionId: null,
    leftCoalitionCooldown: 0,
    secretNuclearRevealed: false,
    nuclearProjectActive: false,
    nuclearProjectProgress: 0,
    nuclearWarheadsReady: 0,
    nuclearDetectedByPlayers: [],
    pinnedResources: ['coal', 'steel', 'oil', 'gold'],
  };
}

export function initializeSinglePlayerGame(
  settings: GameSettings,
  playerName: string,
  companyName: string,
  playerColor: string
): GameState {
  const players: Player[] = [
    createPlayerEntity({
      id: 'player_1',
      name: playerName || 'Gracz',
      companyName: companyName || 'Dominion Capital S.A.',
      color: playerColor || PLAYER_COLORS[0],
      isAI: false,
      connectionStatus: 'local',
    }),
  ];

  const usedColors = new Set([playerColor]);
  for (let i = 1; i < settings.playerCount; i++) {
    const template = AI_NAMES[(i - 1) % AI_NAMES.length];
    const color = PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[i % PLAYER_COLORS.length];
    usedColors.add(color);
    players.push(
      createPlayerEntity({
        id: `ai_${i}`,
        name: template.name,
        companyName: template.company,
        color,
        isAI: true,
        aiStrategy: template.strategy,
        aiDifficulty: settings.aiDifficulty,
      })
    );
  }

  return createBaseGameState(settings, players, 'player_1');
}

export function initializeMultiplayerGame(lobby: LobbyState, localPlayerId: string): GameState {
  const isFast = lobby.mode === 'mp_fast';
  const settings: GameSettings = {
    mode: lobby.mode,
    playerCount: lobby.players.length,
    aiDifficulty: lobby.aiDifficulty,
    mapSize: lobby.mapSize,
    challengeDurationSeconds: isFast ? GAME_CONFIG.mpFastDurationSeconds : 0,
    economyMultiplier: isFast ? 2.4 : 1.0,
    disastersEnabled: lobby.disastersEnabled ?? true,
    victoryMode: lobby.victoryMode ?? 'solo',
  };

  const players: Player[] = lobby.players.map((lp, idx) =>
    createPlayerEntity({
      id: lp.id,
      name: lp.name,
      companyName: lp.companyName,
      color: lp.color || PLAYER_COLORS[idx % PLAYER_COLORS.length],
      isAI: lp.isAI,
      aiStrategy: lp.aiStrategy ?? AI_NAMES[idx % AI_NAMES.length].strategy,
      aiDifficulty: lobby.aiDifficulty,
      peerId: lp.peerId,
      connectionStatus: lp.isAI ? 'local' : lp.connected ? 'connected' : 'disconnected',
    })
  );

  return createBaseGameState(settings, players, localPlayerId);
}

function createBaseGameState(settings: GameSettings, players: Player[], currentPlayerId: string): GameState {
  const plots = generateMap(settings.mapSize);
  const resourcePrices = createInitialResourcePrices();

  const state: GameState = {
    phase: 'Playing',
    speed: 1,
    time: { tick: 0, day: 1, month: 1, year: 2026, hour: 9, minute: 0 },
    elapsedSeconds: 0,
    lastSyncTimestamp: Date.now(),
    speedRequest: null,
    settings,
    challengeTimeRemaining:
      settings.mode === 'challenge1h' || settings.mode === 'mp_fast'
        ? settings.challengeDurationSeconds
        : 0,
    challengeCompleted: false,
    winnerId: null,
    victoryReason: null,
    players,
    currentPlayerId,
    plots,
    resourcePrices,
    globalTechDefs: DEFAULT_GLOBAL_TECH_TREE.map((t) => ({ ...t })),
    entrepreneurSkillDefs: DEFAULT_ENTREPRENEUR_SKILLS.map((s) => ({ ...s })),
    activeEvents: [],
    pendingForecasts: [],
    news: [
      {
        id: 'welcome_edition',
        headline: `${GAME_CONFIG.title}: Rynek otwarty! Nowi gracze ruszają po dominację`,
        brief:
          'Bank centralny utrzymuje stabilne stopy procentowe. Analitycy spodziewają się ostrej rywalizacji o złoża surowców, energetykę i strategiczne grunty.',
        fullText:
          'Dzisiejsze wydanie Dziennika Rynkowego otwiera nowy rozdział gospodarki. Zaczynasz jako Start-up (Poziom 1) — rozwijaj majątek i edukację, aby awansować na wyższe Poziomy Korporacji i odblokowywać miedź, złoto, jubilerstwo, porty, lotniska cargo, jednostki HAZMAT oraz atom.',
        analysis: 'Zbuduj własne drogi łączące kopalnie z główną arterią i kontroluj bilans prądu oraz wody w górnym pasku.',
        hints: [
          'Kliknij działkę na mapie i kup grunt z dobrym dostępem do drogi lub połóż własną drogę.',
          'Złóż ofertę wykupu działki konkurentowi, jeśli blokuje ważne złoża!',
        ],
        type: 'neutral',
        dateLabel: '01 Sty 2026',
        tick: 0,
        read: false,
      },
    ],
    contracts: [],
    plotOffers: [],
    vehicles: [],
    transportLines: [],
    dispatches: [],
    stocks: [],
    coalitions: [],
    naps: [],
    embargoes: [],
    patents: [],
    tenders: [],
    marketCycles: createInitialMarketCycles(),
    blastEffects: [],
    chatMessages: [],
    networkRevision: 1,
    taxRate: GAME_CONFIG.baseTaxRateCIT,
    zusMultiplier: 1.0,
    baseInterestRate: GAME_CONFIG.baseLoanInterestRate,
    voterMood: 10,
    laborShortageIndex: 10,
    activeLaws: [],
    monopolyThreshold: GAME_CONFIG.monopolyVictoryShare,
    disconnectAlert: null,
    notifications: [],
  };

  syncCorporateStocks(state);
  computeEmergencyResponseEtaGrid(state, currentPlayerId);
  syncVehiclesForWorld(state);
  return state;
}

export function stepGameSimulation(state: GameState): void {
  if (state.phase !== 'Playing' || state.speed === 0) return;

  state.time.tick += 1;
  state.time.day += 1;
  if (state.time.day > 30) {
    state.time.day = 1;
    state.time.month += 1;
    if (state.time.month > 12) {
      state.time.month = 1;
      state.time.year += 1;
    }
  }
  state.lastSyncTimestamp = Date.now();

  processEventsTick(state);
  updateMarketCyclesTick(state);
  processDiplomacyExpiryTick(state);
  const { effectiveTaxRate, effectiveZusMult } = computeDynamicTaxAndZUS(state);
  state.taxRate = effectiveTaxRate;
  state.zusMultiplier = effectiveZusMult;
  state.laborShortageIndex = computeLaborShortageIndex(state);

  // Przelicz bilans mediów każdego gracza przed tiknięciem budynków
  const utilityByPlayer = new Map<string, UtilityTickSnapshot>();
  for (const player of state.players) {
    if (player.isEliminated) continue;
    const util = computePlayerUtilityAndResourceBalance(state, player);
    player.electricityBalance = util.electricityNet;
    player.waterBalance = util.waterNet;
    player.sewageBalance = util.sewageNet;
    player.wasteBalance = util.wasteNet;
    utilityByPlayer.set(player.id, {
      elecRatio: util.electricityCoverageRatio,
      waterRatio: util.waterCoverageRatio,
      sewageNet: util.sewageNet,
      wasteNet: util.wasteNet,
    });

    player.lastTickRevenueByCategory = {};
    player.lastTickCostsByCategory = {};
    player.lastTickTaxes = { cit: 0, property: 0, environmental: 0 };

    if (player.activeTaxReliefTicks > 0) player.activeTaxReliefTicks--;
    for (const k of Object.keys(player.spiedPlayers)) {
      player.spiedPlayers[k]--;
      if (player.spiedPlayers[k] <= 0) delete player.spiedPlayers[k];
    }
    for (const k of Object.keys(player.actionCooldowns)) {
      player.actionCooldowns[k]--;
      if (player.actionCooldowns[k] <= 0) delete player.actionCooldowns[k];
    }

    if (state.time.tick % 25 === 0) {
      player.skillPoints += 1;
    }

    const entMods = getPlayerEntrepreneurModifiers(state, player);
    for (const def of state.globalTechDefs) {
      const gt = player.globalTech[def.id];
      if (!gt || gt.status !== 'researching') continue;
      gt.progress = Math.min(100, gt.progress + (100 / def.researchTicks) * (1 + entMods.researchSpeedBonus));
      if (gt.progress >= 100) {
        gt.status = 'done';
        if (def.modifiers.militaryPower) {
          player.militaryPower += def.modifiers.militaryPower;
        }
        for (const otherDef of state.globalTechDefs) {
          const og = player.globalTech[otherDef.id];
          if (
            og &&
            og.status === 'locked' &&
            otherDef.prerequisites.every((pid) => player.globalTech[pid]?.status === 'done')
          ) {
            og.status = 'available';
          }
        }
        if (player.id === state.currentPlayerId) {
          pushNotification(state, 'Badania ukończone', `Technologia "${def.name}" została wdrożona!`, 'success');
        }
      }
    }
  }

  // Pożary i incydenty HAZMAT
  processHazardsTick(state);

  const supplyAccum: Partial<Record<ResourceType, number>> = {};
  const demandAccum: Partial<Record<ResourceType, number>> = {};

  // Faza I: Podatek gruntowy + wydobycie, energetyka i gospodarka odpadami (zasila magazyn przed przetwórstwem)
  const deferredProcessingPlots: typeof state.plots = [];
  for (const plot of state.plots) {
    const owner = plot.ownerId ? state.players.find((p) => p.id === plot.ownerId) : undefined;
    if (!owner || owner.isEliminated) continue;

    const propTax = GAME_CONFIG.propertyTaxPerPlotPerTick * (plot.terrain === 'urban' ? 1.5 : 1);
    owner.cash -= propTax;
    owner.lastTickTaxes.property += propTax;
    owner.lastTickCostsByCategory['Podatek od Nieruchomości'] =
      (owner.lastTickCostsByCategory['Podatek od Nieruchomości'] ?? 0) + propTax;

    if (plot.building && plot.building.isActive && !plot.building.destroyedRuins) {
      const cat = BUILDING_DEFINITIONS[plot.building.type].category;
      if (cat === 'mining' || cat === 'energy' || cat === 'waste') {
        processBuildingTick(
          plot.building,
          plot,
          owner,
          state,
          supplyAccum,
          demandAccum,
          utilityByPlayer.get(owner.id)
        );
      } else {
        deferredProcessingPlots.push(plot);
      }
    }
  }

  // Faza II: Przetwórstwo, nieruchomości, usługi, bezpieczeństwo i wpływy
  for (const plot of deferredProcessingPlots) {
    const owner = plot.ownerId ? state.players.find((p) => p.id === plot.ownerId) : undefined;
    if (!owner || !plot.building) continue;
    processBuildingTick(
      plot.building,
      plot,
      owner,
      state,
      supplyAccum,
      demandAccum,
      utilityByPlayer.get(owner.id)
    );
  }

  processContractsTick(state);
  processPatentsAndTendersTick(state);
  processNuclearProjectTick(state);
  processTollsAndLogisticsTick(state);

  for (const player of state.players) {
    if (player.isEliminated) continue;
    const loanPaid = processLoansTick(player);
    if (loanPaid > 0) {
      player.lastTickCostsByCategory['Raty Kredytowe'] =
        (player.lastTickCostsByCategory['Raty Kredytowe'] ?? 0) + loanPaid;
    }
  }

  processStockDividendsAndBondsTick(state);
  updateMarketPrices(state, supplyAccum, demandAccum);
  processInsolvencyAndBailiffTick(state);

  for (const player of state.players) {
    if (player.isEliminated) continue;
    const totalRev = Object.values(player.lastTickRevenueByCategory).reduce((a, b) => a + b, 0);
    const totalCosts = Object.values(player.lastTickCostsByCategory).reduce((a, b) => a + b, 0) + player.lastTickTaxes.cit;
    const netTick = totalRev - totalCosts;

    player.incomePerMin = Math.round(totalRev * 60);
    player.expensesPerMin = Math.round(totalCosts * 60);
    player.cashFlowPerMin = Math.round(netTick * 60);
    player.netWorth = calculatePlayerNetWorth(player, state);
    player.dominantStrategy = detectDominantStrategy(state, player);

    const prevLevel = player.corporationLevel;
    const nextLevel = computeCorporationLevel(state, player);
    if (nextLevel > prevLevel) {
      player.corporationLevel = nextLevel;
      if (player.id === state.currentPlayerId) {
        pushNotification(
          state,
          `Awans Korporacji: Poziom ${nextLevel}!`,
          `Twoja firma osiągnęła status "${CORPORATION_LEVELS[nextLevel].name}" i odblokowała nowe sektory!`,
          'success'
        );
      }
    }

    if (state.time.tick % 3 === 0) {
      player.financialHistory = [
        ...player.financialHistory.slice(-24),
        {
          tick: state.time.tick,
          label: formatGameDate(state.time),
          revenue: Math.round(totalRev),
          costs: Math.round(totalCosts),
          netIncome: Math.round(netTick),
          netWorth: player.netWorth,
        },
      ];
    }
  }

  let aiIdx = 0;
  for (const player of state.players) {
    if (player.isAI) {
      executeAITurn(state, player, aiIdx++);
    }
  }

  if (state.time.tick % 5 === 0) {
    recalculateSpatialNetwork(state.plots);
    computeEmergencyResponseEtaGrid(state, state.currentPlayerId);
    syncVehiclesForWorld(state);
  }

  checkVictoryConditions(state);
}

function detectDominantStrategy(state: GameState, player: Player): string {
  const blds = state.plots.filter((p) => p.ownerId === player.id && p.building).map((p) => p.building!);
  if (blds.length === 0) return 'Inwestor Gruntowy';
  const counts: Record<string, number> = {};
  for (const b of blds) {
    counts[b.category] = (counts[b.category] ?? 0) + 1;
  }
  const topCat = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  switch (topCat) {
    case 'mining':
    case 'processing':
      return 'Baron Surowcowo-Przemysłowy';
    case 'energy':
    case 'waste':
    case 'education':
      return 'Monopolista Energetyczno-Tech';
    case 'real_estate':
    case 'attractions':
    case 'finance':
      return 'Magnat Nieruchomości i Luksusu';
    case 'influence':
      return 'Szara Eminencja';
    case 'military':
      return 'Korporacyjny Kondotier';
    case 'logistics':
      return 'Architekt Łańcuchów B2B';
    default:
      return 'Konglomerat Dywersyfikowany';
  }
}

function checkVictoryConditions(state: GameState): void {
  if (state.winnerId) return;
  const activePlayers = state.players.filter((p) => !p.isEliminated);
  if (state.players.length > 1 && activePlayers.length === 1) {
    const survivor = activePlayers[0];
    state.winnerId = survivor.id;
    state.victoryReason = `${survivor.companyName} przetrwała kryzys i została jedyną aktywną korporacją na rynku!`;
    if (state.settings.mode === 'mp_fast' || state.settings.mode === 'mp_long') {
      state.phase = 'GameOver';
    }
    return;
  }

  if (state.time.tick >= 40 && state.players.length > 1) {
    if (state.settings.victoryMode === 'coalition' && state.coalitions && state.coalitions.length > 0) {
      const totalMarketNetWorth = state.players.reduce((s, p) => s + Math.max(0, p.netWorth), 0);
      for (const col of state.coalitions) {
        const activeMembers = col.memberIds.filter((id) => state.players.some((p) => p.id === id && !p.isEliminated));
        if (activeMembers.length === 0) continue;
        const combinedNW = calculateCoalitionNetWorthSum(state, col.id);
        const wealthPct = totalMarketNetWorth > 0 ? (combinedNW / totalMarketNetWorth) * 100 : 0;
        const combinedBuildings = state.plots.filter(
          (pl) => pl.ownerId && activeMembers.includes(pl.ownerId) && pl.building && !pl.building.destroyedRuins
        ).length;
        const avgDominance =
          activeMembers.reduce((sum, id) => sum + getOverallDominanceScore(state, id), 0) * 0.85;

        if ((wealthPct >= 70 || avgDominance >= 82) && combinedNW >= 16_000_000 && combinedBuildings >= 6) {
          state.winningCoalitionId = col.id;
          state.winnerId = col.leaderId;
          state.victoryReason = `Koalicja [${col.tag}] ${col.name} osiągnęła łączną dominację rynkową (${Math.round(wealthPct)}% kapitału) i zwyciężyła jako sojusz!`;
          if (state.settings.mode === 'mp_fast' || state.settings.mode === 'mp_long') {
            state.phase = 'GameOver';
          }
          return;
        }
      }
    }

    for (const p of activePlayers) {
      const dominance = getOverallDominanceScore(state, p.id);
      const ownedBuildings = state.plots.filter((pl) => pl.ownerId === p.id && pl.building && !pl.building.destroyedRuins).length;
      if (dominance >= 78 && ownedBuildings >= 5 && p.netWorth > 12_000_000) {
        const col = state.settings.victoryMode === 'coalition' ? getPlayerCoalition(state, p.id) : undefined;
        state.winningCoalitionId = col?.id ?? null;
        state.winnerId = p.id;
        state.victoryReason = col
          ? `Koalicja [${col.tag}] ${col.name} zdominowała rynek dzięki potędze ${p.companyName} (${dominance}%)!`
          : `${p.companyName} osiągnęła monopolistyczną dominację (${dominance}%) na mapie i kontroluje rynek!`;
        if (state.settings.mode === 'mp_fast' || state.settings.mode === 'mp_long') {
          state.phase = 'GameOver';
        }
        break;
      }
    }
  }
}

export function applyPlayerAction(state: GameState, action: PlayerAction): { ok: boolean; message?: string } {
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { ok: false, message: 'Nieznany gracz.' };

  switch (action.type) {
    case 'buyPlot': {
      const plot = state.plots.find((p) => p.id === action.plotId);
      if (!plot) return { ok: false, message: 'Nie znaleziono działki.' };
      const r = buyPlotForPlayer(state, player, plot);
      return { ok: r.ok, message: r.error ?? 'Kupiono działkę.' };
    }
    case 'sellPlot': {
      const plot = state.plots.find((p) => p.id === action.plotId);
      if (!plot) return { ok: false, message: 'Nie znaleziono działki.' };
      const r = sellPlotForPlayer(state, player, plot);
      return { ok: r.ok, message: r.error ?? 'Sprzedano działkę.' };
    }
    case 'buildPlayerRoad': {
      const plot = state.plots.find((p) => p.id === action.plotId);
      if (!plot) return { ok: false, message: 'Nie znaleziono działki.' };
      const roadClass = action.roadClass ?? 'local';
      const r = buildPlayerRoadOnPlot(state, player, plot, roadClass);
      if (r.ok) {
        computeEmergencyResponseEtaGrid(state, state.currentPlayerId);
        syncVehiclesForWorld(state);
      }
      return {
        ok: r.ok,
        message:
          r.error ??
          (roadClass === 'highway'
            ? 'Wybudowano Autostradę Płatną!'
            : 'Wybudowano Drogę Zwykłą!'),
      };
    }
    case 'setRoadPolicy': {
      const plot = state.plots.find((p) => p.id === action.plotId);
      if (!plot) return { ok: false, message: 'Nie znaleziono działki.' };
      const r = setRoadPolicyForPlayer(player, plot, {
        tollRate: action.tollRate,
        roadBlocked: action.roadBlocked,
        toggleBlockedPlayerId: action.toggleBlockedPlayerId,
      });
      if (r.ok) {
        state.networkRevision = (state.networkRevision ?? 0) + 1;
        computeEmergencyResponseEtaGrid(state, state.currentPlayerId);
        syncVehiclesForWorld(state);
      }
      return { ok: r.ok, message: r.message };
    }
    case 'surveyArea': {
      const plot = state.plots.find((p) => p.id === action.plotId);
      if (!plot) return { ok: false, message: 'Nie znaleziono działki.' };
      const r = surveyAreaForPlayer(state, player, plot);
      return {
        ok: r.ok,
        message:
          r.error ??
          `Georadar 3×3 zbadał ${r.scannedPlots} działek i wykrył ${r.foundCount} złóż!`,
      };
    }
    case 'buyServiceVehicle': {
      const b = findPlayerBuilding(state, player.id, action.buildingId);
      if (!b) return { ok: false, message: 'Nie znaleziono budynku służby.' };
      const r = buyServiceVehicleForPlayer(b, player);
      if (r.ok) {
        computeEmergencyResponseEtaGrid(state, state.currentPlayerId);
        syncVehiclesForWorld(state);
      }
      return { ok: r.ok, message: r.error ?? 'Dokupiono nowy pojazd do floty operacyjnej!' };
    }
    case 'tradeStock': {
      return tradeCorporateStock(state, player, action.targetCompanyId, action.shareDeltaPercent);
    }
    case 'issueBond': {
      const r = issueCorporateBondForPlayer(state, player, action.amount);
      return {
        ok: r.ok,
        message: r.error ?? `Wyemitowano obligacje korporacyjne na ${action.amount.toLocaleString('pl-PL')} zł!`,
      };
    }
    case 'greyMarketAction': {
      return executeGreyMarketActionForPlayer(state, player, action.actionId);
    }
    case 'proposePlotOffer': {
      const plot = state.plots.find((p) => p.id === action.plotId);
      if (!plot) return { ok: false, message: 'Nie znaleziono działki.' };
      const r = proposePlotOfferForPlayer(state, player, plot, action.offeredPrice, action.includeBuilding);
      if (r.offer?.status === 'accepted') syncVehiclesForWorld(state);
      return { ok: r.ok, message: r.message };
    }
    case 'respondPlotOffer': {
      const r = respondPlotOfferForPlayer(
        state,
        player,
        action.offerId,
        action.response,
        action.counterPrice
      );
      if (r.ok) syncVehiclesForWorld(state);
      return { ok: r.ok, message: r.message };
    }
    case 'surveyPlot': {
      const plot = state.plots.find((p) => p.id === action.plotId);
      if (!plot) return { ok: false, message: 'Nie znaleziono działki.' };
      const r = surveyPlotForPlayer(state, player, plot);
      return {
        ok: r.ok,
        message: r.error ?? (r.foundCount > 0 ? `Odkryto ${r.foundCount} nowych złóż!` : 'Brak ukrytych złóż pod tą działką.'),
      };
    }
    case 'buildOnPlot': {
      const plot = state.plots.find((p) => p.id === action.plotId);
      if (!plot) return { ok: false, message: 'Nie znaleziono działki.' };
      const r = constructBuildingOnPlot(state, player, plot, action.buildingType);
      if (r.ok) {
        computeEmergencyResponseEtaGrid(state, state.currentPlayerId);
        syncVehiclesForWorld(state);
      }
      return { ok: r.ok, message: r.error ?? 'Obiekt wybudowany!' };
    }
    case 'demolishBuilding': {
      const plot = state.plots.find((p) => p.id === action.plotId);
      if (!plot) return { ok: false, message: 'Nie znaleziono działki.' };
      const r = demolishBuildingOnPlot(state, player, plot);
      if (r.ok) {
        computeEmergencyResponseEtaGrid(state, state.currentPlayerId);
        syncVehiclesForWorld(state);
      }
      return { ok: r.ok, message: r.error ?? 'Budynek wyburzony.' };
    }
    case 'repairBuilding': {
      const b = findPlayerBuilding(state, player.id, action.buildingId);
      if (!b) return { ok: false, message: 'Nie znaleziono budynku.' };
      const r = repairBuilding(b, player);
      return { ok: r.ok, message: r.error ?? 'Wykonano kapitalny remont (0% zniszczenia).' };
    }
    case 'setAutoRepair': {
      const b = findPlayerBuilding(state, player.id, action.buildingId);
      if (!b) return { ok: false, message: 'Nie znaleziono budynku.' };
      b.autoRepairEnabled = action.enabled;
      b.autoRepairThreshold = Math.max(5, Math.min(90, Math.round(action.threshold)));
      return { ok: true };
    }
    case 'applyAutoRepairTemplate': {
      const threshold = Math.max(5, Math.min(90, Math.round(action.threshold)));
      let count = 0;
      for (const plot of state.plots) {
        if (plot.ownerId === player.id && plot.building) {
          plot.building.autoRepairEnabled = action.enabled;
          plot.building.autoRepairThreshold = threshold;
          count++;
        }
      }
      if (action.setAsDefault) {
        player.defaultAutoRepair = { enabled: action.enabled, threshold };
      }
      return {
        ok: true,
        message: `Szablon autonaprawy (${action.enabled ? `WŁ @ ${threshold}%` : 'WYŁ'}) zastosowany do ${count} obiektów.`,
      };
    }
    case 'toggleStockpile': {
      const b = findPlayerBuilding(state, player.id, action.buildingId);
      if (!b) return { ok: false, message: 'Nie znaleziono budynku.' };
      b.stockpileOutput = !b.stockpileOutput;
      return { ok: true, message: b.stockpileOutput ? 'Tryb magazynowania włączony.' : 'Tryb sprzedaży bieżącej włączony.' };
    }
    case 'sellWarehouseStock': {
      const stock = player.warehouseStockpile[action.resource] ?? 0;
      const qty = Math.min(stock, action.amount);
      if (qty <= 0) return { ok: false, message: 'Brak towaru w magazynie.' };
      const revenue = Math.round(qty * getResourcePrice(state, action.resource));
      player.warehouseStockpile[action.resource] = stock - qty;
      player.cash += revenue;
      return { ok: true, message: `Sprzedano ${qty.toFixed(1)} jedn. za ${revenue.toLocaleString('pl-PL')} zł.` };
    }
    case 'buyWarehouseStock': {
      const isMp = state.settings.mode === 'mp_fast' || state.settings.mode === 'mp_long';
      if (isMp) {
        return {
          ok: false,
          message:
            'Gospodarka zamknięta Multiplayer: nie można kupować towarów z zewnątrz. Produkuj własne lub zawrzyj kontrakt B2B z innym graczem!',
        };
      }
      const rdef = RESOURCE_DEFINITIONS[action.resource];
      if (!rdef || rdef.tradeable === false) {
        return { ok: false, message: 'Tego medium nie można kupić na giełdzie.' };
      }
      if (action.amount <= 0) return { ok: false, message: 'Nieprawidłowa ilość.' };
      const unitPrice = getResourcePrice(state, action.resource);
      const totalCost = Math.round(action.amount * unitPrice);
      if (player.cash < totalCost) {
        return { ok: false, message: `Brak środków na zakup na giełdzie (${totalCost.toLocaleString('pl-PL')} zł).` };
      }
      player.cash -= totalCost;
      player.warehouseStockpile[action.resource] =
        (player.warehouseStockpile[action.resource] ?? 0) + action.amount;
      return {
        ok: true,
        message: `Kupiono ${action.amount} ${rdef.unit} ${rdef.genitiveName} do magazynu za ${totalCost.toLocaleString('pl-PL')} zł.`,
      };
    }
    case 'researchBuildingTech': {
      const b = findPlayerBuilding(state, player.id, action.buildingId);
      if (!b) return { ok: false, message: 'Nie znaleziono budynku.' };
      const r = startBuildingTechResearch(b, player, action.nodeId, state);
      return { ok: r.ok, message: r.error ?? 'Rozpoczęto wdrażanie modułu.' };
    }
    case 'hireWorkers': {
      const b = findPlayerBuilding(state, player.id, action.buildingId);
      if (!b) return { ok: false, message: 'Nie znaleziono budynku.' };
      const r = hireWorkersForBuilding(b, player, action.count);
      return { ok: r.ok, message: r.error };
    }
    case 'fireWorkers': {
      const b = findPlayerBuilding(state, player.id, action.buildingId);
      if (!b) return { ok: false, message: 'Nie znaleziono budynku.' };
      const r = fireWorkersFromBuilding(b, player, action.count);
      return { ok: r.ok, message: r.error };
    }
    case 'trainWorkers': {
      const b = findPlayerBuilding(state, player.id, action.buildingId);
      if (!b) return { ok: false, message: 'Nie znaleziono budynku.' };
      const r = trainBuildingWorkers(b, player);
      return { ok: r.ok, message: r.error ?? 'Załoga przeszkolona!' };
    }
    case 'researchGlobalTech': {
      const def = state.globalTechDefs.find((t) => t.id === action.nodeId);
      const gt = player.globalTech[action.nodeId];
      if (!def || !gt || gt.status !== 'available') {
        return { ok: false, message: 'Technologia niedostępna.' };
      }
      const entMods = getPlayerEntrepreneurModifiers(state, player);
      const moneyCost = Math.round(def.moneyCost * (1 - entMods.researchDiscount));
      if (player.researchPoints < def.cost) {
        return { ok: false, message: `Wymaga ${def.cost} pkt badań.` };
      }
      if (player.cash < moneyCost) {
        return { ok: false, message: `Wymaga ${moneyCost.toLocaleString('pl-PL')} zł.` };
      }
      player.researchPoints -= def.cost;
      player.cash -= moneyCost;
      gt.status = 'researching';
      gt.progress = 0;
      return { ok: true, message: `Rozpoczęto badania: ${def.name}` };
    }
    case 'unlockSkill': {
      const def = state.entrepreneurSkillDefs.find((s) => s.id === action.nodeId);
      const cur = player.entrepreneurSkills[action.nodeId];
      if (!def || cur !== 'available') return { ok: false, message: 'Umiejętność niedostępna.' };
      if (def.requiredCorpLevel && player.corporationLevel < def.requiredCorpLevel) {
        return {
          ok: false,
          message: `Wymaga ${def.requiredCorpLevel}. Poziomu Korporacji (masz Poz. ${player.corporationLevel}).`,
        };
      }
      if (def.requiredInfluenceScore) {
        const totalInf =
          player.influence.financial + player.influence.military + player.influence.social;
        if (totalInf < def.requiredInfluenceScore) {
          return {
            ok: false,
            message: `Wymaga min. ${def.requiredInfluenceScore} pkt łącznych wpływów (masz ${Math.round(totalInf)}).`,
          };
        }
      }
      if (def.requiredGlobalTechCount) {
        const doneTech = Object.values(player.globalTech).filter((t) => t.status === 'done').length;
        if (doneTech < def.requiredGlobalTechCount) {
          return {
            ok: false,
            message: `Wymaga zbadania min. ${def.requiredGlobalTechCount} technologii R&D (masz ${doneTech}).`,
          };
        }
      }
      if (player.skillPoints < def.skillPointCost) {
        return { ok: false, message: `Brak punktów rozwoju (${def.skillPointCost} wymagane).` };
      }
      if (player.cash < def.cashCost) {
        return { ok: false, message: `Brak środków (${def.cashCost.toLocaleString('pl-PL')} zł).` };
      }
      player.skillPoints -= def.skillPointCost;
      player.cash -= def.cashCost;
      player.entrepreneurSkills[action.nodeId] = 'done';
      if (def.modifiers.socialInfluenceStart) player.influence.social += def.modifiers.socialInfluenceStart;
      if (def.modifiers.militaryInfluenceBonus) player.militaryPower += def.modifiers.militaryInfluenceBonus;

      for (const other of state.entrepreneurSkillDefs) {
        if (
          player.entrepreneurSkills[other.id] === 'locked' &&
          other.prerequisites.every((pid) => player.entrepreneurSkills[pid] === 'done')
        ) {
          player.entrepreneurSkills[other.id] = 'available';
        }
      }
      return { ok: true, message: `Odblokowano umiejętność: ${def.name}` };
    }
    case 'takeLoan': {
      const r = takeBankLoan(state, player, action.amount, action.months);
      return { ok: r.ok, message: r.error ?? 'Kredyt uruchomiony.' };
    }
    case 'repayLoan': {
      const r = repayBankLoan(player, action.loanId);
      return { ok: r.ok, message: r.error ?? 'Kredyt spłacony.' };
    }
    case 'proposeContract': {
      const r = proposeB2BContract(
        state,
        player,
        action.partnerId,
        action.resource,
        action.quantityPerTick,
        action.pricePerUnit,
        action.durationTicks,
        action.isSelling,
        {
          kind: action.kind,
          barterResource: action.barterResource,
          barterQtyPerTick: action.barterQtyPerTick,
          openListing: action.openListing,
        }
      );
      return { ok: r.ok, message: r.error ?? 'Wysłano ofertę kontraktu B2B.' };
    }
    case 'acceptContract': {
      const r = acceptB2BContract(state, player, action.contractId);
      return { ok: r.ok, message: r.error ?? 'Kontrakt B2B podpisany!' };
    }
    case 'cancelContract': {
      const r = cancelB2BContract(state, player, action.contractId);
      return { ok: r.ok, message: r.error ?? 'Kontrakt anulowany.' };
    }
    case 'executeInfluence': {
      const r = executeInfluenceAction(
        state,
        player,
        action.actionId,
        action.targetPlayerId,
        action.targetPlotId,
        action.targetBuildingId
      );
      return { ok: r.ok, message: r.message };
    }
    case 'launchTacticalMissile': {
      const r = executeTacticalMissileStrike(state, player, action.targetPlotId);
      return { ok: r.ok, message: r.message };
    }
    case 'startNuclearProject': {
      const r = startSecretNuclearProject(state, player);
      return { ok: r.ok, message: r.message };
    }
    case 'launchNuclearStrike': {
      const r = executeNuclearStrike(state, player, action.targetPlotId);
      return { ok: r.ok, message: r.message };
    }
    case 'createCoalition': {
      const r = createCoalitionForPlayer(state, player, action.name, action.tag, action.color);
      return { ok: r.ok, message: r.error ?? `Założono koalicję [${action.tag.toUpperCase()}]!` };
    }
    case 'inviteCoalition': {
      const r = inviteToCoalitionForPlayer(state, player, action.targetPlayerId);
      return { ok: r.ok, message: r.error ?? 'Wysłano zaproszenie do koalicji.' };
    }
    case 'respondCoalitionInvite': {
      const r = respondToCoalitionInvite(state, player, action.coalitionId, action.accept);
      return {
        ok: r.ok,
        message: r.error ?? (action.accept ? 'Dołączono do koalicji!' : 'Odrzucono zaproszenie.'),
      };
    }
    case 'leaveCoalition': {
      const r = leaveCoalitionForPlayer(state, player);
      return { ok: r.ok, message: r.error ?? 'Opuszczono koalicję.' };
    }
    case 'toggleCoalitionGeology': {
      const r = toggleCoalitionGeology(state, player);
      return { ok: r.ok, message: r.error ?? 'Zaktualizowano współdzielenie map geologicznych.' };
    }
    case 'proposeNAP': {
      const r = proposeNAPForPlayer(state, player, action.targetPlayerId);
      return { ok: r.ok, message: r.error ?? 'Wysłano propozycję Paktu o Nieagresji.' };
    }
    case 'acceptNAP': {
      const r = acceptNAPForPlayer(state, player, action.napId);
      return { ok: r.ok, message: r.error ?? 'Pakt o Nieagresji wszedł w życie!' };
    }
    case 'imposeEmbargo': {
      const r = imposeEmbargoForPlayer(state, player, action.targetPlayerId);
      return { ok: r.ok, message: r.error ?? 'Nałożono embargo handlowe i blokadę dróg.' };
    }
    case 'submitTenderDelivery': {
      const r = submitTenderDelivery(state, player, action.tenderId);
      return {
        ok: r.ok,
        message: r.error ?? (r.completed ? 'Przetarg zrealizowany w 100% — nagroda przyznana!' : 'Dostarczono partię surowców na przetarg.'),
      };
    }
    case 'sendChatMessage': {
      const cleanText = action.text.trim().slice(0, 240);
      if (!cleanText && !action.pingPlot) {
        return { ok: false, message: 'Pusta wiadomość.' };
      }
      state.chatMessages = state.chatMessages ?? [];
      state.chatMessages.push({
        id: `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        senderId: player.id,
        senderName: player.name,
        companyName: player.companyName,
        color: player.color,
        text: cleanText || `📍 Ping działki (${action.pingPlot?.gridX}, ${action.pingPlot?.gridY})`,
        tick: state.time.tick,
        timestamp: Date.now(),
        pingPlot: action.pingPlot,
      });
      if (state.chatMessages.length > 60) {
        state.chatMessages = state.chatMessages.slice(-60);
      }
      return { ok: true };
    }
    case 'setSpeed': {
      state.speed = action.speed;
      state.speedRequest = null;
      state.lastSyncTimestamp = Date.now();
      return { ok: true };
    }
    case 'requestSpeedChange': {
      state.speedRequest = {
        playerId: player.id,
        playerName: player.name,
        requestedSpeed: action.speed,
        timestamp: Date.now(),
      };
      return {
        ok: true,
        message: `Wysłano prośbę o zmianę tempa (${action.speed === 0 ? 'Pauza' : `${action.speed}×`}) do Hosta.`,
      };
    }
    case 'dismissSpeedRequest': {
      state.speedRequest = null;
      return { ok: true };
    }
  }
}

function findPlayerBuilding(state: GameState, playerId: string, buildingId: string) {
  return state.plots.find((p) => p.ownerId === playerId && p.building?.id === buildingId)?.building ?? null;
}

export function pushNotification(
  state: GameState,
  title: string,
  message: string,
  severity: 'info' | 'success' | 'warning' | 'danger'
): void {
  state.notifications = [
    {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      message,
      severity,
      tick: state.time.tick,
    },
    ...state.notifications,
  ].slice(0, 6);
}

// ─── Wieloslotowy System Zapisu i Autozapisu ──────────────────────────────────

const SAVE_SLOT_PREFIX = 'market_dominion_slot_';
const SAVE_META_KEY = 'market_dominion_saves_meta_v2';
const MP_LAST_SESSION_KEY = 'market_dominion_last_mp_session_v1';

const SLOT_LABELS: Record<SaveSlotId, string> = {
  autosave: 'Autozapis',
  slot1: 'Slot 1',
  slot2: 'Slot 2',
  slot3: 'Slot 3',
};

export function saveGameToSlot(slotId: SaveSlotId, state: GameState): boolean {
  try {
    const me = state.players.find((p) => p.id === state.currentPlayerId) ?? state.players[0];
    const serialized = JSON.stringify(state);
    localStorage.setItem(`${SAVE_SLOT_PREFIX}${slotId}`, serialized);

    const meta: SaveSlotMeta = {
      slotId,
      label: SLOT_LABELS[slotId],
      companyName: me.companyName,
      mode: state.settings.mode,
      gameDateLabel: formatGameDate(state.time),
      challengeTimeRemaining: state.challengeTimeRemaining,
      netWorth: me.netWorth,
      savedAt: Date.now(),
    };
    const allMeta = listSaveSlots().filter((m) => m.slotId !== slotId);
    allMeta.push(meta);
    localStorage.setItem(SAVE_META_KEY, JSON.stringify(allMeta));
    return true;
  } catch {
    return false;
  }
}

export function loadGameFromSlot(slotId: SaveSlotId): GameState | null {
  try {
    const raw = localStorage.getItem(`${SAVE_SLOT_PREFIX}${slotId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || !Array.isArray(parsed.plots) || !Array.isArray(parsed.players)) return null;
    migrateGameStateInPlace(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function migrateGameStateInPlace(state: GameState): void {
  state.elapsedSeconds = state.elapsedSeconds ?? 0;
  state.lastSyncTimestamp = state.lastSyncTimestamp ?? Date.now();
  state.speedRequest = state.speedRequest ?? null;
  state.plotOffers = state.plotOffers ?? [];
  state.transportLines = state.transportLines ?? [];
  state.dispatches = state.dispatches ?? [];
  state.stocks = state.stocks ?? [];
  state.coalitions = state.coalitions ?? [];
  state.naps = state.naps ?? [];
  state.embargoes = state.embargoes ?? [];
  state.patents = state.patents ?? [];
  state.tenders = state.tenders ?? [];
  state.marketCycles = state.marketCycles && state.marketCycles.length > 0 ? state.marketCycles : createInitialMarketCycles();
  state.blastEffects = state.blastEffects ?? [];
  state.chatMessages = state.chatMessages ?? [];
  state.networkRevision = state.networkRevision ?? 1;
  state.settings.disastersEnabled = state.settings.disastersEnabled ?? true;
  state.settings.victoryMode = state.settings.victoryMode ?? 'solo';

  // Zaktualizuj definicje drzewek globalnych i prezesa dla starszych zapisów
  state.globalTechDefs = DEFAULT_GLOBAL_TECH_TREE.map((t) => ({ ...t }));
  state.entrepreneurSkillDefs = DEFAULT_ENTREPRENEUR_SKILLS.map((s) => ({ ...s }));

  // Uzupełnij brakujące surowce (np. diamenty, lit, baterie) w notowaniach ze starszych zapisów
  const freshPrices = createInitialResourcePrices();
  for (const fp of freshPrices) {
    if (!state.resourcePrices.some((rp) => rp.type === fp.type)) {
      state.resourcePrices.push(fp);
    }
  }
  state.resourcePrices = state.resourcePrices.filter((rp) => RESOURCE_DEFINITIONS[rp.type]?.tradeable !== false);

  for (const p of state.players) {
    p.defaultAutoRepair = p.defaultAutoRepair ?? { enabled: true, threshold: 40 };
    p.corporationLevel = p.corporationLevel ?? 1;
    p.electricityBalance = p.electricityBalance ?? 0;
    p.waterBalance = p.waterBalance ?? 0;
    p.sewageBalance = p.sewageBalance ?? 0;
    p.wasteBalance = p.wasteBalance ?? 0;
    p.bonds = p.bonds ?? [];
    p.inspectionRisk = p.inspectionRisk ?? 0;
    p.insolvencyGraceTicks = p.insolvencyGraceTicks ?? 0;
    p.coalitionId = p.coalitionId ?? null;
    p.leftCoalitionCooldown = p.leftCoalitionCooldown ?? 0;
    p.secretNuclearRevealed = p.secretNuclearRevealed ?? false;
    p.nuclearProjectActive = p.nuclearProjectActive ?? false;
    p.nuclearProjectProgress = p.nuclearProjectProgress ?? 0;
    p.nuclearWarheadsReady = p.nuclearWarheadsReady ?? 0;
    p.nuclearDetectedByPlayers = p.nuclearDetectedByPlayers ?? [];
    p.pinnedResources = p.pinnedResources ?? ['coal', 'steel', 'oil', 'gold'];

    for (const tDef of state.globalTechDefs) {
      if (!p.globalTech[tDef.id]) {
        const prereqMet = tDef.prerequisites.every((pid) => p.globalTech[pid]?.status === 'done');
        p.globalTech[tDef.id] = { status: prereqMet ? 'available' : 'locked', progress: 0 };
      }
    }
    for (const sDef of state.entrepreneurSkillDefs) {
      if (!p.entrepreneurSkills[sDef.id]) {
        const prereqMet = sDef.prerequisites.every((pid) => p.entrepreneurSkills[pid] === 'done');
        p.entrepreneurSkills[sDef.id] = prereqMet ? 'available' : 'locked';
      }
    }
  }

  for (const pl of state.plots) {
    pl.attractionBonus = pl.attractionBonus ?? 0;
    pl.surveyedBy = pl.surveyedBy ?? {};
    if (pl.surveyed && !pl.surveyedBy[state.currentPlayerId]) {
      pl.surveyedBy[state.currentPlayerId] = true;
    }
    pl.roadType = pl.roadType ?? (pl.hasRoad ? 'local' : 'none');
    pl.tollRate = pl.tollRate ?? 'free';
    pl.roadBlocked = pl.roadBlocked ?? false;
    pl.blockedPlayers = pl.blockedPlayers ?? [];
    pl.tollRevenueTotal = pl.tollRevenueTotal ?? 0;
    pl.crimeScore = pl.crimeScore ?? 5;
    pl.irradiatedTicks = pl.irradiatedTicks ?? 0;
    pl.disasterDamagedTicks = pl.disasterDamagedTicks ?? 0;

    if (pl.building) {
      // Migracja usuniętego Węzła Drogowego do Autostrady Płatnej
      if ((pl.building.type as string) === 'roadHub') {
        pl.building = null;
        pl.hasRoad = true;
        pl.roadType = 'highway';
        pl.isPlayerRoad = true;
        continue;
      }
      pl.building.damagePercent =
        pl.building.damagePercent ?? Math.max(0, 100 - (pl.building.condition ?? 100));
      pl.building.destroyedRuins = pl.building.destroyedRuins ?? false;
      pl.building.autoRepairEnabled = pl.building.autoRepairEnabled ?? true;
      pl.building.autoRepairThreshold = pl.building.autoRepairThreshold ?? 40;
      pl.building.activeHazard = pl.building.activeHazard ?? null;
      pl.building.hasRoadConnection = pl.building.hasRoadConnection ?? true;
      pl.building.logisticsMode = pl.building.logisticsMode ?? 'road';
      pl.building.visualTier = pl.building.visualTier ?? 0;
      pl.building.upgradeFlashTicks = pl.building.upgradeFlashTicks ?? 0;
      pl.building.status.onFire = pl.building.status.onFire ?? false;
      pl.building.status.hazmatIncident = pl.building.status.hazmatIncident ?? false;
      pl.building.status.noRoadLink = pl.building.status.noRoadLink ?? false;
      pl.building.status.robberyActive = pl.building.status.robberyActive ?? false;
      pl.building.status.missingInputs = pl.building.status.missingInputs ?? false;
      pl.building.status.sewageCrisis = pl.building.status.sewageCrisis ?? false;
      pl.building.status.wasteCrisis = pl.building.status.wasteCrisis ?? false;
      pl.building.status.disasterStruck = pl.building.status.disasterStruck ?? false;
    }
  }
  syncCorporateStocks(state);
}

export function listSaveSlots(): SaveSlotMeta[] {
  try {
    const raw = localStorage.getItem(SAVE_META_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SaveSlotMeta[];
    return Array.isArray(list) ? list.sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch {
    return [];
  }
}

export function getLatestSaveMeta(): SaveSlotMeta | null {
  const list = listSaveSlots();
  return list[0] ?? null;
}

export function saveGameToLocalStorage(state: GameState): boolean {
  return saveGameToSlot('slot1', state);
}

export function loadGameFromLocalStorage(): GameState | null {
  const latest = getLatestSaveMeta();
  if (latest) {
    const loaded = loadGameFromSlot(latest.slotId);
    if (loaded) return loaded;
  }
  return loadGameFromSlot('autosave') ?? loadGameFromSlot('slot1');
}

export function hasSavedGame(): boolean {
  return listSaveSlots().length > 0;
}

export function saveLastMpSession(session: LastMpSession): void {
  try {
    localStorage.setItem(MP_LAST_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function loadLastMpSession(): LastMpSession | null {
  try {
    const raw = localStorage.getItem(MP_LAST_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastMpSession;
    // Ważne przez 6 godzin
    if (Date.now() - parsed.updatedAt > 6 * 3600 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}
