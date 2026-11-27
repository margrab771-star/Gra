import React from 'react';
import { useI18n } from '../../i18n/useI18n';

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
}

/** Elegancki przełącznik języka PL | EN w ciemnym motywie fintech */
export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  compact = false,
  className = '',
}) => {
  const { lang, setLang } = useI18n();

  return (
    <div
      role="group"
      aria-label="Language / Język"
      className={`inline-flex items-center rounded-lg bg-[#0b0f17] border border-[#243044] p-0.5 text-[11px] font-mono ${className}`}
    >
      <button
        type="button"
        onClick={() => setLang('pl')}
        className={`${compact ? 'px-2 py-0.5' : 'px-2.5 py-1'} rounded-md font-bold transition-colors ${
          lang === 'pl'
            ? 'bg-amber-500/20 border border-amber-400/60 text-amber-200'
            : 'text-slate-400 hover:text-slate-200 border border-transparent'
        }`}
      >
        PL
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`${compact ? 'px-2 py-0.5' : 'px-2.5 py-1'} rounded-md font-bold transition-colors ${
          lang === 'en'
            ? 'bg-sky-500/20 border border-sky-400/60 text-sky-200'
            : 'text-slate-400 hover:text-slate-200 border border-transparent'
        }`}
      >
        EN
      </button>
    </div>
  );
};
