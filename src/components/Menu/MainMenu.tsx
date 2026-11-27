import React from 'react';
import { ACHIEVEMENTS, TITLES_CATALOG } from '../../data/achievements';
import {
  BATTLE_PASS_SEASON_1,
  computeBattlePassLevel,
  computePvPDivision,
} from '../../data/battlePass';
import { xpNeededForLevel } from '../../engine/profileManager';
import { useI18n } from '../../i18n/useI18n';
import type {
  LastMpSession,
  SaveSlotId,
  SaveSlotMeta,
  UserAccountProfile,
} from '../../engine/types';
import { formatCompactMoney, formatTimeRemaining } from '../../utils/formatters';
import { LanguageSwitcher } from '../HUD/LanguageSwitcher';
import { MCoinIcon } from '../HUD/MCoinIcon';

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
  onOpenShop: () => void;
  onOpenBattlePass: () => void;
  onOpenAuth: () => void;
  onContinueGame: () => void;
  onLoadSlot: (slotId: SaveSlotId) => void;
  onQuickRejoinMp: (roomCode: string) => void;
  onOpenLeaderboard: () => void;
  onStartTutorial: () => void;
}

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
  onOpenShop,
  onOpenBattlePass,
  onOpenAuth,
  onContinueGame,
  onLoadSlot,
  onQuickRejoinMp,
  onOpenLeaderboard,
  onStartTutorial,
}) => {
  const { lang, t } = useI18n();
  const titleObj = TITLES_CATALOG.find((x) => x.id === activeProfile.titleId) ?? TITLES_CATALOG[0];
  const nextXp = xpNeededForLevel(activeProfile.level);
  const xpPct = Math.min(100, Math.round((activeProfile.xp / Math.max(1, nextXp)) * 100));
  const division = computePvPDivision(
    activeProfile.pvpMatches,
    activeProfile.pvpWins,
    activeProfile.prestigeLevel
  );
  const bp = computeBattlePassLevel(activeProfile.battlePassXp);
  const claimableBp = BATTLE_PASS_SEASON_1.filter(
    (tier) => bp.level >= tier.level && !activeProfile.claimedPassLevels.includes(tier.level)
  ).length;
  const pinnedBadges = activeProfile.pinnedBadgeIds
    .map((bid) => ACHIEVEMENTS.find((a) => a.id === bid))
    .filter(Boolean);

  const MODE_LABELS: Record<string, string> =
    lang === 'en'
      ? {
          endless: 'Endless Campaign',
          challenge1h: '1h Challenge',
          mp_fast: 'Fast MP',
          mp_long: 'Long MP',
          weekly: 'Weekly Challenge',
        }
      : {
          endless: 'Kampania Endless',
          challenge1h: 'Wyzwanie 1h',
          mp_fast: 'Szybki MP',
          mp_long: 'Długi MP',
          weekly: 'Wyzwanie Tygodnia',
        };

  return (
    <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex items-center justify-center p-3 md:p-5 relative overflow-y-auto overflow-x-hidden">
      {/* Animowane tło izometryczne i linie fintech */}
      <div
        className="absolute -inset-8 opacity-15 pointer-events-none menu-grid-drift"
        style={{
          backgroundImage:
            'linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <svg
        viewBox="0 0 1440 420"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 w-full h-72 opacity-20 pointer-events-none"
      >
        <path
          d="M 0 360 L 140 310 L 290 330 L 470 250 L 650 275 L 820 175 L 1010 210 L 1180 110 L 1340 135 L 1440 75"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.5"
        />
        <path
          d="M 0 390 L 190 365 L 360 375 L 540 300 L 720 325 L 910 235 L 1100 260 L 1280 170 L 1440 185"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
        />
      </svg>

      <div className="relative z-10 w-full max-w-6xl space-y-3.5 my-auto">
        {/* Pasek górny z przełącznikiem PL | EN */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono uppercase tracking-wider">
            ● {t('menu.liveBadge')}
          </div>
          <LanguageSwitcher />
        </div>

        {/* Szeroki 2-kolumnowy Dashboard Desktopowy */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* LEWA KOLUMNA: Hero & Główne Akcje */}
          <div className="lg:col-span-7 rounded-2xl bg-[#111827]/95 border border-[#243044] p-5 md:p-6 shadow-2xl flex flex-col justify-between gap-4 backdrop-blur-md">
            <div className="space-y-3">
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                  MARKET <span className="text-amber-400">DOMINION</span>
                </h1>
                <p className="text-xs md:text-sm text-slate-400 mt-1">{t('menu.subtitle')}</p>
              </div>

              {/* Wznowienie ostatniej rozgrywki */}
              {hasSavedGame && latestSaveMeta && (
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#162235] to-[#111827] border border-amber-500/45 shadow-lg space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-mono text-amber-300 uppercase tracking-wider">
                        ⚡ {t('menu.resumeBanner', { label: latestSaveMeta.label })}
                      </div>
                      <div className="text-sm md:text-base font-bold text-white">
                        {latestSaveMeta.companyName}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onContinueGame}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs md:text-sm transition-colors"
                    >
                      {t('menu.resumeBtn')}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-[#0b0f17]/80 p-2 rounded-lg border border-[#243044]">
                    <div>
                      <div className="text-slate-400">{t('menu.mode')}</div>
                      <div className="font-semibold text-slate-200 truncate">
                        {MODE_LABELS[latestSaveMeta.mode] ?? latestSaveMeta.mode}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">{t('menu.gameDate')}</div>
                      <div className="font-mono text-slate-200">{latestSaveMeta.gameDateLabel}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">{t('menu.netWorth')}</div>
                      <div className="font-mono font-semibold text-amber-300">
                        {formatCompactMoney(latestSaveMeta.netWorth)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">
                        {latestSaveMeta.challengeTimeRemaining > 0
                          ? t('menu.remaining')
                          : t('menu.savedAt')}
                      </div>
                      <div className="font-mono text-emerald-300">
                        {latestSaveMeta.challengeTimeRemaining > 0
                          ? formatTimeRemaining(latestSaveMeta.challengeTimeRemaining)
                          : new Date(latestSaveMeta.savedAt).toLocaleTimeString(
                              lang === 'en' ? 'en-US' : 'pl-PL',
                              { hour: '2-digit', minute: '2-digit' }
                            )}
                      </div>
                    </div>
                  </div>

                  {saveSlots.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 mr-1">{t('menu.slots')}</span>
                      {saveSlots.map((slot) => (
                        <button
                          key={slot.slotId}
                          type="button"
                          onClick={() => onLoadSlot(slot.slotId)}
                          className="px-2 py-0.5 rounded bg-[#0b0f17] hover:bg-[#1a2438] border border-[#243044] text-[11px] text-slate-300"
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Ostatnia sesja sieciowa */}
              {lastMpSession && (
                <div className="p-2.5 rounded-xl bg-sky-950/30 border border-sky-500/35 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold text-sky-300">
                      {t('menu.lastMp', { code: lastMpSession.roomCode })}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {lastMpSession.companyName} ({lastMpSession.playerName})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onQuickRejoinMp(lastMpSession.roomCode)}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                  >
                    {t('menu.openLobby')}
                  </button>
                </div>
              )}
            </div>

            {/* Przyciski trybów rozgrywki */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onNewSinglePlayer}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm md:text-base transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-between"
              >
                <span>🏢 {t('menu.newSp')}</span>
                <span className="text-xs font-normal opacity-90">{t('menu.newSpSub')}</span>
              </button>

              <button
                type="button"
                onClick={onOpenMultiplayer}
                className="w-full py-3.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm md:text-base transition-all shadow-lg shadow-sky-950/50 flex items-center justify-between"
              >
                <span>🌐 {t('menu.multiplayer')}</span>
                <span className="text-xs font-normal opacity-90">{t('menu.multiplayerSub')}</span>
              </button>

              <button
                type="button"
                onClick={onOpenWeeklyChallenge}
                className="w-full py-3 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/45 text-amber-200 font-bold text-sm transition-all flex items-center justify-between"
              >
                <span>🏆 {t('menu.weeklyChallenge')}</span>
                <span className="text-xs font-normal text-amber-300">
                  {t('menu.weeklySub', { xp: 450 })}
                </span>
              </button>
            </div>
          </div>

          {/* PRAWA KOLUMNA: Centrum Prezesa & Progresja */}
          <div className="lg:col-span-5 rounded-2xl bg-[#111827]/95 border border-[#243044] p-5 md:p-6 shadow-2xl flex flex-col justify-between gap-4 backdrop-blur-md">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-amber-300 font-bold">
                  {t('menu.ceoCenter')}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="px-2.5 py-1 rounded-lg bg-[#151c28] hover:bg-[#1e293d] border border-amber-500/40 text-amber-200 text-xs font-semibold"
                  >
                    {t('menu.profileBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="px-2.5 py-1 rounded-lg bg-[#151c28] hover:bg-[#1e293d] border border-[#2d3b52] text-slate-300 text-xs font-semibold"
                  >
                    {activeProfile.isGuest ? t('menu.loginBtn') : t('menu.accountBtn')}
                  </button>
                </div>
              </div>

              {/* Karta Prezesa */}
              <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2.5 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#151c28] border border-amber-500/40 flex items-center justify-center text-2xl shrink-0">
                    {activeProfile.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-white text-sm truncate">
                        {activeProfile.prestigeLevel > 0
                          ? '★'.repeat(Math.min(3, activeProfile.prestigeLevel)) + ' '
                          : ''}
                        {activeProfile.nick}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono text-[10px]">
                        {t('common.lvl')} {activeProfile.level}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${division.badgeClass}`}
                      >
                        {division.icon} {division.label}
                      </span>
                      {activeProfile.isGuest && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                          {t('common.guest')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-sky-300 truncate mt-0.5">
                      {titleObj.label} ·{' '}
                      {t('menu.badgesCount', {
                        count: activeProfile.unlockedAchievements.length,
                        total: ACHIEVEMENTS.length,
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>XP {activeProfile.xp}</span>
                      <span className="text-emerald-300">{xpPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#151c28] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400"
                        style={{ width: `${xpPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-400/50 text-amber-200 font-mono text-xs font-bold flex items-center gap-1 shrink-0">
                    <MCoinIcon size={14} />
                    <span>{activeProfile.mCoins} M</span>
                  </div>
                </div>

                {pinnedBadges.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-[#1b2434]">
                    {pinnedBadges.map(
                      (b) =>
                        b && (
                          <span
                            key={b.id}
                            className="px-2 py-0.5 rounded bg-[#151c28] border border-amber-500/35 text-[10px] text-amber-200"
                          >
                            {b.badgeEmoji} {b.badgeLabel}
                          </span>
                        )
                    )}
                  </div>
                )}
              </div>

              {/* Siatka 2x2: Sklep, Karnet, Tabela Wyników, Samouczek */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onOpenShop}
                  className="p-3 rounded-xl bg-amber-950/35 hover:bg-amber-900/45 border border-amber-400/50 text-amber-200 text-xs font-semibold flex flex-col items-start gap-1 text-left transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    <MCoinIcon size={15} />
                    <span>{t('menu.shopBtn')}</span>
                  </span>
                  <span className="text-[11px] font-mono text-amber-300">
                    {activeProfile.mCoins} M
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onOpenBattlePass}
                  className="relative p-3 rounded-xl bg-sky-950/35 hover:bg-sky-900/45 border border-sky-400/50 text-sky-200 text-xs font-semibold flex flex-col items-start gap-1 text-left transition-colors"
                >
                  <span className="font-bold">🎖️ {t('menu.battlePassBtn', { lvl: bp.level })}</span>
                  <span className="text-[10px] font-mono text-sky-300">
                    {bp.intoLevelXp}/{bp.neededPerLevel} BP XP
                  </span>
                  {claimableBp > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-mono text-[10px] font-bold animate-pulse">
                      +{claimableBp}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="p-3 rounded-xl bg-[#0b0f17] hover:bg-[#151c28] border border-[#243044] text-slate-200 text-xs font-semibold text-left transition-colors"
                >
                  {t('menu.leaderboardBtn')}
                </button>

                <button
                  type="button"
                  onClick={onStartTutorial}
                  className="p-3 rounded-xl bg-[#0b0f17] hover:bg-[#151c28] border border-sky-500/40 text-sky-200 text-xs font-semibold text-left transition-colors"
                >
                  {t('menu.tutorialBtn')}
                </button>
              </div>
            </div>

            {/* Skrót statystyk na dole prawej kolumny */}
            <div className="pt-2.5 border-t border-[#1e293b] grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400">
              <div className="p-2 rounded bg-[#0b0f17]">
                <div className="font-bold text-slate-200">{t('menu.statStructures')}</div>
                <div className="text-[10px] truncate">{t('menu.statStructuresSub')}</div>
              </div>
              <div className="p-2 rounded bg-[#0b0f17]">
                <div className="font-bold text-slate-200">{t('menu.statBestNetWorth')}</div>
                <div className="font-mono text-amber-300 text-[10px]">
                  {formatCompactMoney(activeProfile.records.highestNetWorth)}
                </div>
              </div>
              <div className="p-2 rounded bg-[#0b0f17]">
                <div className="font-bold text-slate-200">{t('menu.statWinRate')}</div>
                <div className="font-mono text-emerald-300 text-[10px]">
                  {activeProfile.records.matchesWon} / {activeProfile.records.matchesPlayed}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
