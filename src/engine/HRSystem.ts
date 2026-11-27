import { GAME_CONFIG } from '../config/gameConfig';
import { getCurrentLanguage } from '../i18n';
import { formatMoney } from '../utils/formatters';
import type { Building, GameState, Player, ZUSBreakdown } from './types';

export function calculateZUSBreakdown(grossWage: number, zusMultiplier: number): ZUSBreakdown {
  const emerytalna = grossWage * 0.0976 * zusMultiplier;
  const rentowa = grossWage * 0.065 * zusMultiplier;
  const wypadkowa = grossWage * 0.0167 * zusMultiplier;
  const fp = grossWage * 0.0245 * zusMultiplier;
  const fgsp = grossWage * 0.001 * zusMultiplier;
  const zdrowotnaInfo = grossWage * 0.09; // informacyjnie po stronie pracownika
  const totalAmount = emerytalna + rentowa + wypadkowa + fp + fgsp;
  return {
    emerytalna,
    rentowa,
    wypadkowa,
    fp,
    fgsp,
    zdrowotnaInfo,
    totalEmployerRate: (totalAmount / Math.max(1, grossWage)) * 100,
    totalAmount,
  };
}

export function computeLaborShortageIndex(state: GameState): number {
  let totalWorkers = 0;
  let educationCapacity = 30; // bazowa podaż wykwalifikowanych kadr w państwie

  for (const plot of state.plots) {
    const b = plot.building;
    if (!b || !b.isActive) continue;
    totalWorkers += b.workers;
    if (b.type === 'highSchool') educationCapacity += 36;
    if (b.type === 'university') educationCapacity += 72;
    if (b.type === 'rdLab') educationCapacity += 20;
  }

  if (totalWorkers <= educationCapacity) {
    return Math.max(0, Math.round((totalWorkers / educationCapacity) * 18));
  }
  const excessRatio = (totalWorkers - educationCapacity) / Math.max(1, educationCapacity);
  return Math.min(100, Math.round(20 + excessRatio * 55));
}

export function calculateBuildingHRPayroll(
  building: Building,
  state: GameState,
  player: Player
): { wages: number; zus: number; total: number; wagePerWorker: number } {
  const shortagePremium = 1 + (state.laborShortageIndex / 100) * 0.65;
  const skillPremium = 0.8 + (building.workerSkill / 100) * 0.55;
  const wagePerWorker = GAME_CONFIG.baseWagePerWorkerPerTick * shortagePremium * skillPremium;
  const wages = building.workers * wagePerWorker;

  // Automatyzacja z globalnego drzewka może obniżać narzuty ZUS
  const hasAutoTech = player.globalTech['ind_automation']?.status === 'done';
  const zusTechFactor = hasAutoTech ? 0.85 : 1.0;

  // Czasowa ulga z mobilizacji wyborców
  const voterZUSRelief = state.activeLaws.includes('lower_zus') ? 0.9 : 1.0;

  const zus = calculateZUSBreakdown(wages, state.zusMultiplier * zusTechFactor * voterZUSRelief).totalAmount;
  return {
    wages,
    zus,
    total: wages + zus,
    wagePerWorker,
  };
}

export function getTrainingCost(building: Building): number {
  const nextTier = Math.min(100, building.workerSkill + 12);
  const diff = Math.max(1, nextTier - building.workerSkill);
  return Math.round((1_200 + building.workers * 420) * (1 + building.workerSkill / 120) * (diff / 12));
}

export function hireWorkersForBuilding(
  building: Building,
  player: Player,
  count: number
): { ok: boolean; error?: string } {
  const en = getCurrentLanguage() === 'en';
  const actualCount = Math.min(count, building.maxWorkers - building.workers);
  if (actualCount <= 0) {
    return {
      ok: false,
      error: en ? 'Workforce capacity reached for this facility.' : 'Osiągnięto limit etatów w tym obiekcie.',
    };
  }
  const onboardingCost = actualCount * 1_500;
  if (player.cash < onboardingCost) {
    return {
      ok: false,
      error: en
        ? `Insufficient funds for hiring (${formatMoney(onboardingCost)}).`
        : `Brak środków na rekrutację (${formatMoney(onboardingCost)}).`,
    };
  }
  player.cash -= onboardingCost;
  building.workers += actualCount;
  return { ok: true };
}

export function fireWorkersFromBuilding(
  building: Building,
  player: Player,
  count: number
): { ok: boolean; error?: string } {
  const en = getCurrentLanguage() === 'en';
  const actualCount = Math.min(count, building.workers);
  if (actualCount <= 0) {
    return { ok: false, error: en ? 'No staff to dismiss.' : 'Brak pracowników do zwolnienia.' };
  }
  const severance = actualCount * 2_200; // odprawa pracownicza
  if (player.cash < severance) {
    return {
      ok: false,
      error: en
        ? `Insufficient funds for severance pay (${formatMoney(severance)}).`
        : `Brak środków na odprawy (${formatMoney(severance)}).`,
    };
  }
  player.cash -= severance;
  building.workers -= actualCount;
  return { ok: true };
}

export function trainBuildingWorkers(
  building: Building,
  player: Player
): { ok: boolean; error?: string } {
  const en = getCurrentLanguage() === 'en';
  if (building.workers <= 0) {
    return { ok: false, error: en ? 'Hire staff first.' : 'Zatrudnij najpierw pracowników.' };
  }
  if (building.workerSkill >= 100) {
    return {
      ok: false,
      error: en ? 'Crew already reached 100% mastery.' : 'Załoga osiągnęła mistrzowski poziom 100%.',
    };
  }
  const cost = getTrainingCost(building);
  if (player.cash < cost) {
    return {
      ok: false,
      error: en
        ? `Insufficient funds for training (${formatMoney(cost)}).`
        : `Brak środków na kursy (${formatMoney(cost)}).`,
    };
  }

  player.cash -= cost;
  building.workerSkill = Math.min(100, building.workerSkill + 12);
  return { ok: true };
}
