import { BUILDING_DEFINITIONS } from '../data/buildings';
import { RESOURCE_LIST } from '../data/resources';
import { getAggregatedBuildingModifiers } from './BuildingSystem';
import type { GameState, Player, ResourceType, UtilityBalanceReport } from './types';

export function computePlayerUtilityAndResourceBalance(
  state: GameState,
  player: Player
): UtilityBalanceReport {
  let electricityProduced = 0;
  let electricityConsumed = 0;
  const electricityByPlant: { label: string; produced: number }[] = [];
  const electricityConsumers: { label: string; consumed: number }[] = [];

  let waterProduced = 0;
  let waterConsumed = 0;
  const waterSources: { label: string; produced: number }[] = [];
  const waterConsumers: { label: string; consumed: number }[] = [];

  const resProduced: Partial<Record<ResourceType, number>> = {};
  const resConsumed: Partial<Record<ResourceType, number>> = {};
  const resImport: Partial<Record<ResourceType, number>> = {};
  const resExport: Partial<Record<ResourceType, number>> = {};

  for (const plot of state.plots) {
    if (plot.ownerId !== player.id || !plot.building || !plot.building.isActive) continue;
    const b = plot.building;
    const def = BUILDING_DEFINITIONS[b.type];
    const mods = getAggregatedBuildingModifiers(b);

    // Energia elektryczna (MWh/MW)
    const elecOutput = b.productionPerTick.electricity ?? (def.electricityUsage < 0 ? Math.abs(def.electricityUsage) * (b.efficiency / 100) : 0);
    if (def.electricityUsage < 0 || b.type === 'copperCablePlant') {
      const prodMW = Math.round(Math.max(elecOutput, Math.abs(def.electricityUsage) * 0.4 * (b.efficiency / 100)));
      electricityProduced += prodMW;
      electricityByPlant.push({
        label: `${b.icon} ${b.name} (${plot.gridX},${plot.gridY})`,
        produced: prodMW,
      });
    } else if (def.electricityUsage > 0) {
      const consMW = Math.round(def.electricityUsage * Math.max(0.2, 1 + mods.electricityDelta));
      electricityConsumed += consMW;
      electricityConsumers.push({
        label: `${b.icon} ${b.name} (${plot.gridX},${plot.gridY})`,
        consumed: consMW,
      });
    }

    // Woda przemysłowa (m3)
    if (b.type === 'waterPlant' || def.waterUsage < 0) {
      const prodW = Math.round(Math.max(b.productionPerTick.water ?? 0, Math.abs(def.waterUsage) * (b.efficiency / 100)));
      waterProduced += prodW;
      waterSources.push({
        label: `${b.icon} ${b.name} (${plot.gridX},${plot.gridY})`,
        produced: prodW,
      });
    } else if (def.waterUsage > 0) {
      const consW = Math.round(def.waterUsage * Math.max(0.2, 1 + mods.waterDelta));
      waterConsumed += consW;
      waterConsumers.push({
        label: `${b.icon} ${b.name} (${plot.gridX},${plot.gridY})`,
        consumed: consW,
      });
    }

    // Surowce i półprodukty
    for (const [rKey, val] of Object.entries(b.productionPerTick)) {
      const r = rKey as ResourceType;
      resProduced[r] = (resProduced[r] ?? 0) + (val ?? 0);
    }
    for (const [rKey, val] of Object.entries(b.consumptionPerTick)) {
      const r = rKey as ResourceType;
      resConsumed[r] = (resConsumed[r] ?? 0) + (val ?? 0);
    }
  }

  // Kontrakty B2B import/export
  for (const c of state.contracts) {
    if (c.status !== 'active') continue;
    if (c.buyerId === player.id) {
      resImport[c.resource] = (resImport[c.resource] ?? 0) + c.quantityPerTick;
      if (c.resource === 'electricity') electricityProduced += c.quantityPerTick;
      if (c.resource === 'water') waterProduced += c.quantityPerTick;
    }
    if (c.sellerId === player.id) {
      resExport[c.resource] = (resExport[c.resource] ?? 0) + c.quantityPerTick;
      if (c.resource === 'electricity') electricityConsumed += c.quantityPerTick;
      if (c.resource === 'water') waterConsumed += c.quantityPerTick;
    }
  }

  const resourceBalances = RESOURCE_LIST.map((r) => {
    const produced = Number((resProduced[r] ?? 0).toFixed(1));
    const b2bImport = Number((resImport[r] ?? 0).toFixed(1));
    const consumed = Number((resConsumed[r] ?? 0).toFixed(1));
    const b2bExport = Number((resExport[r] ?? 0).toFixed(1));
    return {
      resource: r,
      produced,
      b2bImport,
      consumed,
      b2bExport,
      net: Number((produced + b2bImport - consumed - b2bExport).toFixed(1)),
    };
  }).filter((rb) => rb.produced > 0 || rb.consumed > 0 || rb.b2bImport > 0 || rb.b2bExport > 0);

  return {
    electricityProduced,
    electricityConsumed,
    electricityNet: electricityProduced - electricityConsumed,
    electricityByPlant,
    electricityConsumers,
    waterProduced,
    waterConsumed,
    waterNet: waterProduced - waterConsumed,
    waterSources,
    waterConsumers,
    resourceBalances,
  };
}
