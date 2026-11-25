import React, { useState } from 'react';
import {
  DIFFICULTY_LABELS,
  GAME_CONFIG,
  MAP_SIZES,
  PLAYER_COLORS,
} from '../../config/gameConfig';
import type { GameMode, GameSettings } from '../../engine/types';
import { DarkToggle } from '../HUD/DarkControls';

interface GameSetupProps {
  onStart: (
    settings: GameSettings,
    playerName: string,
    companyName: string,
    color: string,
    withTutorial: boolean
  ) => void;
  onBack: () => void;
}

export const GameSetup: React.FC<GameSetupProps> = ({ onStart, onBack }) => {
  const [mode, setMode] = useState<'challenge1h' | 'endless'>('challenge1h');
  const [playerName, setPlayerName] = useState('Prezes');
  const [companyName, setCompanyName] = useState('Dominion Capital S.A.');
  const [color, setColor] = useState(PLAYER_COLORS[0]);
  const [playerCount, setPlayerCount] = useState(4);
  const [aiDifficulty, setAiDifficulty] = useState(2);
  const [mapSize, setMapSize] = useState(24);
  const [disastersEnabled, setDisastersEnabled] = useState(true);
  const [victoryMode, setVictoryMode] = useState<'solo' | 'coalition'>('solo');
  const [withTutorial, setWithTutorial] = useState(false);

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
    };
    onStart(settings, playerName, companyName, color, withTutorial);
  };

  return (
    <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-[#111827] border border-[#243044] p-5 md:p-7 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#243044] pb-3">
          <div>
            <h2 className="text-xl font-bold text-white">Konfiguracja Kampanii Single Player</h2>
            <p className="text-xs text-slate-400">Działa w 100% lokalnie i offline z inteligentnymi botami AI (do 8 firm)</p>
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
