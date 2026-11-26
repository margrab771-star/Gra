import React from 'react';
import { GAME_CONFIG } from '../../config/gameConfig';
import { ACHIEVEMENTS, TITLES_CATALOG } from '../../data/achievements';
import { xpNeededForLevel } from '../../engine/profileManager';
import type { LastMpSession, SaveSlotId, SaveSlotMeta, UserAccountProfile } from '../../engine/types';
import { formatCompactMoney, formatTimeRemaining } from '../../utils/formatters';

interface MainMenuProps {
  activeProfile: UserAccountProfile;
  hasSavedGame: boolean;
  latestSaveMeta: SaveSlotMeta | null;
  saveSlots: SaveSlotMeta[];
  lastMpSession: LastMpSession | null;
  onNewSinglePlayer: () => void;
  onOpenMultiplayer: () => void;
  onOpenWeeklyChallenge: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onContinueGame: () => void;
  onLoadSlot: (slotId: SaveSlotId) => void;
  onQuickRejoinMp: (roomCode: string) => void;
  onOpenLeaderboard: () => void;
  onStartTutorial: () => void;
}

const MODE_LABELS: Record<string, string> = {
  endless: 'Kampania Endless',
  challenge1h: 'Wyzwanie 1h',
  mp_fast: 'Szybki MP',
  mp_long: 'Długi MP',
  weekly: 'Wyzwanie Tygodnia',
};

export const MainMenu: React.FC<MainMenuProps> = ({
  activeProfile,
  hasSavedGame,
  latestSaveMeta,
  saveSlots,
  lastMpSession,
  onNewSinglePlayer,
  onOpenMultiplayer,
  onOpenWeeklyChallenge,
  onOpenProfile,
  onOpenAuth,
  onContinueGame,
  onLoadSlot,
  onQuickRejoinMp,
  onOpenLeaderboard,
  onStartTutorial,
}) => {
  const titleObj = TITLES_CATALOG.find((t) => t.id === activeProfile.titleId) ?? TITLES_CATALOG[0];
  const nextXp = xpNeededForLevel(activeProfile.level);
  const xpPct = Math.min(100, Math.round((activeProfile.xp / Math.max(1, nextXp)) * 100));

  return (
    <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-y-auto">
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      />

      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-[#111827]/95 border border-[#243044] p-6 md:p-8 shadow-2xl space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono uppercase tracking-wider">
            ● Live Economic Engine · 2.5D Izometria
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            {GAME_CONFIG.title}
          </h1>
          <p className="text-xs md:text-sm text-slate-400">{GAME_CONFIG.subtitle}</p>
        </div>

        {/* Karta Aktywnego Profilu Prezesa */}
        <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#151c28] border border-amber-500/40 flex items-center justify-center text-xl shrink-0">
              {activeProfile.avatar}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-white truncate">{activeProfile.nick}</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono text-[10px]">
                  LVL {activeProfile.level}
                </span>
                {activeProfile.isGuest && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                    Gość
                  </span>
                )}
              </div>
              <div className="text-[11px] text-sky-300 truncate">
                {titleObj.label} · {activeProfile.unlockedAchievements.length}/{ACHIEVEMENTS.length} odznak
              </div>
              <div className="w-36 h-1.5 rounded-full bg-[#151c28] overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenProfile}
              className="px-2.5 py-1.5 rounded-lg bg-[#151c28] hover:bg-[#1e293d] border border-amber-500/40 text-amber-200 font-semibold"
            >
              🎖️ Profil
            </button>
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-2.5 py-1.5 rounded-lg bg-[#151c28] hover:bg-[#1e293d] border border-[#2d3b52] text-slate-300 font-semibold"
            >
              {activeProfile.isGuest ? '🔑 Zaloguj' : '👤 Konto'}
            </button>
          </div>
        </div>

        {/* Wyraźna karta wznowienia ostatniej rozgrywki */}
        {hasSavedGame && latestSaveMeta && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#162235] to-[#111827] border border-amber-500/45 shadow-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono text-amber-300 uppercase tracking-wider">
                  ⚡ Wznów ostatnią rozgrywkę ({latestSaveMeta.label})
                </div>
                <div className="text-base font-bold text-white">{latestSaveMeta.companyName}</div>
              </div>
              <button
                type="button"
                onClick={onContinueGame}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs md:text-sm transition-colors"
              >
                ▶ Wznów Teraz
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-[#0b0f17]/80 p-2.5 rounded-lg border border-[#243044]">
              <div>
                <div className="text-slate-400">Tryb</div>
                <div className="font-medium text-slate-200">
                  {MODE_LABELS[latestSaveMeta.mode] ?? latestSaveMeta.mode}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Data w grze</div>
                <div className="font-mono text-slate-200">{latestSaveMeta.gameDateLabel}</div>
              </div>
              <div>
                <div className="text-slate-400">Wycena netto</div>
                <div className="font-mono font-semibold text-amber-300">
                  {formatCompactMoney(latestSaveMeta.netWorth)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">
                  {latestSaveMeta.challengeTimeRemaining > 0 ? 'Pozostało' : 'Zapisano'}
                </div>
                <div className="font-mono text-emerald-300">
                  {latestSaveMeta.challengeTimeRemaining > 0
                    ? formatTimeRemaining(latestSaveMeta.challengeTimeRemaining)
                    : new Date(latestSaveMeta.savedAt).toLocaleTimeString('pl-PL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                </div>
              </div>
            </div>

            {saveSlots.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-slate-400 mr-1">Sloty:</span>
                {saveSlots.map((slot) => (
                  <button
                    key={slot.slotId}
                    type="button"
                    onClick={() => onLoadSlot(slot.slotId)}
                    className="px-2 py-1 rounded bg-[#0b0f17] hover:bg-[#1a2438] border border-[#243044] text-[11px] text-slate-300"
                    title={`${slot.companyName} · ${slot.gameDateLabel}`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Szybki powrót do ostatniego pokoju MP po odświeżeniu karty */}
        {lastMpSession && (
          <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/35 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <div className="font-semibold text-sky-300">
                🌐 Ostatnia sesja sieciowa: {lastMpSession.roomCode}
              </div>
              <div className="text-slate-400">
                {lastMpSession.companyName} ({lastMpSession.playerName})
              </div>
            </div>
            <button
              type="button"
              onClick={() => onQuickRejoinMp(lastMpSession.roomCode)}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
            >
              Otwórz Lobby →
            </button>
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onNewSinglePlayer}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm md:text-base transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-between"
          >
            <span>🏢 Nowa Gra (Single Player / AI)</span>
            <span className="text-xs font-normal opacity-90">Wyzwanie 1h / Endless</span>
          </button>

          <button
            type="button"
            onClick={onOpenMultiplayer}
            className="w-full py-3.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm md:text-base transition-all shadow-lg shadow-sky-950/50 flex items-center justify-between"
          >
            <span>🌐 Multiplayer Online (WebRTC / P2P)</span>
            <span className="text-xs font-normal opacity-90">1–8 Graczy + Koalicje</span>
          </button>

          <button
            type="button"
            onClick={onOpenWeeklyChallenge}
            className="w-full py-3 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/45 text-amber-200 font-bold text-sm transition-all flex items-center justify-between"
          >
            <span>🏆 Wyzwanie Tygodnia (Stały Seed Mapy)</span>
            <span className="text-xs font-normal text-amber-300">Ranking · +400 XP</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="py-2.5 px-3 rounded-xl bg-[#0b0f17] hover:bg-[#151c28] border border-[#243044] text-slate-200 text-xs md:text-sm font-semibold"
            >
              🏆 Tabela Wyników
            </button>
            <button
              type="button"
              onClick={onStartTutorial}
              className="py-2.5 px-3 rounded-xl bg-[#0b0f17] hover:bg-[#151c28] border border-sky-500/40 text-sky-200 text-xs md:text-sm font-semibold"
            >
              🎓 Przewodnik i Samouczek
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-[#1e293b] grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400">
          <div className="p-2 rounded bg-[#0b0f17]">
            <div className="font-bold text-slate-200">81 Struktur</div>
            <div>Synergie · Odpady · OZE</div>
          </div>
          <div className="p-2 rounded bg-[#0b0f17]">
            <div className="font-bold text-slate-200">6 Archetypów</div>
            <div>Cele Tajne · Scenariusze</div>
          </div>
          <div className="p-2 rounded bg-[#0b0f17]">
            <div className="font-bold text-slate-200">Do 8 Graczy</div>
            <div>Koalicje · Wykresy · SSE</div>
          </div>
        </div>
      </div>
    </div>
  );
};
