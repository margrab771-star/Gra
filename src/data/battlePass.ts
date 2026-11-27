import type {
  BuildingType,
  HQVariantId,
  PlayerQuestProgress,
  PvPDivisionId,
  UiThemeId,
} from '../engine/types';
import { getIsoWeekAndYear } from './weeklyChallenge';

export const BATTLE_PASS_MAX_LEVEL = 30;
export const BATTLE_PASS_XP_PER_LEVEL = 250;
export const PRESTIGE_REQUIRED_ACCOUNT_LEVEL = 20;

export interface BattlePassRewardTier {
  level: number;
  title: string;
  preview: string;
  kind: 'mcoins' | 'title' | 'frame' | 'hq' | 'theme' | 'monument';
  mCoinsBonus?: number;
  cosmeticId?: string;
  hqVariantId?: HQVariantId;
  uiThemeId?: UiThemeId;
  monumentType?: BuildingType;
}

export const BATTLE_PASS_SEASON_1: BattlePassRewardTier[] = [
  { level: 1, title: '+60 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 60 },
  { level: 2, title: 'Pakiet Prezesa (+70 M)', preview: '🎖️', kind: 'mcoins', mCoinsBonus: 70 },
  { level: 3, title: '+80 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 80 },
  { level: 4, title: 'Ramka: Szmaragdowa Sieć', preview: '🟢', kind: 'frame', cosmeticId: 'frame_emerald', mCoinsBonus: 25 },
  { level: 5, title: 'Dekoracja 2.5D: Fontanna Korporacyjna', preview: '⛲', kind: 'monument', cosmeticId: 'mon_fountain', monumentType: 'monumentFountain' },
  { level: 6, title: '+90 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 90 },
  { level: 7, title: '+100 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 100 },
  { level: 8, title: 'Tytuł: Lider Wysokich Stawek', preview: '🏷️', kind: 'title', cosmeticId: 'title_high_stakes', mCoinsBonus: 40 },
  { level: 9, title: '+105 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 105 },
  { level: 10, title: 'Dekoracja 2.5D: Obelisk Wall Street', preview: '🗼', kind: 'monument', cosmeticId: 'mon_obelisk', monumentType: 'monumentObelisk', mCoinsBonus: 50 },
  { level: 11, title: '+110 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 110 },
  { level: 12, title: 'HQ: Złota Wieża Fortuny', preview: '🏛️', kind: 'hq', cosmeticId: 'hq_golden', hqVariantId: 'golden' },
  { level: 13, title: '+120 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 120 },
  { level: 14, title: 'Skórka HQ: Monolit Obsydianowy', preview: '🖤', kind: 'hq', cosmeticId: 'hq_monolith', hqVariantId: 'monolith_obsidian' },
  { level: 15, title: 'Motyw UI: Emerald Terminal + Ramka Neon', preview: '🟩', kind: 'theme', cosmeticId: 'theme_emerald', uiThemeId: 'theme_emerald', mCoinsBonus: 50 },
  { level: 16, title: '+125 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 125 },
  { level: 17, title: 'Ramka (Anim.): Neonowy Impuls', preview: '💠', kind: 'frame', cosmeticId: 'frame_neon_pulse' },
  { level: 18, title: 'Tytuł: Baron Wall Street', preview: '💼', kind: 'title', cosmeticId: 'title_bp_tycoon', mCoinsBonus: 60 },
  { level: 19, title: '+130 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 130 },
  { level: 20, title: 'Dekoracja 2.5D: Lądowisko Odrzutowców', preview: '🛩️', kind: 'monument', cosmeticId: 'mon_helipad', monumentType: 'monumentHelipad', mCoinsBonus: 90 },
  { level: 21, title: '+140 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 140 },
  { level: 22, title: 'Motyw UI: Crimson War Room', preview: '🟥', kind: 'theme', cosmeticId: 'theme_crimson', uiThemeId: 'theme_crimson' },
  { level: 23, title: '+150 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 150 },
  { level: 24, title: 'HQ: Cytadela Cybernetyczna', preview: '⚡', kind: 'hq', cosmeticId: 'hq_cyber_citadel', hqVariantId: 'cyber_citadel' },
  { level: 25, title: 'Motyw UI: Wall Street Gold + Złota Aura', preview: '🟨', kind: 'theme', cosmeticId: 'theme_gold', uiThemeId: 'theme_gold', mCoinsBonus: 75 },
  { level: 26, title: 'Ramka (Anim.): Złota Aura Giełdy', preview: '✨', kind: 'frame', cosmeticId: 'frame_golden_aura' },
  { level: 27, title: '+175 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 175 },
  { level: 28, title: 'Skórka HQ: Platynowa Iglica Prestiżu', preview: '💎', kind: 'hq', cosmeticId: 'hq_platinum', hqVariantId: 'platinum_spire' },
  { level: 29, title: '+210 Monet M', preview: '🪙', kind: 'mcoins', mCoinsBonus: 210 },
  { level: 30, title: 'Finał S1: Złoty Pomnik Założyciela + 300 M', preview: '🗽', kind: 'monument', cosmeticId: 'mon_founder', monumentType: 'monumentFounder', mCoinsBonus: 300 },
];

export function computeBattlePassLevel(bpXp: number): {
  level: number;
  intoLevelXp: number;
  neededPerLevel: number;
  progressPct: number;
} {
  const safeXp = Math.max(0, Math.floor(bpXp));
  const rawLevel = Math.min(BATTLE_PASS_MAX_LEVEL, Math.floor(safeXp / BATTLE_PASS_XP_PER_LEVEL));
  const intoLevelXp =
    rawLevel >= BATTLE_PASS_MAX_LEVEL ? BATTLE_PASS_XP_PER_LEVEL : safeXp % BATTLE_PASS_XP_PER_LEVEL;
  const progressPct = Math.round((intoLevelXp / BATTLE_PASS_XP_PER_LEVEL) * 100);
  return {
    level: rawLevel,
    intoLevelXp,
    neededPerLevel: BATTLE_PASS_XP_PER_LEVEL,
    progressPct,
  };
}

export interface PvPDivisionMeta {
  id: PvPDivisionId;
  label: string;
  icon: string;
  badgeClass: string;
  minPoints: number;
  nextThreshold: number | null;
}

export const PVP_DIVISIONS: PvPDivisionMeta[] = [
  {
    id: 'startup',
    label: 'Start-up',
    icon: '🌱',
    badgeClass: 'bg-slate-800/80 border-slate-500/40 text-slate-200',
    minPoints: 0,
    nextThreshold: 5,
  },
  {
    id: 'investor',
    label: 'Inwestor',
    icon: '📈',
    badgeClass: 'bg-emerald-950/60 border-emerald-400/50 text-emerald-300',
    minPoints: 5,
    nextThreshold: 15,
  },
  {
    id: 'director',
    label: 'Dyrektor',
    icon: '💼',
    badgeClass: 'bg-sky-950/60 border-sky-400/55 text-sky-200',
    minPoints: 15,
    nextThreshold: 35,
  },
  {
    id: 'oligarch',
    label: 'Oligarcha',
    icon: '🏛️',
    badgeClass: 'bg-purple-950/60 border-purple-400/55 text-purple-200',
    minPoints: 35,
    nextThreshold: 70,
  },
  {
    id: 'magnate',
    label: 'Magnat',
    icon: '👑',
    badgeClass: 'bg-amber-950/70 border-amber-400/75 text-amber-200',
    minPoints: 70,
    nextThreshold: null,
  },
];

export function computePvPDivision(
  pvpMatches = 0,
  pvpWins = 0,
  prestigeLevel = 0
): PvPDivisionMeta & { points: number } {
  const points = Math.max(0, pvpMatches * 2 + pvpWins * 5 + prestigeLevel * 10);
  let matched = PVP_DIVISIONS[0];
  for (const d of PVP_DIVISIONS) {
    if (points >= d.minPoints) matched = d;
  }
  return { ...matched, points };
}

export function getPvPDivisionById(id?: PvPDivisionId): PvPDivisionMeta {
  return PVP_DIVISIONS.find((d) => d.id === id) ?? PVP_DIVISIONS[0];
}

// ─── System Zadań Dziennych i Tygodniowych ────────────────────────────────────

interface QuestTemplate {
  id: string;
  period: 'daily' | 'weekly';
  title: string;
  description: string;
  metric: PlayerQuestProgress['metric'];
  target: number;
  bpXpReward: number;
  mCoinReward: number;
}

const DAILY_QUEST_POOL: QuestTemplate[] = [
  {
    id: 'dq_b2b_2',
    period: 'daily',
    title: 'Kontraktowy Negocjator',
    description: 'Zakończ lub zrealizuj 2 kontrakty B2B na rynku.',
    metric: 'b2b_completed',
    target: 2,
    bpXpReward: 160,
    mCoinReward: 45,
  },
  {
    id: 'dq_bridge_1',
    period: 'daily',
    title: 'Inżynier Przepraw Rzecznych',
    description: 'Wybuduj Most Drogowy łączący brzegi rzeki.',
    metric: 'bridge_built',
    target: 1,
    bpXpReward: 150,
    mCoinReward: 40,
  },
  {
    id: 'dq_self_fuel_50',
    period: 'daily',
    title: 'Samowystarczalna Energetyka',
    description: 'Zasil elektrownię paliwem z własnej sieci przez 50 tur pracy.',
    metric: 'self_fueled_ticks',
    target: 50,
    bpXpReward: 190,
    mCoinReward: 55,
  },
  {
    id: 'dq_roads_6',
    period: 'daily',
    title: 'Kręgosłup Asfaltowy',
    description: 'Wybuduj co najmniej 6 odcinków dróg lub autostrad.',
    metric: 'road_built',
    target: 6,
    bpXpReward: 140,
    mCoinReward: 35,
  },
  {
    id: 'dq_plots_8',
    period: 'daily',
    title: 'Ekspansja Terytorialna',
    description: 'Posiadaj równocześnie 8 działek na mapie w jednym meczu.',
    metric: 'owned_plots',
    target: 8,
    bpXpReward: 150,
    mCoinReward: 40,
  },
];

const WEEKLY_QUEST_POOL: QuestTemplate[] = [
  {
    id: 'wq_b2b_6',
    period: 'weekly',
    title: 'Baron Handlu B2B',
    description: 'Zakończ łącznie 6 kontraktów B2B pomiędzy sesjami.',
    metric: 'b2b_completed',
    target: 6,
    bpXpReward: 380,
    mCoinReward: 110,
  },
  {
    id: 'wq_green_4',
    period: 'weekly',
    title: 'Zielony Ład Korporacji',
    description: 'Utrzymuj łącznie 4 aktywne obiekty OZE lub ekologii.',
    metric: 'green_buildings',
    target: 4,
    bpXpReward: 340,
    mCoinReward: 100,
  },
  {
    id: 'wq_podium_2',
    period: 'weekly',
    title: 'Podium Wall Street',
    description: 'Ukończ 2 rozgrywki w Top 2 lub wygraj mecz.',
    metric: 'podium_win',
    target: 2,
    bpXpReward: 440,
    mCoinReward: 135,
  },
  {
    id: 'wq_self_fuel_150',
    period: 'weekly',
    title: 'Niezależność Surowcowa',
    description: 'Przepracuj 150 tur pracy elektrowni na własnym paliwie.',
    metric: 'self_fueled_ticks',
    target: 150,
    bpXpReward: 410,
    mCoinReward: 120,
  },
];

export function getLocalDayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getLocalWeekKey(date = new Date()): string {
  const { year, week } = getIsoWeekAndYear(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickFromPool(pool: QuestTemplate[], seedStr: string, count: number): QuestTemplate[] {
  const h = hashKey(seedStr);
  const picked: QuestTemplate[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const idx = (h + i * 2) % pool.length;
    const cand = pool[idx];
    if (!picked.some((p) => p.id === cand.id)) picked.push(cand);
    else {
      const next = pool.find((x) => !picked.some((p) => p.id === x.id));
      if (next) picked.push(next);
    }
  }
  return picked;
}

export function generateQuestsForDate(date = new Date()): {
  dayKey: string;
  weekKey: string;
  daily: PlayerQuestProgress[];
  weekly: PlayerQuestProgress[];
} {
  const dayKey = getLocalDayKey(date);
  const weekKey = getLocalWeekKey(date);
  const dailies = pickFromPool(DAILY_QUEST_POOL, dayKey, 3).map((q) => ({
    ...q,
    progress: 0,
    completed: false,
    claimed: false,
  }));
  const weeklies = pickFromPool(WEEKLY_QUEST_POOL, weekKey, 2).map((q) => ({
    ...q,
    progress: 0,
    completed: false,
    claimed: false,
  }));
  return { dayKey, weekKey, daily: dailies, weekly: weeklies };
}
