import React, { useState } from 'react';
import {
  DEFAULT_DOMINATION_THRESHOLD,
  DEFAULT_MUTATORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_PRESETS,
  DOMINATION_THRESHOLD_OPTIONS,
  GAME_CONFIG,
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
import { ARCHETYPE_LIST } from '../../data/archetypes';
import {
  ARCHETYPE_SHOP_ITEM_ID,
  SCENARIO_SHOP_ITEM_ID,
  SHOP_ITEMS,
  computeRewardMultiplier,
  isArchetypeUnlocked,
  isScenarioUnlocked,
} from '../../data/shopCatalog';
import {
  localizeArchetype,
  localizeDifficultyLabel,
  localizeDifficultyPreset,
  localizeMapSizeLabel,
  localizeScenario,
} from '../../i18n/dataTranslations';
import { useI18n } from '../../i18n/useI18n';
import type {
  ArchetypeId,
  DifficultyPreset,
  GameMode,
  GameSettings,
  MutatorFlags,
  ScenarioId,
  UserAccountProfile,
} from '../../engine/types';
import { DarkToggle } from '../HUD/DarkControls';
import { InfoTooltip } from '../HUD/InfoTooltip';
import { LanguageSwitcher } from '../HUD/LanguageSwitcher';
import { MCoinIcon } from '../HUD/MCoinIcon';

interface GameSetupProps {
  activeProfile: UserAccountProfile;
  defaultPlayerName?: string;
  onOpenShop: () => void;
  onStart: (
    settings: GameSettings,
    playerName: string,
    companyName: string,
    color: string,
    withTutorial: boolean,
    options?: { archetype?: ArchetypeId }
  ) => void;
  onBack: () => void;
}

type SetupStepTab = 1 | 2 | 3;

export const GameSetup: React.FC<GameSetupProps> = ({
  activeProfile,
  defaultPlayerName,
  onOpenShop,
  onStart,
  onBack,
}) => {
  const { lang, t } = useI18n();
  const [step, setStep] = useState<SetupStepTab>(1);
  const [mode, setMode] = useState<'challenge1h' | 'endless'>('challenge1h');
  const [playerName, setPlayerName] = useState(defaultPlayerName || 'Prezes');
  const [companyName, setCompanyName] = useState('Dominion Capital S.A.');
  const [color, setColor] = useState(PLAYER_COLORS[0]);
  const [archetype, setArchetype] = useState<ArchetypeId>('standard');
  const [difficultyPreset, setDifficultyPreset] = useState<DifficultyPreset>('standard');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('sandbox');
  const [mutators, setMutators] = useState<MutatorFlags>({ ...DEFAULT_MUTATORS });
  const [playerCount, setPlayerCount] = useState(4);
  const [aiDifficulty, setAiDifficulty] = useState(2);
  const [mapSize, setMapSize] = useState(24);
  const [disastersEnabled, setDisastersEnabled] = useState(true);
  const [victoryMode, setVictoryMode] = useState<'solo' | 'coalition'>('solo');
  const [dominationThreshold, setDominationThreshold] = useState<number>(
    DEFAULT_DOMINATION_THRESHOLD
  );
  const [withTutorial, setWithTutorial] = useState(false);

  const MUTATOR_META: { key: keyof MutatorFlags; label: string; desc: string; featured?: boolean }[] =
    lang === 'en'
      ? [
          {
            key: 'globalBreakthroughs',
            label: '⚡ Global Market Breakthroughs',
            desc: 'A mid-game megatrend permanently reshapes key sectors (+15% XP & M).',
            featured: true,
          },
          {
            key: 'fogOfWar',
            label: '🌫️ Building Fog of War',
            desc: 'Rival structures stay hidden until scanned by intelligence.',
          },
          {
            key: 'noLoans',
            label: '🚫 No Bank Loans',
            desc: 'Zero bank loans or corporate bonds — self-fund expansion from cashflow.',
          },
          {
            key: 'volatileMarket',
            label: '📊 Volatile Market x2',
            desc: 'Stronger commodity swings, sharper booms and crashes.',
          },
          {
            key: 'freeLocalRoads',
            label: '🛣️ Free Local Roads',
            desc: 'Local asphalt roads cost $0 (highways keep standard cost).',
          },
          {
            key: 'extremeClimate',
            label: '⛈️ Extreme Climate',
            desc: 'More frequent disasters and stricter emergency service demand.',
          },
        ]
      : [
          {
            key: 'globalBreakthroughs',
            label: '⚡ Globalne Przełomy Rynkowe',
            desc: 'Megatrend z Gazety trwale zmienia ekonomię sektorów (+15% XP & M).',
            featured: true,
          },
          {
            key: 'fogOfWar',
            label: '🌫️ Mgła Wojny Budynków',
            desc: 'Rywale widzą budynki jako „Obiekt Nieznany” do czasu skanu wywiadu.',
          },
          {
            key: 'noLoans',
            label: '🚫 Bez Kredytów Bankowych',
            desc: 'Zero pożyczek i obligacji — rozwój wyłącznie z przychodów.',
          },
          {
            key: 'volatileMarket',
            label: '📊 Szalona Giełda x2',
            desc: 'Mocniejsze wahania cen surowców, częstsze hossy i krachy.',
          },
          {
            key: 'freeLocalRoads',
            label: '🛣️ Darmowe Drogi Lokalne',
            desc: 'Lokalne drogi za 0 zł (autostrady zachowują pełny koszt).',
          },
          {
            key: 'extremeClimate',
            label: '⛈️ Ekstremalny Klimat',
            desc: 'Częstsze katastrofy i wyższe wymagania służb ratunkowych.',
          },
        ];

  const selectedArchetype = localizeArchetype(
    ARCHETYPE_LIST.find((a) => a.id === archetype) ?? ARCHETYPE_LIST[0],
    lang
  );
  const selectedPreset = localizeDifficultyPreset(DIFFICULTY_PRESETS[difficultyPreset], lang);
  const selectedScenario = localizeScenario(
    SCENARIO_DEFINITIONS.find((s) => s.id === scenarioId) ?? SCENARIO_DEFINITIONS[0],
    lang
  );

  const archetypeUnlocked = isArchetypeUnlocked(activeProfile.unlockedCosmetics, archetype);
  const scenarioUnlocked = isScenarioUnlocked(activeProfile.unlockedCosmetics, scenarioId);
  const rewardInfo = computeRewardMultiplier({
    difficultyPreset,
    aiDifficulty,
    aiCount: Math.max(0, playerCount - 1),
    mutators,
  });
  const activeMutatorCount = Object.values(mutators).filter(Boolean).length;

  const handleLaunch = () => {
    if (!archetypeUnlocked || !scenarioUnlocked) return;
    const settings: GameSettings = {
      mode: mode as GameMode,
      playerCount,
      aiDifficulty,
      mapSize,
      challengeDurationSeconds:
        mode === 'challenge1h' ? GAME_CONFIG.challengeDurationSeconds : 0,
      economyMultiplier: 1.0,
      disastersEnabled,
      victoryMode,
      dominationThreshold,
      difficultyPreset,
      scenarioId,
      mutators,
    };
    onStart(settings, playerName, companyName, color, withTutorial, { archetype });
  };

  return (
    <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex items-center justify-center p-2.5 md:p-5 overflow-y-auto">
      <div className="w-[92vw] max-w-[1220px] lg:max-h-[94vh] rounded-2xl bg-[#111827] border border-[#243044] shadow-2xl flex flex-col overflow-hidden">
        {/* Górny pasek nagłówka */}
        <div className="px-5 md:px-6 py-3.5 border-b border-[#243044] bg-[#0b0f17] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div>
            <h2 className="text-lg md:text-2xl font-extrabold text-white tracking-tight">
              {t('setup.title')}
            </h2>
            <p className="text-xs md:text-sm text-slate-400">{t('setup.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher compact />
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-[#1a2438] hover:bg-[#24314a] text-sm text-slate-200 font-semibold cursor-pointer"
            >
              {t('common.back')}
            </button>
          </div>
        </div>

        {/* Pasek 3 dużych zakładek konfiguracji */}
        <div className="px-5 md:px-6 py-3 bg-[#0d131f] border-b border-[#243044] grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
              step === 1
                ? 'bg-emerald-950/45 border-emerald-400 text-white shadow-md shadow-emerald-950/30'
                : 'bg-[#111827] border-[#243044] text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="font-bold text-sm md:text-base">{t('setup.step1')}</span>
            <span className="px-2 py-0.5 rounded bg-[#0b0f17] border border-[#243044] text-xs font-medium text-amber-300 shrink-0">
              {selectedArchetype.icon} {selectedArchetype.shortName}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStep(2)}
            className={`px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
              step === 2
                ? 'bg-sky-950/45 border-sky-400 text-white shadow-md shadow-sky-950/30'
                : 'bg-[#111827] border-[#243044] text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="font-bold text-sm md:text-base">{t('setup.step2')}</span>
            <span className="px-2 py-0.5 rounded bg-[#0b0f17] border border-[#243044] text-xs font-mono text-sky-300 shrink-0">
              {mapSize}×{mapSize} · {playerCount}P
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStep(3)}
            className={`px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
              step === 3
                ? 'bg-amber-950/45 border-amber-400 text-white shadow-md shadow-amber-950/30'
                : 'bg-[#111827] border-[#243044] text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="font-bold text-sm md:text-base">{t('setup.step3')}</span>
            <span className="px-2 py-0.5 rounded bg-[#0b0f17] border border-[#243044] text-xs font-mono text-amber-300 shrink-0">
              {dominationThreshold}%
              {activeMutatorCount > 0 ? ` · +${activeMutatorCount}` : ''}
            </span>
          </button>
        </div>

        {/* Główny obszar wybranej zakładki */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
          {/* ZAKŁADKA 1: Firma i Archetyp */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-[#0b0f17] border border-[#243044]">
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-300 mb-1.5">
                    {t('setup.ceoName')}
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#111827] border border-[#2d3b52] text-sm md:text-base text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-300 mb-1.5">
                    {t('setup.companyName')}
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#111827] border border-[#2d3b52] text-sm md:text-base text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-300 mb-1.5">
                    {t('setup.companyColor')}
                  </label>
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {PLAYER_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-8 h-8 rounded-xl border-2 transition-transform cursor-pointer ${
                          color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm md:text-base text-slate-200 font-bold uppercase tracking-wider flex items-center gap-2">
                    <span>{t('setup.archetypeHeader')}</span>
                    <InfoTooltip {...getArchetypeTooltip(archetype)} />
                  </div>
                  <span className="text-xs md:text-sm text-slate-400">{t('setup.archetypeHint')}</span>
                </div>

                {/* Duże czytelne karty Archetypów BEZ ucinania opisów wielokropkiem */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {ARCHETYPE_LIST.map((arch) => {
                    const locArch = localizeArchetype(arch, lang);
                    const unlocked = isArchetypeUnlocked(activeProfile.unlockedCosmetics, arch.id);
                    const reqUnlockId = ARCHETYPE_SHOP_ITEM_ID[arch.id];
                    const price = SHOP_ITEMS.find(
                      (it) => reqUnlockId && it.unlockIdsGranted.includes(reqUnlockId)
                    )?.priceMCoins;
                    const isSelected = archetype === arch.id;
                    return (
                      <button
                        key={arch.id}
                        type="button"
                        onClick={() => setArchetype(arch.id)}
                        className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? unlocked
                              ? 'bg-[#162235] border-amber-400 text-white shadow-lg shadow-amber-950/30'
                              : 'bg-rose-950/30 border-rose-400/75 text-slate-100'
                            : unlocked
                              ? 'bg-[#0b0f17] border-[#243044] text-slate-200 hover:border-slate-500'
                              : 'bg-[#0b0f17]/75 border-[#1e293b] text-slate-300 opacity-90 hover:border-amber-500/45'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="font-bold flex items-center justify-between gap-2 text-sm md:text-base">
                            <span>
                              {locArch.icon} {locArch.name}
                            </span>
                            {!unlocked && price && (
                              <span className="px-2 py-0.5 rounded-lg bg-amber-950/60 border border-amber-400/45 text-amber-200 font-mono text-xs shrink-0">
                                🔒 {price} M
                              </span>
                            )}
                          </div>
                          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                            {locArch.tagline}
                          </p>
                        </div>
                        {locArch.pros[0] && (
                          <div className="text-xs text-emerald-300/90 leading-snug pt-1 border-t border-[#1e293b]">
                            • {locArch.pros[0]}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {!archetypeUnlocked && (
                  <div className="p-3.5 rounded-xl bg-amber-950/35 border border-amber-500/50 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-amber-200 font-medium">
                      🔒 {t('setup.unlockArchBanner', { name: selectedArchetype.name })}
                    </span>
                    <button
                      type="button"
                      onClick={onOpenShop}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <MCoinIcon size={14} />
                      <span>{t('setup.openShopBtn', { coins: activeProfile.mCoins })}</span>
                    </button>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#243044] grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                      {t('setup.pros', { name: selectedArchetype.shortName })}
                    </div>
                    <ul className="space-y-1 text-xs md:text-sm text-slate-200 leading-relaxed">
                      {selectedArchetype.pros.map((p) => (
                        <li key={p}>• {p}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1.5">
                      {t('setup.cons')}
                    </div>
                    <ul className="space-y-1 text-xs md:text-sm text-slate-300 leading-relaxed">
                      {selectedArchetype.cons.map((c) => (
                        <li key={c}>• {c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ZAKŁADKA 2: Świat i Tryb Gry */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm md:text-base text-slate-200 font-bold">
                  <span>{t('setup.tempoLabel')}</span>
                  <InfoTooltip {...getTempoTooltip(mode)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() => setMode('challenge1h')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      mode === 'challenge1h'
                        ? 'bg-emerald-950/40 border-emerald-400 text-white shadow-lg shadow-emerald-950/30'
                        : 'bg-[#0b0f17] border-[#243044] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="font-bold text-sm md:text-base">{t('setup.mode1h')}</div>
                    <div className="text-xs md:text-sm opacity-85 mt-1 leading-relaxed">
                      {t('setup.mode1hDesc')}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('endless')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      mode === 'endless'
                        ? 'bg-amber-950/40 border-amber-400 text-white shadow-lg shadow-amber-950/30'
                        : 'bg-[#0b0f17] border-[#243044] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="font-bold text-sm md:text-base">{t('setup.modeEndless')}</div>
                    <div className="text-xs md:text-sm opacity-85 mt-1 leading-relaxed">
                      {t('setup.modeEndlessDesc')}
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2.5">
                  <label className="text-sm md:text-base text-slate-200 font-bold flex items-center gap-2">
                    <span>{t('setup.scenario')}</span>
                    <InfoTooltip {...getScenarioTooltip(scenarioId)} />
                  </label>
                  <select
                    value={scenarioId}
                    onChange={(e) => setScenarioId(e.target.value as ScenarioId)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#151c28] border border-[#2d3b52] text-sm md:text-base text-slate-100"
                  >
                    {SCENARIO_DEFINITIONS.map((sc) => {
                      const locSc = localizeScenario(sc, lang);
                      const unlocked = isScenarioUnlocked(activeProfile.unlockedCosmetics, sc.id);
                      const reqUnlockId = SCENARIO_SHOP_ITEM_ID[sc.id];
                      const price = SHOP_ITEMS.find(
                        (it) => reqUnlockId && it.unlockIdsGranted.includes(reqUnlockId)
                      )?.priceMCoins;
                      return (
                        <option key={sc.id} value={sc.id}>
                          {locSc.icon} {locSc.name}
                          {!unlocked && price ? ` 🔒 (${price} M)` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <div className="text-xs md:text-sm text-slate-300 leading-relaxed">
                    {selectedScenario.description}
                  </div>
                  {!scenarioUnlocked && (
                    <button
                      type="button"
                      onClick={onOpenShop}
                      className="w-full py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-bold text-xs md:text-sm cursor-pointer"
                    >
                      {t('setup.unlockScenarioBtn')}
                    </button>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2.5">
                  <label className="text-sm md:text-base text-slate-200 font-bold flex items-center gap-2">
                    <span>{t('setup.economyDiff')}</span>
                    <InfoTooltip {...getDifficultyPresetTooltip(difficultyPreset)} />
                  </label>
                  <select
                    value={difficultyPreset}
                    onChange={(e) => setDifficultyPreset(e.target.value as DifficultyPreset)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#151c28] border border-[#2d3b52] text-sm md:text-base text-slate-100"
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
                  <div className="text-xs md:text-sm text-slate-300 leading-relaxed">
                    {selectedPreset.description}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#0b0f17] border border-[#243044]">
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-300 mb-1.5">
                    {t('setup.entities')}
                  </label>
                  <select
                    value={playerCount}
                    onChange={(e) => setPlayerCount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#151c28] border border-[#2d3b52] text-sm md:text-base text-slate-100"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n === 1
                          ? t('setup.playerOnly')
                          : t('setup.playerPlusAi', { n, ai: n - 1 })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs md:text-sm font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                    <span>{t('setup.aiLevel')}</span>
                    <InfoTooltip {...getAiDifficultyTooltip(aiDifficulty)} />
                  </label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#151c28] border border-[#2d3b52] text-sm md:text-base text-slate-100"
                  >
                    {DIFFICULTY_LABELS.map((lbl, idx) => (
                      <option key={lbl} value={idx + 1}>
                        {localizeDifficultyLabel(idx, lbl, lang)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs md:text-sm font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                    <span>{t('setup.mapSize')}</span>
                    <InfoTooltip {...getMapSizeTooltip(mapSize)} />
                  </label>
                  <select
                    value={mapSize}
                    onChange={(e) => setMapSize(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#151c28] border border-[#2d3b52] text-sm md:text-base text-slate-100"
                  >
                    {MAP_SIZES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {localizeMapSizeLabel(m.value, m.label, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ZAKŁADKA 3: Zasady i Mutatory */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm md:text-base font-bold text-slate-200 flex items-center gap-2">
                      <span>{t('setup.victoryCond')}</span>
                      <InfoTooltip {...getVictoryTooltip(victoryMode, dominationThreshold)} />
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      value={victoryMode}
                      onChange={(e) => setVictoryMode(e.target.value as 'solo' | 'coalition')}
                      className="flex-1 min-w-[190px] bg-[#151c28] border border-[#2d3b52] rounded-xl px-3.5 py-2.5 text-sm md:text-base text-slate-100"
                    >
                      <option value="solo">{t('setup.victorySolo')}</option>
                      <option value="coalition">{t('setup.victoryCoalition')}</option>
                    </select>
                    <select
                      aria-label={t('setup.threshold')}
                      value={dominationThreshold}
                      onChange={(e) => setDominationThreshold(Number(e.target.value))}
                      className="bg-[#151c28] border border-[#2d3b52] rounded-xl px-3.5 py-2.5 text-amber-300 font-mono font-bold text-sm md:text-base"
                    >
                      {DOMINATION_THRESHOLD_OPTIONS.map((pct) => (
                        <option key={pct} value={pct}>
                          {pct}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-3 flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 text-sm">
                      <DarkToggle
                        checked={disastersEnabled}
                        onChange={setDisastersEnabled}
                        label={t('setup.disasters')}
                      />
                    </div>
                    <InfoTooltip {...getDisastersTooltip(disastersEnabled)} />
                  </div>
                  <div className="pt-2.5 border-t border-[#1e293b] text-sm">
                    <DarkToggle
                      checked={withTutorial}
                      onChange={setWithTutorial}
                      label={t('setup.tutorialToggle')}
                    />
                  </div>
                </div>
              </div>

              {/* Otwarty panel Mutatorów i Przełomów Rynkowych */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm md:text-base font-bold text-slate-100 flex items-center gap-2">
                      <span>{t('setup.mutatorsTitle')}</span>
                      {activeMutatorCount > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono text-xs">
                          {t('setup.mutatorsActive', { n: activeMutatorCount })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-slate-400 mt-0.5">{t('setup.mutatorsSub')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {MUTATOR_META.map((m) => (
                    <div
                      key={m.key}
                      className={`p-3.5 rounded-xl border transition-colors ${
                        m.featured
                          ? mutators[m.key]
                            ? 'bg-amber-950/35 border-amber-400/70'
                            : 'bg-[#0b0f17] border-amber-500/40'
                          : mutators[m.key]
                            ? 'bg-sky-950/25 border-sky-400/60'
                            : 'bg-[#0b0f17] border-[#243044]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 text-sm">
                          <DarkToggle
                            checked={mutators[m.key]}
                            onChange={(val) =>
                              setMutators((prev) => ({ ...prev, [m.key]: val }))
                            }
                            label={m.label}
                          />
                        </div>
                      </div>
                      {m.featured && (
                        <div className="mt-1.5 inline-block px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/45 text-amber-300 font-mono text-[10px] font-bold">
                          {t('setup.featuredRule')}
                        </div>
                      )}
                      <div className="text-xs text-slate-300 mt-1.5 leading-relaxed">{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Zawsze widoczna dolna belka: Mnożnik Nagród, Sklep, nawigacja kroków i przycisk Start */}
        <div className="px-5 md:px-6 py-3.5 border-t border-[#243044] bg-[#0b0f17] shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-950/45 via-[#121c2d] to-emerald-950/40 border border-amber-400/50 space-y-0.5">
              <div className="font-bold text-sm text-amber-200 flex items-center gap-1.5 flex-wrap">
                <span>✨ {t('setup.rewardMult')}</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 font-mono text-amber-300">
                  ×{rewardInfo.totalMultiplier.toFixed(2)} XP &amp;
                </span>
                <MCoinIcon size={15} />
                <span className="font-mono text-amber-300">M</span>
              </div>
              <div className="text-[11px] text-slate-300 flex flex-wrap gap-x-2.5">
                {rewardInfo.breakdown.map((b) => (
                  <span key={b}>• {b}</span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenShop}
              className="px-4 py-2.5 rounded-xl bg-[#151c28] hover:bg-[#1e293d] border border-amber-400/50 text-amber-200 text-sm font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <MCoinIcon size={15} />
              <span>{t('setup.shopBtn', { coins: activeProfile.mCoins })}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="px-4 py-3 rounded-xl bg-[#151c28] hover:bg-[#1f293d] border border-[#2d3b52] text-slate-200 text-sm font-semibold cursor-pointer"
              >
                {t('setup.prevStep')}
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
                className="px-4 py-3 rounded-xl bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/50 text-sky-200 text-sm font-bold cursor-pointer"
              >
                {t('setup.nextStep')}
              </button>
            )}
            <button
              type="button"
              disabled={!archetypeUnlocked || !scenarioUnlocked}
              onClick={handleLaunch}
              className="px-7 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#1a2233] disabled:text-slate-400 disabled:border disabled:border-[#243044] text-white font-extrabold text-sm md:text-base shadow-lg cursor-pointer disabled:cursor-not-allowed"
            >
              {!archetypeUnlocked || !scenarioUnlocked
                ? t('setup.launchLocked')
                : t('setup.launchBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
