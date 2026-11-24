import { create } from 'zustand';
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
import type {
  BuildingType,
  GamePhase,
  GameSettings,
  GameSpeed,
  GameState,
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

  goToMenu: () => void;
  goToSetup: () => void;
  goToMultiplayer: () => void;
  startSinglePlayer: (
    settings: GameSettings,
    playerName: string,
    companyName: string,
    color: string,
    withTutorial: boolean
  ) => void;
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
  createMultiplayerRoom: (name: string, company: string, color: string) => Promise<void>;
  joinMultiplayerRoom: (code: string, name: string, company: string, color: string) => Promise<void>;
  startMultiplayerMatch: () => void;
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
    isSelling: boolean
  ) => void;
  acceptContract: (contractId: string) => void;
  cancelContract: (contractId: string) => void;
  executeInfluence: (
    actionId: string,
    targetPlayerId?: string,
    targetPlotId?: string,
    targetBuildingId?: string
  ) => void;
  buildPlayerRoad: (plotId: string, roadClass?: 'local' | 'highway') => void;
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

  goToMenu: () => {
    multiplayerManager.disconnect();
    set({
      phase: 'MainMenu',
      isMultiplayer: false,
      isHost: false,
      lobbyState: null,
      activeModal: 'none',
      savedAvailable: hasSavedGame(),
      saveSlotsMeta: listSaveSlots(),
      latestSaveMeta: getLatestSaveMeta(),
      lastMpSession: loadLastMpSession(),
    });
  },

  goToSetup: () => set({ phase: 'Setup', activeModal: 'none' }),

  goToMultiplayer: () =>
    set({
      phase: 'Lobby',
      isMultiplayer: true,
      activeModal: 'none',
      lastMpSession: loadLastMpSession(),
    }),

  startSinglePlayer: (settings, playerName, companyName, color, withTutorial) => {
    const gs = initializeSinglePlayerGame(settings, playerName, companyName, color);
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

  initNetworkListeners: () => {
    multiplayerManager.setCallbacks({
      onLobbyChange: (lobby) => set({ lobbyState: { ...lobby } }),
      onGameStart: (state, localId) => {
        const cloned = structuredClone(state);
        cloned.currentPlayerId = localId;
        set({
          phase: 'Playing',
          gameState: cloned,
          localPlayerId: localId,
          isMultiplayer: true,
          isHost: false,
          selectedPlotId: null,
          activeModal: 'none',
          showVictoryModal: false,
        });
      },
      onStateSync: (remoteState) => {
        const localId = get().localPlayerId;
        const synced = structuredClone(remoteState);
        synced.currentPlayerId = localId;
        const showVic = Boolean(synced.winnerId || (synced.challengeCompleted && !get().showVictoryModal));
        set((prev) => ({
          gameState: synced,
          showVictoryModal: prev.showVictoryModal || showVic,
        }));
      },
      onClientAction: (action) => {
        const gs = get().gameState;
        if (!gs || !get().isHost) return;
        const next = structuredClone(gs);
        const res = applyPlayerAction(next, action);
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
          multiplayerManager.broadcastStateSync(next);
        }
      },
      onHostDisconnected: () => {
        get().showToast(false, 'Utracono połączenie z Hostem pokoju.');
      },
      onError: (msg) => get().showToast(false, msg),
    });
  },

  createMultiplayerRoom: async (name, company, color) => {
    get().initNetworkListeners();
    const lobby = await multiplayerManager.createRoom(name, company, color);
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
    });
  },

  joinMultiplayerRoom: async (code, name, company, color) => {
    get().initNetworkListeners();
    const { lobby, playerId } = await multiplayerManager.joinRoom(code, name, company, color);
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
      isMultiplayer: true,
      isHost: false,
      localPlayerId: playerId,
      lobbyState: lobby,
      lastMpSession: session,
    });
  },

  startMultiplayerMatch: () => {
    const lobby = get().lobbyState;
    if (!lobby || !get().isHost) return;
    const gs = initializeMultiplayerGame(lobby, 'player_1');
    multiplayerManager.broadcastGameStart(gs);
    set({
      phase: 'Playing',
      gameState: gs,
      localPlayerId: 'player_1',
      selectedPlotId: null,
      activeModal: 'none',
      showVictoryModal: false,
    });
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

    const wonNow = Boolean(next.winnerId && !gameState.winnerId);
    if (wonNow) {
      const me = next.players.find((p) => p.id === localPlayerId);
      if (me) {
        submitLeaderboardResult({
          playerName: me.name,
          companyName: me.companyName,
          netWorth: me.netWorth,
          strategy: me.dominantStrategy,
          mode: next.settings.mode,
        });
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
  proposeContract: (partnerId, resource, quantityPerTick, pricePerUnit, durationTicks, isSelling) => {
    get().dispatchAction({
      type: 'proposeContract',
      playerId: get().localPlayerId,
      partnerId,
      resource,
      quantityPerTick,
      pricePerUnit,
      durationTicks,
      isSelling,
    });
  },
  acceptContract: (contractId) => {
    get().dispatchAction({ type: 'acceptContract', playerId: get().localPlayerId, contractId });
  },
  cancelContract: (contractId) => {
    get().dispatchAction({ type: 'cancelContract', playerId: get().localPlayerId, contractId });
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
}));

export function getLocalPlayer(state: GameState, localId: string): Player {
  return state.players.find((p) => p.id === localId) ?? state.players[0];
}
