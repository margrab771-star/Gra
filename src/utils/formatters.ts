import type { GameTime } from '../engine/types';
import { getCurrentLanguage, type Language } from '../i18n';

const INTL_INT: Record<Language, Intl.NumberFormat> = {
  pl: new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  en: new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
};

const INTL_DEC: Record<Language, Intl.NumberFormat> = {
  pl: new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  en: new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
};

const INTL_TWO: Record<Language, Intl.NumberFormat> = {
  pl: new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  en: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};

export function formatMoney(amount: number, overrideLang?: Language): string {
  const lang = overrideLang ?? getCurrentLanguage();
  if (!Number.isFinite(amount)) return lang === 'en' ? '$0' : '0 zł';
  const rounded = Math.round(amount);
  const absFormatted = INTL_INT[lang].format(Math.abs(rounded));
  const sign = rounded < 0 ? '-' : '';
  return lang === 'en' ? `${sign}$${absFormatted}` : `${sign}${absFormatted} zł`;
}

export function formatCompactMoney(amount: number, overrideLang?: Language): string {
  const lang = overrideLang ?? getCurrentLanguage();
  if (!Number.isFinite(amount)) return lang === 'en' ? '$0' : '0 zł';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (lang === 'en') {
    if (abs >= 1_000_000_000) return `${sign}$${INTL_TWO.en.format(abs / 1_000_000_000)}B`;
    if (abs >= 1_000_000) return `${sign}$${INTL_TWO.en.format(abs / 1_000_000)}M`;
    if (abs >= 10_000) return `${sign}$${INTL_DEC.en.format(abs / 1_000)}K`;
    return `${sign}$${INTL_INT.en.format(Math.round(abs))}`;
  }
  if (abs >= 1_000_000_000) return `${sign}${INTL_TWO.pl.format(abs / 1_000_000_000)} mld zł`;
  if (abs >= 1_000_000) return `${sign}${INTL_TWO.pl.format(abs / 1_000_000)} mln zł`;
  if (abs >= 10_000) return `${sign}${INTL_DEC.pl.format(abs / 1_000)} tys. zł`;
  return `${sign}${INTL_INT.pl.format(Math.round(abs))} zł`;
}

export function formatNumber(amount: number, overrideLang?: Language): string {
  const lang = overrideLang ?? getCurrentLanguage();
  if (!Number.isFinite(amount)) return '0';
  return INTL_INT[lang].format(Math.round(amount));
}

export function formatDecimal(amount: number, overrideLang?: Language): string {
  const lang = overrideLang ?? getCurrentLanguage();
  if (!Number.isFinite(amount)) return lang === 'en' ? '0.0' : '0,0';
  return INTL_DEC[lang].format(amount);
}

export function formatPercent(value: number, showPlus = true, overrideLang?: Language): string {
  const lang = overrideLang ?? getCurrentLanguage();
  if (!Number.isFinite(value)) return lang === 'en' ? '0.0%' : '0,0%';
  const prefix = showPlus && value > 0 ? '+' : '';
  return `${prefix}${INTL_DEC[lang].format(value)}%`;
}

export function formatTimeRemaining(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const MONTHS_PL = [
  'Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze',
  'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru',
];

const MONTHS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatGameDate(time: GameTime, overrideLang?: Language): string {
  const lang = overrideLang ?? getCurrentLanguage();
  const idx = (time.month - 1) % 12;
  if (lang === 'en') {
    const m = MONTHS_EN[idx] ?? 'Jan';
    return `${m} ${time.day}, ${time.year}`;
  }
  const m = MONTHS_PL[idx] ?? 'Sty';
  return `${String(time.day).padStart(2, '0')} ${m} ${time.year}`;
}
