import { formatGameDate } from '../utils/formatters';
import { getResourcePrice } from './EconomyEngine';
import type { CorporateStock, GameState, Player } from './types';

export function syncCorporateStocks(state: GameState): void {
  if (!state.stocks) state.stocks = [];
  const nextStocks: CorporateStock[] = [];

  for (const p of state.players) {
    if (p.isEliminated) continue;
    const existing = state.stocks.find((s) => s.companyId === p.id);
    const fundamentalPrice = Math.max(
      18,
      Math.round(
        (p.netWorth / 100_000 + Math.max(-15, p.cashFlowPerMin / 25_000) + p.reputation * 0.4) *
          (1 - (p.inspectionRisk ?? 0) * 0.0025)
      )
    );
    const prevPrice = existing?.sharePrice ?? fundamentalPrice;
    const newPrice = Math.max(
      12,
      Math.round(prevPrice * 0.65 + fundamentalPrice * 0.35)
    );
    const changePct =
      prevPrice > 0 ? Number((((newPrice - prevPrice) / prevPrice) * 100).toFixed(2)) : 0;

    const dividendPerShare = p.cashFlowPerMin > 10_000 ? Math.round((p.cashFlowPerMin / 60) * 0.0035) : 0;

    nextStocks.push({
      companyId: p.id,
      companyName: p.companyName,
      color: p.color,
      sharePrice: newPrice,
      previousPrice: prevPrice,
      changePercent: changePct,
      priceHistory: [...(existing?.priceHistory ?? [newPrice]).slice(-23), newPrice],
      dividendPerShareTick: dividendPerShare,
      totalDividendsPaid: existing?.totalDividendsPaid ?? 0,
      holdings: existing?.holdings ?? { [p.id]: 100 },
    });
  }

  state.stocks = nextStocks;
}

export function tradeCorporateStock(
  state: GameState,
  buyer: Player,
  targetCompanyId: string,
  shareDeltaPercent: number
): { ok: boolean; message: string } {
  syncCorporateStocks(state);
  const stock = state.stocks.find((s) => s.companyId === targetCompanyId);
  const targetPlayer = state.players.find((p) => p.id === targetCompanyId);
  if (!stock || !targetPlayer) {
    return { ok: false, message: 'Nie znaleziono wybranej spółki na giełdzie.' };
  }
  if (targetCompanyId === buyer.id) {
    return { ok: false, message: 'Własny pakiet kontrolny posiadasz automatycznie na starcie.' };
  }

  const currentStake = stock.holdings[buyer.id] ?? 0;
  const issuerStake = stock.holdings[targetCompanyId] ?? 100;

  // Zakup akcji (+5% lub +10%)
  if (shareDeltaPercent > 0) {
    const buyPct = Math.min(shareDeltaPercent, issuerStake);
    if (buyPct <= 0) {
      return { ok: false, message: 'Właściciel wyczerpał pulę wolnych udziałów na sprzedaż.' };
    }
    const cost = Math.round(buyPct * stock.sharePrice * 450);
    if (buyer.cash < cost) {
      return {
        ok: false,
        message: `Brak środków na zakup ${buyPct}% akcji (${cost.toLocaleString('pl-PL')} zł).`,
      };
    }

    buyer.cash -= cost;
    targetPlayer.cash += cost;
    stock.holdings[buyer.id] = currentStake + buyPct;
    stock.holdings[targetCompanyId] = Math.max(0, issuerStake - buyPct);

    if (stock.holdings[buyer.id] >= 15) {
      buyer.spiedPlayers[targetCompanyId] = Math.max(buyer.spiedPlayers[targetCompanyId] ?? 0, 20);
    }

    return {
      ok: true,
      message: `Kupiono ${buyPct}% akcji ${targetPlayer.companyName} za ${cost.toLocaleString('pl-PL')} zł.`,
    };
  }

  // Sprzedaż posiadanych akcji (-5% lub -10%)
  const sellPct = Math.min(Math.abs(shareDeltaPercent), currentStake);
  if (sellPct <= 0) {
    return { ok: false, message: 'Nie posiadasz udziałów tej firmy do sprzedaży.' };
  }
  const proceeds = Math.round(sellPct * stock.sharePrice * 440);
  buyer.cash += proceeds;
  stock.holdings[buyer.id] = Math.max(0, currentStake - sellPct);
  stock.holdings[targetCompanyId] = issuerStake + sellPct;
  return {
    ok: true,
    message: `Sprzedano ${sellPct}% akcji ${targetPlayer.companyName} za ${proceeds.toLocaleString('pl-PL')} zł.`,
  };
}

export function issueCorporateBondForPlayer(
  state: GameState,
  player: Player,
  amount: number
): { ok: boolean; error?: string } {
  if (player.corporationLevel < 2) {
    return { ok: false, error: 'Emisja obligacji korporacyjnych wymaga min. Etapu 2 (Przedsiębiorstwo).' };
  }
  if ((player.bonds?.length ?? 0) >= 3) {
    return { ok: false, error: 'Osiągnięto limit 3 równoległych serii obligacji korporacyjnych.' };
  }
  if (amount < 250_000 || amount > 5_000_000) {
    return { ok: false, error: 'Wartość emisji musi mieścić się między 250 tys. a 5 mln zł.' };
  }

  const rate = Math.max(0.032, Number((state.baseInterestRate * 0.72).toFixed(4)));
  const duration = 24;
  const totalRepay = Math.round(amount * (1 + rate));
  const perTick = Math.round(totalRepay / duration);

  player.cash += amount;
  if (!player.bonds) player.bonds = [];
  player.bonds.push({
    id: `bond_${state.time.tick}_${Math.random().toString(36).slice(2, 6)}`,
    issuerId: player.id,
    principal: amount,
    couponRate: rate,
    remainingAmount: totalRepay,
    paymentPerTick: perTick,
    remainingTicks: duration,
  });
  return { ok: true };
}

export function executeGreyMarketActionForPlayer(
  state: GameState,
  player: Player,
  actionId: 'black_arms' | 'black_fuel' | 'tax_shelter' | 'bribe_auditor'
): { ok: boolean; message: string } {
  player.inspectionRisk = player.inspectionRisk ?? 0;

  switch (actionId) {
    case 'black_arms': {
      const mktPrice = getResourcePrice(state, 'weapons');
      const qty = 20;
      const cost = Math.round(qty * mktPrice * 0.68);
      if (player.cash < cost) {
        return { ok: false, message: `Brak środków na zakup z szarej strefy (${cost.toLocaleString('pl-PL')} zł).` };
      }
      player.cash -= cost;
      player.warehouseStockpile.weapons = (player.warehouseStockpile.weapons ?? 0) + qty;
      player.inspectionRisk = Math.min(100, player.inspectionRisk + 14);
      return {
        ok: true,
        message: `Dostawa z szarej strefy: +${qty} szt. Broni za ${cost.toLocaleString('pl-PL')} zł (-32% od ceny giełdy). Uwaga: ryzyko kontroli +14%!`,
      };
    }

    case 'black_fuel': {
      const fuelP = getResourcePrice(state, 'fuel');
      const chemP = getResourcePrice(state, 'chemicals');
      const cost = Math.round((50 * fuelP + 25 * chemP) * 0.66);
      if (player.cash < cost) {
        return { ok: false, message: `Brak gotówki (${cost.toLocaleString('pl-PL')} zł).` };
      }
      player.cash -= cost;
      player.warehouseStockpile.fuel = (player.warehouseStockpile.fuel ?? 0) + 50;
      player.warehouseStockpile.chemicals = (player.warehouseStockpile.chemicals ?? 0) + 25;
      player.inspectionRisk = Math.min(100, player.inspectionRisk + 12);
      return {
        ok: true,
        message: `Czarny rynek: +50 paliwa i +25 chemikaliów poza oficjalnym obrotem! Ryzyko kontroli +12%.`,
      };
    }

    case 'tax_shelter': {
      player.activeTaxReliefTicks = Math.max(player.activeTaxReliefTicks, 18);
      player.inspectionRisk = Math.min(100, player.inspectionRisk + 18);
      return {
        ok: true,
        message: `Raj podatkowy uruchomiony: -40% podatku CIT przez 18 cykli (Ryzyko kontroli +18%).`,
      };
    }

    case 'bribe_auditor': {
      const cost = 95_000;
      if (player.cash < cost) {
        return { ok: false, message: `Brak środków (${cost.toLocaleString('pl-PL')} zł).` };
      }
      player.cash -= cost;
      player.inspectionRisk = Math.max(0, player.inspectionRisk - 30);
      return {
        ok: true,
        message: `Zatuszowano dokumentację księgową — ryzyko kontroli spadło o 30% (obecnie: ${Math.round(player.inspectionRisk)}%).`,
      };
    }
  }
}

export function processStockDividendsAndBondsTick(state: GameState): void {
  syncCorporateStocks(state);

  // 1. Kupony obligacji korporacyjnych
  for (const player of state.players) {
    if (!player.bonds) player.bonds = [];
    const remaining = [];
    for (const bond of player.bonds) {
      const pay = Math.min(bond.remainingAmount, bond.paymentPerTick);
      player.cash -= pay;
      bond.remainingAmount -= pay;
      bond.remainingTicks -= 1;
      player.lastTickCostsByCategory['Raty Kredytowe'] =
        (player.lastTickCostsByCategory['Raty Kredytowe'] ?? 0) + pay;
      if (bond.remainingAmount > 0 && bond.remainingTicks > 0) {
        remaining.push(bond);
      }
    }
    player.bonds = remaining;

    // 2. Kontrwywiad / Lobby stopniowo zmniejsza ryzyko kontroli, ale wysokie ryzyko grozi skandalem
    const hasCounterIntel = state.plots.some(
      (pl) =>
        pl.ownerId === player.id &&
        pl.building?.isActive &&
        (pl.building.type === 'policeStation' || pl.building.type === 'lobbyOffice')
    );
    player.inspectionRisk = Math.max(
      0,
      (player.inspectionRisk ?? 0) - (hasCounterIntel ? 1.8 : 0.6)
    );

    if (player.inspectionRisk >= 42 && Math.random() < (player.inspectionRisk - 32) * 0.0065) {
      const penalty = Math.round(Math.max(120_000, player.cash * 0.06));
      player.cash -= penalty;
      player.inspectionRisk = Math.max(10, player.inspectionRisk - 35);
      player.reputation = Math.max(5, player.reputation - 15);
      state.voterMood = Math.max(-100, state.voterMood - 10);

      const stock = state.stocks.find((s) => s.companyId === player.id);
      if (stock) {
        stock.sharePrice = Math.max(12, Math.round(stock.sharePrice * 0.82));
      }

      if (player.id === state.currentPlayerId) {
        state.news = [
          {
            id: `audit_${state.time.tick}_${player.id}`,
            headline: `SKANDAL PODATKOWY! Kontrola skarbowa uderza w ${player.companyName}`,
            brief: `Wykryto operacje z szarej strefy! Nałożono karę ${penalty.toLocaleString('pl-PL')} zł, a kurs akcji spadł o 18%.`,
            fullText: `Organy nadzoru ujawniły nieprawidłowości celne i optymalizacyjne w koncernie ${player.companyName}. Inwestorzy masowo wyprzedają akcje.`,
            analysis: 'Utrzymuj niski Wskaźnik Ryzyka Kontroli lub inwestuj w Posterunki Policji (Kontrwywiad) oraz Biuro Lobbingu.',
            hints: ['Unikaj kumulowania powyżej 40% Ryzyka Kontroli bez ochrony lobbystów.'],
            type: 'negative' as const,
            dateLabel: formatGameDate(state.time),
            tick: state.time.tick,
            read: false,
          },
          ...state.news,
        ].slice(0, 35);
      }
    }
  }

  // 3. Wypłata dywidend giełdowych co 5 cykli
  if (state.time.tick % 5 !== 0) return;
  for (const stock of state.stocks) {
    if (stock.dividendPerShareTick <= 0) continue;
    const issuer = state.players.find((p) => p.id === stock.companyId);
    if (!issuer || issuer.cash < 50_000) continue;

    for (const [holderId, stakePct] of Object.entries(stock.holdings)) {
      if (holderId === stock.companyId || stakePct <= 0) continue;
      const holder = state.players.find((p) => p.id === holderId);
      if (!holder) continue;
      const dividendPayout = Math.round(stock.dividendPerShareTick * stakePct * 60);
      if (dividendPayout > 0 && issuer.cash >= dividendPayout) {
        issuer.cash -= dividendPayout;
        holder.cash += dividendPayout;
        stock.totalDividendsPaid += dividendPayout;
        holder.lastTickRevenueByCategory['Dywidendy z Akcji'] =
          (holder.lastTickRevenueByCategory['Dywidendy z Akcji'] ?? 0) + dividendPayout;
      }
    }
  }
}
