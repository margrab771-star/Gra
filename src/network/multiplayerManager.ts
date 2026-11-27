import Peer from 'peerjs';
import type { DataConnection, PeerOptions } from 'peerjs';
import { AI_STRATEGY_LABELS, DEFAULT_MUTATORS, PLAYER_COLORS } from '../config/gameConfig';
import { computeRewardMultiplier } from '../data/shopCatalog';
import { getCurrentLanguage } from '../i18n';
import type {
  AIStrategy,
  ArchetypeId,
  GameState,
  LobbyPlayer,
  LobbyState,
  PlayerAction,
  PlayerCardProfile,
  Plot,
  PvPDivisionId,
  ScenarioId,
} from '../engine/types';
import {
  PUBLIC_LOBBY_HEARTBEAT_MS,
  publishOrHeartbeatPublicLobby,
  removePublicLobby,
} from './lobbyDirectory';

export interface GameStateDelta {
  __delta: true;
  changedPlots: Plot[];
  snapshotMeta: Omit<
    GameState,
    'plots' | 'globalTechDefs' | 'entrepreneurSkillDefs'
  >;
}

export type ConnectionStage =
  | 'idle'
  | 'signaling'
  | 'connecting_peer'
  | 'waiting_host'
  | 'connected'
  | 'error';

export type NetworkMessage =
  | {
      kind: 'join_request';
      name: string;
      companyName: string;
      color: string;
      archetype?: ArchetypeId;
      playerCard?: PlayerCardProfile;
    }
  | { kind: 'join_accepted'; assignedPlayerId: string; lobby: LobbyState }
  | { kind: 'join_rejected'; reason: string }
  | { kind: 'lobby_update'; lobby: LobbyState }
  | {
      kind: 'player_ready';
      playerId: string;
      ready: boolean;
      name?: string;
      companyName?: string;
      color?: string;
      archetype?: ArchetypeId;
      playerCard?: PlayerCardProfile;
    }
  | {
      kind: 'GAME_START';
      lobby: LobbyState;
      mapSize: number;
      seedTick: number;
      assignedPlayerId: string;
      startedAt: number;
    }
  | { kind: 'STATE_SYNC'; state: GameState }
  | { kind: 'STATE_DELTA'; delta: GameStateDelta }
  | {
      kind: 'STATE_SYNC_CHUNK';
      transferId: string;
      index: number;
      total: number;
      data: string;
    }
  | { kind: 'GAME_STARTED_ACK'; playerId: string }
  | { kind: 'REQUEST_FULL_SYNC'; playerId: string }
  | { kind: 'player_action'; action: PlayerAction }
  | { kind: 'action_feedback'; targetPlayerId: string; ok: boolean; message: string }
  | { kind: 'ping'; ts: number };

const PEER_PREFIX = 'market-dominion-v1-';
const CONNECTION_TIMEOUT_MS = 10_000;
// 1000 ms między tickami STATE_SYNC – nie zatykamy wolnych łączy TURN/komórkowych
const MIN_SYNC_INTERVAL_MS = 1_000;
const START_RETRY_INTERVAL_MS = 1_500;
const MAX_START_RETRIES = 5;
// 16 KB to bezpieczny próg SCTP WebRTC DataChannel (szczególnie przez TURN i relay)
export const MAX_WEBRTC_CHUNK_BYTES = 16 * 1024;
// Jeśli bufor DataChannel przekracza 256 KB, wstrzymujemy zwykłe tick-synce
const MAX_BUFFERED_AMOUNT_BYTES = 256 * 1024;
// 6-sekundowa tolerancja przed uznaniem rozłączenia za trwałe
const DISCONNECT_GRACE_MS = 6_000;

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export function getPeerOptions(): PeerOptions {
  const isHttps =
    typeof window !== 'undefined' ? window.location.protocol === 'https:' : true;
  return {
    debug: 1,
    secure: isHttps,
    config: {
      iceServers: ICE_SERVERS,
    },
  };
}

export function normalizeRoomCode(code: string): string {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!clean) return '';
  return clean.startsWith('MD-') ? clean : `MD-${clean}`;
}

export function generateRoomCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `MD-${num}`;
}

export function roomCodeToPeerId(code: string): string {
  const normalized = normalizeRoomCode(code) || 'MD-0000';
  return `${PEER_PREFIX}${normalized.toLowerCase()}`;
}

export function getRoomCodeFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const normalized = room ? normalizeRoomCode(room) : '';
    return normalized || null;
  } catch {
    return null;
  }
}

export function buildInviteLink(roomCode: string): string {
  const normalized = normalizeRoomCode(roomCode);
  if (typeof window === 'undefined') {
    return `?room=${encodeURIComponent(normalized)}`;
  }
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?room=${encodeURIComponent(normalized)}`;
}

const utf8Encoder = new TextEncoder();

export function getUtf8ByteLength(text: string): number {
  return utf8Encoder.encode(text).length;
}

/**
 * Konwertuje dowolną strukturę do bezpiecznej postaci JSON (usuwa funkcje, symbole,
 * wartości undefined i cykle; konwertuje Set -> Array oraz Map -> Object).
 */
export function toJsonSafe<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return (Number.isFinite(value) ? value : 0) as T;
  }
  if (typeof value === 'bigint') {
    return Number(value) as T;
  }
  if (typeof value !== 'object') {
    return undefined as T;
  }

  const obj = value as object;
  if (seen.has(obj)) {
    return undefined as T;
  }
  seen.add(obj);

  try {
    if (obj instanceof Date) {
      return obj.toISOString() as T;
    }
    if (obj instanceof Set) {
      const arr: unknown[] = [];
      for (const item of obj.values()) {
        const clean = toJsonSafe(item, seen);
        if (clean !== undefined) arr.push(clean);
      }
      return arr as T;
    }
    if (obj instanceof Map) {
      const rec: Record<string, unknown> = {};
      for (const [k, v] of obj.entries()) {
        const clean = toJsonSafe(v, seen);
        if (clean !== undefined) rec[String(k)] = clean;
      }
      return rec as T;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => {
        const clean = toJsonSafe(item, seen);
        return clean === undefined ? null : clean;
      }) as T;
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') {
        continue;
      }
      const clean = toJsonSafe(v, seen);
      if (clean !== undefined) {
        out[k] = clean;
      }
    }
    return out as T;
  } finally {
    seen.delete(obj);
  }
}

/**
 * Dzieli zserializowany JSON na bezpieczne fragmenty o rozmiarze bajtowym <= maxBytes,
 * nie przecinając par surogatów UTF-16.
 */
export function splitJsonIntoByteChunks(
  json: string,
  maxBytes = MAX_WEBRTC_CHUNK_BYTES
): string[] {
  if (getUtf8ByteLength(json) <= maxBytes) {
    return [json];
  }

  const chunks: string[] = [];
  let offset = 0;
  // Bezpieczny krok początkowy zakładając max ~3 bajty/znak w polskim JSON
  const approxChars = Math.max(256, Math.floor(maxBytes / 3));

  while (offset < json.length) {
    let end = Math.min(json.length, offset + approxChars);

    // Rozszerzaj okno dopóki mieścimy się bezpiecznie w limicie bajtów
    while (end < json.length) {
      let nextEnd = Math.min(json.length, end + Math.max(128, Math.floor((end - offset) / 4)));
      if (nextEnd < json.length) {
        const code = json.charCodeAt(nextEnd - 1);
        if (code >= 0xd800 && code <= 0xdbff) nextEnd--;
      }
      if (nextEnd <= end) break;
      if (getUtf8ByteLength(json.slice(offset, nextEnd)) <= maxBytes) {
        end = nextEnd;
      } else {
        break;
      }
    }

    // Gdy nadal przekracza limit (np. wiele 4-bajtowych emoji), zawężaj do limitu
    while (end > offset + 1 && getUtf8ByteLength(json.slice(offset, end)) > maxBytes) {
      end = Math.max(offset + 1, end - Math.max(64, Math.floor((end - offset) / 6)));
    }

    // Nigdy nie przecinaj pary surogatów UTF-16 na końcu kawałka
    if (end < json.length && end > offset + 1) {
      const lastCode = json.charCodeAt(end - 1);
      if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
        end--;
      }
    }

    chunks.push(json.slice(offset, end));
    offset = end;
  }

  return chunks;
}

/**
 * Składa pocięte fragmenty STATE_SYNC_CHUNK z powrotem w kompletny GameState.
 */
export class StateChunkAssembler {
  private pending = new Map<
    string,
    { total: number; parts: (string | undefined)[]; received: number; createdAt: number }
  >();

  pushChunk(
    transferId: string,
    index: number,
    total: number,
    data: string
  ): { complete: false } | { complete: true; state: GameState | GameStateDelta | null; error?: string } {
    this.pruneExpired();

    if (total <= 0 || index < 0 || index >= total) {
      return { complete: true, state: null, error: 'Nieprawidłowy indeks chunku.' };
    }

    let entry = this.pending.get(transferId);
    if (!entry || entry.total !== total) {
      entry = {
        total,
        parts: new Array<string | undefined>(total),
        received: 0,
        createdAt: Date.now(),
      };
      this.pending.set(transferId, entry);
    }

    if (entry.parts[index] === undefined) {
      entry.received++;
    }
    entry.parts[index] = data;

    if (entry.received < entry.total) {
      return { complete: false };
    }

    this.pending.delete(transferId);
    const fullJson = entry.parts.join('');
    try {
      const parsed = JSON.parse(fullJson) as GameState | GameStateDelta;
      return { complete: true, state: parsed };
    } catch (e) {
      return {
        complete: true,
        state: null,
        error: e instanceof Error ? e.message : 'Błąd parsowania JSON po złożeniu chunków.',
      };
    }
  }

  clear(): void {
    this.pending.clear();
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [id, item] of this.pending.entries()) {
      if (now - item.createdAt > 15_000) {
        this.pending.delete(id);
      }
    }
  }
}

function stripLegacySseFromPlot(pl: Plot): Plot {
  const raw = pl as unknown as Record<string, unknown>;
  const hasLegacySynergy = pl.activeSynergies?.some((s) => (s.kind as string) === 'sse_zone');
  if (!('isSseZone' in raw) && !('sseExpiresTick' in raw) && !hasLegacySynergy) {
    return pl;
  }
  const rest = { ...raw };
  delete rest.isSseZone;
  delete rest.sseExpiresTick;
  if (Array.isArray(rest.activeSynergies)) {
    rest.activeSynergies = (rest.activeSynergies as { kind?: string }[]).filter(
      (s) => s.kind !== 'sse_zone'
    );
  }
  return rest as unknown as Plot;
}

/**
 * Tworzy lekki, w pełni serializowalny JSON snapshot stanu gry bez zbędnej historii wykresów
 * ani struktur nienatywnych dla WebRTC DataConnection (Set/Map/funkcje/cykle).
 */
export function sanitizeStateForNetwork(state: GameState): GameState {
  const compactResourcePrices = state.resourcePrices.map((rp) => ({
    ...rp,
    history: rp.history.slice(-24),
    candles: rp.candles.slice(-20),
  }));

  const compactPlayers = state.players.map((pl) => ({
    ...pl,
    financialHistory: pl.financialHistory.slice(-24),
  }));

  const compactStocks = (state.stocks ?? []).map((s) => ({
    ...s,
    priceHistory: s.priceHistory.slice(-24),
  }));

  const cleanedPlots = state.plots.map(stripLegacySseFromPlot);
  const domThresh = state.settings?.dominationThreshold ?? state.monopolyThreshold ?? 75;

  const trimmed: GameState = {
    ...state,
    settings: {
      ...state.settings,
      dominationThreshold: domThresh,
    },
    monopolyThreshold: domThresh,
    plots: cleanedPlots,
    players: compactPlayers,
    resourcePrices: compactResourcePrices,
    news: state.news.slice(-16),
    notifications: state.notifications.slice(-12),
    activeEvents: state.activeEvents.slice(0, 6),
    pendingForecasts: state.pendingForecasts.slice(0, 4),
    vehicles: state.vehicles.slice(0, 28),
    dispatches: (state.dispatches ?? []).slice(-20),
    fuelDeliveries: (state.fuelDeliveries ?? []).slice(0, 14),
    b2bRoutes: (state.b2bRoutes ?? []).slice(0, 12),
    stocks: compactStocks,
    cashTransfers: (state.cashTransfers ?? []).slice(-40),
    plotOffers: state.plotOffers.slice(-30),
    transportLines: state.transportLines.slice(0, 40),
    matchStatsHistory: (state.matchStatsHistory ?? []).slice(-48),
    lastSyncTimestamp: Date.now(),
  };

  return toJsonSafe(trimmed);
}

export function buildStateDelta(prev: GameState, next: GameState): GameStateDelta {
  const safeNext = sanitizeStateForNetwork(next);
  const changedPlots: Plot[] = [];
  const prevPlots = prev.plots;
  const nextPlots = safeNext.plots;

  for (let i = 0; i < nextPlots.length; i++) {
    const np = nextPlots[i];
    const pp = prevPlots[i];
    if (!pp || pp.id !== np.id) {
      changedPlots.push(np);
      continue;
    }
    if (
      pp.ownerId === np.ownerId &&
      pp.price === np.price &&
      pp.hasRoad === np.hasRoad &&
      pp.roadType === np.roadType &&
      pp.tollRate === np.tollRate &&
      pp.roadBlocked === np.roadBlocked &&
      pp.attractiveness === np.attractiveness &&
      pp.crimeScore === np.crimeScore &&
      pp.responseEta === np.responseEta &&
      pp.hasElectricity === np.hasElectricity &&
      pp.hasWater === np.hasWater &&
      (pp.irradiatedTicks ?? 0) === (np.irradiatedTicks ?? 0) &&
      (pp.disasterDamagedTicks ?? 0) === (np.disasterDamagedTicks ?? 0) &&
      (pp.synergyPercent ?? 0) === (np.synergyPercent ?? 0) &&
      (pp.passengerDemandPercent ?? 100) === (np.passengerDemandPercent ?? 100) &&
      pp.building === null &&
      np.building === null &&
      Object.keys(pp.surveyedBy ?? {}).length === Object.keys(np.surveyedBy ?? {}).length &&
      (pp.blockedPlayers?.length ?? 0) === (np.blockedPlayers?.length ?? 0)
    ) {
      continue;
    }
    if (JSON.stringify(pp) !== JSON.stringify(np)) {
      changedPlots.push(np);
    }
  }

  const {
    plots: _omitPlots,
    globalTechDefs: _omitTech,
    entrepreneurSkillDefs: _omitEnt,
    ...snapshotMeta
  } = safeNext;

  return {
    __delta: true,
    changedPlots,
    snapshotMeta,
  };
}

export function applyStateDelta(current: GameState, delta: GameStateDelta): GameState {
  const updatedPlots = [...current.plots];
  if (delta.changedPlots.length > 0) {
    const idxById = new Map<string, number>();
    for (let i = 0; i < updatedPlots.length; i++) {
      idxById.set(updatedPlots[i].id, i);
    }
    for (const cp of delta.changedPlots) {
      const idx = idxById.get(cp.id);
      if (idx !== undefined) {
        updatedPlots[idx] = stripLegacySseFromPlot(cp);
      }
    }
  }

  return {
    ...current,
    ...delta.snapshotMeta,
    plots: updatedPlots,
    globalTechDefs: current.globalTechDefs,
    entrepreneurSkillDefs: current.entrepreneurSkillDefs,
  };
}

function chunkSerializedPayload(
  payloadJson: string,
  transferIdPrefix: string
): NetworkMessage[] {
  const transferId = `${transferIdPrefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const payloadEnvelopeBytes = 256;
  const rawChunks = splitJsonIntoByteChunks(
    payloadJson,
    Math.floor((MAX_WEBRTC_CHUNK_BYTES - payloadEnvelopeBytes) * 0.72)
  );

  const finalChunks: string[] = [];
  for (const part of rawChunks) {
    const wrappedLen = getUtf8ByteLength(
      JSON.stringify({
        kind: 'STATE_SYNC_CHUNK',
        transferId,
        index: 0,
        total: 999,
        data: part,
      })
    );
    if (wrappedLen <= MAX_WEBRTC_CHUNK_BYTES) {
      finalChunks.push(part);
    } else {
      finalChunks.push(
        ...splitJsonIntoByteChunks(
          part,
          Math.floor((MAX_WEBRTC_CHUNK_BYTES - payloadEnvelopeBytes) * 0.5)
        )
      );
    }
  }

  return finalChunks.map((data, index) => ({
    kind: 'STATE_SYNC_CHUNK',
    transferId,
    index,
    total: finalChunks.length,
    data,
  }));
}

export function buildStateDeltaMessages(
  prev: GameState,
  next: GameState,
  transferIdPrefix = 'delta'
): NetworkMessage[] {
  const delta = buildStateDelta(prev, next);
  const directMsg: NetworkMessage = { kind: 'STATE_DELTA', delta };
  const directJson = JSON.stringify(directMsg);
  if (getUtf8ByteLength(directJson) <= MAX_WEBRTC_CHUNK_BYTES) {
    return [directMsg];
  }
  return chunkSerializedPayload(JSON.stringify(delta), transferIdPrefix);
}

/**
 * Buduje listę komunikatów (pojedynczy STATE_SYNC albo chunki <= 16 KB) do wysłania przez DataChannel.
 */
export function buildStateSyncMessages(
  state: GameState,
  transferIdPrefix = 'sync'
): NetworkMessage[] {
  const safe = sanitizeStateForNetwork(state);
  const directMsg: NetworkMessage = { kind: 'STATE_SYNC', state: safe };
  const directJson = JSON.stringify(directMsg);
  if (getUtf8ByteLength(directJson) <= MAX_WEBRTC_CHUNK_BYTES) {
    return [directMsg];
  }
  return chunkSerializedPayload(JSON.stringify(safe), transferIdPrefix);
}

export function translatePeerError(err: unknown): string {
  const rawType =
    typeof err === 'object' && err !== null && 'type' in err
      ? String((err as { type?: unknown }).type)
      : '';
  const en = getCurrentLanguage() === 'en';
  const rawMsg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : en
          ? 'Unknown network error'
          : 'Nieznany błąd sieci';

  switch (rawType) {
    case 'peer-unavailable':
      return en
        ? 'No room found with that code. Check the code or confirm the Host still has the match open.'
        : 'Nie znaleziono pokoju o podanym kodzie. Sprawdź kod lub upewnij się, że Host nadal ma otwartą grę.';
    case 'unavailable-id':
      return en
        ? 'Generated room code is already taken. Try creating the room again.'
        : 'Wygenerowany kod pokoju jest już zajęty. Spróbuj ponownie utworzyć pokój.';
    case 'network':
      return en
        ? 'Lost connection to the WebRTC signaling server. Check your internet and retry.'
        : 'Utracono połączenie z serwerem sygnalizacyjnym WebRTC. Sprawdź internet lub spróbuj ponownie.';
    case 'browser-incompatible':
      return en
        ? 'Your browser does not support WebRTC DataChannel required for online multiplayer.'
        : 'Twoja przeglądarka nie obsługuje WebRTC DataChannel wymaganego do trybu sieciowego.';
    case 'ssl-unavailable':
      return en
        ? 'The signaling server requires a secure HTTPS/WSS connection.'
        : 'Serwer sygnalizacyjny wymaga bezpiecznego połączenia HTTPS/WSS.';
    case 'webrtc':
      return en
        ? 'P2P connection error (NAT/Firewall blocked direct WebRTC DataChannel).'
        : 'Błąd połączenia P2P (NAT/Firewall zablokował bezpośredni kanał WebRTC).';
    default:
      return en ? `WebRTC network error: ${rawMsg}` : `Błąd sieci WebRTC: ${rawMsg}`;
  }
}

export interface P2PReadinessReport {
  ok: boolean;
  protocol: string;
  stunConfigured: boolean;
  latencyMs: number;
  message: string;
}

export async function testP2PReadiness(): Promise<P2PReadinessReport> {
  const started = performance.now();
  const en = getCurrentLanguage() === 'en';
  const protocol =
    typeof window !== 'undefined' ? window.location.protocol : 'https:';

  if (typeof RTCPeerConnection === 'undefined') {
    return {
      ok: false,
      protocol,
      stunConfigured: false,
      latencyMs: 0,
      message: en
        ? 'Your browser does not support RTCPeerConnection.'
        : 'Przeglądarka nie obsługuje interfejsu RTCPeerConnection.',
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    let tempPeer: Peer | null = null;

    const finish = (ok: boolean, message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        tempPeer?.destroy();
      } catch {
        // Ignoruj błąd czyszczenia tymczasowego peer
      }
      resolve({
        ok,
        protocol,
        stunConfigured: true,
        latencyMs: Math.round(performance.now() - started),
        message,
      });
    };

    const timer = window.setTimeout(() => {
      finish(
        false,
        en
          ? 'Timed out after 8s testing PeerJS signaling server (WSS/STUN).'
          : 'Przekroczono limit 8 s podczas testu serwera sygnalizacyjnego PeerJS (WSS/STUN).'
      );
    }, 8_000);

    try {
      tempPeer = new Peer(getPeerOptions());
      tempPeer.on('open', (id) => {
        finish(
          true,
          en
            ? `P2P ready (${protocol === 'https:' ? 'WSS/HTTPS' : 'WS'} + STUN, probe ID: ${id.slice(0, 8)}…).`
            : `Gotowość P2P potwierdzona (${protocol === 'https:' ? 'WSS/HTTPS' : 'WS'} + STUN, ID testowe: ${id.slice(0, 8)}…).`
        );
      });
      tempPeer.on('error', (err) => {
        finish(false, translatePeerError(err));
      });
    } catch (e) {
      finish(false, translatePeerError(e));
    }
  });
}

export interface MultiplayerCallbacks {
  onLobbyChange: (lobby: LobbyState) => void;
  onGameStartSignal: (lobby: LobbyState, localPlayerId: string) => void;
  onStateSync: (state: GameState, localPlayerId: string) => void;
  onClientAction: (action: PlayerAction) => void;
  onRequestFullSync: () => GameState | null;
  onClientReconnected: (playerId: string) => void;
  onActionFeedback: (ok: boolean, message: string) => void;
  onPeerDisconnected: (playerId: string) => void;
  onHostDisconnected: () => void;
  onConnectionStage: (stage: ConnectionStage, label: string) => void;
  onError: (msg: string) => void;
}

export interface PeerLinkLike {
  peer: string;
  open: boolean;
  dataChannel?: { bufferedAmount?: number };
  send: (data: unknown) => void;
  close: () => void;
  on: (event: string, cb: (arg?: unknown) => void) => void;
}

function parseIncomingNetworkMessage(raw: unknown): NetworkMessage | null {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as NetworkMessage) : null;
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;
  return raw as NetworkMessage;
}

export class MultiplayerManager {
  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private clientConns: Map<string, DataConnection> = new Map();
  private peerToPlayerId: Map<string, string> = new Map();
  private callbacks: Partial<MultiplayerCallbacks> = {};
  private lobby: LobbyState | null = null;
  private isHostFlag = false;
  private localPlayerId = 'player_1';
  private heartbeatTimer: number | null = null;
  private startRetryTimer: number | null = null;
  private startRetryAttempts = 0;
  private ackedPlayerIds: Set<string> = new Set();
  private lastBroadcastedState: GameState | null = null;
  private lastDeltaBaseline: GameState | null = null;
  private deltasSinceFull = 0;
  private lastClientState: GameState | null = null;
  private lastStartTimestamp = 0;
  private ackedStartTimestamp = 0;
  private hasReceivedInitialSync = false;
  private chunkAssembler = new StateChunkAssembler();
  private lastSyncSentAt = 0;
  // Mapa timerów opóźnionego rozłączenia (grace period 6s) – klucz: peerId klienta lub 'host'
  private disconnectGraceTimers: Map<string, number> = new Map();
  // Znacznik czasu ostatniej aktywności (heartbeat/data) per peerId
  private lastActivityAt: Map<string, number> = new Map();
  private publicLobbyTimer: number | null = null;
  private publishedRoomCode: string | null = null;

  setCallbacks(cb: Partial<MultiplayerCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...cb };
  }

  private setStage(stage: ConnectionStage, label: string): void {
    this.callbacks.onConnectionStage?.(stage, label);
  }

  get isHost(): boolean {
    return this.isHostFlag;
  }

  get currentLobby(): LobbyState | null {
    return this.lobby;
  }

  get myPlayerId(): string {
    return this.localPlayerId;
  }

  /**
   * Umożliwia wstrzyknięcie wirtualnego stanu Hosta i połączeń w testach integracyjnych.
   */
  attachHostTestSession(lobby: LobbyState, conns: Map<string, PeerLinkLike>, peerMap: Map<string, string>): void {
    this.disconnect();
    this.isHostFlag = true;
    this.localPlayerId = 'player_1';
    this.lobby = lobby;
    this.clientConns = conns as unknown as Map<string, DataConnection>;
    this.peerToPlayerId = new Map(peerMap);
    for (const [pid, conn] of conns.entries()) {
      conn.on('data', (raw) => {
        const msg = parseIncomingNetworkMessage(raw);
        if (msg) this.handleHostIncoming(conn as unknown as DataConnection, msg);
      });
      if (!this.peerToPlayerId.has(pid)) {
        this.peerToPlayerId.set(pid, pid);
      }
    }
  }

  attachClientTestConnection(conn: PeerLinkLike, assignedPlayerId: string): void {
    this.disconnect();
    this.isHostFlag = false;
    this.localPlayerId = assignedPlayerId;
    this.hostConn = conn as unknown as DataConnection;
    conn.on('data', (raw) => {
      const msg = parseIncomingNetworkMessage(raw);
      if (msg) this.handleClientIncoming(msg);
    });
  }

  async createRoom(
    hostName: string,
    companyName: string,
    color: string,
    opts?: {
      archetype?: ArchetypeId;
      playerCard?: PlayerCardProfile;
      isPublic?: boolean;
      roomName?: string;
      hostDivision?: PvPDivisionId;
      hostPrestige?: number;
      hostUnlockedScenarios?: ScenarioId[];
    }
  ): Promise<LobbyState> {
    this.disconnect();
    const roomCode = generateRoomCode();
    const peerId = roomCodeToPeerId(roomCode);
    this.isHostFlag = true;
    this.localPlayerId = 'player_1';
    const en = getCurrentLanguage() === 'en';
    this.setStage(
      'signaling',
      en ? 'Connecting to WebRTC signaling server...' : 'Łączenie z serwerem sygnalizacyjnym WebRTC...'
    );

    const initialLobby: LobbyState = {
      roomCode,
      mode: 'mp_fast',
      mapSize: 24,
      aiDifficulty: 2,
      maxPlayers: 8,
      disastersEnabled: true,
      victoryMode: 'solo',
      dominationThreshold: 75,
      difficultyPreset: 'standard',
      scenarioId: 'sandbox',
      mutators: { ...DEFAULT_MUTATORS },
      isPublic: opts?.isPublic ?? true,
      roomName:
        opts?.roomName?.trim() ||
        (en ? `${hostName || 'CEO'}'s Session (${roomCode})` : `Sesja ${hostName || 'Prezesa'} (${roomCode})`),
      hostDivision: opts?.hostDivision ?? opts?.playerCard?.pvpDivisionId ?? 'startup',
      hostPrestige: opts?.hostPrestige ?? opts?.playerCard?.prestigeLevel ?? 0,
      hostUnlockedScenarios: opts?.hostUnlockedScenarios ?? ['sandbox', 'gold_rush'],
      gameStarted: false,
      players: [
        {
          id: 'player_1',
          peerId,
          name: hostName || 'Host',
          companyName: companyName || 'Dominion Capital S.A.',
          color: color || PLAYER_COLORS[0],
          isHost: true,
          isAI: false,
          ready: true,
          connected: true,
          archetype: opts?.archetype ?? 'standard',
          playerCard: opts?.playerCard,
        },
      ],
    };
    this.lobby = initialLobby;

    return new Promise((resolve, reject) => {
      const peer = new Peer(peerId, getPeerOptions());
      this.peer = peer;
      let settled = false;

      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        const msg =
          getCurrentLanguage() === 'en'
            ? 'Timed out after 10s connecting to the WebRTC signaling server.'
            : 'Przekroczono limit 10 s połączenia z serwerem sygnalizacyjnym WebRTC.';
        this.setStage('error', msg);
        this.disconnect();
        reject(new Error(msg));
      }, CONNECTION_TIMEOUT_MS);

      peer.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.startHeartbeat();
        this.startPublicDirectoryHeartbeat();
        this.setStage(
          'connected',
          getCurrentLanguage() === 'en'
            ? `Room ${roomCode} active — waiting for players.`
            : `Pokój ${roomCode} aktywny — oczekiwanie na graczy.`
        );
        this.callbacks.onLobbyChange?.(initialLobby);
        resolve(initialLobby);
      });

      peer.on('connection', (conn) => {
        this.setupHostClientConnection(conn);
      });

      peer.on('error', (err) => {
        const msg = translatePeerError(err);
        this.setStage('error', msg);
        this.callbacks.onError?.(msg);
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          this.disconnect();
          reject(new Error(msg));
        }
      });
    });
  }

  private setupHostClientConnection(conn: DataConnection): void {
    if (conn.open) {
      this.clientConns.set(conn.peer, conn);
      this.lastActivityAt.set(conn.peer, Date.now());
    }
    conn.on('open', () => {
      this.clientConns.set(conn.peer, conn);
      this.lastActivityAt.set(conn.peer, Date.now());
      // Anuluj ewentualny timer grace-period gdy klient wrócił do sieci
      this.cancelGraceTimer(conn.peer);
    });

    conn.on('data', (raw) => {
      // Zarejestruj aktywność → anuluj timer rozłączenia grace-period
      this.lastActivityAt.set(conn.peer, Date.now());
      this.cancelGraceTimer(conn.peer);
      const msg = parseIncomingNetworkMessage(raw);
      if (!msg) return;
      this.handleHostIncoming(conn, msg);
    });

    conn.on('close', () => {
      const pid = this.peerToPlayerId.get(conn.peer);
      if (!pid || !this.lobby) {
        this.clientConns.delete(conn.peer);
        this.peerToPlayerId.delete(conn.peer);
        return;
      }
      // Lobby jeszcze nie ruszyło → natychmiastowe usunięcie z listy graczy
      if (!this.lobby.gameStarted) {
        this.clientConns.delete(conn.peer);
        this.peerToPlayerId.delete(conn.peer);
        const lp = this.lobby.players.find((p) => p.id === pid);
        if (lp) lp.connected = false;
        this.lobby.players = this.lobby.players.filter((p) => p.id !== pid);
        this.broadcastLobby();
        return;
      }
      // Gra trwa → 6-sekundowy grace period: czekamy czy połączenie wróci
      if (this.disconnectGraceTimers.has(conn.peer)) return; // już czekamy
      const peerIdSnapshot = conn.peer;
      const pidSnapshot = pid;
      const lobbyRef = this.lobby;
      const lp = lobbyRef.players.find((p) => p.id === pidSnapshot);
      if (lp) lp.connected = false;
      const timerId = globalThis.setTimeout(() => {
        this.disconnectGraceTimers.delete(peerIdSnapshot);
        // Sprawdź czy klient nie wrócił w międzyczasie
        const reconnected = this.clientConns.get(peerIdSnapshot)?.open;
        if (reconnected) return;
        this.clientConns.delete(peerIdSnapshot);
        this.peerToPlayerId.delete(peerIdSnapshot);
        this.callbacks.onPeerDisconnected?.(pidSnapshot);
      }, DISCONNECT_GRACE_MS) as unknown as number;
      this.disconnectGraceTimers.set(conn.peer, timerId);
    });

    conn.on('error', () => {
      // Błąd nie jest powodem do natychmiastowego ogłoszenia rozłączenia –
      // zdarzenie 'close' też nastąpi jeśli połączenie faktycznie padło.
    });
  }

  /** Anuluje timer grace-period dla danego peerId (gdy klient wrócił). */
  private cancelGraceTimer(peerId: string): void {
    const existing = this.disconnectGraceTimers.get(peerId);
    if (existing !== undefined) {
      clearTimeout(existing);
      this.disconnectGraceTimers.delete(peerId);
    }
  }

  /** Anuluje wszystkie aktywne timery grace-period. */
  private clearAllGraceTimers(): void {
    for (const timerId of this.disconnectGraceTimers.values()) {
      clearTimeout(timerId);
    }
    this.disconnectGraceTimers.clear();
  }

  private handleHostIncoming(conn: DataConnection, msg: NetworkMessage): void {
    if (!this.lobby) return;
    this.clientConns.set(conn.peer, conn);
    // Każdy odebrany pakiet od klienta anuluje jego grace timer rozłączenia
    this.lastActivityAt.set(conn.peer, Date.now());
    this.cancelGraceTimer(conn.peer);

    if (msg.kind === 'join_request') {
      if (this.lobby.gameStarted) {
        // Pozwól na ponowne dołączenie gracza po odświeżeniu strony
        const reconnecting = this.lobby.players.find(
          (p) =>
            !p.isAI &&
            !p.isHost &&
            ((p.name && p.name === msg.name) || (p.companyName && p.companyName === msg.companyName))
        );
        if (reconnecting) {
          reconnecting.peerId = conn.peer;
          reconnecting.connected = true;
          this.peerToPlayerId.set(conn.peer, reconnecting.id);
          this.ackedPlayerIds.delete(reconnecting.id);
          conn.send({
            kind: 'join_accepted',
            assignedPlayerId: reconnecting.id,
            lobby: this.lobby,
          } satisfies NetworkMessage);
          this.callbacks.onClientReconnected?.(reconnecting.id);
          const currentState = this.callbacks.onRequestFullSync?.() ?? this.lastBroadcastedState;
          if (currentState) {
            this.sendStartAndSyncToConn(conn, reconnecting.id, currentState);
          }
          return;
        }
        conn.send({
          kind: 'join_rejected',
          reason:
            getCurrentLanguage() === 'en'
              ? 'This match has already started.'
              : 'Rozgrywka w tym pokoju już się rozpoczęła.',
        } satisfies NetworkMessage);
        return;
      }
      const humanCount = this.lobby.players.filter((p) => !p.isAI).length;
      if (humanCount >= this.lobby.maxPlayers) {
        conn.send({
          kind: 'join_rejected',
          reason:
            getCurrentLanguage() === 'en'
              ? `Room is already full (max ${this.lobby.maxPlayers} players).`
              : `Pokój jest już pełny (maks. ${this.lobby.maxPlayers} graczy).`,
        } satisfies NetworkMessage);
        return;
      }

      if (this.lobby.players.length >= this.lobby.maxPlayers) {
        const botIdx = this.lobby.players.findIndex((p) => p.isAI);
        if (botIdx !== -1) this.lobby.players.splice(botIdx, 1);
      }

      const nextIdx = this.lobby.players.length + 1;
      const newPlayerId = `player_${Date.now().toString(36).slice(-4)}_${nextIdx}`;
      const usedColors = new Set(this.lobby.players.map((p) => p.color));
      const pickedColor =
        !usedColors.has(msg.color) && msg.color
          ? msg.color
          : PLAYER_COLORS.find((c) => !usedColors.has(c)) ??
            PLAYER_COLORS[nextIdx % PLAYER_COLORS.length];

      const lp: LobbyPlayer = {
        id: newPlayerId,
        peerId: conn.peer,
        name: msg.name || `Gracz ${nextIdx}`,
        companyName: msg.companyName || `Korporacja ${nextIdx}`,
        color: pickedColor,
        isHost: false,
        isAI: false,
        ready: false,
        connected: true,
        archetype: msg.archetype ?? 'standard',
        playerCard: msg.playerCard,
      };

      this.lobby.players.push(lp);
      this.peerToPlayerId.set(conn.peer, newPlayerId);
      this.clientConns.set(conn.peer, conn);

      conn.send({
        kind: 'join_accepted',
        assignedPlayerId: newPlayerId,
        lobby: this.lobby,
      } satisfies NetworkMessage);

      this.broadcastLobby();
    } else if (msg.kind === 'player_ready') {
      const lp = this.lobby.players.find((p) => p.id === msg.playerId);
      if (lp) {
        lp.ready = msg.ready;
        if (msg.name) lp.name = msg.name;
        if (msg.companyName) lp.companyName = msg.companyName;
        if (msg.color) lp.color = msg.color;
        if (msg.archetype) lp.archetype = msg.archetype;
        if (msg.playerCard) lp.playerCard = msg.playerCard;
        this.broadcastLobby();
      }
    } else if (msg.kind === 'player_action') {
      this.callbacks.onClientAction?.(msg.action);
    } else if (msg.kind === 'GAME_STARTED_ACK') {
      const pid = msg.playerId || this.peerToPlayerId.get(conn.peer);
      if (pid) {
        this.ackedPlayerIds.add(pid);
        if (this.areAllClientsAcked()) {
          this.stopStartRetry();
        }
      }
    } else if (msg.kind === 'REQUEST_FULL_SYNC') {
      const pid = msg.playerId || this.peerToPlayerId.get(conn.peer) || '';
      if (pid) {
        this.peerToPlayerId.set(conn.peer, pid);
      }
      const currentState = this.callbacks.onRequestFullSync?.() ?? this.lastBroadcastedState;
      if (currentState) {
        this.sendStartAndSyncToConn(conn, pid, currentState);
      }
    }
  }

  async joinRoom(
    roomCode: string,
    playerName: string,
    companyName: string,
    color: string,
    opts?: { archetype?: ArchetypeId; playerCard?: PlayerCardProfile }
  ): Promise<{ lobby: LobbyState; playerId: string }> {
    const normalizedCode = normalizeRoomCode(roomCode);
    if (!normalizedCode || normalizedCode.length < 5) {
      const msg = 'Podaj poprawny kod pokoju (np. MD-4821).';
      this.setStage('error', msg);
      throw new Error(msg);
    }

    this.disconnect();
    this.isHostFlag = false;
    const hostPeerId = roomCodeToPeerId(normalizedCode);
    const en = getCurrentLanguage() === 'en';
    this.setStage(
      'signaling',
      en ? 'Connecting to WebRTC signaling server...' : 'Łączenie z serwerem sygnalizacyjnym WebRTC...'
    );

    return new Promise((resolve, reject) => {
      const peer = new Peer(getPeerOptions());
      this.peer = peer;
      let settled = false;

      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        const msg =
          getCurrentLanguage() === 'en'
            ? 'Failed to connect to room within 10s. Verify the code, ensure the Host keeps their tab active, and retry.'
            : 'Nie udało się połączyć z pokojem w ciągu 10 s. Sprawdź kod, czy Host ma aktywną kartę i ponów próbę.';
        this.setStage('error', msg);
        this.disconnect();
        reject(new Error(msg));
      }, CONNECTION_TIMEOUT_MS);

      peer.on('open', () => {
        const curEn = getCurrentLanguage() === 'en';
        this.setStage(
          'connecting_peer',
          curEn
            ? `Establishing direct P2P channel with room ${normalizedCode}...`
            : `Nawiązywanie bezpośredniego kanału P2P z pokojem ${normalizedCode}...`
        );
        const conn = peer.connect(hostPeerId, {
          reliable: true,
          serialization: 'json',
        });
        this.hostConn = conn;

        conn.on('open', () => {
          this.setStage(
            'waiting_host',
            getCurrentLanguage() === 'en'
              ? 'Connected to Host — awaiting approval...'
              : 'Połączono z Hostem — oczekiwanie na dołączenie...'
          );
          conn.send({
            kind: 'join_request',
            name: playerName,
            companyName,
            color,
            archetype: opts?.archetype ?? 'standard',
            playerCard: opts?.playerCard,
          } satisfies NetworkMessage);
        });

        conn.on('data', (raw) => {
          const msg = parseIncomingNetworkMessage(raw);
          if (!msg) return;

          if (msg.kind === 'join_accepted') {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
            }
            this.localPlayerId = msg.assignedPlayerId;
            const normalizedLobby: LobbyState = {
              ...msg.lobby,
              dominationThreshold: msg.lobby.dominationThreshold ?? 75,
            };
            this.lobby = normalizedLobby;
            this.startHeartbeat();
            this.setStage(
              'connected',
              getCurrentLanguage() === 'en'
                ? `Connected to room ${normalizedCode}.`
                : `Połączono z pokojem ${normalizedCode}.`
            );
            this.callbacks.onLobbyChange?.(normalizedLobby);
            resolve({ lobby: normalizedLobby, playerId: msg.assignedPlayerId });
            if (normalizedLobby.gameStarted) {
              this.callbacks.onGameStartSignal?.(normalizedLobby, this.localPlayerId);
              this.requestFullSync();
            }
          } else if (msg.kind === 'join_rejected') {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
            }
            this.setStage('error', msg.reason);
            this.disconnect();
            reject(new Error(msg.reason));
          } else {
            // Zarejestruj aktywność Hosta → anuluj ewentualny grace timer
            this.cancelGraceTimer('host');
            this.handleClientIncoming(msg);
          }
        });

        conn.on('close', () => {
          // 6-sekundowy grace period: przejście Lobby → Gra może chwilowo wywołać
          // zdarzenie 'close' gdy przeglądarka przerysowuje DOM. Czekamy zanim
          // ogłosimy rozłączenie Hosta.
          if (this.disconnectGraceTimers.has('host')) return;
          const timerId = globalThis.setTimeout(() => {
            this.disconnectGraceTimers.delete('host');
            // Jeśli połączenie wróciło (conn.open jest znowu true), ignorujemy
            if (this.hostConn?.open) return;
            this.callbacks.onHostDisconnected?.();
          }, DISCONNECT_GRACE_MS) as unknown as number;
          this.disconnectGraceTimers.set('host', timerId);
        });

        conn.on('error', (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            const errMsg = translatePeerError(err);
            this.setStage('error', errMsg);
            this.disconnect();
            reject(new Error(errMsg));
          }
        });
      });

      peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          const errMsg = translatePeerError(err);
          this.setStage('error', errMsg);
          this.disconnect();
          reject(new Error(errMsg));
        }
      });
    });
  }

  private handleClientIncoming(msg: NetworkMessage): void {
    if (msg.kind === 'lobby_update') {
      const normalizedLobby: LobbyState = {
        ...msg.lobby,
        dominationThreshold: msg.lobby.dominationThreshold ?? 75,
      };
      this.lobby = normalizedLobby;
      this.callbacks.onLobbyChange?.(normalizedLobby);
      if (normalizedLobby.gameStarted && !this.hasReceivedInitialSync) {
        this.callbacks.onGameStartSignal?.(normalizedLobby, this.localPlayerId);
        this.requestFullSync();
      }
    } else if (msg.kind === 'GAME_START') {
      if (msg.assignedPlayerId) {
        this.localPlayerId = msg.assignedPlayerId;
      }
      this.lastStartTimestamp = msg.startedAt;
      this.lobby = {
        ...msg.lobby,
        dominationThreshold: msg.lobby.dominationThreshold ?? 75,
        gameStarted: true,
      };
      this.callbacks.onLobbyChange?.(this.lobby);
      this.callbacks.onGameStartSignal?.(this.lobby, this.localPlayerId);
      if (this.hasReceivedInitialSync && this.ackedStartTimestamp !== msg.startedAt) {
        this.sendGameStartedAck(msg.startedAt);
      }
    } else if (msg.kind === 'STATE_SYNC') {
      this.handleClientStateReceived(msg.state);
    } else if (msg.kind === 'STATE_DELTA') {
      this.handleClientDeltaReceived(msg.delta);
    } else if (msg.kind === 'STATE_SYNC_CHUNK') {
      const assembled = this.chunkAssembler.pushChunk(
        msg.transferId,
        msg.index,
        msg.total,
        msg.data
      );
      if (assembled.complete) {
        if (assembled.state) {
          if ('__delta' in assembled.state && assembled.state.__delta) {
            this.handleClientDeltaReceived(assembled.state as GameStateDelta);
          } else {
            this.handleClientStateReceived(assembled.state as GameState);
          }
        } else {
          this.requestFullSync();
        }
      }
    } else if (msg.kind === 'action_feedback') {
      if (msg.targetPlayerId === this.localPlayerId) {
        this.callbacks.onActionFeedback?.(msg.ok, msg.message);
      }
    }
  }

  private handleClientDeltaReceived(delta: GameStateDelta): void {
    if (!this.lastClientState) {
      this.requestFullSync();
      return;
    }
    const merged = applyStateDelta(this.lastClientState, delta);
    this.handleClientStateReceived(merged);
  }

  private handleClientStateReceived(state: GameState): void {
    this.lastClientState = state;
    this.hasReceivedInitialSync = true;
    this.callbacks.onStateSync?.(state, this.localPlayerId);
    const ackTargetTs = this.lastStartTimestamp || Date.now();
    if (this.ackedStartTimestamp !== ackTargetTs) {
      this.sendGameStartedAck(ackTargetTs);
    }
  }

  private sendGameStartedAck(startTimestamp: number): void {
    if (this.isHostFlag || !this.hostConn?.open) return;
    this.ackedStartTimestamp = startTimestamp;
    this.hostConn.send({
      kind: 'GAME_STARTED_ACK',
      playerId: this.localPlayerId,
    } satisfies NetworkMessage);
  }

  requestFullSync(): void {
    if (this.isHostFlag || !this.hostConn?.open) return;
    this.hostConn.send({
      kind: 'REQUEST_FULL_SYNC',
      playerId: this.localPlayerId,
    } satisfies NetworkMessage);
  }

  updateLobbySettings(
    partial: Partial<
      Pick<
        LobbyState,
        | 'mode'
        | 'mapSize'
        | 'aiDifficulty'
        | 'disastersEnabled'
        | 'victoryMode'
        | 'dominationThreshold'
        | 'difficultyPreset'
        | 'scenarioId'
        | 'mutators'
        | 'isPublic'
        | 'roomName'
      >
    >
  ): void {
    if (!this.isHostFlag || !this.lobby) return;
    this.lobby = { ...this.lobby, ...partial };
    this.broadcastLobby();
  }

  updateLocalLobbyProfile(opts: { archetype?: ArchetypeId; playerCard?: PlayerCardProfile }): void {
    if (!this.lobby) return;
    if (this.isHostFlag) {
      const me = this.lobby.players.find((p) => p.id === this.localPlayerId);
      if (me) {
        if (opts.archetype) me.archetype = opts.archetype;
        if (opts.playerCard) me.playerCard = opts.playerCard;
        this.broadcastLobby();
      }
    } else if (this.hostConn?.open) {
      const me = this.lobby.players.find((p) => p.id === this.localPlayerId);
      if (me) {
        if (opts.archetype) me.archetype = opts.archetype;
        if (opts.playerCard) me.playerCard = opts.playerCard;
        this.callbacks.onLobbyChange?.({ ...this.lobby, players: [...this.lobby.players] });
      }
      this.hostConn.send({
        kind: 'player_ready',
        playerId: this.localPlayerId,
        ready: Boolean(me?.ready),
        archetype: opts.archetype,
        playerCard: opts.playerCard,
      } satisfies NetworkMessage);
    }
  }

  toggleAISlot(addBot: boolean): void {
    if (!this.isHostFlag || !this.lobby) return;
    if (addBot) {
      if (this.lobby.players.length >= this.lobby.maxPlayers) return;
      const strategies: AIStrategy[] = [
        'industrialist',
        'energyMagnate',
        'realEstate',
        'shadowBroker',
        'military',
        'supplyChain',
      ];
      const usedColors = new Set(this.lobby.players.map((p) => p.color));
      const idx = this.lobby.players.length;
      const strat = strategies[idx % strategies.length];
      const aiArchs: ArchetypeId[] = ['industrialist' === strat ? 'industrial_giant' : strat === 'energyMagnate' ? 'tech_incubator' : strat === 'realEstate' ? 'investment_fund' : strat === 'supplyChain' ? 'logistics_cartel' : 'eco_innovator'];
      this.lobby.players.push({
        id: `ai_${Date.now().toString(36).slice(-4)}_${idx}`,
        peerId: '',
        name: `Bot AI (${AI_STRATEGY_LABELS[strat].split(' ')[0]})`,
        companyName: `AI ${AI_STRATEGY_LABELS[strat].split(' ')[0]} Corp`,
        color:
          PLAYER_COLORS.find((c) => !usedColors.has(c)) ??
          PLAYER_COLORS[idx % PLAYER_COLORS.length],
        isHost: false,
        isAI: true,
        aiStrategy: strat,
        archetype: aiArchs[0],
        ready: true,
        connected: true,
      });
    } else {
      const botIdx = this.lobby.players.map((p) => p.isAI).lastIndexOf(true);
      if (botIdx !== -1) this.lobby.players.splice(botIdx, 1);
    }
    this.broadcastLobby();
  }

  sendGuestReady(
    ready: boolean,
    name?: string,
    companyName?: string,
    color?: string,
    opts?: { archetype?: ArchetypeId; playerCard?: PlayerCardProfile }
  ): void {
    if (this.isHostFlag || !this.hostConn?.open) return;
    this.hostConn.send({
      kind: 'player_ready',
      playerId: this.localPlayerId,
      ready,
      name,
      companyName,
      color,
      archetype: opts?.archetype,
      playerCard: opts?.playerCard,
    } satisfies NetworkMessage);
  }

  broadcastLobby(): void {
    if (!this.lobby) return;
    this.callbacks.onLobbyChange?.({ ...this.lobby });
    if (this.isHostFlag) {
      this.syncPublicDirectoryNow();
    }
    for (const conn of this.clientConns.values()) {
      if (conn.open) {
        conn.send({
          kind: 'lobby_update',
          lobby: this.lobby,
        } satisfies NetworkMessage);
      }
    }
  }

  private sendStartAndSyncToConn(
    conn: DataConnection,
    assignedPlayerId: string,
    state: GameState,
    precomputedMessages?: NetworkMessage[]
  ): void {
    if (!conn.open || !this.lobby) return;
    const startedAt = this.lastStartTimestamp || Date.now();
    conn.send({
      kind: 'GAME_START',
      lobby: this.lobby,
      mapSize: state.settings.mapSize,
      seedTick: state.time.tick,
      assignedPlayerId,
      startedAt,
    } satisfies NetworkMessage);

    const msgs = precomputedMessages ?? buildStateSyncMessages(state, 'full');
    this.sendMessagesToConn(conn, msgs);
  }

  private sendMessagesToConn(conn: DataConnection, messages: NetworkMessage[]): void {
    if (!conn.open || messages.length === 0) return;

    // Sprawdź bufor przed wysłaniem. Jeśli przepełniony, poczekaj async.
    const getBuffered = (): number =>
      (conn as unknown as { dataChannel?: { bufferedAmount?: number } }).dataChannel
        ?.bufferedAmount ?? 0;

    const sendNext = (idx: number): void => {
      if (idx >= messages.length || !conn.open) return;
      if (getBuffered() > MAX_BUFFERED_AMOUNT_BYTES) {
        // Bufor przeciążony – odczekaj 100 ms i spróbuj ponownie
        globalThis.setTimeout(() => sendNext(idx), 100);
        return;
      }
      conn.send(messages[idx]);
      // Drobna przerwa (4 ms) między kolejnymi chunkami żeby SCTP zdążył buforować
      globalThis.setTimeout(() => sendNext(idx + 1), 4);
    };

    sendNext(0);
  }

  private areAllClientsAcked(): boolean {
    for (const [peerId, conn] of this.clientConns.entries()) {
      if (!conn.open) continue;
      const pid = this.peerToPlayerId.get(peerId) ?? peerId;
      if (pid && !this.ackedPlayerIds.has(pid)) {
        return false;
      }
    }
    return true;
  }

  broadcastGameStart(state: GameState): void {
    if (!this.isHostFlag || !this.lobby) return;
    this.lobby.gameStarted = true;
    this.stopPublicDirectoryHeartbeat();
    this.lastBroadcastedState = state;
    this.lastDeltaBaseline = state;
    this.deltasSinceFull = 0;
    this.ackedPlayerIds.clear();
    this.startRetryAttempts = 0;
    this.lastStartTimestamp = Date.now();
    this.lastSyncSentAt = Date.now();

    const syncMessages = buildStateSyncMessages(state, 'start');
    for (const [peerId, conn] of this.clientConns.entries()) {
      if (!conn.open) continue;
      const pid = this.peerToPlayerId.get(peerId) ?? '';
      this.sendStartAndSyncToConn(conn, pid, state, syncMessages);
    }

    this.stopStartRetry();
    if (this.clientConns.size > 0) {
      this.startRetryTimer = globalThis.setInterval(() => {
        this.startRetryAttempts += 1;
        if (this.startRetryAttempts > MAX_START_RETRIES || this.areAllClientsAcked()) {
          this.stopStartRetry();
          return;
        }
        const latestState = this.callbacks.onRequestFullSync?.() ?? this.lastBroadcastedState ?? state;
        const retryMessages = buildStateSyncMessages(latestState, `retry${this.startRetryAttempts}`);
        for (const [peerId, conn] of this.clientConns.entries()) {
          if (!conn.open) continue;
          const pid = this.peerToPlayerId.get(peerId) ?? peerId;
          if (pid && this.ackedPlayerIds.has(pid)) continue;
          this.sendStartAndSyncToConn(conn, pid, latestState, retryMessages);
        }
      }, START_RETRY_INTERVAL_MS) as unknown as number;
    }
  }

  broadcastStateSync(state: GameState, force = false): void {
    if (!this.isHostFlag) return;
    this.lastBroadcastedState = state;
    const now = Date.now();
    if (!force && now - this.lastSyncSentAt < MIN_SYNC_INTERVAL_MS) {
      return;
    }
    this.lastSyncSentAt = now;

    const sendFull = !this.lastDeltaBaseline || this.deltasSinceFull >= 18;
    const syncMessages = sendFull
      ? buildStateSyncMessages(state, 'tick')
      : buildStateDeltaMessages(this.lastDeltaBaseline!, state, 'delta');

    this.lastDeltaBaseline = state;
    this.deltasSinceFull = sendFull ? 0 : this.deltasSinceFull + 1;

    for (const conn of this.clientConns.values()) {
      if (!conn.open) continue;
      const buffered = (conn as unknown as { dataChannel?: { bufferedAmount?: number } }).dataChannel
        ?.bufferedAmount ?? 0;
      if (!force && buffered > MAX_BUFFERED_AMOUNT_BYTES) {
        continue;
      }
      this.sendMessagesToConn(conn, syncMessages);
    }
  }

  sendActionToHost(action: PlayerAction): void {
    if (this.hostConn?.open) {
      this.hostConn.send({ kind: 'player_action', action } satisfies NetworkMessage);
    }
  }

  sendActionFeedbackToClient(
    playerId: string,
    ok: boolean,
    message: string
  ): void {
    for (const [peerId, pid] of this.peerToPlayerId.entries()) {
      if (pid === playerId) {
        const conn = this.clientConns.get(peerId);
        if (conn?.open) {
          conn.send({
            kind: 'action_feedback',
            targetPlayerId: playerId,
            ok,
            message,
          } satisfies NetworkMessage);
        }
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = globalThis.setInterval(() => {
      if (this.isHostFlag) {
        for (const conn of this.clientConns.values()) {
          if (conn.open) {
            conn.send({ kind: 'ping', ts: Date.now() } satisfies NetworkMessage);
            // Każdy wysłany ping to dowód że połączenie żyje → anuluj grace timer
            this.cancelGraceTimer(conn.peer);
          }
        }
      } else if (this.hostConn?.open) {
        this.hostConn.send({ kind: 'ping', ts: Date.now() } satisfies NetworkMessage);
        // Ping wysłany pomyślnie → anuluj grace timer Hosta
        this.cancelGraceTimer('host');
      }
    }, 4000) as unknown as number;
  }

  private syncPublicDirectoryNow(): void {
    if (!this.isHostFlag || !this.lobby) return;
    if (!this.lobby.isPublic || this.lobby.gameStarted) {
      if (this.publishedRoomCode) {
        void removePublicLobby(this.publishedRoomCode);
        this.publishedRoomCode = null;
      }
      return;
    }
    const host = this.lobby.players.find((p) => p.isHost) ?? this.lobby.players[0];
    const mult = computeRewardMultiplier({
      difficultyPreset: this.lobby.difficultyPreset,
      aiDifficulty: this.lobby.aiDifficulty,
      aiCount: this.lobby.players.filter((p) => p.isAI).length,
      mutators: this.lobby.mutators,
    });
    this.publishedRoomCode = this.lobby.roomCode;
    void publishOrHeartbeatPublicLobby({
      roomCode: this.lobby.roomCode,
      roomName:
        this.lobby.roomName ||
        (getCurrentLanguage() === 'en'
          ? `Room ${this.lobby.roomCode}`
          : `Pokój ${this.lobby.roomCode}`),
      hostName: host?.name ?? 'Host',
      hostDivision: this.lobby.hostDivision ?? host?.playerCard?.pvpDivisionId ?? 'startup',
      hostPrestige: this.lobby.hostPrestige ?? host?.playerCard?.prestigeLevel ?? 0,
      scenarioId: this.lobby.scenarioId ?? 'sandbox',
      difficultyPreset: this.lobby.difficultyPreset ?? 'standard',
      mapSize: this.lobby.mapSize,
      playerCount: this.lobby.players.length,
      maxPlayers: this.lobby.maxPlayers,
      rewardMultiplier: mult.totalMultiplier,
      updatedAt: Date.now(),
      gameStarted: false,
    });
  }

  private startPublicDirectoryHeartbeat(): void {
    this.stopPublicDirectoryHeartbeat(false);
    this.syncPublicDirectoryNow();
    this.publicLobbyTimer = globalThis.setInterval(() => {
      this.syncPublicDirectoryNow();
    }, PUBLIC_LOBBY_HEARTBEAT_MS) as unknown as number;
  }

  private stopPublicDirectoryHeartbeat(removeRemote = true): void {
    if (this.publicLobbyTimer !== null) {
      clearInterval(this.publicLobbyTimer);
      this.publicLobbyTimer = null;
    }
    if (removeRemote && this.publishedRoomCode) {
      const code = this.publishedRoomCode;
      this.publishedRoomCode = null;
      void removePublicLobby(code);
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private stopStartRetry(): void {
    if (this.startRetryTimer !== null) {
      clearInterval(this.startRetryTimer);
      this.startRetryTimer = null;
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.stopPublicDirectoryHeartbeat();
    this.stopStartRetry();
    this.clearAllGraceTimers();
    this.lastActivityAt.clear();
    this.hostConn?.close();
    this.hostConn = null;
    for (const c of this.clientConns.values()) c.close();
    this.clientConns.clear();
    this.peerToPlayerId.clear();
    this.ackedPlayerIds.clear();
    this.lastBroadcastedState = null;
    this.lastDeltaBaseline = null;
    this.deltasSinceFull = 0;
    this.lastClientState = null;
    this.lastStartTimestamp = 0;
    this.ackedStartTimestamp = 0;
    this.hasReceivedInitialSync = false;
    this.chunkAssembler.clear();
    this.peer?.destroy();
    this.peer = null;
    this.lobby = null;
    this.isHostFlag = false;
    this.setStage('idle', '');
  }
}

export const multiplayerManager = new MultiplayerManager();
