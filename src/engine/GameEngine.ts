import {
  AI_STRATEGY_LABELS,
  CORPORATION_LEVELS,
  DEFAULT_MUTATORS,
  DIFFICULTY_PRESETS,
  GAME_CONFIG,
  PLAYER_COLORS,
} from '../config/gameConfig';
import { getArchetypeDefinition } from '../data/archetypes';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { DEFAULT_ENTREPRENEUR_SKILLS } from '../data/entrepreneurTree';
import { RESOURCE_DEFINITIONS, createInitialResourcePrices } from '../data/resources';
import { assignSecretGoalsForPlayers, evaluateSecretGoalsTick } from '../data/secretGoals';
import { DEFAULT_GLOBAL_TECH_TREE } from '../data/techTrees';
import { formatGameDate } from '../utils/formatters';
import { executeAITurn } from './AIBot';
import { computePlayerUtilityAndResourceBalance } from './BalanceSystem';
import {
  cloneBuildingOnPlot,
  computeCorporationLevel,
  constructBuildingOnPlot,
  demolishBuildingOnPlot,
  getPowerPlantFuelSpec,
  processBuildingTick,
  processPowerPlantFuelDeliveriesTick,
  repairBuilding,
  startBuildingTechResearch,
  toggleBuildingInsurance,
  toggleEmergencyFuelImport,
  type ProducedResourceLot,
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
  getCoalitionDominanceScore,
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
  lobbyGovernmentElection,
  placeLiveAuctionBid,
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
import { recordMatchStatsSample, updatePlayerMatchStatsAccumTick } from './MatchStatsTracker';
import {
  applyHighwayPolicyToAllForPlayer,
  batchBuildRoadForPlayer,
  batchBuyPlotsForPlayer,
  batchSurveyPlotsForPlayer,
  buildPlayerRoadOnPlot,
  buyPlotForPlayer,
  generateMap,
  proposePlotOfferForPlayer,
  recalculateSpatialNetwork,
  respondPlotOfferForPlayer,
  revealFogPlotForPlayer,
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
import { recalculateSynergiesAndPassengerDemand } from './SynergySystem';
import {
  addPlotWarehouseStock,
  computeEmergencyResponseEtaGrid,
  consumePlotWarehouseStock,
  hasExternalMarketAccess,
  processTollsAndLogisticsTick,
  refreshBuildingsRoadStatus,
  syncVehiclesForWorld,
} from './TransportSystem';
import type {
  AIStrategy,
  ArchetypeId,
  DifficultyPreset,
  GameSettings,
  GameState,
  HQVariantId,
  LastMpSession,
  LobbyState,
  Player,
  PlayerAction,
  PlayerCardProfile,
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
  archetype?: ArchetypeId;
  hqVariant?: HQVariantId;
  playerCard?: PlayerCardProfile;
  difficultyPreset?: DifficultyPreset;
}): Player {
  const globalTech: Player['globalTech'] = {};
  for (const node of DEFAULT_GLOBAL_TECH_TREE) {
    globalTech[node.id] = { status: node.prerequisites.length === 0 ? 'available' : 'locked', progress: 0 };
  }
  const entrepreneurSkills: Player['entrepreneurSkills'] = {};
  for (const sk of DEFAULT_ENTREPRENEUR_SKILLS) {
    entrepreneurSkills[sk.id] = sk.prerequisites.length === 0 ? 'available' : 'locked';
  }

  const arch = opts.archetype ?? 'standard';
  const archMods = getArchetypeDefinition(arch).modifiers;
  const preset = DIFFICULTY_PRESETS[opts.difficultyPreset ?? 'standard'] ?? DIFFICULTY_PRESETS.standard;
  const startCash = Math.round(GAME_CONFIG.startingCash * preset.startingCashMult * archMods.startingCashMult);
  const startApproval = Math.max(10, Math.min(95, 50 + archMods.baseApprovalDelta));

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
    cash: startCash,
    netWorth: startCash,
    incomePerMin: 0,
    expensesPerMin: 0,
    cashFlowPerMin: 0,
    electricityBalance: 0,
    waterBalance: 0,
    sewageBalance: 0,
    wasteBalance: 0,
    researchPoints: 15,
    skillPoints: 1,
    reputation: 50,
    militaryPower: 10,
    influence: {
      financial: 15,
      military: 10,
      social: 15,
      churchSupport: 15,
      mediaControl: 10,
      voterApproval: startApproval,
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
        netWorth: startCash,
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
    archetype: arch,
    hqVariant: opts.playerCard?.hqVariant ?? opts.hqVariant ?? 'classic',
    playerCard: opts.playerCard,
    secretGoals: [],
    secretGoalDominanceBonus: 0,
    revealedFogPlots: {},
    skillMilestonesEarned: [],
    statsAccum: {
      maxDebt: 0,
      tollEarned: 0,
      peakMarketTradeProfit: 0,
      totalPollution: 0,
      greenScore: 0,
      bailiffSeizures: 0,
      stockDividendsAndTrades: 0,
      patentsOwnedCount: 0,
      highApprovalTicks: 0,
      ownedPlotsPeak: 0,
    },
  };
}

export function initializeSinglePlayerGame(
  settings: GameSettings,
  playerName: string,
  companyName: string,
  playerColor: string,
  opts?: { archetype?: ArchetypeId; playerCard?: PlayerCardProfile }
): GameState {
  const diffPreset = settings.difficultyPreset ?? 'standard';
  const aiArchetypes: ArchetypeId[] = ['industrial_giant', 'tech_incubator', 'investment_fund', 'logistics_cartel', 'eco_innovator'];
  const players: Player[] = [
    createPlayerEntity({
      id: 'player_1',
      name: playerName || 'Gracz',
      companyName: companyName || 'Dominion Capital S.A.',
      color: playerColor || PLAYER_COLORS[0],
      isAI: false,
      connectionStatus: 'local',
      archetype: opts?.archetype ?? 'standard',
      hqVariant: opts?.playerCard?.hqVariant ?? 'classic',
      playerCard: opts?.playerCard,
      difficultyPreset: diffPreset,
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
        archetype: aiArchetypes[(i - 1) % aiArchetypes.length],
        difficultyPreset: diffPreset,
      })
    );
  }

  return createBaseGameState(settings, players, 'player_1');
}

export function initializeMultiplayerGame(lobby: LobbyState, localPlayerId: string): GameState {
  const isFast = lobby.mode === 'mp_fast';
  const diffPreset = lobby.difficultyPreset ?? 'standard';
  const settings: GameSettings = {
    mode: lobby.mode,
    playerCount: lobby.players.length,
    aiDifficulty: lobby.aiDifficulty,
    mapSize: lobby.mapSize,
    challengeDurationSeconds: isFast ? GAME_CONFIG.mpFastDurationSeconds : 0,
    economyMultiplier: isFast ? 2.4 : 1.0,
    disastersEnabled: lobby.disastersEnabled ?? true,
    victoryMode: lobby.victoryMode ?? 'solo',
    dominationThreshold: lobby.dominationThreshold ?? 75,
    difficultyPreset: diffPreset,
    scenarioId: lobby.scenarioId ?? 'sandbox',
    mutators: lobby.mutators ? { ...lobby.mutators } : { ...DEFAULT_MUTATORS },
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
      archetype: lp.archetype ?? 'standard',
      hqVariant: lp.playerCard?.hqVariant ?? 'classic',
      playerCard: lp.playerCard,
      difficultyPreset: diffPreset,
    })
  );

  return createBaseGameState(settings, players, localPlayerId);
}

function applyScenarioSetup(state: GameState): void {
  const scenario = state.settings.scenarioId ?? 'sandbox';
  const size = state.settings.mapSize;
  const center = Math.floor(size / 2);

  if (scenario === 'fallen_giant') {
    const assetTypes: Array<'steelMill' | 'coalPowerPlant' | 'solarFarm' | 'shoppingMall'> = [
      'steelMill',
      'coalPowerPlant',
      'solarFarm',
      'shoppingMall',
    ];
    let placed = 0;
    const centerCandidates = state.plots
      .filter((p) => p.terrain !== 'water' && !p.building && Math.hypot(p.gridX - center, p.gridY - center) <= 4)
      .slice(0, 8);
    for (const plot of centerCandidates) {
      if (placed < assetTypes.length) {
        const bType = assetTypes[placed];
        const bDef = BUILDING_DEFINITIONS[bType];
        plot.building = {
          id: `fg_bld_${placed}`,
          type: bType,
          plotId: plot.id,
          ownerId: 'fallen_giant_pool',
          name: bDef.name,
          category: bDef.category,
          icon: bDef.icon,
          level: 2,
          visualTier: 1,
          condition: 75,
          damagePercent: 25,
          autoRepairEnabled: false,
          autoRepairThreshold: 40,
          workers: bDef.maxWorkers,
          maxWorkers: bDef.maxWorkers,
          workerSkill: 60,
          efficiency: 0,
          isActive: false,
          selected: false,
          stockpileOutput: false,
          storage: {},
          storageCapacity: bDef.storageCapacity,
          techTree: bDef.internalTechTree.map((n) => ({ ...n, progress: 0, status: n.prerequisites.length === 0 ? 'available' : 'locked' })),
          activeResearchId: null,
          revenue: 0,
          costs: { inputs: 0, wages: 0, zus: 0, energy: 0, water: 0, transport: 0, maintenance: 0, environmentalFine: 0, taxes: 0, total: 0 },
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
            noRoadLink: false,
          },
          activeHazard: null,
          hasRoadConnection: true,
          logisticsMode: 'road',
          sabotagedTicks: 0,
          boycottedTicks: 0,
        };
        placed++;
      } else if (!plot.hasRoad) {
        plot.hasRoad = true;
        plot.roadType = 'highway';
        plot.tollRate = 'free';
      }
    }
    state.news.unshift({
      id: 'scn_fg_intro',
      headline: '🏛️ Scenariusz: Upadek Giganta w centrum mapy!',
      brief: 'W sercu metropolii stoją zamrożone obiekty dawnego konglomeratu. Komornik co kilka miesięcy wystawia je na 30-sekundową aukcję!',
      fullText: 'Zbierz kapitał na start i licytuj gotowe fabryki, elektrownie i galerie podczas transmisji na żywo.',
      analysis: 'Aukcje startują cyklicznie od 12. cyklu gry.',
      hints: [],
      type: 'opportunity',
      dateLabel: '01 Sty 2026',
      tick: 0,
      read: false,
    });
  } else if (scenario === 'cold_war' && state.players.length >= 2) {
    state.settings.victoryMode = 'coalition';
    const half = Math.ceil(state.players.length / 2);
    const northMembers = state.players.slice(0, half).map((p) => p.id);
    const southMembers = state.players.slice(half).map((p) => p.id);
    const northColId = 'col_cw_north';
    const southColId = 'col_cw_south';
    state.coalitions = [
      {
        id: northColId,
        name: 'Blok Północny',
        tag: 'NORD',
        color: '#38bdf8',
        leaderId: northMembers[0],
        memberIds: northMembers,
        invitedPlayerIds: [],
        shareGeology: true,
        createdTick: 0,
      },
      {
        id: southColId,
        name: 'Blok Południowy',
        tag: 'SUD',
        color: '#f43f5e',
        leaderId: southMembers[0],
        memberIds: southMembers,
        invitedPlayerIds: [],
        shareGeology: true,
        createdTick: 0,
      },
    ];
    for (const p of state.players) {
      p.coalitionId = northMembers.includes(p.id) ? northColId : southColId;
    }
    state.embargoes = state.embargoes ?? [];
    for (const nId of northMembers) {
      for (const sId of southMembers) {
        state.embargoes.push({ issuerId: nId, targetId: sId, expiresTick: 9999 });
        state.embargoes.push({ issuerId: sId, targetId: nId, expiresTick: 9999 });
      }
    }
    state.news.unshift({
      id: 'scn_cw_intro',
      headline: '⚔️ Scenariusz: Zimna Wojna Korporacji (NORD vs SUD)!',
      brief: 'Wszystkie firmy zostały podzielone na dwa bloki objęte wzajemnym embargiem handlowym. Wspólne drogi koalicji i zbrojenia są kluczowe!',
      fullText: 'Członkowie Twojego bloku dzielą badania geologiczne i korzystają z darmowego przejazdu po sojuszniczych autostradach.',
      analysis: 'W trybie koalicyjnym walczycie razem o dominację sojuszu.',
      hints: [],
      type: 'negative',
      dateLabel: '01 Sty 2026',
      tick: 0,
      read: false,
    });
  } else if (scenario === 'green_transition') {
    state.news.unshift({
      id: 'scn_gt_intro',
      headline: '🌿 Scenariusz: Zapowiedź Zielonej Transformacji',
      brief: 'Za ok. 2 lata wejdzie w życie ustawa CO₂ podwajająca kary za węgiel i zakazująca nowych spalarni. Inwestuj w OZE, lit i recykling!',
      fullText: 'Wczesna transformacja energetyczna uchroni spółkę przed gigantycznym podatkiem emisyjnym.',
      analysis: 'Farmy wiatrowe, słoneczne, baterie EV i recykling otrzymają wsparcie rządowe.',
      hints: [],
      type: 'forecast',
      dateLabel: '01 Sty 2026',
      tick: 0,
      read: false,
    });
  } else if (scenario === 'gold_rush') {
    state.news.unshift({
      id: 'scn_gr_intro',
      headline: '💎 Scenariusz: Gorączka Złota i Diamentów!',
      brief: 'Geolodzy zgłaszają niezwykle bogate anomalie złota, diamentów i litu pod powierzchnią mapy przy podkręconej zmienności giełdy!',
      fullText: 'Wyślij geologów i Georadar 3×3 zanim konkurencja wykupi najbogatsze grunty.',
      analysis: 'Wysoka zmienność cen premiuje szybkie kontrakty i arbitraż w trakcie baniek.',
      hints: [],
      type: 'opportunity',
      dateLabel: '01 Sty 2026',
      tick: 0,
      read: false,
    });
  }
}

function createBaseGameState(settings: GameSettings, players: Player[], currentPlayerId: string): GameState {
  const plots = generateMap(settings.mapSize, settings.mapSeed, {
    goldRush: settings.scenarioId === 'gold_rush',
    playerCount: players.length,
  });
  const resourcePrices = createInitialResourcePrices();
  const domThreshold = settings.dominationThreshold ?? 75;
  const normalizedSettings: GameSettings = {
    ...settings,
    economyMultiplier: settings.economyMultiplier ?? 1,
    dominationThreshold: domThreshold,
  };

  const state: GameState = {
    phase: 'Playing',
    speed: 1,
    time: { tick: 0, day: 1, month: 1, year: 2026, hour: 9, minute: 0 },
    elapsedSeconds: 0,
    lastSyncTimestamp: Date.now(),
    speedRequest: null,
    settings: normalizedSettings,
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
    fuelDeliveries: [],
    b2bRoutes: [],
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
    monopolyThreshold: domThreshold,
    disconnectAlert: null,
    notifications: [],
    government: {
      currentGov: 'free_market',
      nextElectionTick: 72,
      lastElectionTick: 0,
      lobbyVotes: { free_market: 2, ecological: 1, interventionist: 2 },
    },
    liveAuction: null,
    matchStatsHistory: [],
    greenTransitionEntered: false,
    carbonTaxActive: false,
  };

  applyScenarioSetup(state);
  assignSecretGoalsForPlayers(state);
  syncCorporateStocks(state);
  for (const st of state.stocks ?? []) {
    st.buybackReserve = st.buybackReserve ?? 0;
  }
  recalculateSpatialNetwork(state.plots);
  refreshBuildingsRoadStatus(state);
  recalculateSynergiesAndPassengerDemand(state);
  computeEmergencyResponseEtaGrid(state, currentPlayerId);
  syncVehiclesForWorld(state);
  recordMatchStatsSample(state, true);
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

  // Przelicz bilans mediów każdego gracza przed tiknięciem budynków (z rozbiciem na klastry sieciowe)
  const utilityByPlayer = new Map<string, UtilityTickSnapshot>();
  const allProducedLots: ProducedResourceLot[] = [];
  for (const player of state.players) {
    if (player.isEliminated) continue;
    const util = computePlayerUtilityAndResourceBalance(state, player);
    player.electricityBalance = util.electricityNet;
    player.waterBalance = util.waterNet;
    player.sewageBalance = util.sewageNet;
    player.wasteBalance = util.wasteNet;
    const byCluster: NonNullable<UtilityTickSnapshot['byCluster']> = {};
    for (const c of util.clusters ?? []) {
      byCluster[c.clusterId] = {
        elecRatio: c.electricityCoverageRatio,
        waterRatio: c.waterCoverageRatio,
        sewageNet: c.sewageNet,
        wasteNet: c.wasteNet,
      };
    }
    const b2bDivertRemaining: Partial<Record<ResourceType, number>> = {};
    for (const c of state.contracts) {
      if (
        c.status === 'active' &&
        c.sellerId === player.id &&
        c.kind !== 'spot' &&
        c.kind !== 'barter' &&
        c.transportMode !== 'blocked' &&
        c.quantityPerTick > 0
      ) {
        const buyer = state.players.find((bp) => bp.id === c.buyerId && !bp.isEliminated);
        if (buyer && buyer.cash >= c.quantityPerTick * c.pricePerUnit * 0.25) {
          b2bDivertRemaining[c.resource] = (b2bDivertRemaining[c.resource] ?? 0) + c.quantityPerTick;
        }
      }
    }

    utilityByPlayer.set(player.id, {
      elecRatio: util.electricityCoverageRatio,
      waterRatio: util.waterCoverageRatio,
      sewageNet: util.sewageNet,
      wasteNet: util.wasteNet,
      byCluster,
      producedLots: allProducedLots,
      b2bDivertRemaining,
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

    // Pasywny przyrost pkt Prezesa (1 pkt / 36 tur) + kamienie milowe korporacji
    if (state.time.tick % 36 === 0) {
      player.skillPoints += 1;
    }

    const milestones = player.skillMilestonesEarned ?? [];
    if (!milestones.includes('nw_10m') && player.netWorth >= 10_000_000) {
      milestones.push('nw_10m');
      player.skillPoints += 2;
    }
    if (!milestones.includes('nw_25m') && player.netWorth >= 25_000_000) {
      milestones.push('nw_25m');
      player.skillPoints += 3;
    }
    if (!milestones.includes('rev_500k') && player.totalRevenueEarned >= 1_500_000) {
      milestones.push('rev_500k');
      player.skillPoints += 1;
    }
    player.skillMilestonesEarned = milestones;

    const entMods = getPlayerEntrepreneurModifiers(state, player);
    const archResMult = getArchetypeDefinition(player.archetype).modifiers.researchSpeedMult;
    for (const def of state.globalTechDefs) {
      const gt = player.globalTech[def.id];
      if (!gt || gt.status !== 'researching') continue;
      gt.progress = Math.min(100, gt.progress + (100 / def.researchTicks) * (1 + entMods.researchSpeedBonus) * archResMult);
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

  // Faza I: Podatek gruntowy + wydobycie, OZE bez paliwa i gospodarka odpadami
  const deferredProcessingPlots: typeof state.plots = [];
  const deferredFuelPowerPlots: typeof state.plots = [];
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
      const isFuelPowerPlant = getPowerPlantFuelSpec(plot.building.type) !== null;
      if (isFuelPowerPlant) {
        deferredFuelPowerPlots.push(plot);
      } else if (cat === 'mining' || cat === 'energy' || cat === 'waste') {
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

  // Faza II: Przetwórstwo (m.in. Rafinerie Ropy), nieruchomości, usługi, bezpieczeństwo i wpływy
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

  // Rozliczenie fizycznych kontraktów B2B i dostawy paliwa do elektrowni
  const b2bReceipts = processContractsTick(state);
  processPowerPlantFuelDeliveriesTick(state, allProducedLots, b2bReceipts);

  // Faza III: Elektrownie konwencjonalne i jądrowe spalają zgromadzony zapas paliwa
  for (const plot of deferredFuelPowerPlots) {
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
  // Odśwież bilans mediów po pracy elektrowni paliwowych (aby prąd na mapie i w HUD był aktualny natychmiast)
  for (const player of state.players) {
    if (player.isEliminated) continue;
    const postUtil = computePlayerUtilityAndResourceBalance(state, player);
    player.electricityBalance = postUtil.electricityNet;
    player.waterBalance = postUtil.waterNet;
    player.sewageBalance = postUtil.sewageNet;
    player.wasteBalance = postUtil.wasteNet;
  }

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
      const msKey = `corp_${nextLevel}`;
      player.skillMilestonesEarned = player.skillMilestonesEarned ?? [];
      if (!player.skillMilestonesEarned.includes(msKey)) {
        player.skillMilestonesEarned.push(msKey);
        player.skillPoints += 2;
      }
      if (player.id === state.currentPlayerId) {
        pushNotification(
          state,
          `Awans Korporacji: Poziom ${nextLevel}!`,
          `Twoja firma osiągnęła status "${CORPORATION_LEVELS[nextLevel].name}", zdobyła +2 pkt Prezesa i odblokowała nowe sektory!`,
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

  evaluateSecretGoalsTick(state);
  updatePlayerMatchStatsAccumTick(state);

  if (state.time.tick % 5 === 0) {
    recalculateSpatialNetwork(state.plots);
    refreshBuildingsRoadStatus(state);
    recalculateSynergiesAndPassengerDemand(state);
    computeEmergencyResponseEtaGrid(state, state.currentPlayerId);
    syncVehiclesForWorld(state);
  }
  recordMatchStatsSample(state);

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
  if (state.winnerId || state.challengeCompleted) return;
  if (state.settings.weeklyChallengeId && state.settings.weeklyTargetNetWorth) {
    const human = state.players.find((p) => !p.isAI && !p.isEliminated);
    if (human && human.netWorth >= state.settings.weeklyTargetNetWorth) {
      state.winnerId = human.id;
      state.challengeCompleted = true;
      state.speed = 0;
      state.victoryReason = `Ukończono Wyzwanie Tygodnia (${state.settings.weeklyChallengeId}) osiągając ${human.netWorth.toLocaleString('pl-PL')} zł w ${state.time.tick} cykli!`;
      return;
    }
    if (state.time.year >= (state.settings.weeklyMaxYear ?? 2034)) {
      state.challengeCompleted = true;
      state.speed = 0;
      state.victoryReason = `Czas Wyzwania Tygodnia (${state.settings.weeklyChallengeId}) upłynął przed osiągnięciem celu wyceny.`;
      return;
    }
  }
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

  const domThreshold = state.settings.dominationThreshold ?? state.monopolyThreshold ?? 75;

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
        const coalitionDominance = getCoalitionDominanceScore(state, activeMembers);

        if ((wealthPct >= domThreshold || coalitionDominance >= domThreshold) && combinedNW >= 16_000_000 && combinedBuildings >= 6) {
          state.winningCoalitionId = col.id;
          state.winnerId = col.leaderId;
          state.victoryReason = `Koalicja [${col.tag}] ${col.name} osiągnęła łączną dominację rynkową (${Math.max(Math.round(wealthPct), coalitionDominance)}% przy progu ${domThreshold}%) i zwyciężyła jako sojusz!`;
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
      if (dominance >= domThreshold && ownedBuildings >= 5 && p.netWorth > 12_000_000) {
        const col = state.settings.victoryMode === 'coalition' ? getPlayerCoalition(state, p.id) : undefined;
        state.winningCoalitionId = col?.id ?? null;
        state.winnerId = p.id;
        state.victoryReason = col
          ? `Koalicja [${col.tag}] ${col.name} zdominowała rynek dzięki potędze ${p.companyName} (${dominance}% / cel ${domThreshold}%)!`
          : `${p.companyName} osiągnęła monopolistyczną dominację (${dominance}% przy progu ${domThreshold}%) na mapie i kontroluje rynek!`;
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
        computePlayerUtilityAndResourceBalance(state, player);
        computeEmergencyResponseEtaGrid(state, state.currentPlayerId);
        syncVehiclesForWorld(state);
      }
      return {
        ok: r.ok,
        message:
          r.error ??
          (roadClass === 'bridge'
            ? 'Wybudowano Most Drogowy łączący brzegi!'
            : roadClass === 'highway'
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
        computePlayerUtilityAndResourceBalance(state, player);
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
        computePlayerUtilityAndResourceBalance(state, player);
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
      let rem = qty;
      if (player.stockLocations) {
        for (const locId of Object.keys(player.stockLocations)) {
          if (rem <= 0.001) break;
          rem -= consumePlotWarehouseStock(player, locId, action.resource, rem);
        }
      }
      if (rem > 0) {
        player.warehouseStockpile[action.resource] = Math.max(0, (player.warehouseStockpile[action.resource] ?? 0) - rem);
      }
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
      const deliveryPlot =
        state.plots.find(
          (p) =>
            p.ownerId === player.id &&
            p.building &&
            (p.building.type === 'warehouse' || p.building.type === 'corporateHQ') &&
            hasExternalMarketAccess(state, p, player.id)
        ) ??
        state.plots.find((p) => p.ownerId === player.id && p.building && hasExternalMarketAccess(state, p, player.id)) ??
        state.plots.find((p) => p.ownerId === player.id && (p.building?.type === 'corporateHQ' || p.building?.type === 'warehouse')) ??
        state.plots.find((p) => p.ownerId === player.id);
      player.cash -= totalCost;
      if (deliveryPlot) {
        addPlotWarehouseStock(player, deliveryPlot.id, action.resource, action.amount);
      } else {
        player.warehouseStockpile[action.resource] =
          (player.warehouseStockpile[action.resource] ?? 0) + action.amount;
      }
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
      const archPatentCostMult = getArchetypeDefinition(player.archetype).modifiers.labPatentCostMult;
      const doneTechs = Object.values(player.globalTech).filter((t) => t.status === 'done').length;
      const expScale = Math.pow(1.06, doneTechs);
      const rpCost = Math.round(def.cost * expScale * archPatentCostMult);
      const moneyCost = Math.round(def.moneyCost * (1 - entMods.researchDiscount) * archPatentCostMult);
      if (player.researchPoints < rpCost) {
        return { ok: false, message: `Wymaga ${rpCost} pkt badań (masz ${Math.floor(player.researchPoints)}).` };
      }
      if (player.cash < moneyCost) {
        return { ok: false, message: `Wymaga ${moneyCost.toLocaleString('pl-PL')} zł.` };
      }
      player.researchPoints -= rpCost;
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
    case 'batchBuyPlots': {
      const r = batchBuyPlotsForPlayer(state, player, action.plotIds);
      if (r.ok) {
        computeEmergencyResponseEtaGrid(state, state.currentPlayerId);
        recalculateSynergiesAndPassengerDemand(state);
      }
      return {
        ok: r.ok,
        message: r.error ?? `Kupiono hurtem ${r.boughtCount} działek za ${r.totalSpent.toLocaleString('pl-PL')} zł.`,
      };
    }
    case 'batchSurveyPlots': {
      const r = batchSurveyPlotsForPlayer(state, player, action.plotIds);
      return {
        ok: r.ok,
        message:
          r.error ??
          `Zbadano ${r.scannedCount} działek (wykryto ${r.foundCount} złóż) za ${r.totalCost.toLocaleString('pl-PL')} zł.`,
      };
    }
    case 'batchBuildRoad': {
      const r = batchBuildRoadForPlayer(state, player, action.plotIds, action.roadClass);
      if (r.ok) {
        computePlayerUtilityAndResourceBalance(state, player);
        computeEmergencyResponseEtaGrid(state, state.currentPlayerId);
        syncVehiclesForWorld(state);
      }
      return {
        ok: r.ok,
        message:
          r.error ??
          `Wybudowano ${r.builtCount} odc. ${
            action.roadClass === 'bridge'
              ? 'Mostu / Drogi'
              : action.roadClass === 'highway'
                ? 'Autostrady'
                : 'Drogi'
          } (${r.totalCost.toLocaleString('pl-PL')} zł).`,
      };
    }
    case 'applyHighwayPolicyToAll': {
      const r = applyHighwayPolicyToAllForPlayer(state, player, action.tollRate, action.roadBlocked);
      if (r.ok) {
        computeEmergencyResponseEtaGrid(state, state.currentPlayerId);
        syncVehiclesForWorld(state);
      }
      return { ok: r.ok, message: r.message };
    }
    case 'cloneBuilding': {
      const targetPlot = state.plots.find((p) => p.id === action.plotId);
      const sourceBuilding = state.plots.find((p) => p.building?.id === action.sourceBuildingId)?.building;
      if (!targetPlot || !sourceBuilding || sourceBuilding.ownerId !== player.id) {
        return { ok: false, message: 'Nie znaleziono docelowej działki lub wzorca budynku.' };
      }
      const r = cloneBuildingOnPlot(state, player, targetPlot, sourceBuilding, action.includeUpgrades);
      if (r.ok) {
        computeEmergencyResponseEtaGrid(state, state.currentPlayerId);
        syncVehiclesForWorld(state);
      }
      return {
        ok: r.ok,
        message:
          r.error ??
          `Sklonowano "${sourceBuilding.name}" (${action.includeUpgrades ? '1:1 z ulepszeniami' : 'wersja bazowa'}) za ${r.blueprint?.totalCost.toLocaleString('pl-PL')} zł.`,
      };
    }
    case 'toggleInsurance': {
      const b = findPlayerBuilding(state, player.id, action.buildingId);
      if (!b) return { ok: false, message: 'Nie znaleziono budynku.' };
      const r = toggleBuildingInsurance(b);
      return { ok: r.ok, message: r.message };
    }
    case 'toggleEmergencyFuelImport': {
      const b = findPlayerBuilding(state, player.id, action.buildingId);
      if (!b) return { ok: false, message: 'Nie znaleziono elektrowni.' };
      const r = toggleEmergencyFuelImport(b);
      return { ok: r.ok, message: r.message };
    }
    case 'placeAuctionBid': {
      return placeLiveAuctionBid(state, player, action.auctionId, action.bidAmount);
    }
    case 'lobbyElection': {
      return lobbyGovernmentElection(state, player, action.govKind, action.useInfluence);
    }
    case 'revealFogPlot': {
      const plot = state.plots.find((p) => p.id === action.plotId);
      if (!plot) return { ok: false, message: 'Nie znaleziono działki.' };
      const r = revealFogPlotForPlayer(state, player, plot);
      return {
        ok: r.ok,
        message: r.error ?? `Raport wywiadu ujawnił sektor (${plot.gridX}, ${plot.gridY}) i sąsiednie pola.`,
      };
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
  state.settings.dominationThreshold = state.settings.dominationThreshold ?? 75;
  state.monopolyThreshold = state.settings.dominationThreshold;
  state.settings.difficultyPreset = state.settings.difficultyPreset ?? 'standard';
  state.settings.scenarioId = state.settings.scenarioId ?? 'sandbox';
  state.settings.mutators = state.settings.mutators ?? { ...DEFAULT_MUTATORS };
  state.government = state.government ?? {
    currentGov: 'free_market',
    nextElectionTick: state.time.tick + 72,
    lastElectionTick: state.time.tick,
    lobbyVotes: { free_market: 2, ecological: 1, interventionist: 2 },
  };
  state.liveAuction = state.liveAuction ?? null;
  state.matchStatsHistory = state.matchStatsHistory ?? [];
  state.greenTransitionEntered = state.greenTransitionEntered ?? false;
  state.carbonTaxActive = state.carbonTaxActive ?? false;

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
    p.archetype = p.archetype ?? 'standard';
    p.hqVariant = p.hqVariant ?? 'classic';
    p.secretGoals = p.secretGoals ?? [];
    p.secretGoalDominanceBonus = p.secretGoalDominanceBonus ?? 0;
    p.revealedFogPlots = p.revealedFogPlots ?? {};
    p.skillMilestonesEarned = p.skillMilestonesEarned ?? [];
    p.statsAccum = p.statsAccum ?? {
      maxDebt: 0,
      tollEarned: 0,
      peakMarketTradeProfit: 0,
      totalPollution: 0,
      greenScore: 0,
      bailiffSeizures: 0,
      stockDividendsAndTrades: 0,
      patentsOwnedCount: 0,
      highApprovalTicks: 0,
      ownedPlotsPeak: 0,
    };

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
      pl.building.insured = pl.building.insured ?? false;
      pl.building.insuranceClaimsCount = pl.building.insuranceClaimsCount ?? 0;
      pl.building.strikeTicks = pl.building.strikeTicks ?? 0;
      pl.building.status.onFire = pl.building.status.onFire ?? false;
      pl.building.status.hazmatIncident = pl.building.status.hazmatIncident ?? false;
      pl.building.status.noRoadLink = pl.building.status.noRoadLink ?? false;
      pl.building.status.robberyActive = pl.building.status.robberyActive ?? false;
      pl.building.status.missingInputs = pl.building.status.missingInputs ?? false;
      pl.building.status.sewageCrisis = pl.building.status.sewageCrisis ?? false;
      pl.building.status.wasteCrisis = pl.building.status.wasteCrisis ?? false;
      pl.building.status.disasterStruck = pl.building.status.disasterStruck ?? false;
      pl.building.status.onStrike = pl.building.status.onStrike ?? false;
      pl.building.status.noFuel = pl.building.status.noFuel ?? false;
      const fuelSpec = getPowerPlantFuelSpec(pl.building.type);
      if (fuelSpec) {
        pl.building.fuelResource = pl.building.fuelResource ?? fuelSpec.primaryResource;
        pl.building.fuelMax = pl.building.fuelMax ?? fuelSpec.maxStock;
        pl.building.fuelStored =
          pl.building.fuelStored ?? Number((pl.building.fuelMax * 0.5).toFixed(2));
        pl.building.fuelLevel =
          pl.building.fuelLevel ??
          Math.round((pl.building.fuelStored / pl.building.fuelMax) * 100);
        pl.building.fuelSourceMode = pl.building.fuelSourceMode ?? 'none';
        pl.building.emergencyMarketImport = pl.building.emergencyMarketImport ?? false;
      }
    }
    pl.synergyPercent = pl.synergyPercent ?? 0;
    pl.passengerDemandPercent = pl.passengerDemandPercent ?? 100;
    pl.activeSynergies = (pl.activeSynergies ?? []).filter((s) => (s.kind as string) !== 'sse_zone');
    // Wyczyść przestarzałe pola usuniętej mechaniki SSE z dawnych zapisów
    const rawPlot = pl as unknown as Record<string, unknown>;
    if ('isSseZone' in rawPlot) delete rawPlot.isSseZone;
    if ('sseExpiresTick' in rawPlot) delete rawPlot.sseExpiresTick;
  }
  state.fuelDeliveries = state.fuelDeliveries ?? [];
  state.b2bRoutes = state.b2bRoutes ?? [];
  for (const p of state.players) {
    if (!p.stockLocations) {
      p.stockLocations = {};
      const anchor =
        state.plots.find((pl) => pl.ownerId === p.id && pl.building?.type === 'corporateHQ') ??
        state.plots.find((pl) => pl.ownerId === p.id && pl.building) ??
        state.plots.find((pl) => pl.ownerId === p.id);
      if (anchor) {
        const seeded: Partial<Record<ResourceType, number>> = {};
        for (const [k, v] of Object.entries(p.warehouseStockpile ?? {})) {
          if ((v ?? 0) > 0) seeded[k as ResourceType] = v;
        }
        if (Object.keys(seeded).length > 0) {
          p.stockLocations[anchor.id] = seeded;
        }
      }
    }
  }
  state.news = (state.news ?? []).filter((n) => !String(n.id).startsWith('sse_'));
  assignSecretGoalsForPlayers(state);
  syncCorporateStocks(state);
  for (const st of state.stocks ?? []) {
    st.buybackReserve = st.buybackReserve ?? 0;
  }
  recalculateSpatialNetwork(state.plots);
  refreshBuildingsRoadStatus(state);
  recalculateSynergiesAndPassengerDemand(state);
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
