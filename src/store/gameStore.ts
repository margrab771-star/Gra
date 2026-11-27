import { create } from 'zustand';
import { type AchievementDefinition } from '../data/achievements';
import { buildWeeklyChallengeGameSettings, type WeeklyChallengeSpec } from '../data/weeklyChallenge';
import {
  applyPlayerAction,
  getLatestSaveMeta,
  hasSavedGame,
  initializeMultiplayerGame,
  initializeSinglePlayerGame,
  listSaveSlots,
  loadGameFromLocalStorage,
  loadGameFromSlot,
  loadLastMpSession,
  migrateGameStateInPlace,
  saveGameToLocalStorage,
  saveGameToSlot,
  saveLastMpSession,
  stepGameSimulation,
} from '../engine/GameEngine';
import {
  evaluateLiveAchievements,
  getActiveProfile,
  recordCompletedMatchToProfile,
  toPlayerCard,
} from '../engine/profileManager';
import type {
  ArchetypeId,
  BuildingType,
  GamePhase,
  GameSettings,
  GameSpeed,
  GameState,
  GovernmentKind,
  LastMpSession,
  LobbyState,
  MapHeatmapMode,
  Player,
  PlayerAction,
  ResourcePrice,
  ResourceType,
  SaveSlotId,
  SaveSlotMeta,
  TollRate,
  UserAccountProfile,
} from '../engine/types';
import { submitLeaderboardResult } from '../network/leaderboardService';
import { getRoomCodeFromUrl, multiplayerManager } from '../network/multiplayerManager';

export type ActiveModal =
  | 'none'
  | 'newspaper'
  | 'tech'
  | 'entrepreneur'
  | 'influence'
  | 'finance'
  | 'contracts'
  | 'leaderboard'
  | 'save';

interface ToastMessage {
  id: string;
  ok: boolean;
  text: string;
}

interface GameStoreState {
  phase: GamePhase;
  gameState: GameState | null;
  selectedPlotId: string | null;
  showBuildSelector: boolean;
  activeModal: ActiveModal;
  inspectedResource: ResourcePrice | null;
  showTutorial: boolean;
  tutorialStep: number;
  showVictoryModal: boolean;

  isMultiplayer: boolean;
  isHost: boolean;
  localPlayerId: string;
  lobbyState: LobbyState | null;
  initialRoomCode: string | null;

  toast: ToastMessage | null;
  savedAvailable: boolean;
  saveSlotsMeta: SaveSlotMeta[];
  latestSaveMeta: SaveSlotMeta | null;
  lastMpSession: LastMpSession | null;
  showTransportRoutes: boolean;
  showUtilityPopover: boolean;
  heatmapMode: MapHeatmapMode;
  targetMode: 'missile' | 'nuke' | null;
  cloneBuildingType: BuildingType | null;
  focusRequest: { plotId: string; nonce: number } | null;
  showTutorialModal: boolean;
  pinnedResources: ResourceType[];

  // v6.0 & v7.0 UI/Profile/QoL State
  activeProfile: UserAccountProfile;
  showAuthModal: boolean;
  showProfileModal: boolean;
  showWeeklyModal: boolean;
  lastMatchRewardSummary: { xpEarned: number; newlyUnlocked: AchievementDefinition[] } | null;
  recordedMatchEnded: boolean;
  mapToolMode: 'normal' | 'area_select' | 'road_local' | 'road_highway' | 'road_bridge';
  areaSelectedPlotIds: string[];
  hoveredBuildType: BuildingType | null;
  cloneBlueprintSource: {
    buildingId: string;
    buildingType: BuildingType;
    includeUpgrades: boolean;
  } | null;

  setShowAuthModal: (show: boolean) => void;
  setShowProfileModal: (show: boolean) => void;
  setShowWeeklyModal: (show: boolean) => void;
  refreshActiveProfile: () => void;
  applyUpdatedProfile: (profile: UserAccountProfile) => void;
  setMapToolMode: (mode: 'normal' | 'area_select' | 'road_local' | 'road_highway' | 'road_bridge') => void;
  setAreaSelectedPlotIds: (ids: string[]) => void;
  setHoveredBuildType: (bType: BuildingType | null) => void;
  setCloneBlueprintSource: (
    src: { buildingId: string; buildingType: BuildingType; includeUpgrades: boolean } | null
  ) => void;

  setTargetMode: (mode: 'missile' | 'nuke' | null) => void;
  setCloneBuildingType: (bType: BuildingType | null) => void;
  focusPlot: (plotId: string) => void;
  setShowTutorialModal: (show: boolean) => void;
  togglePinResource: (res: ResourceType) => void;

  goToMenu: () => void;
  goToSetup: () => void;
  goToMultiplayer: () => void;
  startSinglePlayer: (
    settings: GameSettings,
    playerName: string,
    companyName: string,
    color: string,
    withTutorial: boolean,
    opts?: { archetype?: ArchetypeId }
  ) => void;
  startWeeklyChallengeGame: (spec?: WeeklyChallengeSpec) => void;
  continueSavedGame: () => void;
  saveCurrentGame: () => void;
  autosaveNow: () => void;
  saveToSlot: (slotId: SaveSlotId) => void;
  loadFromSlot: (slotId: SaveSlotId) => void;
  refreshSavesMeta: () => void;
  toggleTransportRoutes: () => void;
  setShowUtilityPopover: (show: boolean) => void;
  setHeatmapMode: (mode: MapHeatmapMode) => void;
  startQuickTutorialGame: () => void;

  initNetworkListeners: () => void;
  createMultiplayerRoom: (
    name: string,
    company: string,
    color: string,
    opts?: { archetype?: ArchetypeId }
  ) => Promise<void>;
  joinMultiplayerRoom: (
    code: string,
    name: string,
    company: string,
    color: string,
    opts?: { archetype?: ArchetypeId }
  ) => Promise<void>;
  startMultiplayerMatch: () => void;
  requestFullSync: () => void;
  leaveMultiplayer: () => void;
  takeoverDisconnectedPlayer: (playerId: string) => void;
  pauseOnDisconnect: () => void;
  dismissDisconnectAlert: () => void;

  tickSimulation: () => void;
  tickSecond: () => void;

  selectPlot: (plotId: string | null) => void;
  setShowBuildSelector: (show: boolean) => void;
  setActiveModal: (modal: ActiveModal) => void;
  setInspectedResource: (res: ResourcePrice | null) => void;
  nextTutorialStep: () => void;
  closeTutorial: () => void;
  continueEndlessAfterVictory: () => void;
  markNewsRead: (articleId: string) => void;
  showToast: (ok: boolean, text: string) => void;

  dispatchAction: (action: PlayerAction) => void;
  setSpeed: (speed: GameSpeed) => void;
  requestSpeedChange: (speed: GameSpeed) => void;
  dismissSpeedRequest: () => void;
  buyPlot: (plotId: string) => void;
  sellPlot: (plotId: string) => void;
  surveyPlot: (plotId: string) => void;
  buildOnPlot: (plotId: string, buildingType: BuildingType) => void;
  demolishBuilding: (plotId: string) => void;
  repairBuilding: (buildingId: string) => void;
  setAutoRepair: (buildingId: string, enabled: boolean, threshold: number) => void;
  applyAutoRepairTemplate: (enabled: boolean, threshold: number, setAsDefault: boolean) => void;
  toggleStockpile: (buildingId: string) => void;
  setStockpileAllocation: (opts: {
    globalPercent?: number;
    resource?: ResourceType;
    resourcePercent?: number | null;
  }) => void;
  sellWarehouseStock: (resource: ResourceType, amount: number) => void;
  buyWarehouseStock: (resource: ResourceType, amount: number) => void;
  researchBuildingTech: (buildingId: string, nodeId: string) => void;
  hireWorkers: (buildingId: string, count: number) => void;
  fireWorkers: (buildingId: string, count: number) => void;
  trainWorkers: (buildingId: string) => void;
  researchGlobalTech: (nodeId: string) => void;
  unlockSkill: (nodeId: string) => void;
  takeLoan: (amount: number, months: number) => void;
  repayLoan: (loanId: string) => void;
  proposeContract: (
    partnerId: string,
    resource: ResourceType,
    quantityPerTick: number,
    pricePerUnit: number,
    durationTicks: number,
    isSelling: boolean,
    opts?: {
      kind?: 'recurring' | 'spot' | 'barter';
      barterResource?: ResourceType;
      barterQtyPerTick?: number;
      openListing?: boolean;
    }
  ) => void;
  acceptContract: (contractId: string) => void;
  rejectContract: (contractId: string) => void;
  cancelContract: (contractId: string) => void;
  transferCashB2B: (recipientId: string, amount: number, note?: string) => void;
  executeInfluence: (
    actionId: string,
    targetPlayerId?: string,
    targetPlotId?: string,
    targetBuildingId?: string
  ) => void;
  launchTacticalMissile: (targetPlotId: string) => void;
  startNuclearProject: () => void;
  launchNuclearStrike: (targetPlotId: string) => void;
  createCoalition: (name: string, tag: string, color: string) => void;
  inviteCoalition: (targetPlayerId: string) => void;
  respondCoalitionInvite: (coalitionId: string, accept: boolean) => void;
  leaveCoalition: () => void;
  toggleCoalitionGeology: () => void;
  proposeNAP: (targetPlayerId: string) => void;
  acceptNAP: (napId: string) => void;
  imposeEmbargo: (targetPlayerId: string) => void;
  submitTenderDelivery: (tenderId: string) => void;
  sendChatMessage: (
    text: string,
    pingPlot?: { plotId: string; gridX: number; gridY: number; label: string }
  ) => void;
  buildPlayerRoad: (plotId: string, roadClass?: 'local' | 'highway' | 'bridge') => void;
  setRoadPolicy: (
    plotId: string,
    opts: { tollRate?: TollRate; roadBlocked?: boolean; toggleBlockedPlayerId?: string }
  ) => void;
  surveyArea: (plotId: string) => void;
  buyServiceVehicle: (buildingId: string) => void;
  tradeStock: (targetCompanyId: string, shareDeltaPercent: number) => void;
  issueBond: (amount: number) => void;
  greyMarketAction: (
    actionId: 'black_arms' | 'black_fuel' | 'tax_shelter' | 'bribe_auditor'
  ) => void;
  proposePlotOffer: (
    plotId: string,
    offeredPrice: number,
    includeBuilding: boolean
  ) => void;
  respondPlotOffer: (
    offerId: string,
    response: 'accept' | 'reject' | 'counter',
    counterPrice?: number
  ) => void;
  // v6.0 & v7.0 dispatchers
  batchBuyPlots: (plotIds: string[]) => void;
  batchSurveyPlots: (plotIds: string[]) => void;
  batchBuildRoad: (plotIds: string[], roadClass: 'local' | 'highway' | 'bridge') => void;
  applyHighwayPolicyToAll: (tollRate: TollRate, roadBlocked: boolean) => void;
  cloneBuilding: (plotId: string, sourceBuildingId: string, includeUpgrades: boolean) => void;
  toggleInsurance: (buildingId: string) => void;
  toggleEmergencyFuelImport: (buildingId: string) => void;
  placeAuctionBid: (auctionId: string, bidAmount: number) => void;
  lobbyElection: (govKind: GovernmentKind, useInfluence: boolean) => void;
  revealFogPlot: (plotId: string) => void;
}

const urlRoom = getRoomCodeFromUrl();

export const useGameStore = create<GameStoreState>((set, get) => ({
  phase: urlRoom ? 'Lobby' : 'MainMenu',
  gameState: null,
  selectedPlotId: null,
  showBuildSelector: false,
  activeModal: 'none',
  inspectedResource: null,
  showTutorial: false,
  tutorialStep: 0,
  showVictoryModal: false,

  isMultiplayer: Boolean(urlRoom),
  isHost: false,
  localPlayerId: 'player_1',
  lobbyState: null,
  initialRoomCode: urlRoom,

  toast: null,
  savedAvailable: hasSavedGame(),
  saveSlotsMeta: listSaveSlots(),
  latestSaveMeta: getLatestSaveMeta(),
  lastMpSession: loadLastMpSession(),
  showTransportRoutes: true,
  showUtilityPopover: false,
  heatmapMode: 'standard',
  targetMode: null,
  cloneBuildingType: null,
  focusRequest: null,
  showTutorialModal: false,
  pinnedResources: ['coal', 'steel', 'oil', 'gold'],

  activeProfile: getActiveProfile(),
  showAuthModal: false,
  showProfileModal: false,
  showWeeklyModal: false,
  lastMatchRewardSummary: null,
  recordedMatchEnded: false,
  mapToolMode: 'normal',
  areaSelectedPlotIds: [],
  hoveredBuildType: null,
  cloneBlueprintSource: null,

  setShowAuthModal: (show) => set({ showAuthModal: show }),
  setShowProfileModal: (show) => set({ showProfileModal: show }),
  setShowWeeklyModal: (show) => set({ showWeeklyModal: show }),
  refreshActiveProfile: () => set({ activeProfile: getActiveProfile() }),
  applyUpdatedProfile: (profile) => {
    set({ activeProfile: profile });
    if (get().isMultiplayer && get().phase === 'Lobby') {
      multiplayerManager.updateLocalLobbyProfile({ playerCard: toPlayerCard(profile) });
    }
  },
  setMapToolMode: (mode) =>
    set({
      mapToolMode: mode,
      areaSelectedPlotIds: mode === 'area_select' ? get().areaSelectedPlotIds : [],
      cloneBuildingType: null,
      cloneBlueprintSource: null,
      targetMode: null,
    }),
  setAreaSelectedPlotIds: (ids) => set({ areaSelectedPlotIds: ids }),
  setHoveredBuildType: (bType) => set({ hoveredBuildType: bType }),
  setCloneBlueprintSource: (src) =>
    set({
      cloneBlueprintSource: src,
      cloneBuildingType: src ? src.buildingType : null,
      mapToolMode: 'normal',
      targetMode: null,
    }),

  goToMenu: () => {
    multiplayerManager.disconnect();
    set({
      phase: 'MainMenu',
      isMultiplayer: false,
      isHost: false,
      lobbyState: null,
      activeModal: 'none',
      mapToolMode: 'normal',
      areaSelectedPlotIds: [],
      cloneBlueprintSource: null,
      cloneBuildingType: null,
      recordedMatchEnded: false,
      lastMatchRewardSummary: null,
      savedAvailable: hasSavedGame(),
      saveSlotsMeta: listSaveSlots(),
      latestSaveMeta: getLatestSaveMeta(),
      lastMpSession: loadLastMpSession(),
      activeProfile: getActiveProfile(),
    });
  },

  goToSetup: () => set({ phase: 'Setup', activeModal: 'none' }),

  goToMultiplayer: () =>
    set({
      phase: 'Lobby',
      isMultiplayer: true,
      isHost: false,
      lobbyState: null,
      gameState: null,
      activeModal: 'none',
      lastMpSession: loadLastMpSession(),
    }),

  startSinglePlayer: (settings, playerName, companyName, color, withTutorial, opts) => {
    const profile = getActiveProfile();
    const gs = initializeSinglePlayerGame(settings, playerName, companyName, color, {
      archetype: opts?.archetype ?? 'standard',
      playerCard: toPlayerCard(profile),
    });
    saveGameToSlot('autosave', gs);
    set({
      phase: 'Playing',
      gameState: gs,
      localPlayerId: 'player_1',
      isMultiplayer: false,
      isHost: true,
      selectedPlotId: null,
      showBuildSelector: false,
      activeModal: 'none',
      showTutorial: withTutorial,
      tutorialStep: 0,
      showVictoryModal: false,
      recordedMatchEnded: false,
      lastMatchRewardSummary: null,
      mapToolMode: 'normal',
      areaSelectedPlotIds: [],
      cloneBlueprintSource: null,
      savedAvailable: true,
      saveSlotsMeta: listSaveSlots(),
      latestSaveMeta: getLatestSaveMeta(),
    });
  },

  startWeeklyChallengeGame: (spec) => {
    const profile = getActiveProfile();
    const settings = buildWeeklyChallengeGameSettings(spec);
    const gs = initializeSinglePlayerGame(
      settings,
      profile.nick,
      `${profile.nick} Capital`,
      '#f59e0b',
      {
        archetype: 'standard',
        playerCard: toPlayerCard(profile),
      }
    );
    saveGameToSlot('autosave', gs);
    set({
      phase: 'Playing',
      gameState: gs,
      localPlayerId: 'player_1',
      isMultiplayer: false,
      isHost: true,
      selectedPlotId: null,
      showBuildSelector: false,
      showWeeklyModal: false,
      activeModal: 'none',
      showTutorial: false,
      showVictoryModal: false,
      recordedMatchEnded: false,
      lastMatchRewardSummary: null,
      mapToolMode: 'normal',
      areaSelectedPlotIds: [],
      cloneBlueprintSource: null,
      savedAvailable: true,
      saveSlotsMeta: listSaveSlots(),
      latestSaveMeta: getLatestSaveMeta(),
    });
  },

  startQuickTutorialGame: () => {
    const gs = initializeSinglePlayerGame(
      {
        mode: 'endless',
        playerCount: 3,
        aiDifficulty: 1,
        mapSize: 20,
        challengeDurationSeconds: 0,
        economyMultiplier: 1.0,
        disastersEnabled: false,
        victoryMode: 'solo',
        dominationThreshold: 75,
      },
      'Prezes',
      'Akademia Biznesu S.A.',
      '#10b981'
    );
    saveGameToSlot('autosave', gs);
    set({
      phase: 'Playing',
      gameState: gs,
      localPlayerId: 'player_1',
      isMultiplayer: false,
      isHost: true,
      showTutorial: true,
      showTutorialModal: false,
      tutorialStep: 0,
      activeModal: 'none',
      showVictoryModal: false,
      savedAvailable: true,
      saveSlotsMeta: listSaveSlots(),
      latestSaveMeta: getLatestSaveMeta(),
    });
  },

  continueSavedGame: () => {
    const loaded = loadGameFromLocalStorage();
    if (!loaded) {
      get().showToast(false, 'Nie udało się wczytać zapisanej gry.');
      return;
    }
    migrateGameStateInPlace(loaded);
    set({
      phase: 'Playing',
      gameState: loaded,
      localPlayerId: loaded.currentPlayerId,
      isMultiplayer: false,
      isHost: true,
      selectedPlotId: null,
      activeModal: 'none',
      showVictoryModal: false,
    });
  },

  saveCurrentGame: () => {
    const gs = get().gameState;
    if (!gs) return;
    const ok = saveGameToLocalStorage(gs);
    set({
      savedAvailable: hasSavedGame(),
      saveSlotsMeta: listSaveSlots(),
      latestSaveMeta: getLatestSaveMeta(),
    });
    get().showToast(ok, ok ? 'Gra zapisana w Slocie 1.' : 'Błąd zapisu stanu gry.');
  },

  autosaveNow: () => {
    const { gameState, isMultiplayer, phase } = get();
    if (!gameState || phase !== 'Playing' || isMultiplayer) return;
    if (saveGameToSlot('autosave', gameState)) {
      set({
        savedAvailable: hasSavedGame(),
        saveSlotsMeta: listSaveSlots(),
        latestSaveMeta: getLatestSaveMeta(),
      });
    }
  },

  saveToSlot: (slotId) => {
    const gs = get().gameState;
    if (!gs) return;
    const ok = saveGameToSlot(slotId, gs);
    set({
      savedAvailable: hasSavedGame(),
      saveSlotsMeta: listSaveSlots(),
      latestSaveMeta: getLatestSaveMeta(),
    });
    get().showToast(ok, ok ? 'Zapisano stan gry.' : 'Nie udało się zapisać stanu (limit pamięci).');
  },

  loadFromSlot: (slotId) => {
    const loaded = loadGameFromSlot(slotId);
    if (!loaded) {
      get().showToast(false, 'Wybrany slot zapisu jest pusty lub uszkodzony.');
      return;
    }
    multiplayerManager.disconnect();
    migrateGameStateInPlace(loaded);
    set({
      phase: 'Playing',
      gameState: loaded,
      localPlayerId: loaded.currentPlayerId,
      isMultiplayer: false,
      isHost: true,
      selectedPlotId: null,
      activeModal: 'none',
      showVictoryModal: false,
    });
    get().showToast(true, 'Wczytano zapisaną rozgrywkę.');
  },

  refreshSavesMeta: () => {
    set({
      savedAvailable: hasSavedGame(),
      saveSlotsMeta: listSaveSlots(),
      latestSaveMeta: getLatestSaveMeta(),
      lastMpSession: loadLastMpSession(),
    });
  },

  toggleTransportRoutes: () =>
    set((s) => ({ showTransportRoutes: !s.showTransportRoutes })),

  setShowUtilityPopover: (show) => set({ showUtilityPopover: show }),
  setHeatmapMode: (mode) => set({ heatmapMode: mode }),
  setTargetMode: (mode) => set({ targetMode: mode, cloneBuildingType: null }),
  setCloneBuildingType: (bType) => set({ cloneBuildingType: bType, targetMode: null }),
  focusPlot: (plotId) =>
    set({
      selectedPlotId: plotId,
      focusRequest: { plotId, nonce: Date.now() },
      activeModal: 'none',
    }),
  setShowTutorialModal: (show) => set({ showTutorialModal: show }),
  togglePinResource: (res) =>
    set((s) => {
      const exists = s.pinnedResources.includes(res);
      const next = exists
        ? s.pinnedResources.filter((r) => r !== res)
        : [...s.pinnedResources, res].slice(0, 8);
      return { pinnedResources: next };
    }),

  initNetworkListeners: () => {
    multiplayerManager.setCallbacks({
      onLobbyChange: (lobby) => set({ lobbyState: { ...lobby } }),
      onGameStartSignal: (lobby, localId) => {
        const resolvedId = localId || get().localPlayerId;
        set((prev) => ({
          phase: 'Playing',
          lobbyState: { ...lobby, gameStarted: true },
          localPlayerId: resolvedId,
          isMultiplayer: true,
          isHost: false,
          selectedPlotId: null,
          activeModal: 'none',
          showVictoryModal: false,
          gameState: prev.isHost ? prev.gameState : prev.gameState,
        }));
      },
      onStateSync: (remoteState, assignedId) => {
        const localId = assignedId || get().localPlayerId;
        const prevGs = get().gameState;
        const synced = structuredClone(remoteState);
        synced.currentPlayerId = localId;

        if (prevGs) {
          const prevTransferIds = new Set((prevGs.cashTransfers ?? []).map((t) => t.id));
          const incomingTransfer = (synced.cashTransfers ?? []).find(
            (t) => t.toPlayerId === localId && !prevTransferIds.has(t.id)
          );
          if (incomingTransfer) {
            get().showToast(
              true,
              `💸 Przelew B2B +${incomingTransfer.amount.toLocaleString('pl-PL')} zł od ${incomingTransfer.fromCompanyName}${incomingTransfer.note ? ` (${incomingTransfer.note})` : ''}!`
            );
          } else {
            const prevPendingIds = new Set(
              prevGs.contracts
                .filter(
                  (c) =>
                    (c.status === 'pending' || c.status === 'proposed') &&
                    (c.responderId
                      ? c.responderId === localId
                      : c.proposerId !== localId && (c.sellerId === localId || c.buyerId === localId))
                )
                .map((c) => c.id)
            );
            const newIncomingB2B = synced.contracts.find(
              (c) =>
                (c.status === 'pending' || c.status === 'proposed') &&
                !prevPendingIds.has(c.id) &&
                (c.responderId
                  ? c.responderId === localId
                  : c.proposerId !== localId && (c.sellerId === localId || c.buyerId === localId))
            );
            if (newIncomingB2B) {
              const senderName =
                newIncomingB2B.proposerId === newIncomingB2B.sellerId
                  ? newIncomingB2B.sellerName
                  : newIncomingB2B.buyerName;
              get().showToast(true, `🤝 Nowa oferta kontraktu B2B od ${senderName}!`);
            }
          }
        }

        const showVic = Boolean(
          synced.winnerId || (synced.challengeCompleted && !get().showVictoryModal)
        );
        if (showVic && !get().recordedMatchEnded) {
          const me = synced.players.find((p) => p.id === localId);
          if (me) {
            const reward = recordCompletedMatchToProfile(synced, me);
            set({
              recordedMatchEnded: true,
              lastMatchRewardSummary: { xpEarned: reward.xpEarned, newlyUnlocked: reward.newlyUnlocked },
              activeProfile: reward.profile,
            });
          }
        }
        set((prev) => {
          const forceEnterPlaying = !prev.isHost && synced.phase === 'Playing';
          return {
            phase: forceEnterPlaying ? 'Playing' : prev.phase,
            gameState: synced,
            localPlayerId: localId,
            activeModal: prev.phase === 'Lobby' ? 'none' : prev.activeModal,
            selectedPlotId: prev.phase === 'Lobby' ? null : prev.selectedPlotId,
            showVictoryModal: prev.showVictoryModal || showVic,
          };
        });
      },
      onRequestFullSync: () => get().gameState,
      onClientReconnected: (playerId) => {
        const gs = get().gameState;
        if (!gs || !get().isHost) return;
        const next = structuredClone(gs);
        const target = next.players.find((p) => p.id === playerId);
        if (target && !target.isAI) {
          target.connectionStatus = 'connected';
        }
        if (next.disconnectAlert?.playerId === playerId) {
          next.disconnectAlert = null;
        }
        set({ gameState: next });
        get().showToast(true, `Gracz ${target?.name ?? ''} ponownie połączony.`);
      },
      onClientAction: (action) => {
        const gs = get().gameState;
        if (!gs || !get().isHost) return;
        const hostId = get().localPlayerId;
        const next = structuredClone(gs);
        const res = applyPlayerAction(next, action);
        if (res.ok && action.type === 'transferCashB2B' && action.recipientId === hostId) {
          const sender = next.players.find((p) => p.id === action.playerId);
          get().showToast(
            true,
            `💸 Przelew B2B +${Math.round(action.amount).toLocaleString('pl-PL')} zł od ${sender?.companyName ?? 'partnera'}!`
          );
        } else if (res.ok && action.type === 'proposeContract' && action.partnerId === hostId) {
          const sender = next.players.find((p) => p.id === action.playerId);
          get().showToast(true, `🤝 Nowa oferta kontraktu B2B od ${sender?.companyName ?? 'partnera'}!`);
        }
        multiplayerManager.sendActionFeedbackToClient(
          action.playerId,
          res.ok,
          res.message ?? (res.ok ? 'Wykonano.' : 'Akcja odrzucona.')
        );
        set({ gameState: next });
        multiplayerManager.broadcastStateSync(next, true);
      },
      onActionFeedback: (ok, message) => {
        if (message) get().showToast(ok, message);
      },
      onPeerDisconnected: (playerId) => {
        const gs = get().gameState;
        if (!gs) return;
        const next = structuredClone(gs);
        const target = next.players.find((p) => p.id === playerId);
        if (target && !target.isAI) {
          target.connectionStatus = 'disconnected';
          next.disconnectAlert = {
            playerId: target.id,
            playerName: target.name,
            companyName: target.companyName,
            timestamp: Date.now(),
          };
          set({ gameState: next });
          multiplayerManager.broadcastStateSync(next, true);
        }
      },
      onHostDisconnected: () => {
        get().showToast(false, 'Utracono połączenie z Hostem pokoju.');
      },
      onError: (msg) => get().showToast(false, msg),
    });
  },

  createMultiplayerRoom: async (name, company, color, opts) => {
    get().initNetworkListeners();
    set({ gameState: null });
    const profile = getActiveProfile();
    const lobby = await multiplayerManager.createRoom(name, company, color, {
      archetype: opts?.archetype ?? 'standard',
      playerCard: toPlayerCard(profile),
    });
    const session: LastMpSession = {
      roomCode: lobby.roomCode,
      playerName: name,
      companyName: company,
      color,
      isHost: true,
      updatedAt: Date.now(),
    };
    saveLastMpSession(session);
    set({
      isMultiplayer: true,
      isHost: true,
      localPlayerId: 'player_1',
      lobbyState: lobby,
      lastMpSession: session,
      gameState: null,
    });
  },

  joinMultiplayerRoom: async (code, name, company, color, opts) => {
    get().initNetworkListeners();
    set({ gameState: null });
    const profile = getActiveProfile();
    const { lobby, playerId } = await multiplayerManager.joinRoom(code, name, company, color, {
      archetype: opts?.archetype ?? 'standard',
      playerCard: toPlayerCard(profile),
    });
    const session: LastMpSession = {
      roomCode: lobby.roomCode,
      playerName: name,
      companyName: company,
      color,
      isHost: false,
      updatedAt: Date.now(),
    };
    saveLastMpSession(session);
    set({
      phase: lobby.gameStarted ? 'Playing' : 'Lobby',
      isMultiplayer: true,
      isHost: false,
      localPlayerId: playerId,
      lobbyState: lobby,
      lastMpSession: session,
    });
    if (lobby.gameStarted) {
      multiplayerManager.requestFullSync();
    }
  },

  startMultiplayerMatch: () => {
    const lobby = get().lobbyState;
    if (!lobby || !get().isHost) return;
    const gs = initializeMultiplayerGame(lobby, 'player_1');
    set({
      phase: 'Playing',
      gameState: gs,
      localPlayerId: 'player_1',
      selectedPlotId: null,
      activeModal: 'none',
      showVictoryModal: false,
      recordedMatchEnded: false,
      lastMatchRewardSummary: null,
      mapToolMode: 'normal',
      areaSelectedPlotIds: [],
      cloneBlueprintSource: null,
    });
    multiplayerManager.broadcastGameStart(gs);
  },

  requestFullSync: () => {
    multiplayerManager.requestFullSync();
  },

  leaveMultiplayer: () => {
    multiplayerManager.disconnect();
    set({
      phase: 'MainMenu',
      isMultiplayer: false,
      isHost: false,
      lobbyState: null,
      initialRoomCode: null,
      gameState: null,
    });
  },

  takeoverDisconnectedPlayer: (playerId) => {
    const gs = get().gameState;
    if (!gs || !get().isHost) return;
    const next = structuredClone(gs);
    const p = next.players.find((pl) => pl.id === playerId);
    if (p) {
      p.isAI = true;
      p.aiStrategy = p.aiStrategy ?? 'industrialist';
      p.aiDifficulty = next.settings.aiDifficulty;
      p.connectionStatus = 'ai_takeover';
    }
    next.disconnectAlert = null;
    set({ gameState: next });
    multiplayerManager.broadcastStateSync(next, true);
    get().showToast(true, `AI przejęło kontrolę nad firmą ${p?.companyName ?? ''}.`);
  },

  pauseOnDisconnect: () => {
    const gs = get().gameState;
    if (!gs || !get().isHost) return;
    const next = structuredClone(gs);
    next.speed = 0;
    next.disconnectAlert = null;
    set({ gameState: next });
    multiplayerManager.broadcastStateSync(next, true);
  },

  dismissDisconnectAlert: () => {
    const gs = get().gameState;
    if (!gs) return;
    set({ gameState: { ...gs, disconnectAlert: null } });
  },

  tickSimulation: () => {
    const { gameState, isMultiplayer, isHost, localPlayerId } = get();
    if (!gameState || gameState.phase !== 'Playing' || gameState.speed === 0) return;
    if (isMultiplayer && !isHost) return;

    const next = structuredClone(gameState);
    stepGameSimulation(next);
    next.currentPlayerId = localPlayerId;

    const wonNow = Boolean(
      (next.winnerId && !gameState.winnerId) ||
        (next.challengeCompleted && !gameState.challengeCompleted)
    );
    const me = next.players.find((p) => p.id === localPlayerId);

    if (wonNow && me && !get().recordedMatchEnded) {
      submitLeaderboardResult({
        playerName: me.name,
        companyName: me.companyName,
        netWorth: me.netWorth,
        strategy: me.dominantStrategy,
        mode: next.settings.mode,
      });
      const reward = recordCompletedMatchToProfile(next, me);
      set({
        recordedMatchEnded: true,
        lastMatchRewardSummary: { xpEarned: reward.xpEarned, newlyUnlocked: reward.newlyUnlocked },
        activeProfile: reward.profile,
      });
    } else if (me && next.time.tick % 4 === 0) {
      const res = evaluateLiveAchievements(next, me);
      if (res.newlyUnlocked.length > 0) {
        set({ activeProfile: res.profile });
        const first = res.newlyUnlocked[0];
        get().showToast(true, `🏆 Osiągnięcie: ${first.name} (+${first.xpReward} XP)!`);
      }
    }

    set((prev) => ({
      gameState: next,
      showVictoryModal: prev.showVictoryModal || wonNow,
    }));

    if (isMultiplayer && isHost) {
      multiplayerManager.broadcastStateSync(next);
    }
  },

  tickSecond: () => {
    const { gameState, isMultiplayer, isHost, localPlayerId } = get();
    if (!gameState || gameState.phase !== 'Playing' || gameState.speed === 0) return;
    if (isMultiplayer && !isHost) return;

    const hasTimer =
      (gameState.settings.mode === 'challenge1h' || gameState.settings.mode === 'mp_fast') &&
      !gameState.challengeCompleted &&
      gameState.challengeTimeRemaining > 0;

    const next = structuredClone(gameState);
    next.elapsedSeconds += 1;
    next.lastSyncTimestamp = Date.now();
    let justCompleted = false;

    if (next.liveAuction && next.liveAuction.status === 'active') {
      const rem = Math.max(0, Math.ceil((next.liveAuction.expiresAtMs - Date.now()) / 1000));
      next.liveAuction.secondsRemaining = rem;
    }

    if (hasTimer) {
      next.challengeTimeRemaining = Math.max(0, next.challengeTimeRemaining - 1);
      if (next.challengeTimeRemaining === 0) {
        next.challengeCompleted = true;
        next.speed = 0;
        justCompleted = true;
        const me = next.players.find((p) => p.id === localPlayerId);
        if (me) {
          submitLeaderboardResult({
            playerName: me.name,
            companyName: me.companyName,
            netWorth: me.netWorth,
            strategy: me.dominantStrategy,
            mode: next.settings.mode,
          });
          if (!get().recordedMatchEnded) {
            const reward = recordCompletedMatchToProfile(next, me);
            set({
              recordedMatchEnded: true,
              lastMatchRewardSummary: {
                xpEarned: reward.xpEarned,
                newlyUnlocked: reward.newlyUnlocked,
              },
              activeProfile: reward.profile,
            });
          }
        }
      }
    }

    set((prev) => ({
      gameState: next,
      showVictoryModal: prev.showVictoryModal || justCompleted,
    }));

    if (isMultiplayer && isHost) {
      multiplayerManager.broadcastStateSync(next);
    }
  },

  selectPlot: (plotId) =>
    set({ selectedPlotId: plotId, showBuildSelector: false }),

  setShowBuildSelector: (show) => set({ showBuildSelector: show }),

  setActiveModal: (modal) => set({ activeModal: modal }),

  setInspectedResource: (res) => set({ inspectedResource: res }),

  nextTutorialStep: () =>
    set((s) => ({ tutorialStep: s.tutorialStep + 1 })),

  closeTutorial: () => set({ showTutorial: false, tutorialStep: 0 }),

  continueEndlessAfterVictory: () => {
    const gs = get().gameState;
    if (!gs) return;
    const next = structuredClone(gs);
    next.phase = 'Playing';
    next.speed = 1;
    next.settings.mode = 'endless';
    next.challengeCompleted = true;
    next.winnerId = null;
    next.victoryReason = null;
    set({ gameState: next, showVictoryModal: false });
    if (get().isMultiplayer && get().isHost) {
      multiplayerManager.broadcastStateSync(next);
    }
  },

  markNewsRead: (articleId) => {
    const gs = get().gameState;
    if (!gs) return;
    const next = {
      ...gs,
      news: gs.news.map((a) => (a.id === articleId ? { ...a, read: true } : a)),
    };
    set({ gameState: next });
  },

  showToast: (ok, text) => {
    const id = String(Date.now());
    set({ toast: { id, ok, text } });
    window.setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 3400);
  },

  dispatchAction: (action) => {
    const { gameState, isMultiplayer, isHost } = get();
    if (!gameState) return;

    if (isMultiplayer && !isHost) {
      multiplayerManager.sendActionToHost(action);
      return;
    }

    const next = structuredClone(gameState);
    const res = applyPlayerAction(next, action);
    if (res.message) {
      get().showToast(res.ok, res.message);
    }
    if (res.ok) {
      const localP = next.players.find((p) => p.id === get().localPlayerId);
      if (localP) {
        const achRes = evaluateLiveAchievements(next, localP);
        if (achRes.newlyUnlocked.length > 0) {
          set({ activeProfile: achRes.profile });
          const first = achRes.newlyUnlocked[0];
          get().showToast(true, `🏆 Osiągnięcie: ${first.name} (+${first.xpReward} XP)!`);
        }
      }
    }
    set({ gameState: next });

    if (isMultiplayer && isHost) {
      multiplayerManager.broadcastStateSync(next, true);
    } else if (res.ok && !isMultiplayer) {
      const keyAutosaveTypes = new Set<PlayerAction['type']>([
        'buyPlot',
        'sellPlot',
        'buildOnPlot',
        'demolishBuilding',
        'buildPlayerRoad',
        'setRoadPolicy',
        'surveyArea',
        'batchBuyPlots',
        'batchBuildRoad',
        'cloneBuilding',
        'buyServiceVehicle',
        'tradeStock',
        'issueBond',
        'greyMarketAction',
        'researchGlobalTech',
        'unlockSkill',
        'respondPlotOffer',
        'takeLoan',
        'repayLoan',
      ]);
      if (keyAutosaveTypes.has(action.type)) {
        saveGameToSlot('autosave', next);
      }
    }
  },

  setSpeed: (speed) => {
    const { isMultiplayer, isHost, localPlayerId } = get();
    if (isMultiplayer && !isHost) {
      get().requestSpeedChange(speed);
      return;
    }
    get().dispatchAction({ type: 'setSpeed', playerId: localPlayerId, speed });
  },
  requestSpeedChange: (speed) => {
    get().dispatchAction({ type: 'requestSpeedChange', playerId: get().localPlayerId, speed });
    get().showToast(true, 'Wysłano prośbę o zmianę prędkości do Hosta.');
  },
  dismissSpeedRequest: () => {
    get().dispatchAction({ type: 'dismissSpeedRequest', playerId: get().localPlayerId });
  },
  buyPlot: (plotId) => {
    get().dispatchAction({ type: 'buyPlot', playerId: get().localPlayerId, plotId });
  },
  sellPlot: (plotId) => {
    get().dispatchAction({ type: 'sellPlot', playerId: get().localPlayerId, plotId });
  },
  surveyPlot: (plotId) => {
    get().dispatchAction({ type: 'surveyPlot', playerId: get().localPlayerId, plotId });
  },
  buildOnPlot: (plotId, buildingType) => {
    get().dispatchAction({
      type: 'buildOnPlot',
      playerId: get().localPlayerId,
      plotId,
      buildingType,
    });
    set({ showBuildSelector: false });
  },
  demolishBuilding: (plotId) => {
    get().dispatchAction({ type: 'demolishBuilding', playerId: get().localPlayerId, plotId });
  },
  repairBuilding: (buildingId) => {
    get().dispatchAction({ type: 'repairBuilding', playerId: get().localPlayerId, buildingId });
  },
  setAutoRepair: (buildingId, enabled, threshold) => {
    get().dispatchAction({
      type: 'setAutoRepair',
      playerId: get().localPlayerId,
      buildingId,
      enabled,
      threshold,
    });
  },
  applyAutoRepairTemplate: (enabled, threshold, setAsDefault) => {
    get().dispatchAction({
      type: 'applyAutoRepairTemplate',
      playerId: get().localPlayerId,
      enabled,
      threshold,
      setAsDefault,
    });
  },
  toggleStockpile: (buildingId) => {
    get().dispatchAction({ type: 'toggleStockpile', playerId: get().localPlayerId, buildingId });
  },
  setStockpileAllocation: (opts) => {
    get().dispatchAction({
      type: 'setStockpileAllocation',
      playerId: get().localPlayerId,
      globalPercent: opts.globalPercent,
      resource: opts.resource,
      resourcePercent: opts.resourcePercent,
    });
  },
  sellWarehouseStock: (resource, amount) => {
    get().dispatchAction({
      type: 'sellWarehouseStock',
      playerId: get().localPlayerId,
      resource,
      amount,
    });
  },
  buyWarehouseStock: (resource, amount) => {
    get().dispatchAction({
      type: 'buyWarehouseStock',
      playerId: get().localPlayerId,
      resource,
      amount,
    });
  },
  researchBuildingTech: (buildingId, nodeId) => {
    get().dispatchAction({
      type: 'researchBuildingTech',
      playerId: get().localPlayerId,
      buildingId,
      nodeId,
    });
  },
  hireWorkers: (buildingId, count) => {
    get().dispatchAction({ type: 'hireWorkers', playerId: get().localPlayerId, buildingId, count });
  },
  fireWorkers: (buildingId, count) => {
    get().dispatchAction({ type: 'fireWorkers', playerId: get().localPlayerId, buildingId, count });
  },
  trainWorkers: (buildingId) => {
    get().dispatchAction({ type: 'trainWorkers', playerId: get().localPlayerId, buildingId });
  },
  researchGlobalTech: (nodeId) => {
    get().dispatchAction({ type: 'researchGlobalTech', playerId: get().localPlayerId, nodeId });
  },
  unlockSkill: (nodeId) => {
    get().dispatchAction({ type: 'unlockSkill', playerId: get().localPlayerId, nodeId });
  },
  takeLoan: (amount, months) => {
    get().dispatchAction({ type: 'takeLoan', playerId: get().localPlayerId, amount, months });
  },
  repayLoan: (loanId) => {
    get().dispatchAction({ type: 'repayLoan', playerId: get().localPlayerId, loanId });
  },
  proposeContract: (partnerId, resource, quantityPerTick, pricePerUnit, durationTicks, isSelling, opts) => {
    get().dispatchAction({
      type: 'proposeContract',
      playerId: get().localPlayerId,
      partnerId,
      resource,
      quantityPerTick,
      pricePerUnit,
      durationTicks,
      isSelling,
      kind: opts?.kind,
      barterResource: opts?.barterResource,
      barterQtyPerTick: opts?.barterQtyPerTick,
      openListing: opts?.openListing,
    });
  },
  acceptContract: (contractId) => {
    get().dispatchAction({ type: 'acceptContract', playerId: get().localPlayerId, contractId });
  },
  rejectContract: (contractId) => {
    get().dispatchAction({ type: 'rejectContract', playerId: get().localPlayerId, contractId });
  },
  cancelContract: (contractId) => {
    get().dispatchAction({ type: 'cancelContract', playerId: get().localPlayerId, contractId });
  },
  transferCashB2B: (recipientId, amount, note) => {
    get().dispatchAction({
      type: 'transferCashB2B',
      playerId: get().localPlayerId,
      recipientId,
      amount,
      note,
    });
  },
  executeInfluence: (actionId, targetPlayerId, targetPlotId, targetBuildingId) => {
    get().dispatchAction({
      type: 'executeInfluence',
      playerId: get().localPlayerId,
      actionId,
      targetPlayerId,
      targetPlotId,
      targetBuildingId,
    });
  },
  launchTacticalMissile: (targetPlotId) => {
    get().dispatchAction({
      type: 'launchTacticalMissile',
      playerId: get().localPlayerId,
      targetPlotId,
    });
    set({ targetMode: null });
  },
  startNuclearProject: () => {
    get().dispatchAction({
      type: 'startNuclearProject',
      playerId: get().localPlayerId,
    });
  },
  launchNuclearStrike: (targetPlotId) => {
    get().dispatchAction({
      type: 'launchNuclearStrike',
      playerId: get().localPlayerId,
      targetPlotId,
    });
    set({ targetMode: null });
  },
  createCoalition: (name, tag, color) => {
    get().dispatchAction({
      type: 'createCoalition',
      playerId: get().localPlayerId,
      name,
      tag,
      color,
    });
  },
  inviteCoalition: (targetPlayerId) => {
    get().dispatchAction({
      type: 'inviteCoalition',
      playerId: get().localPlayerId,
      targetPlayerId,
    });
  },
  respondCoalitionInvite: (coalitionId, accept) => {
    get().dispatchAction({
      type: 'respondCoalitionInvite',
      playerId: get().localPlayerId,
      coalitionId,
      accept,
    });
  },
  leaveCoalition: () => {
    get().dispatchAction({
      type: 'leaveCoalition',
      playerId: get().localPlayerId,
    });
  },
  toggleCoalitionGeology: () => {
    get().dispatchAction({
      type: 'toggleCoalitionGeology',
      playerId: get().localPlayerId,
    });
  },
  proposeNAP: (targetPlayerId) => {
    get().dispatchAction({
      type: 'proposeNAP',
      playerId: get().localPlayerId,
      targetPlayerId,
    });
  },
  acceptNAP: (napId) => {
    get().dispatchAction({
      type: 'acceptNAP',
      playerId: get().localPlayerId,
      napId,
    });
  },
  imposeEmbargo: (targetPlayerId) => {
    get().dispatchAction({
      type: 'imposeEmbargo',
      playerId: get().localPlayerId,
      targetPlayerId,
    });
  },
  submitTenderDelivery: (tenderId) => {
    get().dispatchAction({
      type: 'submitTenderDelivery',
      playerId: get().localPlayerId,
      tenderId,
    });
  },
  sendChatMessage: (text, pingPlot) => {
    get().dispatchAction({
      type: 'sendChatMessage',
      playerId: get().localPlayerId,
      text,
      pingPlot,
    });
  },
  buildPlayerRoad: (plotId, roadClass = 'local') => {
    get().dispatchAction({
      type: 'buildPlayerRoad',
      playerId: get().localPlayerId,
      plotId,
      roadClass,
    });
  },
  setRoadPolicy: (plotId, opts) => {
    get().dispatchAction({
      type: 'setRoadPolicy',
      playerId: get().localPlayerId,
      plotId,
      tollRate: opts.tollRate,
      roadBlocked: opts.roadBlocked,
      toggleBlockedPlayerId: opts.toggleBlockedPlayerId,
    });
  },
  surveyArea: (plotId) => {
    get().dispatchAction({
      type: 'surveyArea',
      playerId: get().localPlayerId,
      plotId,
    });
  },
  buyServiceVehicle: (buildingId) => {
    get().dispatchAction({
      type: 'buyServiceVehicle',
      playerId: get().localPlayerId,
      buildingId,
    });
  },
  tradeStock: (targetCompanyId, shareDeltaPercent) => {
    get().dispatchAction({
      type: 'tradeStock',
      playerId: get().localPlayerId,
      targetCompanyId,
      shareDeltaPercent,
    });
  },
  issueBond: (amount) => {
    get().dispatchAction({
      type: 'issueBond',
      playerId: get().localPlayerId,
      amount,
    });
  },
  greyMarketAction: (actionId) => {
    get().dispatchAction({
      type: 'greyMarketAction',
      playerId: get().localPlayerId,
      actionId,
    });
  },
  proposePlotOffer: (plotId, offeredPrice, includeBuilding) => {
    get().dispatchAction({
      type: 'proposePlotOffer',
      playerId: get().localPlayerId,
      plotId,
      offeredPrice,
      includeBuilding,
    });
  },
  respondPlotOffer: (offerId, response, counterPrice) => {
    get().dispatchAction({
      type: 'respondPlotOffer',
      playerId: get().localPlayerId,
      offerId,
      response,
      counterPrice,
    });
  },
  batchBuyPlots: (plotIds) => {
    get().dispatchAction({ type: 'batchBuyPlots', playerId: get().localPlayerId, plotIds });
    set({ areaSelectedPlotIds: [] });
  },
  batchSurveyPlots: (plotIds) => {
    get().dispatchAction({ type: 'batchSurveyPlots', playerId: get().localPlayerId, plotIds });
    set({ areaSelectedPlotIds: [] });
  },
  batchBuildRoad: (plotIds, roadClass) => {
    get().dispatchAction({ type: 'batchBuildRoad', playerId: get().localPlayerId, plotIds, roadClass });
  },
  applyHighwayPolicyToAll: (tollRate, roadBlocked) => {
    get().dispatchAction({
      type: 'applyHighwayPolicyToAll',
      playerId: get().localPlayerId,
      tollRate,
      roadBlocked,
    });
  },
  cloneBuilding: (plotId, sourceBuildingId, includeUpgrades) => {
    get().dispatchAction({
      type: 'cloneBuilding',
      playerId: get().localPlayerId,
      plotId,
      sourceBuildingId,
      includeUpgrades,
    });
  },
  toggleInsurance: (buildingId) => {
    get().dispatchAction({ type: 'toggleInsurance', playerId: get().localPlayerId, buildingId });
  },
  toggleEmergencyFuelImport: (buildingId) => {
    get().dispatchAction({ type: 'toggleEmergencyFuelImport', playerId: get().localPlayerId, buildingId });
  },
  placeAuctionBid: (auctionId, bidAmount) => {
    get().dispatchAction({ type: 'placeAuctionBid', playerId: get().localPlayerId, auctionId, bidAmount });
  },
  lobbyElection: (govKind, useInfluence) => {
    get().dispatchAction({ type: 'lobbyElection', playerId: get().localPlayerId, govKind, useInfluence });
  },
  revealFogPlot: (plotId) => {
    get().dispatchAction({ type: 'revealFogPlot', playerId: get().localPlayerId, plotId });
  },
}));

export function getLocalPlayer(state: GameState, localId: string): Player {
  return state.players.find((p) => p.id === localId) ?? state.players[0];
}
