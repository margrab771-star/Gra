import React, { useEffect, useState } from 'react';
import {
  BATTLE_PASS_MAX_LEVEL,
  BATTLE_PASS_SEASON_1,
  computeBattlePassLevel,
  computePvPDivision,
} from '../../data/battlePass';
import { claimBattlePassReward } from '../../engine/profileManager';
import type { UserAccountProfile } from '../../engine/types';
import { MCoinIcon } from '../HUD/MCoinIcon';

interface BattlePassModalProps {
  profile: UserAccountProfile;
  onUpdateProfile: (profile: UserAccountProfile) => void;
  onClose: () => void;
}

export const BattlePassModal: React.FC<BattlePassModalProps> = ({
  profile,
  onUpdateProfile,
  onClose,
}) => {
  const [tab, setTab] = useState<'pass' | 'quests'>('pass');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const bp = computeBattlePassLevel(profile.battlePassXp);
  const division = computePvPDivision(profile.pvpMatches, profile.pvpWins, profile.prestigeLevel);
  const quests = profile.questState?.quests ?? [];
  const dailyQuests = quests.filter((q) => q.period === 'daily');
  const weeklyQuests = quests.filter((q) => q.period === 'weekly');

  const claimableLevels = BATTLE_PASS_SEASON_1.filter(
    (t) => bp.level >= t.level && !profile.claimedPassLevels.includes(t.level)
  ).map((t) => t.level);

  const handleClaim = (lvl: number) => {
    const res = claimBattlePassReward(profile, lvl);
    if (res.ok) {
      onUpdateProfile(res.profile);
      setFeedback(res.message ?? `Odebrano Poziom ${lvl}!`);
    }
  };

  const handleClaimAll = () => {
    let cur = profile;
    let count = 0;
    for (const lvl of claimableLevels) {
      const res = claimBattlePassReward(cur, lvl);
      if (res.ok) {
        cur = res.profile;
        count++;
      }
    }
    if (count > 0) {
      onUpdateProfile(cur);
      setFeedback(`Odebrano ${count} nagród z Karnetu Sezon 1!`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111827] border border-sky-500/45 shadow-2xl flex flex-col">
        <div className="sticky top-0 z-20 px-5 py-4 bg-[#0b0f17]/95 backdrop-blur-md border-b border-[#243044] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <span>🎖️ Karnet Prezesa — Sezon 1</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono">
                100% DARMOWY
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Rozgrywaj mecze i wykonuj Zadania Dzienne/Tygodniowe, aby odblokować 30 poziomów nagród
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="px-2.5 py-1 rounded-lg bg-[#151c28] border border-[#243044] text-amber-200 font-mono text-xs font-bold flex items-center gap-1.5">
              <MCoinIcon size={15} />
              <span>{profile.mCoins} M</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-[#1c2434] hover:bg-[#2a364d] border border-[#2d3b52] text-xs font-semibold text-slate-200"
            >
              ✕ Zamknij
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Pasek Postępu Karnetu + Dywizja PvP */}
          <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-400/50 font-mono font-bold text-sky-200 text-sm">
                  Poziom {bp.level} / {BATTLE_PASS_MAX_LEVEL}
                </span>
                <span className={`px-2 py-1 rounded-lg border text-[11px] font-semibold ${division.badgeClass}`}>
                  {division.icon} Dywizja: {division.label} ({division.points} pkt)
                </span>
              </div>

              {claimableLevels.length > 0 && (
                <button
                  type="button"
                  onClick={handleClaimAll}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow animate-pulse"
                >
                  🎁 Odbierz wszystkie ({claimableLevels.length})
                </button>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Postęp do poziomu {Math.min(BATTLE_PASS_MAX_LEVEL, bp.level + 1)}</span>
                <span className="font-mono text-sky-300">
                  {bp.intoLevelXp} / {bp.neededPerLevel} BP XP ({bp.progressPct}%)
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[#151c28] border border-[#243044] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 via-emerald-400 to-amber-400 transition-all"
                  style={{ width: `${bp.level >= BATTLE_PASS_MAX_LEVEL ? 100 : bp.progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {feedback && (
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-400/50 text-emerald-200 font-semibold">
              ✅ {feedback}
            </div>
          )}

          {/* Zakładki */}
          <div className="flex gap-2 border-b border-[#243044] pb-2">
            <button
              type="button"
              onClick={() => setTab('pass')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold ${
                tab === 'pass'
                  ? 'bg-sky-500/20 border border-sky-400 text-sky-200'
                  : 'bg-[#0b0f17] text-slate-400'
              }`}
            >
              🎖️ Ścieżka Nagród (1–30)
            </button>
            <button
              type="button"
              onClick={() => setTab('quests')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold ${
                tab === 'quests'
                  ? 'bg-amber-500/20 border border-amber-400 text-amber-200'
                  : 'bg-[#0b0f17] text-slate-400'
              }`}
            >
              🎯 Zadania Dzienne & Tygodniowe ({quests.filter((q) => !q.completed).length} aktywne)
            </button>
          </div>

          {tab === 'pass' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {BATTLE_PASS_SEASON_1.map((tier) => {
                const unlocked = bp.level >= tier.level;
                const claimed = profile.claimedPassLevels.includes(tier.level);
                const isMilestone = tier.level % 5 === 0;

                return (
                  <div
                    key={tier.level}
                    className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                      claimed
                        ? 'bg-[#0b141a] border-emerald-500/40'
                        : unlocked
                          ? 'bg-[#121e30] border-amber-400/70'
                          : isMilestone
                            ? 'bg-[#0e1524] border-sky-500/35 opacity-85'
                            : 'bg-[#0b0f17] border-[#243044] opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#182235] border border-[#2d3b52] font-mono text-[10px] font-bold text-slate-200">
                          LVL {tier.level}
                        </span>
                        <span className="text-xl">{tier.preview}</span>
                      </div>
                      {claimed && (
                        <span className="text-[10px] font-bold text-emerald-400">✓ Odebrane</span>
                      )}
                    </div>

                    <div className="font-semibold text-slate-100 leading-snug">{tier.title}</div>

                    {claimed ? (
                      <div className="py-1 text-center rounded bg-emerald-950/35 text-[11px] text-emerald-300">
                        Odblokowano na koncie
                      </div>
                    ) : unlocked ? (
                      <button
                        type="button"
                        onClick={() => handleClaim(tier.level)}
                        className="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                      >
                        🎁 Odbierz Nagrodę
                      </button>
                    ) : (
                      <div className="py-1 text-center rounded bg-[#151c28] text-[10px] text-slate-500 font-mono">
                        🔒 Wymaga LVL {tier.level}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                  ☀️ Zadania Dzienne ({profile.questState?.dayKey})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {dailyQuests.map((q) => {
                    const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100));
                    return (
                      <div
                        key={q.id}
                        className={`p-3 rounded-xl border space-y-2 ${
                          q.completed
                            ? 'bg-emerald-950/25 border-emerald-500/45'
                            : 'bg-[#0b0f17] border-[#243044]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-white">{q.title}</span>
                          {q.completed && <span className="text-[10px] text-emerald-300 font-bold">✓ UKOŃCZONE</span>}
                        </div>
                        <p className="text-[11px] text-slate-400">{q.description}</p>
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px] text-slate-300">
                            <span>Postęp: {q.progress} / {q.target}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#151c28] overflow-hidden">
                            <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1 text-[11px] font-mono">
                          <span className="text-sky-300">+{q.bpXpReward} BP XP</span>
                          <span className="text-amber-300 flex items-center gap-1">
                            <MCoinIcon size={12} />+{q.mCoinReward} M
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-sky-300 uppercase tracking-wider text-[11px]">
                  📅 Zadania Tygodniowe ({profile.questState?.weekKey})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {weeklyQuests.map((q) => {
                    const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100));
                    return (
                      <div
                        key={q.id}
                        className={`p-3.5 rounded-xl border space-y-2 ${
                          q.completed
                            ? 'bg-emerald-950/25 border-emerald-500/45'
                            : 'bg-[#0b0f17] border-[#243044]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-white text-sm">{q.title}</span>
                          {q.completed && <span className="text-[10px] text-emerald-300 font-bold">✓ UKOŃCZONE</span>}
                        </div>
                        <p className="text-[11px] text-slate-300">{q.description}</p>
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px] text-slate-300">
                            <span>Postęp: {q.progress} / {q.target}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-[#151c28] overflow-hidden">
                            <div className="h-full bg-sky-400" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pt-1 text-[11px] font-mono">
                          <span className="text-sky-300 font-semibold">+{q.bpXpReward} BP XP</span>
                          <span className="text-amber-300 font-semibold flex items-center gap-1">
                            <MCoinIcon size={13} />+{q.mCoinReward} M
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
