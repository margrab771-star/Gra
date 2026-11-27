import React, { useState } from 'react';
import {
  GAME_CONFIG,
  TERRAIN_NAMES,
  TOLL_RATE_CONFIG,
} from '../../config/gameConfig';
import { RESOURCE_DEFINITIONS } from '../../data/resources';
import {
  getExpansionPriceMultiplier,
  getPlayerOwnedPlotCount,
  getPlotPurchasePrice,
  getRoadBuildCostForPlot,
  getSuggestedPlotBuyoutValuation,
  hasPlayerDiscoveredPlot,
  hasPlayerSurveyedPlot,
  isPlotBuildingVisibleToViewer,
} from '../../engine/PlotSystem';
import type { GameState, Player, Plot, TollRate } from '../../engine/types';
import { formatMoney } from '../../utils/formatters';
import { DarkNumberInput, DarkToggle } from '../HUD/DarkControls';

interface PlotPanelProps {
  plot: Plot;
  gameState: GameState;
  currentPlayer: Player;
  onBuyPlot: (plotId: string) => void;
  onSellPlot: (plotId: string) => void;
  onSurveyPlot: (plotId: string) => void;
  onSurveyArea: (plotId: string) => void;
  onBuildRoad: (plotId: string, roadClass: 'local' | 'highway' | 'bridge') => void;
  onSetRoadPolicy: (
    plotId: string,
    opts: { tollRate?: TollRate; roadBlocked?: boolean; toggleBlockedPlayerId?: string }
  ) => void;
  onApplyHighwayPolicyToAll?: (tollRate: TollRate, roadBlocked: boolean) => void;
  onRevealFogPlot?: (plotId: string) => void;
  onProposePlotOffer: (
    plotId: string,
    offeredPrice: number,
    includeBuilding: boolean
  ) => void;
  onOpenBuildSelector: () => void;
  onClose: () => void;
}

const TOLL_OPTIONS: TollRate[] = ['free', 'low', 'standard', 'high', 'prohibitive'];

export const PlotPanel: React.FC<PlotPanelProps> = React.memo(
  ({
    plot,
    gameState,
    currentPlayer,
    onBuyPlot,
    onSellPlot,
    onSurveyPlot,
    onSurveyArea,
    onBuildRoad,
    onSetRoadPolicy,
    onApplyHighwayPolicyToAll,
    onRevealFogPlot,
    onProposePlotOffer,
    onOpenBuildSelector,
    onClose,
  }) => {
    const owner = plot.ownerId ? gameState.players.find((p) => p.id === plot.ownerId) : null;
    const isMine = plot.ownerId === currentPlayer.id;
    const ownedPlotsCount = getPlayerOwnedPlotCount(gameState, currentPlayer.id);
    const expansionMult = getExpansionPriceMultiplier(ownedPlotsCount);
    const purchasePrice =
      plot.purchasable && plot.ownerId === null
        ? getPlotPurchasePrice(plot, currentPlayer, gameState)
        : plot.price;
    const hasGeoTech = currentPlayer.globalTech['ind_geology']?.status === 'done';
    const localRoadCost = getRoadBuildCostForPlot(gameState, currentPlayer, plot, 'local');
    const highwayRoadCost = getRoadBuildCostForPlot(gameState, currentPlayer, plot, 'highway');
    const surveyCost = Math.round(GAME_CONFIG.surveyCost * (hasGeoTech ? 0.7 : 1));
    const areaScanCost = Math.round(
      GAME_CONFIG.surveyCost * 0.7 * GAME_CONFIG.areaSurveyMultiplier
    );

    const playerSurveyed = hasPlayerSurveyedPlot(plot, currentPlayer.id);
    const playerDiscovered = hasPlayerDiscoveredPlot(plot, currentPlayer.id, currentPlayer, gameState);
    const visibleDeposits = playerDiscovered ? plot.deposits : [];
    const buildingVisible = !plot.building || isPlotBuildingVisibleToViewer(plot, currentPlayer.id, currentPlayer, gameState);

    const suggestedOffer = getSuggestedPlotBuyoutValuation(plot, false);
    const [offerPrice, setOfferPrice] = useState<number>(suggestedOffer);

    const rivals = gameState.players.filter(
      (p) => p.id !== currentPlayer.id && !p.isEliminated
    );

    return (
      <div id="plot-panel" className="space-y-3.5 text-sm animate-fadeIn">
        <div className="flex items-start justify-between border-b border-[#243044] pb-2.5 gap-2">
          <div>
            <div className="text-xs font-mono text-sky-400">
              SEKTOR ({plot.gridX}, {plot.gridY})
            </div>
            {(plot.irradiatedTicks ?? 0) > 0 && (
              <div className="mt-1 px-2 py-1 rounded bg-lime-950/70 border border-lime-400/60 text-lime-200 text-[11px] font-semibold">
                ☢️ STREFA SKAŻENIA NUKLEARNEGO ({plot.irradiatedTicks} tur) — zakaz kupna, dróg i budowy!
              </div>
            )}
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2 flex-wrap">
              <span>Działka · {TERRAIN_NAMES[plot.terrain]}</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hidden md:flex w-7 h-7 rounded bg-[#1c2434] text-slate-400 hover:text-white items-center justify-center shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044]">
            <div className="text-[11px] text-slate-400">
              {plot.purchasable && plot.ownerId === null ? 'Cena Zakupu Działki' : 'Wartość Rynkowa'}
            </div>
            <div className="font-mono font-bold text-amber-300 text-sm">
              {plot.terrain === 'water' ? 'Niedostępna' : formatMoney(purchasePrice)}
            </div>
            {plot.purchasable && plot.ownerId === null && plot.terrain !== 'water' && (
              <div className="text-[10px] text-slate-400 mt-0.5">
                Cena z mnożnikiem ekspansji (×{expansionMult.toFixed(2)})
              </div>
            )}
          </div>
          <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044]">
            <div className="text-[11px] text-slate-400">Atrakcyjność / Ryzyko</div>
            <div className="font-mono font-bold text-sm flex items-center gap-1.5">
              <span
                className={
                  plot.attractiveness >= 70
                    ? 'text-emerald-400'
                    : plot.attractiveness >= 45
                      ? 'text-sky-400'
                      : 'text-rose-400'
                }
              >
                {plot.attractiveness}/100
              </span>
              <span className="text-slate-600">·</span>
              <span className={plot.crimeScore >= 25 ? 'text-rose-400' : 'text-slate-400'} title="Lokalna przestępczość">
                🚓 {plot.crimeScore}
              </span>
            </div>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1.5 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Właściciel</span>
            <span className="font-medium text-slate-200 text-right" style={{ color: owner?.color }}>
              {owner ? owner.companyName : 'Skarb Państwa (Wolna)'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Lokalny Popyt Pasażerski</span>
            <span className="font-mono font-semibold text-sky-300">
              🚶 {Math.round(plot.passengerDemandPercent ?? 100)}%
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Dostęp drogowy</span>
            <span className={plot.hasRoad ? 'text-emerald-400 font-medium' : plot.distanceToRoad <= 2 ? 'text-sky-300' : 'text-amber-400'}>
              {plot.hasRoad
                ? plot.roadType === 'highway'
                  ? 'Autostrada Płatna'
                  : 'Droga Zwykła'
                : plot.terrain === 'urban'
                  ? 'Strefa Miejska (OK)'
                  : `${plot.distanceToRoad} pól od drogi`}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Media sieciowe</span>
            <span className="font-mono">
              <span className={plot.hasElectricity ? 'text-emerald-400' : 'text-rose-400'}>
                {plot.hasElectricity ? '⚡ Prąd OK' : '⚡ Brak'}
              </span>
              {' · '}
              <span className={plot.hasWater ? 'text-sky-400' : 'text-rose-400'}>
                {plot.hasWater ? '💧 Woda OK' : '💧 Brak'}
              </span>
            </span>
          </div>
          {plot.neighborPenalty > 0 && (
            <div className="pt-1 text-rose-400 text-[11px] border-t border-[#1c2434]">
              ⚠️ Zanieczyszczenie sąsiedztwa (−{plot.neighborPenalty} atrakcyjności). Hotele i kurorty tracą tu gości!
            </div>
          )}
        </div>

        {/* Prywatne Badania Geologiczne */}
        <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Badania Geologiczne (Prywatne)
            </span>
            <span className={`text-[11px] font-medium ${playerSurveyed ? 'text-emerald-400' : 'text-slate-400'}`}>
              {playerSurveyed ? '✓ Zbadano' : 'Nieprzebadana'}
            </span>
          </div>

          {playerDiscovered ? (
            visibleDeposits.length > 0 ? (
              <div className="space-y-1">
                {visibleDeposits.map((dep, idx) => {
                  const info = RESOURCE_DEFINITIONS[dep.type];
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-2 py-1.5 rounded bg-[#151c28] border border-[#243044] text-xs"
                    >
                      <span className="text-slate-100">
                        {info.emoji} {info.name}
                      </span>
                      <span className="font-mono text-emerald-400">
                        {dep.amount.toLocaleString('pl-PL')} {info.unit} (×{dep.richness})
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-2.5 py-1.5 rounded bg-[#151c28] border border-[#243044] text-xs text-slate-400">
                ∅ Zbadano: brak złóż mineralnych pod tą działką.
              </div>
            )
          ) : (
            <div className="text-xs text-slate-400 leading-relaxed">
              Wszystkie złoża pod powierzchnią są ukryte. Zleć odwiert geologiczny przed lub po zakupie działki, aby sprawdzić surowce.
            </div>
          )}

          {plot.terrain !== 'water' && (!owner || isMine) && !plot.hasRoad && (
            <div className="space-y-1.5">
              {!playerSurveyed && (
                <button
                  type="button"
                  onClick={() => onSurveyPlot(plot.id)}
                  disabled={currentPlayer.cash < surveyCost}
                  className="w-full py-2 px-3 rounded-lg bg-[#182235] hover:bg-[#1f2d45] border border-sky-500/40 text-sky-300 text-xs font-semibold disabled:opacity-40 transition-colors"
                >
                  🔍 Badanie Geologiczne ({formatMoney(surveyCost)})
                </button>
              )}
              <button
                type="button"
                onClick={() => onSurveyArea(plot.id)}
                disabled={!hasGeoTech || currentPlayer.cash < areaScanCost}
                className="w-full py-2 px-3 rounded-lg bg-[#141d2e] hover:bg-[#1b273e] border border-amber-500/35 text-amber-200 text-xs font-semibold disabled:opacity-40 transition-colors"
                title={
                  hasGeoTech
                    ? 'Skanuje działki w promieniu 3×3'
                    : 'Odblokuj technologię "Geofizyka Złożowa i Georadar"'
                }
              >
                📡 Georadar 3×3 ({formatMoney(areaScanCost)}) {!hasGeoTech && '🔒'}
              </button>
            </div>
          )}
        </div>

        {/* Panel własności / budowy / dróg / autostrad / myta */}
        <div className="space-y-2 pt-1">
          {plot.purchasable && plot.ownerId === null && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => onBuyPlot(plot.id)}
                disabled={currentPlayer.cash < purchasePrice}
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm disabled:opacity-40 transition-colors shadow-lg shadow-emerald-950/50"
              >
                Kup Działkę · {formatMoney(purchasePrice)}
              </button>
              <div className="text-[11px] text-slate-400 text-center">
                Mnożnik ekspansji: <span className="font-mono text-amber-300">×{expansionMult.toFixed(2)}</span> ({ownedPlotsCount} posiadanych działek)
              </div>
            </div>
          )}

          {isMine && !plot.building && (
            <>
              {!plot.hasRoad && (
                <button
                  type="button"
                  onClick={onOpenBuildSelector}
                  className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors"
                >
                  🏗️ Postaw Strukturę na Działce
                </button>
              )}

              {plot.terrain === 'water' && !plot.hasRoad && !plot.building && (
                <button
                  type="button"
                  onClick={() => onBuildRoad(plot.id, 'bridge')}
                  disabled={
                    (plot.irradiatedTicks ?? 0) > 0 ||
                    currentPlayer.cash < getRoadBuildCostForPlot(gameState, currentPlayer, plot, 'bridge')
                  }
                  className="w-full py-2 px-3 rounded-lg bg-sky-950/55 hover:bg-sky-900/70 border border-sky-400/50 text-sky-200 text-xs font-semibold disabled:opacity-40 transition-colors"
                >
                  🌉 Wybuduj Most Drogowy ({formatMoney(getRoadBuildCostForPlot(gameState, currentPlayer, plot, 'bridge'))})
                </button>
              )}

              {plot.terrain !== 'water' && !plot.hasRoad && (
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onBuildRoad(plot.id, 'local')}
                    disabled={currentPlayer.cash < localRoadCost}
                    className="w-full py-2 px-3 rounded-lg bg-[#151e2e] hover:bg-[#1c283d] border border-slate-500/40 text-slate-200 text-xs font-semibold disabled:opacity-40 transition-colors"
                  >
                    🛣️ Droga Zwykła ({formatMoney(localRoadCost)})
                  </button>
                  <button
                    type="button"
                    onClick={() => onBuildRoad(plot.id, 'highway')}
                    disabled={currentPlayer.cash < highwayRoadCost}
                    className="w-full py-2 px-3 rounded-lg bg-[#1c1a10] hover:bg-[#2a2515] border border-amber-500/45 text-amber-200 text-xs font-semibold disabled:opacity-40 transition-colors"
                  >
                    🚧 Autostrada Płatna ({formatMoney(highwayRoadCost)} · 2.4× prędkość)
                  </button>
                </div>
              )}

              {plot.hasRoad && (
                <div className="p-3 rounded-lg bg-[#0b0f17] border border-amber-500/35 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300">
                      {plot.roadType === 'bridge' ? '🌉' : '🛣️'}{' '}
                      {plot.roadType === 'bridge'
                        ? 'Most Drogowy'
                        : plot.roadType === 'highway'
                          ? 'Autostrada Płatna'
                          : 'Droga Zwykła'}
                    </span>
                    <span className="font-mono text-emerald-400">
                      Myto zebrane: {formatMoney(plot.tollRevenueTotal ?? 0)}
                    </span>
                  </div>

                  {plot.roadType === 'local' && (
                    <button
                      type="button"
                      onClick={() => onBuildRoad(plot.id, 'highway')}
                      disabled={currentPlayer.cash < highwayRoadCost}
                      className="w-full py-1.5 px-3 rounded bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 border border-amber-400/50 text-amber-200 font-semibold"
                    >
                      ⬆️ Rozbuduj do Autostrady Płatnej ({formatMoney(highwayRoadCost)})
                    </button>
                  )}

                  <div>
                    <div className="text-[11px] text-slate-400 mb-1">
                      Stawka Myta (Opłaty dla rywali za przejazd):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {TOLL_OPTIONS.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => onSetRoadPolicy(plot.id, { tollRate: rate })}
                          className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                            plot.tollRate === rate
                              ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                              : 'bg-[#151c28] border-[#243044] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {TOLL_RATE_CONFIG[rate].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-1 border-t border-[#1e293b]">
                    <DarkToggle
                      checked={plot.roadBlocked}
                      onChange={(next) =>
                        onSetRoadPolicy(plot.id, { roadBlocked: next })
                      }
                      label="🚧 Blokada Tranzytu (Zamknij dla wszystkich rywali)"
                      sublabel="Odcięci rywale nie mogą przejechać ciężarówkami"
                    />
                  </div>

                  {onApplyHighwayPolicyToAll && (
                    <button
                      type="button"
                      onClick={() => onApplyHighwayPolicyToAll(plot.tollRate, plot.roadBlocked)}
                      className="w-full py-1.5 px-2.5 rounded bg-sky-600/20 hover:bg-sky-600/30 border border-sky-400/40 text-sky-200 text-[11px] font-semibold"
                    >
                      🌍 Zastosuj tę stawkę myta i blokadę do wszystkich moich dróg
                    </button>
                  )}

                  {rivals.length > 0 && !plot.roadBlocked && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 uppercase">
                        Blokada wybiórcza wybranych firm:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {rivals.map((rv) => {
                          const isBlocked = plot.blockedPlayers?.includes(rv.id);
                          return (
                            <button
                              key={rv.id}
                              type="button"
                              onClick={() =>
                                onSetRoadPolicy(plot.id, { toggleBlockedPlayerId: rv.id })
                              }
                              className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                                isBlocked
                                  ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                                  : 'bg-[#151c28] border-[#243044] text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {isBlocked ? '🚫' : '✓'} {rv.companyName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => onSellPlot(plot.id)}
                className="w-full py-2 px-4 rounded-lg bg-[#1c2434] hover:bg-rose-950/60 border border-[#334155] hover:border-rose-500/50 text-slate-300 hover:text-rose-300 text-xs font-medium transition-colors"
              >
                Sprzedaj Grunt ({formatMoney(Math.round(plot.price * 0.92))})
              </button>
            </>
          )}

          {owner && !isMine && (
            <div className="p-3 rounded-lg bg-[#0b0f17] border border-amber-500/35 space-y-2.5 text-xs">
              {plot.building && !buildingVisible && onRevealFogPlot && (
                <div className="p-2.5 rounded-lg bg-sky-950/35 border border-sky-500/40 space-y-1.5">
                  <div className="font-semibold text-sky-300">🌫️ Obiekt Nieznany (Mgła Wojny)</div>
                  <button
                    type="button"
                    disabled={currentPlayer.cash < 280_000 && currentPlayer.influence.military < 25}
                    onClick={() => onRevealFogPlot(plot.id)}
                    className="w-full py-1.5 px-2.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-semibold"
                  >
                    🕵️ Ujawnij Obiekt Wywiadem (280k zł lub 25 pkt mil.)
                  </button>
                </div>
              )}
              <div className="font-semibold text-amber-300">
                💰 Złóż Ofertę Wykupu Działki ({owner.companyName})
              </div>
              <div className="text-slate-400">
                Wycena rynkowa gruntu:{' '}
                <span className="font-mono text-slate-200 font-semibold">
                  {formatMoney(suggestedOffer)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[0.95, 1.15, 1.35].map((mult) => (
                  <button
                    key={mult}
                    type="button"
                    onClick={() => setOfferPrice(Math.round(suggestedOffer * mult))}
                    className="px-2 py-1 rounded bg-[#182235] hover:bg-[#223049] border border-[#2d3b52] text-[11px] font-mono text-slate-200"
                  >
                    {Math.round(mult * 100)}%
                  </button>
                ))}
              </div>
              <DarkNumberInput
                value={offerPrice}
                onChange={setOfferPrice}
                min={10000}
                step={5000}
              />
              <button
                type="button"
                disabled={currentPlayer.cash < offerPrice}
                onClick={() => onProposePlotOffer(plot.id, offerPrice, false)}
                className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-40 transition-colors"
              >
                Wyślij Ofertę Wykupu ({formatMoney(offerPrice)})
              </button>
              <div className="text-[11px] text-slate-400">
                Alternatywnie możesz użyć ustawy o Przymusowym Wykupie w panelu Wpływy.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);
