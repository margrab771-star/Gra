import React, { useState } from 'react';
import { RESOURCE_DEFINITIONS, TRADEABLE_RESOURCE_LIST } from '../../data/resources';
import type { GameState, Player, ResourceType } from '../../engine/types';
import {
  localizeResourceName,
  localizeResourceUnit,
  localizeTender,
} from '../../i18n/dataTranslations';
import { useI18n } from '../../i18n/useI18n';
import { formatCompactMoney, formatMoney } from '../../utils/formatters';
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
  onReject: (contractId: string) => void;
  onCancel: (contractId: string) => void;
  onTransferCash: (recipientId: string, amount: number, note?: string) => void;
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
  onReject,
  onCancel,
  onTransferCash,
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

  const myContracts = gameState.contracts.filter(
    (c) => c.sellerId === currentPlayer.id || c.buyerId === currentPlayer.id
  );
  const openListings = gameState.contracts.filter((c) => c.status === 'open_listing');
  const incomingPending = myContracts.filter(
    (c) =>
      (c.status === 'pending' || c.status === 'proposed') &&
      (c.responderId
        ? c.responderId === currentPlayer.id
        : c.proposerId !== currentPlayer.id)
  );
  const outgoingPending = myContracts.filter(
    (c) =>
      (c.status === 'pending' || c.status === 'proposed') &&
      c.proposerId === currentPlayer.id
  );
  const activeContracts = myContracts.filter((c) => c.status === 'active');
  const recentClosedContracts = myContracts
    .filter((c) => c.status === 'rejected' || c.status === 'cancelled' || c.status === 'completed')
    .slice(-6)
    .reverse();

  const [activeTab, setActiveTab] = useState<'b2b' | 'pending_b2b' | 'tenders' | 'plot_offers'>(
    incomingPending.length > 0 ? 'pending_b2b' : incomingPlotOffers.length > 0 ? 'plot_offers' : 'b2b'
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

  const [transferRecipientId, setTransferRecipientId] = useState(rivals[0]?.id ?? '');
  const [transferAmount, setTransferAmount] = useState(100_000);
  const [transferNote, setTransferNote] = useState('');

  const myTransfers = (gameState.cashTransfers ?? [])
    .filter((t) => t.fromPlayerId === currentPlayer.id || t.toPlayerId === currentPlayer.id)
    .slice(-10)
    .reverse();

  const { lang } = useI18n();
  const isMpClosed = gameState.settings.mode === 'mp_fast' || gameState.settings.mode === 'mp_long';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-100">
              {lang === 'en'
                ? '🤝 B2B Exchange, State Tenders & Plot Buyouts'
                : '🤝 Giełda B2B, Przetargi Rządowe & Wykupy Działek'}
            </h2>
            <p className="text-xs text-slate-400">
              {isMpClosed
                ? lang === 'en'
                  ? 'Closed MP economy — obtain resources strictly from your own mines or B2B contracts'
                  : 'Gospodarka zamknięta MP — surowce i półprodukty pozyskujesz wyłącznie z własnych zakładów lub kontraktów B2B'
                : lang === 'en'
                  ? 'Negotiate recurring supply deals, instant spot trades, barter, state tenders & land buyouts'
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
            {lang === 'en' ? '🤝 B2B Market' : '🤝 Rynek B2B'} ({activeContracts.length + openListings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending_b2b')}
            className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
              activeTab === 'pending_b2b'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : incomingPending.length > 0
                  ? 'bg-amber-950/35 border-amber-400/60 text-amber-200 animate-pulse'
                  : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
            }`}
          >
            {lang === 'en' ? '⏳ Pending B2B Offers' : '⏳ Oczekujące Oferty B2B'} ({incomingPending.length}
            {outgoingPending.length > 0
              ? ` / ${outgoingPending.length} ${lang === 'en' ? 'sent' : 'wysł.'}`
              : ''}
            )
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
            {lang === 'en' ? '🏛️ State Tenders' : '🏛️ Przetargi Rządowe'} ({openTenders.length})
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
            {lang === 'en' ? '🏷️ Plot Buyouts' : '🏷️ Wykupy Działek'} ({incomingPlotOffers.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* ZAKŁADKA PRZETARGI RZĄDOWE */}
          {activeTab === 'tenders' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-[#0b0f17] border border-emerald-500/35 text-slate-300">
                {lang === 'en'
                  ? 'Fulfill state procurement orders from your main warehouse reserves or deploy clean renewable capacity to earn cash, influence, and voter approval.'
                  : 'Realizuj zamówienia państwowe z zapasów w swoim magazynie głównym lub buduj największe moce czystej energii OZE, aby zdobyć gotówkę, wpływy i poparcie wyborców.'}
              </div>
              {(gameState.tenders ?? []).length === 0 ? (
                <div className="p-8 rounded-lg bg-[#0b0f17] border border-[#243044] text-center text-slate-500">
                  {lang === 'en'
                    ? 'No active government tenders yet. The first contract will open shortly!'
                    : 'Obecnie brak ogłoszonych przetargów rządowych. Pierwszy przetarg pojawi się wkrótce!'}
                </div>
              ) : (
                (gameState.tenders ?? []).map((rawTender) => {
                  const ten = localizeTender(rawTender, lang);
                  const myProg = ten.deliveredByPlayer[currentPlayer.id] ?? {};
                  return (
                    <div
                      key={ten.id}
                      className={`p-3.5 rounded-xl border space-y-2.5 ${
                        ten.status === 'open'
                          ? 'bg-[#0b0f17] border-emerald-500/40'
                          : 'bg-[#0b0f17]/60 border-[#243044] opacity-75'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-slate-100">{ten.title}</div>
                          <div className="text-slate-400 mt-0.5">{ten.description}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                            ten.status === 'open'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                              : ten.status === 'awarded'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {ten.status === 'open'
                            ? lang === 'en'
                              ? `OPEN · due #${ten.deadlineTick} (${Math.max(0, ten.deadlineTick - gameState.time.tick)}T left)`
                              : `OTWARTY · termin #${ten.deadlineTick} (pozostało ${Math.max(0, ten.deadlineTick - gameState.time.tick)}T)`
                            : ten.status === 'awarded'
                              ? `${lang === 'en' ? 'AWARDED:' : 'WYGRAŁ:'} ${ten.winnerName}`
                              : lang === 'en'
                                ? 'EXPIRED'
                                : 'WYGASŁ'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="px-2 py-1 rounded bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 font-mono">
                          {lang === 'en' ? 'Reward:' : 'Nagroda:'} +{formatMoney(ten.cashReward)}
                        </span>
                        <span className="px-2 py-1 rounded bg-purple-950/50 border border-purple-500/30 text-purple-300">
                          +{ten.influenceReward} {lang === 'en' ? 'influence pts' : 'pkt wpływów'}
                        </span>
                        <span className="px-2 py-1 rounded bg-sky-950/50 border border-sky-500/30 text-sky-300">
                          +{ten.voterMoodReward}% {lang === 'en' ? 'approval' : 'poparcia'}
                        </span>
                      </div>

                      {ten.kind === 'resource_delivery' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {Object.entries(ten.requirements).map(([rKey, reqQty]) => {
                            const r = rKey as ResourceType;
                            const rd = RESOURCE_DEFINITIONS[r];
                            const rName = localizeResourceName(r, rd.name, lang);
                            const rUnit = localizeResourceUnit(rd.unit, lang);
                            const deliv = myProg[r] ?? 0;
                            const stock = currentPlayer.warehouseStockpile[r] ?? 0;
                            const pct = Math.min(100, Math.round((deliv / Math.max(1, reqQty ?? 1)) * 100));
                            return (
                              <div key={r} className="p-2 rounded bg-[#141c2b] border border-[#243044] space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-slate-200 font-medium">
                                    {rd.emoji} {rName}
                                  </span>
                                  <span className="font-mono text-amber-300">
                                    {deliv.toFixed(0)} / {reqQty} {rUnit} ({lang === 'en' ? 'in stock:' : 'w magazynie:'} {stock.toFixed(1)})
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

                      {ten.status === 'open' && ten.kind === 'resource_delivery' && onSubmitTender && (
                        <button
                          type="button"
                          onClick={() => onSubmitTender(ten.id)}
                          className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                          {lang === 'en'
                            ? '📦 Deliver Stock from Main Warehouse'
                            : '📦 Dostarcz Zapas z Magazynu Głównego'}
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
                    {lang === 'en' ? 'Incoming Buyout Proposals' : 'Oczekujące Propozycje Wykupu'} ({incomingPlotOffers.length})
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
                              {lang === 'en' ? 'Plot' : 'Działka'} ({offer.gridX}, {offer.gridY}) ·{' '}
                              {offer.includeBuilding
                                ? lang === 'en'
                                  ? 'With building'
                                  : 'Z budynkiem'
                                : lang === 'en'
                                  ? 'Land only'
                                  : 'Sam grunt'}
                            </div>
                            <div className="text-slate-300">
                              {lang === 'en' ? 'From:' : 'Od:'} <strong>{offer.fromName}</strong> →{' '}
                              {lang === 'en' ? 'Offered price:' : 'Proponowana cena:'}{' '}
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
                              {lang === 'en' ? '🔄 Counter-offer' : '🔄 Kontroferta'}
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => onRespondPlotOffer(offer.id, 'accept')}
                              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                            >
                              {lang === 'en' ? '✅ Accept' : '✅ Akceptuj'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onRespondPlotOffer(offer.id, 'reject')}
                              className="px-3 py-1.5 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-200"
                            >
                              {lang === 'en' ? '❌ Reject' : '❌ Odrzuć'}
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
                  {lang === 'en' ? 'All Real Estate Negotiations' : 'Wszystkie Negocjacje Nieruchomości'} ({relatedPlotOffers.length})
                </div>
                {relatedPlotOffers.length === 0 ? (
                  <div className="p-6 rounded-lg bg-[#0b0f17] border border-[#243044] text-center text-slate-500">
                    {lang === 'en'
                      ? 'No active plot buyout offers. Click a rival plot on the map to propose a purchase!'
                      : 'Brak aktywnych ofert wykupu działek. Kliknij działkę rywala na mapie, aby złożyć propozycję wykupu!'}
                  </div>
                ) : (
                  relatedPlotOffers.map((o) => (
                    <div
                      key={o.id}
                      className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-semibold text-slate-100">
                          {lang === 'en' ? 'Sector' : 'Sektor'} ({o.gridX}, {o.gridY}) ·{' '}
                          {o.includeBuilding
                            ? lang === 'en'
                              ? 'Land + Building'
                              : 'Grunt + Budynek'
                            : lang === 'en'
                              ? 'Land Only'
                              : 'Sam Grunt'}
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
                            ? lang === 'en'
                              ? '✅ Accepted'
                              : '✅ Zaakceptowano'
                            : o.status === 'rejected'
                              ? lang === 'en'
                                ? '❌ Rejected'
                                : '❌ Odrzucono'
                              : o.status === 'countered'
                                ? lang === 'en'
                                  ? '🔄 Countered'
                                  : '🔄 Kontroferta'
                                : lang === 'en'
                                  ? '⏳ Pending'
                                  : '⏳ Oczekuje'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ZAKŁADKA OCZEKUJĄCE OFERTY B2B */}
          {activeTab === 'pending_b2b' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="font-semibold text-amber-300 uppercase tracking-wide">
                  {lang === 'en'
                    ? 'Received Contract Offers Awaiting Approval'
                    : 'Odebrane Oferty Kontraktów do Zatwierdzenia'}{' '}
                  ({incomingPending.length})
                </div>
                {incomingPending.length === 0 ? (
                  <div className="p-5 rounded-lg bg-[#0b0f17] border border-[#243044] text-center text-slate-500">
                    {lang === 'en'
                      ? 'No incoming B2B offers awaiting your decision.'
                      : 'Brak przychodzących ofert B2B oczekujących na Twoją decyzję.'}
                  </div>
                ) : (
                  incomingPending.map((c) => {
                    const rd = RESOURCE_DEFINITIONS[c.resource];
                    const rName = localizeResourceName(c.resource, rd.name, lang);
                    const rUnit = localizeResourceUnit(rd.unit, lang);
                    const brd = c.barterResource ? RESOURCE_DEFINITIONS[c.barterResource] : null;
                    const brName =
                      c.barterResource && brd ? localizeResourceName(c.barterResource, brd.name, lang) : '';
                    const brUnit = brd ? localizeResourceUnit(brd.unit, lang) : '';
                    const senderName = c.proposerId === c.sellerId ? c.sellerName : c.buyerName;
                    const roleText =
                      c.buyerId === currentPlayer.id
                        ? lang === 'en'
                          ? '📥 Buying commodity'
                          : '📥 Kupujesz surowiec'
                        : lang === 'en'
                          ? '📤 Selling commodity'
                          : '📤 Sprzedajesz surowiec';
                    const estTotal =
                      c.kind === 'barter'
                        ? null
                        : c.quantityPerTick * c.pricePerUnit * (c.kind === 'spot' ? 1 : c.durationTicks);
                    return (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-500/45 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-100 text-sm">
                            {rd.emoji} {rName} · {c.quantityPerTick} {rUnit}
                            {c.kind === 'spot' ? ' (Spot 1×)' : '/T'} ·{' '}
                            {c.kind === 'barter' && brd
                              ? `↔ ${c.barterQtyPerTick} ${brUnit} ${brName} (Barter)`
                              : `${formatMoney(c.pricePerUnit)}/${lang === 'en' ? 'u' : 'j'}`}
                          </div>
                          <div className="text-slate-300 flex flex-wrap items-center gap-2">
                            <span>
                              {lang === 'en' ? 'From:' : 'Od:'}{' '}
                              <strong className="text-amber-200">{senderName}</strong>
                            </span>
                            <span>·</span>
                            <span>{roleText}</span>
                            <span>·</span>
                            <span>
                              {lang === 'en' ? 'Term:' : 'Czas:'}{' '}
                              <strong>
                                {c.kind === 'spot'
                                  ? lang === 'en'
                                    ? 'One-off (Spot)'
                                    : 'Jednorazowo (Spot)'
                                  : `${c.durationTicks} ${lang === 'en' ? 'ticks' : 'cykli'}`}
                              </strong>
                            </span>
                            {estTotal !== null && (
                              <>
                                <span>·</span>
                                <span className="font-mono text-emerald-300">
                                  {lang === 'en' ? 'Total:' : 'Łącznie:'} {formatMoney(estTotal)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onAccept(c.id)}
                            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          >
                            {lang === 'en' ? '✓ Approve Deal' : '✓ Zatwierdź Umowę'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onReject(c.id)}
                            className="px-3.5 py-2 rounded-lg bg-rose-600/35 hover:bg-rose-600/55 border border-rose-500/45 text-rose-200 font-semibold"
                          >
                            {lang === 'en' ? '✕ Reject' : '✕ Odrzuć'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-sky-300 uppercase tracking-wide">
                  {lang === 'en' ? 'Sent Offers Awaiting Partner' : 'Wysłane Oferty Oczekujące na Partnera'} ({outgoingPending.length})
                </div>
                {outgoingPending.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#0b0f17] border border-[#243044] text-center text-slate-500">
                    {lang === 'en'
                      ? 'You have no outbound offers waiting for a reply.'
                      : 'Nie masz aktualnie wysłanych ofert czekających na odpowiedź.'}
                  </div>
                ) : (
                  outgoingPending.map((c) => {
                    const rd = RESOURCE_DEFINITIONS[c.resource];
                    const rName = localizeResourceName(c.resource, rd.name, lang);
                    const rUnit = localizeResourceUnit(rd.unit, lang);
                    const brd = c.barterResource ? RESOURCE_DEFINITIONS[c.barterResource] : null;
                    const brName =
                      c.barterResource && brd ? localizeResourceName(c.barterResource, brd.name, lang) : '';
                    const brUnit = brd ? localizeResourceUnit(brd.unit, lang) : '';
                    const recipientName = c.proposerId === c.sellerId ? c.buyerName : c.sellerName;
                    return (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg bg-[#0b0f17] border border-sky-500/35 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-semibold text-slate-100">
                            {rd.emoji} {rName} · {c.quantityPerTick} {rUnit}{' '}
                            {c.kind === 'barter' && brd
                              ? `↔ ${c.barterQtyPerTick} ${brUnit} ${brName}`
                              : `@ ${formatMoney(c.pricePerUnit)}/${lang === 'en' ? 'u' : 'j'}`}
                          </div>
                          <div className="text-slate-400">
                            {lang === 'en' ? 'Recipient:' : 'Odbiorca:'}{' '}
                            <strong className="text-slate-200">{recipientName}</strong> ·{' '}
                            {c.kind === 'spot'
                              ? 'Spot 1×'
                              : `${c.durationTicks} ${lang === 'en' ? 'ticks' : 'cykli'}`}{' '}
                            ·{' '}
                            <span className="text-amber-300">
                              {lang === 'en' ? '⏳ Waiting for acceptance' : '⏳ Oczekuje na akceptację'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onCancel(c.id)}
                          className="px-3 py-1.5 rounded bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 font-semibold"
                        >
                          {lang === 'en' ? 'Cancel Offer' : 'Anuluj Ofertę'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {recentClosedContracts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-400 uppercase tracking-wide">
                    {lang === 'en'
                      ? 'Rejected & Completed History'
                      : 'Historia Odrzuconych i Zakończonych'}{' '}
                    ({recentClosedContracts.length})
                  </div>
                  {recentClosedContracts.map((c) => {
                    const rd = RESOURCE_DEFINITIONS[c.resource];
                    return (
                      <div
                        key={c.id}
                        className="px-3 py-2 rounded bg-[#0b0f17]/70 border border-[#243044] flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="text-slate-300">
                          {rd.emoji} {localizeResourceName(c.resource, rd.name, lang)} · {c.sellerName} →{' '}
                          {c.buyerName} ({c.quantityPerTick}/T)
                        </span>
                        <span
                          className={`font-semibold ${
                            c.status === 'completed'
                              ? 'text-emerald-400'
                              : c.status === 'rejected'
                                ? 'text-rose-400'
                                : 'text-slate-400'
                          }`}
                        >
                          {c.status === 'completed'
                            ? lang === 'en'
                              ? '✓ Fulfilled'
                              : '✓ Zrealizowany'
                            : c.status === 'rejected'
                              ? lang === 'en'
                                ? '✕ Rejected'
                                : '✕ Odrzucony'
                              : lang === 'en'
                                ? 'Cancelled'
                                : 'Anulowany'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ZAKŁADKA B2B */}
          {activeTab === 'b2b' && (
            <>
              {incomingPending.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('pending_b2b')}
                  className="w-full p-2.5 rounded-lg bg-amber-950/35 hover:bg-amber-950/55 border border-amber-400/60 text-amber-200 font-semibold flex items-center justify-between"
                >
                  <span>
                    {lang === 'en'
                      ? `⏳ You have ${incomingPending.length} pending B2B offers to approve or reject`
                      : `⏳ Masz ${incomingPending.length} oczekujące oferty B2B do zatwierdzenia lub odrzucenia`}
                  </span>
                  <span className="text-amber-300 underline">
                    {lang === 'en' ? 'Open Pending Offers →' : 'Otwórz Oczekujące Oferty →'}
                  </span>
                </button>
              )}

              {/* Tablica Publicznych Ofert Otwartych */}
              {openListings.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-sky-300 uppercase tracking-wide">
                    {lang === 'en'
                      ? '📋 Public Open Exchange Board'
                      : '📋 Tablica Otwartych Ofert Giełdowych'}{' '}
                    ({openListings.length})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {openListings.map((c) => {
                      const rd = RESOURCE_DEFINITIONS[c.resource];
                      const rName = localizeResourceName(c.resource, rd.name, lang);
                      const rUnit = localizeResourceUnit(rd.unit, lang);
                      const ownerId = c.listingSide === 'sell' ? c.sellerId : c.buyerId;
                      const isMine = ownerId === currentPlayer.id;
                      const brd = c.barterResource ? RESOURCE_DEFINITIONS[c.barterResource] : null;
                      const brName =
                        c.barterResource && brd ? localizeResourceName(c.barterResource, brd.name, lang) : '';
                      const brUnit = brd ? localizeResourceUnit(brd.unit, lang) : '';
                      return (
                        <div
                          key={c.id}
                          className="p-3 rounded-lg bg-sky-950/20 border border-sky-500/40 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-slate-100">
                              {c.listingSide === 'sell'
                                ? lang === 'en'
                                  ? '📤 Selling:'
                                  : '📤 Sprzeda:'
                                : lang === 'en'
                                  ? '📥 Buying:'
                                  : '📥 Kupi:'}{' '}
                              {rd.emoji} {rName} ({c.quantityPerTick} {rUnit})
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {lang === 'en' ? 'Listed by:' : 'Wystawca:'}{' '}
                              {c.listingSide === 'sell' ? c.sellerName : c.buyerName} ·{' '}
                              {c.kind === 'barter' && brd
                                ? lang === 'en'
                                  ? `For ${c.barterQtyPerTick} ${brUnit} ${brName}`
                                  : `Za ${c.barterQtyPerTick} ${brd.unit} ${brd.genitiveName}`
                                : `${formatMoney(c.pricePerUnit)}/${lang === 'en' ? 'u' : 'j'} · ${
                                    c.kind === 'spot' ? 'Spot (1×)' : `${c.durationTicks}T`
                                  }`}
                            </div>
                          </div>
                          {isMine ? (
                            <button
                              type="button"
                              onClick={() => onCancel(c.id)}
                              className="px-2.5 py-1 rounded bg-rose-950/50 border border-rose-500/40 text-rose-300"
                            >
                              {lang === 'en' ? 'Withdraw' : 'Wycofaj'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAccept(c.id)}
                              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                            >
                              {lang === 'en' ? 'Accept Deal' : 'Zawrzyj'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Kreator nowego kontraktu */}
              <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-100 text-sm">
                    {lang === 'en' ? 'B2B Contract Builder' : 'Kreator Kontraktu B2B'}
                  </div>
                  <div className="flex gap-1.5">
                    {(
                      [
                        { k: 'recurring', l: lang === 'en' ? '🔄 Recurring Supply' : '🔄 Stała Dostawa' },
                        { k: 'spot', l: lang === 'en' ? '⚡ Spot (One-off)' : '⚡ Spot (Jednorazowy)' },
                        { k: 'barter', l: lang === 'en' ? '⚖️ Barter (Good↔Good)' : '⚖️ Barter (Surowiec↔Surowiec)' },
                      ] as const
                    ).map((tabKind) => (
                      <button
                        key={tabKind.k}
                        type="button"
                        onClick={() => setKind(tabKind.k)}
                        className={`px-2.5 py-1 rounded border text-[11px] font-semibold ${
                          kind === tabKind.k
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                            : 'bg-[#151c28] border-[#243044] text-slate-400'
                        }`}
                      >
                        {tabKind.l}
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
                    <option value="OPEN">
                      {lang === 'en' ? '📋 Open Board (Everyone)' : '📋 Tablica Otwarta (Wszyscy)'}
                    </option>
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
                    <option value="sell">
                      {lang === 'en' ? 'Delivering (Sell)' : 'Dostarczam (Sprzedaż)'}
                    </option>
                    <option value="buy">
                      {lang === 'en' ? 'Ordering (Buy)' : 'Zamawiam (Zakup)'}
                    </option>
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
                          {rd.emoji} {localizeResourceName(rd.type, rd.name, lang)}
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
                            {lang === 'en' ? 'For:' : 'Za:'} {rd.emoji}{' '}
                            {localizeResourceName(rd.type, rd.name, lang)}
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
                      <span>{lang === 'en' ? 'Barter quantity:' : 'Ilość wzajemna:'}</span>
                      <DarkNumberInput
                        value={barterQty}
                        onChange={setBarterQty}
                        min={1}
                        step={1}
                        className="w-28"
                      />
                    </div>
                  ) : kind === 'spot' ? (
                    <span className="text-slate-400">
                      {lang === 'en'
                        ? 'Instant one-off warehouse settlement'
                        : 'Natychmiastowa jednorazowa wymiana magazynowa'}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>{lang === 'en' ? 'Duration:' : 'Czas trwania:'}</span>
                      <DarkNumberInput
                        value={duration}
                        onChange={setDuration}
                        min={5}
                        max={150}
                        step={5}
                        className="w-28"
                      />
                      <span>{lang === 'en' ? 'ticks' : 'cykli'}</span>
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
                    {partnerId === 'OPEN'
                      ? lang === 'en'
                        ? '📢 Post on B2B Board'
                        : '📢 Wystaw na Tablicę B2B'
                      : lang === 'en'
                        ? '📤 Send Offer for Approval'
                        : '📤 Wyślij Ofertę do Akceptacji'}
                  </button>
                </div>
              </div>

              {/* Przelew Gotówki B2B między graczami */}
              {rivals.length > 0 && (
                <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-emerald-500/35 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-emerald-300 text-sm">
                      {lang === 'en' ? '💸 B2B Wire Transfer' : '💸 Przelew Gotówki B2B'}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {lang === 'en' ? 'Available funds:' : 'Dostępne środki:'} {formatMoney(currentPlayer.cash)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={transferRecipientId}
                      onChange={(e) => setTransferRecipientId(e.target.value)}
                      className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-2 text-slate-100"
                    >
                      {rivals.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.companyName}
                        </option>
                      ))}
                    </select>
                    <DarkNumberInput
                      value={transferAmount}
                      onChange={(val) => setTransferAmount(Math.max(0, val))}
                      min={1}
                      step={25_000}
                    />
                    <input
                      type="text"
                      value={transferNote}
                      onChange={(e) => setTransferNote(e.target.value)}
                      maxLength={64}
                      placeholder={lang === 'en' ? 'Wire reference note (optional)' : 'Tytuł przelewu (opcjonalny)'}
                      className="bg-[#151c28] border border-[#2d3b52] rounded px-2.5 py-2 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {[50_000, 250_000, 1_000_000].map((addAmt) => (
                        <button
                          key={addAmt}
                          type="button"
                          onClick={() =>
                            setTransferAmount((prev) =>
                              Math.min(Math.max(0, Math.floor(currentPlayer.cash)), Math.max(0, prev) + addAmt)
                            )
                          }
                          className="px-2.5 py-1 rounded bg-[#151c28] hover:bg-[#1e293d] border border-[#2d3b52] text-slate-200 font-mono text-[11px]"
                        >
                          +{formatCompactMoney(addAmt)}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={
                        !transferRecipientId ||
                        transferAmount <= 0 ||
                        transferAmount > currentPlayer.cash
                      }
                      onClick={() => {
                        onTransferCash(transferRecipientId, transferAmount, transferNote);
                        setTransferNote('');
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold"
                    >
                      {lang === 'en' ? '💸 Send Wire' : '💸 Wyślij Przelew'} ({formatMoney(Math.max(0, transferAmount))})
                    </button>
                  </div>

                  {myTransfers.length > 0 && (
                    <div className="pt-2 border-t border-[#1e293b] space-y-1">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        {lang === 'en' ? 'Recent B2B Transfers' : 'Ostatnie Przelewy B2B'}
                      </div>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {myTransfers.map((tr) => {
                          const isOut = tr.fromPlayerId === currentPlayer.id;
                          return (
                            <div
                              key={tr.id}
                              className="px-2.5 py-1.5 rounded bg-[#131b2b] flex items-center justify-between gap-2 text-[11px]"
                            >
                              <span className="text-slate-300 truncate">
                                {isOut ? `→ ${tr.toCompanyName}` : `← ${lang === 'en' ? 'From' : 'Od'} ${tr.fromCompanyName}`}
                                {tr.note ? ` · "${tr.note}"` : ''} · {tr.dateLabel}
                              </span>
                              <span
                                className={`font-mono font-semibold shrink-0 ${
                                  isOut ? 'text-rose-300' : 'text-emerald-300'
                                }`}
                              >
                                {isOut ? '−' : '+'}
                                {formatMoney(tr.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Aktywne kontrakty */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-300 uppercase tracking-wide">
                  {lang === 'en' ? 'Active B2B Contracts' : 'Aktywne Umowy B2B'} ({activeContracts.length})
                </div>
                {activeContracts.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#0b0f17] border border-[#243044] text-center text-slate-500">
                    {lang === 'en' ? 'No active contracts.' : 'Brak aktywnych kontraktów.'}
                  </div>
                ) : (
                  activeContracts.map((c) => {
                    const rd = RESOURCE_DEFINITIONS[c.resource];
                    const rName = localizeResourceName(c.resource, rd.name, lang);
                    const rUnit = localizeResourceUnit(rd.unit, lang);
                    const brd = c.barterResource ? RESOURCE_DEFINITIONS[c.barterResource] : null;
                    const brName =
                      c.barterResource && brd ? localizeResourceName(c.barterResource, brd.name, lang) : '';
                    const brUnit = brd ? localizeResourceUnit(brd.unit, lang) : '';
                    return (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-semibold text-slate-100">
                            {rd.emoji} {rName} · {c.quantityPerTick} {rUnit}/T{' '}
                            {c.kind === 'barter' && brd
                              ? `↔ ${c.barterQtyPerTick} ${brUnit} ${brName}`
                              : `× ${formatMoney(c.pricePerUnit)}`}
                          </div>
                          <div className="text-slate-400 flex flex-wrap items-center gap-2">
                            <span>
                              {c.sellerName} → {c.buyerName} · {lang === 'en' ? 'Volume:' : 'Wolumen:'}{' '}
                              {formatMoney(c.totalValueDelivered)}
                            </span>
                            {c.transportMode && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                  c.transportMode === 'blocked'
                                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                                    : 'bg-sky-950/40 border-sky-500/35 text-sky-300'
                                }`}
                                title={c.blockedReason}
                              >
                                {c.transportMode === 'blocked'
                                  ? lang === 'en'
                                    ? '⛔ No water route'
                                    : '⛔ Brak trasy przez wodę'
                                  : c.transportMode === 'sea'
                                    ? lang === 'en'
                                      ? '🚢 Sea Port'
                                      : '🚢 Port Morski'
                                    : c.transportMode === 'air'
                                      ? lang === 'en'
                                        ? '✈️ Cargo Airport'
                                        : '✈️ Lotnisko Cargo'
                                      : lang === 'en'
                                        ? '🚛 Road / Bridge'
                                        : '🚛 Droga / Most'}
                              </span>
                            )}
                          </div>
                          {c.transportMode === 'blocked' && c.blockedReason && (
                            <div className="text-[10px] text-rose-300 mt-0.5">{c.blockedReason}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sky-300">
                            {c.remainingTicks} {lang === 'en' ? 'ticks' : 'cykli'}
                          </span>
                          <button
                            type="button"
                            onClick={() => onCancel(c.id)}
                            className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300"
                          >
                            {lang === 'en' ? 'Break Deal' : 'Zerwij'}
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
