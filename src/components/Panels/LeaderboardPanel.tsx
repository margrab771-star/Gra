import React, { useEffect, useState } from 'react';
import { getPvPDivisionById } from '../../data/battlePass';
import {
  MIN_TICKS_FOR_MATCH_COINS,
  fetchRegisteredMCoinLeaderboard,
  getActiveProfile,
  getRegisteredAccountsMCoinRanking,
  type RegisteredMCoinRankEntry,
} from '../../engine/profileManager';
import type { GameState, LeaderboardEntry, UserAccountProfile } from '../../engine/types';
import {
  fetchGlobalLeaderboard,
  isCloudLeaderboardConfigured,
} from '../../network/leaderboardService';
import { localizeAiStrategy, localizePvPDivisionLabel } from '../../i18n/dataTranslations';
import { useI18n } from '../../i18n/useI18n';
import { formatMoney } from '../../utils/formatters';
import { MCoinIcon } from '../HUD/MCoinIcon';

interface LeaderboardPanelProps {
  gameState: GameState | null;
  activeProfile?: UserAccountProfile;
  onOpenAuth?: () => void;
  onClose: () => void;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  gameState,
  activeProfile,
  onOpenAuth,
  onClose,
}) => {
  const { t, lang } = useI18n();
  const prof = activeProfile ?? getActiveProfile();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [coinEntries, setCoinEntries] = useState<RegisteredMCoinRankEntry[]>(() =>
    getRegisteredAccountsMCoinRanking(prof.id)
  );
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'global' | 'match' | 'mcoins'>(gameState ? 'match' : 'global');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchGlobalLeaderboard(), fetchRegisteredMCoinLeaderboard(prof.id)]).then(
      ([list, coinList]) => {
        if (active) {
          setEntries(list);
          setCoinEntries(coinList);
          setLoading(false);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [prof.id]);

  const matchStandings = gameState
    ? [...gameState.players].sort((a, b) => b.netWorth - a.netWorth)
    : [];

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-100">{t('lb.title')}</h2>
            <p className="text-xs text-slate-400">
              {isCloudLeaderboardConfigured() ? t('lb.cloudSub') : t('lb.localSub')}
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

        <div className="px-4 py-2 border-b border-[#243044] flex flex-wrap gap-2">
          {gameState && (
            <button
              type="button"
              onClick={() => setTab('match')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                tab === 'match'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('lb.tabMatch')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('global')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              tab === 'global'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('lb.tabGlobal')}
          </button>
          <button
            type="button"
            onClick={() => setTab('mcoins')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${
              tab === 'mcoins'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
            }`}
          >
            <MCoinIcon size={13} />
            <span>{t('lb.tabCoins')}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'mcoins' ? (
            <div className="space-y-3 text-xs">
              {prof.isGuest && (
                <div className="p-3 rounded-xl bg-amber-950/35 border border-amber-500/45 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-amber-200">🔒 {t('lb.guestGate')}</div>
                  {onOpenAuth && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAuth();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0"
                    >
                      {t('lb.createAccountBtn')}
                    </button>
                  )}
                </div>
              )}

              <div className="text-[11px] text-slate-400">
                {t('lb.coinsNote', { minTicks: MIN_TICKS_FOR_MATCH_COINS })}
              </div>

              {coinEntries.length === 0 ? (
                <div className="py-10 text-center text-slate-400">{t('lb.noCoinAccounts')}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 border-b border-[#243044] uppercase">
                      <tr>
                        <th className="py-2 pr-2">{t('lb.colRank')}</th>
                        <th className="py-2 pr-2">{t('lb.colCeo')}</th>
                        <th className="py-2 pr-2">{t('lb.colDivision')}</th>
                        <th className="py-2 pr-2 text-center">{t('lb.colLevel')}</th>
                        <th className="py-2 pr-2 text-center hidden sm:table-cell">{t('lb.colWins')}</th>
                        <th className="py-2 text-right">{t('lb.colCoins')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1b2434]">
                      {coinEntries.map((c) => {
                        const div = getPvPDivisionById(c.divisionId);
                        return (
                          <tr
                            key={c.id}
                            className={c.isCurrentUser ? 'bg-amber-500/10 text-amber-100' : 'text-slate-200'}
                          >
                            <td className="py-2.5 pr-2 font-mono font-bold text-amber-300">#{c.rank}</td>
                            <td className="py-2.5 pr-2">
                              <div className="flex items-center gap-2 font-semibold">
                                <span>{c.avatar}</span>
                                <span>
                                  {c.prestigeLevel > 0 ? '★'.repeat(Math.min(3, c.prestigeLevel)) + ' ' : ''}
                                  {c.nick}
                                </span>
                                {c.isCurrentUser && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono">
                                    {t('lb.youTag')}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 pr-2">
                              <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${div.badgeClass}`}>
                                {div.icon} {localizePvPDivisionLabel(div.id, div.label, lang)}
                              </span>
                            </td>
                            <td className="py-2.5 pr-2 text-center font-mono text-sky-300">LVL {c.level}</td>
                            <td className="py-2.5 pr-2 text-center font-mono text-slate-300 hidden sm:table-cell">
                              {c.matchesWon}
                            </td>
                            <td className="py-2.5 text-right font-mono font-bold text-amber-300">
                              <span className="inline-flex items-center gap-1 justify-end">
                                <MCoinIcon size={13} />
                                {c.mCoins} M
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : tab === 'match' && gameState ? (
            <div className="space-y-2">
              {matchStandings.map((p, idx) => (
                <div
                  key={p.id}
                  className={`p-3 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                    p.id === gameState.currentPlayerId
                      ? 'bg-emerald-950/25 border-emerald-500/40'
                      : 'bg-[#0b0f17] border-[#243044]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-amber-300 text-sm">#{idx + 1}</span>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <div>
                      <div className="font-semibold text-slate-100">
                        {p.companyName} {p.isAI ? '🤖' : '👤'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {p.name} · {localizeAiStrategy(p.dominantStrategy, p.dominantStrategy, lang)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sm font-bold text-slate-100">{formatMoney(p.netWorth)}</div>
                    <div className={p.cashFlowPerMin >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {p.cashFlowPerMin >= 0 ? '+' : ''}
                      {formatMoney(p.cashFlowPerMin)}/min
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className="py-10 text-center text-slate-400 text-sm">{t('lb.loading')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-[#243044] uppercase">
                  <tr>
                    <th className="py-2 pr-2">{t('lb.colRank')}</th>
                    <th className="py-2 pr-2">{t('lb.colCompany')}</th>
                    <th className="py-2 pr-2 hidden sm:table-cell">{t('lb.colStrategy')}</th>
                    <th className="py-2 pr-2 text-right">{t('lb.colNetWorth')}</th>
                    <th className="py-2 text-right">{t('lb.colDate')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2434]">
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className={e.isCurrentPlayer ? 'bg-emerald-500/10 text-emerald-100' : 'text-slate-200'}
                    >
                      <td className="py-2.5 pr-2 font-mono font-bold text-amber-300">{e.rank}</td>
                      <td className="py-2.5 pr-2">
                        <div className="font-semibold">{e.companyName}</div>
                        <div className="text-[11px] text-slate-400">{e.playerName}</div>
                      </td>
                      <td className="py-2.5 pr-2 hidden sm:table-cell text-slate-300">
                        {localizeAiStrategy(e.strategy, e.strategy, lang)}
                      </td>
                      <td className="py-2.5 pr-2 text-right font-mono font-bold text-emerald-400">
                        {formatMoney(e.netWorth)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-400">{e.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
