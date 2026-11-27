import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { markSplashIntroSeen } from '../../utils/splashStorage';

interface SplashIntroProps {
  onFinish: () => void;
}

export const SplashIntro: React.FC<SplashIntroProps> = ({ onFinish }) => {
  const { t } = useI18n();
  const [fadingOut, setFadingOut] = useState(false);

  const dismiss = () => {
    markSplashIntroSeen();
    setFadingOut(true);
    window.setTimeout(() => onFinish(), 280);
  };

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      markSplashIntroSeen();
      setFadingOut(true);
    }, 1750);
    const doneTimer = window.setTimeout(() => {
      markSplashIntroSeen();
      onFinish();
    }, 2150);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        clearTimeout(fadeTimer);
        clearTimeout(doneTimer);
        markSplashIntroSeen();
        onFinish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onFinish]);

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[100] bg-[#060910] flex flex-col items-center justify-center p-6 cursor-pointer select-none transition-opacity duration-300 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Tło siatki fintech i animowanego wykresu giełdowego */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <svg
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-12 w-full h-56 opacity-35 pointer-events-none"
      >
        <defs>
          <linearGradient id="splash-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <path
          d="M 0 260 L 120 235 L 220 250 L 340 190 L 450 205 L 580 135 L 700 155 L 820 88 L 950 112 L 1080 48 L 1200 62"
          fill="none"
          stroke="url(#splash-line-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="splash-chart-draw"
        />
      </svg>

      <div className="relative z-10 text-center space-y-4 animate-scaleIn">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/25 via-[#111827] to-sky-500/20 border border-amber-400/60 shadow-[0_0_40px_rgba(245,158,11,0.3)] flex items-center justify-center">
          <svg width="46" height="46" viewBox="0 0 48 48" fill="none">
            <polygon points="24,4 42,14 42,34 24,44 6,34 6,14" stroke="#f59e0b" strokeWidth="2.4" fill="rgba(245,158,11,0.12)" />
            <path d="M13 31V17H17.6L24 25.5L30.4 17H35V31H30.8V23.2L25.1 30.2H22.9L17.2 23.2V31H13Z" fill="#fde047" />
          </svg>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-mono tracking-[0.28em] text-amber-300 uppercase">
            v1.0 RELEASE EDITION
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white">
            MARKET <span className="text-amber-400">DOMINION</span>
          </h1>
          <p className="text-sm md:text-base text-slate-300 font-medium">{t('splash.subtitle')}</p>
          <p className="text-xs font-mono text-sky-300/80">{t('splash.tagline')}</p>
        </div>

        <div className="w-56 h-1 mx-auto rounded-full bg-[#151c28] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-sky-400 via-amber-400 to-emerald-400 splash-progress-fill" />
        </div>
      </div>

      <div className="absolute bottom-5 text-[11px] font-mono text-slate-500">
        {t('splash.skip')}
      </div>
    </div>
  );
};
