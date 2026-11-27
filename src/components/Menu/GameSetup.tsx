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

export const GameSetup: React.FC<GameSetupProps> = ({
  activeProfile,
  defaultPlayerName,
  onOpenShop,
  onStart,
  onBack,
}) => {
  const { lang, t } = useI18n();
  const [mode, setMode] = useState<'challenge1h' | 'endless'>('challenge1h');
  const [playerName, setPlayerName] = useState(defaultPlayerName || 'Prezes');
  const [companyName, setCompanyName] = useState('Dominion Capital S.A.');
  const [color, setColor] = useState(PLAYER_COLORS[0]);
  const [archetype, setArchetype] = useState<ArchetypeId>('standard');
  const [difficultyPreset, setDifficultyPreset] = useState<DifficultyPreset>('standard');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('sandbox');
  const [mutatorsOpen, setMutatorsOpen] = useState(false);
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

  const MUTATOR_META: { key: keyof MutatorFlags; label: string; desc: string }[] =
    lang === 'en'
      ? [
          {
            key: 'fogOfWar',
            label: '🌫️ Building Fog of War',
            desc: 'Rival structures stay hidden until scanned by intelligence.',
          },
          {
            key: 'noLoans',
            label: '🚫 No Bank Loans',
            desc: 'Zero loans or bonds — self-fund expansion from cashflow.',
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
            desc: 'More frequent disasters and stricter safety demand.',
          },
          {
            key: 'globalBreakthroughs',
            label: '⚡ Global Market Breakthroughs',
            desc: 'Mid-game megatrend permanently reshapes sectors (+15% XP & M).',
          },
        ]
      : [
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
            desc: 'Lokalne drogi za 0 zł (autostrady zachowują koszt).',
          },
          {
            key: 'extremeClimate',
            label: '⛈️ Ekstremalny Klimat',
            desc: 'Częstsze katastrofy i wyższe wymagania służb ratunkowych.',
          },
          {
            key: 'globalBreakthroughs',
            label: '⚡ Globalne Przełomy Rynkowe',
            desc: 'Megatrend z Gazety zmienia ekonomię na resztę meczu (+15% XP & M).',
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
    <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex items-center justify-center p-2.5 md:p-4 overflow-y-auto">
      <div className="w-full max-w-6xl lg:max-h-[95vh] rounded-2xl bg-[#111827] border border-[#243044] shadow-2xl flex flex-col overflow-hidden">
        {/* Górny pasek nagłówka */}
        <div className="px-4 md:px-5 py-3 border-b border-[#243044] bg-[#0b0f17] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div>
            <h2 className="text-base md:text-lg font-bold text-white">{t('setup.title')}</h2>
            <p className="text-[11px] text-slate-400">{t('setup.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-1.5 rounded-lg bg-[#1a2438] hover:bg-[#24314a] text-xs text-slate-200 font-semibold"
            >
              {t('common.back')}
            </button>
          </div>
        </div>

        {/* Dwukolumnowa zawartość dopasowana do ekranów 1366x768+ */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
          {/* LEWA KOLUMNA: Tryb, Dane Prezesa, Kolor, Archetyp */}
          <div className="lg:col-span-6 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <span>{t('setup.tempoLabel')}</span>
                <InfoTooltip {...getTempoTooltip(mode)} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMode('challenge1h')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    mode === 'challenge1h'
                      ? 'bg-emerald-950/35 border-emerald-400 text-white'
                      : 'bg-[#0b0f17] border-[#243044] text-slate-400'
                  }`}
                >
                  <div className="font-bold text-xs md:text-sm">{t('setup.mode1h')}</div>
                  <div className="text-[11px] opacity-80 mt-0.5 leading-snug">
                    {t('setup.mode1hDesc')}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('endless')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    mode === 'endless'
                      ? 'bg-amber-950/35 border-amber-400 text-white'
                      : 'bg-[#0b0f17] border-[#243044] text-slate-400'
                  }`}
                >
                  <div className="font-bold text-xs md:text-sm">{t('setup.modeEndless')}</div>
                  <div className="text-[11px] opacity-80 mt-0.5 leading-snug">
                    {t('setup.modeEndlessDesc')}
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-400 mb-1">{t('setup.ceoName')}</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{t('setup.companyName')}</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">{t('setup.companyColor')}</label>
              <div className="flex flex-wrap gap-2">
                {PLAYER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-lg border-2 transition-transform ${
                      color === c ? 'border-white scale-110' : 'border-transparent opacity-70'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                  <span>{t('setup.archetypeHeader')}</span>
                  <InfoTooltip {...getArchetypeTooltip(archetype)} />
                </label>
                <span className="text-[10px] text-slate-400">{t('setup.archetypeHint')}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {ARCHETYPE_LIST.map((arch) => {
                  const locArch = localizeArchetype(arch, lang);
                  const unlocked = isArchetypeUnlocked(activeProfile.unlockedCosmetics, arch.id);
                  const reqUnlockId = ARCHETYPE_SHOP_ITEM_ID[arch.id];
                  const price = SHOP_ITEMS.find(
                    (it) => reqUnlockId && it.unlockIdsGranted.includes(reqUnlockId)
                  )?.priceMCoins;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => setArchetype(arch.id)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        archetype === arch.id
                          ? unlocked
                            ? 'bg-[#162235] border-amber-400 text-white'
                            : 'bg-rose-950/30 border-rose-400/70 text-slate-200'
                          : unlocked
                            ? 'bg-[#0b0f17] border-[#243044] text-slate-300 hover:border-slate-500'
                            : 'bg-[#0b0f17]/70 border-[#1e293b] text-slate-400 opacity-85 hover:border-amber-500/40'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between gap-1 text-[11px]">
                        <span className="truncate">
                          {locArch.icon} {locArch.shortName}
                        </span>
                        {!unlocked && price && (
                          <span className="px-1 py-0.5 rounded bg-amber-950/60 border border-amber-400/40 text-amber-200 font-mono text-[9px] shrink-0">
                            🔒 {price}M
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        {locArch.tagline}
                      </div>
                    </button>
                  );
                })}
              </div>

              {!archetypeUnlocked && (
                <div className="p-2 rounded-lg bg-amber-950/35 border border-amber-500/50 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-amber-200">
                    🔒 {t('setup.unlockArchBanner', { name: selectedArchetype.name })}
                  </span>
                  <button
                    type="button"
                    onClick={onOpenShop}
                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1"
                  >
                    <MCoinIcon size={12} />
                    <span>{t('setup.openShopBtn', { coins: activeProfile.mCoins })}</span>
                  </button>
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-[#0b0f17] border border-[#243044] grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] font-bold text-emerald-400 uppercase mb-0.5">
                    {t('setup.pros', { name: selectedArchetype.shortName })}
                  </div>
                  <ul className="space-y-0.5 text-[10px] text-slate-200 leading-snug">
                    {selectedArchetype.pros.map((p) => (
                      <li key={p}>• {p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-rose-400 uppercase mb-0.5">
                    {t('setup.cons')}
                  </div>
                  <ul className="space-y-0.5 text-[10px] text-slate-300 leading-snug">
                    {selectedArchetype.cons.map((c) => (
                      <li key={c}>• {c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* PRAWA KOLUMNA: Trudność, Scenariusz, Parametry, Mutatory, Mnożnik */}
          <div className="lg:col-span-6 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-1">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <span>{t('setup.economyDiff')}</span>
                    <InfoTooltip {...getDifficultyPresetTooltip(difficultyPreset)} />
                  </label>
                  <select
                    value={difficultyPreset}
                    onChange={(e) => setDifficultyPreset(e.target.value as DifficultyPreset)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#151c28] border border-[#2d3b52] text-slate-100"
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
                  <div className="text-[10px] text-slate-400 leading-snug line-clamp-2">
                    {selectedPreset.description}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-1">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <span>{t('setup.scenario')}</span>
                    <InfoTooltip {...getScenarioTooltip(scenarioId)} />
                  </label>
                  <select
                    value={scenarioId}
                    onChange={(e) => setScenarioId(e.target.value as ScenarioId)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#151c28] border border-[#2d3b52] text-slate-100"
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
                  <div className="text-[10px] text-slate-400 leading-snug line-clamp-2">
                    {selectedScenario.description}
                  </div>
                  {!scenarioUnlocked && (
                    <button
                      type="button"
                      onClick={onOpenShop}
                      className="w-full py-1 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-semibold text-[10px]"
                    >
                      {t('setup.unlockScenarioBtn')}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">
                    {t('setup.entities')}
                  </label>
                  <select
                    value={playerCount}
                    onChange={(e) => setPlayerCount(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
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
                  <label className="text-slate-400 flex items-center gap-1 mb-1 text-[11px]">
                    <span>{t('setup.aiLevel')}</span>
                    <InfoTooltip {...getAiDifficultyTooltip(aiDifficulty)} />
                  </label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
                  >
                    {DIFFICULTY_LABELS.map((lbl, idx) => (
                      <option key={lbl} value={idx + 1}>
                        {localizeDifficultyLabel(idx, lbl, lang)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 flex items-center gap-1 mb-1 text-[11px]">
                    <span>{t('setup.mapSize')}</span>
                    <InfoTooltip {...getMapSizeTooltip(mapSize)} />
                  </label>
                  <select
                    value={mapSize}
                    onChange={(e) => setMapSize(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
                  >
                    {MAP_SIZES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {localizeMapSizeLabel(m.value, m.label, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044] flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <DarkToggle
                      checked={disastersEnabled}
                      onChange={setDisastersEnabled}
                      label={t('setup.disasters')}
                    />
                  </div>
                  <InfoTooltip {...getDisastersTooltip(disastersEnabled)} />
                </div>
                <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044] flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-slate-300 flex items-center gap-1">
                    <span>{t('setup.victoryCond')}</span>
                    <InfoTooltip {...getVictoryTooltip(victoryMode, dominationThreshold)} />
                  </span>
                  <div className="flex items-center gap-1">
                    <select
                      value={victoryMode}
                      onChange={(e) => setVictoryMode(e.target.value as 'solo' | 'coalition')}
                      className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1 text-slate-100 text-[11px]"
                    >
                      <option value="solo">{t('setup.victorySolo')}</option>
                      <option value="coalition">{t('setup.victoryCoalition')}</option>
                    </select>
                    <select
                      aria-label={t('setup.threshold')}
                      value={dominationThreshold}
                      onChange={(e) => setDominationThreshold(Number(e.target.value))}
                      className="bg-[#151c28] border border-[#2d3b52] rounded px-1.5 py-1 text-amber-300 font-mono font-semibold text-[11px]"
                    >
                      {DOMINATION_THRESHOLD_OPTIONS.map((pct) => (
                        <option key={pct} value={pct}>
                          {pct}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Zwijane Mutatory Zasad */}
              <div className="rounded-xl bg-[#0b0f17] border border-[#243044] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMutatorsOpen((v) => !v)}
                  className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-[#131b2b]"
                >
                  <span className="font-semibold text-slate-200">
                    {t('setup.mutatorsTitle')}{' '}
                    {Object.values(mutators).filter(Boolean).length > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                        {t('setup.mutatorsActive', {
                          n: Object.values(mutators).filter(Boolean).length,
                        })}
                      </span>
                    )}
                  </span>
                  <span className="text-slate-400">{mutatorsOpen ? '▲' : '▼'}</span>
                </button>
                {mutatorsOpen && (
                  <div className="px-3 pb-2.5 pt-2 border-t border-[#1e293b] grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {MUTATOR_META.map((m) => (
                      <div key={m.key} className="p-2 rounded-lg bg-[#111827] border border-[#243044]">
                        <DarkToggle
                          checked={mutators[m.key]}
                          onChange={(val) =>
                            setMutators((prev) => ({ ...prev, [m.key]: val }))
                          }
                          label={m.label}
                        />
                        <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-[#121c2d] to-emerald-950/35 border border-amber-400/50 flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-bold text-amber-200 flex items-center gap-1.5">
                    <span>✨ {t('setup.rewardMult')}</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 font-mono text-amber-300">
                      ×{rewardInfo.totalMultiplier.toFixed(2)} XP &amp;
                    </span>
                    <MCoinIcon size={14} />
                    <span className="font-mono text-amber-300">M</span>
                  </div>
                  <div className="text-[10px] text-slate-300 flex flex-wrap gap-x-2">
                    {rewardInfo.breakdown.map((b) => (
                      <span key={b}>• {b}</span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenShop}
                  className="px-2.5 py-1.5 rounded-lg bg-[#151c28] hover:bg-[#1e293d] border border-amber-400/45 text-amber-200 font-semibold flex items-center gap-1"
                >
                  <MCoinIcon size={13} />
                  <span>{t('setup.shopBtn', { coins: activeProfile.mCoins })}</span>
                </button>
              </div>

              <div className="px-3 py-1.5 rounded-lg bg-[#0b0f17] border border-[#243044]">
                <DarkToggle
                  checked={withTutorial}
                  onChange={setWithTutorial}
                  label={t('setup.tutorialToggle')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Przypięta stopka z przyciskiem Start (zawsze widoczna w 95vh!) */}
        <div className="px-4 md:px-5 py-3 border-t border-[#243044] bg-[#0b0f17] shrink-0">
          <button
            type="button"
            disabled={!archetypeUnlocked || !scenarioUnlocked}
            onClick={handleLaunch}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#1a2233] disabled:text-slate-400 disabled:border disabled:border-[#243044] text-white font-bold text-sm md:text-base shadow-lg"
          >
            {!archetypeUnlocked || !scenarioUnlocked
              ? t('setup.launchLocked')
              : t('setup.launchBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
