import React, { useMemo } from 'react';
import { CORPORATION_LEVELS, GAME_CONFIG, SPEED_OPTIONS } from '../../config/gameConfig';
import { computePlayerUtilityAndResourceBalance } from '../../engine/BalanceSystem';
import type { GameSpeed, GameState, Player, ResourcePrice } from '../../engine/types';
import {
  formatCompactMoney,
  formatGameDate,
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
  onToggleUtilityPopover: () => void;
  onToggleTransportRoutes: () => void;
  onOpenFullBalance: () => void;
  onOpenOffersModal: () => void;
  onSetSpeed: (speed: GameSpeed) => void;
  onRequestSpeed: (speed: GameSpeed) => void;
  onAcceptSpeedRequest: (speed: GameSpeed) => void;
  onDismissSpeedRequest: () => void;
  onInspectResource: (res: ResourcePrice) => void;
  onSaveGame: () => void;
  onOpenMenu: () => void;
}

export const TopTicker: React.FC<TopTickerProps> = React.memo(
  ({
    gameState,
    currentPlayer,
    isMultiplayer,
    isHost,
    showUtilityPopover,
    showTransportRoutes,
    onToggleUtilityPopover,
    onToggleTransportRoutes,
    onOpenFullBalance,
    onOpenOffersModal,
    onSetSpeed,
    onRequestSpeed,
    onAcceptSpeedRequest,
    onDismissSpeedRequest,
    onInspectResource,
    onSaveGame,
    onOpenMenu,
  }) => {
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
                <span className="font-mono font-semibold text-slate-100">
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

              {/* Klikalne kapsułki bilansu Prądu (MW) i Wody (m³) */}
              <button
                type="button"
                onClick={onToggleUtilityPopover}
                className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-mono shrink-0 transition-colors ${
                  elecBalance < 0 || waterBalance < 0
                    ? 'bg-rose-950/40 border-rose-500/45 text-rose-200 hover:border-rose-400'
                    : 'bg-[#111827] border-[#243044] text-slate-200 hover:border-sky-400/60'
                }`}
                title="Kliknij, aby rozwinąć szczegółowy bilans prądu (MW) i wody (m³)"
              >
                <span className={elecBalance >= 0 ? 'text-amber-300' : 'text-rose-400 font-bold'}>
                  ⚡ {elecBalance >= 0 ? `+${elecBalance}` : elecBalance} MW
                </span>
                <span className="text-slate-600">|</span>
                <span className={waterBalance >= 0 ? 'text-sky-300' : 'text-rose-400 font-bold'}>
                  💧 {waterBalance >= 0 ? `+${waterBalance}` : waterBalance} m³
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

              <div
                className="hidden xl:flex flex-col leading-tight shrink-0"
                title="Nastroje wyborców oraz podaż wykwalifikowanych kadr"
              >
                <span className="text-[10px] text-slate-400 uppercase">Wyborcy / Kadry</span>
                <span className="font-mono text-slate-200">
                  {Math.round(gameState.voterMood) >= 0 ? '+' : ''}
                  {Math.round(gameState.voterMood)} · {100 - gameState.laborShortageIndex}%
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
                  {gameState.players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1 text-[11px]"
                      title={`${p.companyName} (${p.connectionStatus})`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          p.connectionStatus === 'disconnected'
                            ? 'bg-rose-500 animate-pulse'
                            : p.connectionStatus === 'ai_takeover'
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                        }`}
                      />
                      <span className="text-slate-300 max-w-[70px] truncate">{p.name}</span>
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

            {/* Kontrolki prędkości (Host kontroluje bezpośrednio; Klient wysyła prośbę) */}
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

        {/* Rozwijany popover bilansu prądu i wody */}
        {showUtilityPopover && utilityReport && (
          <div className="mx-2 md:mx-4 my-1.5 p-3 rounded-xl bg-[#0e1522] border border-sky-500/40 shadow-2xl text-xs space-y-2 z-40">
            <div className="flex items-center justify-between gap-2 border-b border-[#1e293b] pb-1.5">
              <div className="font-semibold text-slate-100">
                Bilans Mediów Sieciowych (Czas Rzeczywisty)
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="p-2 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-amber-300">⚡ Energia Elektryczna</span>
                  <span
                    className={`font-mono ${
                      utilityReport.electricityNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {utilityReport.electricityNet >= 0 ? '+' : ''}
                    {utilityReport.electricityNet} MW
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Produkcja własna + B2B:</span>
                  <span className="font-mono text-emerald-300">
                    +{utilityReport.electricityProduced} MW
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Pobór obiektów + B2B:</span>
                  <span className="font-mono text-rose-300">
                    -{utilityReport.electricityConsumed} MW
                  </span>
                </div>
                {utilityReport.electricityNet < 0 && (
                  <div className="text-[11px] text-rose-300 pt-1 border-t border-[#1e293b]">
                    ⚠️ Przeciążenie sieci ({utilityReport.electricityNet} MW): wydajność obiektów spada!
                  </div>
                )}
              </div>

              <div className="p-2 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-sky-300">💧 Woda Przemysłowa</span>
                  <span
                    className={`font-mono ${
                      utilityReport.waterNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {utilityReport.waterNet >= 0 ? '+' : ''}
                    {utilityReport.waterNet} m³
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Ujęcia wody + B2B:</span>
                  <span className="font-mono text-emerald-300">
                    +{utilityReport.waterProduced} m³
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Zużycie zakładów + B2B:</span>
                  <span className="font-mono text-rose-300">
                    -{utilityReport.waterConsumed} m³
                  </span>
                </div>
                {utilityReport.waterNet < 0 && (
                  <div className="text-[11px] text-rose-300 pt-1 border-t border-[#1e293b]">
                    ⚠️ Deficyt wody obniża produkcję obiektów przemysłowych.
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

        {/* Dolny pasek notowań giełdowych Live Ticker */}
        <div className="px-2 py-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-[#0e1420]">
          {gameState.resourcePrices.map((rp) => {
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
                <div className="hidden md:block">
                  <MiniChart data={rp.history.slice(-12)} width={40} height={14} positive={isUp} />
                </div>
              </button>
            );
          })}
        </div>
      </header>
    );
  }
);
