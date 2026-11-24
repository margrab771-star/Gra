import React, { useState } from 'react';
import { RESOURCE_DEFINITIONS } from '../../data/resources';
import type { GameState, Player, ResourceType } from '../../engine/types';
import { formatMoney } from '../../utils/formatters';
import { DarkNumberInput } from '../HUD/DarkControls';

interface ContractsMarketPanelProps {
  gameState: GameState;
  currentPlayer: Player;
  onPropose: (
    partnerId: string,
    resource: ResourceType,
    qty: number,
    price: number,
    duration: number,
    isSelling: boolean
  ) => void;
  onAccept: (contractId: string) => void;
  onCancel: (contractId: string) => void;
  onRespondPlotOffer: (
    offerId: string,
    response: 'accept' | 'reject' | 'counter',
    counterPrice?: number
  ) => void;
  onClose: () => void;
}

export const ContractsMarketPanel: React.FC<ContractsMarketPanelProps> = ({
  gameState,
  currentPlayer,
  onPropose,
  onAccept,
  onCancel,
  onRespondPlotOffer,
  onClose,
}) => {
  const rivals = gameState.players.filter((p) => p.id !== currentPlayer.id && !p.isEliminated);
  const incomingPlotOffers = gameState.plotOffers.filter(
    (o) =>
      o.toPlayerId === currentPlayer.id &&
      (o.status === 'pending' || o.status === 'countered')
  );
  const relatedPlotOffers = gameState.plotOffers.filter(
    (o) => o.fromPlayerId === currentPlayer.id || o.toPlayerId === currentPlayer.id
  );

  const [activeTab, setActiveTab] = useState<'b2b' | 'plot_offers'>(
    incomingPlotOffers.length > 0 ? 'plot_offers' : 'b2b'
  );
  const [counterDrafts, setCounterDrafts] = useState<Record<string, number>>({});
  const [partnerId, setPartnerId] = useState(rivals[0]?.id ?? '');
  const [resource, setResource] = useState<ResourceType>('steel');
  const [qty, setQty] = useState(8);
  const [price, setPrice] = useState(
    gameState.resourcePrices.find((r) => r.type === 'steel')?.price ?? 700
  );
  const [duration, setDuration] = useState(30);
  const [isSelling, setIsSelling] = useState(true);

  const myContracts = gameState.contracts.filter(
    (c) => c.sellerId === currentPlayer.id || c.buyerId === currentPlayer.id
  );
  const incomingProposals = myContracts.filter((c) => c.status === 'proposed');
  const activeContracts = myContracts.filter((c) => c.status === 'active');

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-100">
              🤝 Giełda Kontraktów B2B & Wykupy Działek
            </h2>
            <p className="text-xs text-slate-400">
              Negocjuj dostawy B2B oraz oferty wykupu gruntów i zakładów z graczami i AI
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1c2434] text-slate-300 hover:text-white flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-2 border-b border-[#243044] flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('b2b')}
            className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
              activeTab === 'b2b'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
            }`}
          >
            🤝 Kontrakty B2B ({incomingProposals.length + activeContracts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('plot_offers')}
            className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
              activeTab === 'plot_offers'
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
            }`}
          >
            🏞️ Oferty Wykupu Działek ({incomingPlotOffers.length > 0 ? `${incomingPlotOffers.length} nowe` : relatedPlotOffers.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {activeTab === 'plot_offers' && (
            <div className="space-y-4">
              {incomingPlotOffers.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-amber-300 uppercase tracking-wide">
                    Oczekujące Na Twoją Decyzję ({incomingPlotOffers.length})
                  </div>
                  {incomingPlotOffers.map((offer) => {
                    const activeAmount = offer.counterPrice ?? offer.offeredPrice;
                    const draft =
                      counterDrafts[offer.id] ?? Math.round(activeAmount * 1.15);
                    return (
                      <div
                        key={offer.id}
                        className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-500/40 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-100 text-sm">
                              Działka ({offer.gridX}, {offer.gridY}){' '}
                              {offer.includeBuilding ? 'z budynkiem' : '(sam grunt)'}
                            </div>
                            <div className="text-slate-400">
                              Oferent: <span className="text-slate-200 font-medium">{offer.fromName}</span>{' '}
                              · Status:{' '}
                              <span className="text-amber-300">
                                {offer.status === 'countered' ? 'Kontroferta' : 'Nowa oferta'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <div className="text-[11px] text-slate-400">Proponowana kwota</div>
                            <div className="text-base font-bold text-amber-300">
                              {formatMoney(activeAmount)}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#243044]">
                          <div className="flex items-center gap-1.5">
                            <DarkNumberInput
                              value={draft}
                              onChange={(val) =>
                                setCounterDrafts((prev) => ({
                                  ...prev,
                                  [offer.id]: Math.max(10000, val),
                                }))
                              }
                              min={10000}
                              step={10000}
                              className="w-36"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                onRespondPlotOffer(offer.id, 'counter', draft)
                              }
                              className="px-3 py-1.5 rounded bg-sky-600/30 hover:bg-sky-600/50 border border-sky-400/40 text-sky-200 font-semibold"
                            >
                              🔄 Złóż kontrofertę
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => onRespondPlotOffer(offer.id, 'accept')}
                              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                            >
                              ✅ Akceptuj
                            </button>
                            <button
                              type="button"
                              onClick={() => onRespondPlotOffer(offer.id, 'reject')}
                              className="px-3 py-1.5 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-200"
                            >
                              ❌ Odrzuć
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                <div className="font-semibold text-slate-300 uppercase tracking-wide">
                  Wszystkie Negocjacje Nieruchomości ({relatedPlotOffers.length})
                </div>
                {relatedPlotOffers.length === 0 ? (
                  <div className="p-6 rounded-lg bg-[#0b0f17] border border-[#243044] text-center text-slate-500">
                    Brak aktywnych ofert wykupu działek. Kliknij działkę rywala na mapie, aby złożyć propozycję wykupu!
                  </div>
                ) : (
                  relatedPlotOffers.map((o) => (
                    <div
                      key={o.id}
                      className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-semibold text-slate-100">
                          Sektor ({o.gridX}, {o.gridY}) · {o.includeBuilding ? 'Grunt + Budynek' : 'Sam Grunt'}
                        </div>
                        <div className="text-slate-400">
                          {o.fromName} → {o.toName}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-amber-300 font-bold">
                          {formatMoney(o.counterPrice ?? o.offeredPrice)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {o.status === 'accepted'
                            ? '✅ Zaakceptowano'
                            : o.status === 'rejected'
                              ? '❌ Odrzucono'
                              : o.status === 'countered'
                                ? '🔄 Kontroferta'
                                : '⏳ Oczekuje'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'b2b' && (
            <>
          {/* Oczekujące propozycje */}
          {incomingProposals.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-amber-300 uppercase tracking-wide">
                Oczekujące Oferty Kontraktów ({incomingProposals.length})
              </div>
              {incomingProposals.map((c) => {
                const rd = RESOURCE_DEFINITIONS[c.resource];
                return (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/40 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-slate-100">
                        {rd.emoji} {rd.name} · {c.quantityPerTick} {rd.unit}/cykl po {formatMoney(c.pricePerUnit)}
                      </div>
                      <div className="text-slate-400">
                        Sprzedawca: {c.sellerName} → Kupujący: {c.buyerName} ({c.durationTicks} cykli)
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onAccept(c.id)}
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                      >
                        Akceptuj
                      </button>
                      <button
                        type="button"
                        onClick={() => onCancel(c.id)}
                        className="px-3 py-1.5 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-200"
                      >
                        Odrzuć
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Kreator nowego kontraktu */}
          {rivals.length > 0 && (
            <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-3">
              <div className="font-semibold text-slate-100 text-sm">Złóż Nową Ofertę Kontraktu B2B</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <select
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-2 text-slate-100"
                >
                  {rivals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.companyName}
                    </option>
                  ))}
                </select>
                <select
                  value={isSelling ? 'sell' : 'buy'}
                  onChange={(e) => setIsSelling(e.target.value === 'sell')}
                  className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-2 text-slate-100"
                >
                  <option value="sell">Dostarczam (Sprzedaż)</option>
                  <option value="buy">Zamawiam (Zakup)</option>
                </select>
                <select
                  value={resource}
                  onChange={(e) => {
                    const r = e.target.value as ResourceType;
                    setResource(r);
                    setPrice(gameState.resourcePrices.find((p) => p.type === r)?.price ?? 200);
                  }}
                  className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-2 text-slate-100"
                >
                  {Object.values(RESOURCE_DEFINITIONS).map((rd) => (
                    <option key={rd.type} value={rd.type}>
                      {rd.emoji} {rd.name}
                    </option>
                  ))}
                </select>
                <DarkNumberInput
                  value={qty}
                  onChange={setQty}
                  min={1}
                  step={1}
                />
                <DarkNumberInput
                  value={price}
                  onChange={setPrice}
                  min={10}
                  step={10}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-400">
                  <span>Czas trwania:</span>
                  <DarkNumberInput
                    value={duration}
                    onChange={setDuration}
                    min={5}
                    max={150}
                    step={5}
                    className="w-28"
                  />
                  <span>cykli</span>
                </div>
                <button
                  type="button"
                  onClick={() => onPropose(partnerId, resource, qty, price, duration, isSelling)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Wyślij Propozycję B2B
                </button>
              </div>
            </div>
          )}

          {/* Aktywne kontrakty */}
          <div className="space-y-2">
            <div className="font-semibold text-slate-300 uppercase tracking-wide">
              Aktywne Umowy B2B ({activeContracts.length})
            </div>
            {activeContracts.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#0b0f17] border border-[#243044] text-center text-slate-500">
                Brak aktywnych kontraktów.
              </div>
            ) : (
              activeContracts.map((c) => {
                const rd = RESOURCE_DEFINITIONS[c.resource];
                return (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-slate-100">
                        {rd.emoji} {rd.name} · {c.quantityPerTick} {rd.unit}/T × {formatMoney(c.pricePerUnit)}
                      </div>
                      <div className="text-slate-400">
                        {c.sellerName} → {c.buyerName} · Dostarczono: {formatMoney(c.totalValueDelivered)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sky-300">{c.remainingTicks} cykli</span>
                      <button
                        type="button"
                        onClick={() => onCancel(c.id)}
                        className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300"
                      >
                        Zerwij
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
