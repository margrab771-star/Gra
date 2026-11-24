import type { GameMode, LeaderboardEntry } from '../engine/types';

const LEADERBOARD_KEY = 'market_dominion_global_leaderboard_v1';

const SEED_ENTRIES: LeaderboardEntry[] = [
  {
    id: 'seed_1',
    rank: 1,
    playerName: 'Aleksander Sterling',
    companyName: 'Sterling Atom & Grid',
    netWorth: 28_450_000,
    strategy: 'Monopolista Energetyczno-Tech',
    score: 28450,
    mode: 'challenge1h',
    date: '2026-11-12',
    source: 'local',
  },
  {
    id: 'seed_2',
    rank: 2,
    playerName: 'Katarzyna Nowicka',
    companyName: 'Vistula Heavy Metals',
    netWorth: 21_900_000,
    strategy: 'Baron Surowcowo-Przemysłowy',
    score: 21900,
    mode: 'challenge1h',
    date: '2026-11-15',
    source: 'local',
  },
  {
    id: 'seed_3',
    rank: 3,
    playerName: 'Mikołaj Brandt',
    companyName: 'Brandt Estates S.A.',
    netWorth: 17_600_000,
    strategy: 'Magnat Nieruchomości',
    score: 17600,
    mode: 'challenge1h',
    date: '2026-11-18',
    source: 'local',
  },
  {
    id: 'seed_4',
    rank: 4,
    playerName: 'Weronika Szara',
    companyName: 'Vox Media Holdings',
    netWorth: 14_320_000,
    strategy: 'Szara Eminencja',
    score: 14320,
    mode: 'mp_fast',
    date: '2026-11-20',
    source: 'local',
  },
  {
    id: 'seed_5',
    rank: 5,
    playerName: 'Janusz Kowalczyk',
    companyName: 'Pol-Chain Logistics',
    netWorth: 11_800_000,
    strategy: 'Architekt Łańcuchów B2B',
    score: 11800,
    mode: 'challenge1h',
    date: '2026-11-22',
    source: 'local',
  },
];

function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && anonKey && url.startsWith('http')) {
    return { url: url.replace(/\/$/, ''), anonKey };
  }
  return null;
}

export function isCloudLeaderboardConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

export function loadLocalLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(SEED_ENTRIES));
      return [...SEED_ENTRIES];
    }
    const parsed = JSON.parse(raw) as LeaderboardEntry[];
    return rankEntries(Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_ENTRIES);
  } catch {
    return [...SEED_ENTRIES];
  }
}

export async function fetchGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  const local = loadLocalLeaderboard();
  const cfg = getSupabaseConfig();
  if (!cfg) return local;

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/leaderboard?select=*&order=net_worth.desc&limit=30`,
      {
        headers: {
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
        },
      }
    );
    if (!res.ok) return local;
    const rows = (await res.json()) as Array<{
      id: string;
      player_name: string;
      company_name: string;
      net_worth: number;
      strategy: string;
      score: number;
      mode: GameMode;
      created_at?: string;
    }>;

    const remote: LeaderboardEntry[] = rows.map((r, i) => ({
      id: String(r.id),
      rank: i + 1,
      playerName: r.player_name,
      companyName: r.company_name,
      netWorth: Number(r.net_worth),
      strategy: r.strategy,
      score: Number(r.score),
      mode: r.mode || 'challenge1h',
      date: (r.created_at ?? new Date().toISOString()).slice(0, 10),
      source: 'supabase',
    }));

    return rankEntries([...remote, ...local]);
  } catch {
    return local;
  }
}

export async function submitLeaderboardResult(entry: {
  playerName: string;
  companyName: string;
  netWorth: number;
  strategy: string;
  mode: GameMode;
}): Promise<LeaderboardEntry[]> {
  const score = Math.max(0, Math.round(entry.netWorth / 1000));
  const record: LeaderboardEntry = {
    id: `lb_${Date.now().toString(36)}`,
    rank: 0,
    playerName: entry.playerName,
    companyName: entry.companyName,
    netWorth: Math.round(entry.netWorth),
    strategy: entry.strategy,
    score,
    mode: entry.mode,
    date: new Date().toISOString().slice(0, 10),
    isCurrentPlayer: true,
    source: 'local',
  };

  const current = loadLocalLeaderboard();
  const updated = rankEntries([record, ...current]).slice(0, 50);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage quota errors
  }

  const cfg = getSupabaseConfig();
  if (cfg) {
    try {
      await fetch(`${cfg.url}/rest/v1/leaderboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          player_name: record.playerName,
          company_name: record.companyName,
          net_worth: record.netWorth,
          strategy: record.strategy,
          score: record.score,
          mode: record.mode,
        }),
      });
    } catch {
      // Fallback already persisted in localStorage
    }
  }

  return updated;
}

function rankEntries(list: LeaderboardEntry[]): LeaderboardEntry[] {
  const seen = new Set<string>();
  const deduped = list.filter((e) => {
    const key = `${e.playerName}_${e.netWorth}_${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped
    .sort((a, b) => b.netWorth - a.netWorth)
    .map((e, idx) => ({ ...e, rank: idx + 1 }));
}
