import React, { useMemo, useState } from 'react';
import { BUILDING_CATEGORIES, GAME_CONFIG, TOLL_RATE_CONFIG } from '../../config/gameConfig';
import { RESOURCE_DEFINITIONS, TRADEABLE_RESOURCE_LIST } from '../../data/resources';
import { computePlayerUtilityAndResourceBalance } from '../../engine/BalanceSystem';
import {
  calculateMonopolyShares,
  getOverallDominanceScore,
  getResourcePrice,
} from '../../engine/EconomyEngine';
import type { BuildingCategory, GameState, Player, ResourceType } from '../../engine/types';
import { BUILDINGS_EN } from '../../i18n/buildingsEn';
import {
  localizeAiStrategy,
  localizeBuildingCategory,
  localizePatent,
  localizeResourceName,
  localizeResourceUnit,
  localizeTollRate,
} from '../../i18n/dataTranslations';
import { useI18n } from '../../i18n/useI18n';
import { formatCompactMoney, formatMoney } from '../../utils/formatters';
import { DarkNumberInput, DarkToggle } from '../HUD/DarkControls';
import { MiniChart } from '../HUD/MiniChart';

interface FinancePanelProps {
  gameState: GameState;
  currentPlayer: Player;
  initialTab?: 'pnl' | 'balance' | 'stocks' | 'grey' | 'monopol' | 'warehouse' | 'maintenance' | 'loans';
  showTransportRoutes?: boolean;
  onToggleTransportRoutes?: () => void;
  onTakeLoan: (amount: number, months: number) => void;
  onRepayLoan: (loanId: string) => void;
  onSellStock: (resource: ResourceType, amount: number) => void;
  onBuyStock: (resource: ResourceType, amount: number) => void;
  onTradeCorporateStock: (targetCompanyId: string, shareDeltaPercent: number) => void;
  onIssueBond: (amount: number) => void;
  onGreyMarketAction: (
    actionId: 'black_arms' | 'black_fuel' | 'tax_shelter' | 'bribe_auditor'
  ) => void;
  onApplyAutoRepairTemplate: (enabled: boolean, threshold: number, setAsDefault: boolean) => void;
  onClose: () => void;
}

const PNL_CATEGORY_EN: Record<string, string> = {
  Wydobycie: 'Mining & Extraction',
  Przetwórstwo: 'Processing & Industry',
  Energetyka: 'Energy & Power',
  'Gospodarka Odpadami i Ścieki': 'Waste & Sewage',
  'Nieruchomości, Atrakcje i Finanse': 'Real Estate, Leisure & Finance',
  'Usługi i Bezpieczeństwo': 'Services & Safety',
  'Tantiemy Patentowe i Przetargi': 'Patent Royalties & Tenders',
  'Dywidendy z Akcji': 'Stock Dividends',
  'Opłaty Drogowe (Myto)': 'Highway Tolls',
  'Surowce i Wsad': 'Raw Materials & Inputs',
  'Kadry i Składki ZUS': 'Payroll & Social Taxes',
  'Logistyka i Media': 'Logistics & Utilities',
  'Utrzymanie i Kary': 'Maintenance & Fines',
  'Podatek od Nieruchomości': 'Property Tax',
  'Raty Kredytowe': 'Loan & Bond Repayments',
};

const CATEGORY_META_MAP: Record<string, { icon: string; label: string }> = Object.fromEntries(
  BUILDING_CATEGORIES.map((c) => [c.key, { icon: c.icon, label: c.label }])
);

export const FinancePanel: React.FC<FinancePanelProps> = ({
  gameState,
  currentPlayer,
  initialTab = 'pnl',
  showTransportRoutes,
  onToggleTransportRoutes,
  onTakeLoan,
  onRepayLoan,
  onSellStock,
  onBuyStock,
  onTradeCorporateStock,
  onIssueBond,
  onGreyMarketAction,
  onApplyAutoRepairTemplate,
  onClose,
}) => {
  const { lang } = useI18n();
  const [tab, setTab] = useState<
    'pnl' | 'balance' | 'stocks' | 'grey' | 'monopol' | 'warehouse' | 'maintenance' | 'loans'
  >(initialTab);
  const [loanAmount, setLoanAmount] = useState(500_000);
  const [loanMonths, setLoanMonths] = useState(12);
  const [bondAmount, setBondAmount] = useState(500_000);

  // Spot zakupy do magazynu
  const [spotRes, setSpotRes] = useState<ResourceType>('steel');
  const [spotQty, setSpotQty] = useState(20);

  // Szablon autonaprawy
  const [tplEnabled, setTplEnabled] = useState(currentPlayer.defaultAutoRepair.enabled);
  const [tplThreshold, setTplThreshold] = useState(currentPlayer.defaultAutoRepair.threshold);
  const [tplDefault, setTplDefault] = useState(true);

  const monopolyShares = calculateMonopolyShares(gameState, currentPlayer.id);
  const dominance = getOverallDominanceScore(gameState, currentPlayer.id);
  const domThreshold =
    gameState.settings.dominationThreshold ?? gameState.monopolyThreshold ?? 75;

  const revEntries = Object.entries(currentPlayer.lastTickRevenueByCategory);
  const costEntries = Object.entries(currentPlayer.lastTickCostsByCategory);
  const totalRev = revEntries.reduce((s, [, v]) => s + v, 0);
  const totalCost = costEntries.reduce((s, [, v]) => s + v, 0) + currentPlayer.lastTickTaxes.cit;

  const ownedBuildings = gameState.plots
    .filter((p) => p.ownerId === currentPlayer.id && p.building)
    .map((p) => p.building!);

  const marginByCategory: Record<string, { rev: number; profit: number }> = {};
  for (const b of ownedBuildings) {
    if (!marginByCategory[b.category]) marginByCategory[b.category] = { rev: 0, profit: 0 };
    marginByCategory[b.category].rev += b.revenue;
    marginByCategory[b.category].profit += b.netProfit;
  }

  const stockpileItems = Object.entries(currentPlayer.warehouseStockpile).filter(([, v]) => (v ?? 0) > 0.2);
  const spotPrice = gameState.resourcePrices.find((r) => r.type === spotRes)?.price ?? 200;

  const balanceReport = useMemo(
    () =>
      tab === 'balance'
        ? computePlayerUtilityAndResourceBalance(gameState, currentPlayer)
        : null,
    [tab, gameState, currentPlayer]
  );

  const logisticsStats = { road: 0, sea: 0, air: 0, isolated: 0 };
  for (const b of ownedBuildings) {
    logisticsStats[b.logisticsMode ?? 'road'] = (logisticsStats[b.logisticsMode ?? 'road'] ?? 0) + 1;
  }

  const locPnlCat = (rawCat: string) =>
    lang === 'en' ? PNL_CATEGORY_EN[rawCat] ?? rawCat : rawCat;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden animate-scaleIn">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-bold text-slate-100">
              {lang === 'en'
                ? '📊 Financial Terminal & Operations'
                : '📊 Terminal Finansowy & Operacje'}
            </h2>
            <p className="text-xs text-slate-400 truncate">
              {currentPlayer.companyName} · {lang === 'en' ? 'Strategy:' : 'Strategia:'}{' '}
              <span className="text-amber-300">
                {localizeAiStrategy(currentPlayer.dominantStrategy, currentPlayer.dominantStrategy, lang)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1c2434] text-slate-300 hover:text-white flex items-center justify-center shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-2 border-b border-[#243044] flex flex-wrap gap-1.5">
          {(lang === 'en'
            ? [
                { k: 'pnl', l: '📈 P&L & Margins' },
                { k: 'balance', l: '⚡ Utilities & Resources' },
                { k: 'stocks', l: '🏦 Equities & Bonds' },
                { k: 'grey', l: '🕶️ Grey Market & Tolls' },
                { k: 'monopol', l: `👑 Dominance (${dominance}%)` },
                { k: 'warehouse', l: `📦 Warehouses (${stockpileItems.length})` },
                { k: 'maintenance', l: `🔧 Auto-Repair (${ownedBuildings.length})` },
                { k: 'loans', l: `💳 Loans (${currentPlayer.loans.length})` },
              ]
            : [
                { k: 'pnl', l: '📈 Rachunek P&L i Marże' },
                { k: 'balance', l: '⚡ Bilans Mediów i Zasobów' },
                { k: 'stocks', l: '🏦 Giełda Spółek i Obligacje' },
                { k: 'grey', l: '🕶️ Szara Strefa i Myto' },
                { k: 'monopol', l: `👑 Monopol Meter (${dominance}%)` },
                { k: 'warehouse', l: `📦 Magazyny (${stockpileItems.length})` },
                { k: 'maintenance', l: `🔧 Autonaprawa (${ownedBuildings.length})` },
                { k: 'loans', l: `💳 Kredyty (${currentPlayer.loans.length})` },
              ]
          ).map((tabOpt) => (
            <button
              key={tabOpt.k}
              type="button"
              onClick={() => setTab(tabOpt.k as typeof tab)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                tab === tabOpt.k
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
              }`}
            >
              {tabOpt.l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {tab === 'stocks' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-sky-500/35 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sky-300 text-sm">
                      {lang === 'en'
                        ? '📈 Corporate Stock Exchange & Dividends'
                        : '📈 Giełda Spółek Imperium & Dywidendy'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {lang === 'en'
                        ? 'Buy rival equity stakes to collect dividends (≥15% reveals financial intel, ≥50% slashes Compulsory Buyout & Corporate Raid costs by 45%!).'
                        : 'Kupuj pakiety udziałów rywali, pobieraj regularne dywidendy z ich zysków (≥15% daje darmowy wywiad finansowy, ≥50% obniża koszt Przymusowego Wykupu i Abordażu o 45%!).'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {(gameState.stocks ?? []).map((st) => {
                    const isSelf = st.companyId === currentPlayer.id;
                    const myStake = st.holdings[currentPlayer.id] ?? 0;
                    const freeFloat = st.holdings[st.companyId] ?? 0;
                    const isUp = st.changePercent >= 0;
                    const cost5 = Math.round(5 * st.sharePrice * 450);

                    return (
                      <div
                        key={st.companyId}
                        className="p-3 rounded-lg bg-[#151c28] border border-[#243044] flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: st.color }}
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-100 truncate">
                              {st.companyName} {isSelf && (lang === 'en' ? '(Your Corp)' : '(Twoja Firma)')}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {lang === 'en' ? 'Your stake:' : 'Twój udział:'}{' '}
                              <strong className="text-amber-300">{myStake}%</strong> ·{' '}
                              {lang === 'en' ? 'Free float:' : 'Wolna pula:'} {freeFloat}% ·{' '}
                              {lang === 'en' ? 'Dividend/tick:' : 'Dywidenda/cykl:'}{' '}
                              {formatMoney(st.dividendPerShareTick)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <MiniChart
                            data={st.priceHistory.slice(-14)}
                            width={56}
                            height={20}
                            positive={isUp}
                          />
                          <div className="text-right font-mono">
                            <div className="text-sm font-bold text-slate-100">
                              {formatMoney(st.sharePrice)}
                            </div>
                            <div
                              className={`text-[10px] ${
                                isUp ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isUp ? '+' : ''}
                              {st.changePercent}%
                            </div>
                          </div>

                          {!isSelf && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={freeFloat < 5 || currentPlayer.cash < cost5}
                                onClick={() => onTradeCorporateStock(st.companyId, 5)}
                                className="px-2.5 py-1.5 rounded bg-emerald-600/25 hover:bg-emerald-600/45 border border-emerald-400/40 text-emerald-200 font-semibold disabled:opacity-40"
                                title={
                                  lang === 'en'
                                    ? `Buy 5% shares for ${formatMoney(cost5)}`
                                    : `Kup 5% akcji za ${formatMoney(cost5)}`
                                }
                              >
                                +5% ({formatCompactMoney(cost5)})
                              </button>
                              <button
                                type="button"
                                disabled={myStake < 5}
                                onClick={() => onTradeCorporateStock(st.companyId, -5)}
                                className="px-2.5 py-1.5 rounded bg-rose-600/25 hover:bg-rose-600/45 border border-rose-400/40 text-rose-200 font-semibold disabled:opacity-40"
                              >
                                −5%
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Emisja Obligacji Korporacyjnych */}
              <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-amber-500/35 space-y-3">
                <div className="font-semibold text-amber-300 text-sm">
                  {lang === 'en'
                    ? '📜 Corporate Bond Issuance (Tier 2+, lower coupon than bank)'
                    : '📜 Emisja Obligacji Korporacyjnych (Etap 2+, niższy kupon niż bank)'}
                </div>
                {gameState.settings.mutators?.noLoans ? (
                  <div className="p-2.5 rounded bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200">
                    {lang === 'en' ? (
                      <>
                        🚫 Active mutator <strong>"No Bank Loans"</strong> disables corporate bond issuance in this match.
                      </>
                    ) : (
                      <>
                        🚫 Aktywny mutator <strong>„Bez Kredytów”</strong> blokuje emisję obligacji korporacyjnych w tej partii.
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {[500_000, 1_500_000, 3_000_000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBondAmount(amt)}
                        className={`px-3 py-1.5 rounded border font-mono ${
                          bondAmount === amt
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                            : 'bg-[#151c28] border-[#243044] text-slate-300'
                        }`}
                      >
                        {formatCompactMoney(amt)}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={currentPlayer.corporationLevel < 2}
                      onClick={() => onIssueBond(bondAmount)}
                      className="ml-auto px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold"
                    >
                      {lang === 'en' ? 'Issue Bonds' : 'Wyemituj Obligacje'}
                    </button>
                  </div>
                )}

                {(currentPlayer.bonds ?? []).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {currentPlayer.bonds.map((bond) => (
                      <div
                        key={bond.id}
                        className="p-2 rounded bg-[#151c28] border border-[#243044] flex justify-between font-mono"
                      >
                        <span className="text-slate-200">
                          {lang === 'en' ? 'Bond' : 'Obligacja'} {formatCompactMoney(bond.principal)} (
                          {lang === 'en' ? 'Coupon' : 'Kupon'} {(bond.couponRate * 100).toFixed(1)}%)
                        </span>
                        <span className="text-amber-300">
                          {lang === 'en' ? 'Remaining' : 'Pozostało'} {formatMoney(bond.remainingAmount)} ({bond.remainingTicks}T)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'grey' && (
            <div className="space-y-4">
              {/* Ryzyko Kontroli Skarbowej */}
              <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-rose-500/35 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-100 text-sm">
                    {lang === 'en'
                      ? '🕶️ Grey Market · Tax Audit Risk Meter'
                      : '🕶️ Szara Strefa · Wskaźnik Ryzyka Kontroli'}
                  </span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      (currentPlayer.inspectionRisk ?? 0) >= 40
                        ? 'text-rose-400 animate-pulse'
                        : 'text-amber-300'
                    }`}
                  >
                    {Math.round(currentPlayer.inspectionRisk ?? 0)}% / 100%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      (currentPlayer.inspectionRisk ?? 0) >= 40 ? 'bg-rose-500' : 'bg-amber-400'
                    }`}
                    style={{ width: `${Math.min(100, currentPlayer.inspectionRisk ?? 0)}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-400">
                  {lang === 'en'
                    ? 'Above 42%, press scandal, treasury fines & a -18% stock crash risk escalates. Police Stations (Counterintelligence) & Lobbying Offices gradually lower risk.'
                    : 'Powyżej 42% rośnie ryzyko skandalu w Gazecie, kary skarbowej i spadku kursu akcji (-18%). Posterunki Policji (Kontrwywiad) i Biura Lobbingu stopniowo redukują ryzyko.'}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
                  <div className="p-3 rounded-lg bg-[#151c28] border border-[#243044] space-y-2">
                    <div className="font-semibold text-rose-300">
                      {lang === 'en' ? '🔫 Black Market Arms (−32%)' : '🔫 Czarny Rynek Broni (−32%)'}
                    </div>
                    <div className="text-slate-400">
                      {lang === 'en'
                        ? 'Buy 20 Weapons for your PMC Base off-market (+14% audit risk).'
                        : 'Kup 20 szt. Broni dla Bazy PMC poza oficjalną giełdą (+14% ryzyka kontroli).'}
                    </div>
                    <button
                      type="button"
                      onClick={() => onGreyMarketAction('black_arms')}
                      className="w-full py-1.5 rounded bg-rose-600/25 hover:bg-rose-600/45 border border-rose-400/40 text-rose-200 font-semibold"
                    >
                      {lang === 'en' ? 'Buy' : 'Kup'} ({formatMoney(Math.round(20 * getResourcePrice(gameState, 'weapons') * 0.68))})
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-[#151c28] border border-[#243044] space-y-2">
                    <div className="font-semibold text-amber-300">
                      {lang === 'en' ? '🛢️ Smuggled Fuel & Chemicals' : '🛢️ Kontrabanda Paliwa & Chemii'}
                    </div>
                    <div className="text-slate-400">
                      {lang === 'en'
                        ? 'Buy 50 Fuel + 25 Chemicals at ~34% discount (+12% audit risk).'
                        : 'Kup 50 Paliwa + 25 Chemikaliów z rabatem ~34% (+12% ryzyka).'}
                    </div>
                    <button
                      type="button"
                      onClick={() => onGreyMarketAction('black_fuel')}
                      className="w-full py-1.5 rounded bg-amber-600/25 hover:bg-amber-600/45 border border-amber-400/40 text-amber-200 font-semibold"
                    >
                      {lang === 'en' ? 'Buy' : 'Kup'} (
                      {formatMoney(
                        Math.round(
                          (50 * getResourcePrice(gameState, 'fuel') +
                            25 * getResourcePrice(gameState, 'chemicals')) *
                            0.66
                        )
                      )}
                      )
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-[#151c28] border border-[#243044] space-y-2">
                    <div className="font-semibold text-emerald-300">
                      {lang === 'en' ? '🏝️ Offshore Tax Haven' : '🏝️ Raj Podatkowy (Optymalizacja)'}
                    </div>
                    <div className="text-slate-400">
                      {lang === 'en'
                        ? 'Immediate tax shield (-40% CIT for 18 ticks) in exchange for +18% audit risk.'
                        : 'Natychmiastowa tarcza podatkowa (−40% CIT na 18 cykli) za +18% ryzyka kontroli.'}
                    </div>
                    <button
                      type="button"
                      onClick={() => onGreyMarketAction('tax_shelter')}
                      className="w-full py-1.5 rounded bg-emerald-600/25 hover:bg-emerald-600/45 border border-emerald-400/40 text-emerald-200 font-semibold"
                    >
                      {lang === 'en' ? 'Activate Offshore Shield' : 'Uruchom Tarczę Offshore'}
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-[#151c28] border border-[#243044] space-y-2">
                    <div className="font-semibold text-sky-300">
                      {lang === 'en' ? '🧹 Cook Books & Bribe Auditor' : '🧹 Czyszczenie Ksiąg i Audyt'}
                    </div>
                    <div className="text-slate-400">
                      {lang === 'en'
                        ? 'Drops Audit Risk Meter by 30% via back-room settlements.'
                        : 'Obniża Wskaźnik Ryzyka Kontroli o 30% poprzez zakulisowe rozliczenia.'}
                    </div>
                    <button
                      type="button"
                      disabled={currentPlayer.cash < 95_000}
                      onClick={() => onGreyMarketAction('bribe_auditor')}
                      className="w-full py-1.5 rounded bg-sky-600/25 hover:bg-sky-600/45 border border-sky-400/40 text-sky-200 font-semibold disabled:opacity-40"
                    >
                      {lang === 'en' ? 'Wash Books' : 'Wyczyść Księgi'} ({formatMoney(95_000)})
                    </button>
                  </div>
                </div>
              </div>

              {/* Przegląd Twoich Dróg, Autostrad i Zbieranych Opłat Myta */}
              <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
                <div className="font-semibold text-slate-100 text-sm">
                  {lang === 'en'
                    ? '🛣️ Your Roads, Toll Highways & Toll Revenues'
                    : '🛣️ Twoje Drogi, Autostrady Płatne i Przychody z Myta'}
                </div>
                {gameState.plots.filter((p) => p.ownerId === currentPlayer.id && p.hasRoad).length === 0 ? (
                  <div className="text-slate-500">
                    {lang === 'en'
                      ? 'You own no private roads or highways yet. Click any owned plot on the map to build road infrastructure.'
                      : 'Nie posiadasz jeszcze własnych dróg ani autostrad. Kliknij kupioną działkę na mapie, aby ją zabudować drogą.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {gameState.plots
                      .filter((p) => p.ownerId === currentPlayer.id && p.hasRoad)
                      .map((rp) => (
                        <div
                          key={rp.id}
                          className="p-2.5 rounded bg-[#151c28] border border-[#243044] flex justify-between items-center"
                        >
                          <div>
                            <div className="font-semibold text-slate-100">
                              ({rp.gridX}, {rp.gridY}) ·{' '}
                              {rp.roadType === 'highway'
                                ? lang === 'en'
                                  ? '🚧 Highway'
                                  : '🚧 Autostrada'
                                : lang === 'en'
                                  ? '🛣️ Road'
                                  : '🛣️ Droga'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {rp.roadBlocked
                                ? lang === 'en'
                                  ? '🚫 Transit blocked'
                                  : '🚫 Blokada tranzytu'
                                : localizeTollRate(rp.tollRate, TOLL_RATE_CONFIG[rp.tollRate].label, lang)}
                            </div>
                          </div>
                          <div className="font-mono text-emerald-400 font-semibold">
                            +{formatMoney(rp.tollRevenueTotal ?? 0)}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'balance' && balanceReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300 text-sm">
                      {lang === 'en' ? '⚡ Electric Power (MW)' : '⚡ Energia Elektryczna (MW)'}
                    </span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        balanceReport.electricityNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {balanceReport.electricityNet >= 0 ? '+' : ''}
                      {balanceReport.electricityNet} MW
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span>{lang === 'en' ? 'Power plant output + B2B:' : 'Produkcja z elektrowni + B2B:'}</span>
                      <span className="font-mono text-emerald-300">+{balanceReport.electricityProduced} MW</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'en' ? 'Plant demand + B2B:' : 'Zapotrzebowanie zakładów + B2B:'}</span>
                      <span className="font-mono text-rose-300">-{balanceReport.electricityConsumed} MW</span>
                    </div>
                  </div>
                  {balanceReport.electricityByPlant.length > 0 && (
                    <div className="pt-1.5 border-t border-[#1c2434] space-y-0.5 text-[11px] text-slate-400">
                      <div className="text-slate-300 font-medium">
                        {lang === 'en' ? 'Top generators:' : 'Główni wytwórcy:'}
                      </div>
                      {balanceReport.electricityByPlant.slice(0, 4).map((p, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{p.label}</span>
                          <span className="font-mono text-emerald-400">+{p.produced} MW</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {balanceReport.electricityConsumers.length > 0 && (
                    <div className="pt-1.5 border-t border-[#1c2434] space-y-0.5 text-[11px] text-slate-400">
                      <div className="text-slate-300 font-medium">
                        {lang === 'en' ? 'Top consumers:' : 'Najwięksi odbiorcy:'}
                      </div>
                      {balanceReport.electricityConsumers.slice(0, 4).map((c, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{c.label}</span>
                          <span className="font-mono text-rose-400">-{c.consumed} MW</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sky-300 text-sm">
                      {lang === 'en' ? '💧 Industrial Water (m³)' : '💧 Woda Przemysłowa (m³)'}
                    </span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        balanceReport.waterNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {balanceReport.waterNet >= 0 ? '+' : ''}
                      {balanceReport.waterNet} m³
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span>{lang === 'en' ? 'Waterworks + B2B supply:' : 'Wydobycie z ujęć + B2B:'}</span>
                      <span className="font-mono text-emerald-300">+{balanceReport.waterProduced} m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'en' ? 'Industrial usage + B2B:' : 'Zużycie przemysłu + B2B:'}</span>
                      <span className="font-mono text-rose-300">-{balanceReport.waterConsumed} m³</span>
                    </div>
                  </div>
                  {balanceReport.waterSources.length > 0 && (
                    <div className="pt-1.5 border-t border-[#1c2434] space-y-0.5 text-[11px] text-slate-400">
                      <div className="text-slate-300 font-medium">
                        {lang === 'en' ? 'Treatment plants:' : 'Stacje uzdatniania:'}
                      </div>
                      {balanceReport.waterSources.slice(0, 4).map((p, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{p.label}</span>
                          <span className="font-mono text-emerald-400">+{p.produced} m³</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {balanceReport.waterConsumers.length > 0 && (
                    <div className="pt-1.5 border-t border-[#1c2434] space-y-0.5 text-[11px] text-slate-400">
                      <div className="text-slate-300 font-medium">
                        {lang === 'en' ? 'Top consumers:' : 'Najwięksi odbiorcy:'}
                      </div>
                      {balanceReport.waterConsumers.slice(0, 4).map((c, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{c.label}</span>
                          <span className="font-mono text-rose-400">-{c.consumed} m³</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nowe media: Ścieki & Odpady */}
                <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-teal-300 text-sm">
                      {lang === 'en' ? '🚰 Industrial Sewage (m³)' : '🚰 Ścieki Przemysłowe (m³)'}
                    </span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        balanceReport.sewageNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {balanceReport.sewageNet >= 0 ? '+' : ''}
                      {balanceReport.sewageNet} m³
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-300 text-xs">
                    <div className="flex justify-between">
                      <span>{lang === 'en' ? 'Treatment capacity:' : 'Przepustowość oczyszczalni:'}</span>
                      <span className="font-mono text-emerald-300">+{balanceReport.sewageTreated} m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'en' ? 'Facility sewage output:' : 'Emisja ścieków zakładów:'}</span>
                      <span className="font-mono text-rose-300">-{balanceReport.sewageProduced} m³</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-lime-300 text-sm">
                      {lang === 'en' ? '🗑️ Waste & Recycling (t)' : '🗑️ Odpady i Recykling (t)'}
                    </span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        balanceReport.wasteNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {balanceReport.wasteNet >= 0 ? '+' : ''}
                      {balanceReport.wasteNet} t
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-300 text-xs">
                    <div className="flex justify-between">
                      <span>{lang === 'en' ? 'Incinerator & Recycling capacity:' : 'Moc Spalarni & Recyklingu:'}</span>
                      <span className="font-mono text-emerald-300">+{balanceReport.wasteProcessed} t</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'en' ? 'Waste generated:' : 'Wytwarzane odpady:'}</span>
                      <span className="font-mono text-rose-300">-{balanceReport.wasteProduced} t</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logistyka multimodalna */}
              <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="text-slate-300">
                    🛣️ {lang === 'en' ? 'Road:' : 'Drogowe:'} <strong className="font-mono text-white">{logisticsStats.road}</strong>
                  </span>
                  <span className="text-sky-300">
                    🚢 {lang === 'en' ? 'Maritime:' : 'Morskie:'} <strong className="font-mono">{logisticsStats.sea}</strong>
                  </span>
                  <span className="text-violet-300">
                    ✈️ {lang === 'en' ? 'Air:' : 'Lotnicze:'} <strong className="font-mono">{logisticsStats.air}</strong>
                  </span>
                  {logisticsStats.isolated > 0 && (
                    <span className="text-rose-400 font-semibold">
                      ⚠️ {lang === 'en' ? 'Isolated:' : 'Odizolowane:'} <strong className="font-mono">{logisticsStats.isolated}</strong>
                    </span>
                  )}
                </div>
                {onToggleTransportRoutes && (
                  <button
                    type="button"
                    onClick={onToggleTransportRoutes}
                    className={`px-2.5 py-1 rounded border text-xs font-semibold ${
                      showTransportRoutes
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                        : 'bg-[#151c28] border-[#243044] text-slate-300'
                    }`}
                  >
                    {showTransportRoutes
                      ? lang === 'en'
                        ? 'Hide map routes'
                        : 'Ukryj trasy na mapie'
                      : lang === 'en'
                        ? 'Show map routes'
                        : 'Pokaż trasy na mapie'}
                  </button>
                )}
              </div>

              {/* Bilans wszystkich surowców i produktów */}
              <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
                <div className="font-semibold text-slate-200 text-sm">
                  {lang === 'en'
                    ? 'Commodity & Material Flow Balance (Per Tick)'
                    : 'Bilans Przepływów Surowców i Wyrobów (Cykl)'}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {balanceReport.resourceBalances.map((rb) => {
                    const rd = RESOURCE_DEFINITIONS[rb.resource];
                    const b2bNet = Number((rb.b2bImport - rb.b2bExport).toFixed(1));
                    return (
                      <div
                        key={rb.resource}
                        className="p-2.5 rounded bg-[#151c28] border border-[#243044] space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-100">
                            {rd.emoji} {localizeResourceName(rb.resource, rd.name, lang)}
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              rb.net > 0
                                ? 'text-emerald-400'
                                : rb.net < 0
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                            }`}
                          >
                            {rb.net > 0 ? `+${rb.net}` : rb.net}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                          <span>Prod: +{rb.produced}</span>
                          <span>{lang === 'en' ? 'Used:' : 'Zuż:'} -{rb.consumed}</span>
                          <span>B2B: {b2bNet >= 0 ? `+${b2bNet}` : b2bNet}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'pnl' && (
            <>
              <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044]">
                <div className="text-xs font-semibold text-slate-300 mb-2">
                  {lang === 'en'
                    ? 'Revenue & Costs Over Time (Historical P&L)'
                    : 'Dynamika Przychodów i Kosztów (P&L w czasie)'}
                </div>
                <PnLChart history={currentPlayer.financialHistory} lang={lang} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1.5">
                  <div className="font-semibold text-emerald-400 uppercase tracking-wide mb-1">
                    {lang === 'en' ? 'Revenue Breakdown (Per Tick)' : 'Struktura Przychodów (Cykl)'}
                  </div>
                  {revEntries.length === 0 ? (
                    <div className="text-slate-500">
                      {lang === 'en' ? 'No operating revenue yet.' : 'Brak przychodów operacyjnych.'}
                    </div>
                  ) : (
                    revEntries.map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between">
                        <span className="text-slate-300">{locPnlCat(cat)}</span>
                        <span className="font-mono text-emerald-300">+{formatMoney(amt)}</span>
                      </div>
                    ))
                  )}
                  <div className="border-t border-[#1b2434] pt-1.5 flex justify-between font-bold text-slate-100">
                    <span>{lang === 'en' ? 'Total Revenue' : 'Razem Przychody'}</span>
                    <span className="font-mono text-emerald-400">+{formatMoney(totalRev)}</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1.5">
                  <div className="font-semibold text-rose-400 uppercase tracking-wide mb-1">
                    {lang === 'en' ? 'Cost & Tax Breakdown' : 'Struktura Kosztów i Podatków'}
                  </div>
                  {costEntries.map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between">
                      <span className="text-slate-300">{locPnlCat(cat)}</span>
                      <span className="font-mono text-rose-300">-{formatMoney(amt)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <span className="text-slate-300">
                      {lang === 'en' ? 'Corporate Income Tax (Effective CIT)' : 'Podatek CIT (Efektywny)'}
                    </span>
                    <span className="font-mono text-rose-300">-{formatMoney(currentPlayer.lastTickTaxes.cit)}</span>
                  </div>
                  <div className="border-t border-[#1b2434] pt-1.5 flex justify-between font-bold text-slate-100">
                    <span>{lang === 'en' ? 'Net Income (Per Tick)' : 'Wynik Netto (Cykl)'}</span>
                    <span className={`font-mono ${totalRev - totalCost >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatMoney(totalRev - totalCost)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
                <div className="font-semibold text-slate-200">
                  {lang === 'en' ? 'Empire Sector Operating Margins' : 'Marżowość Sektorów w Twoim Imperium'}
                </div>
                {Object.keys(marginByCategory).length === 0 ? (
                  <div className="text-slate-500">
                    {lang === 'en' ? 'No active structures.' : 'Brak aktywnych struktur.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(marginByCategory).map(([cat, d]) => {
                      const margin = d.rev > 0 ? Math.round((d.profit / d.rev) * 100) : 0;
                      const meta = CATEGORY_META_MAP[cat];
                      const catDisplay = meta
                        ? `${meta.icon} ${localizeBuildingCategory(cat as BuildingCategory, meta.label, lang)}`
                        : cat;
                      return (
                        <div key={cat} className="p-2 rounded bg-[#151c28] border border-[#243044] flex justify-between items-center">
                          <span className="text-slate-300">{catDisplay}</span>
                          <span className={`font-mono font-bold ${margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {margin}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'monopol' && (() => {
            const globalRanking = [...gameState.players]
              .map((p) => ({
                player: p,
                score: p.isEliminated ? 0 : getOverallDominanceScore(gameState, p.id),
              }))
              .sort((a, b) => b.score - a.score || b.player.netWorth - a.player.netWorth);

            return (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-[#0b0f17] border border-amber-500/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-100 text-sm">
                      {lang === 'en'
                        ? `Global Market Domination Index (Target: ${domThreshold}%)`
                        : `Globalny Wskaźnik Dominacji Rynkowej (Cel Monopolu: ${domThreshold}%)`}
                    </span>
                    <span className="font-mono text-lg font-bold text-amber-300">{dominance}% / {domThreshold}%</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    {lang === 'en'
                      ? 'Measures combined global share across all sectors, production value, revenue, net worth, and industry breadth.'
                      : 'Łączny udział globalny w produkcji wszystkich sektorów, wartości wyjściowej, przychodach, majątku i dywersyfikacji branż.'}
                  </p>
                  <div className="h-3 rounded-full bg-slate-800 overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 via-emerald-400 to-amber-400 transition-all duration-300"
                      style={{ width: `${dominance}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-300/80"
                      style={{ left: `${domThreshold}%` }}
                    />
                  </div>
                </div>

                {/* Ranking Dominacji Graczy */}
                <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                    <span>
                      {lang === 'en' ? '🏆 Global Dominance Standings' : '🏆 Ranking Dominacji Graczy'}
                    </span>
                    <span className="text-[11px] font-normal text-slate-400">
                      {lang === 'en' ? `Target: ${domThreshold}%` : `Próg wygranej: ${domThreshold}%`}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {globalRanking.map(({ player: rp, score }, idx) => {
                      const isSelf = rp.id === currentPlayer.id;
                      return (
                        <div key={rp.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[11px] text-slate-500 w-4">#{idx + 1}</span>
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: rp.color }}
                              />
                              <span
                                className={`truncate ${
                                  rp.isEliminated
                                    ? 'line-through text-slate-500'
                                    : isSelf
                                      ? 'font-bold text-amber-300'
                                      : 'text-slate-200'
                                }`}
                              >
                                {rp.companyName}
                              </span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] text-amber-200 font-semibold">
                                  {lang === 'en' ? 'YOU' : 'TY'}
                                </span>
                              )}
                              {rp.isEliminated && (
                                <span className="text-[10px] text-rose-400">
                                  ({lang === 'en' ? 'Bankrupt' : 'Bankrut'})
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-bold text-slate-100 shrink-0">{score}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full transition-all duration-300"
                              style={{ width: `${score}%`, backgroundColor: rp.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Udziały w 11 sektorach z kolorowymi paskami wielu graczy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {monopolyShares.map((ms) => {
                    const segs = ms.segments ?? [];
                    const leaderLabel = ms.leaderId
                      ? `${ms.leaderName} (${ms.leaderShare ?? 0}%)`
                      : lang === 'en'
                        ? 'Fragmented / Inactive'
                        : 'Rynek Rozproszony';
                    return (
                      <div key={ms.resource} className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1.5">
                        <div className="flex justify-between items-center gap-2">
                          <span className="font-semibold text-slate-200 truncate">
                            {ms.emoji} {localizeResourceName(ms.resource, ms.name, lang)}
                          </span>
                          <span className="font-mono font-bold text-sky-300 shrink-0">
                            {ms.playerShare}%
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden flex">
                          {segs.length > 0 ? (
                            segs.map((seg) => (
                              <div
                                key={seg.playerId}
                                className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
                                style={{ width: `${seg.share}%`, backgroundColor: seg.color }}
                                title={`${seg.companyName}: ${seg.share}%`}
                              />
                            ))
                          ) : (
                            <div className="h-full w-0" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400">
                          <span>
                            {lang === 'en' ? 'Your share:' : 'Twój udział:'}{' '}
                            <span className="text-slate-200 font-mono">{ms.playerShare}%</span>
                          </span>
                          <span className="truncate">
                            {lang === 'en' ? 'Leader:' : 'Lider:'}{' '}
                            <span className="text-slate-200">{leaderLabel}</span>
                          </span>
                        </div>
                        {segs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {segs.slice(0, 4).map((seg) => (
                              <span key={seg.playerId} className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: seg.color }}
                                />
                                <span className="truncate max-w-[95px]">{seg.companyName}</span>
                                <span className="font-mono text-slate-300">{seg.share}%</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {tab === 'warehouse' && (
            <div className="space-y-3">
              {gameState.settings.mode === 'mp_fast' || gameState.settings.mode === 'mp_long' ? (
                <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-500/45 space-y-1.5 text-xs">
                  <div className="font-bold text-amber-300">
                    {lang === 'en'
                      ? '🔒 Closed Multiplayer Economy — NPC Spot Buying Disabled'
                      : '🔒 Gospodarka Zamknięta Multiplayer — Zakupy od NPC Zablokowane'}
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {lang === 'en' ? (
                      <>
                        In online sessions, all goods circulate strictly between players. Produce your own commodities (enabling "Store %" on mines/plants) or purchase them from rivals in{' '}
                        <strong>🤝 B2B Contracts</strong>.
                      </>
                    ) : (
                      <>
                        W rozgrywce sieciowej wszystkie towary krążą wyłącznie między graczami. Wydobywaj własne
                        surowce (włączając tryb „Magazynuj” na kopalni/hucie) lub kupuj je od rywali w panelu{' '}
                        <strong>🤝 Kontrakty B2B</strong>.
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2.5">
                  <div className="font-semibold text-slate-100 text-sm">
                    {lang === 'en'
                      ? 'Purchase Physical Commodities on Spot Exchange (to Warehouse)'
                      : 'Zakup Fizycznych Surowców na Giełdzie (do Magazynu)'}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'en'
                      ? 'Stored reserves keep factories running and let you profit from capital news spikes.'
                      : 'Zgromadzone w magazynie surowce zasilają fabryki oraz pozwalają spekulować na skokach cen z Gazety.'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={spotRes}
                      onChange={(e) => setSpotRes(e.target.value as ResourceType)}
                      className="bg-[#151c28] border border-[#2d3b52] rounded px-2.5 py-2 text-slate-100"
                    >
                      {TRADEABLE_RESOURCE_LIST.map((rKey) => {
                        const rd = RESOURCE_DEFINITIONS[rKey];
                        return (
                          <option key={rd.type} value={rd.type}>
                            {rd.emoji} {localizeResourceName(rd.type, rd.name, lang)}
                          </option>
                        );
                      })}
                    </select>
                    <DarkNumberInput
                      value={spotQty}
                      onChange={setSpotQty}
                      min={1}
                      max={500}
                      step={5}
                    />
                    <button
                      type="button"
                      disabled={currentPlayer.cash < spotQty * spotPrice}
                      onClick={() => onBuyStock(spotRes, spotQty)}
                      className="py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-semibold"
                    >
                      {lang === 'en' ? 'Buy' : 'Kup'} ({formatMoney(spotQty * spotPrice)})
                    </button>
                  </div>
                </div>
              )}

              {(gameState.patents ?? []).length > 0 && (
                <div className="p-3 rounded-lg bg-[#0b0f17] border border-amber-500/35 space-y-1.5 text-xs">
                  <div className="font-semibold text-amber-300">
                    {lang === 'en'
                      ? '🏅 Active Technology Patents & Royalties'
                      : '🏅 Aktywne Patenty Technologiczne i Tantiemy'}
                  </div>
                  {(gameState.patents ?? []).map((rawPt) => {
                    const pt = localizePatent(rawPt, lang);
                    return (
                      <div key={pt.techId} className="flex justify-between text-[11px] text-slate-300">
                        <span>
                          {pt.techName} · {lang === 'en' ? 'Owner:' : 'Właściciel:'}{' '}
                          <strong className="text-white">{pt.ownerName}</strong>
                        </span>
                        <span className="font-mono text-emerald-400">
                          +{formatMoney(pt.royaltyPerTick)}/T ({lang === 'en' ? 'total' : 'łącznie'}{' '}
                          {formatCompactMoney(pt.totalRoyaltiesEarned)})
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {stockpileItems.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-[#0b0f17] rounded-lg border border-[#243044]">
                  {lang === 'en'
                    ? 'Warehouse is empty. Purchase goods above or switch production plants to "Store" mode.'
                    : 'Magazyn jest pusty. Kup towary powyżej lub przełącz zakłady na tryb „📦 Magazynuj zapasy”.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {stockpileItems.map(([resKey, qty]) => {
                    const res = resKey as ResourceType;
                    const def = RESOURCE_DEFINITIONS[res];
                    const price = gameState.resourcePrices.find((p) => p.type === res)?.price ?? def.basePrice;
                    const val = Math.round((qty ?? 0) * price);
                    return (
                      <div key={res} className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-100">
                            {def.emoji} {localizeResourceName(res, def.name, lang)}
                          </div>
                          <div className="font-mono text-slate-400">
                            {(qty ?? 0).toFixed(1)} {localizeResourceUnit(def.unit, lang)} ·{' '}
                            {lang === 'en' ? 'Value:' : 'Wycena:'} {formatMoney(val)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSellStock(res, qty ?? 0)}
                          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shrink-0"
                        >
                          {lang === 'en' ? 'Sell All' : 'Sprzedaj Całość'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'maintenance' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#0b0f17] border border-amber-500/35 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-100 text-sm">
                      {lang === 'en'
                        ? 'Global Structure Auto-Repair Template'
                        : 'Globalny Szablon Autonaprawy dla Struktur'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {lang === 'en'
                        ? 'Set a damage threshold % to trigger automatic restoration back to 0% wear (with overdraft protection).'
                        : 'Ustaw próg % zniszczenia, po przekroczeniu którego obiekt automatycznie przywróci stan 0% zniszczenia (z ochroną przed debetem).'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTplEnabled((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs border ${
                      tplEnabled
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-800 border-slate-600 text-slate-400'
                    }`}
                  >
                    {tplEnabled
                      ? lang === 'en'
                        ? 'Auto-Repair: ON'
                        : 'Autonaprawa: WŁ'
                      : lang === 'en'
                        ? 'Auto-Repair: OFF'
                        : 'Autonaprawa: WYŁ'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">
                      {lang === 'en' ? 'Damage threshold triggering overhaul:' : 'Próg zniszczenia uruchamiający remont:'}
                    </span>
                    <span className="font-mono font-bold text-amber-300">
                      {tplThreshold}% {lang === 'en' ? 'damage' : 'zniszczenia'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={90}
                    step={5}
                    value={tplThreshold}
                    onChange={(e) => setTplThreshold(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>

                <DarkToggle
                  checked={tplDefault}
                  onChange={setTplDefault}
                  label={
                    lang === 'en'
                      ? 'Set as default for all newly built structures'
                      : 'Ustaw jako domyślny dla wszystkich nowo budowanych obiektów'
                  }
                />

                <button
                  type="button"
                  onClick={() => onApplyAutoRepairTemplate(tplEnabled, tplThreshold, tplDefault)}
                  className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs md:text-sm"
                >
                  {lang === 'en'
                    ? `📋 Apply template to all structures (${ownedBuildings.length})`
                    : `📋 Zastosuj szablon do wszystkich struktur (${ownedBuildings.length})`}
                </button>
              </div>

              <div className="space-y-1.5">
                {ownedBuildings.map((b) => (
                  <div key={b.id} className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>{b.icon}</span>
                      <div>
                        <div className="font-semibold text-slate-100">
                          {lang === 'en' ? BUILDINGS_EN[b.type]?.name ?? b.name : b.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {lang === 'en' ? 'Wear:' : 'Zniszczenie:'} {Math.round(b.damagePercent)}% ·{' '}
                          {lang === 'en' ? 'Threshold:' : 'Próg:'}{' '}
                          {b.autoRepairEnabled ? `${b.autoRepairThreshold}%` : lang === 'en' ? 'OFF' : 'WYŁ'}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                        b.damagePercent >= 60
                          ? 'bg-rose-500/20 text-rose-300'
                          : b.damagePercent >= 30
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {Math.round(b.damagePercent)}% {lang === 'en' ? 'dmg' : 'zniszcz.'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'loans' && (() => {
            const isMpMode =
              gameState.settings.mode === 'mp_fast' || gameState.settings.mode === 'mp_long';
            const mpLoanLimitReached =
              isMpMode && currentPlayer.loans.length >= GAME_CONFIG.maxMpLoans;
            return (
              <div className="space-y-4">
                {(currentPlayer.insolvencyGraceTicks ?? 0) > 0 && (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/60 text-xs text-rose-200">
                    {lang === 'en' ? (
                      <>
                        🔨 <strong>BAILIFF NOTICE:</strong> You have{' '}
                        <strong>{currentPlayer.insolvencyGraceTicks} ticks</strong> to cover negative cash, or assets go to forced auction!
                      </>
                    ) : (
                      <>
                        🔨 <strong>UWAGA KOMORNIK:</strong> Masz{' '}
                        <strong>{currentPlayer.insolvencyGraceTicks} cykli</strong> na pokrycie ujemnego
                        salda, inaczej majątek trafi na przymusową licytację!
                      </>
                    )}
                  </div>
                )}
                <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-slate-100 text-sm">
                      {lang === 'en' ? 'New Credit Facility' : 'Nowa Linia Kredytowa'}
                    </div>
                    {isMpMode && (
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                          mpLoanLimitReached
                            ? 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                            : 'bg-[#151c28] border-[#243044] text-sky-300'
                        }`}
                      >
                        {lang === 'en' ? 'MP Cap:' : 'Limit MP:'} {currentPlayer.loans.length} / {GAME_CONFIG.maxMpLoans}{' '}
                        {lang === 'en' ? 'loans' : 'kredytów'}
                      </span>
                    )}
                  </div>
                  {gameState.settings.mutators?.noLoans && (
                    <div className="p-2.5 rounded bg-rose-950/45 border border-rose-500/50 text-xs text-rose-200">
                      {lang === 'en' ? (
                        <>
                          🚫 Active mutator <strong>"No Bank Loans"</strong> — new credit lines and bond issuance are disabled.
                        </>
                      ) : (
                        <>
                          🚫 Aktywny mutator <strong>„Bez Kredytów Bankowych”</strong> — zaciąganie nowych pożyczek i emisja obligacji są wyłączone.
                        </>
                      )}
                    </div>
                  )}
                  {mpLoanLimitReached && !gameState.settings.mutators?.noLoans && (
                    <div className="p-2 rounded bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200">
                      {lang === 'en'
                        ? '🔒 Maximum cap of 3 active Multiplayer loans reached. Pay off an existing loan below to unlock borrowing.'
                        : '🔒 Osiągnięto maksymalny limit 3 aktywnych kredytów w Multiplayerze. Spłać jeden z istniejących poniżej, aby odblokować finansowanie.'}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-slate-400 block mb-1">
                        {lang === 'en' ? 'Principal Amount' : 'Kwota Kapitału'}
                      </label>
                      <select
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(Number(e.target.value))}
                        className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 font-mono text-slate-100"
                      >
                        {[250_000, 500_000, 1_000_000, 2_500_000].map((v) => (
                          <option key={v} value={v}>
                            {formatMoney(v)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">
                        {lang === 'en' ? 'Repayment Term' : 'Okres Spłaty'}
                      </label>
                      <select
                        value={loanMonths}
                        onChange={(e) => setLoanMonths(Number(e.target.value))}
                        className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 font-mono text-slate-100"
                      >
                        <option value={6}>
                          {lang === 'en' ? '6 months (180 ticks)' : '6 miesięcy (180 cykli)'}
                        </option>
                        <option value={12}>
                          {lang === 'en' ? '12 months (360 ticks)' : '12 miesięcy (360 cykli)'}
                        </option>
                        <option value={24}>
                          {lang === 'en' ? '24 months (720 ticks)' : '24 miesiące (720 cykli)'}
                        </option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={mpLoanLimitReached || Boolean(gameState.settings.mutators?.noLoans)}
                        onClick={() => onTakeLoan(loanAmount, loanMonths)}
                        className="w-full py-2 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold"
                      >
                        {gameState.settings.mutators?.noLoans
                          ? lang === 'en'
                            ? 'Disabled (Mutator)'
                            : 'Wyłączone (Mutator)'
                          : mpLoanLimitReached
                            ? lang === 'en'
                              ? 'Limit 3/3 Reached'
                              : 'Limit 3/3 Osiągnięty'
                            : lang === 'en'
                              ? 'Take Loan'
                              : 'Zaciągnij Kredyt'}
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {lang === 'en' ? 'Base interest rate:' : 'Stopa bazowa:'}{' '}
                    {(gameState.baseInterestRate * 100).toFixed(1)}% · CIT: {(gameState.taxRate * 100).toFixed(0)}%
                  </div>
                </div>

                <div className="space-y-2">
                  {currentPlayer.loans.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 bg-[#0b0f17] rounded-lg border border-[#243044]">
                      {lang === 'en' ? 'No active credit obligations.' : 'Brak aktywnych zobowiązań kredytowych.'}
                    </div>
                  ) : (
                    currentPlayer.loans.map((l) => (
                      <div key={l.id} className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-100">
                            {(lang === 'en'
                              ? l.bankName === 'Własny Bank Inwestycyjny'
                                ? 'Own Investment Bank'
                                : l.bankName === 'Konsorcjum Bankowe'
                                  ? 'Banking Consortium'
                                  : l.bankName
                              : l.bankName)}{' '}
                            ({l.interestRate}% APR)
                          </div>
                          <div className="font-mono text-slate-400">
                            {lang === 'en' ? 'Remaining:' : 'Pozostało:'} {formatMoney(l.remainingAmount)} ·{' '}
                            {lang === 'en' ? 'Installment:' : 'Rata:'} {formatMoney(l.paymentPerTick)}/T ({l.remainingTicks}T)
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={currentPlayer.cash < l.remainingAmount}
                          onClick={() => onRepayLoan(l.id)}
                          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold"
                        >
                          {lang === 'en' ? 'Pay Off' : 'Spłać Całość'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

const PnLChart: React.FC<{ history: Player['financialHistory']; lang: 'pl' | 'en' }> = ({
  history,
  lang,
}) => {
  if (!history || history.length < 2) {
    return (
      <div className="text-slate-500 py-8 text-center">
        {lang === 'en' ? 'Collecting initial financial telemetry...' : 'Zbieranie pierwszych danych finansowych...'}
      </div>
    );
  }
  const width = 560;
  const height = 160;
  const padL = 56;
  const padR = 14;
  const padT = 12;
  const padB = 20;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxVal = Math.max(1000, ...history.map((h) => Math.max(h.revenue, h.costs)));
  const toY = (v: number) => padT + plotH - (v / maxVal) * plotH;

  const revPts = history
    .map((h, i) => `${padL + (i / (history.length - 1)) * plotW},${toY(h.revenue)}`)
    .join(' ');
  const costPts = history
    .map((h, i) => `${padL + (i / (history.length - 1)) * plotW},${toY(h.costs)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[0, 0.5, 1].map((t) => {
        const y = padT + plotH * t;
        const val = Math.round(maxVal * (1 - t));
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#1f2937" strokeDasharray="3 3" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
              {formatCompactMoney(val).replace(' zł', '')}
            </text>
          </g>
        );
      })}
      <polyline fill="none" stroke="#10b981" strokeWidth="2.2" points={revPts} />
      <polyline fill="none" stroke="#f43f5e" strokeWidth="2.2" points={costPts} />
    </svg>
  );
};
