import { useEffect, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { MultiplayerChatWidget } from './components/HUD/MultiplayerChatWidget';
import { PriceChartModal } from './components/HUD/PriceChartModal';
import { TopTicker } from './components/HUD/TopTicker';
import { AuthModal } from './components/Menu/AuthModal';
import { BattlePassModal } from './components/Menu/BattlePassModal';
import { DisconnectModal } from './components/Menu/DisconnectModal';
import { GameSetup } from './components/Menu/GameSetup';
import { MainMenu } from './components/Menu/MainMenu';
import { MultiplayerLobby } from './components/Menu/MultiplayerLobby';
import { PauseSaveModal } from './components/Menu/PauseSaveModal';
import { ProfileModal } from './components/Menu/ProfileModal';
import { QuickStart } from './components/Menu/QuickStart';
import { ShopModal } from './components/Menu/ShopModal';
import { SplashIntro } from './components/Menu/SplashIntro';
import { shouldShowSplashIntro } from './utils/splashStorage';
import { TutorialModal } from './components/Menu/TutorialModal';
import { VictoryModal } from './components/Menu/VictoryModal';
import { WeeklyChallengeModal } from './components/Menu/WeeklyChallengeModal';
import { BottomSheet } from './components/Mobile/BottomSheet';
import { BuildSelector } from './components/Panels/BuildSelector';
import { BuildingPanel } from './components/Panels/BuildingPanel';
import { ContractsMarketPanel } from './components/Panels/ContractsMarketPanel';
import { EntrepreneurPanel } from './components/Panels/EntrepreneurPanel';
import { FinancePanel } from './components/Panels/FinancePanel';
import { InfluencePanel } from './components/Panels/InfluencePanel';
import { LeaderboardPanel } from './components/Panels/LeaderboardPanel';
import { NewspaperPanel } from './components/Panels/NewspaperPanel';
import { PlotPanel } from './components/Panels/PlotPanel';
import { TechTreePanel } from './components/Panels/TechTreePanel';
import { GAME_CONFIG } from './config/gameConfig';
import { useGameLoop } from './hooks/useGameLoop';
import { useResponsive } from './hooks/useResponsive';
import { BUILDINGS_EN } from './i18n/buildingsEn';
import { useI18n } from './i18n/useI18n';
import { getLocalPlayer, useGameStore } from './store/gameStore';
import { normalizeInitialHashIfEmpty, parseHashRoute } from './utils/hashRouter';

export function App() {
  const phase = useGameStore((s) => s.phase);
  const gameState = useGameStore((s) => s.gameState);
  const selectedPlotId = useGameStore((s) => s.selectedPlotId);
  const showBuildSelector = useGameStore((s) => s.showBuildSelector);
  const activeModal = useGameStore((s) => s.activeModal);
  const inspectedResource = useGameStore((s) => s.inspectedResource);
  const showTutorial = useGameStore((s) => s.showTutorial);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const showVictoryModal = useGameStore((s) => s.showVictoryModal);
  const isMultiplayer = useGameStore((s) => s.isMultiplayer);
  const isHost = useGameStore((s) => s.isHost);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const lobbyState = useGameStore((s) => s.lobbyState);
  const initialRoomCode = useGameStore((s) => s.initialRoomCode);
  const mpLobbyTab = useGameStore((s) => s.mpLobbyTab);
  const toast = useGameStore((s) => s.toast);
  const savedAvailable = useGameStore((s) => s.savedAvailable);
  const saveSlotsMeta = useGameStore((s) => s.saveSlotsMeta);
  const latestSaveMeta = useGameStore((s) => s.latestSaveMeta);
  const lastMpSession = useGameStore((s) => s.lastMpSession);
  const showTransportRoutes = useGameStore((s) => s.showTransportRoutes);
  const showUtilityPopover = useGameStore((s) => s.showUtilityPopover);
  const heatmapMode = useGameStore((s) => s.heatmapMode);
  const targetMode = useGameStore((s) => s.targetMode);
  const cloneBuildingType = useGameStore((s) => s.cloneBuildingType);
  const focusRequest = useGameStore((s) => s.focusRequest);
  const showTutorialModal = useGameStore((s) => s.showTutorialModal);
  const pinnedResources = useGameStore((s) => s.pinnedResources);

  const activeProfile = useGameStore((s) => s.activeProfile);
  const showAuthModal = useGameStore((s) => s.showAuthModal);
  const showProfileModal = useGameStore((s) => s.showProfileModal);
  const showWeeklyModal = useGameStore((s) => s.showWeeklyModal);
  const showShopModal = useGameStore((s) => s.showShopModal);
  const showBattlePassModal = useGameStore((s) => s.showBattlePassModal);
  const lastMatchRewardSummary = useGameStore((s) => s.lastMatchRewardSummary);
  const mapToolMode = useGameStore((s) => s.mapToolMode);
  const areaSelectedPlotIds = useGameStore((s) => s.areaSelectedPlotIds);
  const hoveredBuildType = useGameStore((s) => s.hoveredBuildType);
  const cloneBlueprintSource = useGameStore((s) => s.cloneBlueprintSource);

  const [financeInitialTab, setFinanceInitialTab] = useState<
    'pnl' | 'balance' | 'stocks' | 'grey'
  >('pnl');
  const [quickJoinRoomCode, setQuickJoinRoomCode] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [seenChatCount, setSeenChatCount] = useState(0);
  const [showSplash, setShowSplash] = useState(() => shouldShowSplashIntro());

  const actions = useGameStore.getState();
  const { isMobile } = useResponsive();
  const { t, lang } = useI18n();

  useEffect(() => {
    document.title = GAME_CONFIG.title;
    normalizeInitialHashIfEmpty();
    useGameStore.getState().initNetworkListeners();

    const syncFromHash = () => {
      const route = parseHashRoute(window.location.hash, window.location.search);
      useGameStore.getState().applyHashRoute(route);
    };

    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('popstate', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('popstate', syncFromHash);
    };
  }, []);

  // Niezawodny autozapis co 15 s + beforeunload / visibilitychange (Single Player)
  useEffect(() => {
    if (phase !== 'Playing' || isMultiplayer) return;

    const timer = window.setInterval(() => {
      useGameStore.getState().autosaveNow();
    }, 15_000);

    const handleBeforeUnload = () => {
      useGameStore.getState().autosaveNow();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        useGameStore.getState().autosaveNow();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [phase, isMultiplayer]);

  // Skróty klawiszowe (Spacja = pauza, 1-4 = prędkość, B = buduj, R = droga, C = klonuj, Esc = anuluj/zamknij)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const st = useGameStore.getState();
      if (st.phase !== 'Playing' || !st.gameState) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        st.setSpeed(st.gameState.speed === 0 ? 1 : 0);
      } else if (e.key === '1') {
        st.setSpeed(0.5);
      } else if (e.key === '2') {
        st.setSpeed(1);
      } else if (e.key === '3') {
        st.setSpeed(2);
      } else if (e.key === '4') {
        st.setSpeed(5);
      } else if (e.code === 'KeyB') {
        const sp = st.selectedPlotId
          ? st.gameState.plots.find((p) => p.id === st.selectedPlotId)
          : null;
        if (sp && sp.ownerId === st.localPlayerId && !sp.building && !sp.hasRoad) {
          st.setShowBuildSelector(true);
        }
      } else if (e.code === 'KeyR') {
        st.setMapToolMode(st.mapToolMode === 'road_local' ? 'normal' : 'road_local');
      } else if (e.code === 'KeyC') {
        const sp = st.selectedPlotId
          ? st.gameState.plots.find((p) => p.id === st.selectedPlotId)
          : null;
        if (sp?.building && sp.ownerId === st.localPlayerId && !sp.building.destroyedRuins) {
          st.setCloneBlueprintSource({
            buildingId: sp.building.id,
            buildingType: sp.building.type,
            includeUpgrades: true,
          });
        }
      } else if (e.key === 'Escape') {
        if (st.targetMode) st.setTargetMode(null);
        else if (st.cloneBlueprintSource) st.setCloneBlueprintSource(null);
        else if (st.cloneBuildingType) st.setCloneBuildingType(null);
        else if (st.mapToolMode !== 'normal') st.setMapToolMode('normal');
        else if (st.areaSelectedPlotIds.length > 0) st.setAreaSelectedPlotIds([]);
        else if (st.showProfileModal) st.setShowProfileModal(false);
        else if (st.showAuthModal) st.setShowAuthModal(false);
        else if (st.showTutorialModal) st.setShowTutorialModal(false);
        else if (st.showUtilityPopover) st.setShowUtilityPopover(false);
        else if (st.inspectedResource) st.setInspectedResource(null);
        else if (st.activeModal !== 'none') st.setActiveModal('none');
        else if (st.showBuildSelector) {
          st.setHoveredBuildType(null);
          st.setShowBuildSelector(false);
        } else st.selectPlot(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useGameLoop(
    phase,
    gameState?.speed ?? 0,
    !isMultiplayer || isHost,
    actions.tickSimulation,
    actions.tickSecond
  );

  // ─── Ekrany przed grą ──────────────────────────────────────────────────────
  if (phase === 'MainMenu') {
    return (
      <>
        {showSplash && <SplashIntro onFinish={() => setShowSplash(false)} />}
        <MainMenu
          activeProfile={activeProfile}
          hasSavedGame={savedAvailable}
          latestSaveMeta={latestSaveMeta}
          saveSlots={saveSlotsMeta}
          lastMpSession={lastMpSession}
          onNewSinglePlayer={actions.goToSetup}
          onOpenMultiplayer={() => {
            setQuickJoinRoomCode(null);
            actions.goToMultiplayer('choose');
          }}
          onOpenWeeklyChallenge={() => actions.openPreGameModal('weekly')}
          onOpenProfile={() => actions.openPreGameModal('profile')}
          onOpenShop={() => actions.openPreGameModal('shop')}
          onOpenBattlePass={() => actions.openPreGameModal('battlepass')}
          onOpenAuth={() => actions.setShowAuthModal(true)}
          onContinueGame={actions.continueSavedGame}
          onLoadSlot={actions.loadFromSlot}
          onQuickRejoinMp={(code) => {
            setQuickJoinRoomCode(code);
            actions.goToMultiplayer('join', code);
          }}
          onOpenLeaderboard={() => actions.openPreGameModal('leaderboard')}
          onStartTutorial={() => actions.openPreGameModal('guide')}
        />
        {activeModal === 'leaderboard' && (
          <LeaderboardPanel
            gameState={null}
            activeProfile={activeProfile}
            onOpenAuth={() => actions.setShowAuthModal(true)}
            onClose={actions.closePreGameModal}
          />
        )}
        {showTutorialModal && (
          <TutorialModal
            onClose={actions.closePreGameModal}
            onStartTrainingMap={() => {
              actions.setShowTutorialModal(false);
              actions.startQuickTutorialGame();
            }}
          />
        )}
        {showAuthModal && (
          <AuthModal
            currentProfile={activeProfile}
            onAuthenticated={(prof) => {
              actions.applyUpdatedProfile(prof);
              actions.setShowAuthModal(false);
            }}
            onClose={() => actions.setShowAuthModal(false)}
          />
        )}
        {showProfileModal && (
          <ProfileModal
            profile={activeProfile}
            onUpdateProfile={actions.applyUpdatedProfile}
            onOpenShop={() => actions.openPreGameModal('shop')}
            onOpenBattlePass={() => actions.openPreGameModal('battlepass')}
            onOpenAuth={() => {
              actions.setShowProfileModal(false);
              actions.setShowAuthModal(true);
            }}
            onClose={actions.closePreGameModal}
          />
        )}
        {showShopModal && (
          <ShopModal
            profile={activeProfile}
            onUpdateProfile={actions.applyUpdatedProfile}
            onClose={actions.closePreGameModal}
          />
        )}
        {showBattlePassModal && (
          <BattlePassModal
            profile={activeProfile}
            onUpdateProfile={actions.applyUpdatedProfile}
            onClose={actions.closePreGameModal}
          />
        )}
        {showWeeklyModal && (
          <WeeklyChallengeModal
            profile={activeProfile}
            onStartChallenge={() => actions.startWeeklyChallengeGame()}
            onClose={actions.closePreGameModal}
          />
        )}
      </>
    );
  }

  if (phase === 'Setup') {
    return (
      <>
        <GameSetup
          activeProfile={activeProfile}
          defaultPlayerName={!activeProfile.isGuest ? activeProfile.nick : undefined}
          onOpenShop={() => actions.openPreGameModal('shop')}
          onStart={actions.startSinglePlayer}
          onBack={actions.goToMenu}
        />
        {showShopModal && (
          <ShopModal
            profile={activeProfile}
            onUpdateProfile={actions.applyUpdatedProfile}
            onClose={actions.closePreGameModal}
          />
        )}
      </>
    );
  }

  if (phase === 'Lobby' && !lobbyState?.gameStarted) {
    const resolvedRoom = quickJoinRoomCode ?? initialRoomCode;
    return (
      <>
        <MultiplayerLobby
          key={resolvedRoom ?? 'lobby'}
          activeProfile={activeProfile}
          initialRoomCode={resolvedRoom}
          activeTab={mpLobbyTab}
          onChangeTab={actions.setMpLobbyTab}
          lastMpSession={lastMpSession}
          lobbyState={lobbyState}
          isHost={isHost}
          localPlayerId={localPlayerId}
          onCreateRoom={actions.createMultiplayerRoom}
          onJoinRoom={actions.joinMultiplayerRoom}
          onStartMatch={actions.startMultiplayerMatch}
          onOpenTutorial={() => actions.openPreGameModal('guide')}
          onOpenShop={() => actions.openPreGameModal('shop')}
          onLeave={actions.leaveMultiplayer}
        />
        {showTutorialModal && (
          <TutorialModal inLobby onClose={actions.closePreGameModal} />
        )}
        {showShopModal && (
          <ShopModal
            profile={activeProfile}
            onUpdateProfile={actions.applyUpdatedProfile}
            onClose={actions.closePreGameModal}
          />
        )}
      </>
    );
  }

  if (!gameState) {
    if (isMultiplayer) {
      return (
        <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#111827] border border-[#243044] p-6 text-center space-y-4 shadow-2xl">
            <div className="w-10 h-10 mx-auto rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
            <div>
              <h2 className="text-base font-bold text-white">{t('app.syncTitle')}</h2>
              <p className="text-xs text-slate-400 mt-1">
                {t('app.syncDesc', { size: lobbyState?.mapSize ?? 24 })}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={actions.requestFullSync}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white cursor-pointer"
              >
                {t('app.requestSyncBtn')}
              </button>
              <button
                type="button"
                onClick={actions.leaveMultiplayer}
                className="px-4 py-2 rounded-lg bg-[#1c2434] hover:bg-rose-950/60 text-xs text-slate-300 cursor-pointer"
              >
                {t('app.exitToMenuBtn')}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  const currentPlayer = getLocalPlayer(gameState, localPlayerId);
  const selectedPlot = selectedPlotId
    ? gameState.plots.find((p) => p.id === selectedPlotId) ?? null
    : null;

  const unreadNewsCount = gameState.news.filter((n) => !n.read).length;
  const pendingContractsCount = gameState.contracts.filter(
    (c) =>
      (c.status === 'pending' || c.status === 'proposed') &&
      (c.responderId
        ? c.responderId === currentPlayer.id
        : c.proposerId !== currentPlayer.id && (c.sellerId === currentPlayer.id || c.buyerId === currentPlayer.id))
  ).length;
  const pendingPlotOffersCount = gameState.plotOffers.filter(
    (o) =>
      o.toPlayerId === currentPlayer.id &&
      (o.status === 'pending' || o.status === 'countered')
  ).length;
  const chatTotalCount = gameState.chatMessages?.length ?? 0;
  const unreadChatCount = chatOpen ? 0 : Math.max(0, chatTotalCount - seenChatCount);

  const handleCanvasSelectPlot = (plotId: string | null) => {
    if (cloneBlueprintSource && plotId) {
      actions.cloneBuilding(
        plotId,
        cloneBlueprintSource.buildingId,
        cloneBlueprintSource.includeUpgrades
      );
      return;
    }
    if (cloneBuildingType && plotId) {
      const target = gameState.plots.find((p) => p.id === plotId);
      if (target && target.ownerId === currentPlayer.id && !target.building) {
        actions.buildOnPlot(plotId, cloneBuildingType);
        actions.setCloneBuildingType(null);
        actions.selectPlot(plotId);
        return;
      }
      actions.setCloneBuildingType(null);
    }
    actions.selectPlot(plotId);
  };

  const handleCanvasTargetPlot = (plotId: string) => {
    if (targetMode === 'missile') actions.launchTacticalMissile(plotId);
    else if (targetMode === 'nuke') actions.launchNuclearStrike(plotId);
  };

  const sidePanelContent = selectedPlot ? (
    selectedPlot.building ? (
      <BuildingPanel
        plot={selectedPlot}
        building={selectedPlot.building}
        gameState={gameState}
        currentPlayer={currentPlayer}
        onResearchTech={actions.researchBuildingTech}
        onHire={actions.hireWorkers}
        onFire={actions.fireWorkers}
        onTrain={actions.trainWorkers}
        onRepair={actions.repairBuilding}
        onSetAutoRepair={actions.setAutoRepair}
        onApplyAutoRepairTemplate={actions.applyAutoRepairTemplate}
        onBuyMissingResource={actions.buyWarehouseStock}
        onToggleStockpile={actions.toggleStockpile}
        onSetStockpileAllocation={actions.setStockpileAllocation}
        onAcceptContract={actions.acceptContract}
        onRejectContract={actions.rejectContract}
        onCancelContract={actions.cancelContract}
        onBuyServiceVehicle={actions.buyServiceVehicle}
        onDemolish={actions.demolishBuilding}
        onCloneBuilding={(bType) => {
          actions.setCloneBuildingType(bType);
          actions.showToast(true, t('app.cloneToast'));
        }}
        onStartCloneBlueprint={(buildingId, buildingType) => {
          actions.setCloneBlueprintSource({ buildingId, buildingType, includeUpgrades: true });
          actions.showToast(true, t('app.cloneBlueprintToast'));
        }}
        onToggleInsurance={actions.toggleInsurance}
        onToggleEmergencyFuelImport={actions.toggleEmergencyFuelImport}
        onRevealFogPlot={actions.revealFogPlot}
        onOpenB2BMarket={() => actions.setActiveModal('contracts')}
        onProposePlotOffer={actions.proposePlotOffer}
        onProposeContract={actions.proposeContract}
        onClose={() => actions.selectPlot(null)}
      />
    ) : showBuildSelector ? (
      <BuildSelector
        plot={selectedPlot}
        gameState={gameState}
        currentPlayer={currentPlayer}
        onBuild={actions.buildOnPlot}
        onBuyMissingResource={actions.buyWarehouseStock}
        onHoverBuildingType={actions.setHoveredBuildType}
        onBack={() => {
          actions.setHoveredBuildType(null);
          actions.setShowBuildSelector(false);
        }}
      />
    ) : (
      <PlotPanel
        plot={selectedPlot}
        gameState={gameState}
        currentPlayer={currentPlayer}
        onBuyPlot={actions.buyPlot}
        onSellPlot={actions.sellPlot}
        onSurveyPlot={actions.surveyPlot}
        onSurveyArea={actions.surveyArea}
        onBuildRoad={actions.buildPlayerRoad}
        onSetRoadPolicy={actions.setRoadPolicy}
        onApplyHighwayPolicyToAll={actions.applyHighwayPolicyToAll}
        onRevealFogPlot={actions.revealFogPlot}
        onProposePlotOffer={actions.proposePlotOffer}
        onOpenBuildSelector={() => actions.setShowBuildSelector(true)}
        onClose={() => actions.selectPlot(null)}
      />
    )
  ) : null;

  const dockItems: {
    key: typeof activeModal;
    icon: string;
    label: string;
    badge?: number;
  }[] = [
    { key: 'newspaper', icon: '📰', label: t('app.dockNewspaper'), badge: unreadNewsCount },
    { key: 'finance', icon: '📊', label: t('app.dockFinance') },
    { key: 'tech', icon: '🔬', label: t('app.dockTech') },
    { key: 'entrepreneur', icon: '👤', label: t('app.dockEntrepreneur') },
    { key: 'influence', icon: '🏛️', label: t('app.dockInfluence') },
    {
      key: 'contracts',
      icon: '🤝',
      label: t('app.dockContracts'),
      badge: pendingContractsCount + pendingPlotOffersCount,
    },
    { key: 'leaderboard', icon: '🏆', label: t('app.dockLeaderboard') },
  ];

  return (
    <div className="w-screen h-screen flex flex-col bg-[#080c14] text-slate-100 overflow-hidden select-none">
      {/* Górny pasek giełdowy */}
      <TopTicker
        gameState={gameState}
        currentPlayer={currentPlayer}
        isMultiplayer={isMultiplayer}
        isHost={isHost}
        showUtilityPopover={showUtilityPopover}
        showTransportRoutes={showTransportRoutes}
        pinnedResources={pinnedResources}
        onTogglePinResource={actions.togglePinResource}
        onToggleUtilityPopover={() => actions.setShowUtilityPopover(!showUtilityPopover)}
        onToggleTransportRoutes={actions.toggleTransportRoutes}
        onOpenFullBalance={() => {
          setFinanceInitialTab('balance');
          actions.setActiveModal('finance');
        }}
        onOpenOffersModal={() => actions.setActiveModal('contracts')}
        onOpenInfluenceModal={() => actions.setActiveModal('influence')}
        onPlaceAuctionBid={actions.placeAuctionBid}
        onFocusPlot={actions.focusPlot}
        onOpenTutorial={() => actions.setShowTutorialModal(true)}
        onSetSpeed={actions.setSpeed}
        onRequestSpeed={actions.requestSpeedChange}
        onAcceptSpeedRequest={actions.setSpeed}
        onDismissSpeedRequest={actions.dismissSpeedRequest}
        onInspectResource={(rp) => actions.setInspectedResource(rp)}
        onSaveGame={() => {
          actions.refreshSavesMeta();
          actions.setActiveModal('save');
        }}
        onOpenMenu={() => {
          actions.refreshSavesMeta();
          actions.setActiveModal('save');
        }}
      />

      {/* Główny obszar roboczy: Mapa Izometryczna 2.5D + boczny panel na Desktopie */}
      <div className="relative flex-1 flex overflow-hidden">
        <div className="relative flex-1 h-full">
          <GameCanvas
            gameState={gameState}
            selectedPlotId={selectedPlotId}
            showTransportRoutes={showTransportRoutes}
            heatmapMode={heatmapMode}
            targetMode={targetMode}
            cloneBuildingType={cloneBuildingType}
            cloneBlueprintSource={cloneBlueprintSource}
            mapToolMode={mapToolMode}
            areaSelectedPlotIds={areaSelectedPlotIds}
            hoveredBuildType={hoveredBuildType}
            focusRequest={focusRequest}
            onCancelSpecialMode={() => {
              actions.setTargetMode(null);
              actions.setCloneBlueprintSource(null);
              actions.setCloneBuildingType(null);
              actions.setMapToolMode('normal');
              actions.setAreaSelectedPlotIds([]);
            }}
            onTargetPlot={handleCanvasTargetPlot}
            onChangeHeatmapMode={actions.setHeatmapMode}
            onChangeMapToolMode={actions.setMapToolMode}
            onAreaSelectionChange={actions.setAreaSelectedPlotIds}
            onBatchBuyPlots={actions.batchBuyPlots}
            onBatchSurveyPlots={actions.batchSurveyPlots}
            onBatchBuildRoad={actions.batchBuildRoad}
            onToggleCloneUpgrades={(inc) => {
              if (cloneBlueprintSource) {
                actions.setCloneBlueprintSource({
                  ...cloneBlueprintSource,
                  includeUpgrades: inc,
                });
              }
            }}
            onSelectPlot={handleCanvasSelectPlot}
          />

          {/* Powiadomienia (Toast) */}
          {toast && (
            <div
              className={`absolute top-14 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg border shadow-xl text-xs font-medium backdrop-blur-md animate-fadeIn ${
                toast.ok
                  ? 'bg-emerald-950/90 border-emerald-400/50 text-emerald-200'
                  : 'bg-rose-950/90 border-rose-400/50 text-rose-200'
              }`}
            >
              {toast.text}
            </div>
          )}

          {/* Dolny pasek narzędziowy (Dock) */}
          <nav
            id="toolbar-dock"
            className="absolute bottom-3 left-2.5 right-14 md:right-auto z-20 flex items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar pt-2.5 pb-1.5 px-2 rounded-xl bg-[#0b0f17]/92 border border-[#243044] shadow-2xl backdrop-blur-md max-w-[calc(100%-64px)]"
          >
            {dockItems.map((item) => (
              <button
                key={item.key}
                type="button"
                title={item.label}
                onClick={() => {
                  if (item.key === 'finance') setFinanceInitialTab('pnl');
                  actions.setActiveModal(activeModal === item.key ? 'none' : item.key);
                }}
                className={`relative px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors ${
                  activeModal === item.key
                    ? 'bg-amber-500/20 border border-amber-400/60 text-amber-300'
                    : 'bg-[#131b2b] hover:bg-[#1b263c] border border-[#212d42] text-slate-200'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold shadow animate-pulse pointer-events-none">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}

            {isMultiplayer && (
              <button
                type="button"
                title={t('app.dockChatTitle')}
                onClick={() => {
                  const next = !chatOpen;
                  setSeenChatCount(chatTotalCount);
                  setChatOpen(next);
                }}
                className={`relative px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors ${
                  chatOpen
                    ? 'bg-sky-500/20 border border-sky-400/70 text-sky-200'
                    : 'bg-[#131b2b] hover:bg-[#1b263c] border border-sky-500/35 text-slate-200'
                }`}
              >
                <span>💬</span>
                <span className="hidden sm:inline">{t('app.dockChat')}</span>
                {unreadChatCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold shadow animate-pulse pointer-events-none">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            )}
          </nav>
        </div>

        {/* Prawy panel inspektora działki/budynku na Desktopie */}
        {!isMobile && sidePanelContent && (
          <aside className="w-[385px] xl:w-[425px] h-full bg-[#111827] border-l border-[#243044] p-4 overflow-y-auto shrink-0 z-20">
            {sidePanelContent}
          </aside>
        )}
      </div>

      {/* Wysuwana dolna szuflada na Telefonach */}
      {isMobile && sidePanelContent && (
        <BottomSheet
          title={
            selectedPlot?.building
              ? `${selectedPlot.building.icon} ${
                  (lang === 'en'
                    ? BUILDINGS_EN[selectedPlot.building.type]?.name
                    : undefined) ?? selectedPlot.building.name
                }`
              : t('app.plotSheetTitle', {
                  x: selectedPlot?.gridX ?? 0,
                  y: selectedPlot?.gridY ?? 0,
                })
          }
          onClose={() => actions.selectPlot(null)}
        >
          {sidePanelContent}
        </BottomSheet>
      )}

      {/* Okna modalne makro-systemów */}
      {inspectedResource && (
        <PriceChartModal
          resource={
            gameState.resourcePrices.find((r) => r.type === inspectedResource.type) ??
            inspectedResource
          }
          onClose={() => actions.setInspectedResource(null)}
        />
      )}

      {activeModal === 'newspaper' && (
        <NewspaperPanel
          gameState={gameState}
          onMarkRead={actions.markNewsRead}
          onFocusPlot={actions.focusPlot}
          onClose={() => actions.setActiveModal('none')}
        />
      )}

      {activeModal === 'tech' && (
        <TechTreePanel
          gameState={gameState}
          currentPlayer={currentPlayer}
          onResearchTech={actions.researchGlobalTech}
          onClose={() => actions.setActiveModal('none')}
        />
      )}

      {activeModal === 'entrepreneur' && (
        <EntrepreneurPanel
          gameState={gameState}
          currentPlayer={currentPlayer}
          onUnlockSkill={actions.unlockSkill}
          onClose={() => actions.setActiveModal('none')}
        />
      )}

      {activeModal === 'influence' && (
        <InfluencePanel
          gameState={gameState}
          currentPlayer={currentPlayer}
          onExecuteAction={actions.executeInfluence}
          onLobbyElection={actions.lobbyElection}
          onStartMissileTarget={() => actions.setTargetMode('missile')}
          onStartNuclearProject={actions.startNuclearProject}
          onStartNuclearStrikeTarget={() => actions.setTargetMode('nuke')}
          onCreateCoalition={actions.createCoalition}
          onInviteCoalition={actions.inviteCoalition}
          onRespondCoalitionInvite={actions.respondCoalitionInvite}
          onLeaveCoalition={actions.leaveCoalition}
          onToggleCoalitionGeology={actions.toggleCoalitionGeology}
          onProposeNAP={actions.proposeNAP}
          onAcceptNAP={actions.acceptNAP}
          onImposeEmbargo={actions.imposeEmbargo}
          onClose={() => actions.setActiveModal('none')}
        />
      )}

      {activeModal === 'finance' && (
        <FinancePanel
          gameState={gameState}
          currentPlayer={currentPlayer}
          initialTab={financeInitialTab}
          showTransportRoutes={showTransportRoutes}
          onToggleTransportRoutes={actions.toggleTransportRoutes}
          onTakeLoan={actions.takeLoan}
          onRepayLoan={actions.repayLoan}
          onSellStock={actions.sellWarehouseStock}
          onBuyStock={actions.buyWarehouseStock}
          onTradeCorporateStock={actions.tradeStock}
          onIssueBond={actions.issueBond}
          onGreyMarketAction={actions.greyMarketAction}
          onApplyAutoRepairTemplate={actions.applyAutoRepairTemplate}
          onClose={() => actions.setActiveModal('none')}
        />
      )}

      {activeModal === 'contracts' && (
        <ContractsMarketPanel
          gameState={gameState}
          currentPlayer={currentPlayer}
          onPropose={actions.proposeContract}
          onAccept={actions.acceptContract}
          onReject={actions.rejectContract}
          onCancel={actions.cancelContract}
          onTransferCash={actions.transferCashB2B}
          onSubmitTender={actions.submitTenderDelivery}
          onRespondPlotOffer={actions.respondPlotOffer}
          onClose={() => actions.setActiveModal('none')}
        />
      )}

      {isMultiplayer && (
        <MultiplayerChatWidget
          messages={gameState.chatMessages ?? []}
          selectedPlot={selectedPlot}
          onSendMessage={actions.sendChatMessage}
          onFocusPlot={actions.focusPlot}
          isOpen={chatOpen}
          onOpenChange={(next) => {
            setSeenChatCount(chatTotalCount);
            setChatOpen(next);
          }}
          hideCollapsedToggle
        />
      )}

      {showTutorialModal && (
        <TutorialModal
          inLobby={isMultiplayer}
          onClose={() => actions.setShowTutorialModal(false)}
          onStartTrainingMap={
            !isMultiplayer
              ? () => {
                  actions.setShowTutorialModal(false);
                  actions.startQuickTutorialGame();
                }
              : undefined
          }
        />
      )}

      {activeModal === 'save' && (
        <PauseSaveModal
          saveSlots={saveSlotsMeta}
          isMultiplayer={isMultiplayer}
          onSaveToSlot={actions.saveToSlot}
          onLoadFromSlot={actions.loadFromSlot}
          onExitToMenu={() => {
            actions.autosaveNow();
            actions.goToMenu();
          }}
          onClose={() => actions.setActiveModal('none')}
        />
      )}

      {activeModal === 'leaderboard' && (
        <LeaderboardPanel
          gameState={gameState}
          activeProfile={activeProfile}
          onOpenAuth={() => actions.setShowAuthModal(true)}
          onClose={() => actions.setActiveModal('none')}
        />
      )}

      {showTutorial && (
        <QuickStart
          step={tutorialStep}
          onNext={actions.nextTutorialStep}
          onSkip={actions.closeTutorial}
        />
      )}

      {gameState.disconnectAlert && (
        <DisconnectModal
          alert={gameState.disconnectAlert}
          isHost={!isMultiplayer || isHost}
          onPause={actions.pauseOnDisconnect}
          onTakeoverByAI={actions.takeoverDisconnectedPlayer}
          onDismiss={actions.dismissDisconnectAlert}
        />
      )}

      {showVictoryModal && (
        <VictoryModal
          gameState={gameState}
          currentPlayer={currentPlayer}
          rewardSummary={lastMatchRewardSummary}
          onContinueEndless={actions.continueEndlessAfterVictory}
          onOpenLeaderboard={() => {
            actions.setActiveModal('leaderboard');
          }}
          onOpenProfile={() => actions.setShowProfileModal(true)}
          onExitToMenu={actions.goToMenu}
        />
      )}

      {showAuthModal && (
        <AuthModal
          currentProfile={activeProfile}
          onAuthenticated={(prof) => {
            actions.applyUpdatedProfile(prof);
            actions.setShowAuthModal(false);
          }}
          onClose={() => actions.setShowAuthModal(false)}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          profile={activeProfile}
          onUpdateProfile={actions.applyUpdatedProfile}
          onOpenShop={() => actions.setShowShopModal(true)}
          onOpenBattlePass={() => actions.setShowBattlePassModal(true)}
          onOpenAuth={() => {
            actions.setShowProfileModal(false);
            actions.setShowAuthModal(true);
          }}
          onClose={() => actions.setShowProfileModal(false)}
        />
      )}

      {showShopModal && (
        <ShopModal
          profile={activeProfile}
          onUpdateProfile={actions.applyUpdatedProfile}
          onClose={() => actions.setShowShopModal(false)}
        />
      )}

      {showBattlePassModal && (
        <BattlePassModal
          profile={activeProfile}
          onUpdateProfile={actions.applyUpdatedProfile}
          onClose={() => actions.setShowBattlePassModal(false)}
        />
      )}
    </div>
  );
}

export default App;
