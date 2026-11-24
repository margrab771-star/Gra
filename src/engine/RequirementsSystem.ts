import { BUILDING_DEFINITIONS } from '../data/buildings';
import { RESOURCE_DEFINITIONS } from '../data/resources';
import { getResourcePrice } from './EconomyEngine';
import type {
  Building,
  GameState,
  NonFinancialRequirements,
  Player,
  Plot,
  RequirementCheckItem,
  ResourceType,
} from './types';

export function getPlayerAvailableResource(
  player: Player,
  resource: ResourceType,
  building?: Building
): number {
  const globalStock = player.warehouseStockpile[resource] ?? 0;
  const localStock = building?.storage[resource] ?? 0;
  return globalStock + localStock;
}

export function getPlayerPowerBalance(state: GameState, playerId: string): number {
  let net = 0;
  for (const p of state.plots) {
    if (p.ownerId !== playerId || !p.building || !p.building.isActive) continue;
    const def = BUILDING_DEFINITIONS[p.building.type];
    net -= def.electricityUsage;
  }
  return net;
}

export function evaluateNonFinancialRequirements(
  req: NonFinancialRequirements | undefined,
  player: Player,
  state: GameState,
  building?: Building,
  plot?: Plot
): { allMet: boolean; items: RequirementCheckItem[] } {
  if (!req) return { allMet: true, items: [] };
  const items: RequirementCheckItem[] = [];

  if (req.requiredGlobalTech) {
    const techDef = state.globalTechDefs.find((t) => t.id === req.requiredGlobalTech);
    const met = player.globalTech[req.requiredGlobalTech]?.status === 'done';
    items.push({
      id: `tech_${req.requiredGlobalTech}`,
      label: `Technologia: ${techDef?.name ?? req.requiredGlobalTech}`,
      met,
      hint: met ? 'Warunek spełniony' : 'Zbadaj tę technologię w oknie 🔬 Technologie (wymaga Szkoły/Uniwersytetu).',
    });
  }

  if (req.requiredBuildings && req.requiredBuildings.length > 0) {
    for (const bType of req.requiredBuildings) {
      const def = BUILDING_DEFINITIONS[bType];
      const met = state.plots.some((p) => p.ownerId === player.id && p.building?.type === bType);
      items.push({
        id: `bld_${bType}`,
        label: `Posiadany obiekt: ${def.name}`,
        met,
        hint: met ? 'Obiekt działa w Twoim imperium' : `Zbuduj obiekt "${def.name}" na jednej ze swoich działek.`,
      });
    }
  }

  if (req.requiredEntrepreneurSkill) {
    const skDef = state.entrepreneurSkillDefs.find((s) => s.id === req.requiredEntrepreneurSkill);
    const met = player.entrepreneurSkills[req.requiredEntrepreneurSkill] === 'done';
    items.push({
      id: `ent_${req.requiredEntrepreneurSkill}`,
      label: `Perk Prezesa: ${skDef?.name ?? req.requiredEntrepreneurSkill}`,
      met,
      hint: met ? 'Odblokowany' : 'Odblokuj tę umiejętność w oknie 👤 Prezes.',
    });
  }

  if (req.minWorkerSkill !== undefined) {
    const currentSkill = building?.workerSkill ?? 40;
    const met = currentSkill >= req.minWorkerSkill;
    items.push({
      id: `skill_${req.minWorkerSkill}`,
      label: `Wyszkolenie załogi: min. ${req.minWorkerSkill}% (masz ${currentSkill}%)`,
      met,
      hint: met ? 'Kadra wykwalifikowana' : 'Wyślij pracowników na kurs w zakładce Kadry HR.',
    });
  }

  if (req.requiresPowerSurplus) {
    const balance = getPlayerPowerBalance(state, player.id);
    const met = balance >= 0 || Boolean(plot?.hasElectricity);
    items.push({
      id: 'power_surplus',
      label: 'Dostęp do nadwyżki energii elektrycznej',
      met,
      hint: met ? 'Sieć zasilona' : 'Zbuduj elektrownię (OZE, Węglową lub Atomową) albo działkę z dostępem do sieci.',
    });
  }

  if (req.requiresWaterAccess) {
    const hasPlant = state.plots.some((p) => p.ownerId === player.id && p.building?.type === 'waterPlant');
    const met = Boolean(plot?.hasWater) || hasPlant;
    items.push({
      id: 'water_access',
      label: 'Dostęp do sieci wody przemysłowej',
      met,
      hint: met ? 'Dostęp do wody zapewniony' : 'Wybierz działkę nad wodą/w mieście lub postaw Stację Wody.',
    });
  }

  if (req.requiredResources) {
    for (const [resKey, neededRaw] of Object.entries(req.requiredResources)) {
      const res = resKey as ResourceType;
      const needed = neededRaw ?? 0;
      if (needed <= 0) continue;
      const def = RESOURCE_DEFINITIONS[res];
      const have = getPlayerAvailableResource(player, res, building);
      const met = have >= needed;
      const missingAmount = Math.max(0, Math.ceil((needed - have) * 10) / 10);
      const spotCost = Math.round(missingAmount * getResourcePrice(state, res));

      items.push({
        id: `res_${res}`,
        label: `Zapas: ${needed} ${def.unit} ${def.genitiveName} (masz ${have.toFixed(1)} ${def.unit})`,
        met,
        hint: met
          ? 'Surowiec zabezpieczony w magazynie'
          : `Produkuj w trybie magazynowania, zawrzyj kontrakt B2B lub dokup brakujące ${missingAmount} ${def.unit}.`,
        missingResource: met ? undefined : { resource: res, missingAmount, spotCost },
      });
    }
  }

  return {
    allMet: items.every((i) => i.met),
    items,
  };
}

export function consumeRequiredResources(
  req: NonFinancialRequirements | undefined,
  player: Player,
  building?: Building
): void {
  if (!req?.requiredResources) return;
  for (const [resKey, neededRaw] of Object.entries(req.requiredResources)) {
    const res = resKey as ResourceType;
    let remaining = neededRaw ?? 0;
    if (remaining <= 0) continue;

    if (building && (building.storage[res] ?? 0) > 0) {
      const takeLocal = Math.min(building.storage[res] ?? 0, remaining);
      building.storage[res] = (building.storage[res] ?? 0) - takeLocal;
      remaining -= takeLocal;
    }

    if (remaining > 0) {
      const global = player.warehouseStockpile[res] ?? 0;
      player.warehouseStockpile[res] = Math.max(0, global - remaining);
    }
  }
}
