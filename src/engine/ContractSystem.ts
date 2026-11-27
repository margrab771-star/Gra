import { formatGameDate } from '../utils/formatters';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { RESOURCE_DEFINITIONS } from '../data/resources';
import { hasActiveEmbargo } from './CoalitionSystem';
import { getPowerPlantFuelSpec } from './BuildingSystem';
import { getResourcePrice } from './EconomyEngine';
import {
  addPlotWarehouseStock,
  canTransportGoodsBetweenPlots,
  consumeReachableWarehouseStock,
  getCargoTransportModeBetweenPlayers,
} from './TransportSystem';
import type { B2BContract, CashTransferRecord, GameState, Player, ResourceType } from './types';

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
      proposerId: proposer.id,
      createdTick: state.time.tick,
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

  const initialStatus: B2BContract['status'] = partner.isAI
    ? evaluateAIContractAcceptance(
        state,
        partner,
        resource,
        pricePerUnit,
        quantityPerTick,
        isSelling,
        kind,
        opts.barterResource,
        opts.barterQtyPerTick
      )
    : 'pending';

  const contract: B2BContract = {
    id: `ctr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    sellerId: seller.id,
    buyerId: buyer.id,
    sellerName: seller.companyName,
    buyerName: buyer.companyName,
    proposerId: proposer.id,
    responderId: partner.id,
    createdTick: state.time.tick,
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

function getAIResourceConsumptionAndOutput(
  state: GameState,
  ai: Player,
  resource: ResourceType
): { needPerTick: number; ownOutputPerTick: number } {
  let needPerTick = 0;
  let ownOutputPerTick = 0;
  for (const pl of state.plots) {
    if (pl.ownerId !== ai.id || !pl.building || !pl.building.isActive || pl.building.destroyedRuins) continue;
    const def = BUILDING_DEFINITIONS[pl.building.type];
    const eff = Math.max(0.25, (pl.building.efficiency || 65) / 100);
    const inQty = def?.inputs?.[resource] ?? 0;
    if (inQty > 0) needPerTick += inQty * eff;
    const fuelSpec = getPowerPlantFuelSpec(pl.building.type);
    if (fuelSpec && fuelSpec.acceptedResources.includes(resource) && !(def?.inputs?.[resource] ?? 0)) {
      needPerTick += fuelSpec.consumptionPerTick * eff;
    }
    const outQty = pl.building.productionPerTick?.[resource] ?? def?.outputs?.[resource] ?? 0;
    if (outQty > 0) ownOutputPerTick += outQty;
  }
  return { needPerTick, ownOutputPerTick };
}

function evaluateAIContractAcceptance(
  state: GameState,
  ai: Player,
  resource: ResourceType,
  offeredPrice: number,
  quantityPerTick: number,
  playerIsSelling: boolean,
  kind: 'recurring' | 'spot' | 'barter',
  barterResource?: ResourceType,
  barterQtyPerTick?: number
): 'active' | 'cancelled' {
  const mkt = getResourcePrice(state, resource);
  const { needPerTick, ownOutputPerTick } = getAIResourceConsumptionAndOutput(state, ai, resource);
  const currentStock = ai.warehouseStockpile[resource] ?? 0;

  if (kind === 'barter') {
    if (!barterResource || !barterQtyPerTick || barterQtyPerTick <= 0) return 'cancelled';
    const wantBarterVal = barterQtyPerTick * getResourcePrice(state, barterResource);
    const giveVal = quantityPerTick * mkt;
    const aiGivesNeed = getAIResourceConsumptionAndOutput(state, ai, barterResource).needPerTick;
    const aiGivesStock = ai.warehouseStockpile[barterResource] ?? 0;
    return (needPerTick > 0.05 || wantBarterVal <= giveVal * 1.1) &&
      aiGivesStock >= barterQtyPerTick &&
      (aiGivesNeed <= 0.01 || aiGivesStock > aiGivesNeed * 4)
      ? 'active'
      : 'cancelled';
  }

  if (playerIsSelling) {
    // AI kupuje wyłącznie surowce, których faktycznie potrzebuje (wsad produkcyjny lub paliwo), w rozsądnej ilości i budżecie!
    if (needPerTick <= 0.01) return 'cancelled';
    if (offeredPrice > mkt * 1.06) return 'cancelled';
    const maxUsefulQty = Math.max(2, needPerTick * 1.6);
    if (quantityPerTick > maxUsefulQty) return 'cancelled';
    if (currentStock >= needPerTick * 10 + 12) return 'cancelled';
    const tickCost = offeredPrice * quantityPerTick;
    if (ai.cash < 220_000 + tickCost * 4 || tickCost > Math.max(8_000, ai.cash * 0.04)) {
      return 'cancelled';
    }
    return 'active';
  }

  // AI sprzedaje tylko realną nadwyżkę ponad potrzeby własnych fabryk i elektrowni
  if (offeredPrice < mkt * 0.94) return 'cancelled';
  const hasRealSurplus = ownOutputPerTick > needPerTick + 0.5 || currentStock > needPerTick * 6 + 6;
  return hasRealSurplus ? 'active' : 'cancelled';
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
    if (c.status !== 'pending' && c.status !== 'proposed') {
      return { ok: false, error: 'Kontrakt nie oczekuje na akceptację.' };
    }
    if (c.sellerId !== player.id && c.buyerId !== player.id) {
      return { ok: false, error: 'Ten kontrakt Cię nie dotyczy.' };
    }
    if (c.proposerId === player.id || (c.responderId && c.responderId !== player.id)) {
      return { ok: false, error: 'Tylko odbiorca oferty może zatwierdzić tę umowę B2B.' };
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
    if (seller.statsAccum) {
      seller.statsAccum.b2bContractsCompleted = (seller.statsAccum.b2bContractsCompleted ?? 0) + 1;
    }
    if (buyer.statsAccum) {
      buyer.statsAccum.b2bContractsCompleted = (buyer.statsAccum.b2bContractsCompleted ?? 0) + 1;
    }
  } else {
    const check = getCargoTransportModeBetweenPlayers(state, c.sellerId, c.buyerId, c.resource);
    c.transportMode = check.mode;
    c.blockedReason = check.reachable ? undefined : check.reason;
  }

  return { ok: true };
}

export function rejectB2BContract(
  state: GameState,
  player: Player,
  contractId: string
): { ok: boolean; error?: string } {
  const c = state.contracts.find((ct) => ct.id === contractId);
  if (!c) return { ok: false, error: 'Nie znaleziono oferty kontraktu.' };
  if (c.status !== 'pending' && c.status !== 'proposed') {
    return { ok: false, error: 'Ta oferta nie oczekuje już na odpowiedź.' };
  }
  if (c.sellerId !== player.id && c.buyerId !== player.id) {
    return { ok: false, error: 'Brak uprawnień do odrzucenia oferty.' };
  }
  if (c.proposerId === player.id) {
    return { ok: false, error: 'Własną ofertę możesz anulować, a nie odrzucić.' };
  }
  c.status = 'rejected';
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

export function executeCashTransferB2B(
  state: GameState,
  sender: Player,
  recipientId: string,
  amount: number,
  note?: string
): { ok: boolean; error?: string; record?: CashTransferRecord } {
  const recipient = state.players.find((p) => p.id === recipientId && !p.isEliminated);
  if (!recipient || recipient.id === sender.id) {
    return { ok: false, error: 'Wybierz aktywnego odbiorcę przelewu.' };
  }
  const cleanAmount = Math.round(amount);
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
    return { ok: false, error: 'Kwota przelewu musi być dodatnia.' };
  }
  if (sender.cash < cleanAmount) {
    return { ok: false, error: 'Niewystarczająca gotówka na wykonanie przelewu.' };
  }

  sender.cash -= cleanAmount;
  recipient.cash += cleanAmount;

  const trimmedNote = note?.trim().slice(0, 64);
  const record: CashTransferRecord = {
    id: `trf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    fromPlayerId: sender.id,
    fromCompanyName: sender.companyName,
    toPlayerId: recipient.id,
    toCompanyName: recipient.companyName,
    amount: cleanAmount,
    note: trimmedNote || undefined,
    tick: state.time.tick,
    dateLabel: formatGameDate(state.time),
  };

  state.cashTransfers = [...(state.cashTransfers ?? []), record].slice(-40);
  return { ok: true, record };
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

  // Wyłącznie realny, fizyczny towar znajdujący się w magazynach lub dedykowanym składowisku budynków (zero dublowania sprzedaży rynkowej!)
  let reachableWarehouseStock = 0;
  const hasLocMap = Boolean(seller.stockLocations && Object.keys(seller.stockLocations).length > 0);
  if (seller.stockLocations) {
    for (const [locId, map] of Object.entries(seller.stockLocations)) {
      const amt = map[c.resource] ?? 0;
      if (amt <= 0.001) continue;
      const locPlot = state.plots.find((p) => p.id === locId);
      if (locPlot && canTransportGoodsBetweenPlots(state, locPlot, arrivalPlot, seller.id, buyer.id).reachable) {
        reachableWarehouseStock += amt;
      }
    }
  }
  if (!hasLocMap) {
    reachableWarehouseStock = seller.warehouseStockpile[c.resource] ?? 0;
  }

  const reachableBuildingStoragePlots = state.plots.filter(
    (p) =>
      p.ownerId === seller.id &&
      p.building?.isActive &&
      !p.building.destroyedRuins &&
      (p.building.storage[c.resource] ?? 0) > 0.001 &&
      canTransportGoodsBetweenPlots(state, p, arrivalPlot, seller.id, buyer.id).reachable
  );
  const reachableBuildingStorage = reachableBuildingStoragePlots.reduce(
    (sum, p) => sum + (p.building?.storage[c.resource] ?? 0),
    0
  );

  const maxAvailable = reachableWarehouseStock + reachableBuildingStorage;
  const deliverable = Number(Math.min(c.quantityPerTick, maxAvailable).toFixed(2));
  const value = Math.round(deliverable * c.pricePerUnit);

  if (deliverable > 0 && buyer.cash >= value) {
    let remainingToDeduct = deliverable;
    if (hasLocMap) {
      const taken = consumeReachableWarehouseStock(state, seller, arrivalPlot, c.resource, remainingToDeduct, buyer.id);
      remainingToDeduct = Math.max(0, Number((remainingToDeduct - taken.consumed).toFixed(2)));
    } else if (reachableWarehouseStock > 0) {
      const legacyTake = Math.min(remainingToDeduct, seller.warehouseStockpile[c.resource] ?? 0);
      seller.warehouseStockpile[c.resource] = Math.max(
        0,
        Number(((seller.warehouseStockpile[c.resource] ?? 0) - legacyTake).toFixed(2))
      );
      remainingToDeduct = Math.max(0, Number((remainingToDeduct - legacyTake).toFixed(2)));
    }

    for (const bp of reachableBuildingStoragePlots) {
      if (remainingToDeduct <= 0.001 || !bp.building) break;
      const avail = bp.building.storage[c.resource] ?? 0;
      const take = Math.min(avail, remainingToDeduct);
      if (take > 0) {
        bp.building.storage[c.resource] = Math.max(0, Number((avail - take).toFixed(2)));
        remainingToDeduct = Math.max(0, Number((remainingToDeduct - take).toFixed(2)));
      }
    }

    const actuallyDelivered = Number((deliverable - remainingToDeduct).toFixed(2));
    if (actuallyDelivered <= 0.001) {
      return { settled: false, qty: 0, arrivalPlotId: '', fromPlotId: '', mode: 'road' };
    }
    const settledValue = Math.round(actuallyDelivered * c.pricePerUnit);
    addPlotWarehouseStock(buyer, arrivalPlot.id, c.resource, actuallyDelivered);
    buyer.cash -= settledValue;
    seller.cash += settledValue;
    c.totalValueDelivered += settledValue;
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
      qty: actuallyDelivered,
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
      if (seller.statsAccum) {
        seller.statsAccum.b2bContractsCompleted = (seller.statsAccum.b2bContractsCompleted ?? 0) + 1;
      }
      if (buyer.statsAccum) {
        buyer.statsAccum.b2bContractsCompleted = (buyer.statsAccum.b2bContractsCompleted ?? 0) + 1;
      }
    }
  }
  return receipts;
}
