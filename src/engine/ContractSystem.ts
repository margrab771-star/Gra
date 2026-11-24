import { getResourcePrice } from './EconomyEngine';
import type { B2BContract, GameState, Player, ResourceType } from './types';

export function proposeB2BContract(
  state: GameState,
  proposer: Player,
  partnerId: string,
  resource: ResourceType,
  quantityPerTick: number,
  pricePerUnit: number,
  durationTicks: number,
  isSelling: boolean
): { ok: boolean; contract?: B2BContract; error?: string } {
  const partner = state.players.find((p) => p.id === partnerId);
  if (!partner || partner.id === proposer.id) {
    return { ok: false, error: 'Wybierz poprawnego partnera biznesowego.' };
  }
  if (quantityPerTick <= 0 || pricePerUnit <= 0 || durationTicks <= 0) {
    return { ok: false, error: 'Parametry kontraktu muszą być dodatnie.' };
  }

  const seller = isSelling ? proposer : partner;
  const buyer = isSelling ? partner : proposer;

  const contract: B2BContract = {
    id: `ctr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    sellerId: seller.id,
    buyerId: buyer.id,
    sellerName: seller.companyName,
    buyerName: buyer.companyName,
    resource,
    quantityPerTick,
    pricePerUnit,
    durationTicks,
    remainingTicks: durationTicks,
    status: partner.isAI ? evaluateAIContractAcceptance(state, partner, resource, pricePerUnit, isSelling) : 'proposed',
    totalValueDelivered: 0,
  };

  state.contracts.push(contract);
  return { ok: true, contract };
}

function evaluateAIContractAcceptance(
  state: GameState,
  ai: Player,
  resource: ResourceType,
  offeredPrice: number,
  playerIsSelling: boolean
): 'active' | 'cancelled' {
  const mkt = getResourcePrice(state, resource);
  // Jeśli gracz sprzedaje AI -> AI chętnie kupi w cenie <= 108% rynkowej (albo jeśli AI potrzebuje wsadu)
  if (playerIsSelling) {
    return offeredPrice <= mkt * 1.08 ? 'active' : 'cancelled';
  }
  // Jeśli gracz chce kupić od AI -> AI sprzeda jeśli cena >= 94% rynkowej
  return offeredPrice >= mkt * 0.94 ? 'active' : 'cancelled';
}

export function acceptB2BContract(
  state: GameState,
  player: Player,
  contractId: string
): { ok: boolean; error?: string } {
  const c = state.contracts.find((ct) => ct.id === contractId);
  if (!c) return { ok: false, error: 'Nie znaleziono kontraktu.' };
  if (c.status !== 'proposed') return { ok: false, error: 'Kontrakt nie oczekuje na akceptację.' };
  if (c.sellerId !== player.id && c.buyerId !== player.id) {
    return { ok: false, error: 'Ten kontrakt Cię nie dotyczy.' };
  }
  c.status = 'active';
  return { ok: true };
}

export function cancelB2BContract(
  state: GameState,
  player: Player,
  contractId: string
): { ok: boolean; error?: string } {
  const c = state.contracts.find((ct) => ct.id === contractId);
  if (!c) return { ok: false, error: 'Nie znaleziono kontraktu.' };
  if (c.sellerId !== player.id && c.buyerId !== player.id) {
    return { ok: false, error: 'Brak uprawnień do zerwania umowy.' };
  }
  if (c.status === 'active') {
    const penalty = Math.round(c.quantityPerTick * c.pricePerUnit * 3);
    player.cash -= penalty;
  }
  c.status = 'cancelled';
  return { ok: true };
}

export function processContractsTick(state: GameState): void {
  for (const c of state.contracts) {
    if (c.status !== 'active') continue;
    const seller = state.players.find((p) => p.id === c.sellerId);
    const buyer = state.players.find((p) => p.id === c.buyerId);
    if (!seller || !buyer || seller.isEliminated || buyer.isEliminated) {
      c.status = 'cancelled';
      continue;
    }

    const sellerOutput = state.plots
      .filter((p) => p.ownerId === seller.id && p.building?.isActive)
      .reduce((sum, p) => sum + (p.building?.productionPerTick[c.resource] ?? 0), 0);
    const sellerStock = seller.warehouseStockpile[c.resource] ?? 0;

    // Dostawa z produkcji / zapasów sprzedawcy (z marżą kontraktową bez pośrednika giełdy)
    const deliverable = Math.min(c.quantityPerTick, sellerOutput * 0.6 + sellerStock);
    const value = Math.round(deliverable * c.pricePerUnit);

    if (deliverable > 0 && buyer.cash >= value) {
      if (sellerStock >= deliverable) {
        seller.warehouseStockpile[c.resource] = sellerStock - deliverable;
      }
      buyer.warehouseStockpile[c.resource] = (buyer.warehouseStockpile[c.resource] ?? 0) + deliverable;
      buyer.cash -= value;
      seller.cash += value * 1.04; // 4% premia za bezpośredni kontrakt B2B bez prowizji maklerskiej
      c.totalValueDelivered += value;
    }

    c.remainingTicks -= 1;
    if (c.remainingTicks <= 0) {
      c.status = 'completed';
    }
  }
}
