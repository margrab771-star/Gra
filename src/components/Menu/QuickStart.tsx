import React from 'react';
import { TUTORIAL_STEPS } from '../../config/gameConfig';
import { localizeTutorialStep } from '../../i18n/dataTranslations';
import { useI18n } from '../../i18n/useI18n';

interface QuickStartProps {
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

export const QuickStart: React.FC<QuickStartProps> = ({ step, onNext, onSkip }) => {
  const { lang, t } = useI18n();
  const raw = TUTORIAL_STEPS[step];
  if (!raw) return null;
  const current = localizeTutorialStep(raw, step, lang);
  const isLast = step >= TUTORIAL_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-end md:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#111827] border border-amber-400/60 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px]">
            {t('qs.badge', { step: step + 1, total: TUTORIAL_STEPS.length })}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            {t('qs.skip')}
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
            {isLast ? t('qs.finish') : t('qs.next')}
          </button>
        </div>
      </div>
    </div>
  );
};
