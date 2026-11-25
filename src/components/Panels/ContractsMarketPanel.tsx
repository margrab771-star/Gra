import React, { useState } from 'react';
import { RESOURCE_DEFINITIONS, TRADEABLE_RESOURCE_LIST } from '../../data/resources';
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
    isSelling: boolean,
    opts?: {
      kind?: 'recurring' | 'spot' | 'barter';
      barterResource?: ResourceType;
      barterQtyPerTick?: number;
      openListing?: boolean;
    }
  ) => void;
  onAccept: (contractId: string) => void;
  onCancel: (contractId: string) => void;
  onSubmitTender?: (tenderId: string) => void;
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
  onSubmitTender,
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
  const openTenders = (gameState.tenders ?? []).filter((t) => t.status === 'open');

  const [activeTab, setActiveTab] = useState<'b2b' | 'tenders' | 'plot_offers'>(
    incomingPlotOffers.length > 0 ? 'plot_offers' : 'b2b'
  );
  const [counterDrafts, setCounterDrafts] = useState<Record<string, number>>({});
  const [partnerId, setPartnerId] = useState(rivals[0]?.id ?? 'OPEN');
  const [kind, setKind] = useState<'recurring' | 'spot' | 'barter'>('recurring');
  const [resource, setResource] = useState<ResourceType>('steel');
  const [barterResource, setBarterResource] = useState<ResourceType>('coal');
  const [barterQty, setBarterQty] = useState(10);
  const [qty, setQty] = useState(8);
  const [price, setPrice] = useState(
    gameState.resourcePrices.find((r) => r.type === 'steel')?.price ?? 700
  );
  const [duration, setDuration] = useState(30);
  const [isSelling, setIsSelling] = useState(true);

  const myContracts = gameState.contracts.filter(
    (c) => c.sellerId === currentPlayer.id || c.buyerId === currentPlayer.id
  );
  const openListings = gameState.contracts.filter((c) => c.status === 'open_listing');
  const incomingProposals = myContracts.filter((c) => c.status === 'proposed');
  const activeContracts = myContracts.filter((c) => c.status === 'active');

  const isMpClosed = gameState.settings.mode === 'mp_fast' || gameState.settings.mode === 'mp_long';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-100">
              🤝 Giełda B2B, Przetargi Rządowe & Wykupy Działek
            </h2>
            <p className="text-xs text-slate-400">
              {isMpClosed
                ? 'Gospodarka zamknięta MP — surowce i półprodukty pozyskujesz wyłącznie z własnych zakładów lub kontraktów B2B'
                : 'Negocjuj stałe dostawy, szybki handel spot, barter, przetargi publiczne i wykupy gruntów'}
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
            🤝 Rynek B2B ({incomingProposals.length + activeContracts.length + openListings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tenders')}
            className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
              activeTab === 'tenders'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
            }`}
          >
            🏛️ Przetargi Rządowe ({openTenders.length})
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
            🏷️ Wykupy Działek ({incomingPlotOffers.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* ZAKŁADKA PRZETARGI RZĄDOWE */}
          {activeTab === 'tenders' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-[#0b0f17] border border-emerald-500/35 text-slate-300">
                Realizuj zamówienia państwowe z zapasów w swoim magazynie głównym lub buduj największe
                moce czystej energii OZE, aby zdobyć gotówkę, wpływy i poparcie wyborców.
              </div>
              {(gameState.tenders ?? []).length === 0 ? (
                <div className="p-8 rounded-lg bg-[#0b0f17] border border-[#243044] text-center text-slate-500">
                  Obecnie brak ogłoszonych przetargów rządowych. Pierwszy przetarg pojawi się wkrótce!
                </div>
              ) : (
                (gameState.tenders ?? []).map((t) => {
                  const myProg = t.deliveredByPlayer[currentPlayer.id] ?? {};
                  return (
                    <div
                      key={t.id}
                      className={`p-3.5 rounded-xl border space-y-2.5 ${
                        t.status === 'open'
                          ? 'bg-[#0b0f17] border-emerald-500/40'
                          : 'bg-[#0b0f17]/60 border-[#243044] opacity-75'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-slate-100">{t.title}</div>
                          <div className="text-slate-400 mt-0.5">{t.description}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                            t.status === 'open'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                              : t.status === 'awarded'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {t.status === 'open'
                            ? `OTWARTY · termin #${t.deadlineTick} (pozostało ${Math.max(0, t.deadlineTick - gameState.time.tick)}T)`
                            : t.status === 'awarded'
                              ? `WYGRAŁ: ${t.winnerName}`
                              : 'WYGASŁ'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="px-2 py-1 rounded bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 font-mono">
                          Nagroda: +{formatMoney(t.cashReward)}
                        </span>
                        <span className="px-2 py-1 rounded bg-purple-950/50 border border-purple-500/30 text-purple-300">
                          +{t.influenceReward} pkt wpływów
                        </span>
                        <span className="px-2 py-1 rounded bg-sky-950/50 border border-sky-500/30 text-sky-300">
                          +{t.voterMoodReward}% poparcia
                        </span>
                      </div>

                      {t.kind === 'resource_delivery' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {Object.entries(t.requirements).map(([rKey, reqQty]) => {
                            const r = rKey as ResourceType;
                            const rd = RESOURCE_DEFINITIONS[r];
                            const deliv = myProg[r] ?? 0;
                            const stock = currentPlayer.warehouseStockpile[r] ?? 0;
                            const pct = Math.min(100, Math.round((deliv / Math.max(1, reqQty ?? 1)) * 100));
                            return (
                              <div key={r} className="p-2 rounded bg-[#141c2b] border border-[#243044] space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-slate-200 font-medium">
                                    {rd.emoji} {rd.name}
                                  </span>
                                  <span className="font-mono text-amber-300">
                                    {deliv.toFixed(0)} / {reqQty} {rd.unit} (w magazynie: {stock.toFixed(1)})
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-[#090d14] rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {t.status === 'open' && t.kind === 'resource_delivery' && onSubmitTender && (
                        <button
                          type="button"
                          onClick={() => onSubmitTender(t.id)}
                          className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                          📦 Dostarcz Zapas z Magazynu Głównego
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ZAKŁADKA WYKUPY DZIAŁEK */}
          {activeTab === 'plot_offers' && (
            <div className="space-y-4">
              {incomingPlotOffers.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-amber-300 uppercase tracking-wide">
                    Oczekujące Propozycje Wykupu ({incomingPlotOffers.length})
                  </div>
                  {incomingPlotOffers.map((offer) => {
                    const currentVal = offer.counterPrice ?? offer.offeredPrice;
                    const draft = counterDrafts[offer.id] ?? Math.round(currentVal * 1.15);
                    return (
                      <div
                        key={offer.id}
                        className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-500/40 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-100 text-sm">
                              Działka ({offer.gridX}, {offer.gridY}) ·{' '}
                              {offer.includeBuilding ? 'Z budynkiem' : 'Sam grunt'}
                            </div>
                            <div className="text-slate-300">
                              Od: <strong>{offer.fromName}</strong> → Proponowana cena:{' '}
                              <strong className="font-mono text-amber-300">
                                {formatMoney(currentVal)}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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
                              🔄 Kontroferta
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

          {/* ZAKŁADKA B2B */}
          {activeTab === 'b2b' && (
            <>
              {/* Tablica Publicznych Ofert Otwartych */}
              {openListings.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-sky-300 uppercase tracking-wide">
                    📋 Tablica Otwartych Ofert Giełdowych ({openListings.length})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {openListings.map((c) => {
                      const rd = RESOURCE_DEFINITIONS[c.resource];
                      const ownerId = c.listingSide === 'sell' ? c.sellerId : c.buyerId;
                      const isMine = ownerId === currentPlayer.id;
                      const brd = c.barterResource ? RESOURCE_DEFINITIONS[c.barterResource] : null;
                      return (
                        <div
                          key={c.id}
                          className="p-3 rounded-lg bg-sky-950/20 border border-sky-500/40 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-slate-100">
                              {c.listingSide === 'sell' ? '📤 Sprzeda:' : '📥 Kupi:'} {rd.emoji} {rd.name} ({c.quantityPerTick} {rd.unit})
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Wystawca: {c.listingSide === 'sell' ? c.sellerName : c.buyerName} ·{' '}
                              {c.kind === 'barter' && brd
                                ? `Za ${c.barterQtyPerTick} ${brd.unit} ${brd.genitiveName}`
                                : `${formatMoney(c.pricePerUnit)}/j · ${c.kind === 'spot' ? 'Spot (1×)' : `${c.durationTicks}T`}`}
                            </div>
                          </div>
                          {isMine ? (
                            <button
                              type="button"
                              onClick={() => onCancel(c.id)}
                              className="px-2.5 py-1 rounded bg-rose-950/50 border border-rose-500/40 text-rose-300"
                            >
                              Wycofaj
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAccept(c.id)}
                              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                            >
                              Zawrzyj
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Oczekujące propozycje prywatne */}
              {incomingProposals.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-amber-300 uppercase tracking-wide">
                    Oczekujące Oferty Kontraktów ({incomingProposals.length})
                  </div>
                  {incomingProposals.map((c) => {
                    const rd = RESOURCE_DEFINITIONS[c.resource];
                    const brd = c.barterResource ? RESOURCE_DEFINITIONS[c.barterResource] : null;
                    return (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/40 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-semibold text-slate-100">
                            {rd.emoji} {rd.name} · {c.quantityPerTick} {rd.unit}{' '}
                            {c.kind === 'barter' && brd
                              ? `↔ ${c.barterQtyPerTick} ${brd.unit} ${brd.name} (Barter)`
                              : `po ${formatMoney(c.pricePerUnit)}`}
                          </div>
                          <div className="text-slate-400">
                            {c.sellerName} → {c.buyerName} ({c.kind === 'spot' ? 'Spot 1×' : `${c.durationTicks} cykli`})
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
              <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-100 text-sm">Kreator Kontraktu B2B</div>
                  <div className="flex gap-1.5">
                    {([
                      { k: 'recurring', l: '🔄 Stała Dostawa' },
                      { k: 'spot', l: '⚡ Spot (Jednorazowy)' },
                      { k: 'barter', l: '⚖️ Barter (Surowiec↔Surowiec)' },
                    ] as const).map((t) => (
                      <button
                        key={t.k}
                        type="button"
                        onClick={() => setKind(t.k)}
                        className={`px-2.5 py-1 rounded border text-[11px] font-semibold ${
                          kind === t.k
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                            : 'bg-[#151c28] border-[#243044] text-slate-400'
                        }`}
                      >
                        {t.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  <select
                    value={partnerId}
                    onChange={(e) => setPartnerId(e.target.value)}
                    className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-2 text-slate-100"
                  >
                    <option value="OPEN">📋 Tablica Otwarta (Wszyscy)</option>
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
                    {TRADEABLE_RESOURCE_LIST.map((rk) => {
                      const rd = RESOURCE_DEFINITIONS[rk];
                      return (
                        <option key={rd.type} value={rd.type}>
                          {rd.emoji} {rd.name}
                        </option>
                      );
                    })}
                  </select>
                  <DarkNumberInput value={qty} onChange={setQty} min={1} step={1} />
                  {kind === 'barter' ? (
                    <select
                      value={barterResource}
                      onChange={(e) => setBarterResource(e.target.value as ResourceType)}
                      className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-2 text-slate-100"
                    >
                      {TRADEABLE_RESOURCE_LIST.map((rk) => {
                        const rd = RESOURCE_DEFINITIONS[rk];
                        return (
                          <option key={rd.type} value={rd.type}>
                            Za: {rd.emoji} {rd.name}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <DarkNumberInput value={price} onChange={setPrice} min={10} step={10} />
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {kind === 'barter' ? (
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>Ilość wzajemna:</span>
                      <DarkNumberInput
                        value={barterQty}
                        onChange={setBarterQty}
                        min={1}
                        step={1}
                        className="w-28"
                      />
                    </div>
                  ) : kind === 'spot' ? (
                    <span className="text-slate-400">Natychmiastowa jednorazowa wymiana magazynowa</span>
                  ) : (
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
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      onPropose(partnerId, resource, qty, price, duration, isSelling, {
                        kind,
                        barterResource: kind === 'barter' ? barterResource : undefined,
                        barterQtyPerTick: kind === 'barter' ? barterQty : undefined,
                        openListing: partnerId === 'OPEN',
                      })
                    }
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    {partnerId === 'OPEN' ? '📢 Wystaw na Tablicę B2B' : 'Wyślij Propozycję B2B'}
                  </button>
                </div>
              </div>

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
                    const brd = c.barterResource ? RESOURCE_DEFINITIONS[c.barterResource] : null;
                    return (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-semibold text-slate-100">
                            {rd.emoji} {rd.name} · {c.quantityPerTick} {rd.unit}/T{' '}
                            {c.kind === 'barter' && brd
                              ? `↔ ${c.barterQtyPerTick} ${brd.unit} ${brd.name}`
                              : `× ${formatMoney(c.pricePerUnit)}`}
                          </div>
                          <div className="text-slate-400">
                            {c.sellerName} → {c.buyerName} · Wolumen: {formatMoney(c.totalValueDelivered)}
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
