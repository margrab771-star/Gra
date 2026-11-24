import React, { useEffect, useState } from 'react';
import type { GameState, LeaderboardEntry } from '../../engine/types';
import {
  fetchGlobalLeaderboard,
  isCloudLeaderboardConfigured,
} from '../../network/leaderboardService';
import { formatMoney } from '../../utils/formatters';

interface LeaderboardPanelProps {
  gameState: GameState | null;
  onClose: () => void;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({ gameState, onClose }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'global' | 'match'>(gameState ? 'match' : 'global');

  useEffect(() => {
    let active = true;
    fetchGlobalLeaderboard().then((list) => {
      if (active) {
        setEntries(list);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const matchStandings = gameState
    ? [...gameState.players].sort((a, b) => b.netWorth - a.netWorth)
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-100">
              🏆 Światowa Tabela Wyników & Ranking Partii
            </h2>
            <p className="text-xs text-slate-400">
              {isCloudLeaderboardConfigured()
                ? 'Połączono z bazą chmurową Supabase + pamięć lokalna'
                : 'Tryb lokalny offline (localStorage + opcjonalny adapter Supabase w .env)'}
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

        {gameState && (
          <div className="px-4 py-2 border-b border-[#243044] flex gap-2">
            <button
              type="button"
              onClick={() => setTab('match')}
              className={`px-3 py-1 rounded text-xs font-semibold border ${
                tab === 'match'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-[#0b0f17] border-[#243044] text-slate-400'
              }`}
            >
              Aktualna Partia
            </button>
            <button
              type="button"
              onClick={() => setTab('global')}
              className={`px-3 py-1 rounded text-xs font-semibold border ${
                tab === 'global'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-[#0b0f17] border-[#243044] text-slate-400'
              }`}
            >
              Światowa Tabela Rekordów
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'match' && gameState ? (
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
                        {p.name} · {p.dominantStrategy}
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
            <div className="py-10 text-center text-slate-400 text-sm">Ładowanie tabeli wyników...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-[#243044] uppercase">
                  <tr>
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Gracz / Firma</th>
                    <th className="py-2 pr-2 hidden sm:table-cell">Dominująca Strategia</th>
                    <th className="py-2 pr-2 text-right">Wycena Netto</th>
                    <th className="py-2 text-right">Data</th>
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
                      <td className="py-2.5 pr-2 hidden sm:table-cell text-slate-300">{e.strategy}</td>
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
