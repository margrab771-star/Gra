import React, { useEffect, useState } from 'react';
import {
  AI_STRATEGY_LABELS,
  DEFAULT_DOMINATION_THRESHOLD,
  DEFAULT_MUTATORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_PRESETS,
  DOMINATION_THRESHOLD_OPTIONS,
  MAP_SIZES,
  PLAYER_COLORS,
  SCENARIO_DEFINITIONS,
} from '../../config/gameConfig';
import {
  getAiDifficultyTooltip,
  getArchetypeTooltip,
  getDifficultyPresetTooltip,
  getDisastersTooltip,
  getMapSizeTooltip,
  getScenarioTooltip,
  getTempoTooltip,
  getVictoryTooltip,
} from '../../config/lobbyTooltips';
import { ACHIEVEMENTS, TITLES_CATALOG } from '../../data/achievements';
import { ARCHETYPE_LIST, getArchetypeDefinition } from '../../data/archetypes';
import { getPvPDivisionById } from '../../data/battlePass';
import {
  ARCHETYPE_SHOP_ITEM_ID,
  SCENARIO_SHOP_ITEM_ID,
  SHOP_ITEMS,
  computeRewardMultiplier,
  isArchetypeUnlocked,
  isScenarioUnlocked,
} from '../../data/shopCatalog';
import { toPlayerCard } from '../../engine/profileManager';
import type {
  ArchetypeId,
  DifficultyPreset,
  LastMpSession,
  LobbyState,
  MutatorFlags,
  PlayerCardProfile,
  ScenarioId,
  UserAccountProfile,
} from '../../engine/types';
import {
  fetchActivePublicLobbies,
  subscribePublicLobbySignals,
  type PublicLobbyListing,
} from '../../network/lobbyDirectory';
import {
  buildInviteLink,
  multiplayerManager,
  normalizeRoomCode,
  testP2PReadiness,
} from '../../network/multiplayerManager';
import type { ConnectionStage, P2PReadinessReport } from '../../network/multiplayerManager';
import { DarkToggle } from '../HUD/DarkControls';
import { InfoTooltip } from '../HUD/InfoTooltip';
import { MCoinIcon } from '../HUD/MCoinIcon';

interface MultiplayerLobbyProps {
  activeProfile: UserAccountProfile;
  initialRoomCode: string | null;
  lastMpSession: LastMpSession | null;
  lobbyState: LobbyState | null;
  isHost: boolean;
  localPlayerId: string;
  onCreateRoom: (
    name: string,
    company: string,
    color: string,
    options?: {
      archetype?: ArchetypeId;
      playerCard?: PlayerCardProfile;
      isPublic?: boolean;
      roomName?: string;
    }
  ) => Promise<void>;
  onJoinRoom: (
    code: string,
    name: string,
    company: string,
    color: string,
    options?: { archetype?: ArchetypeId; playerCard?: PlayerCardProfile }
  ) => Promise<void>;
  onStartMatch: () => void;
  onOpenTutorial?: () => void;
  onOpenShop?: () => void;
  onLeave: () => void;
}

const FRAME_BORDER_CLASSES: Record<string, string> = {
  frame_slate: 'border-[#243044]',
  frame_gold: 'border-amber-400/75',
  frame_emerald: 'border-emerald-400/75',
  frame_crimson: 'border-rose-500/80',
  frame_neon_pulse: 'frame-anim-neon',
  frame_golden_aura: 'frame-anim-gold',
  frame_crimson_matrix: 'frame-anim-crimson',
};

const MUTATOR_LIST: { key: keyof MutatorFlags; label: string; desc: string }[] = [
  { key: 'fogOfWar', label: '🌫️ Mgła Wojny Budynków', desc: 'Budynki rywali ukryte do skanu wywiadu.' },
  { key: 'noLoans', label: '🚫 Bez Kredytów', desc: 'Zakaz pożyczek bankowych i emisji obligacji.' },
  { key: 'volatileMarket', label: '📊 Szalona Giełda', desc: 'Mocniejsze cykle i częstsze krachy rynkowe.' },
  { key: 'freeLocalRoads', label: '🛣️ Darmowe Drogi Lokalne', desc: 'Lokalne odcinki asfaltu za $0.' },
  { key: 'extremeClimate', label: '⛈️ Ekstremalny Klimat', desc: 'Częstsze katastrofy i wyższe wymogi służb.' },
  { key: 'globalBreakthroughs', label: '⚡ Globalne Przełomy Rynkowe', desc: 'Megatrend z Gazety zmienia na stałe gospodarkę (+15% XP & M).' },
];

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  activeProfile,
  initialRoomCode,
  lastMpSession,
  lobbyState,
  isHost,
  localPlayerId,
  onCreateRoom,
  onJoinRoom,
  onStartMatch,
  onOpenTutorial,
  onOpenShop,
  onLeave,
}) => {
  const [modeView, setModeView] = useState<'choose' | 'browse' | 'join'>(
    initialRoomCode ? 'join' : 'choose'
  );
  const [isPublicRoom, setIsPublicRoom] = useState(true);
  const [roomNameInput, setRoomNameInput] = useState('Liga Wall Street');
  const [publicLobbies, setPublicLobbies] = useState<PublicLobbyListing[]>([]);
  const [directorySource, setDirectorySource] = useState<'supabase' | 'local'>('local');
  const [loadingLobbies, setLoadingLobbies] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState(
    initialRoomCode ?? lastMpSession?.roomCode ?? ''
  );
  const [playerName, setPlayerName] = useState(
    lastMpSession?.playerName ?? (!activeProfile.isGuest ? activeProfile.nick : 'Prezes')
  );
  const [companyName, setCompanyName] = useState(
    lastMpSession?.companyName ?? 'Nexus Capital S.A.'
  );
  const [color, setColor] = useState(lastMpSession?.color ?? PLAYER_COLORS[1]);
  const [archetype, setArchetype] = useState<ArchetypeId>('standard');
  const [mutatorsOpen, setMutatorsOpen] = useState(false);
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
    return () => {
      // Czyścimy wyłącznie lokalny handler UI etapu połączenia — bez naruszania globalnych listenerów sieci
      multiplayerManager.setCallbacks({ onConnectionStage: undefined });
    };
  }, []);

  const refreshPublicLobbies = async () => {
    setLoadingLobbies(true);
    try {
      const res = await fetchActivePublicLobbies();
      setPublicLobbies(res.lobbies);
      setDirectorySource(res.source);
    } finally {
      setLoadingLobbies(false);
    }
  };

  useEffect(() => {
    if (lobbyState || modeView !== 'browse') return;
    let cancelled = false;
    const syncList = () => {
      void fetchActivePublicLobbies().then((res) => {
        if (!cancelled) {
          setPublicLobbies(res.lobbies);
          setDirectorySource(res.source);
        }
      });
    };
    syncList();
    const unsub = subscribePublicLobbySignals(syncList);
    const timer = window.setInterval(syncList, 10_000);
    return () => {
      cancelled = true;
      unsub();
      clearInterval(timer);
    };
  }, [lobbyState, modeView]);

  const localPlayerCard = toPlayerCard(activeProfile);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreateRoom(playerName, companyName, color, {
        playerCard: localPlayerCard,
        isPublic: isPublicRoom,
        roomName: roomNameInput,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się utworzyć pokoju.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinCode = async (targetCode: string) => {
    const clean = normalizeRoomCode(targetCode);
    if (!clean || clean.length < 5) {
      setError('Wpisz poprawny kod pokoju (np. MD-4821).');
      return;
    }
    setRoomCodeInput(clean);
    setBusy(true);
    setError(null);
    try {
      await onJoinRoom(clean, playerName, companyName, color, {
        playerCard: localPlayerCard,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się dołączyć do pokoju.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = () => handleJoinCode(roomCodeInput);

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
    const activeScenarioId = lobbyState.scenarioId ?? 'sandbox';
    const hostScenarioOk = isScenarioUnlocked(
      activeProfile.unlockedCosmetics,
      activeScenarioId,
      isHost ? undefined : lobbyState.hostUnlockedScenarios ?? [activeScenarioId]
    );
    const lobbyRewardMult = computeRewardMultiplier({
      difficultyPreset: lobbyState.difficultyPreset,
      aiDifficulty: lobbyState.aiDifficulty,
      aiCount: lobbyState.players.filter((p) => p.isAI).length,
      mutators: lobbyState.mutators,
    });

    return (
      <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-3xl rounded-2xl bg-[#111827] border border-[#243044] p-5 md:p-7 shadow-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#243044] pb-3">
            <div>
              <div className="text-xs font-mono text-sky-400 flex items-center gap-2 flex-wrap">
                <span>POKÓJ WEBRTC (PEERJS · P2P)</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/45 text-amber-200 font-bold flex items-center gap-1">
                  ✨ Mnożnik: ×{lobbyRewardMult.totalMultiplier.toFixed(2)} XP &amp; <MCoinIcon size={12} />M
                </span>
              </div>
              <h2 className="text-2xl font-extrabold font-mono text-white tracking-wider flex items-center gap-2 flex-wrap">
                <span>{lobbyState.roomCode}</span>
                {lobbyState.roomName && (
                  <span className="text-sm font-sans font-semibold text-slate-300">
                    · {lobbyState.roomName}
                  </span>
                )}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onOpenShop && (
                <button
                  type="button"
                  onClick={onOpenShop}
                  className="px-3 py-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-400/50 text-amber-200 text-xs font-semibold flex items-center gap-1.5"
                >
                  <MCoinIcon size={14} />
                  <span>Sklep ({activeProfile.mCoins} M)</span>
                </button>
              )}
              {onOpenTutorial && (
                <button
                  type="button"
                  onClick={onOpenTutorial}
                  className="px-3 py-2 rounded-lg bg-[#182235] hover:bg-[#22314a] border border-amber-500/40 text-amber-200 text-xs font-semibold"
                  title="Otwórz kompendium zasad bez wychodzenia z pokoju"
                >
                  🎓 Samouczek
                </button>
              )}
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

          {/* Ustawienia Hosta (Tryb, Mapa, AI, Katastrofy, Zwycięstwo) */}
          <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 flex items-center gap-1.5 mb-1">
                  <span>Tempo Rozgrywki</span>
                  <InfoTooltip {...getTempoTooltip(lobbyState.mode)} />
                </label>
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
                <label className="text-slate-400 flex items-center gap-1.5 mb-1">
                  <span>Rozmiar Mapy</span>
                  <InfoTooltip {...getMapSizeTooltip(lobbyState.mapSize)} />
                </label>
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
                <label className="text-slate-400 flex items-center gap-1.5 mb-1">
                  <span>Poziom Botów AI</span>
                  <InfoTooltip {...getAiDifficultyTooltip(lobbyState.aiDifficulty)} />
                </label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1e293b]">
              <div>
                <label className="text-slate-400 flex items-center gap-1.5 mb-1">
                  <span>⚖️ Trudność Gospodarki PvP</span>
                  <InfoTooltip
                    {...getDifficultyPresetTooltip(lobbyState.difficultyPreset ?? 'standard')}
                  />
                </label>
                <select
                  disabled={!isHost}
                  value={lobbyState.difficultyPreset ?? 'standard'}
                  onChange={(e) =>
                    multiplayerManager.updateLobbySettings({
                      difficultyPreset: e.target.value as DifficultyPreset,
                    })
                  }
                  className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2.5 py-1.5 text-slate-100 disabled:opacity-70"
                >
                  {(Object.keys(DIFFICULTY_PRESETS) as DifficultyPreset[]).map((k) => (
                    <option key={k} value={k}>
                      {DIFFICULTY_PRESETS[k].badge} {DIFFICULTY_PRESETS[k].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 flex items-center gap-1.5 mb-1">
                  <span>🎬 Scenariusz Lobby</span>
                  <InfoTooltip {...getScenarioTooltip(lobbyState.scenarioId ?? 'sandbox')} />
                </label>
                <select
                  disabled={!isHost}
                  value={activeScenarioId}
                  onChange={(e) => {
                    const nextSc = e.target.value as ScenarioId;
                    if (isHost && !isScenarioUnlocked(activeProfile.unlockedCosmetics, nextSc)) {
                      return;
                    }
                    multiplayerManager.updateLobbySettings({ scenarioId: nextSc });
                  }}
                  className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2.5 py-1.5 text-slate-100 disabled:opacity-70"
                >
                  {SCENARIO_DEFINITIONS.map((sc) => {
                    const unlockedForSelector = !isHost || isScenarioUnlocked(activeProfile.unlockedCosmetics, sc.id);
                    const reqId = SCENARIO_SHOP_ITEM_ID[sc.id];
                    const price = SHOP_ITEMS.find((it) => reqId && it.unlockIdsGranted.includes(reqId))?.priceMCoins;
                    return (
                      <option key={sc.id} value={sc.id} disabled={isHost && !unlockedForSelector}>
                        {sc.icon} {sc.name}{isHost && !unlockedForSelector && price ? ` 🔒 (${price} M — Sklep)` : ''}
                      </option>
                    );
                  })}
                </select>
                {!isHost && (
                  <div className="text-[10px] text-emerald-300/85 mt-1">
                    ✓ Scenariusz udostępniany bezpłatnie przez Hosta pokoju
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1e293b]">
              <div className={!isHost ? 'opacity-70 pointer-events-none' : ''}>
                <DarkToggle
                  checked={lobbyState.isPublic ?? false}
                  onChange={(val) => multiplayerManager.updateLobbySettings({ isPublic: val })}
                  label="🌐 Pokój Publiczny (widoczny w Otwartych Sesjach)"
                />
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className={!isHost ? 'opacity-70 pointer-events-none flex-1' : 'flex-1'}>
                  <DarkToggle
                    checked={lobbyState.disastersEnabled ?? true}
                    onChange={(val) =>
                      multiplayerManager.updateLobbySettings({ disastersEnabled: val })
                    }
                    label="Katastrofy naturalne"
                  />
                </div>
                <InfoTooltip {...getDisastersTooltip(lobbyState.disastersEnabled ?? true)} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span>Warunek zwycięstwa:</span>
                  <InfoTooltip
                    {...getVictoryTooltip(
                      lobbyState.victoryMode ?? 'solo',
                      lobbyState.dominationThreshold ?? DEFAULT_DOMINATION_THRESHOLD
                    )}
                  />
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <select
                    disabled={!isHost}
                    value={lobbyState.victoryMode ?? 'solo'}
                    onChange={(e) =>
                      multiplayerManager.updateLobbySettings({
                        victoryMode: e.target.value as 'solo' | 'coalition',
                      })
                    }
                    className="bg-[#151c28] border border-[#2d3b52] rounded px-2.5 py-1.5 text-slate-100 disabled:opacity-70"
                  >
                    <option value="solo">👑 Dominacja Solowa</option>
                    <option value="coalition">🤝 Dominacja Koalicji</option>
                  </select>
                  <label className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span>Próg dominacji:</span>
                    <select
                      aria-label="Próg dominacji"
                      disabled={!isHost}
                      value={lobbyState.dominationThreshold ?? DEFAULT_DOMINATION_THRESHOLD}
                      onChange={(e) =>
                        multiplayerManager.updateLobbySettings({
                          dominationThreshold: Number(e.target.value),
                        })
                      }
                      className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-amber-300 font-mono font-semibold disabled:opacity-70"
                    >
                      {DOMINATION_THRESHOLD_OPTIONS.map((pct) => (
                        <option key={pct} value={pct}>
                          {pct}%
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {/* Zwijane Mutatory Zasad PvP */}
            <div className="rounded-lg bg-[#111827] border border-[#243044] overflow-hidden">
              <button
                type="button"
                onClick={() => setMutatorsOpen((v) => !v)}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-[#161f32]"
              >
                <span className="font-semibold text-slate-200">
                  🎛️ Mutatory Zasad{' '}
                  {Object.values(lobbyState.mutators ?? DEFAULT_MUTATORS).filter(Boolean).length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                      {Object.values(lobbyState.mutators ?? DEFAULT_MUTATORS).filter(Boolean).length}{' '}
                      aktywne
                    </span>
                  )}
                </span>
                <span className="text-slate-400">{mutatorsOpen ? '▲ Zwiń' : '▼ Rozwiń'}</span>
              </button>
              {mutatorsOpen && (
                <div className="px-3 pb-3 pt-2 border-t border-[#1e293b] grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MUTATOR_LIST.map((m) => {
                    const activeMut = lobbyState.mutators ?? DEFAULT_MUTATORS;
                    return (
                      <div
                        key={m.key}
                        className={`p-2 rounded bg-[#0b0f17] border border-[#243044] ${
                          !isHost ? 'opacity-75 pointer-events-none' : ''
                        }`}
                      >
                        <DarkToggle
                          checked={Boolean(activeMut[m.key])}
                          onChange={(val) =>
                            multiplayerManager.updateLobbySettings({
                              mutators: { ...activeMut, [m.key]: val },
                            })
                          }
                          label={m.label}
                        />
                        <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Lista graczy (1-8) */}
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
              {lobbyState.players.map((p) => {
                const card = p.playerCard;
                const frameClass =
                  (card && FRAME_BORDER_CLASSES[card.frameId]) || 'border-[#243044]';
                const titleObj = card
                  ? TITLES_CATALOG.find((t) => t.id === card.titleId)
                  : undefined;
                const pArch = getArchetypeDefinition(p.archetype);
                const badges = (card?.pinnedBadgeIds ?? [])
                  .map((bid) => ACHIEVEMENTS.find((a) => a.id === bid))
                  .filter(Boolean);

                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-xl bg-[#0b0f17] border-2 ${frameClass} flex items-center justify-between gap-2 text-xs`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {card ? (
                        <div
                          className="w-8 h-8 rounded-lg bg-[#151c28] border flex items-center justify-center text-base shrink-0"
                          style={{ borderColor: p.color }}
                        >
                          {card.avatar}
                        </div>
                      ) : (
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-100 truncate flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">
                            {(card?.prestigeLevel ?? 0) > 0
                              ? '★'.repeat(Math.min(3, card?.prestigeLevel ?? 0)) + ' '
                              : ''}
                            {p.companyName} {p.id === localPlayerId && '(Ty)'}
                          </span>
                          {card && (
                            <span className="px-1 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[9px] shrink-0">
                              LVL {card.level}
                            </span>
                          )}
                          {card?.pvpDivisionId && !p.isAI && (() => {
                            const div = getPvPDivisionById(card.pvpDivisionId);
                            return (
                              <span className={`px-1 py-0.5 rounded border text-[9px] font-semibold shrink-0 ${div.badgeClass}`}>
                                {div.icon} {div.label}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {p.name}
                          {titleObj ? ` · ${titleObj.label}` : ''} ·{' '}
                          {p.isHost
                            ? 'HOST'
                            : p.isAI
                              ? AI_STRATEGY_LABELS[p.aiStrategy ?? 'industrialist']
                              : 'Gracz Online'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-[#151c28] border border-[#243044] text-[10px] text-sky-300">
                            {pArch.icon} {pArch.shortName}
                          </span>
                          {badges.map(
                            (b) =>
                              b && (
                                <span
                                  key={b.id}
                                  title={b.name}
                                  className="px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-500/35 text-[10px] text-amber-200"
                                >
                                  {b.badgeEmoji} {b.badgeLabel}
                                </span>
                              )
                          )}
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
                );
              })}
            </div>
          </div>

          {/* Pasek wyboru własnego Archetypu Korporacji (nad Gotowy / Start) */}
          {!lobbyState.gameStarted && (() => {
            const myLobbyEntry = lobbyState.players.find((pl) => pl.id === localPlayerId);
            const activeArch = myLobbyEntry?.archetype ?? archetype;
            const archLocked = !isHost && guestReady;
            const archDef = getArchetypeDefinition(activeArch);

            return (
              <div className="p-3 rounded-xl bg-[#0b0f17] border border-amber-500/40 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-slate-200 font-semibold flex items-center gap-1.5">
                    <span>🧬 Twój Archetyp Korporacji</span>
                    <InfoTooltip {...getArchetypeTooltip(activeArch)} />
                  </label>
                  <select
                    disabled={archLocked}
                    value={activeArch}
                    onChange={(e) => {
                      const nextArch = e.target.value as ArchetypeId;
                      if (!isArchetypeUnlocked(activeProfile.unlockedCosmetics, nextArch)) return;
                      setArchetype(nextArch);
                      multiplayerManager.updateLocalLobbyProfile({
                        archetype: nextArch,
                        playerCard: localPlayerCard,
                      });
                    }}
                    className="bg-[#151c28] border border-amber-500/45 rounded px-2.5 py-1.5 text-amber-200 font-semibold disabled:opacity-55"
                  >
                    {ARCHETYPE_LIST.map((a) => {
                      const unlocked = isArchetypeUnlocked(activeProfile.unlockedCosmetics, a.id);
                      const reqId = ARCHETYPE_SHOP_ITEM_ID[a.id];
                      const price = SHOP_ITEMS.find((it) => reqId && it.unlockIdsGranted.includes(reqId))?.priceMCoins;
                      return (
                        <option key={a.id} value={a.id} disabled={!unlocked}>
                          {a.icon} {a.name}{!unlocked && price ? ` 🔒 (${price} M — Sklep)` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>{archDef.tagline}</span>
                  <div className="flex items-center gap-2">
                    {onOpenShop && (
                      <button
                        type="button"
                        onClick={onOpenShop}
                        className="text-amber-300 hover:text-amber-200 underline font-semibold"
                      >
                        🏦 Odblokuj inne w Sklepie
                      </button>
                    )}
                    {archLocked && (
                      <span className="text-amber-300 font-medium">
                        🔒 Zablokowany po kliknięciu „Gotowy”
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {!isHost ? (
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-2">
              <div className="text-xs text-slate-400">
                {lobbyState.gameStarted
                  ? '🚀 Host uruchomił symulację — pobieranie mapy i przełączanie widoku...'
                  : 'Oczekiwanie na uruchomienie symulacji przez Hosta...'}
              </div>
              {lobbyState.gameStarted ? (
                <button
                  type="button"
                  onClick={() => multiplayerManager.requestFullSync()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white"
                >
                  🔄 Pobierz stan gry od Hosta
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const next = !guestReady;
                    const myEntry = lobbyState.players.find((pl) => pl.id === localPlayerId);
                    const syncedArch = myEntry?.archetype ?? archetype;
                    setGuestReady(next);
                    multiplayerManager.sendGuestReady(next, playerName, companyName, color, {
                      archetype: syncedArch,
                      playerCard: localPlayerCard,
                    });
                  }}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm ${
                    guestReady
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  {guestReady ? '✅ Gotowy do Gry (Cofnij)' : '✋ Jestem Gotowy'}
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={!allHumansReady || !hostScenarioOk}
              onClick={onStartMatch}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm md:text-base shadow-lg"
            >
              {!hostScenarioOk
                ? '🔒 Wybrany scenariusz wymaga odblokowania w Sklepie Prezesa'
                : allHumansReady
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
          <div className="flex items-center gap-2">
            {onOpenTutorial && (
              <button
                type="button"
                onClick={onOpenTutorial}
                className="px-2.5 py-1.5 rounded-lg bg-[#182235] border border-amber-500/40 text-amber-200 text-xs font-semibold"
              >
                🎓 Samouczek
              </button>
            )}
            <button
              type="button"
              onClick={onLeave}
              className="px-3 py-1.5 rounded-lg bg-[#1a2438] text-xs text-slate-300 hover:text-white"
            >
              ← Wróć
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setModeView('choose');
              setError(null);
            }}
            className={`py-2 px-1 rounded-lg font-semibold border ${
              modeView === 'choose'
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400'
            }`}
          >
            Stwórz Pokój
          </button>
          <button
            type="button"
            onClick={() => {
              setModeView('browse');
              setError(null);
            }}
            className={`py-2 px-1 rounded-lg font-semibold border ${
              modeView === 'browse'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400'
            }`}
          >
            🌐 Otwarte Sesje
          </button>
          <button
            type="button"
            onClick={() => {
              setModeView('join');
              setError(null);
            }}
            className={`py-2 px-1 rounded-lg font-semibold border ${
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

          {modeView === 'choose' && (
            <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2.5">
              <DarkToggle
                checked={isPublicRoom}
                onChange={setIsPublicRoom}
                label="🌐 Pokój Publiczny (widoczny w zakładce „Otwarte Sesje”)"
              />
              {isPublicRoom && (
                <div>
                  <label className="block text-slate-400 mb-1">Nazwa Pokoju na Liście Publicznej</label>
                  <input
                    type="text"
                    maxLength={42}
                    value={roomNameInput}
                    onChange={(e) => setRoomNameInput(e.target.value)}
                    placeholder="np. Liga Wall Street #1"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111827] border border-[#243044] text-slate-100"
                  />
                </div>
              )}
            </div>
          )}

          {modeView === 'browse' && (
            <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-amber-200">
                  🌐 Aktywne Otwarte Pokoje ({publicLobbies.length})
                </div>
                <button
                  type="button"
                  disabled={loadingLobbies}
                  onClick={() => void refreshPublicLobbies()}
                  className="px-2.5 py-1 rounded bg-[#182235] hover:bg-[#22304a] border border-[#2d3b52] text-slate-200 text-[11px]"
                >
                  {loadingLobbies ? 'Szukam...' : '🔄 Odśwież'}
                </button>
              </div>

              {publicLobbies.length === 0 ? (
                <div className="py-5 text-center text-slate-400 text-[11px] space-y-1">
                  <div>Brak aktywnych otwartych sesji w tej chwili.</div>
                  <div className="text-slate-500">
                    Stwórz własny Pokój Publiczny lub użyj kodu zaproszenia od znajomego!
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {publicLobbies.map((rm) => {
                    const div = getPvPDivisionById(rm.hostDivision);
                    const sc = SCENARIO_DEFINITIONS.find((s) => s.id === rm.scenarioId);
                    const preset = DIFFICULTY_PRESETS[rm.difficultyPreset] ?? DIFFICULTY_PRESETS.standard;
                    return (
                      <div
                        key={rm.roomCode}
                        className="p-2.5 rounded-lg bg-[#111827] border border-[#243044] flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">{rm.roomName}</span>
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-400/40 font-mono text-[10px] text-sky-300">
                              {rm.roomCode}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 font-mono text-[10px]">
                              ×{rm.rewardMultiplier.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>
                              Host: {rm.hostPrestige > 0 ? '★'.repeat(Math.min(3, rm.hostPrestige)) + ' ' : ''}
                              {rm.hostName}
                            </span>
                            <span className={`px-1 rounded border ${div.badgeClass}`}>
                              {div.icon} {div.label}
                            </span>
                            <span>· {sc?.icon} {sc?.name ?? rm.scenarioId}</span>
                            <span>· {preset.badge} {preset.label}</span>
                            <span>· {rm.mapSize}×{rm.mapSize}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded bg-[#0b0f17] border border-[#243044] font-mono text-[11px] text-emerald-300">
                            {rm.playerCount}/{rm.maxPlayers}
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleJoinCode(rm.roomCode)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-[11px]"
                          >
                            Dołącz →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-1 text-[10px] text-slate-500 border-t border-[#1e293b]">
                {directorySource === 'supabase'
                  ? '🌐 Katalog połączony z globalnym rejestrem sesji Supabase (odświeżanie co 20 s).'
                  : '📡 Tryb bezserwerowy GitHub Pages: wykrywa otwarte karty przeglądarki na tym urządzeniu (opcjonalny rejestr globalny po konfiguracji VITE_SUPABASE_URL).'}
              </div>
            </div>
          )}

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
        ) : modeView === 'join' ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleJoin}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm"
          >
            {busy ? 'Łączenie z pokojem...' : '🚪 Dołącz do Pokoju'}
          </button>
        ) : null}

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
