import type { DifficultyPreset, PvPDivisionId, ScenarioId } from '../engine/types';

export interface PublicLobbyListing {
  roomCode: string;
  roomName: string;
  hostName: string;
  hostDivision: PvPDivisionId;
  hostPrestige: number;
  scenarioId: ScenarioId;
  difficultyPreset: DifficultyPreset;
  mapSize: number;
  playerCount: number;
  maxPlayers: number;
  rewardMultiplier: number;
  updatedAt: number;
  gameStarted?: boolean;
}

const LOCAL_LOBBIES_KEY = 'market_dominion_public_lobbies_v1';
const BROADCAST_CHANNEL_NAME = 'market-dominion-public-lobbies-v1';
export const PUBLIC_LOBBY_EXPIRY_MS = 60_000;
export const PUBLIC_LOBBY_HEARTBEAT_MS = 20_000;

function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey || !url.startsWith('http')) {
    return null;
  }
  return { url: url.replace(/\/$/, ''), anonKey };
}

export function isSupabaseDirectoryConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

function getStorageSafe(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function loadLocalLobbiesRaw(): PublicLobbyListing[] {
  const storage = getStorageSafe();
  if (!storage) return [];
  try {
    const raw = storage.getItem(LOCAL_LOBBIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PublicLobbyListing[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter(
      (l) =>
        l &&
        typeof l.roomCode === 'string' &&
        !l.gameStarted &&
        now - (l.updatedAt ?? 0) <= PUBLIC_LOBBY_EXPIRY_MS
    );
  } catch {
    return [];
  }
}

function saveLocalLobbiesRaw(items: PublicLobbyListing[]): void {
  const storage = getStorageSafe();
  if (!storage) return;
  try {
    storage.setItem(LOCAL_LOBBIES_KEY, JSON.stringify(items));
  } catch {
    // ignoruj limit miejsca
  }
}

function broadcastLocalSignal(payload: { kind: 'upsert'; listing: PublicLobbyListing } | { kind: 'remove'; roomCode: string }): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    bc.postMessage(payload);
    bc.close();
  } catch {
    // bez błędu w środowiskach bez BroadcastChannel
  }
}

export function applyLocalDirectoryEvent(
  payload: { kind: 'upsert'; listing: PublicLobbyListing } | { kind: 'remove'; roomCode: string }
): void {
  const existing = loadLocalLobbiesRaw();
  if (payload.kind === 'remove') {
    saveLocalLobbiesRaw(existing.filter((x) => x.roomCode !== payload.roomCode));
  } else {
    const filtered = existing.filter((x) => x.roomCode !== payload.listing.roomCode);
    saveLocalLobbiesRaw([payload.listing, ...filtered].slice(0, 30));
  }
}

export async function publishOrHeartbeatPublicLobby(listing: PublicLobbyListing): Promise<void> {
  const stamped: PublicLobbyListing = { ...listing, updatedAt: Date.now() };
  applyLocalDirectoryEvent({ kind: 'upsert', listing: stamped });
  broadcastLocalSignal({ kind: 'upsert', listing: stamped });

  const sb = getSupabaseConfig();
  if (!sb) return;

  try {
    await fetch(`${sb.url}/rest/v1/public_lobbies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: sb.anonKey,
        Authorization: `Bearer ${sb.anonKey}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        room_code: stamped.roomCode,
        room_name: stamped.roomName,
        host_name: stamped.hostName,
        host_division: stamped.hostDivision,
        host_prestige: stamped.hostPrestige,
        scenario_id: stamped.scenarioId,
        difficulty_preset: stamped.difficultyPreset,
        map_size: stamped.mapSize,
        player_count: stamped.playerCount,
        max_players: stamped.maxPlayers,
        reward_multiplier: stamped.rewardMultiplier,
        game_started: Boolean(stamped.gameStarted),
        updated_at: stamped.updatedAt,
      }),
    });
  } catch {
    // cichy fallback lokalny
  }
}

export async function removePublicLobby(roomCode: string): Promise<void> {
  if (!roomCode) return;
  applyLocalDirectoryEvent({ kind: 'remove', roomCode });
  broadcastLocalSignal({ kind: 'remove', roomCode });

  const sb = getSupabaseConfig();
  if (!sb) return;

  try {
    await fetch(
      `${sb.url}/rest/v1/public_lobbies?room_code=eq.${encodeURIComponent(roomCode)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: sb.anonKey,
          Authorization: `Bearer ${sb.anonKey}`,
        },
      }
    );
  } catch {
    // cichy fallback
  }
}

export async function fetchActivePublicLobbies(): Promise<{
  lobbies: PublicLobbyListing[];
  source: 'supabase' | 'local';
}> {
  const localRooms = loadLocalLobbiesRaw();
  const sb = getSupabaseConfig();
  if (!sb) {
    return {
      lobbies: localRooms.sort((a, b) => b.updatedAt - a.updatedAt),
      source: 'local',
    };
  }

  try {
    const cutoff = Date.now() - PUBLIC_LOBBY_EXPIRY_MS;
    const res = await fetch(
      `${sb.url}/rest/v1/public_lobbies?select=*&game_started=eq.false&updated_at=gte.${cutoff}&order=updated_at.desc&limit=40`,
      {
        headers: {
          apikey: sb.anonKey,
          Authorization: `Bearer ${sb.anonKey}`,
        },
      }
    );
    if (!res.ok) throw new Error('supabase_unavailable');
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const remote: PublicLobbyListing[] = rows.map((r) => ({
      roomCode: String(r.room_code ?? ''),
      roomName: String(r.room_name ?? 'Pokój Publiczny'),
      hostName: String(r.host_name ?? 'Host'),
      hostDivision: (String(r.host_division ?? 'startup') as PvPDivisionId),
      hostPrestige: Number(r.host_prestige ?? 0),
      scenarioId: (String(r.scenario_id ?? 'sandbox') as ScenarioId),
      difficultyPreset: (String(r.difficulty_preset ?? 'standard') as DifficultyPreset),
      mapSize: Number(r.map_size ?? 24),
      playerCount: Number(r.player_count ?? 1),
      maxPlayers: Number(r.max_players ?? 8),
      rewardMultiplier: Number(r.reward_multiplier ?? 1.0),
      updatedAt: Number(r.updated_at ?? Date.now()),
      gameStarted: Boolean(r.game_started),
    }));
    const merged = [...remote];
    for (const loc of localRooms) {
      if (!merged.some((r) => r.roomCode === loc.roomCode)) {
        merged.push(loc);
      }
    }
    return {
      lobbies: merged.sort((a, b) => b.updatedAt - a.updatedAt),
      source: 'supabase',
    };
  } catch {
    return {
      lobbies: localRooms.sort((a, b) => b.updatedAt - a.updatedAt),
      source: 'local',
    };
  }
}

export function subscribePublicLobbySignals(onUpdate: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCAL_LOBBIES_KEY) onUpdate();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (ev) => {
        if (ev.data && (ev.data.kind === 'upsert' || ev.data.kind === 'remove')) {
          applyLocalDirectoryEvent(ev.data);
          onUpdate();
        }
      };
    } catch {
      bc = null;
    }
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
    bc?.close();
  };
}
