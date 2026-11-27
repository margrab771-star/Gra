import React, { useEffect, useState } from 'react';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENTS,
  FRAME_COSMETICS,
  HQ_COSMETICS,
  PROFILE_AVATARS,
  TITLES_CATALOG,
} from '../../data/achievements';
import { SCENARIO_DEFINITIONS } from '../../config/gameConfig';
import {
  PRESTIGE_REQUIRED_ACCOUNT_LEVEL,
  computeBattlePassLevel,
  computePvPDivision,
} from '../../data/battlePass';
import { UI_THEME_META } from '../../data/shopCatalog';
import {
  activatePrestige,
  exportProfileTransferCode,
  importProfileTransferCode,
  updateProfileCosmetics,
  xpNeededForLevel,
} from '../../engine/profileManager';
import type { AchievementCategory, HQVariantId, UiThemeId, UserAccountProfile } from '../../engine/types';
import { formatCompactMoney } from '../../utils/formatters';
import {
  localizeAchievement,
  localizeAchievementCategory,
  localizeCosmetic,
  localizePvPDivisionLabel,
  localizeScenario,
  localizeTitle,
  localizeUiTheme,
} from '../../i18n/dataTranslations';
import { useI18n } from '../../i18n/useI18n';
import { LanguageSwitcher } from '../HUD/LanguageSwitcher';
import { MCoinIcon } from '../HUD/MCoinIcon';

interface ProfileModalProps {
  profile: UserAccountProfile;
  onUpdateProfile: (next: UserAccountProfile) => void;
  onOpenAuth: () => void;
  onOpenShop?: () => void;
  onOpenBattlePass?: () => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  onUpdateProfile,
  onOpenAuth,
  onOpenShop,
  onOpenBattlePass,
  onClose,
}) => {
  const { lang, t } = useI18n();
  const [tab, setTab] = useState<'card' | 'achievements' | 'records' | 'transfer'>('card');
  const [achCat, setAchCat] = useState<AchievementCategory | 'all'>('all');
  const [copiedCode, setCopiedCode] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [prestigeMsg, setPrestigeMsg] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rawTitle = TITLES_CATALOG.find((titleItem) => titleItem.id === profile.titleId);
  const curTitle = rawTitle
    ? localizeTitle(rawTitle, lang).label
    : lang === 'en'
      ? 'Market Pioneer'
      : 'Pionier Rynku';
  const division = computePvPDivision(profile.pvpMatches, profile.pvpWins, profile.prestigeLevel);
  const divLabel = localizePvPDivisionLabel(division.id, division.label, lang);
  const bp = computeBattlePassLevel(profile.battlePassXp);
  const curFrameCls =
    profile.frameId === 'frame_gold'
      ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.2)]'
      : profile.frameId === 'frame_emerald'
        ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
        : profile.frameId === 'frame_crimson'
          ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.25)]'
          : profile.frameId === 'frame_neon_pulse'
            ? 'frame-anim-neon'
            : profile.frameId === 'frame_golden_aura'
              ? 'frame-anim-gold'
              : profile.frameId === 'frame_crimson_matrix'
                ? 'frame-anim-crimson'
                : 'border-[#334155]';

  let xpIntoLevel = profile.xp;
  for (let l = 1; l < profile.level; l++) {
    xpIntoLevel = Math.max(0, xpIntoLevel - xpNeededForLevel(l));
  }
  const xpNext = xpNeededForLevel(profile.level);
  const xpPct = Math.min(100, Math.round((xpIntoLevel / Math.max(1, xpNext)) * 100));

  const earnedBadges = ACHIEVEMENTS.filter((a) => profile.unlockedAchievements.includes(a.id));

  const togglePinnedBadge = (achId: string) => {
    const exists = profile.pinnedBadgeIds.includes(achId);
    let nextPinned: string[];
    if (exists) {
      nextPinned = profile.pinnedBadgeIds.filter((x) => x !== achId);
    } else if (profile.pinnedBadgeIds.length < 3) {
      nextPinned = [...profile.pinnedBadgeIds, achId];
    } else {
      nextPinned = [...profile.pinnedBadgeIds.slice(1), achId];
    }
    onUpdateProfile(updateProfileCosmetics(profile, { pinnedBadgeIds: nextPinned }));
  };

  const transferCode = exportProfileTransferCode(profile);
  const filteredAch =
    achCat === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => a.category === achCat);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden">
        {/* Nagłówek */}
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl">{profile.avatar}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base md:text-lg font-bold text-white truncate">
                  {profile.prestigeLevel > 0 ? '★'.repeat(Math.min(3, profile.prestigeLevel)) + ' ' : ''}
                  {profile.nick}
                </h2>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 font-mono text-[11px] text-amber-300">
                  {t('common.level')} {profile.level} · {profile.xp} XP
                </span>
                <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${division.badgeClass}`}>
                  {division.icon} {divLabel}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-950/45 border border-amber-400/45 text-amber-200 font-mono text-[11px] font-bold flex items-center gap-1">
                  <MCoinIcon size={13} />
                  {profile.mCoins} M
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                {lang === 'en' ? 'Title:' : 'Tytuł:'}{' '}
                <span className="text-sky-300 font-medium">{curTitle}</span> ·{' '}
                {lang === 'en' ? 'Achievements unlocked:' : 'Odblokowane osiągnięcia:'}{' '}
                <strong className="text-emerald-300">
                  {profile.unlockedAchievements.length}/{ACHIEVEMENTS.length}
                </strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <LanguageSwitcher compact />
            {onOpenShop && (
              <button
                type="button"
                onClick={onOpenShop}
                className="px-2.5 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-400/50 text-amber-200 text-xs font-semibold flex items-center gap-1.5"
              >
                <MCoinIcon size={14} />
                <span>{lang === 'en' ? 'Shop' : 'Sklep'}</span>
              </button>
            )}
            {onOpenBattlePass && (
              <button
                type="button"
                onClick={onOpenBattlePass}
                className="px-2.5 py-1.5 rounded-lg bg-[#182235] hover:bg-[#22314a] border border-sky-500/40 text-sky-200 text-xs font-semibold"
              >
                🎖️ {lang === 'en' ? 'Pass' : 'Karnet'} ({bp.level}/30)
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-3 py-1.5 rounded-lg bg-[#182235] hover:bg-[#22314a] border border-sky-500/40 text-sky-300 text-xs font-semibold"
            >
              🔄 {lang === 'en' ? 'Switch Account' : 'Zmień Konto'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#1c2434] text-slate-300 hover:text-white flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Zakładki */}
        <div className="px-4 py-2 border-b border-[#243044] flex flex-wrap gap-1.5 text-xs">
          {[
            { id: 'card', label: `🪪 ${t('prof.tabOverview')}` },
            {
              id: 'achievements',
              label: `🏆 ${t('prof.tabAchievements', {
                done: profile.unlockedAchievements.length,
                total: ACHIEVEMENTS.length,
              })}`,
            },
            { id: 'records', label: `📜 ${t('prof.tabHistory')}` },
            { id: 'transfer', label: `📦 ${t('prof.tabAccount')}` },
          ].map((tabOpt) => (
            <button
              key={tabOpt.id}
              type="button"
              onClick={() => setTab(tabOpt.id as typeof tab)}
              className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
                tab === tabOpt.id
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
              }`}
            >
              {tabOpt.label}
            </button>
          ))}
        </div>

        {/* Zawartość */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 text-xs">
          {tab === 'card' && (
            <div className="space-y-4">
              {/* Podgląd Karty Prezesa widocznej w Lobby MP */}
              <div className={`p-4 rounded-xl bg-gradient-to-br from-[#141d2e] to-[#0b0f17] border-2 ${curFrameCls} space-y-2.5`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-12 h-12 rounded-xl bg-[#0b0f17] border border-[#243044] text-2xl flex items-center justify-center">
                      {profile.avatar}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{profile.nick}</span>
                        <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px]">
                          LVL {profile.level}
                        </span>
                      </div>
                      <div className="text-xs text-amber-300 font-semibold">{curTitle}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.pinnedBadgeIds.length === 0 ? (
                      <span className="text-[11px] text-slate-500 italic">
                        {lang === 'en' ? 'No pinned badges' : 'Brak przypiętych odznak'}
                      </span>
                    ) : (
                      profile.pinnedBadgeIds.map((bid) => {
                        const rawAch = ACHIEVEMENTS.find((a) => a.id === bid);
                        if (!rawAch) return null;
                        const ach = localizeAchievement(rawAch, lang);
                        return (
                          <span
                            key={bid}
                            className="px-2 py-1 rounded-lg bg-[#182235] border border-amber-500/40 text-[11px] text-amber-200 flex items-center gap-1"
                          >
                            <span>{ach.badgeEmoji}</span>
                            <span>{ach.badgeLabel}</span>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>
                      {lang === 'en'
                        ? `Level Progress ${profile.level} → ${profile.level + 1}`
                        : `Postęp Poziomu ${profile.level} → ${profile.level + 1}`}
                    </span>
                    <span className="font-mono text-emerald-300">{xpIntoLevel} / {xpNext} XP ({xpPct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#0b0f17] border border-[#243044] overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${xpPct}%` }} />
                  </div>
                </div>
              </div>

              {/* Prestiż Konta + Motywy Kolorystyczne UI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#0b0f17] border border-amber-500/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-amber-300">
                      ★ {t('prof.prestigeTitle')} ({t('common.level')} {profile.level} / {PRESTIGE_REQUIRED_ACCOUNT_LEVEL})
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-200 font-mono text-[10px]">
                      {lang === 'en' ? `Prestige #${profile.prestigeLevel}` : `Prestiż #${profile.prestigeLevel}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {lang === 'en' ? (
                      <>
                        Upon reaching Level {PRESTIGE_REQUIRED_ACCOUNT_LEVEL}, reset to Level 1 (keeping all achievements, badges, Shop unlocks, Pass & M-Coins) to claim a permanent Golden Star ★,{' '}
                        {profile.prestigeLevel >= 1 ? 'Platinum' : 'Golden'} plot borders on the 2.5D map, plus +250 M!
                      </>
                    ) : (
                      <>
                        Po osiągnięciu Poziomu {PRESTIGE_REQUIRED_ACCOUNT_LEVEL} zresetujesz poziom na 1 (zachowując wszystkie osiągnięcia, odznaki, Sklep, Karnet i Monety M), zdobywając stałą Złotą Gwiazdę ★,{' '}
                        {profile.prestigeLevel >= 1 ? 'Platynowe' : 'Złote'} ramki granic swoich działek na mapie 2.5D oraz +250 M!
                      </>
                    )}
                  </p>
                  {prestigeMsg && (
                    <div className="p-2 rounded bg-emerald-950/40 border border-emerald-400/50 text-emerald-200 text-[11px]">
                      {prestigeMsg}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={profile.level < PRESTIGE_REQUIRED_ACCOUNT_LEVEL}
                    onClick={() => {
                      const res = activatePrestige(profile);
                      if (res.ok) {
                        onUpdateProfile(res.profile);
                        setPrestigeMsg(
                          lang === 'en'
                            ? `★ Prestige #${res.profile.prestigeLevel} activated! Claimed Golden Star, plot borders & +250 M!`
                            : res.message ?? 'Prestiż aktywowany!'
                        );
                      }
                    }}
                    className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-[#151c28] disabled:text-slate-500 text-slate-950 font-bold text-xs"
                  >
                    {profile.level >= PRESTIGE_REQUIRED_ACCOUNT_LEVEL
                      ? t('prof.prestigeBtn')
                      : t('prof.prestigeLocked', { lvl: profile.level })}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2">
                  <div className="font-semibold text-slate-200">
                    🎨 {t('prof.themeLabel')}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(UI_THEME_META) as UiThemeId[]).map((tId) => {
                      const meta = localizeUiTheme(UI_THEME_META[tId], lang);
                      const unlocked = profile.unlockedCosmetics.includes(tId);
                      const active = profile.uiThemeId === tId;
                      return (
                        <button
                          key={tId}
                          type="button"
                          disabled={!unlocked}
                          onClick={() => onUpdateProfile(updateProfileCosmetics(profile, { uiThemeId: tId }))}
                          className={`p-2 rounded-lg border text-left transition-colors ${
                            active
                              ? 'bg-sky-500/20 border-sky-400 text-white'
                              : unlocked
                                ? 'bg-[#151c28] border-[#243044] text-slate-200'
                                : 'bg-[#0b0f17] border-[#1e293b] text-slate-500 opacity-65 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 font-semibold text-[11px]">
                            <span className="truncate">{meta.badge} {meta.label}</span>
                            {!unlocked && <span>🔒</span>}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {meta.previewColors.map((hex) => (
                              <span
                                key={hex}
                                className="w-3.5 h-2 rounded-sm border border-white/15"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Wybór wariantu HQ 2.5D (Zero Pay-to-Win) */}
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-200 uppercase tracking-wider">
                  🏛️ {t('prof.hqSkinLabel')} (0% Pay-to-Win)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {HQ_COSMETICS.map((rawHq) => {
                    const hq = localizeCosmetic(rawHq, lang);
                    const unlocked = profile.unlockedCosmetics.includes(hq.id);
                    const active = profile.hqVariant === hq.hqVariantId;
                    return (
                      <button
                        key={hq.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() =>
                          onUpdateProfile(
                            updateProfileCosmetics(profile, { hqVariant: hq.hqVariantId as HQVariantId })
                          )
                        }
                        className={`p-3 rounded-xl border text-left transition-all ${
                          active
                            ? 'bg-amber-500/15 border-amber-400 text-white'
                            : unlocked
                              ? 'bg-[#0b0f17] hover:bg-[#162033] border-[#243044] text-slate-200'
                              : 'bg-[#0b0f17]/60 border-[#1e293b] text-slate-500 opacity-65 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>{hq.preview} {hq.name}</span>
                          <span className="text-[10px] font-mono">
                            {active
                              ? lang === 'en'
                                ? '✓ ACTIVE'
                                : '✓ AKTYWNY'
                              : unlocked
                                ? t('common.unlocked')
                                : `🔒 ${t('common.locked')}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{hq.description}</p>
                        {!unlocked && (
                          <div className="text-[10px] text-amber-300/80 mt-1">
                            {lang === 'en' ? 'Requirement:' : 'Wymaganie:'} {hq.unlockHint}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Wybór Tytułu, Ramki i Avatara */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2">
                  <div className="font-semibold text-slate-300">{t('prof.titleLabel')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TITLES_CATALOG.map((rawTitleItem) => {
                      const titleItem = localizeTitle(rawTitleItem, lang);
                      const unlocked = profile.unlockedCosmetics.includes(titleItem.id);
                      const active = profile.titleId === titleItem.id;
                      return (
                        <button
                          key={titleItem.id}
                          type="button"
                          disabled={!unlocked}
                          title={titleItem.unlockHint}
                          onClick={() => onUpdateProfile(updateProfileCosmetics(profile, { titleId: titleItem.id }))}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] ${
                            active
                              ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold'
                              : unlocked
                                ? 'bg-[#151c28] border-[#243044] text-slate-300'
                                : 'bg-[#0b0f17] border-[#1e293b] text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          {unlocked ? titleItem.label : `🔒 ${titleItem.label}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2">
                  <div className="font-semibold text-slate-300">{t('prof.frameLabel')} & {t('prof.avatarLabel')}</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {FRAME_COSMETICS.map((rawFr) => {
                      const fr = localizeCosmetic(rawFr, lang);
                      const unlocked = profile.unlockedCosmetics.includes(fr.id);
                      const active = profile.frameId === fr.id;
                      return (
                        <button
                          key={fr.id}
                          type="button"
                          disabled={!unlocked}
                          title={fr.unlockHint}
                          onClick={() => onUpdateProfile(updateProfileCosmetics(profile, { frameId: fr.id }))}
                          className={`px-2 py-1 rounded border text-[11px] ${
                            active
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                              : unlocked
                                ? 'bg-[#151c28] border-[#243044] text-slate-300'
                                : 'bg-[#0b0f17] border-[#1e293b] text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          {fr.preview} {fr.name}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {PROFILE_AVATARS.map((av) => (
                      <button
                        key={av}
                        type="button"
                        onClick={() => onUpdateProfile(updateProfileCosmetics(profile, { avatar: av }))}
                        className={`w-7 h-7 rounded border ${
                          profile.avatar === av
                            ? 'bg-emerald-500/25 border-emerald-400'
                            : 'bg-[#151c28] border-[#243044]'
                        }`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Przypinanie maks. 3 Odznak */}
              <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2">
                <div className="font-semibold text-slate-300">
                  {t('prof.pinnedBadges', { count: profile.pinnedBadgeIds.length })}
                </div>
                {earnedBadges.length === 0 ? (
                  <p className="text-slate-500 italic">
                    {lang === 'en'
                      ? 'Earn achievements in Single Player or Multiplayer matches to unlock badges!'
                      : 'Zdobywaj osiągnięcia w grach Single Player lub Multiplayer, aby odblokować odznaki!'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {earnedBadges.map((rawAch) => {
                      const ach = localizeAchievement(rawAch, lang);
                      const pinned = profile.pinnedBadgeIds.includes(ach.id);
                      return (
                        <button
                          key={ach.id}
                          type="button"
                          onClick={() => togglePinnedBadge(ach.id)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] ${
                            pinned
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                              : 'bg-[#151c28] border-[#243044] text-slate-300'
                          }`}
                        >
                          {ach.badgeEmoji} {ach.badgeLabel} {pinned && '✓'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'achievements' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setAchCat('all')}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${
                    achCat === 'all'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                      : 'bg-[#0b0f17] border-[#243044] text-slate-400'
                  }`}
                >
                  {lang === 'en' ? `All (${ACHIEVEMENTS.length})` : `Wszystkie (${ACHIEVEMENTS.length})`}
                </button>
                {ACHIEVEMENT_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setAchCat(c.key)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${
                      achCat === c.key
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                        : 'bg-[#0b0f17] border-[#243044] text-slate-400'
                    }`}
                  >
                    {c.icon} {localizeAchievementCategory(c.key, c.label, lang)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredAch.map((rawAch) => {
                  const ach = localizeAchievement(rawAch, lang);
                  const unlocked = profile.unlockedAchievements.includes(ach.id);
                  const titleObj = ach.unlockTitle
                    ? TITLES_CATALOG.find((titleOpt) => titleOpt.id === ach.unlockTitle)
                    : undefined;
                  const locTitleLabel = titleObj ? localizeTitle(titleObj, lang).label : '';
                  return (
                    <div
                      key={ach.id}
                      className={`p-3 rounded-xl border ${
                        unlocked
                          ? 'bg-emerald-950/20 border-emerald-500/45'
                          : 'bg-[#0b0f17] border-[#243044] opacity-80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 font-bold text-slate-100">
                          <span className="text-lg">{ach.badgeEmoji}</span>
                          <span>{ach.name}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                            unlocked ? 'bg-emerald-500/25 text-emerald-300' : 'bg-[#151c28] text-slate-400'
                          }`}
                        >
                          {unlocked ? (lang === 'en' ? '✓ UNLOCKED' : '✓ ZDOBYTE') : `+${ach.xpReward} XP`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{ach.description}</p>
                      {(ach.unlockCosmetic || ach.unlockTitle) && (
                        <div className="mt-1.5 text-[10px] text-amber-300">
                          🎁 {lang === 'en' ? 'Reward:' : 'Nagroda:'}{' '}
                          {ach.unlockCosmetic
                            ? ach.unlockCosmetic.label
                            : `${lang === 'en' ? 'Title' : 'Tytuł'} "${locTitleLabel}"`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'records' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044]">
                  <div className="text-slate-400">{t('prof.bestNetWorth')}</div>
                  <div className="font-mono font-bold text-base text-amber-300">
                    {formatCompactMoney(profile.records.highestNetWorth)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044]">
                  <div className="text-slate-400">{t('prof.fastestWin')}</div>
                  <div className="font-mono font-bold text-base text-sky-300">
                    {profile.records.fastestDominanceTicks !== null
                      ? t('prof.ticksUnit', { ticks: profile.records.fastestDominanceTicks })
                      : '—'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044]">
                  <div className="text-slate-400">{lang === 'en' ? 'Longest Win Streak' : 'Najdłuższa Seria Wygranych'}</div>
                  <div className="font-mono font-bold text-base text-emerald-300">
                    {profile.records.longestWinStreak} ({lang === 'en' ? 'current' : 'obecna'}: {profile.records.currentWinStreak})
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044]">
                  <div className="text-slate-400">{lang === 'en' ? 'Matches & Goals' : 'Bilans Meczów & Cele'}</div>
                  <div className="font-mono font-bold text-base text-slate-100">
                    {profile.records.matchesWon}/{profile.records.matchesPlayed} · 🎯{profile.records.secretGoalsCompleted}
                  </div>
                </div>
              </div>

              {profile.records.weeklyBestScore && (
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/40 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-amber-300">
                      🏆 {lang === 'en' ? 'Weekly Challenge Best' : 'Rekord Wyzwania Tygodnia'} ({profile.records.weeklyBestScore.weekKey})
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {lang === 'en' ? 'Date:' : 'Data:'} {profile.records.weeklyBestScore.date}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-emerald-300">
                      {formatCompactMoney(profile.records.weeklyBestScore.netWorth)}
                    </div>
                    <div className="text-[11px] text-slate-300">
                      {t('prof.ticksUnit', { ticks: profile.records.weeklyBestScore.ticks })}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <h3 className="font-semibold text-slate-300">
                  {lang === 'en' ? 'Last 20 Matches History' : 'Historia ostatnich 20 meczów'}
                </h3>
                {profile.matchHistory.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#243044] text-slate-500 text-center">
                    {t('prof.historyEmpty')}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {profile.matchHistory.map((m) => {
                      const rawScen = SCENARIO_DEFINITIONS.find((s) => s.id === m.scenario);
                      const scenName = rawScen ? localizeScenario(rawScen, lang).name : m.scenario;
                      return (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-xl bg-[#0b0f17] border border-[#243044] flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-slate-100">
                              {m.won
                                ? lang === 'en'
                                  ? '🏆 VICTORY'
                                  : '🏆 ZWYCIĘSTWO'
                                : lang === 'en'
                                  ? '📊 MATCH ENDED'
                                  : '📊 KONIEC MECZU'}{' '}
                              · {lang === 'en' ? 'Rank' : 'Miejsce'} #{m.rank}/{m.totalPlayers}
                              {m.isWeekly ? ` · ${lang === 'en' ? 'Weekly' : 'Wyzwanie'} ${m.weekKey}` : ''}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {m.date} · {m.mode} · {scenName} ({m.difficulty})
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <div className="text-amber-300 font-bold">{formatCompactMoney(m.netWorth)}</div>
                            <div className="text-[11px] text-emerald-400">+{m.xpEarned} XP · {m.durationTicks} T</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'transfer' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2.5">
                <h3 className="font-bold text-white">📤 {t('prof.exportTitle')}</h3>
                <p className="text-slate-400">{t('prof.exportDesc')}</p>
                <textarea
                  readOnly
                  rows={4}
                  value={transferCode}
                  className="w-full px-3 py-2 rounded-lg bg-[#151c28] border border-[#243044] text-emerald-300 font-mono text-[10px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(transferCode);
                    setCopiedCode(true);
                    window.setTimeout(() => setCopiedCode(false), 2500);
                  }}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                  {copiedCode ? t('prof.copiedCode') : t('prof.copyCode')}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2.5">
                <h3 className="font-bold text-white">📥 {t('auth.importSubmit')}</h3>
                <textarea
                  rows={3}
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  placeholder={t('auth.transferPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg bg-[#151c28] border border-[#243044] text-amber-200 font-mono text-[10px]"
                />
                {importMsg && <div className="text-amber-300">{importMsg}</div>}
                <button
                  type="button"
                  onClick={() => {
                    const res = importProfileTransferCode(importInput);
                    if (res.ok && res.profile) {
                      onUpdateProfile(res.profile);
                      setImportMsg(
                        lang === 'en'
                          ? `✅ Imported account ${res.profile.nick} (Lvl ${res.profile.level})!`
                          : `✅ Zaimportowano konto ${res.profile.nick} (Poz. ${res.profile.level})!`
                      );
                      setImportInput('');
                    } else {
                      setImportMsg(`⚠️ ${res.error}`);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {t('auth.importSubmit')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
