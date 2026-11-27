import React, { useMemo, useState } from 'react';
import type { AchievementDefinition } from '../../data/achievements';
import { getArchetypeDefinition } from '../../data/archetypes';
import { computeMatchFunAwards } from '../../engine/MatchStatsTracker';
import type { GameState, Player, PlayerQuestProgress } from '../../engine/types';
import {
  localizeAiStrategy,
  localizeArchetype,
  localizeMatchFunAward,
} from '../../i18n/dataTranslations';
import { useI18n } from '../../i18n/useI18n';
import { formatCompactMoney, formatMoney } from '../../utils/formatters';
import { MCoinIcon } from '../HUD/MCoinIcon';

interface VictoryModalProps {
  gameState: GameState;
  currentPlayer: Player;
  rewardSummary?: {
    xpEarned: number;
    mCoinsEarned?: number;
    bpXpEarned?: number;
    rewardMultiplier?: number;
    tooShortForCoins?: boolean;
    completedQuests?: PlayerQuestProgress[];
    newlyUnlocked: AchievementDefinition[];
  } | null;
  onContinueEndless: () => void;
  onOpenLeaderboard: () => void;
  onOpenProfile?: () => void;
  onExitToMenu: () => void;
}

type ChartMetric = 'netWorth' | 'cash' | 'incomePerTick' | 'influence' | 'approval';

export const VictoryModal: React.FC<VictoryModalProps> = ({
  gameState,
  currentPlayer,
  rewardSummary,
  onContinueEndless,
  onOpenLeaderboard,
  onOpenProfile,
  onExitToMenu,
}) => {
  const { lang, t } = useI18n();
  const [metric, setMetric] = useState<ChartMetric>('netWorth');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const metricOptions: { key: ChartMetric; label: string; unit: 'money' | 'pts' | 'pct' }[] = [
    { key: 'netWorth', label: `📈 ${t('vic.metricNetWorth')}`, unit: 'money' },
    { key: 'cash', label: `💵 ${t('vic.metricCash')}`, unit: 'money' },
    { key: 'incomePerTick', label: `⚡ ${t('vic.metricIncome')}`, unit: 'money' },
    { key: 'influence', label: `🏛️ ${t('vic.metricInfluence')}`, unit: 'pts' },
    { key: 'approval', label: `❤️ ${t('vic.metricApproval')}`, unit: 'pct' },
  ];

  const formatMetricVal = (val: number, unit: 'money' | 'pts' | 'pct'): string => {
    if (unit === 'money') return formatCompactMoney(val);
    if (unit === 'pct') return `${Math.round(val)}%`;
    return `${Math.round(val)} ${lang === 'en' ? 'pts' : 'pkt'}`;
  };

  const winner = gameState.winnerId
    ? gameState.players.find((p) => p.id === gameState.winnerId)
    : null;
  const winningCoalition = gameState.winningCoalitionId
    ? (gameState.coalitions ?? []).find((c) => c.id === gameState.winningCoalitionId)
    : null;
  const isLocalCoalitionWin = Boolean(
    winningCoalition && winningCoalition.memberIds.includes(currentPlayer.id)
  );
  const isChallengeDone = gameState.challengeCompleted && !winner;
  const domThreshold =
    gameState.settings.dominationThreshold ?? gameState.monopolyThreshold ?? 75;

  const funAwards = useMemo(
    () => computeMatchFunAwards(gameState).map((aw) => localizeMatchFunAward(aw, lang)),
    [gameState, lang]
  );
  const samples = useMemo(() => gameState.matchStatsHistory ?? [], [gameState.matchStatsHistory]);
  const activeMetricDef = metricOptions.find((m) => m.key === metric) ?? metricOptions[0];

  const chartGeometry = useMemo(() => {
    const width = 620;
    const height = 190;
    const padL = 54;
    const padR = 16;
    const padT = 14;
    const padB = 24;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    if (samples.length === 0) {
      return { width, height, padL, padR, padT, padB, plotW, plotH, minVal: 0, maxVal: 100, lines: [] };
    }

    let minVal = 0;
    let maxVal = metric === 'approval' ? 100 : 10;
    for (const s of samples) {
      for (const p of gameState.players) {
        const val = s.players[p.id]?.[metric] ?? 0;
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }
    const span = Math.max(1, maxVal - minVal);
    const lines = gameState.players.map((p) => {
      const pts = samples.map((s, idx) => {
        const x = padL + (samples.length <= 1 ? plotW / 2 : (idx / (samples.length - 1)) * plotW);
        const raw = s.players[p.id]?.[metric] ?? 0;
        const y = padT + plotH - ((raw - minVal) / span) * plotH;
        return { x, y, raw };
      });
      const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
      return { player: p, pts, d, lastVal: pts[pts.length - 1]?.raw ?? 0 };
    });

    return { width, height, padL, padR, padT, padB, plotW, plotH, minVal, maxVal, lines };
  }, [samples, gameState.players, metric]);

  const inspectSampleIdx =
    hoverIdx !== null && hoverIdx >= 0 && hoverIdx < samples.length
      ? hoverIdx
      : samples.length > 0
        ? samples.length - 1
        : null;
  const inspectedSample = inspectSampleIdx !== null ? samples[inspectSampleIdx] : null;
  const myArch = localizeArchetype(getArchetypeDefinition(currentPlayer.archetype), lang);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 overflow-y-auto">
      <div className="w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-2xl bg-[#111827] border border-amber-400/60 p-5 md:p-6 shadow-2xl space-y-4">
        <div className="text-center space-y-1.5">
          <div className="text-3xl">{winningCoalition ? '🤝👑' : winner ? '👑' : '⏱️'}</div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white">
            {winningCoalition
              ? isLocalCoalitionWin
                ? lang === 'en'
                  ? `COALITION VICTORY [${winningCoalition.tag}]!`
                  : `ZWYCIĘSTWO KOALICJI [${winningCoalition.tag}]!`
                : lang === 'en'
                  ? `Match Over — Winning Coalition: [${winningCoalition.tag}] ${winningCoalition.name}`
                  : `Koniec Partii — Zwycięska Koalicja: [${winningCoalition.tag}] ${winningCoalition.name}`
              : winner
                ? winner.id === currentPlayer.id
                  ? lang === 'en'
                    ? 'MARKET DOMINATION ACHIEVED!'
                    : 'DOMINACJA RYNKOWA OSIĄGNIĘTA!'
                  : lang === 'en'
                    ? `Match Over — Winner: ${winner.companyName}`
                    : `Koniec Partii — Zwycięzca: ${winner.companyName}`
                : lang === 'en'
                  ? 'Challenge Completed!'
                  : 'Wyzwanie Zakończone!'}
          </h2>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-2xl mx-auto">
            {gameState.victoryReason ??
              (lang === 'en'
                ? 'Your net worth score and dominant strategy have been recorded in your Profile and Leaderboards!'
                : 'Twój wynik wyceny netto oraz wypracowana strategia zostały zapisane w Twoim Profilu i Tabeli Wyników!')}
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0b0f17] border border-amber-500/35 text-[11px] font-mono text-amber-300">
            <span>
              🎯 {lang === 'en' ? 'Domination threshold this match:' : 'Próg dominacji w tym meczu:'} {domThreshold}%
            </span>
            <span>·</span>
            <span>
              {gameState.settings.victoryMode === 'coalition'
                ? lang === 'en'
                  ? '🤝 Coalition Domination'
                  : '🤝 Dominacja Koalicji'
                : lang === 'en'
                  ? '👑 Solo Domination'
                  : '👑 Dominacja Solowa'}
            </span>
          </div>
        </div>

        {/* Nagroda XP, Monet M, Karnetu Sezon 1 i Odblokowane Osiągnięcia */}
        {rewardSummary &&
          (rewardSummary.xpEarned > 0 ||
            (rewardSummary.mCoinsEarned ?? 0) > 0 ||
            rewardSummary.newlyUnlocked.length > 0 ||
            (rewardSummary.completedQuests?.length ?? 0) > 0) && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-[#131d2f] to-emerald-950/35 border border-amber-500/40 space-y-2.5 text-left">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
                  <span className="text-amber-300">✨ +{rewardSummary.xpEarned} XP</span>
                  {(rewardSummary.mCoinsEarned ?? 0) > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/50 text-amber-200 font-mono flex items-center gap-1">
                      <MCoinIcon size={14} />+{rewardSummary.mCoinsEarned} M
                    </span>
                  )}
                  {rewardSummary.tooShortForCoins && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-[#2d3b52] text-slate-300 text-[10px]">
                      {lang === 'en'
                        ? '⏱️ Match too short (< 12 ticks) — no M-Coin bonus'
                        : '⏱️ Zbyt krótki mecz (< 12 tur) — brak premii M'}
                    </span>
                  )}
                  {(rewardSummary.bpXpEarned ?? 0) > 0 && (
                    <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/45 text-sky-200 font-mono">
                      🎖️ +{rewardSummary.bpXpEarned} {lang === 'en' ? 'Pass XP' : 'Karnet XP'}
                    </span>
                  )}
                  {(rewardSummary.rewardMultiplier ?? 1) !== 1 && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/45 text-emerald-300 font-mono">
                      ×{rewardSummary.rewardMultiplier?.toFixed(2)} {lang === 'en' ? 'Multiplier' : 'Mnożnik'}
                    </span>
                  )}
                </div>
                {onOpenProfile && (
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-[11px] font-semibold"
                  >
                    🎖️ Profil i Odznaki
                  </button>
                )}
              </div>
              {rewardSummary.completedQuests && rewardSummary.completedQuests.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {rewardSummary.completedQuests.map((q) => (
                    <span
                      key={q.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b0f17] border border-sky-500/45 text-[11px] text-sky-200"
                    >
                      <span>🎯 {q.title}</span>
                      <span className="text-amber-300 font-mono">+{q.mCoinReward} M</span>
                    </span>
                  ))}
                </div>
              )}
              {rewardSummary.newlyUnlocked.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {rewardSummary.newlyUnlocked.map((ach) => (
                    <span
                      key={ach.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b0f17] border border-emerald-500/45 text-[11px] text-emerald-200"
                    >
                      <span>{ach.badgeEmoji}</span>
                      <span className="font-semibold">{ach.name}</span>
                      <span className="text-amber-300 font-mono">+{ach.xpReward} XP</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

        {winningCoalition && (
          <div className="p-3 rounded-xl bg-[#0b0f17] border border-sky-500/30 text-left space-y-1.5 text-xs">
            <div className="text-[11px] font-bold text-sky-300 uppercase">
              {lang === 'en' ? 'Winning coalition members:' : 'Członkowie zwycięskiej koalicji:'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {winningCoalition.memberIds.map((mId) => {
                const mem = gameState.players.find((p) => p.id === mId);
                if (!mem) return null;
                return (
                  <span
                    key={mId}
                    className="px-2 py-1 rounded bg-[#161f30] border border-[#243044] text-slate-100 flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: mem.color }} />
                    {mem.companyName}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Podsumowanie gracza */}
        <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-[#243044] grid grid-cols-2 sm:grid-cols-4 gap-3 text-left text-xs">
          <div>
            <div className="text-slate-400">{t('vic.metricNetWorth')}</div>
            <div className="font-mono text-sm md:text-base font-bold text-emerald-400">
              {formatMoney(currentPlayer.netWorth)}
            </div>
          </div>
          <div>
            <div className="text-slate-400">{t('vic.strategyLabel').replace(':', '')}</div>
            <div className="font-semibold text-amber-300 truncate">
              {localizeAiStrategy(currentPlayer.dominantStrategy, currentPlayer.dominantStrategy, lang)}
            </div>
          </div>
          <div>
            <div className="text-slate-400">{t('vic.archetypeLabel').replace(':', '')}</div>
            <div className="font-semibold text-sky-300 truncate">
              {myArch.icon} {myArch.shortName}
            </div>
          </div>
          <div>
            <div className="text-slate-400">{t('vic.goalsLabel')}</div>
            <div className="font-mono font-bold text-slate-100">
              {t('vic.goalsDone', {
                done: (currentPlayer.secretGoals ?? []).filter((g) => g.completed).length,
                total: (currentPlayer.secretGoals ?? []).length || 0,
              })}
            </div>
          </div>
        </div>

        {/* Interaktywne Wykresy Przebiegu Meczu (SVG) */}
        <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2.5 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              {t('vic.chartHeader', { count: samples.length })}
            </div>
            <div className="flex flex-wrap gap-1">
              {metricOptions.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetric(m.key)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    metric === m.key
                      ? 'bg-sky-600 text-white'
                      : 'bg-[#151c28] text-slate-300 hover:bg-[#1f293d]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {samples.length < 2 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              {t('vic.chartNotEnough')}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                  className="w-full h-44 select-none"
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  {/* Siatka Y */}
                  {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                    const y = chartGeometry.padT + (1 - t) * chartGeometry.plotH;
                    const val =
                      chartGeometry.minVal + t * (chartGeometry.maxVal - chartGeometry.minVal);
                    return (
                      <g key={t}>
                        <line
                          x1={chartGeometry.padL}
                          x2={chartGeometry.width - chartGeometry.padR}
                          y1={y}
                          y2={y}
                          stroke="#1e293b"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={chartGeometry.padL - 6}
                          y={y + 3}
                          textAnchor="end"
                          fill="#64748b"
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          {formatMetricVal(val, activeMetricDef.unit)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Linie firm */}
                  {chartGeometry.lines.map((line) => (
                    <g key={line.player.id}>
                      <path
                        d={line.d}
                        fill="none"
                        stroke={line.player.color}
                        strokeWidth={line.player.id === currentPlayer.id ? 2.6 : 1.7}
                        strokeOpacity={line.player.id === currentPlayer.id ? 1 : 0.8}
                      />
                      {inspectSampleIdx !== null && line.pts[inspectSampleIdx] && (
                        <circle
                          cx={line.pts[inspectSampleIdx].x}
                          cy={line.pts[inspectSampleIdx].y}
                          r={3.8}
                          fill={line.player.color}
                          stroke="#0b0f17"
                          strokeWidth={1.2}
                        />
                      )}
                    </g>
                  ))}

                  {/* Interaktywne słupki hover */}
                  {samples.map((s, idx) => {
                    const colW = chartGeometry.plotW / Math.max(1, samples.length);
                    const x =
                      chartGeometry.padL +
                      (samples.length <= 1
                        ? chartGeometry.plotW / 2
                        : (idx / (samples.length - 1)) * chartGeometry.plotW);
                    return (
                      <rect
                        key={s.tick}
                        x={x - colW / 2}
                        y={chartGeometry.padT}
                        width={colW}
                        height={chartGeometry.plotH}
                        fill="transparent"
                        onMouseEnter={() => setHoverIdx(idx)}
                      />
                    );
                  })}

                  {inspectSampleIdx !== null && (
                    <line
                      x1={
                        chartGeometry.padL +
                        (samples.length <= 1
                          ? chartGeometry.plotW / 2
                          : (inspectSampleIdx / (samples.length - 1)) * chartGeometry.plotW)
                      }
                      x2={
                        chartGeometry.padL +
                        (samples.length <= 1
                          ? chartGeometry.plotW / 2
                          : (inspectSampleIdx / (samples.length - 1)) * chartGeometry.plotW)
                      }
                      y1={chartGeometry.padT}
                      y2={chartGeometry.padT + chartGeometry.plotH}
                      stroke="#94a3b8"
                      strokeOpacity={0.35}
                      strokeDasharray="2 2"
                    />
                  )}

                  <text
                    x={chartGeometry.padL}
                    y={chartGeometry.height - 5}
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {samples[0]?.label}
                  </text>
                  <text
                    x={chartGeometry.width - chartGeometry.padR}
                    y={chartGeometry.height - 5}
                    textAnchor="end"
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {inspectedSample ? t('vic.chartSamplePoint', { label: inspectedSample.label }) : samples[samples.length - 1]?.label}
                  </text>
                </svg>
              </div>

              {/* Legenda dla wskazanego punktu */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                {gameState.players
                  .slice()
                  .sort(
                    (a, b) =>
                      (inspectedSample?.players[b.id]?.[metric] ?? 0) -
                      (inspectedSample?.players[a.id]?.[metric] ?? 0)
                  )
                  .map((p) => {
                    const val = inspectedSample?.players[p.id]?.[metric] ?? 0;
                    return (
                      <div
                        key={p.id}
                        className="px-2 py-1 rounded bg-[#131b2b] border border-[#243044] flex items-center justify-between gap-1"
                      >
                        <span className="flex items-center gap-1.5 min-w-0 truncate text-slate-200">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="truncate">{p.companyName}</span>
                        </span>
                        <span className="font-mono text-slate-100 shrink-0">
                          {formatMetricVal(val, activeMetricDef.unit)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Zabawne Wyróżnienia Sesji */}
        {funAwards.length > 0 && (
          <div className="space-y-2 text-left">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {t('vic.awardsHeader')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {funAwards.map((aw) => (
                <div
                  key={aw.id}
                  className="p-2.5 rounded-xl bg-[#0b0f17] border border-[#243044] flex items-start gap-2 text-xs"
                >
                  <span className="text-lg shrink-0">{aw.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-100">{aw.title}</div>
                    <div className="text-[11px] flex items-center gap-1 text-slate-300 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: aw.color }}
                      />
                      <span className="truncate">{aw.companyName}</span>
                      <span className="font-mono text-amber-300 shrink-0">({aw.valueLabel})</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{aw.subtitle}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onContinueEndless}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm cursor-pointer"
          >
            {isChallengeDone
              ? t('vic.continueEndless')
              : lang === 'en'
                ? '♾️ Keep Playing in Free Mode'
                : '♾️ Graj Dalej w Trybie Wolnym'}
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="py-2.5 rounded-xl bg-[#1a2438] hover:bg-[#24324d] border border-amber-500/40 text-amber-300 text-xs font-semibold cursor-pointer"
            >
              {t('vic.leaderboard')}
            </button>
            <button
              type="button"
              onClick={onExitToMenu}
              className="py-2.5 rounded-xl bg-[#1a2438] hover:bg-[#24324d] border border-[#243044] text-slate-300 text-xs font-semibold cursor-pointer"
            >
              {t('vic.exitMenu')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

