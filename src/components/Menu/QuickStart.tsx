import React from 'react';
import { TUTORIAL_STEPS } from '../../config/gameConfig';

interface QuickStartProps {
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

export const QuickStart: React.FC<QuickStartProps> = ({ step, onNext, onSkip }) => {
  const current = TUTORIAL_STEPS[step];
  if (!current) return null;
  const isLast = step >= TUTORIAL_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-end md:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#111827] border border-amber-400/60 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px]">
            SAMOUCZEK {step + 1} / {TUTORIAL_STEPS.length}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Pomiń
          </button>
        </div>

        <h3 className="text-lg font-bold text-slate-100">{current.title}</h3>
        <p className="text-xs md:text-sm text-slate-300 leading-relaxed">{current.content}</p>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={isLast ? onSkip : onNext}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
          >
            {isLast ? 'Zaczynamy!' : 'Dalej →'}
          </button>
        </div>
      </div>
    </div>
  );
};
