import {
  ACHIEVEMENTS,
  type AchievementDefinition,
} from '../data/achievements';
import {
  BATTLE_PASS_SEASON_1,
  PRESTIGE_REQUIRED_ACCOUNT_LEVEL,
  computeBattlePassLevel,
  computePvPDivision,
  generateQuestsForDate,
  getLocalDayKey,
  getLocalWeekKey,
} from '../data/battlePass';
import {
  SHOP_ITEMS,
  computeRewardMultiplier,
  getUnlockedMonumentsForProfile,
} from '../data/shopCatalog';
import { getCurrentLanguage } from '../i18n';
import { localizeBattlePassTierTitle, localizeShopItem } from '../i18n/dataTranslations';
import type {
  GameState,
  HQVariantId,
  MatchRecordEntry,
  Player,
  PlayerCardProfile,
  PlayerQuestProgress,
  ProfileQuestState,
  ScenarioId,
  UiThemeId,
  UserAccountProfile,
} from './types';

const ACCOUNTS_DB_KEY = 'market_dominion_accounts_db_v1';
const ACTIVE_ACCOUNT_ID_KEY = 'market_dominion_active_account_v1';
const QUEST_WATERMARK_KEY = 'market_dominion_quest_watermarks_v1';
export const MIN_TICKS_FOR_MATCH_COINS = 12;

export function applyUiThemeToDocument(themeId?: UiThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.uiTheme = themeId ?? 'theme_fintech';
}

function ensureQuestStateUpToDate(existing?: ProfileQuestState, now = new Date()): ProfileQuestState {
  const dayKey = getLocalDayKey(now);
  const weekKey = getLocalWeekKey(now);
  const fresh = generateQuestsForDate(now);
  if (!existing) {
    return {
      dayKey,
      weekKey,
      quests: [...fresh.daily, ...fresh.weekly],
    };
  }
  const keptDaily =
    existing.dayKey === dayKey
      ? existing.quests.filter((q) => q.period === 'daily')
      : fresh.daily;
  const keptWeekly =
    existing.weekKey === weekKey
      ? existing.quests.filter((q) => q.period === 'weekly')
      : fresh.weekly;
  return {
    dayKey,
    weekKey,
    quests: [...keptDaily, ...keptWeekly],
  };
}

export const MAX_ACCOUNT_LEVEL = 100;

export function xpNeededForLevel(level: number): number {
  if (level >= MAX_ACCOUNT_LEVEL) return 0;
  const clamped = Math.max(1, Math.floor(level));
  return Math.round(180 + (clamped - 1) * 55 + Math.pow(clamped - 1, 1.45) * 3.5);
}

export function getLevelProgressFromXp(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpPercent: number;
  isMaxLevel: boolean;
} {
  let lvl = 1;
  let remaining = Math.max(0, Math.floor(xp));
  while (lvl < MAX_ACCOUNT_LEVEL) {
    const req = xpNeededForLevel(lvl);
    if (req <= 0 || remaining < req) break;
    remaining -= req;
    lvl++;
  }
  const isMaxLevel = lvl >= MAX_ACCOUNT_LEVEL;
  const nextLevelXp = isMaxLevel ? 0 : xpNeededForLevel(lvl);
  const xpPercent = isMaxLevel
    ? 100
    : Math.min(99, Math.max(0, Math.floor((remaining / Math.max(1, nextLevelXp)) * 100)));
  return {
    level: lvl,
    currentLevelXp: isMaxLevel ? 0 : remaining,
    nextLevelXp,
    xpPercent,
    isMaxLevel,
  };
}

export function computeLevelFromXp(xp: number): number {
  return getLevelProgressFromXp(xp).level;
}

function simplePinHash(pin: string): string {
  let h = 2166136261;
  for (let i = 0; i < pin.length; i++) {
    h ^= pin.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function createGuestProfile(): UserAccountProfile {
  return {
    id: 'guest_local',
    nick: 'Prezes Gość',
    pinHash: '',
    isGuest: true,
    createdAt: Date.now(),
    xp: 0,
    level: 1,
    mCoins: 60,
    prestigeLevel: 0,
    uiThemeId: 'theme_fintech',
    battlePassXp: 0,
    claimedPassLevels: [],
    questState: ensureQuestStateUpToDate(),
    pvpMatches: 0,
    pvpWins: 0,
    welcomeMigratedV9: true,
    avatar: '👔',
    frameId: 'frame_slate',
    titleId: 'title_startup',
    hqVariant: 'classic',
    unlockedAchievements: [],
    unlockedCosmetics: ['hq_classic', 'frame_slate', 'title_startup', 'theme_fintech'],
    pinnedBadgeIds: [],
    records: {
      highestNetWorth: 0,
      fastestDominanceTicks: null,
      longestWinStreak: 0,
      currentWinStreak: 0,
      biggestSingleDeal: 0,
      mostOwnedPlots: 0,
      matchesPlayed: 0,
      matchesWon: 0,
      secretGoalsCompleted: 0,
      weeklyBestScore: null,
    },
    matchHistory: [],
  };
}

function getStorageSafe(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadAccountsDatabase(): UserAccountProfile[] {
  const storage = getStorageSafe();
  if (!storage) return [createGuestProfile()];
  try {
    const raw = storage.getItem(ACCOUNTS_DB_KEY);
    if (!raw) {
      const guest = createGuestProfile();
      storage.setItem(ACCOUNTS_DB_KEY, JSON.stringify([guest]));
      storage.setItem(ACTIVE_ACCOUNT_ID_KEY, guest.id);
      return [guest];
    }
    const parsed = JSON.parse(raw) as UserAccountProfile[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const guest = createGuestProfile();
      return [guest];
    }
    let needsSave = false;
    const normalizedList = parsed.map((acc) => {
      const normalized = normalizeAccount(acc);
      if (normalized.level !== acc.level) {
        needsSave = true;
      }
      return normalized;
    });
    if (needsSave) {
      saveAccountsDatabase(normalizedList);
    }
    return normalizedList;
  } catch {
    return [createGuestProfile()];
  }
}

function normalizeAccount(acc: UserAccountProfile): UserAccountProfile {
  const guestBase = createGuestProfile();
  const isLegacyV7Account =
    !acc.welcomeMigratedV9 &&
    ((acc.records?.matchesPlayed ?? 0) > 0 ||
      (acc.xp ?? 0) > 0 ||
      (acc.unlockedAchievements?.length ?? 0) > 0);
  const achCount = Array.isArray(acc.unlockedAchievements) ? acc.unlockedAchievements.length : 0;
  const legacyWelcomeMCoins = isLegacyV7Account ? 150 + achCount * 15 : 0;
  const baseCoins = typeof acc.mCoins === 'number' ? acc.mCoins : guestBase.mCoins;
  const unlockedCosmetics = Array.isArray(acc.unlockedCosmetics)
    ? Array.from(new Set(['hq_classic', 'frame_slate', 'title_startup', 'theme_fintech', ...acc.unlockedCosmetics]))
    : ['hq_classic', 'frame_slate', 'title_startup', 'theme_fintech'];

  return {
    ...guestBase,
    ...acc,
    level: computeLevelFromXp(acc.xp ?? 0),
    mCoins: baseCoins + legacyWelcomeMCoins,
    prestigeLevel: Math.max(0, Number(acc.prestigeLevel ?? 0)),
    uiThemeId: acc.uiThemeId ?? 'theme_fintech',
    battlePassXp: Math.max(0, Number(acc.battlePassXp ?? 0)),
    claimedPassLevels: Array.isArray(acc.claimedPassLevels) ? acc.claimedPassLevels : [],
    questState: ensureQuestStateUpToDate(acc.questState),
    pvpMatches: Math.max(0, Number(acc.pvpMatches ?? 0)),
    pvpWins: Math.max(0, Number(acc.pvpWins ?? 0)),
    welcomeMigratedV9: true,
    unlockedAchievements: Array.isArray(acc.unlockedAchievements) ? acc.unlockedAchievements : [],
    unlockedCosmetics,
    pinnedBadgeIds: Array.isArray(acc.pinnedBadgeIds) ? acc.pinnedBadgeIds.slice(0, 3) : [],
    matchHistory: Array.isArray(acc.matchHistory) ? acc.matchHistory.slice(0, 20) : [],
    records: {
      ...guestBase.records,
      ...(acc.records ?? {}),
    },
  };
}

export function saveAccountsDatabase(list: UserAccountProfile[]): void {
  const storage = getStorageSafe();
  if (!storage) return;
  try {
    storage.setItem(ACCOUNTS_DB_KEY, JSON.stringify(list));
  } catch {
    // Ignoruj limit pamięci
  }
}

export function getActiveProfile(): UserAccountProfile {
  const list = loadAccountsDatabase();
  const storage = getStorageSafe();
  const activeId = storage?.getItem(ACTIVE_ACCOUNT_ID_KEY);
  const found = activeId ? list.find((a) => a.id === activeId) : undefined;
  return found ?? list[0] ?? createGuestProfile();
}

export function setActiveProfileId(id: string): void {
  const storage = getStorageSafe();
  if (!storage) return;
  storage.setItem(ACTIVE_ACCOUNT_ID_KEY, id);
}

export function updateProfileInDb(profile: UserAccountProfile): UserAccountProfile {
  const normalized = normalizeAccount(profile);
  const list = loadAccountsDatabase();
  const idx = list.findIndex((a) => a.id === normalized.id);
  if (idx >= 0) {
    list[idx] = normalized;
  } else {
    list.push(normalized);
  }
  saveAccountsDatabase(list);
  setActiveProfileId(normalized.id);
  return normalized;
}

export function registerAccount(
  nick: string,
  pin: string,
  avatar = '👔'
): { ok: boolean; profile?: UserAccountProfile; error?: string } {
  const en = getCurrentLanguage() === 'en';
  const cleanNick = nick.trim();
  if (cleanNick.length < 2 || cleanNick.length > 24) {
    return {
      ok: false,
      error: en ? 'Nickname must be 2–24 characters long.' : 'Pseudonim musi mieć od 2 do 24 znaków.',
    };
  }
  if (pin.trim().length < 3) {
    return {
      ok: false,
      error: en
        ? 'Password or PIN must be at least 3 characters.'
        : 'Hasło lub kod PIN musi mieć co najmniej 3 znaki.',
    };
  }
  const db = loadAccountsDatabase();
  if (db.some((a) => !a.isGuest && a.nick.toLowerCase() === cleanNick.toLowerCase())) {
    return {
      ok: false,
      error: en
        ? 'An account with that nickname already exists in this browser.'
        : 'Konto o takim pseudonimie już istnieje w tej przeglądarce.',
    };
  }

  const acc: UserAccountProfile = {
    ...createGuestProfile(),
    id: `acc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    nick: cleanNick,
    pinHash: simplePinHash(pin.trim()),
    isGuest: false,
    avatar,
    createdAt: Date.now(),
  };
  const saved = updateProfileInDb(acc);
  return { ok: true, profile: saved };
}

export function loginAccount(
  nick: string,
  pin: string
): { ok: boolean; profile?: UserAccountProfile; error?: string } {
  const en = getCurrentLanguage() === 'en';
  const cleanNick = nick.trim().toLowerCase();
  const db = loadAccountsDatabase();
  const found = db.find((a) => !a.isGuest && a.nick.toLowerCase() === cleanNick);
  if (!found) {
    return {
      ok: false,
      error: en ? 'No account found with that nickname.' : 'Nie znaleziono konta o podanym pseudonimie.',
    };
  }
  if (found.pinHash !== simplePinHash(pin.trim())) {
    return { ok: false, error: en ? 'Invalid password or PIN.' : 'Nieprawidłowe hasło lub PIN.' };
  }
  setActiveProfileId(found.id);
  return { ok: true, profile: found };
}

export function switchToGuestAccount(): UserAccountProfile {
  const db = loadAccountsDatabase();
  let guest = db.find((a) => a.isGuest);
  if (!guest) {
    guest = createGuestProfile();
    updateProfileInDb(guest);
  } else {
    setActiveProfileId(guest.id);
  }
  return guest;
}

export function exportProfileTransferCode(profile: UserAccountProfile): string {
  const json = JSON.stringify(profile);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return `MDPROF1:${btoa(bin)}`;
}

export function importProfileTransferCode(
  code: string
): { ok: boolean; profile?: UserAccountProfile; error?: string } {
  const en = getCurrentLanguage() === 'en';
  try {
    const trimmed = code.trim();
    if (!trimmed.startsWith('MDPROF1:')) {
      return {
        ok: false,
        error: en
          ? 'Invalid Profile Transfer Code format (expected MDPROF1:...).'
          : 'Nieprawidłowy format Kodu Przenoszenia Profilu (oczekiwano MDPROF1:...).',
      };
    }
    const b64 = trimmed.slice('MDPROF1:'.length);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as UserAccountProfile;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.nick !== 'string') {
      return {
        ok: false,
        error: en
          ? 'Corrupted data in Profile Transfer Code.'
          : 'Uszkodzone dane w Kodzie Przenoszenia Profilu.',
      };
    }
    const saved = updateProfileInDb(parsed);
    return { ok: true, profile: saved };
  } catch {
    return {
      ok: false,
      error: en
        ? 'Failed to decode Profile Transfer Code.'
        : 'Nie udało się zdekodować Kodu Przenoszenia Profilu.',
    };
  }
}

export function toPlayerCard(profile: UserAccountProfile): PlayerCardProfile {
  const div = computePvPDivision(profile.pvpMatches, profile.pvpWins, profile.prestigeLevel);
  return {
    accountId: profile.id,
    nick: profile.nick,
    level: profile.level,
    xp: profile.xp,
    avatar: profile.avatar,
    frameId: profile.frameId,
    titleId: profile.titleId,
    pinnedBadgeIds: profile.pinnedBadgeIds.slice(0, 3),
    hqVariant: profile.hqVariant,
    pvpDivisionId: div.id,
    prestigeLevel: profile.prestigeLevel,
    unlockedMonumentIds: getUnlockedMonumentsForProfile(profile.unlockedCosmetics),
  };
}

export function updateProfileCosmetics(
  profile: UserAccountProfile,
  opts: {
    avatar?: string;
    frameId?: string;
    titleId?: string;
    pinnedBadgeIds?: string[];
    hqVariant?: HQVariantId;
    uiThemeId?: UiThemeId;
  }
): UserAccountProfile {
  const next: UserAccountProfile = {
    ...profile,
    avatar: opts.avatar ?? profile.avatar,
    frameId: opts.frameId ?? profile.frameId,
    titleId: opts.titleId ?? profile.titleId,
    pinnedBadgeIds: opts.pinnedBadgeIds
      ? opts.pinnedBadgeIds.slice(0, 3)
      : profile.pinnedBadgeIds,
    hqVariant: opts.hqVariant ?? profile.hqVariant,
    uiThemeId: opts.uiThemeId ?? profile.uiThemeId,
  };
  if (opts.uiThemeId) applyUiThemeToDocument(opts.uiThemeId);
  return updateProfileInDb(next);
}

export function purchaseShopItem(
  profile: UserAccountProfile,
  itemId: string
): { ok: boolean; profile: UserAccountProfile; message?: string; error?: string } {
  const lang = getCurrentLanguage();
  const en = lang === 'en';
  const norm = normalizeAccount(profile);
  const item = SHOP_ITEMS.find((it) => it.id === itemId);
  if (!item) {
    return {
      ok: false,
      profile: norm,
      error: en ? 'Unknown CEO Shop item.' : 'Nieznana pozycja w Sklepie Prezesa.',
    };
  }
  const locItem = localizeShopItem(item, lang);
  const alreadyOwned = item.unlockIdsGranted.every((uid) => norm.unlockedCosmetics.includes(uid));
  if (alreadyOwned) {
    return {
      ok: false,
      profile: norm,
      error: en
        ? 'This item is already unlocked on your account.'
        : 'Ten element jest już odblokowany na Twoim koncie.',
    };
  }
  if (norm.mCoins < item.priceMCoins) {
    return {
      ok: false,
      profile: norm,
      error: en
        ? `Not enough M-Coins (need ${item.priceMCoins} M, have ${norm.mCoins} M).`
        : `Za mało Monet M (potrzeba ${item.priceMCoins} M, masz ${norm.mCoins} M).`,
    };
  }
  const updated: UserAccountProfile = {
    ...norm,
    mCoins: norm.mCoins - item.priceMCoins,
    unlockedCosmetics: Array.from(new Set([...norm.unlockedCosmetics, ...item.unlockIdsGranted])),
    uiThemeId: item.uiThemeId ?? norm.uiThemeId,
    hqVariant: item.hqVariantId ?? norm.hqVariant,
    frameId: item.frameId ?? norm.frameId,
  };
  if (item.uiThemeId) applyUiThemeToDocument(item.uiThemeId);
  const saved = updateProfileInDb(updated);
  return {
    ok: true,
    profile: saved,
    message: en ? `Unlocked: ${locItem.name}!` : `Odblokowano: ${locItem.name}!`,
  };
}

export function claimBattlePassReward(
  profile: UserAccountProfile,
  level: number
): { ok: boolean; profile: UserAccountProfile; message?: string; error?: string } {
  const lang = getCurrentLanguage();
  const en = lang === 'en';
  const norm = normalizeAccount(profile);
  const tier = BATTLE_PASS_SEASON_1.find((t) => t.level === level);
  if (!tier) {
    return {
      ok: false,
      profile: norm,
      error: en ? 'Unknown Season 1 Pass tier.' : 'Nieznany próg Karnetu Sezon 1.',
    };
  }
  const bpProgress = computeBattlePassLevel(norm.battlePassXp);
  if (bpProgress.level < level) {
    return {
      ok: false,
      profile: norm,
      error: en ? `Requires Pass Level ${level}.` : `Wymagany Poziom Karnetu ${level}.`,
    };
  }
  if (norm.claimedPassLevels.includes(level)) {
    return {
      ok: false,
      profile: norm,
      error: en ? 'Reward already claimed.' : 'Nagroda została już odebrana.',
    };
  }

  let mCoinsAdded = tier.mCoinsBonus ?? 0;
  const extraCosmetics: string[] = [];
  if (tier.cosmeticId) {
    if (norm.unlockedCosmetics.includes(tier.cosmeticId)) {
      mCoinsAdded += 75; // Kompensata M za posiadaną już kosmetykę ze sklepu
    } else {
      extraCosmetics.push(tier.cosmeticId);
    }
  }
  // Dodatkowe progi specjalne w Sezonie 1
  if (level === 15 && !norm.unlockedCosmetics.includes('frame_neon_pulse')) {
    extraCosmetics.push('frame_neon_pulse');
  }
  if (level === 25 && !norm.unlockedCosmetics.includes('frame_golden_aura')) {
    extraCosmetics.push('frame_golden_aura');
  }
  if (level === 30) {
    if (!norm.unlockedCosmetics.includes('hq_platinum')) extraCosmetics.push('hq_platinum');
    if (!norm.unlockedCosmetics.includes('title_season_one')) extraCosmetics.push('title_season_one');
  }

  const saved = updateProfileInDb({
    ...norm,
    mCoins: norm.mCoins + mCoinsAdded,
    claimedPassLevels: [...norm.claimedPassLevels, level],
    unlockedCosmetics: Array.from(new Set([...norm.unlockedCosmetics, ...extraCosmetics])),
  });
  const tierTitle = localizeBattlePassTierTitle(level, tier.title, lang);
  return {
    ok: true,
    profile: saved,
    message: en
      ? `Claimed Level ${level} reward: ${tierTitle}!`
      : `Odebrano nagrodę Poziomu ${level}: ${tierTitle}!`,
  };
}

export function activatePrestige(profile: UserAccountProfile): {
  ok: boolean;
  profile: UserAccountProfile;
  message?: string;
  error?: string;
} {
  const en = getCurrentLanguage() === 'en';
  const norm = normalizeAccount(profile);
  if (norm.level < PRESTIGE_REQUIRED_ACCOUNT_LEVEL) {
    return {
      ok: false,
      profile: norm,
      error: en
        ? `Prestige requires Account Level ${PRESTIGE_REQUIRED_ACCOUNT_LEVEL}.`
        : `Prestiż wymaga osiągnięcia min. Poziomu Konta ${PRESTIGE_REQUIRED_ACCOUNT_LEVEL}.`,
    };
  }
  const nextPrestige = norm.prestigeLevel + 1;
  const saved = updateProfileInDb({
    ...norm,
    prestigeLevel: nextPrestige,
    xp: 0,
    level: 1,
    mCoins: norm.mCoins + 250,
    unlockedCosmetics: Array.from(new Set([...norm.unlockedCosmetics, 'title_prestige_star'])),
    titleId: 'title_prestige_star',
  });
  return {
    ok: true,
    profile: saved,
    message: en
      ? `★ Prestige #${nextPrestige} Activated! Earned Gold Star badge, map plot borders, and +250 M-Coins!`
      : `★ Aktywowano Prestiż #${nextPrestige}! Otrzymujesz Złotą Gwiazdę, granice działek na mapie i +250 Monet M!`,
  };
}

export interface RegisteredMCoinRankEntry {
  rank: number;
  id: string;
  nick: string;
  avatar: string;
  divisionId: ReturnType<typeof computePvPDivision>['id'];
  level: number;
  prestigeLevel: number;
  mCoins: number;
  matchesWon: number;
  isCurrentUser?: boolean;
}

/**
 * Zwraca ranking Złotych Monet „M” wyłącznie dla zarejestrowanych kont (tryb Gość pomijany).
 */
export function getRegisteredAccountsMCoinRanking(
  activeProfileId?: string
): RegisteredMCoinRankEntry[] {
  const accounts = loadAccountsDatabase().filter((acc) => !acc.isGuest);
  accounts.sort((a, b) => {
    if (b.mCoins !== a.mCoins) return b.mCoins - a.mCoins;
    if ((b.records.matchesWon ?? 0) !== (a.records.matchesWon ?? 0)) {
      return (b.records.matchesWon ?? 0) - (a.records.matchesWon ?? 0);
    }
    return b.level - a.level;
  });
  return accounts.map((acc, idx) => ({
    rank: idx + 1,
    id: acc.id,
    nick: acc.nick,
    avatar: acc.avatar,
    divisionId: computePvPDivision(acc.pvpMatches, acc.pvpWins, acc.prestigeLevel).id,
    level: acc.level,
    prestigeLevel: acc.prestigeLevel,
    mCoins: acc.mCoins,
    matchesWon: acc.records.matchesWon ?? 0,
    isCurrentUser: activeProfileId ? acc.id === activeProfileId : false,
  }));
}

export async function fetchRegisteredMCoinLeaderboard(
  activeProfileId?: string
): Promise<RegisteredMCoinRankEntry[]> {
  const local = getRegisteredAccountsMCoinRanking(activeProfileId);
  const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey || !url.startsWith('http')) {
    return local;
  }
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/player_profiles?select=id,nick,level,payload&limit=50`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!res.ok) return local;
    const rows = (await res.json()) as Array<{
      id: string;
      nick: string;
      level: number;
      payload?: Partial<UserAccountProfile>;
    }>;
    const byId = new Map<string, RegisteredMCoinRankEntry>();
    for (const r of local) byId.set(r.id, r);
    for (const row of rows) {
      const p = row.payload;
      if (!p || p.isGuest) continue;
      const existing = byId.get(row.id);
      const entry: RegisteredMCoinRankEntry = {
        rank: 0,
        id: row.id,
        nick: p.nick || row.nick,
        avatar: p.avatar || '👔',
        divisionId: computePvPDivision(p.pvpMatches ?? 0, p.pvpWins ?? 0, p.prestigeLevel ?? 0).id,
        level: p.level ?? row.level ?? 1,
        prestigeLevel: p.prestigeLevel ?? 0,
        mCoins: Math.max(0, Number(p.mCoins ?? 0)),
        matchesWon: p.records?.matchesWon ?? 0,
        isCurrentUser: activeProfileId ? row.id === activeProfileId : false,
      };
      if (!existing || entry.mCoins > existing.mCoins) {
        byId.set(row.id, entry);
      }
    }
    return [...byId.values()]
      .sort((a, b) => b.mCoins - a.mCoins || b.matchesWon - a.matchesWon || b.level - a.level)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  } catch {
    return local;
  }
}

/**
 * Czysta warstwa abstrakcji gotowa na przyszłą synchronizację kont z Supabase.
 */
export async function syncProfileToCloudIfConfigured(profile: UserAccountProfile): Promise<boolean> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey || !url.startsWith('http') || profile.isGuest) {
    return false;
  }
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/player_profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: profile.id,
        nick: profile.nick,
        level: profile.level,
        xp: profile.xp,
        payload: profile,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function grantAchievement(profile: UserAccountProfile, ach: AchievementDefinition): boolean {
  if (profile.unlockedAchievements.includes(ach.id)) return false;
  profile.unlockedAchievements.push(ach.id);
  profile.xp += ach.xpReward;
  profile.level = computeLevelFromXp(profile.xp);
  profile.mCoins += Math.max(15, Math.round(ach.xpReward * 0.22));
  profile.battlePassXp += Math.round(ach.xpReward * 0.55);
  if (ach.unlockTitle && !profile.unlockedCosmetics.includes(ach.unlockTitle)) {
    profile.unlockedCosmetics.push(ach.unlockTitle);
  }
  if (ach.unlockCosmetic && !profile.unlockedCosmetics.includes(ach.unlockCosmetic.id)) {
    profile.unlockedCosmetics.push(ach.unlockCosmetic.id);
  }
  return true;
}

const memoryWatermarks: Record<string, Record<string, number>> = {};

function loadMatchWatermarks(matchId: string): Record<string, number> {
  const storage = getStorageSafe();
  if (!storage) return { ...(memoryWatermarks[matchId] ?? {}) };
  try {
    const raw = storage.getItem(QUEST_WATERMARK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Record<string, number>>;
    return parsed[matchId] ? { ...parsed[matchId] } : {};
  } catch {
    return {};
  }
}

function saveMatchWatermarks(matchId: string, wm: Record<string, number>): void {
  memoryWatermarks[matchId] = { ...wm };
  const storage = getStorageSafe();
  if (!storage) return;
  try {
    const raw = storage.getItem(QUEST_WATERMARK_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, number>>) : {};
    parsed[matchId] = wm;
    const keys = Object.keys(parsed);
    if (keys.length > 15) {
      for (const oldKey of keys.slice(0, keys.length - 15)) {
        delete parsed[oldKey];
      }
    }
    storage.setItem(QUEST_WATERMARK_KEY, JSON.stringify(parsed));
  } catch {
    // ignoruj limit miejsca
  }
}

function syncQuestsFromMatch(
  profile: UserAccountProfile,
  state: GameState,
  player: Player,
  ownedPlotsCount: number,
  matchEnded: boolean,
  won: boolean,
  rank: number
): { completedNow: PlayerQuestProgress[]; bpXpAdded: number; mCoinsAdded: number } {
  const qState = ensureQuestStateUpToDate(profile.questState);
  profile.questState = qState;

  const matchId = state.matchId ?? `fallback_${state.settings.mapSeed ?? 0}`;
  const prevWm = loadMatchWatermarks(matchId);
  const accum = player.statsAccum;
  const completedNow: PlayerQuestProgress[] = [];
  let bpXpAdded = 0;
  let mCoinsAdded = 0;

  const currentCumulative: Record<string, number> = {
    b2b_completed: accum?.b2bContractsCompleted ?? 0,
    bridge_built: accum?.bridgesBuilt ?? 0,
    road_built: accum?.roadsBuilt ?? 0,
    self_fueled_ticks: accum?.selfFueledPowerTicks ?? 0,
    podium_win: matchEnded && (won || rank <= 2) ? 1 : 0,
  };

  for (const q of qState.quests) {
    if (q.completed) continue;
    if (q.metric === 'owned_plots') {
      q.progress = Math.max(q.progress, Math.min(q.target, ownedPlotsCount));
    } else if (q.metric === 'green_buildings') {
      q.progress = Math.max(q.progress, Math.min(q.target, accum?.greenBuildingsCount ?? 0));
    } else {
      const curVal = currentCumulative[q.metric] ?? 0;
      const lastVal = prevWm[q.metric] ?? 0;
      const delta = Math.max(0, curVal - lastVal);
      if (delta > 0) {
        q.progress = Math.min(q.target, q.progress + delta);
      }
    }

    if (q.progress >= q.target && !q.completed) {
      q.completed = true;
      q.claimed = true;
      bpXpAdded += q.bpXpReward;
      mCoinsAdded += q.mCoinReward;
      completedNow.push({ ...q });
    }
  }

  saveMatchWatermarks(matchId, currentCumulative);
  if (bpXpAdded > 0) profile.battlePassXp += bpXpAdded;
  if (mCoinsAdded > 0) profile.mCoins += mCoinsAdded;

  return { completedNow, bpXpAdded, mCoinsAdded };
}

export function evaluateLiveAchievements(
  state: GameState,
  player: Player
): {
  profile: UserAccountProfile;
  newlyUnlocked: AchievementDefinition[];
  completedQuests: PlayerQuestProgress[];
} {
  const profile = normalizeAccount(getActiveProfile());
  const unlockedNow: AchievementDefinition[] = [];

  const check = (achId: string, cond: boolean) => {
    if (!cond || profile.unlockedAchievements.includes(achId)) return;
    const def = ACHIEVEMENTS.find((a) => a.id === achId);
    if (def && grantAchievement(profile, def)) {
      unlockedNow.push(def);
    }
  };

  const ownedPlots = state.plots.filter((p) => p.ownerId === player.id);
  const ownedBuildings = ownedPlots.map((p) => p.building).filter((b): b is NonNullable<typeof b> => Boolean(b && !b.destroyedRuins));

  check('ach_first_million', player.netWorth >= 10_000_000);
  check('ach_tycoon_25m', player.netWorth >= 25_000_000);
  check('ach_tycoon_50m', player.netWorth >= 50_000_000);
  check('ach_debt_free_winner', player.corporationLevel >= 4 && player.loans.length === 0);

  const hasCrash = state.marketCycles?.some((c) => c.phase === 'krach') ?? false;
  check('ach_crash_survivor', hasCrash && player.cashFlowPerMin > 0 && player.netWorth >= 12_000_000);

  const maxStockOwned = (state.stocks ?? []).reduce(
    (max, st) => (st.companyId !== player.id ? Math.max(max, st.holdings[player.id] ?? 0) : max),
    0
  );
  check('ach_stock_shark', maxStockOwned >= 25);

  check(
    'ach_diamond_king',
    ownedBuildings.some((b) => b.type === 'diamondMine') &&
      ownedBuildings.some((b) => b.type === 'jewelryLuxury')
  );

  const hasCoalPlant = ownedBuildings.some((b) => b.type === 'coalPowerPlant' && b.isActive);
  const cleanMW = ownedBuildings
    .filter(
      (b) =>
        b.type === 'solarFarm' ||
        b.type === 'windFarm' ||
        b.type === 'hydroPowerPlant' ||
        b.type === 'geothermalPlant' ||
        b.type === 'fusionReactor'
    )
    .reduce((s, b) => s + Math.abs(b.productionPerTick.electricity ?? 35), 0);
  check('ach_green_visionary', !hasCoalPlant && cleanMW >= 120);

  check(
    'ach_hightech_monopoly',
    ownedBuildings.some((b) => b.type === 'semiconductorFab') &&
      ownedBuildings.some((b) => b.type === 'batteryFactory') &&
      ownedBuildings.some((b) => b.type === 'dataCenter')
  );

  const totalTolls = ownedPlots.reduce((s, p) => s + (p.tollRevenueTotal ?? 0), 0);
  check('ach_toll_master', totalTolls >= 200_000);

  const maxSynergy = ownedPlots.reduce((m, p) => Math.max(m, p.synergyPercent ?? 0), 0);
  check('ach_synergy_master', maxSynergy >= 45);

  const myPatents = (state.patents ?? []).filter((pt) => pt.ownerId === player.id).length;
  check('ach_patent_lord', myPatents >= 2);

  check('ach_beloved_leader', player.influence.voterApproval >= 90);
  check(
    'ach_pmc_commander',
    ownedBuildings.some((b) => b.type === 'militaryBase') && (player.actionCooldowns['tactical_missile'] ?? 0) > 0
  );
  check('ach_atomic_deterrent', (player.nuclearWarheadsReady ?? 0) >= 1);

  const completedContracts = state.contracts.filter(
    (c) => (c.sellerId === player.id || c.buyerId === player.id) && c.status === 'completed'
  ).length;
  check('ach_b2b_trader', completedContracts >= 3);

  check(
    'ach_bailiff_hunter',
    state.liveAuction?.highestBidderId === player.id && state.liveAuction?.bidsCount > 0
  );
  check(
    'ach_tender_ace',
    (state.tenders ?? []).some((t) => t.status === 'awarded' && t.winnerId === player.id)
  );
  check(
    'ach_flagship_builder',
    ownedBuildings.some((b) => b.techTree.some((t) => t.status === 'done' && t.tier === 4))
  );
  check(
    'ach_fog_scout',
    Object.keys(player.revealedFogPlots ?? {}).length > 0 ||
      state.players.some((pl) => pl.id !== player.id && (pl.nuclearDetectedByPlayers ?? []).includes(player.id))
  );
  check(
    'ach_diplomat_nap',
    (state.naps ?? []).some(
      (n) => n.status === 'active' && (n.playerAId === player.id || n.playerBId === player.id)
    )
  );
  check(
    'ach_hardcore_survivor',
    state.settings.difficultyPreset === 'przetrwanie' && player.netWorth >= 15_000_000
  );
  check(
    'ach_secret_double',
    (player.secretGoals ?? []).filter((g) => g.completed).length >= 2
  );
  check('ach_land_baron', ownedPlots.length >= 25);

  const questRes = syncQuestsFromMatch(profile, state, player, ownedPlots.length, false, false, 99);

  if (profile.records.mostOwnedPlots < ownedPlots.length) {
    profile.records.mostOwnedPlots = ownedPlots.length;
  }
  if (profile.records.highestNetWorth < player.netWorth) {
    profile.records.highestNetWorth = Math.round(player.netWorth);
  }

  if (unlockedNow.length > 0 || questRes.completedNow.length > 0) {
    updateProfileInDb(profile);
  }

  return { profile, newlyUnlocked: unlockedNow, completedQuests: questRes.completedNow };
}

export function recordCompletedMatchToProfile(
  state: GameState,
  player: Player
): {
  profile: UserAccountProfile;
  xpEarned: number;
  mCoinsEarned: number;
  bpXpEarned: number;
  rewardMultiplier: number;
  tooShortForCoins: boolean;
  completedQuests: PlayerQuestProgress[];
  newlyUnlocked: AchievementDefinition[];
} {
  const { profile, newlyUnlocked: liveUnlocked, completedQuests: liveQuests } =
    evaluateLiveAchievements(state, player);
  const newlyUnlocked = [...liveUnlocked];
  const completedQuests = [...liveQuests];

  const isCoalitionWin = Boolean(
    state.winningCoalitionId &&
      (state.coalitions ?? [])
        .find((c) => c.id === state.winningCoalitionId)
        ?.memberIds.includes(player.id)
  );
  const won = state.winnerId === player.id || isCoalitionWin;
  const rank =
    [...state.players]
      .sort((a, b) => b.netWorth - a.netWorth)
      .findIndex((p) => p.id === player.id) + 1;

  const grantById = (achId: string) => {
    if (profile.unlockedAchievements.includes(achId)) return;
    const def = ACHIEVEMENTS.find((a) => a.id === achId);
    if (def && grantAchievement(profile, def)) newlyUnlocked.push(def);
  };

  if (won && state.coalitions?.some((c) => c.memberIds.includes(player.id))) {
    grantById('ach_coalition_architect');
  }
  if (won && (state.settings.mode === 'mp_fast' || state.settings.mode === 'mp_long')) {
    grantById('ach_mp_victor');
  }
  if (won && state.settings.mutators?.noLoans) {
    grantById('ach_no_loans_titan');
  }
  if (state.settings.weeklyChallengeId && state.winnerId === player.id) {
    grantById('ach_weekly_champion');
    const prevBest = profile.records.weeklyBestScore;
    if (
      !prevBest ||
      prevBest.weekKey !== state.settings.weeklyChallengeId ||
      player.netWorth > prevBest.netWorth
    ) {
      profile.records.weeklyBestScore = {
        weekKey: state.settings.weeklyChallengeId,
        netWorth: Math.round(player.netWorth),
        ticks: state.time.tick,
        date: new Date().toISOString().slice(0, 10),
      };
    }
  }

  const multBreakdown = computeRewardMultiplier({
    difficultyPreset: state.settings.difficultyPreset,
    aiDifficulty: state.settings.aiDifficulty,
    aiCount: state.players.filter((p) => p.isAI).length,
    mutators: state.settings.mutators,
  });

  const eligibleForMatchRewards =
    state.time.tick >= MIN_TICKS_FOR_MATCH_COINS || state.elapsedSeconds >= 90;

  const completedGoals = (player.secretGoals ?? []).filter((g) => g.completed);
  const goalXp = completedGoals.reduce((s, g) => s + g.rewardXp, 0);
  const baseXp = won ? 240 : rank === 2 ? 150 : 95;
  const netWorthXp = Math.min(200, Math.round(Math.max(0, player.netWorth) / 250_000));
  const rawXpEarned = Math.round((baseXp + netWorthXp + goalXp) * multBreakdown.totalMultiplier);
  const xpEarned = eligibleForMatchRewards ? rawXpEarned : Math.round(rawXpEarned * 0.2);

  // Obniżone, bardziej prestiżowe tempo Monet M (~45-50% redukcji + ochrona przed farmieniem krótkich gier)
  const baseCoins = won ? 75 : rank === 2 ? 45 : 25;
  const netWorthCoins = Math.min(55, Math.round(Math.max(0, player.netWorth) / 650_000));
  const goalCoins = completedGoals.length * 18;
  const rawCoinsEarned = eligibleForMatchRewards
    ? Math.round((baseCoins + netWorthCoins + goalCoins) * multBreakdown.totalMultiplier)
    : 0;

  const ownedPlotsCount = state.plots.filter((p) => p.ownerId === player.id).length;
  const endQuests = syncQuestsFromMatch(profile, state, player, ownedPlotsCount, true, won, rank);
  completedQuests.push(...endQuests.completedNow);

  const bpXpEarned = Math.round(xpEarned * 0.85) + endQuests.bpXpAdded;
  const mCoinsEarned = rawCoinsEarned + endQuests.mCoinsAdded;

  profile.xp += xpEarned;
  profile.level = computeLevelFromXp(profile.xp);
  profile.mCoins += rawCoinsEarned; // endQuests.mCoinsAdded już dopisane przez syncQuestsFromMatch
  profile.battlePassXp += Math.round(xpEarned * 0.85);

  if (state.settings.mode === 'mp_fast' || state.settings.mode === 'mp_long') {
    profile.pvpMatches += 1;
    if (won) profile.pvpWins += 1;
  }

  // Odblokowania poziomowe kosmetyków
  if (profile.level >= 4 && !profile.unlockedCosmetics.includes('frame_gold')) {
    profile.unlockedCosmetics.push('frame_gold');
  }
  if (profile.level >= 10 && !profile.unlockedCosmetics.includes('hq_eco_dome')) {
    profile.unlockedCosmetics.push('hq_eco_dome');
  }

  profile.records.matchesPlayed += 1;
  if (won) {
    profile.records.matchesWon += 1;
    profile.records.currentWinStreak += 1;
    profile.records.longestWinStreak = Math.max(
      profile.records.longestWinStreak,
      profile.records.currentWinStreak
    );
    if (
      profile.records.fastestDominanceTicks === null ||
      state.time.tick < profile.records.fastestDominanceTicks
    ) {
      profile.records.fastestDominanceTicks = state.time.tick;
    }
  } else {
    profile.records.currentWinStreak = 0;
  }
  profile.records.secretGoalsCompleted += completedGoals.length;
  profile.records.highestNetWorth = Math.max(
    profile.records.highestNetWorth,
    Math.round(player.netWorth)
  );

  const entry: MatchRecordEntry = {
    id: `m_${Date.now().toString(36)}`,
    date: new Date().toISOString().slice(0, 10),
    mode: state.settings.mode,
    scenario: (state.settings.scenarioId ?? 'sandbox') as ScenarioId,
    difficulty: state.settings.difficultyPreset ?? 'standard',
    won,
    rank: Math.max(1, rank),
    totalPlayers: state.players.length,
    netWorth: Math.round(player.netWorth),
    durationTicks: state.time.tick,
    xpEarned,
    mCoinsEarned,
    rewardMultiplier: multBreakdown.totalMultiplier,
    isWeekly: Boolean(state.settings.weeklyChallengeId),
    weekKey: state.settings.weeklyChallengeId,
  };
  profile.matchHistory = [entry, ...profile.matchHistory].slice(0, 20);

  const saved = updateProfileInDb(profile);
  void syncProfileToCloudIfConfigured(saved);
  return {
    profile: saved,
    xpEarned,
    mCoinsEarned,
    bpXpEarned,
    rewardMultiplier: multBreakdown.totalMultiplier,
    tooShortForCoins: !eligibleForMatchRewards,
    completedQuests,
    newlyUnlocked,
  };
}
