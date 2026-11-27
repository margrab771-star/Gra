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
import {
  localizeAchievement,
  localizeAiStrategy,
  localizeArchetype,
  localizeDifficultyLabel,
  localizeDifficultyPreset,
  localizeMapSizeLabel,
  localizePvPDivisionLabel,
  localizeScenario,
  localizeTitle,
} from '../../i18n/dataTranslations';
import { useI18n } from '../../i18n/useI18n';
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
  isSupabaseDirectoryConfigured,
  subscribePublicLobbySignals,
  type PublicLobbyListing,
} from '../../network/lobbyDirectory';
import {
  buildInviteLink,
  getTurnDiagnostics,
  multiplayerManager,
  normalizeRoomCode,
  testP2PReadiness,
} from '../../network/multiplayerManager';
import type { ConnectionStage, P2PReadinessReport } from '../../network/multiplayerManager';
import type { MpModeView } from '../../utils/hashRouter';
import { DarkToggle } from '../HUD/DarkControls';
import { InfoTooltip } from '../HUD/InfoTooltip';
import { LanguageSwitcher } from '../HUD/LanguageSwitcher';
import { MCoinIcon } from '../HUD/MCoinIcon';

interface MultiplayerLobbyProps {
  activeProfile: UserAccountProfile;
  initialRoomCode: string | null;
  activeTab?: MpModeView;
  onChangeTab?: (tab: MpModeView) => void;
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

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  activeProfile,
  initialRoomCode,
  activeTab,
  onChangeTab,
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
  const { lang, t } = useI18n();
  const [internalModeView, setInternalModeView] = useState<MpModeView>(
    activeTab ?? (initialRoomCode ? 'join' : 'choose')
  );
  const modeView: MpModeView = activeTab ?? internalModeView;
  const selectModeTab = (tab: MpModeView) => {
    setInternalModeView(tab);
    setError(null);
    onChangeTab?.(tab);
  };
  const turnDiag = getTurnDiagnostics();
  const supabaseReady = isSupabaseDirectoryConfigured();
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

  const MUTATOR_LIST: { key: keyof MutatorFlags; label: string; desc: string }[] =
    lang === 'en'
      ? [
          { key: 'fogOfWar', label: '🌫️ Fog of War', desc: 'Rival buildings hidden until scanned.' },
          { key: 'noLoans', label: '🚫 No Bank Loans', desc: 'Zero loans or corporate bonds.' },
          { key: 'volatileMarket', label: '📊 Volatile Market', desc: 'Stronger cycles and crashes.' },
          { key: 'freeLocalRoads', label: '🛣️ Free Local Roads', desc: 'Local asphalt segments cost $0.' },
          { key: 'extremeClimate', label: '⛈️ Extreme Climate', desc: 'More disasters & emergency demand.' },
          { key: 'globalBreakthroughs', label: '⚡ Global Breakthroughs', desc: 'Permanent megatrend (+15% XP & M).' },
        ]
      : [
          { key: 'fogOfWar', label: '🌫️ Mgła Wojny Budynków', desc: 'Budynki rywali ukryte do skanu wywiadu.' },
          { key: 'noLoans', label: '🚫 Bez Kredytów', desc: 'Zakaz pożyczek bankowych i obligacji.' },
          { key: 'volatileMarket', label: '📊 Szalona Giełda', desc: 'Mocniejsze cykle i częstsze krachy.' },
          { key: 'freeLocalRoads', label: '🛣️ Darmowe Drogi Lokalne', desc: 'Lokalne odcinki asfaltu za 0 zł.' },
          { key: 'extremeClimate', label: '⛈️ Ekstremalny Klimat', desc: 'Częstsze katastrofy i wyższe wymogi służb.' },
          { key: 'globalBreakthroughs', label: '⚡ Globalne Przełomy Rynkowe', desc: 'Megatrend z Gazety (+15% XP & M).' },
        ];

  useEffect(() => {
    multiplayerManager.setCallbacks({
      onConnectionStage: (nextStage, label) => {
        setStage(nextStage);
        setStageLabel(label);
      },
    });
    return () => {
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
      setError(
        e instanceof Error
          ? e.message
          : lang === 'en'
            ? 'Failed to create room.'
            : 'Nie udało się utworzyć pokoju.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleJoinCode = async (targetCode: string) => {
    const clean = normalizeRoomCode(targetCode);
    if (!clean || clean.length < 5) {
      setError(lang === 'en' ? 'Enter a valid room code (e.g. MD-4821).' : 'Wpisz poprawny kod pokoju (np. MD-4821).');
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
      setError(
        e instanceof Error
          ? e.message
          : lang === 'en'
            ? 'Failed to join room.'
            : 'Nie udało się dołączyć do pokoju.'
      );
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

  const diagnosticsFooterBar = (
    <div className="px-5 py-2.5 border-t border-[#243044] bg-[#0b0f17] flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-400 font-medium">{t('lobby.turnStatusLabel')}</span>
        <span
          className={`px-2 py-0.5 rounded-lg border font-mono text-[11px] font-semibold ${
            turnDiag.configured
              ? 'bg-emerald-950/50 border-emerald-500/45 text-emerald-300'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
          }`}
          title={turnDiag.urls.join(', ')}
        >
          {turnDiag.configured
            ? `🟢 ${t('lobby.turnActive', { hosts: turnDiag.hostsLabel || 'TURN' })}`
            : `🟡 ${t('lobby.turnFallback')}`}
        </span>
        <span className="text-slate-600 hidden sm:inline">|</span>
        <span className="text-slate-400 font-medium">{t('lobby.supabaseStatusLabel')}</span>
        <span
          className={`px-2 py-0.5 rounded-lg border font-mono text-[11px] font-semibold ${
            supabaseReady
              ? 'bg-sky-950/50 border-sky-500/45 text-sky-300'
              : 'bg-[#151c28] border-[#243044] text-slate-300'
          }`}
        >
          {supabaseReady ? `🌐 ${t('lobby.supabaseConnected')}` : `📡 ${t('lobby.supabaseLocal')}`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {p2pReport && (
          <span
            className={`px-2.5 py-1 rounded-lg border text-[11px] ${
              p2pReport.ok
                ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/35 border-rose-500/40 text-rose-200'
            }`}
          >
            {p2pReport.message} ({p2pReport.latencyMs} ms)
          </span>
        )}
        <button
          type="button"
          disabled={p2pTesting}
          onClick={handleTestNetwork}
          className="px-3 py-1 rounded-lg bg-[#182235] hover:bg-[#22304a] border border-[#2d3b52] text-slate-200 font-semibold disabled:opacity-40 cursor-pointer"
        >
          {p2pTesting ? t('lobby.p2pTesting') : t('lobby.p2pTest')}
        </button>
      </div>
    </div>
  );

  // Aktywny Pokój Lobby: 2 kolumny dopasowane do monitora (max-h-[95vh])
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
      <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex items-center justify-center p-2.5 md:p-5 overflow-y-auto">
        <div className="w-[92vw] max-w-[1280px] lg:max-h-[95vh] rounded-2xl bg-[#111827] border border-[#243044] shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-[#243044] bg-[#0b0f17] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div>
              <div className="text-[11px] font-mono text-sky-400 flex items-center gap-2 flex-wrap">
                <span>{t('lobby.roomHeader')}</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/45 text-amber-200 font-bold flex items-center gap-1">
                  ✨ ×{lobbyRewardMult.totalMultiplier.toFixed(2)} XP &amp; <MCoinIcon size={12} />M
                </span>
              </div>
              <h2 className="text-lg md:text-xl font-extrabold font-mono text-white tracking-wider flex items-center gap-2 flex-wrap">
                <span>{lobbyState.roomCode}</span>
                {lobbyState.roomName && (
                  <span className="text-xs md:text-sm font-sans font-semibold text-slate-300">
                    · {lobbyState.roomName}
                  </span>
                )}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <LanguageSwitcher compact />
              {onOpenShop && (
                <button
                  type="button"
                  onClick={onOpenShop}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-400/50 text-amber-200 text-xs font-semibold flex items-center gap-1"
                >
                  <MCoinIcon size={13} />
                  <span>{activeProfile.mCoins} M</span>
                </button>
              )}
              {onOpenTutorial && (
                <button
                  type="button"
                  onClick={onOpenTutorial}
                  className="px-2.5 py-1.5 rounded-lg bg-[#182235] hover:bg-[#22314a] border border-amber-500/40 text-amber-200 text-xs font-semibold"
                >
                  🎓
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyInvite}
                className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                {copied ? t('lobby.copiedInvite') : t('lobby.copyInvite')}
              </button>
              <button
                type="button"
                onClick={onLeave}
                className="px-2.5 py-1.5 rounded-lg bg-[#1c2434] hover:bg-rose-950/60 text-xs text-slate-300"
              >
                {t('lobby.leave')}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
            {/* LEWA KOLUMNA: Ustawienia Hosta */}
            <div className="lg:col-span-6 space-y-3">
              {isHost && (
                <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/35 text-[11px] text-amber-200">
                  ⚠️ {t('lobby.hostWarning')}
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-400 flex items-center gap-1 mb-1 text-[11px]">
                      <span>{t('lobby.tempo')}</span>
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
                      className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100 disabled:opacity-70"
                    >
                      <option value="mp_fast">{t('lobby.mpFast')}</option>
                      <option value="mp_long">{t('lobby.mpLong')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 flex items-center gap-1 mb-1 text-[11px]">
                      <span>{t('setup.mapSize')}</span>
                      <InfoTooltip {...getMapSizeTooltip(lobbyState.mapSize)} />
                    </label>
                    <select
                      disabled={!isHost}
                      value={lobbyState.mapSize}
                      onChange={(e) =>
                        multiplayerManager.updateLobbySettings({ mapSize: Number(e.target.value) })
                      }
                      className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100 disabled:opacity-70"
                    >
                      {MAP_SIZES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {localizeMapSizeLabel(m.value, m.label, lang)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 flex items-center gap-1 mb-1 text-[11px]">
                      <span>{t('setup.aiLevel')}</span>
                      <InfoTooltip {...getAiDifficultyTooltip(lobbyState.aiDifficulty)} />
                    </label>
                    <select
                      disabled={!isHost}
                      value={lobbyState.aiDifficulty}
                      onChange={(e) =>
                        multiplayerManager.updateLobbySettings({
                          aiDifficulty: Number(e.target.value),
                        })
                      }
                      className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100 disabled:opacity-70"
                    >
                      {DIFFICULTY_LABELS.map((d, idx) => (
                        <option key={d} value={idx + 1}>
                          {localizeDifficultyLabel(idx, d, lang)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#1e293b]">
                  <div>
                    <label className="text-slate-400 flex items-center gap-1 mb-1 text-[11px]">
                      <span>{t('lobby.difficultyPvP')}</span>
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
                      className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100 disabled:opacity-70"
                    >
                      {(Object.keys(DIFFICULTY_PRESETS) as DifficultyPreset[]).map((k) => {
                        const locP = localizeDifficultyPreset(DIFFICULTY_PRESETS[k], lang);
                        return (
                          <option key={k} value={k}>
                            {locP.badge} {locP.label}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 flex items-center gap-1 mb-1 text-[11px]">
                      <span>{t('lobby.scenario')}</span>
                      <InfoTooltip {...getScenarioTooltip(activeScenarioId)} />
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
                      className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100 disabled:opacity-70"
                    >
                      {SCENARIO_DEFINITIONS.map((sc) => {
                        const locSc = localizeScenario(sc, lang);
                        const unlockedForSelector =
                          !isHost || isScenarioUnlocked(activeProfile.unlockedCosmetics, sc.id);
                        const reqId = SCENARIO_SHOP_ITEM_ID[sc.id];
                        const price = SHOP_ITEMS.find(
                          (it) => reqId && it.unlockIdsGranted.includes(reqId)
                        )?.priceMCoins;
                        return (
                          <option key={sc.id} value={sc.id} disabled={isHost && !unlockedForSelector}>
                            {locSc.icon} {locSc.name}
                            {isHost && !unlockedForSelector && price ? ` 🔒 (${price} M)` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {!isHost && (
                      <div className="text-[10px] text-emerald-300/85 mt-0.5">
                        {t('lobby.hostSharesScenario')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#1e293b]">
                  <div className={!isHost ? 'opacity-70 pointer-events-none' : ''}>
                    <DarkToggle
                      checked={lobbyState.isPublic ?? false}
                      onChange={(val) => multiplayerManager.updateLobbySettings({ isPublic: val })}
                      label={t('lobby.publicToggle')}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className={!isHost ? 'opacity-70 pointer-events-none flex-1' : 'flex-1'}>
                      <DarkToggle
                        checked={lobbyState.disastersEnabled ?? true}
                        onChange={(val) =>
                          multiplayerManager.updateLobbySettings({ disastersEnabled: val })
                        }
                        label={t('lobby.disasters')}
                      />
                    </div>
                    <InfoTooltip {...getDisastersTooltip(lobbyState.disastersEnabled ?? true)} />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#1e293b] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-400 flex items-center gap-1">
                    <span>{t('setup.victoryCond')}</span>
                    <InfoTooltip
                      {...getVictoryTooltip(
                        lobbyState.victoryMode ?? 'solo',
                        lobbyState.dominationThreshold ?? DEFAULT_DOMINATION_THRESHOLD
                      )}
                    />
                  </span>
                  <div className="flex items-center gap-1.5">
                    <select
                      disabled={!isHost}
                      value={lobbyState.victoryMode ?? 'solo'}
                      onChange={(e) =>
                        multiplayerManager.updateLobbySettings({
                          victoryMode: e.target.value as 'solo' | 'coalition',
                        })
                      }
                      className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1 text-slate-100 disabled:opacity-70"
                    >
                      <option value="solo">{t('setup.victorySolo')}</option>
                      <option value="coalition">{t('setup.victoryCoalition')}</option>
                    </select>
                    <select
                      aria-label={t('lobby.domThreshold')}
                      disabled={!isHost}
                      value={lobbyState.dominationThreshold ?? DEFAULT_DOMINATION_THRESHOLD}
                      onChange={(e) =>
                        multiplayerManager.updateLobbySettings({
                          dominationThreshold: Number(e.target.value),
                        })
                      }
                      className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1 text-amber-300 font-mono font-semibold disabled:opacity-70"
                    >
                      {DOMINATION_THRESHOLD_OPTIONS.map((pct) => (
                        <option key={pct} value={pct}>
                          {pct}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mutatory */}
                <div className="rounded-lg bg-[#111827] border border-[#243044] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMutatorsOpen((v) => !v)}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-[#161f32]"
                  >
                    <span className="font-semibold text-slate-200">
                      {t('setup.mutatorsTitle')}{' '}
                      {Object.values(lobbyState.mutators ?? DEFAULT_MUTATORS).filter(Boolean).length >
                        0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                          {t('setup.mutatorsActive', {
                            n: Object.values(lobbyState.mutators ?? DEFAULT_MUTATORS).filter(Boolean)
                              .length,
                          })}
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400">{mutatorsOpen ? '▲' : '▼'}</span>
                  </button>
                  {mutatorsOpen && (
                    <div className="px-2.5 pb-2.5 pt-2 border-t border-[#1e293b] grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {MUTATOR_LIST.map((m) => {
                        const activeMut = lobbyState.mutators ?? DEFAULT_MUTATORS;
                        return (
                          <div
                            key={m.key}
                            className={`p-1.5 rounded bg-[#0b0f17] border border-[#243044] ${
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
                            <div className="text-[10px] text-slate-400">{m.desc}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PRAWA KOLUMNA: Uczestnicy, Własny Archetyp, Gotowy/Start */}
            <div className="lg:col-span-6 flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 uppercase text-[11px]">
                    {t('lobby.participants', {
                      count: lobbyState.players.length,
                      max: lobbyState.maxPlayers,
                    })}
                  </span>
                  {isHost && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={lobbyState.players.length >= lobbyState.maxPlayers}
                        onClick={() => multiplayerManager.toggleAISlot(true)}
                        className="px-2 py-1 rounded bg-[#182235] border border-sky-500/40 text-sky-300 disabled:opacity-40"
                      >
                        {t('lobby.addAi')}
                      </button>
                      <button
                        type="button"
                        disabled={!lobbyState.players.some((p) => p.isAI)}
                        onClick={() => multiplayerManager.toggleAISlot(false)}
                        className="px-2 py-1 rounded bg-[#1c2434] text-rose-300 disabled:opacity-40"
                      >
                        {t('lobby.removeAi')}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {lobbyState.players.map((p) => {
                    const card = p.playerCard;
                    const frameClass =
                      (card && FRAME_BORDER_CLASSES[card.frameId]) || 'border-[#243044]';
                    const rawTitleObj = card
                      ? TITLES_CATALOG.find((tl) => tl.id === card.titleId)
                      : undefined;
                    const titleObj = rawTitleObj ? localizeTitle(rawTitleObj, lang) : undefined;
                    const pArch = localizeArchetype(getArchetypeDefinition(p.archetype), lang);
                    const badges = (card?.pinnedBadgeIds ?? [])
                      .map((bid) => ACHIEVEMENTS.find((a) => a.id === bid))
                      .filter(Boolean)
                      .map((b) => (b ? localizeAchievement(b, lang) : b));

                    return (
                      <div
                        key={p.id}
                        className={`p-2.5 rounded-xl bg-[#0b0f17] border-2 ${frameClass} flex items-center justify-between gap-2`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {card ? (
                            <div
                              className="w-7 h-7 rounded-lg bg-[#151c28] border flex items-center justify-center text-sm shrink-0"
                              style={{ borderColor: p.color }}
                            >
                              {card.avatar}
                            </div>
                          ) : (
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: p.color }}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-100 truncate flex items-center gap-1 flex-wrap text-[11px]">
                              <span className="truncate">
                                {(card?.prestigeLevel ?? 0) > 0
                                  ? '★'.repeat(Math.min(3, card?.prestigeLevel ?? 0)) + ' '
                                  : ''}
                                {p.companyName} {p.id === localPlayerId && `(${t('common.you')})`}
                              </span>
                              {card && (
                                <span className="px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 font-mono text-[9px]">
                                  L{card.level}
                                </span>
                              )}
                              {card?.pvpDivisionId && !p.isAI && (() => {
                                const div = getPvPDivisionById(card.pvpDivisionId);
                                return (
                                  <span
                                    className={`px-1 rounded border text-[9px] font-semibold ${div.badgeClass}`}
                                  >
                                    {div.icon}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {p.name}
                              {titleObj ? ` · ${titleObj.label}` : ''} ·{' '}
                              {p.isHost
                                ? 'HOST'
                                : p.isAI
                                  ? localizeAiStrategy(
                                      p.aiStrategy ?? 'industrialist',
                                      AI_STRATEGY_LABELS[p.aiStrategy ?? 'industrialist'],
                                      lang
                                    )
                                  : 'Online'}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <span className="px-1.5 py-0.2 rounded bg-[#151c28] border border-[#243044] text-[9px] text-sky-300">
                                {pArch.icon} {pArch.shortName}
                              </span>
                              {badges.slice(0, 2).map(
                                (b) =>
                                  b && (
                                    <span key={b.id} title={b.name} className="text-[10px]">
                                      {b.badgeEmoji}
                                    </span>
                                  )
                              )}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono text-[9px] shrink-0 ${
                            p.ready
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {p.ready ? t('lobby.ready') : t('lobby.waiting')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!lobbyState.gameStarted && (() => {
                const myLobbyEntry = lobbyState.players.find((pl) => pl.id === localPlayerId);
                const activeArch = myLobbyEntry?.archetype ?? archetype;
                const archLocked = !isHost && guestReady;
                const archDef = localizeArchetype(getArchetypeDefinition(activeArch), lang);
                return (
                  <div className="p-2.5 rounded-xl bg-[#0b0f17] border border-amber-500/40 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-slate-200 font-semibold flex items-center gap-1.5">
                        <span>{t('lobby.yourArchetype')}</span>
                        <InfoTooltip {...getArchetypeTooltip(activeArch)} />
                      </label>
                      <select
                        disabled={archLocked}
                        value={activeArch}
                        onChange={(e) => {
                          const nextArch = e.target.value as ArchetypeId;
                          if (!isArchetypeUnlocked(activeProfile.unlockedCosmetics, nextArch)) {
                            return;
                          }
                          setArchetype(nextArch);
                          multiplayerManager.updateLocalLobbyProfile({
                            archetype: nextArch,
                            playerCard: localPlayerCard,
                          });
                        }}
                        className="bg-[#151c28] border border-amber-500/45 rounded px-2 py-1 text-amber-200 font-semibold disabled:opacity-55"
                      >
                        {ARCHETYPE_LIST.map((a) => {
                          const locA = localizeArchetype(a, lang);
                          const unlocked = isArchetypeUnlocked(
                            activeProfile.unlockedCosmetics,
                            a.id
                          );
                          const reqId = ARCHETYPE_SHOP_ITEM_ID[a.id];
                          const price = SHOP_ITEMS.find(
                            (it) => reqId && it.unlockIdsGranted.includes(reqId)
                          )?.priceMCoins;
                          return (
                            <option key={a.id} value={a.id} disabled={!unlocked}>
                              {locA.icon} {locA.name}
                              {!unlocked && price ? ` 🔒 (${price} M)` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                      <span>{archDef.tagline}</span>
                      <div className="flex items-center gap-2">
                        {onOpenShop && (
                          <button
                            type="button"
                            onClick={onOpenShop}
                            className="text-amber-300 hover:text-amber-200 underline font-semibold"
                          >
                            {t('lobby.unlockInShop')}
                          </button>
                        )}
                        {archLocked && (
                          <span className="text-amber-300 font-medium">
                            {t('lobby.lockedAfterReady')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {!isHost ? (
                <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between pt-1">
                  <div className="text-[11px] text-slate-400">
                    {lobbyState.gameStarted
                      ? t('lobby.guestStarted')
                      : t('lobby.guestWaiting')}
                  </div>
                  {lobbyState.gameStarted ? (
                    <button
                      type="button"
                      onClick={() => multiplayerManager.requestFullSync()}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white"
                    >
                      {t('lobby.fetchState')}
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
                      className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-sm ${
                        guestReady
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {guestReady ? t('lobby.readyUndoBtn') : t('lobby.readyBtn')}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!allHumansReady || !hostScenarioOk}
                  onClick={onStartMatch}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm shadow-lg"
                >
                  {!hostScenarioOk
                    ? t('lobby.scenarioNeedsShop')
                    : allHumansReady
                      ? t('lobby.startMatch')
                      : t('lobby.waitReady')}
                </button>
              )}
            </div>
          </div>
          {diagnosticsFooterBar}
        </div>
      </div>
    );
  }

  // Widok przed pokojem (2 kolumny dopasowane do monitora)
  return (
    <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex items-center justify-center p-2.5 md:p-5 overflow-y-auto">
      <div className="w-[92vw] max-w-[1220px] lg:max-h-[94vh] rounded-2xl bg-[#111827] border border-[#243044] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 md:px-6 py-3.5 border-b border-[#243044] bg-[#0b0f17] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div>
            <h2 className="text-lg md:text-2xl font-extrabold text-white tracking-tight">
              {t('lobby.title')}
            </h2>
            <p className="text-xs md:text-sm text-slate-400">{t('lobby.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher compact />
            {onOpenTutorial && (
              <button
                type="button"
                onClick={onOpenTutorial}
                className="px-3 py-1.5 rounded-xl bg-[#182235] border border-amber-500/40 text-amber-200 text-xs md:text-sm font-semibold cursor-pointer"
              >
                🎓
              </button>
            )}
            <button
              type="button"
              onClick={onLeave}
              className="px-4 py-2 rounded-xl bg-[#1a2438] hover:bg-[#24314a] text-sm text-slate-200 font-semibold cursor-pointer"
            >
              {t('common.back')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs md:text-sm">
          {/* LEWA KOLUMNA: Profil Prezesa do Pokoju */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">{t('lobby.yourNick')}</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f17] border border-[#243044] text-slate-100 text-sm md:text-base"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">{t('lobby.companyName')}</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f17] border border-[#243044] text-slate-100 text-sm md:text-base"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-2">{t('lobby.color')}</label>
              <div className="flex flex-wrap gap-2.5">
                {PLAYER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-xl border-2 cursor-pointer transition-transform ${
                      color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-65 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Krótka informacja o połączeniu P2P / TURN */}
            <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-1.5 text-xs">
              <div className="font-semibold text-slate-200">{t('lobby.p2pDiag')}</div>
              <p className="text-slate-400 leading-relaxed">{t('lobby.subtitle')}</p>
            </div>
          </div>

          {/* PRAWA KOLUMNA: Zakładki Stwórz / Otwarte Sesje / Dołącz */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => selectModeTab('choose')}
                  className={`py-2.5 px-2 rounded-xl text-xs md:text-sm font-bold border transition-colors cursor-pointer ${
                    modeView === 'choose'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('lobby.tabCreate')}
                </button>
                <button
                  type="button"
                  onClick={() => selectModeTab('browse')}
                  className={`py-2.5 px-2 rounded-xl text-xs md:text-sm font-bold border transition-colors cursor-pointer ${
                    modeView === 'browse'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('lobby.tabBrowse')}
                </button>
                <button
                  type="button"
                  onClick={() => selectModeTab('join')}
                  className={`py-2.5 px-2 rounded-xl text-xs md:text-sm font-bold border transition-colors cursor-pointer ${
                    modeView === 'join'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('lobby.tabJoin')}
                </button>
              </div>

              {modeView === 'choose' && (
                <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-3">
                  <DarkToggle
                    checked={isPublicRoom}
                    onChange={setIsPublicRoom}
                    label={t('lobby.publicToggle')}
                  />
                  {isPublicRoom && (
                    <div>
                      <label className="block text-slate-400 mb-1">
                        {t('lobby.roomNameLabel')}
                      </label>
                      <input
                        type="text"
                        maxLength={42}
                        value={roomNameInput}
                        onChange={(e) => setRoomNameInput(e.target.value)}
                        placeholder="Liga Wall Street #1"
                        className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-[#243044] text-slate-100"
                      />
                    </div>
                  )}
                </div>
              )}

              {modeView === 'browse' && (
                <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-amber-200">
                      {t('lobby.openRoomsTitle', { n: publicLobbies.length })}
                    </div>
                    <button
                      type="button"
                      disabled={loadingLobbies}
                      onClick={() => void refreshPublicLobbies()}
                      className="px-2.5 py-1 rounded bg-[#182235] hover:bg-[#22304a] border border-[#2d3b52] text-slate-200 text-[11px]"
                    >
                      {loadingLobbies ? t('lobby.searching') : t('lobby.refresh')}
                    </button>
                  </div>

                  {publicLobbies.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-[11px] space-y-1">
                      <div>{t('lobby.noOpenRooms')}</div>
                      <div className="text-slate-500">{t('lobby.noOpenRoomsHint')}</div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {publicLobbies.map((rm) => {
                        const div = getPvPDivisionById(rm.hostDivision);
                        const rawSc = SCENARIO_DEFINITIONS.find((s) => s.id === rm.scenarioId);
                        const sc = rawSc ? localizeScenario(rawSc, lang) : undefined;
                        const preset = localizeDifficultyPreset(
                          DIFFICULTY_PRESETS[rm.difficultyPreset] ?? DIFFICULTY_PRESETS.standard,
                          lang
                        );
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
                                  Host:{' '}
                                  {rm.hostPrestige > 0
                                    ? '★'.repeat(Math.min(3, rm.hostPrestige)) + ' '
                                    : ''}
                                  {rm.hostName}
                                </span>
                                <span className={`px-1 rounded border ${div.badgeClass}`}>
                                  {div.icon} {localizePvPDivisionLabel(div.id, div.label, lang)}
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
                                {t('lobby.joinBtn')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-1 text-[10px] text-slate-500 border-t border-[#1e293b]">
                    {directorySource === 'supabase' ? t('lobby.dirSupabase') : t('lobby.dirLocal')}
                  </div>
                </div>
              )}

              {modeView === 'join' && (
                <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-[#243044]">
                  <label className="block text-slate-400 mb-1.5">{t('lobby.roomCodeLabel')}</label>
                  <input
                    type="text"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="np. MD-4821"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#111827] border border-sky-500/40 font-mono text-base text-amber-300 tracking-wider uppercase"
                  />
                </div>
              )}

              {busy && stage !== 'idle' && (
                <div className="p-2.5 rounded-lg bg-sky-950/35 border border-sky-500/40 text-sky-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping shrink-0" />
                  <span>{stageLabel}</span>
                </div>
              )}

              {error && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 space-y-2">
                  <div>⚠️ {error}</div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={modeView === 'choose' ? handleCreate : handleJoin}
                    className="px-3 py-1 rounded bg-rose-600/35 hover:bg-rose-600/55 border border-rose-400/50 text-rose-100 font-semibold"
                  >
                    {t('lobby.retry')}
                  </button>
                </div>
              )}
            </div>

            {modeView === 'choose' ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleCreate}
                className="w-full py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-sm md:text-base cursor-pointer"
              >
                {busy ? t('lobby.creating') : t('lobby.createBtn')}
              </button>
            ) : modeView === 'join' ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleJoin}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm md:text-base cursor-pointer"
              >
                {busy ? t('lobby.joining') : t('lobby.joinRoomBtn')}
              </button>
            ) : null}
          </div>
        </div>
        {diagnosticsFooterBar}
      </div>
    </div>
  );
};
