import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CORPORATION_LEVELS,
  GAME_CONFIG,
  GOVERNMENT_CONFIGS,
  SPEED_OPTIONS,
} from '../../config/gameConfig';
import { computePlayerUtilityAndResourceBalance } from '../../engine/BalanceSystem';
import type {
  GameSpeed,
  GameState,
  MarketCyclePhase,
  Player,
  ResourcePrice,
  ResourceType,
} from '../../engine/types';
import {
  formatCompactMoney,
  formatGameDate,
  formatMoney,
  formatPercent,
  formatTimeRemaining,
} from '../../utils/formatters';
import { MiniChart } from './MiniChart';

interface TopTickerProps {
  gameState: GameState;
  currentPlayer: Player;
  isMultiplayer: boolean;
  isHost: boolean;
  showUtilityPopover: boolean;
  showTransportRoutes: boolean;
  pinnedResources: ResourceType[];
  onTogglePinResource: (res: ResourceType) => void;
  onToggleUtilityPopover: () => void;
  onToggleTransportRoutes: () => void;
  onOpenFullBalance: () => void;
  onOpenOffersModal: () => void;
  onOpenInfluenceModal?: () => void;
  onPlaceAuctionBid?: (auctionId: string, bidAmount: number) => void;
  onFocusPlot?: (plotId: string) => void;
  onOpenTutorial?: () => void;
  onSetSpeed: (speed: GameSpeed) => void;
  onRequestSpeed: (speed: GameSpeed) => void;
  onAcceptSpeedRequest: (speed: GameSpeed) => void;
  onDismissSpeedRequest: () => void;
  onInspectResource: (res: ResourcePrice) => void;
  onSaveGame: () => void;
  onOpenMenu: () => void;
}

const PHASE_BADGE: Record<MarketCyclePhase, { label: string; cls: string }> = {
  hossa: { label: '🟢 HOSSA', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  korekta: { label: '🟡 KOREKTA', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  banka: { label: '🔥 BAŃKA', cls: 'bg-orange-500/20 text-orange-300 border-orange-500/50 animate-pulse' },
  krach: { label: '📉 KRACH', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse' },
};

export const TopTicker: React.FC<TopTickerProps> = React.memo(
  ({
    gameState,
    currentPlayer,
    isMultiplayer,
    isHost,
    showUtilityPopover,
    showTransportRoutes,
    pinnedResources,
    onTogglePinResource,
    onToggleUtilityPopover,
    onToggleTransportRoutes,
    onOpenFullBalance,
    onOpenOffersModal,
    onOpenInfluenceModal,
    onPlaceAuctionBid,
    onFocusPlot,
    onOpenTutorial,
    onSetSpeed,
    onRequestSpeed,
    onAcceptSpeedRequest,
    onDismissSpeedRequest,
    onInspectResource,
    onSaveGame,
    onOpenMenu,
  }) => {
    const [showMarketModal, setShowMarketModal] = useState(false);
    const [showGoalsPopover, setShowGoalsPopover] = useState(false);
    const [showAuctionPopover, setShowAuctionPopover] = useState(false);

    useEffect(() => {
      if (!showMarketModal && !showGoalsPopover && !showAuctionPopover) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (showMarketModal) {
            e.stopPropagation();
            setShowMarketModal(false);
          } else if (showAuctionPopover) {
            setShowAuctionPopover(false);
          } else if (showGoalsPopover) {
            setShowGoalsPopover(false);
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [showMarketModal, showGoalsPopover, showAuctionPopover]);

    const secretGoals = currentPlayer.secretGoals ?? [];
    const doneGoalsCount = secretGoals.filter((g) => g.completed).length;
    const govCfg = GOVERNMENT_CONFIGS[gameState.government?.currentGov ?? 'free_market'];
    const liveAuction = gameState.liveAuction?.status === 'active' ? gameState.liveAuction : null;

    const showCountdown =
      (gameState.settings.mode === 'challenge1h' || gameState.settings.mode === 'mp_fast') &&
      !gameState.challengeCompleted;

    const canControlSpeed = !isMultiplayer || isHost;
    const corpTier = CORPORATION_LEVELS[currentPlayer.corporationLevel];

    const pendingOffersCount = gameState.plotOffers.filter(
      (o) =>
        o.toPlayerId === currentPlayer.id &&
        (o.status === 'pending' || o.status === 'countered')
    ).length;

    const utilityReport = useMemo(
      () =>
        showUtilityPopover
          ? computePlayerUtilityAndResourceBalance(gameState, currentPlayer)
          : null,
      [showUtilityPopover, gameState, currentPlayer]
    );

    const elecBalance = Math.round(currentPlayer.electricityBalance);
    const waterBalance = Math.round(currentPlayer.waterBalance);
    const sewageBalance = Math.round(currentPlayer.sewageBalance ?? 0);
    const wasteBalance = Math.round(currentPlayer.wasteBalance ?? 0);
    const anyUtilityDeficit =
      elecBalance < 0 || waterBalance < 0 || sewageBalance < 0 || wasteBalance < 0;

    const tickerItems = useMemo(() => {
      const pinned = gameState.resourcePrices.filter((rp) => pinnedResources.includes(rp.type));
      const others = gameState.resourcePrices.filter((rp) => !pinnedResources.includes(rp.type));
      return [...pinned, ...others.slice(0, Math.max(0, 7 - pinned.length))];
    }, [gameState.resourcePrices, pinnedResources]);

    return (
      <header
        id="top-ticker"
        className="w-full bg-[#0b0f17]/95 border-b border-[#243044] backdrop-blur-md z-30 shrink-0 relative"
      >
        {/* Górny wiersz wykonawczy */}
        <div className="px-2.5 md:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2434]">
          <div className="flex items-center gap-2 md:gap-2.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 shadow-[0_0_8px_#10b981]" />
              <span className="font-bold tracking-tight text-xs md:text-sm text-slate-100 hidden sm:inline">
                {GAME_CONFIG.title.toUpperCase()}
              </span>
              <span
                className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] font-semibold text-amber-300 hidden lg:inline"
                title={corpTier.description}
              >
                Poz.{corpTier.level} {corpTier.name}
              </span>
            </div>

            <div className="flex items-center gap-2.5 md:gap-3.5 text-xs overflow-x-auto no-scrollbar">
              <div className="flex flex-col leading-tight shrink-0" title="Dostępna gotówka">
                <span className="text-[10px] text-slate-400 uppercase">Gotówka</span>
                <span
                  className={`font-mono font-semibold ${
                    currentPlayer.cash < 0 ? 'text-rose-400' : 'text-slate-100'
                  }`}
                >
                  {formatCompactMoney(currentPlayer.cash)}
                </span>
              </div>

              <div className="flex flex-col leading-tight shrink-0" title="Przepływ pieniężny netto na minutę">
                <span className="text-[10px] text-slate-400 uppercase">Cash Flow/min</span>
                <span
                  className={`font-mono font-semibold ${
                    currentPlayer.cashFlowPerMin >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {currentPlayer.cashFlowPerMin >= 0 ? '+' : ''}
                  {formatCompactMoney(currentPlayer.cashFlowPerMin)}
                </span>
              </div>

              <div className="flex flex-col leading-tight shrink-0" title="Wycena netto imperium">
                <span className="text-[10px] text-slate-400 uppercase">Wycena Netto</span>
                <span className="font-mono font-semibold text-amber-300">
                  {formatCompactMoney(currentPlayer.netWorth)}
                </span>
              </div>

              {/* Klikalne kapsułki bilansu Prądu, Wody, Ścieków i Odpadów */}
              <button
                type="button"
                onClick={onToggleUtilityPopover}
                className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-mono shrink-0 transition-colors ${
                  anyUtilityDeficit
                    ? 'bg-rose-950/40 border-rose-500/45 text-rose-200 hover:border-rose-400'
                    : 'bg-[#111827] border-[#243044] text-slate-200 hover:border-sky-400/60'
                }`}
                title="Kliknij, aby rozwinąć szczegółowy bilans prądu, wody, ścieków i odpadów"
              >
                <span className={elecBalance >= 0 ? 'text-amber-300' : 'text-rose-400 font-bold'}>
                  ⚡{elecBalance >= 0 ? `+${elecBalance}` : elecBalance}
                </span>
                <span className="text-slate-600">|</span>
                <span className={waterBalance >= 0 ? 'text-sky-300' : 'text-rose-400 font-bold'}>
                  💧{waterBalance >= 0 ? `+${waterBalance}` : waterBalance}
                </span>
                <span className="text-slate-600 hidden sm:inline">|</span>
                <span
                  className={`hidden sm:inline ${
                    sewageBalance >= 0 ? 'text-teal-300' : 'text-rose-400 font-bold'
                  }`}
                >
                  🚰{sewageBalance >= 0 ? `+${sewageBalance}` : sewageBalance}
                </span>
                <span className="text-slate-600 hidden sm:inline">|</span>
                <span
                  className={`hidden sm:inline ${
                    wasteBalance >= 0 ? 'text-lime-300' : 'text-rose-400 font-bold'
                  }`}
                >
                  🗑️{wasteBalance >= 0 ? `+${wasteBalance}` : wasteBalance}
                </span>
              </button>

              {pendingOffersCount > 0 && (
                <button
                  type="button"
                  onClick={onOpenOffersModal}
                  className="px-2 py-1 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[11px] font-semibold animate-pulse shrink-0"
                  title="Masz oczekujące oferty wykupu działek"
                >
                  📩 {pendingOffersCount} Ofert{pendingOffersCount === 1 ? 'a' : 'y'}
                </button>
              )}

              {secretGoals.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAuctionPopover(false);
                    setShowGoalsPopover((v) => !v);
                  }}
                  className={`px-2 py-1 rounded border text-[11px] font-semibold shrink-0 transition-colors ${
                    doneGoalsCount === secretGoals.length
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : 'bg-[#111827] border-[#243044] hover:border-amber-400/60 text-amber-200'
                  }`}
                  title="Tajne Cele Osobiste (ukryte przed konkurencją)"
                >
                  🎯 Cele {doneGoalsCount}/{secretGoals.length}
                </button>
              )}

              {liveAuction && (
                <button
                  type="button"
                  onClick={() => {
                    setShowGoalsPopover(false);
                    setShowAuctionPopover((v) => !v);
                  }}
                  className={`px-2 py-1 rounded border text-[11px] font-mono font-semibold shrink-0 transition-colors flex items-center gap-1 ${
                    showAuctionPopover
                      ? 'bg-amber-500/30 border-amber-300 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.45)]'
                      : 'bg-amber-500/15 border-amber-400/60 hover:bg-amber-500/25 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse'
                  }`}
                  title={`Licytacja na żywo: ${liveAuction.title} — kliknij, aby licytować lub zobaczyć działkę na mapie`}
                >
                  <span>🔨</span>
                  <span>{liveAuction.secondsRemaining}s</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenInfluenceModal}
                className="hidden 2xl:flex items-center gap-1 px-2 py-1 rounded bg-[#111827] border border-[#243044] hover:border-amber-400/50 text-[11px] text-slate-200 shrink-0"
                title={`${govCfg.name}: ${govCfg.summary}`}
              >
                <span>{govCfg.badge}</span>
                <span className="max-w-[115px] truncate">{govCfg.name.replace('Rząd ', '')}</span>
              </button>

              {gameState.settings.weeklyChallengeId && (
                <span
                  className="hidden xl:inline px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono text-[10px] shrink-0"
                  title={`Wyzwanie Tygodnia ${gameState.settings.weeklyChallengeId} — cel: ${formatCompactMoney(gameState.settings.weeklyTargetNetWorth ?? 0)} do roku ${gameState.settings.weeklyMaxYear ?? 2035}`}
                >
                  🏆 {gameState.settings.weeklyChallengeId}
                </span>
              )}

              <div
                className="hidden xl:flex flex-col leading-tight shrink-0"
                title="Nastroje wyborców oraz podaż wykwalifikowanych kadr"
              >
                <span className="text-[10px] text-slate-400 uppercase">Poparcie / Kadry</span>
                <span className="font-mono text-slate-200">
                  {Math.round(currentPlayer.influence.voterApproval)}% · {100 - gameState.laborShortageIndex}%
                </span>
              </div>
            </div>
          </div>

          {/* Prawa sekcja: Status MP + SYNC LIVE + Zegar + Kontrola prędkości */}
          <div className="flex items-center flex-wrap gap-1.5 md:gap-2 shrink-0">
            {isMultiplayer && (
              <>
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/35 text-[10px] font-mono text-emerald-300"
                  title={`Zegar zsynchronizowany z Hostem · Tura #${gameState.time.tick}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>SYNC LIVE</span>
                  <span className="hidden sm:inline text-slate-400">#{gameState.time.tick}</span>
                </div>

                <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded bg-[#111827] border border-[#243044]">
                  {gameState.players.slice(0, 8).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1 text-[11px]"
                      title={`${p.companyName} (${p.connectionStatus})`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          p.isEliminated
                            ? 'bg-slate-600'
                            : p.connectionStatus === 'disconnected'
                              ? 'bg-rose-500 animate-pulse'
                              : p.connectionStatus === 'ai_takeover'
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                        }`}
                      />
                      <span className="text-slate-300 max-w-[60px] truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {showCountdown && (
              <div
                className={`px-2 py-0.5 rounded font-mono text-xs border ${
                  gameState.challengeTimeRemaining < 300
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 animate-pulse'
                    : 'bg-[#111827] border-[#243044] text-amber-300'
                }`}
                title="Pozostały czas wyzwania"
              >
                ⏱ {formatTimeRemaining(gameState.challengeTimeRemaining)}
              </div>
            )}

            <div className="hidden sm:block font-mono text-xs text-slate-300 px-2 py-1 rounded bg-[#111827] border border-[#243044]">
              {formatGameDate(gameState.time)}
            </div>

            {/* Kontrolki prędkości (0.5x..10x) */}
            <div
              className="flex items-center bg-[#111827] border border-[#243044] rounded-md p-0.5"
              title={
                canControlSpeed
                  ? 'Prędkość symulacji'
                  : 'Zegar kontrolowany przez Hosta — kliknięcie wysyła prośbę o zmianę tempa'
              }
            >
              {SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    canControlSpeed ? onSetSpeed(opt.value) : onRequestSpeed(opt.value)
                  }
                  className={`px-1.5 md:px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    gameState.speed === opt.value
                      ? opt.value === 0
                        ? 'bg-rose-500/25 text-rose-300'
                        : 'bg-emerald-500/25 text-emerald-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.value === 0 ? '⏸' : opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onToggleTransportRoutes}
              className={`px-2 py-1 rounded border text-xs transition-colors ${
                showTransportRoutes
                  ? 'bg-sky-500/20 border-sky-400/60 text-sky-300'
                  : 'bg-[#111827] border-[#243044] text-slate-400 hover:text-slate-200'
              }`}
              title="Pokaż / ukryj trasy morskie, lotnicze i drogowe na mapie"
            >
              🛣️
            </button>

            {onOpenTutorial && (
              <button
                type="button"
                onClick={onOpenTutorial}
                className="px-2 py-1 rounded bg-[#111827] border border-[#243044] hover:border-amber-400 text-xs text-amber-300"
                title="Kompendium Zasad i Samouczek"
              >
                🎓
              </button>
            )}

            <button
              type="button"
              onClick={onSaveGame}
              className="px-2 py-1 rounded bg-[#111827] border border-[#243044] hover:border-sky-400 text-xs text-slate-300"
              title="Zapisz / Wczytaj grę (Sloty zapisu)"
            >
              💾
            </button>

            <button
              type="button"
              onClick={onOpenMenu}
              className="px-2 py-1 rounded bg-[#111827] border border-[#243044] hover:border-slate-400 text-xs text-slate-300"
              title="Menu główne"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Ostrzeżenie komornicze */}
        {(currentPlayer.insolvencyGraceTicks ?? 0) > 0 && (
          <div className="px-3 py-1 bg-rose-950/70 border-b border-rose-500/50 text-rose-200 text-xs flex items-center justify-between gap-2 animate-pulse">
            <span>
              🔨 <strong>OSTATECZNE WEZWANIE KOMORNICZE!</strong> Za{' '}
              <strong className="font-mono">{currentPlayer.insolvencyGraceTicks} cykli</strong> komornik
              zlicytuje Twój najcenniejszy majątek! Spłać ujemne saldo lub sprzedaj aktywa.
            </span>
          </div>
        )}

        {/* Pływająca karta 30-sekundowej Licytacji Komorniczej Na Żywo */}
        {showAuctionPopover && liveAuction && (
          <div className="absolute left-3 md:left-80 top-12 z-40 w-[345px] max-w-[calc(100vw-24px)] rounded-xl bg-[#0e1522] border border-amber-400/65 shadow-2xl p-3.5 space-y-2.5 animate-fadeIn">
            <div className="flex items-start justify-between gap-2 border-b border-[#243044] pb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono text-[10px] font-extrabold uppercase">
                    🔨 LICYTACJA · {liveAuction.secondsRemaining}s
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ({liveAuction.gridX}, {liveAuction.gridY})
                  </span>
                </div>
                <div className="font-bold text-sm text-white mt-1 truncate">{liveAuction.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowAuctionPopover(false)}
                className="text-slate-400 hover:text-white text-xs shrink-0"
              >
                ✕
              </button>
            </div>

            {liveAuction.description && (
              <div className="text-[11px] text-slate-300 leading-snug">{liveAuction.description}</div>
            )}

            <div className="p-2.5 rounded-lg bg-[#131b2b] border border-[#243044] flex items-center justify-between gap-2 text-xs">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Aktualna oferta</div>
                <div className="font-mono font-bold text-emerald-300 text-sm">
                  {formatMoney(liveAuction.currentBid)}
                </div>
              </div>
              <div className="text-right min-w-0">
                <div className="text-[10px] text-slate-400 uppercase">Prowadzi</div>
                <div className="font-semibold text-amber-200 truncate max-w-[140px]">
                  {liveAuction.highestBidderName ?? 'Cena wywoławcza'}
                </div>
              </div>
            </div>

            {onPlaceAuctionBid && (
              <div className="grid grid-cols-3 gap-1.5">
                {[25_000, 100_000, 250_000].map((inc) => {
                  const bidAmt = liveAuction.currentBid + inc;
                  const label = inc === 25_000 ? '+25 tys.' : inc === 100_000 ? '+100 tys.' : '+250 tys.';
                  return (
                    <button
                      key={inc}
                      type="button"
                      disabled={currentPlayer.cash < bidAmt}
                      onClick={() => onPlaceAuctionBid(liveAuction.id, bidAmt)}
                      className="py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-mono font-bold text-xs transition-colors"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {onFocusPlot && (
              <button
                type="button"
                onClick={() => {
                  onFocusPlot(liveAuction.plotId);
                  setShowAuctionPopover(false);
                }}
                className="w-full py-1.5 px-3 rounded-lg bg-[#182235] hover:bg-[#22314a] border border-sky-500/45 text-sky-200 text-xs font-semibold transition-colors"
              >
                📍 Pokaż na mapie
              </button>
            )}
          </div>
        )}

        {/* Popover Tajnych Celów Osobistych */}
        {showGoalsPopover && secretGoals.length > 0 && (
          <div className="absolute left-3 md:left-72 top-12 z-40 w-[340px] max-w-[calc(100vw-24px)] rounded-xl bg-[#0e1522] border border-amber-500/50 shadow-2xl p-3.5 space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#243044] pb-2">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                🎯 Twoje Tajne Cele Osobiste
              </span>
              <button
                type="button"
                onClick={() => setShowGoalsPopover(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {secretGoals.map((goal) => {
                const pct = goal.completed
                  ? 100
                  : Math.min(100, Math.round((goal.currentValue / Math.max(1, goal.targetValue)) * 100));
                return (
                  <div
                    key={goal.id}
                    className={`p-2.5 rounded-lg border ${
                      goal.completed
                        ? 'bg-emerald-950/35 border-emerald-500/50'
                        : 'bg-[#131b2b] border-[#243044]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-100">
                        {goal.completed ? '✅' : '🕵️'} {goal.title}
                      </span>
                      <span className="font-mono text-[10px] text-amber-300 shrink-0">
                        +{formatCompactMoney(goal.rewardCash)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{goal.description}</div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-300">
                      <span>
                        {goal.currentValue}/{goal.targetValue} {goal.unitLabel} ({pct}%)
                      </span>
                      {goal.completed && <span className="text-emerald-300">UKOŃCZONO!</span>}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#090d14] overflow-hidden mt-1">
                      <div
                        className={`h-full ${goal.completed ? 'bg-emerald-400' : 'bg-amber-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-400">
              Rywale nie znają Twoich celów aż do momentu ich zrealizowania w Gazecie!
            </div>
          </div>
        )}

        {/* Rozwijany popover bilansu prądu, wody, ścieków i odpadów */}
        {showUtilityPopover && utilityReport && (
          <div className="mx-2 md:mx-4 my-1.5 p-3 rounded-xl bg-[#0e1522] border border-sky-500/40 shadow-2xl text-xs space-y-2 z-40">
            <div className="flex items-center justify-between gap-2 border-b border-[#1e293b] pb-1.5">
              <div className="font-semibold text-slate-100">
                Bilans Mediów Sieciowych i Komunalnych (Czas Rzeczywisty)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onToggleUtilityPopover();
                    onOpenFullBalance();
                  }}
                  className="px-2 py-0.5 rounded bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/40 text-sky-200 font-medium"
                >
                  Pełny Bilans Zasobów →
                </button>
                <button
                  type="button"
                  onClick={onToggleUtilityPopover}
                  className="text-slate-400 hover:text-white px-1"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="p-2 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-amber-300">⚡ Prąd (Pokrycie {Math.round(utilityReport.electricityCoverageRatio * 100)}%)</span>
                  <span className={`font-mono ${utilityReport.electricityNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {utilityReport.electricityNet >= 0 ? '+' : ''}
                    {utilityReport.electricityNet} MW
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Podaż / Pobór:</span>
                  <span className="font-mono text-slate-200">
                    +{utilityReport.electricityProduced} / -{utilityReport.electricityConsumed} MW
                  </span>
                </div>
                {utilityReport.electricityCoverageRatio < 0.99 && (
                  <div className="text-[10px] text-rose-300">
                    {utilityReport.electricityCoverageRatio < 0.2
                      ? '⛔ PARALIŻ <20%: zakłady stoją na 0%!'
                      : '⚠️ Deficyt ostro tnie wydajność zakładów.'}
                  </div>
                )}
              </div>

              <div className="p-2 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-sky-300">💧 Woda (Pokrycie {Math.round(utilityReport.waterCoverageRatio * 100)}%)</span>
                  <span className={`font-mono ${utilityReport.waterNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {utilityReport.waterNet >= 0 ? '+' : ''}
                    {utilityReport.waterNet} m³
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Ujęcia / Zużycie:</span>
                  <span className="font-mono text-slate-200">
                    +{utilityReport.waterProduced} / -{utilityReport.waterConsumed} m³
                  </span>
                </div>
                {utilityReport.waterCoverageRatio < 0.99 && (
                  <div className="text-[10px] text-rose-300">
                    {utilityReport.waterCoverageRatio < 0.2
                      ? '⛔ PARALIŻ WODNY <20%: produkcja stoi!'
                      : '⚠️ Braki wody obniżają wydajność.'}
                  </div>
                )}
              </div>

              <div className="p-2 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-teal-300">🚰 Ścieki</span>
                  <span className={`font-mono ${utilityReport.sewageNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {utilityReport.sewageNet >= 0 ? '+' : ''}
                    {utilityReport.sewageNet} m³
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Oczyszczalnie / Emisja:</span>
                  <span className="font-mono text-slate-200">
                    +{utilityReport.sewageTreated} / -{utilityReport.sewageProduced} m³
                  </span>
                </div>
                {utilityReport.sewageNet < 0 && (
                  <div className="text-[10px] text-rose-300">
                    ⚠️ Przeciążenie kanalizacji: kary sanitarne i spadek poparcia!
                  </div>
                )}
              </div>

              <div className="p-2 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-lime-300">🗑️ Odpady i Śmieci</span>
                  <span className={`font-mono ${utilityReport.wasteNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {utilityReport.wasteNet >= 0 ? '+' : ''}
                    {utilityReport.wasteNet} t
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Przerób / Produkcja:</span>
                  <span className="font-mono text-slate-200">
                    +{utilityReport.wasteProcessed} / -{utilityReport.wasteProduced} t
                  </span>
                </div>
                {utilityReport.wasteNet < 0 && (
                  <div className="text-[10px] text-rose-300">
                    ⚠️ Zalegające odpady: postaw Spalarnię lub Zakład Recyklingu.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pasek prośby klienta o zmianę tempa / pauzę widoczny u Hosta */}
        {isMultiplayer && isHost && gameState.speedRequest && (
          <div className="px-3 py-1 bg-amber-950/50 border-b border-amber-500/35 flex items-center justify-between gap-2 text-xs">
            <span className="text-amber-200">
              ⏱ Gracz <strong>{gameState.speedRequest.playerName}</strong> prosi o zmianę tempa na{' '}
              <strong>
                {gameState.speedRequest.requestedSpeed === 0
                  ? 'Pauza'
                  : `${gameState.speedRequest.requestedSpeed}×`}
              </strong>
            </span>
            <div className="flex gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onAcceptSpeedRequest(gameState.speedRequest!.requestedSpeed)}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                Akceptuj
              </button>
              <button
                type="button"
                onClick={onDismissSpeedRequest}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Odrzuć
              </button>
            </div>
          </div>
        )}

        {/* Kompaktowy Live Ticker bez ucinania + przycisk Pełnego Rynku */}
        <div className="px-2 py-1 flex items-center gap-1.5 bg-[#0e1420]">
          <button
            type="button"
            onClick={() => setShowMarketModal((v) => !v)}
            className={`px-2.5 py-1 rounded border text-[11px] font-semibold shrink-0 whitespace-nowrap transition-colors ${
              showMarketModal
                ? 'bg-sky-600/35 border-sky-400 text-white'
                : 'bg-sky-950/60 hover:bg-sky-900/70 border-sky-500/45 text-sky-200'
            }`}
            title="Otwórz lub zamknij pełną tabelę wszystkich surowców, cykle koniunkturalne i przypnij ulubione"
          >
            📈 Pełny Rynek & Indeksy
          </button>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1">
            {tickerItems.map((rp) => {
              const isUp = rp.changePercent >= 0;
              return (
                <button
                  key={rp.type}
                  type="button"
                  onClick={() => onInspectResource(rp)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#131b2b] hover:bg-[#1a2438] border border-[#212d42] transition-colors shrink-0 text-left"
                  title={`Kliknij, aby otworzyć wykres świecowy: ${rp.name}`}
                >
                  <span className="text-xs">{rp.emoji}</span>
                  <span className="text-[11px] font-medium text-slate-300">{rp.name}</span>
                  <span className="font-mono text-[11px] font-semibold text-slate-100">
                    {rp.price} zł
                  </span>
                  <span
                    className={`font-mono text-[10px] ${
                      isUp ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatPercent(rp.changePercent)}
                  </span>
                  <div className="hidden lg:block">
                    <MiniChart data={rp.history.slice(-12)} width={36} height={14} positive={isUp} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pełny Modal Rynku i Cykli Sektorowych (renderowany przez Portal poza backdrop-filter nagłówka) */}
        {showMarketModal &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowMarketModal(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-5xl max-h-[85vh] rounded-2xl bg-[#0e1420] border border-[#2d3b52] shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="sticky top-0 z-10 shrink-0 px-4 py-3 bg-[#0b0f17] border-b border-[#243044] flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base md:text-lg font-extrabold text-white">
                      📈 Pełny Rynek & Indeksy
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Śledź fazy Hossa / Korekta / Bańka / Krach i przypinaj wybrane towary (★) na górny pasek
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMarketModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-[#1a2438] hover:bg-[#25334f] border border-[#2d3b52] text-xs font-semibold text-slate-200 hover:text-white shrink-0"
                  >
                    ✕ Zamknij
                  </button>
                </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Indeksy sektorowe */}
                {gameState.marketCycles && gameState.marketCycles.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase text-slate-400">
                      Indeksy Sektorowe i Fazy Koniunktury
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      {gameState.marketCycles.map((cyc) => {
                        const badge = PHASE_BADGE[cyc.phase];
                        const pos = cyc.changePercent >= 0;
                        return (
                          <div
                            key={cyc.sector}
                            className="p-2.5 rounded-xl bg-[#111827] border border-[#243044] space-y-1.5 text-xs"
                          >
                            <div className="font-semibold text-slate-200 line-clamp-1" title={cyc.name}>
                              {cyc.name}
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${badge.cls}`}>
                                {badge.label}
                              </span>
                              <span className="font-mono text-[11px] text-slate-300">
                                {cyc.indexValue} pkt
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <MiniChart
                                data={cyc.history.slice(-16)}
                                width={78}
                                height={20}
                                positive={cyc.phase !== 'krach' && pos}
                              />
                              <span
                                className={`font-mono text-[11px] font-semibold ${
                                  pos ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {formatPercent(cyc.changePercent)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pełna lista wszystkich surowców */}
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase text-slate-400">
                    Wszystkie Towary i Surowce ({gameState.resourcePrices.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {gameState.resourcePrices.map((rp) => {
                      const isPinned = pinnedResources.includes(rp.type);
                      const isUp = rp.changePercent >= 0;
                      const stockOwned = currentPlayer.warehouseStockpile[rp.type] ?? 0;
                      return (
                        <div
                          key={rp.type}
                          className="p-2.5 rounded-xl bg-[#111827] border border-[#243044] flex items-center justify-between gap-2 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShowMarketModal(false);
                              onInspectResource(rp);
                            }}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-90"
                          >
                            <span className="text-lg shrink-0">{rp.emoji}</span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-100 truncate">{rp.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Magazyn: {stockOwned.toFixed(1)} {rp.unit}
                              </div>
                            </div>
                          </button>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-slate-100">{rp.price} zł</div>
                            <div
                              className={`font-mono text-[10px] ${
                                isUp ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatPercent(rp.changePercent)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onTogglePinResource(rp.type)}
                            className={`px-2 py-1 rounded border text-xs shrink-0 ${
                              isPinned
                                ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                                : 'bg-[#0b0f17] border-[#243044] text-slate-500 hover:text-slate-200'
                            }`}
                            title={isPinned ? 'Odepnij z paska' : 'Przypnij do paska Live Ticker'}
                          >
                            {isPinned ? '★' : '☆'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </header>
    );
  }
);
