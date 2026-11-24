import { useEffect, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { PriceChartModal } from './components/HUD/PriceChartModal';
import { TopTicker } from './components/HUD/TopTicker';
import { DisconnectModal } from './components/Menu/DisconnectModal';
import { GameSetup } from './components/Menu/GameSetup';
import { MainMenu } from './components/Menu/MainMenu';
import { MultiplayerLobby } from './components/Menu/MultiplayerLobby';
import { PauseSaveModal } from './components/Menu/PauseSaveModal';
import { QuickStart } from './components/Menu/QuickStart';
import { VictoryModal } from './components/Menu/VictoryModal';
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
import { getLocalPlayer, useGameStore } from './store/gameStore';

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
  const toast = useGameStore((s) => s.toast);
  const savedAvailable = useGameStore((s) => s.savedAvailable);
  const saveSlotsMeta = useGameStore((s) => s.saveSlotsMeta);
  const latestSaveMeta = useGameStore((s) => s.latestSaveMeta);
  const lastMpSession = useGameStore((s) => s.lastMpSession);
  const showTransportRoutes = useGameStore((s) => s.showTransportRoutes);
  const showUtilityPopover = useGameStore((s) => s.showUtilityPopover);
  const heatmapMode = useGameStore((s) => s.heatmapMode);

  const [financeInitialTab, setFinanceInitialTab] = useState<
    'pnl' | 'balance' | 'stocks' | 'grey'
  >('pnl');
  const [quickJoinRoomCode, setQuickJoinRoomCode] = useState<string | null>(null);

  const actions = useGameStore.getState();
  const { isMobile } = useResponsive();

  useEffect(() => {
    document.title = GAME_CONFIG.title;
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

  // Skróty klawiszowe (Spacja = pauza, 1-4 = prędkość, Esc = zamknij)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const st = useGameStore.getState();
      if (st.phase !== 'Playing' || !st.gameState) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        st.setSpeed(st.gameState.speed === 0 ? 1 : 0);
      } else if (e.key === '1') {
        st.setSpeed(1);
      } else if (e.key === '2') {
        st.setSpeed(2);
      } else if (e.key === '3') {
        st.setSpeed(5);
      } else if (e.key === '4') {
        st.setSpeed(10);
      } else if (e.key === 'Escape') {
        if (st.showUtilityPopover) st.setShowUtilityPopover(false);
        else if (st.inspectedResource) st.setInspectedResource(null);
        else if (st.activeModal !== 'none') st.setActiveModal('none');
        else if (st.showBuildSelector) st.setShowBuildSelector(false);
        else st.selectPlot(null);
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
        <MainMenu
          hasSavedGame={savedAvailable}
          latestSaveMeta={latestSaveMeta}
          saveSlots={saveSlotsMeta}
          lastMpSession={lastMpSession}
          onNewSinglePlayer={actions.goToSetup}
          onOpenMultiplayer={() => {
            setQuickJoinRoomCode(null);
            actions.goToMultiplayer();
          }}
          onContinueGame={actions.continueSavedGame}
          onLoadSlot={actions.loadFromSlot}
          onQuickRejoinMp={(code) => {
            setQuickJoinRoomCode(code);
            actions.goToMultiplayer();
          }}
          onOpenLeaderboard={() => actions.setActiveModal('leaderboard')}
          onStartTutorial={actions.startQuickTutorialGame}
        />
        {activeModal === 'leaderboard' && (
          <LeaderboardPanel gameState={null} onClose={() => actions.setActiveModal('none')} />
        )}
      </>
    );
  }

  if (phase === 'Setup') {
    return <GameSetup onStart={actions.startSinglePlayer} onBack={actions.goToMenu} />;
  }

  if (phase === 'Lobby') {
    const resolvedRoom = quickJoinRoomCode ?? initialRoomCode;
    return (
      <MultiplayerLobby
        key={resolvedRoom ?? 'lobby'}
        initialRoomCode={resolvedRoom}
        lastMpSession={lastMpSession}
        lobbyState={lobbyState}
        isHost={isHost}
        localPlayerId={localPlayerId}
        onCreateRoom={actions.createMultiplayerRoom}
        onJoinRoom={actions.joinMultiplayerRoom}
        onStartMatch={actions.startMultiplayerMatch}
        onLeave={actions.leaveMultiplayer}
      />
    );
  }

  if (!gameState) return null;

  const currentPlayer = getLocalPlayer(gameState, localPlayerId);
  const selectedPlot = selectedPlotId
    ? gameState.plots.find((p) => p.id === selectedPlotId) ?? null
    : null;

  const unreadNewsCount = gameState.news.filter((n) => !n.read).length;
  const pendingContractsCount = gameState.contracts.filter(
    (c) => c.status === 'proposed' && (c.sellerId === currentPlayer.id || c.buyerId === currentPlayer.id)
  ).length;
  const pendingPlotOffersCount = gameState.plotOffers.filter(
    (o) =>
      o.toPlayerId === currentPlayer.id &&
      (o.status === 'pending' || o.status === 'countered')
  ).length;

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
        onBuyServiceVehicle={actions.buyServiceVehicle}
        onDemolish={actions.demolishBuilding}
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
        onBack={() => actions.setShowBuildSelector(false)}
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
    { key: 'newspaper', icon: '📰', label: 'Gazeta', badge: unreadNewsCount },
    { key: 'finance', icon: '📊', label: 'Finanse & Giełda' },
    { key: 'tech', icon: '🔬', label: 'Technologie' },
    { key: 'entrepreneur', icon: '👤', label: 'Prezes' },
    { key: 'influence', icon: '🏛️', label: 'Wpływy' },
    {
      key: 'contracts',
      icon: '🤝',
      label: 'B2B / Wykupy',
      badge: pendingContractsCount + pendingPlotOffersCount,
    },
    { key: 'leaderboard', icon: '🏆', label: 'Ranking' },
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
        onToggleUtilityPopover={() => actions.setShowUtilityPopover(!showUtilityPopover)}
        onToggleTransportRoutes={actions.toggleTransportRoutes}
        onOpenFullBalance={() => {
          setFinanceInitialTab('balance');
          actions.setActiveModal('finance');
        }}
        onOpenOffersModal={() => actions.setActiveModal('contracts')}
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
            onChangeHeatmapMode={actions.setHeatmapMode}
            onSelectPlot={actions.selectPlot}
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
            className="absolute bottom-3 left-2.5 right-14 md:right-auto z-20 flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-[#0b0f17]/92 border border-[#243044] shadow-2xl backdrop-blur-md max-w-[calc(100%-64px)]"
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
                className={`relative px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors ${
                  activeModal === item.key
                    ? 'bg-amber-500/20 border border-amber-400/60 text-amber-300'
                    : 'bg-[#131b2b] hover:bg-[#1b263c] border border-[#212d42] text-slate-200'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
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
              ? `${selectedPlot.building.icon} ${selectedPlot.building.name}`
              : `Działka (${selectedPlot?.gridX}, ${selectedPlot?.gridY})`
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
          onCancel={actions.cancelContract}
          onRespondPlotOffer={actions.respondPlotOffer}
          onClose={() => actions.setActiveModal('none')}
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
        <LeaderboardPanel gameState={gameState} onClose={() => actions.setActiveModal('none')} />
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
          onContinueEndless={actions.continueEndlessAfterVictory}
          onOpenLeaderboard={() => {
            actions.setActiveModal('leaderboard');
          }}
          onExitToMenu={actions.goToMenu}
        />
      )}
    </div>
  );
}

export default App;
