import React from 'react';
import { getWeeklyChallengeSpec } from '../../data/weeklyChallenge';
import type { UserAccountProfile } from '../../engine/types';
import { formatCompactMoney, formatMoney } from '../../utils/formatters';

interface WeeklyChallengeModalProps {
  profile: UserAccountProfile;
  onStartChallenge: () => void;
  onClose: () => void;
}

export const WeeklyChallengeModal: React.FC<WeeklyChallengeModalProps> = ({
  profile,
  onStartChallenge,
  onClose,
}) => {
  const spec = getWeeklyChallengeSpec();
  const best =
    profile.records.weeklyBestScore?.weekKey === spec.weekKey
      ? profile.records.weeklyBestScore
      : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-xl rounded-2xl bg-[#111827] border border-amber-500/50 p-5 md:p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between border-b border-[#243044] pb-3 gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono text-[10px] uppercase">
              🏆 Oficjalne Wyzwanie Tygodnia · {spec.weekKey}
            </div>
            <h2 className="text-xl font-extrabold text-white mt-1.5">{spec.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1c2434] text-slate-300 hover:text-white flex items-center justify-center shrink-0"
          >
            ✕
          </button>
        </div>

        <p className="text-xs md:text-sm text-slate-300 leading-relaxed">{spec.description}</p>

        <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-[#1b2434]">
            <span>Deterministyczny Seed Mapy: <strong className="font-mono text-sky-300">#{spec.seed}</strong></span>
            <span>Cel wyceny: <strong className="font-mono text-emerald-300">{formatMoney(spec.targetNetWorth)}</strong></span>
          </div>
          <ul className="space-y-1.5 text-slate-200">
            {spec.rulesBulletList.map((rule, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-400">▸</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/35 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <div className="text-amber-300 font-semibold">🎁 Nagroda za ukończenie wyzwania</div>
            <div className="text-[11px] text-slate-300">
              Odznaka „{spec.badgeName}” + {spec.xpBonus} XP Profilu + wpis do Księgi Rekordów
            </div>
          </div>
          {best ? (
            <div className="text-right font-mono">
              <div className="text-emerald-300 font-bold">Twój rekord: {formatCompactMoney(best.netWorth)}</div>
              <div className="text-[11px] text-slate-400">{best.ticks} dni gry</div>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 font-mono">Brak podejścia w tym tyg.</span>
          )}
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onStartChallenge}
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg"
          >
            🚀 Rozpocznij Wyzwanie Tygodnia
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-[#1a2438] border border-[#243044] text-slate-300 text-xs font-semibold"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
