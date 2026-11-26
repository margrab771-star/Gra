import { RESOURCE_DEFINITIONS } from '../data/resources';
import { hasActiveEmbargo } from './CoalitionSystem';
import { getResourcePrice } from './EconomyEngine';
import {
  addPlotWarehouseStock,
  canTransportGoodsBetweenPlots,
  consumeReachableWarehouseStock,
  getCargoTransportModeBetweenPlayers,
} from './TransportSystem';
import type { B2BContract, GameState, Player, ResourceType } from './types';

export interface B2BFuelReceipt {
  contractId: string;
  buyerId: string;
  resource: ResourceType;
  remainingQty: number;
  arrivalPlotId: string;
  fromPlotId: string;
  mode: 'road' | 'sea' | 'air';
}

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
    const settlement = executeContractSettlement(state, contract, seller, buyer);
    if (!settlement.settled) {
      return {
        ok: false,
        error:
          contract.blockedReason ??
          'Partner lub nadawca nie posiada jeszcze wymaganego zapasu/gotówki na transakcję spot.',
      };
    }
    contract.status = 'completed';
    contract.remainingTicks = 0;
  }

  if (contract.status === 'active') {
    const check = getCargoTransportModeBetweenPlayers(state, seller.id, buyer.id, resource);
    contract.transportMode = check.mode;
    contract.blockedReason = check.reachable ? undefined : check.reason;
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
    const settlement = executeContractSettlement(state, c, seller, buyer);
    if (!settlement.settled) {
      c.status = 'cancelled';
      return {
        ok: false,
        error: c.blockedReason ?? 'Nie udało się rozliczyć kontraktu spot (brak zapasu, gotówki lub trasy).',
      };
    }
    c.remainingTicks = 0;
    c.status = 'completed';
  } else {
    const check = getCargoTransportModeBetweenPlayers(state, c.sellerId, c.buyerId, c.resource);
    c.transportMode = check.mode;
    c.blockedReason = check.reachable ? undefined : check.reason;
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
): {
  settled: boolean;
  qty: number;
  arrivalPlotId: string;
  fromPlotId: string;
  mode: 'road' | 'sea' | 'air';
} {
  if (hasActiveEmbargo(state, seller.id, buyer.id)) {
    c.transportMode = 'blocked';
    c.blockedReason = 'Aktywne embargo handlowe.';
    return { settled: false, qty: 0, arrivalPlotId: '', fromPlotId: '', mode: 'road' };
  }

  const route = getCargoTransportModeBetweenPlayers(state, seller.id, buyer.id, c.resource);
  if (!route.reachable || route.mode === 'blocked') {
    c.transportMode = 'blocked';
    c.blockedReason = route.reason ?? 'Woda odcina połączenie — zbuduj Most Drogowy, Port lub Lotnisko Cargo.';
    return { settled: false, qty: 0, arrivalPlotId: '', fromPlotId: '', mode: 'road' };
  }

  c.transportMode = route.mode;
  c.blockedReason = undefined;
  const arrivalPlot = state.plots.find((p) => p.id === route.toPlotId);
  const departurePlot = state.plots.find((p) => p.id === route.fromPlotId);
  if (!arrivalPlot || !departurePlot) {
    return { settled: false, qty: 0, arrivalPlotId: '', fromPlotId: '', mode: 'road' };
  }

  if (c.kind === 'barter' && c.barterResource && (c.barterQtyPerTick ?? 0) > 0) {
    const sellerStock = seller.warehouseStockpile[c.resource] ?? 0;
    const buyerStock = buyer.warehouseStockpile[c.barterResource] ?? 0;
    const giveRatio = Math.min(sellerStock / c.quantityPerTick, buyerStock / (c.barterQtyPerTick ?? 1), 1);
    if (giveRatio <= 0.01) {
      return { settled: false, qty: 0, arrivalPlotId: '', fromPlotId: '', mode: 'road' };
    }
    const qtyA = Number((c.quantityPerTick * giveRatio).toFixed(2));
    const qtyB = Number(((c.barterQtyPerTick ?? 1) * giveRatio).toFixed(2));

    consumeReachableWarehouseStock(state, seller, arrivalPlot, c.resource, qtyA, buyer.id);
    if ((seller.warehouseStockpile[c.resource] ?? 0) >= qtyA && (!seller.stockLocations || Object.keys(seller.stockLocations).length === 0)) {
      seller.warehouseStockpile[c.resource] = Math.max(0, (seller.warehouseStockpile[c.resource] ?? 0) - qtyA);
    }
    addPlotWarehouseStock(buyer, arrivalPlot.id, c.resource, qtyA);

    consumeReachableWarehouseStock(state, buyer, departurePlot, c.barterResource, qtyB, seller.id);
    if ((buyer.warehouseStockpile[c.barterResource] ?? 0) >= qtyB && (!buyer.stockLocations || Object.keys(buyer.stockLocations).length === 0)) {
      buyer.warehouseStockpile[c.barterResource] = Math.max(0, (buyer.warehouseStockpile[c.barterResource] ?? 0) - qtyB);
    }
    addPlotWarehouseStock(seller, departurePlot.id, c.barterResource, qtyB);

    c.totalValueDelivered += Math.round(qtyA * getResourcePrice(state, c.resource));
    if (!state.b2bRoutes) state.b2bRoutes = [];
    state.b2bRoutes.push({
      contractId: c.id,
      fromPlotId: route.fromPlotId,
      toPlotId: route.toPlotId,
      resource: c.resource,
      mode: route.mode,
      ownerId: seller.id,
    });
    return { settled: true, qty: qtyA, arrivalPlotId: arrivalPlot.id, fromPlotId: departurePlot.id, mode: route.mode };
  }

  const sellerOutput =
    c.kind === 'spot'
      ? 0
      : state.plots
          .filter(
            (p) =>
              p.ownerId === seller.id &&
              p.building?.isActive &&
              !p.building.destroyedRuins &&
              (p.building.productionPerTick[c.resource] ?? 0) > 0 &&
              canTransportGoodsBetweenPlots(state, p, arrivalPlot, seller.id, buyer.id).reachable
          )
          .reduce((sum, p) => sum + (p.building?.productionPerTick[c.resource] ?? 0), 0);

  let reachableSellerStock = 0;
  if (seller.stockLocations) {
    for (const [locId, map] of Object.entries(seller.stockLocations)) {
      const amt = map[c.resource] ?? 0;
      if (amt <= 0) continue;
      const locPlot = state.plots.find((p) => p.id === locId);
      if (locPlot && canTransportGoodsBetweenPlots(state, locPlot, arrivalPlot, seller.id, buyer.id).reachable) {
        reachableSellerStock += amt;
      }
    }
  } else {
    reachableSellerStock = seller.warehouseStockpile[c.resource] ?? 0;
  }

  const maxAvailable = c.kind === 'spot' ? reachableSellerStock : sellerOutput * 0.65 + reachableSellerStock;
  const deliverable = Number(Math.min(c.quantityPerTick, maxAvailable).toFixed(2));
  const value = Math.round(deliverable * c.pricePerUnit);

  if (deliverable > 0 && buyer.cash >= value) {
    if (seller.stockLocations) {
      consumeReachableWarehouseStock(state, seller, arrivalPlot, c.resource, deliverable, buyer.id);
    } else {
      const sellerStock = seller.warehouseStockpile[c.resource] ?? 0;
      seller.warehouseStockpile[c.resource] = Math.max(0, sellerStock - deliverable);
    }
    addPlotWarehouseStock(buyer, arrivalPlot.id, c.resource, deliverable);
    buyer.cash -= value;
    seller.cash += value * 1.04;
    c.totalValueDelivered += value;
    if (!state.b2bRoutes) state.b2bRoutes = [];
    state.b2bRoutes.push({
      contractId: c.id,
      fromPlotId: route.fromPlotId,
      toPlotId: route.toPlotId,
      resource: c.resource,
      mode: route.mode,
      ownerId: seller.id,
    });
    return {
      settled: true,
      qty: deliverable,
      arrivalPlotId: arrivalPlot.id,
      fromPlotId: departurePlot.id,
      mode: route.mode,
    };
  }
  return { settled: false, qty: 0, arrivalPlotId: '', fromPlotId: '', mode: 'road' };
}

export function processContractsTick(state: GameState): B2BFuelReceipt[] {
  state.b2bRoutes = [];
  const receipts: B2BFuelReceipt[] = [];

  for (const c of state.contracts) {
    if (c.status !== 'active') continue;
    const seller = state.players.find((p) => p.id === c.sellerId);
    const buyer = state.players.find((p) => p.id === c.buyerId);
    if (!seller || !buyer || seller.isEliminated || buyer.isEliminated) {
      c.status = 'cancelled';
      continue;
    }

    const res = executeContractSettlement(state, c, seller, buyer);
    if (res.settled && res.qty > 0) {
      receipts.push({
        contractId: c.id,
        buyerId: buyer.id,
        resource: c.resource,
        remainingQty: res.qty,
        arrivalPlotId: res.arrivalPlotId,
        fromPlotId: res.fromPlotId,
        mode: res.mode,
      });
    }

    c.remainingTicks -= 1;
    if (c.remainingTicks <= 0) {
      c.status = 'completed';
    }
  }
  return receipts;
}
