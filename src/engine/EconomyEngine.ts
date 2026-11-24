import { GAME_CONFIG } from '../config/gameConfig';
import { RESOURCE_DEFINITIONS } from '../data/resources';
import type {
  Building,
  GameState,
  MonopolyShare,
  Player,
  ResourceType,
} from './types';

export function getResourcePrice(state: GameState, resource: ResourceType): number {
  return (
    state.resourcePrices.find((r) => r.type === resource)?.price ??
    RESOURCE_DEFINITIONS[resource]?.basePrice ??
    100
  );
}

export function getPlayerEntrepreneurModifiers(state: GameState, player: Player) {
  let profitBonus = 0;
  let taxReduction = 0;
  let loanInterestReduction = 0;
  let sellPriceBonus = 0;
  let buyPriceDiscount = 0;
  let buyoutDiscount = 0;
  let transportDiscount = 0;
  let warehouseDiscount = 0;
  let researchDiscount = 0;
  let researchSpeedBonus = 0;
  let influencePowerBonus = 0;
  let plotNegotiationBonus = 0;
  let safetyDiscount = 0;

  for (const def of state.entrepreneurSkillDefs) {
    if (player.entrepreneurSkills[def.id] !== 'done') continue;
    const m = def.modifiers;
    if (m.profitBonus) profitBonus += m.profitBonus;
    if (m.taxReduction) taxReduction += m.taxReduction;
    if (m.loanInterestReduction) loanInterestReduction += m.loanInterestReduction;
    if (m.sellPriceBonus) sellPriceBonus += m.sellPriceBonus;
    if (m.buyPriceDiscount) buyPriceDiscount += m.buyPriceDiscount;
    if (m.buyoutDiscount) buyoutDiscount += m.buyoutDiscount;
    if (m.transportDiscount) transportDiscount += m.transportDiscount;
    if (m.warehouseDiscount) warehouseDiscount += m.warehouseDiscount;
    if (m.researchDiscount) researchDiscount += m.researchDiscount;
    if (m.researchSpeedBonus) researchSpeedBonus += m.researchSpeedBonus;
    if (m.influencePowerBonus) influencePowerBonus += m.influencePowerBonus;
    if (m.plotNegotiationBonus) plotNegotiationBonus += m.plotNegotiationBonus;
    if (m.safetyDiscount) safetyDiscount += m.safetyDiscount;
  }

  return {
    profitBonus,
    taxReduction,
    loanInterestReduction,
    sellPriceBonus,
    buyPriceDiscount,
    buyoutDiscount,
    transportDiscount,
    warehouseDiscount,
    researchDiscount,
    researchSpeedBonus,
    influencePowerBonus,
    plotNegotiationBonus,
    safetyDiscount,
  };
}

export function getPlayerGlobalTechModifiers(state: GameState, player: Player) {
  let miningBonus = 0;
  let processingBonus = 0;
  let energyBonus = 0;
  let logisticsReduction = 0;
  let sabotageDefense = 0;
  let sabotageAttack = 0;
  let droughtShield = 0;
  let researchSpeed = 0;
  let taxReduction = 0;
  let safetyBonus = 0;

  for (const def of state.globalTechDefs) {
    if (player.globalTech[def.id]?.status !== 'done') continue;
    const m = def.modifiers;
    if (m.miningBonus) miningBonus += m.miningBonus;
    if (m.processingBonus) processingBonus += m.processingBonus;
    if (m.energyBonus) energyBonus += m.energyBonus;
    if (m.logisticsReduction) logisticsReduction += m.logisticsReduction;
    if (m.sabotageDefense) sabotageDefense += m.sabotageDefense;
    if (m.sabotageAttack) sabotageAttack += m.sabotageAttack;
    if (m.droughtShield) droughtShield += m.droughtShield;
    if (m.researchSpeed) researchSpeed += m.researchSpeed;
    if (m.taxReduction) taxReduction += m.taxReduction;
    if (m.safetyBonus) safetyBonus += m.safetyBonus;
  }

  return {
    miningBonus,
    processingBonus,
    energyBonus,
    logisticsReduction,
    sabotageDefense,
    sabotageAttack,
    droughtShield,
    researchSpeed,
    taxReduction,
    safetyBonus,
  };
}

export function calculateTransportCostForBuilding(
  distanceToRoad: number,
  volume: number,
  fuelPrice: number,
  player: Player,
  state: GameState,
  logisticsMode: Building['logisticsMode'] = 'road'
): number {
  if (volume <= 0) return 0;
  const fuelBase = RESOURCE_DEFINITIONS.fuel.basePrice;
  const fuelMultiplier = Math.max(0.55, fuelPrice / fuelBase);
  const entMods = getPlayerEntrepreneurModifiers(state, player);
  const techMods = getPlayerGlobalTechModifiers(state, player);
  const discount = Math.max(0.3, 1 - entMods.transportDiscount - techMods.logisticsReduction);
  const modeMultiplier =
    logisticsMode === 'sea'
      ? 0.78
      : logisticsMode === 'air'
        ? 1.55
        : logisticsMode === 'isolated'
          ? 2.4
          : 1.0;
  const effectiveDist = Math.max(0.6, distanceToRoad + 1);
  return volume * effectiveDist * GAME_CONFIG.baseTransportCostPerTile * fuelMultiplier * discount * modeMultiplier;
}

export function updateMarketPrices(
  state: GameState,
  supplyAccum: Partial<Record<ResourceType, number>>,
  demandAccum: Partial<Record<ResourceType, number>>
): void {
  const eventPriceTargets: Partial<Record<ResourceType | 'all', number>> = {};
  const isRecession = state.activeEvents.some((e) => e.templateId === 'global_recession');

  for (const ev of state.activeEvents) {
    for (const eff of ev.effects) {
      if (eff.kind === 'priceMultiplier' && eff.target) {
        const current = eventPriceTargets[eff.target] ?? 1;
        eventPriceTargets[eff.target] = current * eff.value;
      }
    }
  }

  for (const rp of state.resourcePrices) {
    const def = RESOURCE_DEFINITIONS[rp.type];
    const supply = Math.max(10, 80 + (supplyAccum[rp.type] ?? 0));
    const demand = Math.max(10, 80 + (demandAccum[rp.type] ?? 0));
    rp.supply = Math.round(supply);
    rp.demand = Math.round(demand);

    const imbalance = (demand - supply) / Math.max(supply, demand);
    let eventMult = (eventPriceTargets[rp.type] ?? 1) * (eventPriceTargets['all'] ?? 1);
    // Złoto działa jako bezpieczna przystań w trakcie recesji!
    if (rp.type === 'gold' && isRecession) {
      eventMult = 1.28;
    }

    const targetPrice = def.basePrice * (1 + imbalance * def.elasticity) * eventMult;
    const noise = (Math.random() - 0.5) * 2 * def.volatility * 0.45;
    const meanPull = (targetPrice - rp.price) * 0.14;
    const nextPrice = Math.round(
      Math.max(def.minPrice, Math.min(def.maxPrice, rp.price + meanPull + rp.price * noise))
    );

    rp.previousPrice = rp.price;
    rp.price = nextPrice;
    rp.changePercent = Number((((nextPrice - rp.previousPrice) / Math.max(1, rp.previousPrice)) * 100).toFixed(2));
    rp.history = [...rp.history.slice(-24), nextPrice];

    const open = rp.previousPrice;
    const close = nextPrice;
    const wick = Math.max(2, Math.round(Math.abs(close - open) * 0.45 + nextPrice * def.volatility * 0.25));
    const candle = {
      tick: state.time.tick,
      open,
      high: Math.max(open, close) + wick,
      low: Math.max(def.minPrice, Math.min(open, close) - wick),
      close,
    };
    rp.candles = [...rp.candles.slice(-19), candle];
  }
}

export function calculatePlayerNetWorth(player: Player, state: GameState): number {
  let plotValue = 0;
  let buildingValue = 0;
  let stockpileValue = 0;

  for (const plot of state.plots) {
    if (plot.ownerId !== player.id) continue;
    plotValue += plot.price;
    if (plot.building) {
      buildingValue += Math.round(plot.building.condition * 0.01 * getBuildingBookValue(plot.building));
      for (const [res, amt] of Object.entries(plot.building.storage)) {
        if (!amt) continue;
        stockpileValue += amt * getResourcePrice(state, res as ResourceType);
      }
    }
  }

  for (const [res, amt] of Object.entries(player.warehouseStockpile)) {
    if (!amt) continue;
    stockpileValue += amt * getResourcePrice(state, res as ResourceType);
  }

  let stockPortfolioValue = 0;
  for (const st of state.stocks ?? []) {
    if (st.companyId === player.id) continue;
    const pct = st.holdings[player.id] ?? 0;
    if (pct > 0) {
      stockPortfolioValue += pct * st.sharePrice * 440;
    }
  }

  const loanDebt = player.loans.reduce((sum, l) => sum + l.remainingAmount, 0);
  const bondDebt = (player.bonds ?? []).reduce((sum, b) => sum + b.remainingAmount, 0);
  const raw = player.cash + plotValue + buildingValue + stockpileValue + stockPortfolioValue - loanDebt - bondDebt;
  return Number.isFinite(raw) ? Math.round(raw) : Math.round(player.cash);
}

function getBuildingBookValue(building: Building): number {
  const upgradeValue = building.techTree
    .filter((t) => t.status === 'done')
    .reduce((sum, t) => sum + t.cost * 0.8, 0);
  return 100_000 + building.level * 65_000 + upgradeValue;
}

export function calculateMonopolyShares(state: GameState, currentPlayerId: string): MonopolyShare[] {
  const trackedResources: ResourceType[] = [
    'electricity',
    'steel',
    'copper',
    'gold',
    'jewelry',
    'fuel',
    'semiconductors',
    'coal',
    'oil',
    'uranium',
    'weapons',
  ];

  const prodByPlayer: Record<string, Partial<Record<ResourceType, number>>> = {};
  const totalByRes: Partial<Record<ResourceType, number>> = {};

  for (const plot of state.plots) {
    const b = plot.building;
    if (!b || !b.isActive) continue;
    if (!prodByPlayer[b.ownerId]) prodByPlayer[b.ownerId] = {};
    for (const [resKey, amt] of Object.entries(b.productionPerTick)) {
      const res = resKey as ResourceType;
      const val = amt ?? 0;
      prodByPlayer[b.ownerId][res] = (prodByPlayer[b.ownerId][res] ?? 0) + val;
      totalByRes[res] = (totalByRes[res] ?? 0) + val;
    }
  }

  return trackedResources.map((res) => {
    const def = RESOURCE_DEFINITIONS[res];
    const total = totalByRes[res] ?? 0;
    const playerAmt = prodByPlayer[currentPlayerId]?.[res] ?? 0;
    const playerShare = total > 0 ? Math.round((playerAmt / total) * 100) : 0;

    let leaderId = '';
    let leaderName = 'Rynek Rozproszony';
    let bestAmt = 0;
    for (const p of state.players) {
      const amt = prodByPlayer[p.id]?.[res] ?? 0;
      if (amt > bestAmt) {
        bestAmt = amt;
        leaderId = p.id;
        leaderName = p.companyName;
      }
    }

    return {
      resource: res,
      name: def.name,
      emoji: def.emoji,
      playerShare,
      leaderName,
      leaderId,
    };
  });
}

export function getOverallDominanceScore(state: GameState, playerId: string): number {
  const shares = calculateMonopolyShares(state, playerId);
  const activeMarkets = shares.filter((s) => s.playerShare > 0);
  const topMarketShare = shares.reduce((max, s) => Math.max(max, s.playerShare), 0);

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;

  const totalNetWorth = state.players.reduce((sum, p) => sum + Math.max(0, p.netWorth), 0);
  const wealthShare = totalNetWorth > 0 ? (Math.max(0, player.netWorth) / totalNetWorth) * 100 : 0;

  const influenceBonus = Math.min(
    20,
    (player.influence.financial + player.influence.military + player.influence.social) / 25
  );
  const breadthBonus = activeMarkets.length * 2.0;

  return Math.min(100, Math.round(wealthShare * 0.58 + topMarketShare * 0.25 + influenceBonus + breadthBonus));
}

export function takeBankLoan(
  state: GameState,
  player: Player,
  amount: number,
  months: number
): { ok: boolean; error?: string } {
  if (amount <= 0 || amount > 5_000_000) {
    return { ok: false, error: 'Kwota kredytu musi wynosić od 1 zł do 5 000 000 zł.' };
  }
  const maxDebt = Math.max(1_500_000, player.netWorth * 1.1);
  const currentDebt = player.loans.reduce((s, l) => s + l.remainingAmount, 0);
  if (currentDebt + amount > maxDebt) {
    return { ok: false, error: 'Przekroczono maksymalną zdolność kredytową konglomeratu.' };
  }

  const mods = getPlayerEntrepreneurModifiers(state, player);
  const hasBank = state.plots.some(
    (p) => p.ownerId === player.id && p.building?.type === 'investmentBank'
  );
  const rate = Math.max(
    0.025,
    state.baseInterestRate - mods.loanInterestReduction - (hasBank ? 0.012 : 0)
  );
  const ticks = months * GAME_CONFIG.ticksPerGameMonth;
  const totalWithInterest = Math.round(amount * (1 + rate * (months / 12)));
  const paymentPerTick = Math.ceil(totalWithInterest / ticks);

  player.cash += amount;
  player.loans.push({
    id: `loan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    bankName: hasBank ? 'Własny Bank Inwestycyjny' : 'Konsorcjum Bankowe',
    principal: amount,
    interestRate: Number((rate * 100).toFixed(2)),
    remainingAmount: totalWithInterest,
    paymentPerTick,
    remainingTicks: ticks,
  });

  return { ok: true };
}

export function repayBankLoan(player: Player, loanId: string): { ok: boolean; error?: string } {
  const idx = player.loans.findIndex((l) => l.id === loanId);
  if (idx === -1) return { ok: false, error: 'Nie znaleziono kredytu.' };
  const loan = player.loans[idx];
  if (player.cash < loan.remainingAmount) {
    return { ok: false, error: 'Brak środków na pełną spłatę kapitału kredytu.' };
  }
  player.cash -= loan.remainingAmount;
  player.loans.splice(idx, 1);
  return { ok: true };
}

export function processLoansTick(player: Player): number {
  let totalPaid = 0;
  for (let i = player.loans.length - 1; i >= 0; i--) {
    const loan = player.loans[i];
    const pay = Math.min(loan.remainingAmount, loan.paymentPerTick);
    player.cash -= pay;
    loan.remainingAmount -= pay;
    loan.remainingTicks -= 1;
    totalPaid += pay;
    if (loan.remainingAmount <= 0 || loan.remainingTicks <= 0) {
      player.loans.splice(i, 1);
    }
  }
  return totalPaid;
}
