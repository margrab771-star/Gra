import { DIFFICULTY_PRESETS, GAME_CONFIG, GOVERNMENT_CONFIGS } from '../config/gameConfig';
import { getArchetypeDefinition } from '../data/archetypes';
import { RESOURCE_DEFINITIONS } from '../data/resources';
import { formatGameDate } from '../utils/formatters';
export { hasRoadAccess, isRoadExemptBuilding } from './TransportSystem';
import type {
  Building,
  GameState,
  MarketCyclePhase,
  MarketCycleState,
  MarketSectorKey,
  MonopolyShare,
  Player,
  Plot,
  ResourceType,
} from './types';

const RESOURCE_SECTOR_MAP: Partial<Record<ResourceType, MarketSectorKey>> = {
  gold: 'gold_luxury',
  diamonds: 'gold_luxury',
  jewelry: 'gold_luxury',
  coal: 'energy',
  oil: 'energy',
  fuel: 'energy',
  uranium: 'energy',
  electricity: 'energy',
  semiconductors: 'tech',
  lithium: 'tech',
  batteries: 'tech',
  electronics: 'tech',
  rareMetals: 'tech',
  chemicals: 'tech',
  ironOre: 'industry',
  copper: 'industry',
  steel: 'industry',
  prefabs: 'industry',
  gravel: 'industry',
  weapons: 'industry',
  water: 'green',
};

export function createInitialMarketCycles(): MarketCycleState[] {
  const specs: { sector: MarketSectorKey; name: string }[] = [
    { sector: 'gold_luxury', name: 'Indeks Złota i Luksusu (GLD)' },
    { sector: 'energy', name: 'Indeks Energetyczny (NRG)' },
    { sector: 'tech', name: 'Indeks High-Tech i Baterii (TEC)' },
    { sector: 'industry', name: 'Indeks Przemysłu Ciężkiego (IND)' },
    { sector: 'green', name: 'Indeks Żywności i Mediów (ECO)' },
  ];
  return specs.map((s) => ({
    sector: s.sector,
    name: s.name,
    phase: 'hossa',
    multiplier: 1.0,
    ticksRemaining: 24 + Math.floor(Math.random() * 18),
    indexValue: 1000,
    previousIndexValue: 1000,
    changePercent: 0,
    history: [1000],
  }));
}

export function updateMarketCyclesTick(state: GameState): void {
  if (!state.marketCycles || state.marketCycles.length === 0) {
    state.marketCycles = createInitialMarketCycles();
  }

  const isVolatileMutator = Boolean(state.settings.mutators?.volatileMarket);
  const isGoldRush = state.settings.scenarioId === 'gold_rush';
  const preset = DIFFICULTY_PRESETS[state.settings.difficultyPreset ?? 'standard'] ?? DIFFICULTY_PRESETS.standard;
  const crashMult = preset.crashFreqMult * (isVolatileMutator ? 1.4 : 1);

  for (const cycle of state.marketCycles) {
    cycle.ticksRemaining -= isVolatileMutator ? 2 : 1;
    let nextPhase: MarketCyclePhase = cycle.phase;

    if (cycle.ticksRemaining <= 0) {
      const r = Math.random();
      if (cycle.phase === 'hossa') {
        nextPhase = r < 0.34 * (isVolatileMutator || isGoldRush ? 1.25 : 1) ? 'banka' : 'korekta';
        cycle.multiplier = nextPhase === 'banka' ? 1.48 + Math.random() * 0.35 : 0.88 + Math.random() * 0.08;
        cycle.ticksRemaining = nextPhase === 'banka' ? 18 + Math.floor(Math.random() * 10) : 14 + Math.floor(Math.random() * 10);
      } else if (cycle.phase === 'banka') {
        nextPhase = r < Math.min(0.88, 0.68 * crashMult) ? 'krach' : 'korekta';
        cycle.multiplier = nextPhase === 'krach' ? 0.44 + Math.random() * 0.14 : 0.78 + Math.random() * 0.1;
        cycle.ticksRemaining = nextPhase === 'krach' ? 16 + Math.floor(Math.random() * 10) : 14 + Math.floor(Math.random() * 8);
      } else if (cycle.phase === 'krach') {
        nextPhase = r < 0.72 ? 'hossa' : 'korekta';
        cycle.multiplier = nextPhase === 'hossa' ? 1.12 + Math.random() * 0.2 : 0.85 + Math.random() * 0.1;
        cycle.ticksRemaining = 22 + Math.floor(Math.random() * 16);
      } else {
        // korekta
        nextPhase = r < 0.62 ? 'hossa' : r < 0.82 ? 'korekta' : 'krach';
        cycle.multiplier =
          nextPhase === 'hossa'
            ? 1.14 + Math.random() * 0.22
            : nextPhase === 'krach'
              ? 0.52 + Math.random() * 0.1
              : 0.9 + Math.random() * 0.08;
        cycle.ticksRemaining = 20 + Math.floor(Math.random() * 14);
      }

      if (nextPhase !== cycle.phase && (nextPhase === 'banka' || nextPhase === 'krach')) {
        const hl =
          nextPhase === 'banka'
            ? `🔥 Bańka spekulacyjna: ${cycle.name}`
            : `📉 KRACH rynkowy: ${cycle.name}`;
        const br =
          nextPhase === 'banka'
            ? `Kapitał masowo płynie do sektora — wyceny surowców sięgają +${Math.round((cycle.multiplier - 1) * 100)}%!`
            : `Gwałtowna wyprzedaż w sektorze zbiła wyceny o ${Math.round((1 - cycle.multiplier) * 100)}%.`;
        state.news.unshift({
          id: `mkt_${state.time.tick}_${cycle.sector}`,
          headline: hl,
          brief: br,
          fullText: br,
          analysis: `Cykl koniunkturalny sektora ${cycle.name} przeszedł w fazę ${nextPhase.toUpperCase()}.`,
          hints: ['Sprawdź wskaźniki sektorowe klikając pasek notowań giełdowych u góry ekranu.'],
          type: nextPhase === 'banka' ? 'opportunity' : 'negative',
          dateLabel: formatGameDate(state.time),
          tick: state.time.tick,
          read: false,
        });
        if (state.news.length > 40) state.news.pop();
      }
      cycle.phase = nextPhase;
    }

    const noise = (Math.random() - 0.5) * 32;
    const targetIdx = Math.max(280, Math.round(1000 * cycle.multiplier + noise));
    cycle.previousIndexValue = cycle.indexValue;
    cycle.indexValue = Math.max(250, Math.round(cycle.indexValue + (targetIdx - cycle.indexValue) * 0.22));
    cycle.changePercent = Number(
      (((cycle.indexValue - cycle.previousIndexValue) / Math.max(1, cycle.previousIndexValue)) * 100).toFixed(2)
    );
    cycle.history = [...cycle.history.slice(-29), cycle.indexValue];
  }
}

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
    if (!def || def.tradeable === false) continue;
    const supply = Math.max(10, 80 + (supplyAccum[rp.type] ?? 0));
    const demand = Math.max(10, 80 + (demandAccum[rp.type] ?? 0));
    rp.supply = Math.round(supply);
    rp.demand = Math.round(demand);

    const imbalance = (demand - supply) / Math.max(supply, demand);
    let eventMult = (eventPriceTargets[rp.type] ?? 1) * (eventPriceTargets['all'] ?? 1);
    const sectorKey = RESOURCE_SECTOR_MAP[rp.type];
    const sectorCycle = sectorKey ? state.marketCycles?.find((c) => c.sector === sectorKey) : undefined;
    const cycleMult = sectorCycle ? sectorCycle.multiplier : 1.0;

    // Złoto i diamenty działają jako bezpieczna przystań w trakcie recesji!
    if ((rp.type === 'gold' || rp.type === 'diamonds') && isRecession) {
      eventMult = Math.max(eventMult, 1.28);
    }

    const targetPrice = def.basePrice * (1 + imbalance * def.elasticity) * eventMult * cycleMult;
    const presetVol = (DIFFICULTY_PRESETS[state.settings.difficultyPreset ?? 'standard'] ?? DIFFICULTY_PRESETS.standard).marketVolatilityMult;
    const mutVol = state.settings.mutators?.volatileMarket ? 2.0 : 1.0;
    const goldRushVol = state.settings.scenarioId === 'gold_rush' ? 1.35 : 1.0;
    const volScale = (sectorCycle?.phase === 'krach' ? 1.45 : sectorCycle?.phase === 'banka' ? 1.25 : 1.0) * presetVol * mutVol * goldRushVol;
    const noise = (Math.random() - 0.5) * 2 * def.volatility * 0.45 * volScale;
    const pullRate = sectorCycle?.phase === 'krach' ? 0.24 : 0.15;
    const meanPull = (targetPrice - rp.price) * pullRate;
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
      stockPortfolioValue += pct * st.sharePrice * 425;
    }
  }

  // Odejmij zewnętrzny akcjonariat emitenta (ponad gotówkę w rezerwie wykupu), aby nie dublować wyceny kapitału
  const ownStock = (state.stocks ?? []).find((s) => s.companyId === player.id);
  let externalDilutionValue = 0;
  if (ownStock) {
    const externalPct = Object.entries(ownStock.holdings)
      .filter(([holderId]) => holderId !== player.id)
      .reduce((sum, [, pct]) => sum + Math.max(0, pct ?? 0), 0);
    externalDilutionValue = Math.max(
      0,
      externalPct * ownStock.sharePrice * 425 - (ownStock.buybackReserve ?? 0)
    );
  }

  const loanDebt = player.loans.reduce((sum, l) => sum + l.remainingAmount, 0);
  const bondDebt = (player.bonds ?? []).reduce((sum, b) => sum + b.remainingAmount, 0);
  const raw =
    player.cash +
    plotValue +
    buildingValue +
    stockpileValue +
    stockPortfolioValue -
    externalDilutionValue -
    loanDebt -
    bondDebt;
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
  const secretBonus = player.secretGoalDominanceBonus ?? 0;

  return Math.min(100, Math.round(wealthShare * 0.58 + topMarketShare * 0.25 + influenceBonus + breadthBonus + secretBonus));
}

export function getCoalitionDominanceScore(state: GameState, memberIds: string[]): number {
  const activeSet = new Set(
    memberIds.filter((id) => state.players.some((p) => p.id === id && !p.isEliminated))
  );
  if (activeSet.size === 0) return 0;

  const trackedResources: ResourceType[] = [
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

  const prodByCoalition: Partial<Record<ResourceType, number>> = {};
  const totalByRes: Partial<Record<ResourceType, number>> = {};

  for (const plot of state.plots) {
    const b = plot.building;
    if (!b || !b.isActive) continue;
    for (const [resKey, amt] of Object.entries(b.productionPerTick)) {
      const res = resKey as ResourceType;
      const val = amt ?? 0;
      totalByRes[res] = (totalByRes[res] ?? 0) + val;
      if (activeSet.has(b.ownerId)) {
        prodByCoalition[res] = (prodByCoalition[res] ?? 0) + val;
      }
    }
  }

  let activeMarketsCount = 0;
  let topMarketShare = 0;
  for (const res of trackedResources) {
    const total = totalByRes[res] ?? 0;
    const colAmt = prodByCoalition[res] ?? 0;
    if (colAmt > 0) activeMarketsCount++;
    const share = total > 0 ? Math.round((colAmt / total) * 100) : 0;
    if (share > topMarketShare) topMarketShare = share;
  }

  const totalNetWorth = state.players.reduce((sum, p) => sum + Math.max(0, p.netWorth), 0);
  let combinedNW = 0;
  let combinedInf = 0;
  let secretBonusSum = 0;
  for (const p of state.players) {
    if (!activeSet.has(p.id)) continue;
    combinedNW += Math.max(0, p.netWorth);
    combinedInf += p.influence.financial + p.influence.military + p.influence.social;
    secretBonusSum += p.secretGoalDominanceBonus ?? 0;
  }

  const wealthShare = totalNetWorth > 0 ? (combinedNW / totalNetWorth) * 100 : 0;
  const infScale = 0.7 + activeSet.size * 0.3;
  const influenceBonus = Math.min(22, combinedInf / (25 * infScale));
  const breadthBonus = Math.min(18, activeMarketsCount * 1.8);
  const secretBonus = Math.min(12, secretBonusSum * 0.65);

  return Math.min(
    100,
    Math.round(wealthShare * 0.58 + topMarketShare * 0.25 + influenceBonus + breadthBonus + secretBonus)
  );
}

export function takeBankLoan(
  state: GameState,
  player: Player,
  amount: number,
  months: number
): { ok: boolean; error?: string } {
  if (state.settings.mutators?.noLoans) {
    return {
      ok: false,
      error: 'Mutator "Bez Kredytów": pożyczki bankowe są całkowicie zablokowane w tej rozgrywce.',
    };
  }
  const isMp = state.settings.mode === 'mp_fast' || state.settings.mode === 'mp_long';
  if (isMp && player.loans.length >= GAME_CONFIG.maxMpLoans) {
    return {
      ok: false,
      error: 'Osiągnięto limit 3 aktywnych kredytów w trybie Multiplayer. Spłać istniejące zobowiązanie.',
    };
  }
  if (amount <= 0 || amount > 5_000_000) {
    return { ok: false, error: 'Kwota kredytu musi wynosić od 1 zł do 5 000 000 zł.' };
  }
  const maxDebt = Math.max(1_500_000, player.netWorth * 1.1);
  const currentDebt = player.loans.reduce((s, l) => s + l.remainingAmount, 0);
  if (currentDebt + amount > maxDebt) {
    return { ok: false, error: 'Przekroczono maksymalną zdolność kredytową konglomeratu.' };
  }

  const mods = getPlayerEntrepreneurModifiers(state, player);
  const archInterestMult = getArchetypeDefinition(player.archetype).modifiers.loanInterestMult;
  const preset = DIFFICULTY_PRESETS[state.settings.difficultyPreset ?? 'standard'] ?? DIFFICULTY_PRESETS.standard;
  const govInterestDelta = state.government ? GOVERNMENT_CONFIGS[state.government.currentGov].interestDelta : 0;
  const hasBank = state.plots.some(
    (p) => p.ownerId === player.id && p.building?.type === 'investmentBank'
  );
  const rawRate =
    (state.baseInterestRate + preset.interestDelta + govInterestDelta - mods.loanInterestReduction - (hasBank ? 0.012 : 0)) *
    archInterestMult;
  const rate = Math.max(0.02, rawRate);
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

export function processInsolvencyAndBailiffTick(state: GameState): void {
  const preset = DIFFICULTY_PRESETS[state.settings.difficultyPreset ?? 'standard'] ?? DIFFICULTY_PRESETS.standard;
  for (const player of state.players) {
    if (player.isEliminated) continue;

    const deeplyInsolvent = player.cash < -60_000 || (player.cash < 0 && player.loans.length > 0 && player.netWorth < 0);

    if (!deeplyInsolvent) {
      if ((player.insolvencyGraceTicks ?? 0) > 0 && player.cash >= 0) {
        player.insolvencyGraceTicks = 0;
        player.insolvencyReason = undefined;
      }
      continue;
    }

    if ((player.insolvencyGraceTicks ?? 0) <= 0) {
      player.insolvencyGraceTicks = preset.bailiffGraceTicks;
      player.insolvencyReason = 'Ujemne saldo gotówkowe i zaległe zobowiązania wobec wierzycieli';
      const br = `Spółka odnotowała krytyczny deficyt gotówki (${Math.round(player.cash).toLocaleString('pl-PL')} zł). Za ${preset.bailiffGraceTicks} cykli komornik rozpocznie przymusową licytację działek i majątku!`;
      state.news.unshift({
        id: `bailiff_warn_${state.time.tick}_${player.id}`,
        headline: `⚠️ Ostateczne Wezwanie Komornicze dla ${player.companyName}`,
        brief: br,
        fullText: br,
        analysis: 'Niewypłacalność spółki uruchamia procedurę zajęcia i licytacji majątku.',
        hints: ['Sprzedaj zapasy, weź kredyt lub spienięż zbędną działkę przed upływem ostrzeżenia.'],
        type: 'negative',
        dateLabel: formatGameDate(state.time),
        tick: state.time.tick,
        read: false,
      });
      if (state.news.length > 40) state.news.pop();
      continue;
    }

    player.insolvencyGraceTicks = (player.insolvencyGraceTicks ?? 1) - 1;
    if (player.insolvencyGraceTicks > 0) continue;

    // Egzekucja komornicza majątku!
    const ownedPlots = state.plots.filter((p) => p.ownerId === player.id);
    if (ownedPlots.length === 0) {
      player.isEliminated = true;
      player.insolvencyReason = 'Ogłoszono upadłość likwidacyjną (brak majątku na pokrycie długów)';
      for (const c of state.contracts) {
        if ((c.buyerId === player.id || c.sellerId === player.id) && c.status !== 'completed') {
          c.status = 'cancelled';
        }
      }
      if (state.coalitions) {
        for (const col of state.coalitions) {
          col.memberIds = col.memberIds.filter((id) => id !== player.id);
        }
      }
      const br = `Sąd gospodarczy zamknął działalność firmy ${player.companyName} po bezskutecznej egzekucji długów.`;
      state.news.unshift({
        id: `bankrupt_${state.time.tick}_${player.id}`,
        headline: `💀 UPADŁOŚĆ LIKWIDACYJNA: ${player.companyName}`,
        brief: br,
        fullText: br,
        analysis: 'Podmiot został wykluczony z obrotu giełdowego i umów B2B.',
        hints: ['Utrzymuj dodatnie saldo gotówkowe i bezpieczny limit zadłużenia.'],
        type: 'negative',
        dateLabel: formatGameDate(state.time),
        tick: state.time.tick,
        read: false,
      });
      if (state.news.length > 40) state.news.pop();
      continue;
    }

    // Licytuj najcenniejszy składnik majątku (preferuj nie-HQ, na końcu HQ)
    const sortedForAuction: Plot[] = [...ownedPlots].sort((a, b) => {
      const aIsHq = a.building?.type === 'corporateHQ' ? 1 : 0;
      const bIsHq = b.building?.type === 'corporateHQ' ? 1 : 0;
      if (aIsHq !== bIsHq) return aIsHq - bIsHq;
      const valA = a.price + (a.building ? getBuildingBookValue(a.building) * 0.65 : 0);
      const valB = b.price + (b.building ? getBuildingBookValue(b.building) * 0.65 : 0);
      return valB - valA;
    });

    const targetPlot = sortedForAuction[0];
    const auctionValue = Math.max(
      45_000,
      Math.round((targetPlot.price + (targetPlot.building ? getBuildingBookValue(targetPlot.building) * 0.65 : 0)) * 0.62)
    );
    const seizedName = targetPlot.building ? `${targetPlot.building.name} + działka` : `działka (${targetPlot.gridX},${targetPlot.gridY})`;

    if (player.statsAccum) {
      player.statsAccum.bailiffSeizures = (player.statsAccum.bailiffSeizures ?? 0) + 1;
    }

    // Jeśli działka posiada wartościowy budynek i brak innej aktywnej licytacji, otwórz 30-sekundową Licytację na Żywo
    const seizedBuilding = targetPlot.building && targetPlot.building.type !== 'corporateHQ' && !targetPlot.building.destroyedRuins;
    if (seizedBuilding && !state.liveAuction) {
      targetPlot.ownerId = null;
      targetPlot.purchasable = false; // zablokowana do czasu zakończenia 30s aukcji
      targetPlot.building!.ownerId = 'auction_escrow';
      const now = Date.now();
      state.liveAuction = {
        id: `auc_${state.time.tick}_${targetPlot.id}`,
        plotId: targetPlot.id,
        gridX: targetPlot.gridX,
        gridY: targetPlot.gridY,
        title: `Licytacja Komornicza: ${targetPlot.building!.name}`,
        description: `Zajęty obiekt dłużnika ${player.companyName} na polu (${targetPlot.gridX}, ${targetPlot.gridY}) wraz z wyposażeniem.`,
        startingBid: auctionValue,
        currentBid: auctionValue,
        highestBidderId: null,
        highestBidderName: null,
        minIncrement: Math.max(15_000, Math.round(auctionValue * 0.08 / 1000) * 1000),
        secondsRemaining: 30,
        startedAtMs: now,
        expiresAtMs: now + 30_000,
        bidsCount: 0,
        sellerPlayerId: player.id,
        status: 'active',
      };
    } else {
      targetPlot.ownerId = null;
      targetPlot.building = null;
      targetPlot.hasRoad = false;
      targetPlot.roadType = 'none';
      targetPlot.tollRate = 'free';
      targetPlot.roadBlocked = false;
      targetPlot.blockedPlayers = [];
      targetPlot.isPlayerRoad = false;
      targetPlot.purchasable = targetPlot.terrain !== 'water' && (targetPlot.irradiatedTicks ?? 0) <= 0;
    }

    state.networkRevision = (state.networkRevision ?? 0) + 1;

    player.cash += auctionValue;
    player.insolvencyGraceTicks = player.cash < 0 ? Math.max(4, Math.round(preset.bailiffGraceTicks * 0.5)) : 0;
    if (player.cash >= 0) player.insolvencyReason = undefined;

    const brAuction = `Komornik zlicytował majątek na działce (${targetPlot.gridX}, ${targetPlot.gridY}) za ${auctionValue.toLocaleString('pl-PL')} zł na pokrycie długów.`;
    state.news.unshift({
      id: `bailiff_seize_${state.time.tick}_${player.id}`,
      headline: `🔨 Egzekucja Komornicza: ${player.companyName} straciła ${seizedName}`,
      brief: brAuction,
      fullText: brAuction,
      analysis: 'Kliknij powiadomienie, aby przejść bezpośrednio do zlicytowanej nieruchomości.',
      hints: ['Ogranicz koszty stałe lub wypowiedz nierentowne obiekty zanim komornik zajmie kolejne.'],
      type: 'negative',
      dateLabel: formatGameDate(state.time),
      tick: state.time.tick,
      read: false,
      focusPlotId: targetPlot.id,
    });
    if (state.news.length > 40) state.news.pop();
  }
}

export function calculateCoalitionNetWorthSum(state: GameState, coalitionId: string): number {
  const col = (state.coalitions ?? []).find((c) => c.id === coalitionId);
  if (!col) return 0;
  let sum = 0;
  for (const mId of col.memberIds) {
    const p = state.players.find((pl) => pl.id === mId && !pl.isEliminated);
    if (p) sum += Math.max(0, p.netWorth);
  }
  return sum;
}
