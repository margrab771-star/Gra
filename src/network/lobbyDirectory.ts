import type { DifficultyPreset, PvPDivisionId, ScenarioId } from '../engine/types';
import { getCurrentLanguage } from '../i18n';

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
export const PUBLIC_LOBBY_EXPIRY_MS = 90_000;
export const PUBLIC_LOBBY_HEARTBEAT_MS = 18_000;

let lastDirectoryError: string | null = null;
const dirErrorListeners = new Set<(err: string | null) => void>();

function setDirectoryError(err: string | null): void {
  lastDirectoryError = err;
  for (const listener of dirErrorListeners) {
    listener(err);
  }
}

export function getLastSupabaseLobbyError(): string | null {
  return lastDirectoryError;
}

export function subscribeSupabaseDirectoryError(
  listener: (err: string | null) => void
): () => void {
  dirErrorListeners.add(listener);
  return () => {
    dirErrorListeners.delete(listener);
  };
}

function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const hasEnv = typeof import.meta !== 'undefined' && Boolean(import.meta.env);
  const url = (hasEnv ? import.meta.env.VITE_SUPABASE_URL : undefined) as string | undefined;
  const anonKey = (hasEnv ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined) as string | undefined;
  if (!url || !anonKey || !url.startsWith('http')) {
    return null;
  }
  return { url: url.trim().replace(/\/$/, ''), anonKey: anonKey.trim() };
}

export interface SupabasePublicLobbyRow {
  room_code: string;
  room_name: string;
  host_name: string;
  host_division: string;
  host_prestige: number;
  scenario_id: string;
  difficulty_preset: string;
  map_size: number;
  player_count: number;
  max_players: number;
  reward_multiplier: number;
  game_started: boolean;
  updated_at: number;
}

export function buildPublicLobbyUpsertPayload(
  listing: PublicLobbyListing
): SupabasePublicLobbyRow {
  return {
    room_code: String(listing.roomCode).trim(),
    room_name: String(listing.roomName || listing.roomCode).trim(),
    host_name: String(listing.hostName || 'Host').trim(),
    host_division: String(listing.hostDivision || 'startup'),
    host_prestige: Math.max(0, Math.round(Number(listing.hostPrestige ?? 0))),
    scenario_id: String(listing.scenarioId || 'sandbox'),
    difficulty_preset: String(listing.difficultyPreset || 'standard'),
    map_size: Math.max(12, Math.round(Number(listing.mapSize ?? 24))),
    player_count: Math.max(1, Math.round(Number(listing.playerCount ?? 1))),
    max_players: Math.max(2, Math.round(Number(listing.maxPlayers ?? 8))),
    reward_multiplier: Number(Number(listing.rewardMultiplier ?? 1).toFixed(2)),
    game_started: Boolean(listing.gameStarted),
    updated_at: Math.trunc(Number(listing.updatedAt || Date.now())),
  };
}

export function getSupabaseRestHeaders(
  anonKey: string,
  prefer?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
  if (prefer) {
    headers.Prefer = prefer;
  }
  return headers;
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

export async function publishOrHeartbeatPublicLobby(
  listing: PublicLobbyListing
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const stamped: PublicLobbyListing = { ...listing, updatedAt: Date.now() };
  applyLocalDirectoryEvent({ kind: 'upsert', listing: stamped });
  broadcastLocalSignal({ kind: 'upsert', listing: stamped });

  const sb = getSupabaseConfig();
  if (!sb) return { ok: true };

  try {
    const res = await fetch(`${sb.url}/rest/v1/public_lobbies?on_conflict=room_code`, {
      method: 'POST',
      headers: getSupabaseRestHeaders(
        sb.anonKey,
        'resolution=merge-duplicates,return=representation'
      ),
      body: JSON.stringify(buildPublicLobbyUpsertPayload(stamped)),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const msg = `Supabase POST HTTP ${res.status}${errText ? `: ${errText.slice(0, 140)}` : ''}`;
      console.error('[lobbyDirectory] Failed to upsert public lobby:', res.status, errText);
      setDirectoryError(msg);
      return { ok: false, status: res.status, error: msg };
    }
    setDirectoryError(null);
    return { ok: true, status: res.status };
  } catch (err) {
    const errText = err instanceof Error ? err.message : String(err);
    const msg = `Supabase POST network error: ${errText}`;
    console.error('[lobbyDirectory] Network failure during public_lobbies upsert:', err);
    setDirectoryError(msg);
    return { ok: false, error: msg };
  }
}

export async function removePublicLobby(roomCode: string): Promise<void> {
  if (!roomCode) return;
  applyLocalDirectoryEvent({ kind: 'remove', roomCode });
  broadcastLocalSignal({ kind: 'remove', roomCode });

  const sb = getSupabaseConfig();
  if (!sb) return;

  try {
    const res = await fetch(
      `${sb.url}/rest/v1/public_lobbies?room_code=eq.${encodeURIComponent(roomCode)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: sb.anonKey,
          Authorization: `Bearer ${sb.anonKey}`,
        },
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[lobbyDirectory] Failed to delete public lobby:', res.status, errText);
    }
  } catch (err) {
    console.error('[lobbyDirectory] Network failure deleting public lobby:', err);
  }
}

export async function fetchActivePublicLobbies(): Promise<{
  lobbies: PublicLobbyListing[];
  source: 'supabase' | 'local';
  error: string | null;
}> {
  const localRooms = loadLocalLobbiesRaw();
  const sb = getSupabaseConfig();
  if (!sb) {
    return {
      lobbies: localRooms.sort((a, b) => b.updatedAt - a.updatedAt),
      source: 'local',
      error: null,
    };
  }

  try {
    const cutoff = Date.now() - PUBLIC_LOBBY_EXPIRY_MS;
    const res = await fetch(
      `${sb.url}/rest/v1/public_lobbies?select=*&game_started=eq.false&updated_at=gt.${cutoff}&order=updated_at.desc&limit=40`,
      {
        headers: {
          apikey: sb.anonKey,
          Authorization: `Bearer ${sb.anonKey}`,
        },
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const msg = `Supabase GET HTTP ${res.status}${errText ? `: ${errText.slice(0, 140)}` : ''}`;
      console.error('[lobbyDirectory] Failed to fetch public lobbies:', res.status, errText);
      setDirectoryError(msg);
      return {
        lobbies: localRooms.sort((a, b) => b.updatedAt - a.updatedAt),
        source: 'local',
        error: msg,
      };
    }
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const remote: PublicLobbyListing[] = rows.map((r) => ({
      roomCode: String(r.room_code ?? ''),
      roomName: String(r.room_name ?? (getCurrentLanguage() === 'en' ? 'Public Room' : 'Pokój Publiczny')),
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
    setDirectoryError(null);
    return {
      lobbies: merged.sort((a, b) => b.updatedAt - a.updatedAt),
      source: 'supabase',
      error: null,
    };
  } catch (err) {
    const errText = err instanceof Error ? err.message : String(err);
    const msg = `Supabase GET network error: ${errText}`;
    console.error('[lobbyDirectory] Network failure fetching public_lobbies:', err);
    setDirectoryError(msg);
    return {
      lobbies: localRooms.sort((a, b) => b.updatedAt - a.updatedAt),
      source: 'local',
      error: msg,
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
