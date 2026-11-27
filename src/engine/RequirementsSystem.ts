import { BUILDING_DEFINITIONS } from '../data/buildings';
import { RESOURCE_DEFINITIONS } from '../data/resources';
import { getCurrentLanguage } from '../i18n';
import { BUILDINGS_EN } from '../i18n/buildingsEn';
import {
  localizeResourceName,
  localizeResourceUnit,
  localizeSkillNode,
  localizeTechNode,
} from '../i18n/dataTranslations';
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
  const lang = getCurrentLanguage();
  const en = lang === 'en';
  const items: RequirementCheckItem[] = [];

  if (req.requiredGlobalTech) {
    const rawTechDef = state.globalTechDefs.find((t) => t.id === req.requiredGlobalTech);
    const techDef = rawTechDef ? localizeTechNode(rawTechDef, lang) : undefined;
    const met = player.globalTech[req.requiredGlobalTech]?.status === 'done';
    items.push({
      id: `tech_${req.requiredGlobalTech}`,
      label: en
        ? `Tech: ${techDef?.name ?? req.requiredGlobalTech}`
        : `Technologia: ${techDef?.name ?? req.requiredGlobalTech}`,
      met,
      hint: met
        ? en
          ? 'Requirement met'
          : 'Warunek spełniony'
        : en
          ? 'Research this technology in the 🔬 Tech Tree panel (requires School/University).'
          : 'Zbadaj tę technologię w oknie 🔬 Technologie (wymaga Szkoły/Uniwersytetu).',
    });
  }

  if (req.requiredBuildings && req.requiredBuildings.length > 0) {
    for (const bType of req.requiredBuildings) {
      const def = BUILDING_DEFINITIONS[bType];
      const bName = en ? BUILDINGS_EN[bType]?.name ?? def.name : def.name;
      const met = state.plots.some((p) => p.ownerId === player.id && p.building?.type === bType);
      items.push({
        id: `bld_${bType}`,
        label: en ? `Required facility: ${bName}` : `Posiadany obiekt: ${bName}`,
        met,
        hint: met
          ? en
            ? 'Facility active in your empire'
            : 'Obiekt działa w Twoim imperium'
          : en
            ? `Construct "${bName}" on one of your plots.`
            : `Zbuduj obiekt "${bName}" na jednej ze swoich działek.`,
      });
    }
  }

  if (req.requiredEntrepreneurSkill) {
    const rawSkDef = state.entrepreneurSkillDefs.find((s) => s.id === req.requiredEntrepreneurSkill);
    const skDef = rawSkDef ? localizeSkillNode(rawSkDef, lang) : undefined;
    const met = player.entrepreneurSkills[req.requiredEntrepreneurSkill] === 'done';
    items.push({
      id: `ent_${req.requiredEntrepreneurSkill}`,
      label: en
        ? `CEO Perk: ${skDef?.name ?? req.requiredEntrepreneurSkill}`
        : `Perk Prezesa: ${skDef?.name ?? req.requiredEntrepreneurSkill}`,
      met,
      hint: met
        ? en
          ? 'Unlocked'
          : 'Odblokowany'
        : en
          ? 'Unlock this skill in the 👤 CEO Skills panel.'
          : 'Odblokuj tę umiejętność w oknie 👤 Prezes.',
    });
  }

  if (req.minWorkerSkill !== undefined) {
    const currentSkill = building?.workerSkill ?? 40;
    const met = currentSkill >= req.minWorkerSkill;
    items.push({
      id: `skill_${req.minWorkerSkill}`,
      label: en
        ? `Crew training: min. ${req.minWorkerSkill}% (current ${currentSkill}%)`
        : `Wyszkolenie załogi: min. ${req.minWorkerSkill}% (masz ${currentSkill}%)`,
      met,
      hint: met
        ? en
          ? 'Crew qualified'
          : 'Kadra wykwalifikowana'
        : en
          ? 'Train staff in the HR & Payroll tab.'
          : 'Wyślij pracowników na kurs w zakładce Kadry HR.',
    });
  }

  if (req.requiresPowerSurplus) {
    const balance = getPlayerPowerBalance(state, player.id);
    const met = balance >= 0 || Boolean(plot?.hasElectricity);
    items.push({
      id: 'power_surplus',
      label: en ? 'Access to surplus electric power' : 'Dostęp do nadwyżki energii elektrycznej',
      met,
      hint: met
        ? en
          ? 'Power grid connected'
          : 'Sieć zasilona'
        : en
          ? 'Build a power plant (Renewables, Coal, or Nuclear) or use a grid-connected plot.'
          : 'Zbuduj elektrownię (OZE, Węglową lub Atomową) albo działkę z dostępem do sieci.',
    });
  }

  if (req.requiresWaterAccess) {
    const hasPlant = state.plots.some((p) => p.ownerId === player.id && p.building?.type === 'waterPlant');
    const met = Boolean(plot?.hasWater) || hasPlant;
    items.push({
      id: 'water_access',
      label: en ? 'Access to industrial water grid' : 'Dostęp do sieci wody przemysłowej',
      met,
      hint: met
        ? en
          ? 'Water supply secured'
          : 'Dostęp do wody zapewniony'
        : en
          ? 'Pick a river/city tile or build a Water Pumping Station.'
          : 'Wybierz działkę nad wodą/w mieście lub postaw Stację Wody.',
    });
  }

  if (req.requiredCorpLevel !== undefined) {
    const met = player.corporationLevel >= req.requiredCorpLevel;
    items.push({
      id: `corp_${req.requiredCorpLevel}`,
      label: en
        ? `Corporation Level: min. Lvl ${req.requiredCorpLevel} (current Lvl ${player.corporationLevel})`
        : `Poziom Korporacji: min. Poz. ${req.requiredCorpLevel} (masz Poz. ${player.corporationLevel})`,
      met,
      hint: met
        ? en
          ? 'Required corporate scale reached'
          : 'Wymagana skala korporacji osiągnięta'
        : en
          ? `Grow net worth and revenue to reach Corporation Level ${req.requiredCorpLevel}.`
          : `Zwiększ wartość netto i przychody, aby osiągnąć ${req.requiredCorpLevel}. poziom korporacji.`,
    });
  }

  if (req.minVoterApproval !== undefined) {
    const approval = Math.round(player.influence.voterApproval ?? 50);
    const met = approval >= req.minVoterApproval;
    items.push({
      id: `voter_${req.minVoterApproval}`,
      label: en
        ? `Public approval: min. ${req.minVoterApproval}% (current ${approval}%)`
        : `Poparcie społeczne: min. ${req.minVoterApproval}% (masz ${approval}%)`,
      met,
      hint: met
        ? en
          ? 'Public mandate secured'
          : 'Mandat społeczny zabezpieczony'
        : en
          ? 'Build parks, hospitals, cultural venues, or run PR campaigns in the Influence panel.'
          : 'Buduj parki, szpitale, centra kultury lub prowadź kampanie PR w panelu Wpływy.',
    });
  }

  if (req.requiredInfluenceScore !== undefined) {
    const score = Math.round(
      (player.influence.financial ?? 0) +
        (player.influence.military ?? 0) +
        (player.influence.social ?? 0)
    );
    const met = score >= req.requiredInfluenceScore;
    items.push({
      id: `inf_${req.requiredInfluenceScore}`,
      label: en
        ? `Political Influence Power: min. ${req.requiredInfluenceScore} pts (current ${score} pts)`
        : `Siła Wpływów Politycznych: min. ${req.requiredInfluenceScore} pkt (masz ${score} pkt)`,
      met,
      hint: met
        ? en
          ? 'Sufficient political leverage'
          : 'Pozycja polityczna wystarczająca'
        : en
          ? 'Grow Lobbying HQs, Intelligence Centers, or take actions in the 🏛️ Influence panel.'
          : 'Rozwijaj Lobby, Centrum Wywiadu lub podejmuj akcje w panelu 🏛️ Wpływy.',
    });
  }

  if (req.requiredTechCount !== undefined) {
    const doneCount = Object.values(player.globalTech).filter((t) => t.status === 'done').length;
    const met = doneCount >= req.requiredTechCount;
    items.push({
      id: `techcount_${req.requiredTechCount}`,
      label: en
        ? `Researched R&D technologies: min. ${req.requiredTechCount} (current ${doneCount})`
        : `Zbadane technologie R&D: min. ${req.requiredTechCount} (masz ${doneCount})`,
      met,
      hint: met
        ? en
          ? 'R&D backbone ready'
          : 'Zaplecze naukowe gotowe'
        : en
          ? 'Research more technologies in the 🔬 Tech Tree.'
          : 'Zbadaj kolejne technologie w drzewku 🔬 Technologie.',
    });
  }

  const isMpClosedEconomy = state.settings.mode === 'mp_fast' || state.settings.mode === 'mp_long';

  if (req.requiredResources) {
    for (const [resKey, neededRaw] of Object.entries(req.requiredResources)) {
      const res = resKey as ResourceType;
      const needed = neededRaw ?? 0;
      if (needed <= 0) continue;
      const def = RESOURCE_DEFINITIONS[res];
      const unit = localizeResourceUnit(def.unit, lang);
      const resName = localizeResourceName(res, def.name, lang);
      const have = getPlayerAvailableResource(player, res, building);
      const met = have >= needed;
      const missingAmount = Math.max(0, Math.ceil((needed - have) * 10) / 10);
      const spotCost = Math.round(missingAmount * getResourcePrice(state, res));

      items.push({
        id: `res_${res}`,
        label: en
          ? `Stockpile: ${needed} ${unit} ${resName} (have ${have.toFixed(1)} ${unit})`
          : `Zapas: ${needed} ${unit} ${def.genitiveName} (masz ${have.toFixed(1)} ${unit})`,
        met,
        hint: met
          ? en
            ? 'Resource secured in warehouse'
            : 'Surowiec zabezpieczony w magazynie'
          : isMpClosedEconomy
            ? en
              ? `Closed MP Economy: mine/produce in your own facilities or buy from another player on the B2B market (need ${missingAmount} ${unit}).`
              : `Gospodarka zamknięta MP: wydobywaj/produkuj we własnych zakładach albo kup od innego gracza na rynku B2B (brakuje ${missingAmount} ${unit}).`
            : en
              ? `Produce in storage mode, sign a B2B contract, or spot-buy ${missingAmount} ${unit}.`
              : `Produkuj w trybie magazynowania, zawrzyj kontrakt B2B lub dokup brakujące ${missingAmount} ${unit}.`,
        missingResource: met || isMpClosedEconomy ? undefined : { resource: res, missingAmount, spotCost },
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
