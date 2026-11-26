import React, { useState } from 'react';
import {
  DEFAULT_MUTATORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_PRESETS,
  GAME_CONFIG,
  MAP_SIZES,
  PLAYER_COLORS,
  SCENARIO_DEFINITIONS,
} from '../../config/gameConfig';
import { ARCHETYPE_LIST } from '../../data/archetypes';
import type {
  ArchetypeId,
  DifficultyPreset,
  GameMode,
  GameSettings,
  MutatorFlags,
  ScenarioId,
} from '../../engine/types';
import { DarkToggle } from '../HUD/DarkControls';

interface GameSetupProps {
  defaultPlayerName?: string;
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

const MUTATOR_META: { key: keyof MutatorFlags; label: string; desc: string }[] = [
  {
    key: 'fogOfWar',
    label: '🌫️ Mgła Wojny Budynków',
    desc: 'Rywale widzą budynki jako „Obiekt Nieznany” do czasu skanu wywiadu.',
  },
  {
    key: 'noLoans',
    label: '🚫 Bez Kredytów Bankowych',
    desc: 'Zero pożyczek i obligacji — finansujesz rozwój wyłącznie z przychodów.',
  },
  {
    key: 'volatileMarket',
    label: '📊 Szalona Giełda x2',
    desc: 'Mocniejsze wahania cen surowców, częstsze hossy i gwałtowne krachy.',
  },
  {
    key: 'freeLocalRoads',
    label: '🛣️ Darmowe Drogi Lokalne',
    desc: 'Budowa dróg asfaltowych kosztuje $0 (autostrady zachowują koszt).',
  },
  {
    key: 'extremeClimate',
    label: '⛈️ Ekstremalny Klimat',
    desc: 'Częstsze katastrofy i wyższe wymagania dla straży, szpitali oraz HAZMAT.',
  },
];

export const GameSetup: React.FC<GameSetupProps> = ({ defaultPlayerName, onStart, onBack }) => {
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
  const [withTutorial, setWithTutorial] = useState(false);

  const selectedArchetype = ARCHETYPE_LIST.find((a) => a.id === archetype) ?? ARCHETYPE_LIST[0];
  const selectedPreset = DIFFICULTY_PRESETS[difficultyPreset];
  const selectedScenario =
    SCENARIO_DEFINITIONS.find((s) => s.id === scenarioId) ?? SCENARIO_DEFINITIONS[0];

  const handleLaunch = () => {
    const settings: GameSettings = {
      mode: mode as GameMode,
      playerCount,
      aiDifficulty,
      mapSize,
      challengeDurationSeconds: mode === 'challenge1h' ? GAME_CONFIG.challengeDurationSeconds : 0,
      economyMultiplier: 1.0,
      disastersEnabled,
      victoryMode,
      difficultyPreset,
      scenarioId,
      mutators,
    };
    onStart(settings, playerName, companyName, color, withTutorial, { archetype });
  };

  return (
    <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-[#111827] border border-[#243044] p-5 md:p-7 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#243044] pb-3">
          <div>
            <h2 className="text-xl font-bold text-white">Konfiguracja Kampanii Single Player</h2>
            <p className="text-xs text-slate-400">
              Działa w 100% lokalnie i offline z inteligentnymi botami AI (do 8 firm)
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg bg-[#1a2438] text-xs text-slate-300 hover:text-white"
          >
            ← Wróć
          </button>
        </div>

        {/* Wybór trybu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('challenge1h')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              mode === 'challenge1h'
                ? 'bg-emerald-950/35 border-emerald-400 text-white'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400'
            }`}
          >
            <div className="font-bold text-sm">⏱️ Wyzwanie 1-Godzinne</div>
            <div className="text-xs opacity-80 mt-1">
              60 minut na maksymalizację wyceny netto i wpis do Światowej Tabeli Wyników (po czasie możesz grać dalej!).
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('endless')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              mode === 'endless'
                ? 'bg-amber-950/35 border-amber-400 text-white'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400'
            }`}
          >
            <div className="font-bold text-sm">♾️ Tryb Bez Limitu (Endless)</div>
            <div className="text-xs opacity-80 mt-1">
              Pełna swoboda budowy imperium gospodarczego bez presji zegara, z rosnącym wyzwaniem rynkowym.
            </div>
          </button>
        </div>

        {/* Dane gracza */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Imię / Pseudonim Prezesa</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Nazwa Konglomeratu</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
            />
          </div>
        </div>

        {/* Kolor firmy */}
        <div className="text-xs">
          <label className="block text-slate-400 mb-1.5">Kolor Korporacyjny na Mapie</label>
          <div className="flex flex-wrap gap-2">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-lg border-2 transition-transform ${
                  color === c ? 'border-white scale-110' : 'border-transparent opacity-70'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Wybór Archetypu Korporacji */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 font-semibold uppercase tracking-wider">
              🧬 Archetyp Korporacji (Zbilansowane Asymetrie)
            </label>
            <span className="text-[11px] text-slate-400">2 bonusy + 2 kompensujące ograniczenia</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ARCHETYPE_LIST.map((arch) => (
              <button
                key={arch.id}
                type="button"
                onClick={() => setArchetype(arch.id)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  archetype === arch.id
                    ? 'bg-[#162235] border-amber-400 text-white'
                    : 'bg-[#0b0f17] border-[#243044] text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <span>{arch.icon}</span>
                  <span className="truncate">{arch.shortName}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{arch.tagline}</div>
              </button>
            ))}
          </div>
          <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <div className="text-[10px] font-bold text-emerald-400 uppercase mb-1">
                Atuty ({selectedArchetype.name})
              </div>
              <ul className="space-y-0.5 text-[11px] text-slate-200">
                {selectedArchetype.pros.map((p) => (
                  <li key={p}>• {p}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-bold text-rose-400 uppercase mb-1">
                Koszty i Ograniczenia
              </div>
              <ul className="space-y-0.5 text-[11px] text-slate-300">
                {selectedArchetype.cons.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Poziom Trudności Ekonomicznej + Scenariusz Startowy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-1.5">
            <label className="block text-slate-300 font-semibold">⚖️ Poziom Trudności Gospodarki</label>
            <select
              value={difficultyPreset}
              onChange={(e) => setDifficultyPreset(e.target.value as DifficultyPreset)}
              className="w-full px-2.5 py-2 rounded-lg bg-[#151c28] border border-[#2d3b52] text-slate-100"
            >
              {(Object.keys(DIFFICULTY_PRESETS) as DifficultyPreset[]).map((k) => (
                <option key={k} value={k}>
                  {DIFFICULTY_PRESETS[k].badge} {DIFFICULTY_PRESETS[k].label}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-slate-400 leading-snug">
              {selectedPreset.description}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-1.5">
            <label className="block text-slate-300 font-semibold">🎬 Scenariusz Rozgrywki</label>
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value as ScenarioId)}
              className="w-full px-2.5 py-2 rounded-lg bg-[#151c28] border border-[#2d3b52] text-slate-100"
            >
              {SCENARIO_DEFINITIONS.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.icon} {sc.name}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-slate-400 leading-snug">
              {selectedScenario.description}
            </div>
          </div>
        </div>

        {/* Zwijane Mutatory Zasad */}
        <div className="rounded-xl bg-[#0b0f17] border border-[#243044] text-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setMutatorsOpen((v) => !v)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-[#131b2b]"
          >
            <span className="font-semibold text-slate-200">
              🎛️ Mutatory Zasad (Opcjonalne){' '}
              {Object.values(mutators).filter(Boolean).length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                  {Object.values(mutators).filter(Boolean).length} aktywne
                </span>
              )}
            </span>
            <span className="text-slate-400">{mutatorsOpen ? '▲ Zwiń' : '▼ Rozwiń'}</span>
          </button>
          {mutatorsOpen && (
            <div className="px-3.5 pb-3.5 pt-2 border-t border-[#1e293b] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {MUTATOR_META.map((m) => (
                <div key={m.key} className="p-2 rounded-lg bg-[#111827] border border-[#243044]">
                  <DarkToggle
                    checked={mutators[m.key]}
                    onChange={(val) => setMutators((prev) => ({ ...prev, [m.key]: val }))}
                    label={m.label}
                  />
                  <div className="text-[10px] text-slate-400 mt-1">{m.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Parametry rywalizacji */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Liczba Podmiotów (1–8)</label>
            <select
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? '1 (Tylko Gracz)' : `${n} (Gracz + ${n - 1} AI)`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Poziom Rywali AI</label>
            <select
              value={aiDifficulty}
              onChange={(e) => setAiDifficulty(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
            >
              {DIFFICULTY_LABELS.map((lbl, idx) => (
                <option key={lbl} value={idx + 1}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Rozmiar Mapy</label>
            <select
              value={mapSize}
              onChange={(e) => setMapSize(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
            >
              {MAP_SIZES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044]">
            <DarkToggle
              checked={disastersEnabled}
              onChange={setDisastersEnabled}
              label="Katastrofy naturalne (trzęsienia, powodzie, burze)"
            />
          </div>
          <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044] flex items-center justify-between gap-2">
            <span className="text-slate-300">Warunek wygranej:</span>
            <select
              value={victoryMode}
              onChange={(e) => setVictoryMode(e.target.value as 'solo' | 'coalition')}
              className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1 text-slate-100"
            >
              <option value="solo">👑 Dominacja Solowa</option>
              <option value="coalition">🤝 Dominacja Koalicji</option>
            </select>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044]">
          <DarkToggle
            checked={withTutorial}
            onChange={setWithTutorial}
            label="Uruchom szybki samouczek (Quick Start) na starcie gry"
          />
        </div>

        <button
          type="button"
          onClick={handleLaunch}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm md:text-base shadow-lg"
        >
          🚀 Rozpocznij Grę
        </button>
      </div>
    </div>
  );
};
