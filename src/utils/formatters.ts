import type { GameTime } from '../engine/types';

const plInt = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const plDecimal = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const plTwoDec = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '0 zł';
  return `${plInt.format(Math.round(amount))} zł`;
}

export function formatCompactMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '0 zł';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${plTwoDec.format(abs / 1_000_000_000)} mld zł`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${plTwoDec.format(abs / 1_000_000)} mln zł`;
  }
  if (abs >= 10_000) {
    return `${sign}${plDecimal.format(abs / 1_000)} tys. zł`;
  }
  return `${sign}${plInt.format(Math.round(abs))} zł`;
}

export function formatNumber(amount: number): string {
  if (!Number.isFinite(amount)) return '0';
  return plInt.format(Math.round(amount));
}

export function formatDecimal(amount: number): string {
  if (!Number.isFinite(amount)) return '0,0';
  return plDecimal.format(amount);
}

export function formatPercent(value: number, showPlus = true): string {
  if (!Number.isFinite(value)) return '0,0%';
  const prefix = showPlus && value > 0 ? '+' : '';
  return `${prefix}${plDecimal.format(value)}%`;
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

export function formatGameDate(time: GameTime): string {
  const m = MONTHS_PL[(time.month - 1) % 12] ?? 'Sty';
  return `${String(time.day).padStart(2, '0')} ${m} ${time.year}`;
}
