import React, { useEffect, useState } from 'react';
import {
  AI_STRATEGY_LABELS,
  DIFFICULTY_LABELS,
  MAP_SIZES,
  PLAYER_COLORS,
} from '../../config/gameConfig';
import type { LastMpSession, LobbyState } from '../../engine/types';
import {
  buildInviteLink,
  multiplayerManager,
  normalizeRoomCode,
  testP2PReadiness,
} from '../../network/multiplayerManager';
import type { ConnectionStage, P2PReadinessReport } from '../../network/multiplayerManager';

interface MultiplayerLobbyProps {
  initialRoomCode: string | null;
  lastMpSession: LastMpSession | null;
  lobbyState: LobbyState | null;
  isHost: boolean;
  localPlayerId: string;
  onCreateRoom: (name: string, company: string, color: string) => Promise<void>;
  onJoinRoom: (code: string, name: string, company: string, color: string) => Promise<void>;
  onStartMatch: () => void;
  onLeave: () => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  initialRoomCode,
  lastMpSession,
  lobbyState,
  isHost,
  localPlayerId,
  onCreateRoom,
  onJoinRoom,
  onStartMatch,
  onLeave,
}) => {
  const [modeView, setModeView] = useState<'choose' | 'join'>(
    initialRoomCode ? 'join' : 'choose'
  );
  const [roomCodeInput, setRoomCodeInput] = useState(
    initialRoomCode ?? lastMpSession?.roomCode ?? ''
  );
  const [playerName, setPlayerName] = useState(lastMpSession?.playerName ?? 'Prezes');
  const [companyName, setCompanyName] = useState(
    lastMpSession?.companyName ?? 'Nexus Capital S.A.'
  );
  const [color, setColor] = useState(lastMpSession?.color ?? PLAYER_COLORS[1]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<ConnectionStage>('idle');
  const [stageLabel, setStageLabel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [guestReady, setGuestReady] = useState(false);
  const [p2pTesting, setP2pTesting] = useState(false);
  const [p2pReport, setP2pReport] = useState<P2PReadinessReport | null>(null);

  useEffect(() => {
    multiplayerManager.setCallbacks({
      onConnectionStage: (nextStage, label) => {
        setStage(nextStage);
        setStageLabel(label);
      },
    });
  }, []);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreateRoom(playerName, companyName, color);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się utworzyć pokoju.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const clean = normalizeRoomCode(roomCodeInput);
    if (!clean || clean.length < 5) {
      setError('Wpisz poprawny kod pokoju (np. MD-4821).');
      return;
    }
    setRoomCodeInput(clean);
    setBusy(true);
    setError(null);
    try {
      await onJoinRoom(clean, playerName, companyName, color);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się dołączyć do pokoju.');
    } finally {
      setBusy(false);
    }
  };

  const handleTestNetwork = async () => {
    setP2pTesting(true);
    const report = await testP2PReadiness();
    setP2pReport(report);
    setP2pTesting(false);
  };

  const handleCopyInvite = () => {
    if (!lobbyState) return;
    const link = buildInviteLink(lobbyState.roomCode);
    navigator.clipboard?.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  // Widok aktywnego Lobby (po utworzeniu lub dołączeniu do pokoju)
  if (lobbyState) {
    const allHumansReady = lobbyState.players.filter((p) => !p.isAI).every((p) => p.ready);

    return (
      <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-3xl rounded-2xl bg-[#111827] border border-[#243044] p-5 md:p-7 shadow-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#243044] pb-3">
            <div>
              <div className="text-xs font-mono text-sky-400">POKÓJ WEBRTC (PEERJS · P2P)</div>
              <h2 className="text-2xl font-extrabold font-mono text-white tracking-wider">
                {lobbyState.roomCode}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyInvite}
                className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                {copied ? '✅ Skopiowano link!' : '🔗 Kopiuj link zaproszenia'}
              </button>
              <button
                type="button"
                onClick={onLeave}
                className="px-3 py-2 rounded-lg bg-[#1c2434] hover:bg-rose-950/60 text-xs text-slate-300"
              >
                Wyjdź
              </button>
            </div>
          </div>

          {isHost && (
            <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/35 text-xs text-amber-200">
              ⚠️ <strong>Jesteś Hostem pokoju:</strong> nie zamykaj ani nie usypiaj tej karty przeglądarki w trakcie gry — silnik symulacji działa u Ciebie na żywo.
            </div>
          )}

          {/* Ustawienia Hosta */}
          <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-[#243044] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Tempo Rozgrywki</label>
              <select
                disabled={!isHost}
                value={lobbyState.mode}
                onChange={(e) =>
                  multiplayerManager.updateLobbySettings({
                    mode: e.target.value as 'mp_fast' | 'mp_long',
                  })
                }
                className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2.5 py-2 text-slate-100 disabled:opacity-70"
              >
                <option value="mp_fast">⚡ Tryb Przyspieszony (~1h)</option>
                <option value="mp_long">🏛️ Kampania Długa (Głęboka)</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Rozmiar Mapy</label>
              <select
                disabled={!isHost}
                value={lobbyState.mapSize}
                onChange={(e) =>
                  multiplayerManager.updateLobbySettings({ mapSize: Number(e.target.value) })
                }
                className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2.5 py-2 text-slate-100 disabled:opacity-70"
              >
                {MAP_SIZES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Poziom Botów AI</label>
              <select
                disabled={!isHost}
                value={lobbyState.aiDifficulty}
                onChange={(e) =>
                  multiplayerManager.updateLobbySettings({ aiDifficulty: Number(e.target.value) })
                }
                className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2.5 py-2 text-slate-100 disabled:opacity-70"
              >
                {DIFFICULTY_LABELS.map((d, idx) => (
                  <option key={d} value={idx + 1}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lista graczy (1-4) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 uppercase">
                Uczestnicy ({lobbyState.players.length} / {lobbyState.maxPlayers})
              </span>
              {isHost && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={lobbyState.players.length >= lobbyState.maxPlayers}
                    onClick={() => multiplayerManager.toggleAISlot(true)}
                    className="px-2.5 py-1 rounded bg-[#182235] border border-sky-500/40 text-sky-300 disabled:opacity-40"
                  >
                    + Dodaj Bota AI
                  </button>
                  <button
                    type="button"
                    disabled={!lobbyState.players.some((p) => p.isAI)}
                    onClick={() => multiplayerManager.toggleAISlot(false)}
                    className="px-2.5 py-1 rounded bg-[#1c2434] text-rose-300 disabled:opacity-40"
                  >
                    − Usuń AI
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {lobbyState.players.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 truncate">
                        {p.companyName} {p.id === localPlayerId && '(Ty)'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {p.name} ·{' '}
                        {p.isHost
                          ? 'HOST'
                          : p.isAI
                            ? AI_STRATEGY_LABELS[p.aiStrategy ?? 'industrialist']
                            : 'Gracz Online'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[10px] shrink-0 ${
                      p.ready
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {p.ready ? 'GOTOWY' : 'CZEKA'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {!isHost ? (
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-2">
              <div className="text-xs text-slate-400">
                Oczekiwanie na uruchomienie symulacji przez Hosta...
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !guestReady;
                  setGuestReady(next);
                  multiplayerManager.sendGuestReady(next, playerName, companyName, color);
                }}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm ${
                  guestReady
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {guestReady ? '✅ Gotowy do Gry (Cofnij)' : '✋ Jestem Gotowy'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!allHumansReady}
              onClick={onStartMatch}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm md:text-base shadow-lg"
            >
              {allHumansReady
                ? '🚀 Rozpocznij Grę Multiplayer (Cel: Monopol)'
                : 'Czekaj aż wszyscy gracze klikną "Jestem Gotowy"'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Widok tworzenia lub dołączania do pokoju
  return (
    <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-[#111827] border border-[#243044] p-5 md:p-7 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#243044] pb-3">
          <div>
            <h2 className="text-lg font-bold text-white">Multiplayer Online (PeerJS WebRTC)</h2>
            <p className="text-xs text-slate-400">
              Bezpośrednie połączenie P2P gotowe pod GitHub Pages (HTTPS/WSS + STUN)
            </p>
          </div>
          <button
            type="button"
            onClick={onLeave}
            className="px-3 py-1.5 rounded-lg bg-[#1a2438] text-xs text-slate-300 hover:text-white"
          >
            ← Wróć
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setModeView('choose');
              setError(null);
            }}
            className={`py-2 rounded-lg font-semibold border ${
              modeView === 'choose'
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400'
            }`}
          >
            Stwórz Pokój (Host)
          </button>
          <button
            type="button"
            onClick={() => {
              setModeView('join');
              setError(null);
            }}
            className={`py-2 rounded-lg font-semibold border ${
              modeView === 'join'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400'
            }`}
          >
            Dołącz Kodem
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-400 mb-1">Twój Pseudonim</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Nazwa Firmy</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5">Kolor Konglomeratu</label>
            <div className="flex flex-wrap gap-2">
              {PLAYER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg border-2 ${
                    color === c ? 'border-white scale-110' : 'border-transparent opacity-65'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {modeView === 'join' && (
            <div>
              <label className="block text-slate-400 mb-1">Kod Pokoju od Hosta</label>
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="np. MD-4821"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0b0f17] border border-sky-500/40 font-mono text-base text-amber-300 tracking-wider uppercase"
              />
            </div>
          )}
        </div>

        {/* Status połączenia krok po kroku */}
        {busy && stage !== 'idle' && (
          <div className="p-2.5 rounded-lg bg-sky-950/35 border border-sky-500/40 text-xs text-sky-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping shrink-0" />
            <span>{stageLabel || 'Łączenie z siecią WebRTC...'}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 space-y-2">
            <div>⚠️ {error}</div>
            <button
              type="button"
              disabled={busy}
              onClick={modeView === 'choose' ? handleCreate : handleJoin}
              className="px-3 py-1 rounded bg-rose-600/35 hover:bg-rose-600/55 border border-rose-400/50 text-rose-100 font-semibold"
            >
              🔄 Ponów połączenie
            </button>
          </div>
        )}

        {modeView === 'choose' ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleCreate}
            className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-sm"
          >
            {busy ? 'Łączenie z WebRTC...' : '🌐 Stwórz Pokój i Wygeneruj Link'}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={handleJoin}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm"
          >
            {busy ? 'Łączenie z pokojem...' : '🚪 Dołącz do Pokoju'}
          </button>
        )}

        {/* Diagnostyka gotowości sieci P2P (WSS/STUN) */}
        <div className="pt-3 border-t border-[#243044] space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Diagnostyka połączenia WebRTC / STUN</span>
            <button
              type="button"
              disabled={p2pTesting}
              onClick={handleTestNetwork}
              className="px-2.5 py-1 rounded bg-[#182235] hover:bg-[#22304a] border border-[#2d3b52] text-slate-200 font-medium disabled:opacity-40"
            >
              {p2pTesting ? 'Testowanie...' : '📡 Testuj sieć P2P'}
            </button>
          </div>
          {p2pReport && (
            <div
              className={`p-2.5 rounded-lg border text-[11px] ${
                p2pReport.ok
                  ? 'bg-emerald-950/30 border-emerald-500/35 text-emerald-200'
                  : 'bg-rose-950/30 border-rose-500/35 text-rose-200'
              }`}
            >
              <div>{p2pReport.ok ? '✅' : '❌'} {p2pReport.message}</div>
              <div className="text-slate-400 font-mono mt-0.5">
                Protokół: {p2pReport.protocol.toUpperCase()} · STUN: {p2pReport.stunConfigured ? 'Google + Cloudflare' : 'Brak'} · Ping: {p2pReport.latencyMs} ms
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
