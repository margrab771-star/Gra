import Peer from 'peerjs';
import type { DataConnection, PeerOptions } from 'peerjs';
import { AI_STRATEGY_LABELS, PLAYER_COLORS } from '../config/gameConfig';
import type {
  AIStrategy,
  GameState,
  LobbyPlayer,
  LobbyState,
  PlayerAction,
} from '../engine/types';

export type ConnectionStage =
  | 'idle'
  | 'signaling'
  | 'connecting_peer'
  | 'waiting_host'
  | 'connected'
  | 'error';

export type NetworkMessage =
  | { kind: 'join_request'; name: string; companyName: string; color: string }
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
const MIN_SYNC_INTERVAL_MS = 450;
const START_RETRY_INTERVAL_MS = 1_500;
const MAX_START_RETRIES = 5;
export const MAX_WEBRTC_CHUNK_BYTES = 48 * 1024;
const MAX_BUFFERED_AMOUNT_BYTES = 512 * 1024;

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
  ): { complete: false } | { complete: true; state: GameState | null; error?: string } {
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
      const parsed = JSON.parse(fullJson) as GameState;
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

  const trimmed: GameState = {
    ...state,
    players: compactPlayers,
    resourcePrices: compactResourcePrices,
    news: state.news.slice(-16),
    notifications: state.notifications.slice(-12),
    activeEvents: state.activeEvents.slice(0, 6),
    pendingForecasts: state.pendingForecasts.slice(0, 4),
    vehicles: state.vehicles.slice(0, 28),
    dispatches: (state.dispatches ?? []).slice(-20),
    stocks: compactStocks,
    plotOffers: state.plotOffers.slice(-30),
    transportLines: state.transportLines.slice(0, 40),
    lastSyncTimestamp: Date.now(),
  };

  return toJsonSafe(trimmed);
}

/**
 * Buduje listę komunikatów (pojedynczy STATE_SYNC albo chunki <= 48 KB) do wysłania przez DataChannel.
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

  const stateJson = JSON.stringify(safe);
  const transferId = `${transferIdPrefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  // Rezerwujemy ~200 B na kopertę komunikatu + ok. ~25% zapasu na escapowanie cudzysłowów w JSON
  const payloadEnvelopeBytes = 256;
  const rawChunks = splitJsonIntoByteChunks(
    stateJson,
    Math.floor((MAX_WEBRTC_CHUNK_BYTES - payloadEnvelopeBytes) * 0.72)
  );

  // Dodatkowo przytnij dowolny fragment, gdyby miał nadzwyczaj dużo eskapowanych znaków
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

export function translatePeerError(err: unknown): string {
  const rawType =
    typeof err === 'object' && err !== null && 'type' in err
      ? String((err as { type?: unknown }).type)
      : '';
  const rawMsg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Nieznany błąd sieci';

  switch (rawType) {
    case 'peer-unavailable':
      return 'Nie znaleziono pokoju o podanym kodzie. Sprawdź kod lub upewnij się, że Host nadal ma otwartą grę.';
    case 'unavailable-id':
      return 'Wygenerowany kod pokoju jest już zajęty. Spróbuj ponownie utworzyć pokój.';
    case 'network':
      return 'Utracono połączenie z serwerem sygnalizacyjnym WebRTC. Sprawdź internet lub spróbuj ponownie.';
    case 'browser-incompatible':
      return 'Twoja przeglądarka nie obsługuje WebRTC DataChannel wymaganego do trybu sieciowego.';
    case 'ssl-unavailable':
      return 'Serwer sygnalizacyjny wymaga bezpiecznego połączenia HTTPS/WSS.';
    case 'webrtc':
      return 'Błąd połączenia P2P (NAT/Firewall zablokował bezpośredni kanał WebRTC).';
    default:
      return `Błąd sieci WebRTC: ${rawMsg}`;
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
  const protocol =
    typeof window !== 'undefined' ? window.location.protocol : 'https:';

  if (typeof RTCPeerConnection === 'undefined') {
    return {
      ok: false,
      protocol,
      stunConfigured: false,
      latencyMs: 0,
      message: 'Przeglądarka nie obsługuje interfejsu RTCPeerConnection.',
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
        'Przekroczono limit 8 s podczas testu serwera sygnalizacyjnego PeerJS (WSS/STUN).'
      );
    }, 8_000);

    try {
      tempPeer = new Peer(getPeerOptions());
      tempPeer.on('open', (id) => {
        finish(
          true,
          `Gotowość P2P potwierdzona (${protocol === 'https:' ? 'WSS/HTTPS' : 'WS'} + STUN, ID testowe: ${id.slice(0, 8)}…).`
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
  private lastStartTimestamp = 0;
  private ackedStartTimestamp = 0;
  private hasReceivedInitialSync = false;
  private chunkAssembler = new StateChunkAssembler();
  private lastSyncSentAt = 0;

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
    color: string
  ): Promise<LobbyState> {
    this.disconnect();
    const roomCode = generateRoomCode();
    const peerId = roomCodeToPeerId(roomCode);
    this.isHostFlag = true;
    this.localPlayerId = 'player_1';
    this.setStage('signaling', 'Łączenie z serwerem sygnalizacyjnym WebRTC...');

    const initialLobby: LobbyState = {
      roomCode,
      mode: 'mp_fast',
      mapSize: 24,
      aiDifficulty: 2,
      maxPlayers: 4,
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
          'Przekroczono limit 10 s połączenia z serwerem sygnalizacyjnym WebRTC.';
        this.setStage('error', msg);
        this.disconnect();
        reject(new Error(msg));
      }, CONNECTION_TIMEOUT_MS);

      peer.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.startHeartbeat();
        this.setStage('connected', `Pokój ${roomCode} aktywny — oczekiwanie na graczy.`);
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
    }
    conn.on('open', () => {
      this.clientConns.set(conn.peer, conn);
    });

    conn.on('data', (raw) => {
      const msg = parseIncomingNetworkMessage(raw);
      if (!msg) return;
      this.handleHostIncoming(conn, msg);
    });

    conn.on('close', () => {
      const pid = this.peerToPlayerId.get(conn.peer);
      this.clientConns.delete(conn.peer);
      this.peerToPlayerId.delete(conn.peer);
      if (pid && this.lobby) {
        const lp = this.lobby.players.find((p) => p.id === pid);
        if (lp) lp.connected = false;
        if (!this.lobby.gameStarted) {
          this.lobby.players = this.lobby.players.filter((p) => p.id !== pid);
          this.broadcastLobby();
        } else {
          this.callbacks.onPeerDisconnected?.(pid);
        }
      }
    });

    conn.on('error', () => {
      const pid = this.peerToPlayerId.get(conn.peer);
      if (pid && this.lobby?.gameStarted) {
        this.callbacks.onPeerDisconnected?.(pid);
      }
    });
  }

  private handleHostIncoming(conn: DataConnection, msg: NetworkMessage): void {
    if (!this.lobby) return;
    this.clientConns.set(conn.peer, conn);

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
          reason: 'Rozgrywka w tym pokoju już się rozpoczęła.',
        } satisfies NetworkMessage);
        return;
      }
      const humanCount = this.lobby.players.filter((p) => !p.isAI).length;
      if (humanCount >= this.lobby.maxPlayers) {
        conn.send({
          kind: 'join_rejected',
          reason: 'Pokój jest już pełny (maks. 4 graczy).',
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
    color: string
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
    this.setStage('signaling', 'Łączenie z serwerem sygnalizacyjnym WebRTC...');

    return new Promise((resolve, reject) => {
      const peer = new Peer(getPeerOptions());
      this.peer = peer;
      let settled = false;

      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        const msg =
          'Nie udało się połączyć z pokojem w ciągu 10 s. Sprawdź kod, czy Host ma aktywną kartę i ponów próbę.';
        this.setStage('error', msg);
        this.disconnect();
        reject(new Error(msg));
      }, CONNECTION_TIMEOUT_MS);

      peer.on('open', () => {
        this.setStage(
          'connecting_peer',
          `Nawiązywanie bezpośredniego kanału P2P z pokojem ${normalizedCode}...`
        );
        const conn = peer.connect(hostPeerId, {
          reliable: true,
          serialization: 'json',
        });
        this.hostConn = conn;

        conn.on('open', () => {
          this.setStage('waiting_host', 'Połączono z Hostem — oczekiwanie na dołączenie...');
          conn.send({
            kind: 'join_request',
            name: playerName,
            companyName,
            color,
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
            this.lobby = msg.lobby;
            this.startHeartbeat();
            this.setStage('connected', `Połączono z pokojem ${normalizedCode}.`);
            this.callbacks.onLobbyChange?.(msg.lobby);
            resolve({ lobby: msg.lobby, playerId: msg.assignedPlayerId });
            if (msg.lobby.gameStarted) {
              this.callbacks.onGameStartSignal?.(msg.lobby, this.localPlayerId);
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
            this.handleClientIncoming(msg);
          }
        });

        conn.on('close', () => {
          this.callbacks.onHostDisconnected?.();
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
      this.lobby = msg.lobby;
      this.callbacks.onLobbyChange?.(msg.lobby);
      if (msg.lobby.gameStarted && !this.hasReceivedInitialSync) {
        this.callbacks.onGameStartSignal?.(msg.lobby, this.localPlayerId);
        this.requestFullSync();
      }
    } else if (msg.kind === 'GAME_START') {
      if (msg.assignedPlayerId) {
        this.localPlayerId = msg.assignedPlayerId;
      }
      this.lastStartTimestamp = msg.startedAt;
      this.lobby = { ...msg.lobby, gameStarted: true };
      this.callbacks.onLobbyChange?.(this.lobby);
      this.callbacks.onGameStartSignal?.(this.lobby, this.localPlayerId);
      if (this.hasReceivedInitialSync && this.ackedStartTimestamp !== msg.startedAt) {
        this.sendGameStartedAck(msg.startedAt);
      }
    } else if (msg.kind === 'STATE_SYNC') {
      this.handleClientStateReceived(msg.state);
    } else if (msg.kind === 'STATE_SYNC_CHUNK') {
      const assembled = this.chunkAssembler.pushChunk(
        msg.transferId,
        msg.index,
        msg.total,
        msg.data
      );
      if (assembled.complete) {
        if (assembled.state) {
          this.handleClientStateReceived(assembled.state);
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

  private handleClientStateReceived(state: GameState): void {
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
    partial: Partial<Pick<LobbyState, 'mode' | 'mapSize' | 'aiDifficulty'>>
  ): void {
    if (!this.isHostFlag || !this.lobby) return;
    this.lobby = { ...this.lobby, ...partial };
    this.broadcastLobby();
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
    color?: string
  ): void {
    if (this.isHostFlag || !this.hostConn?.open) return;
    this.hostConn.send({
      kind: 'player_ready',
      playerId: this.localPlayerId,
      ready,
      name,
      companyName,
      color,
    } satisfies NetworkMessage);
  }

  broadcastLobby(): void {
    if (!this.lobby) return;
    this.callbacks.onLobbyChange?.({ ...this.lobby });
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
    if (!conn.open) return;
    for (const msg of messages) {
      conn.send(msg);
    }
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
    this.lastBroadcastedState = state;
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
    const syncMessages = buildStateSyncMessages(state, 'tick');
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
          }
        }
      } else if (this.hostConn?.open) {
        this.hostConn.send({ kind: 'ping', ts: Date.now() } satisfies NetworkMessage);
      }
    }, 4000) as unknown as number;
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
    this.stopStartRetry();
    this.hostConn?.close();
    this.hostConn = null;
    for (const c of this.clientConns.values()) c.close();
    this.clientConns.clear();
    this.peerToPlayerId.clear();
    this.ackedPlayerIds.clear();
    this.lastBroadcastedState = null;
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
