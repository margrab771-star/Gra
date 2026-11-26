import {
  ACHIEVEMENTS,
  type AchievementDefinition,
} from '../data/achievements';
import type {
  GameState,
  HQVariantId,
  MatchRecordEntry,
  Player,
  PlayerCardProfile,
  ScenarioId,
  UserAccountProfile,
} from './types';

const ACCOUNTS_DB_KEY = 'market_dominion_accounts_db_v1';
const ACTIVE_ACCOUNT_ID_KEY = 'market_dominion_active_account_v1';

export function xpNeededForLevel(level: number): number {
  return Math.round(250 * Math.pow(level, 1.35));
}

export function computeLevelFromXp(xp: number): number {
  let lvl = 1;
  let remaining = Math.max(0, xp);
  while (lvl < 99) {
    const req = xpNeededForLevel(lvl);
    if (remaining < req) break;
    remaining -= req;
    lvl++;
  }
  return lvl;
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
    avatar: '👔',
    frameId: 'frame_slate',
    titleId: 'title_startup',
    hqVariant: 'classic',
    unlockedAchievements: [],
    unlockedCosmetics: ['hq_classic', 'frame_slate', 'title_startup'],
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
    return parsed.map(normalizeAccount);
  } catch {
    return [createGuestProfile()];
  }
}

function normalizeAccount(acc: UserAccountProfile): UserAccountProfile {
  return {
    ...createGuestProfile(),
    ...acc,
    level: computeLevelFromXp(acc.xp ?? 0),
    unlockedAchievements: Array.isArray(acc.unlockedAchievements) ? acc.unlockedAchievements : [],
    unlockedCosmetics: Array.isArray(acc.unlockedCosmetics)
      ? Array.from(new Set(['hq_classic', 'frame_slate', 'title_startup', ...acc.unlockedCosmetics]))
      : ['hq_classic', 'frame_slate', 'title_startup'],
    pinnedBadgeIds: Array.isArray(acc.pinnedBadgeIds) ? acc.pinnedBadgeIds.slice(0, 3) : [],
    matchHistory: Array.isArray(acc.matchHistory) ? acc.matchHistory.slice(0, 20) : [],
    records: {
      ...createGuestProfile().records,
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
  const cleanNick = nick.trim();
  if (cleanNick.length < 2 || cleanNick.length > 24) {
    return { ok: false, error: 'Pseudonim musi mieć od 2 do 24 znaków.' };
  }
  if (pin.trim().length < 3) {
    return { ok: false, error: 'Hasło lub kod PIN musi mieć co najmniej 3 znaki.' };
  }
  const db = loadAccountsDatabase();
  if (db.some((a) => !a.isGuest && a.nick.toLowerCase() === cleanNick.toLowerCase())) {
    return { ok: false, error: 'Konto o takim pseudonimie już istnieje w tej przeglądarce.' };
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
  const cleanNick = nick.trim().toLowerCase();
  const db = loadAccountsDatabase();
  const found = db.find((a) => !a.isGuest && a.nick.toLowerCase() === cleanNick);
  if (!found) {
    return { ok: false, error: 'Nie znaleziono konta o podanym pseudonimie.' };
  }
  if (found.pinHash !== simplePinHash(pin.trim())) {
    return { ok: false, error: 'Nieprawidłowe hasło lub PIN.' };
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
  try {
    const trimmed = code.trim();
    if (!trimmed.startsWith('MDPROF1:')) {
      return { ok: false, error: 'Nieprawidłowy format Kodu Przenoszenia Profilu (oczekiwano MDPROF1:...).' };
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
      return { ok: false, error: 'Uszkodzone dane w Kodzie Przenoszenia Profilu.' };
    }
    const saved = updateProfileInDb(parsed);
    return { ok: true, profile: saved };
  } catch {
    return { ok: false, error: 'Nie udało się zdekodować Kodu Przenoszenia Profilu.' };
  }
}

export function toPlayerCard(profile: UserAccountProfile): PlayerCardProfile {
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
  };
  return updateProfileInDb(next);
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
  if (ach.unlockTitle && !profile.unlockedCosmetics.includes(ach.unlockTitle)) {
    profile.unlockedCosmetics.push(ach.unlockTitle);
  }
  if (ach.unlockCosmetic && !profile.unlockedCosmetics.includes(ach.unlockCosmetic.id)) {
    profile.unlockedCosmetics.push(ach.unlockCosmetic.id);
  }
  return true;
}

export function evaluateLiveAchievements(
  state: GameState,
  player: Player
): { profile: UserAccountProfile; newlyUnlocked: AchievementDefinition[] } {
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

  if (profile.records.mostOwnedPlots < ownedPlots.length) {
    profile.records.mostOwnedPlots = ownedPlots.length;
  }
  if (profile.records.highestNetWorth < player.netWorth) {
    profile.records.highestNetWorth = Math.round(player.netWorth);
  }

  if (unlockedNow.length > 0) {
    updateProfileInDb(profile);
  }

  return { profile, newlyUnlocked: unlockedNow };
}

export function recordCompletedMatchToProfile(
  state: GameState,
  player: Player
): {
  profile: UserAccountProfile;
  xpEarned: number;
  newlyUnlocked: AchievementDefinition[];
} {
  const { profile, newlyUnlocked: liveUnlocked } = evaluateLiveAchievements(state, player);
  const newlyUnlocked = [...liveUnlocked];

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

  const completedGoals = (player.secretGoals ?? []).filter((g) => g.completed);
  const goalXp = completedGoals.reduce((s, g) => s + g.rewardXp, 0);
  const baseXp = won ? 220 : 85;
  const netWorthXp = Math.min(200, Math.round(Math.max(0, player.netWorth) / 250_000));
  const diffMult =
    state.settings.difficultyPreset === 'przetrwanie'
      ? 1.4
      : state.settings.difficultyPreset === 'kryzysowy'
        ? 1.2
        : 1.0;
  const xpEarned = Math.round((baseXp + netWorthXp + goalXp) * diffMult);

  profile.xp += xpEarned;
  profile.level = computeLevelFromXp(profile.xp);

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
    isWeekly: Boolean(state.settings.weeklyChallengeId),
    weekKey: state.settings.weeklyChallengeId,
  };
  profile.matchHistory = [entry, ...profile.matchHistory].slice(0, 20);

  const saved = updateProfileInDb(profile);
  void syncProfileToCloudIfConfigured(saved);
  return { profile: saved, xpEarned, newlyUnlocked };
}
