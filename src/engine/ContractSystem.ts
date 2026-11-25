import { RESOURCE_DEFINITIONS } from '../data/resources';
import { hasActiveEmbargo } from './CoalitionSystem';
import { getResourcePrice } from './EconomyEngine';
import type { B2BContract, GameState, Player, ResourceType } from './types';

export interface ProposeContractOptions {
  kind?: 'recurring' | 'spot' | 'barter';
  barterResource?: ResourceType;
  barterQtyPerTick?: number;
  openListing?: boolean;
}

export function proposeB2BContract(
  state: GameState,
  proposer: Player,
  partnerId: string,
  resource: ResourceType,
  quantityPerTick: number,
  pricePerUnit: number,
  durationTicks: number,
  isSelling: boolean,
  opts: ProposeContractOptions = {}
): { ok: boolean; contract?: B2BContract; error?: string } {
  const resDef = RESOURCE_DEFINITIONS[resource];
  if (!resDef || resDef.tradeable === false) {
    return { ok: false, error: 'Tego medium/odpadu nie można obracać na giełdzie B2B.' };
  }

  const kind = opts.kind ?? 'recurring';
  const effectiveDuration = kind === 'spot' ? 1 : durationTicks;
  if (quantityPerTick <= 0 || effectiveDuration <= 0) {
    return { ok: false, error: 'Ilość i czas trwania kontraktu muszą być dodatnie.' };
  }
  if (kind !== 'barter' && pricePerUnit <= 0) {
    return { ok: false, error: 'Cena jednostkowa musi być dodatnia.' };
  }
  if (kind === 'barter' && (!opts.barterResource || (opts.barterQtyPerTick ?? 0) <= 0)) {
    return { ok: false, error: 'Dla wymiany barterowej wybierz drugi surowiec oraz ilość.' };
  }

  const isOpenListing = Boolean(opts.openListing || partnerId === 'OPEN');

  if (isOpenListing) {
    const contract: B2BContract = {
      id: `ctr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      sellerId: isSelling ? proposer.id : '',
      buyerId: isSelling ? '' : proposer.id,
      sellerName: isSelling ? proposer.companyName : 'Otwarte zlecenie kupna',
      buyerName: isSelling ? 'Otwarta oferta sprzedaży' : proposer.companyName,
      resource,
      quantityPerTick,
      pricePerUnit: kind === 'barter' ? 0 : pricePerUnit,
      durationTicks: effectiveDuration,
      remainingTicks: effectiveDuration,
      status: 'open_listing',
      totalValueDelivered: 0,
      kind,
      barterResource: opts.barterResource,
      barterQtyPerTick: opts.barterQtyPerTick,
      listingSide: isSelling ? 'sell' : 'buy',
    };
    state.contracts.push(contract);
    return { ok: true, contract };
  }

  const partner = state.players.find((p) => p.id === partnerId);
  if (!partner || partner.id === proposer.id) {
    return { ok: false, error: 'Wybierz poprawnego partnera biznesowego.' };
  }
  if (hasActiveEmbargo(state, proposer.id, partner.id)) {
    return { ok: false, error: 'Aktywne embargo handlowe uniemożliwia zawarcie kontraktu z tą firmą.' };
  }

  const seller = isSelling ? proposer : partner;
  const buyer = isSelling ? partner : proposer;

  const initialStatus = partner.isAI
    ? evaluateAIContractAcceptance(state, partner, resource, pricePerUnit, isSelling, kind)
    : 'proposed';

  const contract: B2BContract = {
    id: `ctr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    sellerId: seller.id,
    buyerId: buyer.id,
    sellerName: seller.companyName,
    buyerName: buyer.companyName,
    resource,
    quantityPerTick,
    pricePerUnit: kind === 'barter' ? 0 : pricePerUnit,
    durationTicks: effectiveDuration,
    remainingTicks: effectiveDuration,
    status: initialStatus,
    totalValueDelivered: 0,
    kind,
    barterResource: opts.barterResource,
    barterQtyPerTick: opts.barterQtyPerTick,
  };

  if (contract.status === 'active' && kind === 'spot') {
    const settled = executeContractSettlement(state, contract, seller, buyer);
    if (!settled) {
      return { ok: false, error: 'Partner lub nadawca nie posiada jeszcze wymaganego zapasu/gotówki na transakcję spot.' };
    }
    contract.status = 'completed';
    contract.remainingTicks = 0;
  }

  state.contracts.push(contract);
  return { ok: true, contract };
}

function evaluateAIContractAcceptance(
  state: GameState,
  ai: Player,
  resource: ResourceType,
  offeredPrice: number,
  playerIsSelling: boolean,
  kind: 'recurring' | 'spot' | 'barter'
): 'active' | 'cancelled' {
  if (kind === 'barter') return (ai.warehouseStockpile[resource] ?? 0) >= 0 ? 'active' : 'cancelled';
  const mkt = getResourcePrice(state, resource);
  if (playerIsSelling) {
    return offeredPrice <= mkt * 1.1 ? 'active' : 'cancelled';
  }
  return offeredPrice >= mkt * 0.92 ? 'active' : 'cancelled';
}

export function acceptB2BContract(
  state: GameState,
  player: Player,
  contractId: string
): { ok: boolean; error?: string } {
  const c = state.contracts.find((ct) => ct.id === contractId);
  if (!c) return { ok: false, error: 'Nie znaleziono kontraktu.' };

  if (c.status === 'open_listing') {
    const ownerId = c.listingSide === 'sell' ? c.sellerId : c.buyerId;
    if (ownerId === player.id) {
      return { ok: false, error: 'Nie możesz przyjąć własnej oferty giełdowej.' };
    }
    if (hasActiveEmbargo(state, ownerId, player.id)) {
      return { ok: false, error: 'Aktywne embargo blokuje wymianę z wystawcą oferty.' };
    }
    if (c.listingSide === 'sell') {
      c.buyerId = player.id;
      c.buyerName = player.companyName;
    } else {
      c.sellerId = player.id;
      c.sellerName = player.companyName;
    }
    c.status = 'active';
  } else {
    if (c.status !== 'proposed') return { ok: false, error: 'Kontrakt nie oczekuje na akceptację.' };
    if (c.sellerId !== player.id && c.buyerId !== player.id) {
      return { ok: false, error: 'Ten kontrakt Cię nie dotyczy.' };
    }
    if (hasActiveEmbargo(state, c.sellerId, c.buyerId)) {
      return { ok: false, error: 'Aktywne embargo blokuje aktywację tej umowy.' };
    }
    c.status = 'active';
  }

  if (c.kind === 'spot') {
    const seller = state.players.find((p) => p.id === c.sellerId);
    const buyer = state.players.find((p) => p.id === c.buyerId);
    if (!seller || !buyer) return { ok: false, error: 'Brak strony kontraktu.' };
    executeContractSettlement(state, c, seller, buyer);
    c.remainingTicks = 0;
    c.status = 'completed';
  }

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
  if (c.status === 'active' && c.kind !== 'spot') {
    const penalty = Math.round(c.quantityPerTick * Math.max(100, c.pricePerUnit) * 2.5);
    player.cash -= penalty;
  }
  c.status = 'cancelled';
  return { ok: true };
}

function executeContractSettlement(
  state: GameState,
  c: B2BContract,
  seller: Player,
  buyer: Player
): boolean {
  if (hasActiveEmbargo(state, seller.id, buyer.id)) return false;

  if (c.kind === 'barter' && c.barterResource && (c.barterQtyPerTick ?? 0) > 0) {
    const sellerStock = seller.warehouseStockpile[c.resource] ?? 0;
    const buyerStock = buyer.warehouseStockpile[c.barterResource] ?? 0;
    const giveRatio = Math.min(sellerStock / c.quantityPerTick, buyerStock / (c.barterQtyPerTick ?? 1), 1);
    if (giveRatio <= 0.01) return false;
    const qtyA = Number((c.quantityPerTick * giveRatio).toFixed(2));
    const qtyB = Number(((c.barterQtyPerTick ?? 1) * giveRatio).toFixed(2));

    seller.warehouseStockpile[c.resource] = Math.max(0, sellerStock - qtyA);
    buyer.warehouseStockpile[c.resource] = (buyer.warehouseStockpile[c.resource] ?? 0) + qtyA;
    buyer.warehouseStockpile[c.barterResource] = Math.max(0, buyerStock - qtyB);
    seller.warehouseStockpile[c.barterResource] = (seller.warehouseStockpile[c.barterResource] ?? 0) + qtyB;
    c.totalValueDelivered += Math.round(qtyA * getResourcePrice(state, c.resource));
    return true;
  }

  const sellerOutput =
    c.kind === 'spot'
      ? 0
      : state.plots
          .filter((p) => p.ownerId === seller.id && p.building?.isActive && !p.building.destroyedRuins)
          .reduce((sum, p) => sum + (p.building?.productionPerTick[c.resource] ?? 0), 0);
  const sellerStock = seller.warehouseStockpile[c.resource] ?? 0;
  const maxAvailable = c.kind === 'spot' ? sellerStock : sellerOutput * 0.65 + sellerStock;
  const deliverable = Math.min(c.quantityPerTick, maxAvailable);
  const value = Math.round(deliverable * c.pricePerUnit);

  if (deliverable > 0 && buyer.cash >= value) {
    if (sellerStock >= deliverable) {
      seller.warehouseStockpile[c.resource] = sellerStock - deliverable;
    } else if (sellerStock > 0) {
      seller.warehouseStockpile[c.resource] = 0;
    }
    buyer.warehouseStockpile[c.resource] = (buyer.warehouseStockpile[c.resource] ?? 0) + deliverable;
    buyer.cash -= value;
    seller.cash += value * 1.04;
    c.totalValueDelivered += value;
    return true;
  }
  return false;
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

    executeContractSettlement(state, c, seller, buyer);

    c.remainingTicks -= 1;
    if (c.remainingTicks <= 0) {
      c.status = 'completed';
    }
  }
}
