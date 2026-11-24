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
  | { kind: 'game_start'; state: GameState }
  | { kind: 'state_sync'; state: GameState }
  | { kind: 'player_action'; action: PlayerAction }
  | { kind: 'action_feedback'; targetPlayerId: string; ok: boolean; message: string }
  | { kind: 'ping'; ts: number };

const PEER_PREFIX = 'market-dominion-v1-';
const CONNECTION_TIMEOUT_MS = 10_000;
const MIN_SYNC_INTERVAL_MS = 450;

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

/**
 * Tworzy lekki, w pełni serializowalny JSON snapshot stanu gry bez zbędnej historii wykresów
 * ani struktur nienatywnych dla WebRTC DataConnection.
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

  return {
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
  onGameStart: (state: GameState, localPlayerId: string) => void;
  onStateSync: (state: GameState) => void;
  onClientAction: (action: PlayerAction) => void;
  onActionFeedback: (ok: boolean, message: string) => void;
  onPeerDisconnected: (playerId: string) => void;
  onHostDisconnected: () => void;
  onConnectionStage: (stage: ConnectionStage, label: string) => void;
  onError: (msg: string) => void;
}

class MultiplayerManager {
  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private clientConns: Map<string, DataConnection> = new Map();
  private peerToPlayerId: Map<string, string> = new Map();
  private callbacks: Partial<MultiplayerCallbacks> = {};
  private lobby: LobbyState | null = null;
  private isHostFlag = false;
  private localPlayerId = 'player_1';
  private heartbeatTimer: number | null = null;
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
    conn.on('open', () => {
      this.clientConns.set(conn.peer, conn);
    });

    conn.on('data', (raw) => {
      const msg = raw as NetworkMessage;
      if (!msg || typeof msg !== 'object') return;
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

    if (msg.kind === 'join_request') {
      if (this.lobby.gameStarted) {
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
          const msg = raw as NetworkMessage;
          if (!msg || typeof msg !== 'object') return;

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
          } else if (msg.kind === 'join_rejected') {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
            }
            this.setStage('error', msg.reason);
            this.disconnect();
            reject(new Error(msg.reason));
          } else if (msg.kind === 'lobby_update') {
            this.lobby = msg.lobby;
            this.callbacks.onLobbyChange?.(msg.lobby);
          } else if (msg.kind === 'game_start') {
            this.callbacks.onGameStart?.(msg.state, this.localPlayerId);
          } else if (msg.kind === 'state_sync') {
            this.callbacks.onStateSync?.(msg.state);
          } else if (msg.kind === 'action_feedback') {
            if (msg.targetPlayerId === this.localPlayerId) {
              this.callbacks.onActionFeedback?.(msg.ok, msg.message);
            }
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

  broadcastGameStart(state: GameState): void {
    if (!this.isHostFlag || !this.lobby) return;
    this.lobby.gameStarted = true;
    const compact = sanitizeStateForNetwork(state);
    this.lastSyncSentAt = Date.now();
    for (const conn of this.clientConns.values()) {
      if (conn.open) {
        conn.send({ kind: 'game_start', state: compact } satisfies NetworkMessage);
      }
    }
  }

  broadcastStateSync(state: GameState, force = false): void {
    if (!this.isHostFlag) return;
    const now = Date.now();
    if (!force && now - this.lastSyncSentAt < MIN_SYNC_INTERVAL_MS) {
      return;
    }
    this.lastSyncSentAt = now;
    const compact = sanitizeStateForNetwork(state);
    for (const conn of this.clientConns.values()) {
      if (conn.open) {
        conn.send({ kind: 'state_sync', state: compact } satisfies NetworkMessage);
      }
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
    this.heartbeatTimer = window.setInterval(() => {
      if (this.isHostFlag) {
        for (const conn of this.clientConns.values()) {
          if (conn.open) {
            conn.send({ kind: 'ping', ts: Date.now() } satisfies NetworkMessage);
          }
        }
      } else if (this.hostConn?.open) {
        this.hostConn.send({ kind: 'ping', ts: Date.now() } satisfies NetworkMessage);
      }
    }, 4000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.hostConn?.close();
    this.hostConn = null;
    for (const c of this.clientConns.values()) c.close();
    this.clientConns.clear();
    this.peerToPlayerId.clear();
    this.peer?.destroy();
    this.peer = null;
    this.lobby = null;
    this.isHostFlag = false;
    this.setStage('idle', '');
  }
}

export const multiplayerManager = new MultiplayerManager();
