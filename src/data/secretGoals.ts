import { formatGameDate } from '../utils/formatters';
import type { GameState, Player, ResourceType } from '../engine/types';

interface SecretGoalTemplate {
  templateId: string;
  title: string;
  description: string;
  targetValue: number;
  unitLabel: string;
  rewardCash: number;
  rewardInfluence: number;
  rewardDominanceBonus: number;
  rewardXp: number;
  eligible?: (state: GameState) => boolean;
  evaluate: (state: GameState, player: Player) => number;
}

function getResourceSharePct(state: GameState, playerId: string, resources: ResourceType[]): number {
  let myAmt = 0;
  let totalAmt = 0;
  for (const pl of state.plots) {
    const b = pl.building;
    if (!b || !b.isActive || b.destroyedRuins) continue;
    for (const r of resources) {
      const prod = b.productionPerTick[r] ?? 0;
      if (prod > 0) {
        totalAmt += prod;
        if (b.ownerId === playerId) myAmt += prod;
      }
    }
  }
  return totalAmt > 0 ? Math.round((myAmt / totalAmt) * 100) : 0;
}

const SECRET_GOAL_TEMPLATES: SecretGoalTemplate[] = [
  {
    templateId: 'goal_copper_iron_monopoly',
    title: 'Król Stali i Miedzi',
    description: 'Osiągnij min. 60% udziału w łącznym wydobyciu miedzi lub rudy żelaza na mapie.',
    targetValue: 60,
    unitLabel: '% udziału',
    rewardCash: 650_000,
    rewardInfluence: 18,
    rewardDominanceBonus: 5,
    rewardXp: 110,
    eligible: (s) => s.plots.some((p) => p.deposits.some((d) => d.type === 'copper' || d.type === 'ironOre')),
    evaluate: (s, p) => Math.max(getResourceSharePct(s, p.id, ['copper']), getResourceSharePct(s, p.id, ['ironOre'])),
  },
  {
    templateId: 'goal_gold_diamonds_share',
    title: 'Magnat Kruszców i Diamentów',
    description: 'Zmonopolizuj min. 55% produkcji złota, diamentów lub biżuterii na mapie.',
    targetValue: 55,
    unitLabel: '% udziału',
    rewardCash: 820_000,
    rewardInfluence: 20,
    rewardDominanceBonus: 6,
    rewardXp: 130,
    eligible: (s) => s.plots.some((p) => p.deposits.some((d) => d.type === 'gold' || d.type === 'diamonds')),
    evaluate: (s, p) =>
      Math.max(
        getResourceSharePct(s, p.id, ['gold']),
        getResourceSharePct(s, p.id, ['diamonds']),
        getResourceSharePct(s, p.id, ['jewelry'])
      ),
  },
  {
    templateId: 'goal_high_approval_2y',
    title: 'Zaufanie Społeczne',
    description: 'Utrzymaj min. 85% poparcia wyborców przez 60 cykli (ok. 2 lata gry).',
    targetValue: 60,
    unitLabel: 'cykli >=85%',
    rewardCash: 550_000,
    rewardInfluence: 25,
    rewardDominanceBonus: 5,
    rewardXp: 120,
    evaluate: (_s, p) => p.statsAccum?.highApprovalTicks ?? 0,
  },
  {
    templateId: 'goal_patents_2',
    title: 'Pionier Patentowy',
    description: 'Zdobądź jako pierwszy co najmniej 2 wyłączne patenty technologiczne.',
    targetValue: 2,
    unitLabel: 'patentów',
    rewardCash: 700_000,
    rewardInfluence: 16,
    rewardDominanceBonus: 6,
    rewardXp: 130,
    evaluate: (s, p) => (s.patents ?? []).filter((pt) => pt.ownerId === p.id).length,
  },
  {
    templateId: 'goal_toll_transport_500k',
    title: 'Król Arterii i Myta',
    description: 'Zarób łącznie $500 000 z myta autostradowego i ruchu pasażerskiego.',
    targetValue: 500_000,
    unitLabel: 'zł z myta',
    rewardCash: 600_000,
    rewardInfluence: 14,
    rewardDominanceBonus: 5,
    rewardXp: 120,
    evaluate: (s, p) => {
      const roadTollSum = s.plots
        .filter((pl) => pl.ownerId === p.id && pl.hasRoad)
        .reduce((sum, pl) => sum + (pl.tollRevenueTotal ?? 0), 0);
      return Math.round(Math.max(roadTollSum, p.statsAccum?.tollEarned ?? 0));
    },
  },
  {
    templateId: 'goal_rival_bailiff',
    title: 'Bezwzględna Presja Rynkowa',
    description: 'Doprowadź do licytacji komorniczej u rywala lub wygraj aukcję zajęcia.',
    targetValue: 1,
    unitLabel: 'egzekucji',
    rewardCash: 750_000,
    rewardInfluence: 22,
    rewardDominanceBonus: 5,
    rewardXp: 140,
    eligible: (s) => s.players.length > 1,
    evaluate: (s) => {
      const hasBailiffNews = s.news.some(
        (n) => n.id.startsWith('bailiff_seize_') || n.id.startsWith('bankrupt_')
      );
      return hasBailiffNews ? 1 : 0;
    },
  },
  {
    templateId: 'goal_green_power_80mw',
    title: 'Architekt Zielonej Sieci',
    description: 'Uruchom co najmniej 80 MW czystej mocy (wiatr, słońce, woda, geotermia, fuzja).',
    targetValue: 80,
    unitLabel: 'MW OZE',
    rewardCash: 580_000,
    rewardInfluence: 20,
    rewardDominanceBonus: 5,
    rewardXp: 115,
    evaluate: (s, p) => {
      let cleanMw = 0;
      for (const pl of s.plots) {
        if (pl.ownerId !== p.id || !pl.building?.isActive || pl.building.destroyedRuins) continue;
        if (
          pl.building.type === 'solarFarm' ||
          pl.building.type === 'windFarm' ||
          pl.building.type === 'hydroPowerPlant' ||
          pl.building.type === 'geothermalPlant' ||
          pl.building.type === 'fusionReactor'
        ) {
          cleanMw += Math.round(Math.abs(pl.building.productionPerTick.electricity ?? 35));
        }
      }
      return cleanMw;
    },
  },
  {
    templateId: 'goal_urban_synergy',
    title: 'Deweloper Dzielnicy Marzeń',
    description: 'Posiadaj 4 obiekty komercyjne/usługowe z aktywną synergią min. +25% jednocześnie.',
    targetValue: 4,
    unitLabel: 'obiektów',
    rewardCash: 620_000,
    rewardInfluence: 18,
    rewardDominanceBonus: 5,
    rewardXp: 115,
    evaluate: (s, p) =>
      s.plots.filter(
        (pl) =>
          pl.ownerId === p.id &&
          pl.building?.isActive &&
          !pl.building.destroyedRuins &&
          (pl.synergyPercent ?? 0) >= 25
      ).length,
  },
];

export function assignSecretGoalsForPlayers(state: GameState): void {
  const eligiblePool = SECRET_GOAL_TEMPLATES.filter((t) => !t.eligible || t.eligible(state));
  for (const player of state.players) {
    if (player.secretGoals && player.secretGoals.length >= 2) continue;
    const shuffled = [...eligiblePool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, 2);
    player.secretGoals = chosen.map((tmpl, idx) => ({
      id: `sg_${player.id}_${idx}_${tmpl.templateId}`,
      templateId: tmpl.templateId,
      title: tmpl.title,
      description: tmpl.description,
      targetValue: tmpl.targetValue,
      currentValue: 0,
      unitLabel: tmpl.unitLabel,
      completed: false,
      rewardCash: tmpl.rewardCash,
      rewardInfluence: tmpl.rewardInfluence,
      rewardDominanceBonus: tmpl.rewardDominanceBonus,
      rewardXp: tmpl.rewardXp,
    }));
    player.secretGoalDominanceBonus = player.secretGoalDominanceBonus ?? 0;
  }
}

export function evaluateSecretGoalsTick(state: GameState): void {
  const stageScale = Math.min(2.2, Math.max(0.85, 0.85 + state.time.tick / 180));
  for (const player of state.players) {
    if (player.isEliminated || !player.secretGoals) continue;
    for (const goal of player.secretGoals) {
      if (goal.completed) continue;
      const tmpl = SECRET_GOAL_TEMPLATES.find((t) => t.templateId === goal.templateId);
      if (!tmpl) continue;
      goal.currentValue = tmpl.evaluate(state, player);
      if (goal.currentValue >= goal.targetValue) {
        goal.completed = true;
        goal.completedTick = state.time.tick;
        const cashBonus = Math.round(goal.rewardCash * stageScale);
        player.cash += cashBonus;
        player.totalRevenueEarned += cashBonus;
        player.influence.financial += Math.round(goal.rewardInfluence * 0.5);
        player.influence.social += Math.round(goal.rewardInfluence * 0.5);
        player.secretGoalDominanceBonus =
          (player.secretGoalDominanceBonus ?? 0) + goal.rewardDominanceBonus;

        state.news = [
          {
            id: `sg_news_${state.time.tick}_${player.id}_${goal.templateId}`,
            headline: `🎯 Tajny Cel Ujawniony! ${player.companyName} ukończyła "${goal.title}"`,
            brief: `Zarząd ujawnił realizację tajnej strategii korporacyjnej, inkasując ${cashBonus.toLocaleString('pl-PL')} zł, +${goal.rewardInfluence} pkt wpływów i +${goal.rewardDominanceBonus}% bonusu dominacji.`,
            fullText: `Spółka ${player.companyName} zrealizowała ukryty cel strategiczny "${goal.title}" (${goal.description}).`,
            analysis: 'Zrealizowane tajne cele przyspieszają drogę do dominacji rynkowej bez psucia balansu giełdy.',
            hints: ['Sprawdź swoje bieżące Tajne Cele w panelu Prezes / HUD.'],
            type: 'positive' as const,
            dateLabel: formatGameDate(state.time),
            tick: state.time.tick,
            read: false,
          },
          ...state.news,
        ].slice(0, 40);

        if (player.id === state.currentPlayerId) {
          state.notifications = [
            {
              id: `sg_notif_${state.time.tick}_${goal.id}`,
              title: `🎯 Tajny Cel Ukończony: ${goal.title}!`,
              message: `Nagroda: +${cashBonus.toLocaleString('pl-PL')} zł, +${goal.rewardInfluence} wpływów, +${goal.rewardDominanceBonus}% Dominacji, +${goal.rewardXp} XP profilu.`,
              severity: 'success' as const,
              tick: state.time.tick,
            },
            ...state.notifications,
          ].slice(0, 6);
        }
      }
    }
  }
}
