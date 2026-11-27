import { formatCompactMoney, formatGameDate } from '../utils/formatters';
import type { GameState, MatchFunAward, MatchStatSample } from './types';

export function recordMatchStatsSample(state: GameState, force = false): void {
  state.matchStatsHistory = state.matchStatsHistory ?? [];
  const tick = state.time.tick;
  if (!force && tick > 0 && tick % 15 !== 0) return;
  if (state.matchStatsHistory.some((s) => s.tick === tick)) return;

  const playersSnap: MatchStatSample['players'] = {};
  for (const p of state.players) {
    const revTick = Object.values(p.lastTickRevenueByCategory).reduce((a, b) => a + b, 0);
    playersSnap[p.id] = {
      netWorth: Math.round(p.netWorth),
      cash: Math.round(p.cash),
      incomePerTick: Math.round(revTick),
      influence: Math.round(p.influence.financial + p.influence.military + p.influence.social),
      approval: Math.round(p.influence.voterApproval),
    };
  }

  state.matchStatsHistory.push({
    tick,
    label: tick === 0 ? 'Start' : formatGameDate(state.time),
    players: playersSnap,
  });

  // Zachowaj lekką tablicę (maks. 48 próbek dla sprawnej synchronizacji WebRTC)
  if (state.matchStatsHistory.length > 48) {
    state.matchStatsHistory = state.matchStatsHistory.filter(
      (_, i) => i === 0 || i === state.matchStatsHistory!.length - 1 || i % 2 === 0
    );
  }
}

export function updatePlayerMatchStatsAccumTick(state: GameState): void {
  for (const p of state.players) {
    if (p.isEliminated) continue;
    p.statsAccum = p.statsAccum ?? {
      maxDebt: 0,
      tollEarned: 0,
      peakMarketTradeProfit: 0,
      totalPollution: 0,
      greenScore: 0,
      bailiffSeizures: 0,
      stockDividendsAndTrades: 0,
      patentsOwnedCount: 0,
      highApprovalTicks: 0,
      ownedPlotsPeak: 0,
    };

    const loanDebt = p.loans.reduce((s, l) => s + l.remainingAmount, 0);
    const bondDebt = (p.bonds ?? []).reduce((s, b) => s + b.remainingAmount, 0);
    p.statsAccum.maxDebt = Math.max(p.statsAccum.maxDebt, Math.round(loanDebt + bondDebt));

    const roadTolls = state.plots
      .filter((pl) => pl.ownerId === p.id && pl.hasRoad)
      .reduce((s, pl) => s + (pl.tollRevenueTotal ?? 0), 0);
    p.statsAccum.tollEarned = Math.max(p.statsAccum.tollEarned, Math.round(roadTolls));

    const ownedPlotsCount = state.plots.filter((pl) => pl.ownerId === p.id).length;
    p.statsAccum.ownedPlotsPeak = Math.max(p.statsAccum.ownedPlotsPeak, ownedPlotsCount);

    if (p.influence.voterApproval >= 85) {
      p.statsAccum.highApprovalTicks += 1;
    }

    p.statsAccum.patentsOwnedCount = (state.patents ?? []).filter((pt) => pt.ownerId === p.id).length;

    let cleanOrGreenBuildings = 0;
    let tickPol = 0;
    for (const pl of state.plots) {
      if (pl.ownerId !== p.id || !pl.building?.isActive || pl.building.destroyedRuins) continue;
      if (
        pl.building.type === 'solarFarm' ||
        pl.building.type === 'windFarm' ||
        pl.building.type === 'recyclingPlant' ||
        pl.building.type === 'bioSewagePlant' ||
        pl.building.type === 'closedLoopSewagePlant' ||
        pl.building.type === 'plasmaGasificationPlant' ||
        pl.building.type === 'cityPark' ||
        pl.building.type === 'monumentFountain' ||
        pl.building.type === 'monumentObelisk' ||
        pl.building.type === 'monumentHelipad' ||
        pl.building.type === 'monumentFounder' ||
        pl.building.type === 'fusionReactor'
      ) {
        cleanOrGreenBuildings++;
      }
      tickPol += Math.max(0, pl.building.costs.environmentalFine ?? 0);
    }
    p.statsAccum.greenBuildingsCount = cleanOrGreenBuildings;
    p.statsAccum.greenScore = Math.max(p.statsAccum.greenScore, cleanOrGreenBuildings * 10 + Math.round(p.reputation));
    p.statsAccum.totalPollution += Math.round(tickPol);
  }
}

export function computeMatchFunAwards(state: GameState): MatchFunAward[] {
  const candidates = state.players;
  if (candidates.length === 0) return [];
  const awards: MatchFunAward[] = [];

  const pickTop = (
    scorer: (p: (typeof candidates)[number]) => number,
    minThreshold = 1
  ) => {
    let best: (typeof candidates)[number] | null = null;
    let bestVal = minThreshold - 0.001;
    for (const p of candidates) {
      const val = scorer(p);
      if (val > bestVal) {
        bestVal = val;
        best = p;
      }
    }
    return best ? { player: best, value: bestVal } : null;
  };

  const debtKing = pickTop((p) => p.statsAccum?.maxDebt ?? 0, 50_000);
  if (debtKing) {
    awards.push({
      id: 'award_debt_king',
      emoji: '💳',
      title: 'Król Długów',
      subtitle: 'Najwyższe szczytowe zadłużenie kredytowe w meczu',
      playerId: debtKing.player.id,
      companyName: debtKing.player.companyName,
      color: debtKing.player.color,
      valueLabel: formatCompactMoney(debtKing.value),
    });
  }

  const tollMaster = pickTop(
    (p) =>
      Math.max(
        p.statsAccum?.tollEarned ?? 0,
        state.plots
          .filter((pl) => pl.ownerId === p.id && pl.hasRoad)
          .reduce((s, pl) => s + (pl.tollRevenueTotal ?? 0), 0)
      ),
    1_000
  );
  if (tollMaster) {
    awards.push({
      id: 'award_toll_master',
      emoji: '🛣️',
      title: 'Mistrz Myta',
      subtitle: 'Najwyższy zysk zebrany na bramkach autostradowych',
      playerId: tollMaster.player.id,
      companyName: tollMaster.player.companyName,
      color: tollMaster.player.color,
      valueLabel: formatCompactMoney(tollMaster.value),
    });
  }

  const polluter = pickTop(
    (p) => (p.statsAccum?.totalPollution ?? 0) + (p.lastTickTaxes?.environmental ?? 0),
    100
  );
  if (polluter) {
    awards.push({
      id: 'award_polluter',
      emoji: '🌫️',
      title: 'Największy Truciciel',
      subtitle: 'Rekordowe kary za emisję spalin i przemysł ciężki',
      playerId: polluter.player.id,
      companyName: polluter.player.companyName,
      color: polluter.player.color,
      valueLabel: formatCompactMoney(polluter.value),
    });
  }

  const ecoLeader = pickTop((p) => p.statsAccum?.greenScore ?? Math.round(p.reputation), 20);
  if (ecoLeader) {
    awards.push({
      id: 'award_eco',
      emoji: '🌿',
      title: 'Samarytanin / Eko-Lider',
      subtitle: 'Najwyższa reputacja społeczna i inwestycje w OZE/parki',
      playerId: ecoLeader.player.id,
      companyName: ecoLeader.player.companyName,
      color: ecoLeader.player.color,
      valueLabel: `${Math.round(ecoLeader.value)} pkt`,
    });
  }

  const stockShark = pickTop((p) => p.statsAccum?.stockDividendsAndTrades ?? p.influence.financial, 5);
  if (stockShark) {
    awards.push({
      id: 'award_stock_shark',
      emoji: '🦈',
      title: 'Rekin Giełdowy',
      subtitle: 'Najsilniejsza aktywność kapitałowa, wykupy i wpływy finansowe',
      playerId: stockShark.player.id,
      companyName: stockShark.player.companyName,
      color: stockShark.player.color,
      valueLabel: `${Math.round(stockShark.value)} pkt`,
    });
  }

  const bailiffMagnet = pickTop(
    (p) => (p.statsAccum?.bailiffSeizures ?? 0) + (p.isEliminated ? 2 : 0),
    1
  );
  if (bailiffMagnet) {
    awards.push({
      id: 'award_bailiff',
      emoji: '🔨',
      title: 'Magnes na Komornika',
      subtitle: 'Najczęstsze wizyty egzekutora sądowego',
      playerId: bailiffMagnet.player.id,
      companyName: bailiffMagnet.player.companyName,
      color: bailiffMagnet.player.color,
      valueLabel: `${Math.round(bailiffMagnet.value)} egzekucji`,
    });
  }

  return awards;
}
