import type { BuildingType, DifficultyPreset, GameSettings, MutatorFlags } from '../engine/types';

export interface WeeklyChallengeSpec {
  weekKey: string;
  isoWeek: number;
  year: number;
  seed: number;
  title: string;
  description: string;
  mapSize: number;
  aiCount: number;
  aiDifficulty: number;
  difficultyPreset: DifficultyPreset;
  targetNetWorth: number;
  maxYears: number;
  bannedBuildings: BuildingType[];
  mutators: MutatorFlags;
  rulesBulletList: string[];
  badgeName: string;
  xpBonus: number;
}

export function getIsoWeekAndYear(date = new Date()): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function seededIndex(seed: number, mod: number): number {
  const s = Math.sin(seed * 9301 + 49297) * 233280;
  return Math.floor((s - Math.floor(s)) * mod);
}

const WEEKLY_TEMPLATES: Array<{
  title: string;
  description: string;
  targetNetWorth: number;
  maxYears: number;
  bannedBuildings: BuildingType[];
  mutators: MutatorFlags;
  difficultyPreset: DifficultyPreset;
  mapSize: number;
  rulesBulletList: string[];
}> = [
  {
    title: 'Zielony Skok Bez Długów',
    description: 'Osiągnij wycenę netto bez wsparcia kredytów i bez brudnej energetyki węglowej.',
    targetNetWorth: 30_000_000,
    maxYears: 8,
    bannedBuildings: ['coalPowerPlant', 'wasteIncinerator'],
    mutators: {
      fogOfWar: false,
      noLoans: true,
      volatileMarket: false,
      freeLocalRoads: false,
      extremeClimate: false,
    },
    difficultyPreset: 'kryzysowy',
    mapSize: 24,
    rulesBulletList: [
      'Cel: Wycena Netto min. $30 000 000 przed końcem 8. roku gry',
      'Zakaz budowy Elektrowni Węglowych oraz Spalarni Odpadów',
      'Mutator: Bez Kredytów — zero pożyczek bankowych',
      'Poziom trudności: Kryzysowy · 4 graczy (Ty + 3 AI)',
    ],
  },
  {
    title: 'Krwawy Rynek Surowcowy',
    description: 'Przetrwaj podwójną zmienność giełdy i zdobądź fortunę na deterministycznej mapie.',
    targetNetWorth: 36_000_000,
    maxYears: 7,
    bannedBuildings: [],
    mutators: {
      fogOfWar: true,
      noLoans: false,
      volatileMarket: true,
      freeLocalRoads: true,
      extremeClimate: true,
    },
    difficultyPreset: 'kryzysowy',
    mapSize: 24,
    rulesBulletList: [
      'Cel: Wycena Netto min. $36 000 000 przed końcem 7. roku gry',
      'Mutator: Szalona Giełda + Mgła Wojny + Ekstremalny Klimat',
      'Ułatwienie startowe: Darmowe Drogi Zwykłe',
      'Poziom trudności: Kryzysowy · 5 graczy (Ty + 4 AI)',
    ],
  },
  {
    title: 'Czysta Logistyka Kontynentalna',
    description: 'Połącz odległe złoża siecią autostrad i transportu pasażerskiego na dużej mapie.',
    targetNetWorth: 42_000_000,
    maxYears: 9,
    bannedBuildings: ['coalPowerPlant'],
    mutators: {
      fogOfWar: false,
      noLoans: false,
      volatileMarket: true,
      freeLocalRoads: false,
      extremeClimate: false,
    },
    difficultyPreset: 'standard',
    mapSize: 32,
    rulesBulletList: [
      'Cel: Wycena Netto min. $42 000 000 przed końcem 9. roku gry',
      'Duża mapa 32×32 (identyczny układ rzek i złóż dla wszystkich)',
      'Zakaz Elektrowni Węglowych · Szalona Giełda',
      'Poziom trudności: Standardowy · 5 graczy (Ty + 4 AI)',
    ],
  },
  {
    title: 'Hardkorowy Ekstraktor Kryzysowy',
    description: 'Bezlitosne podatki i bez pożyczek — test czystego zarządzania marżą operacyjną.',
    targetNetWorth: 24_000_000,
    maxYears: 7,
    bannedBuildings: ['nuclearPowerPlant'],
    mutators: {
      fogOfWar: true,
      noLoans: true,
      volatileMarket: false,
      freeLocalRoads: false,
      extremeClimate: false,
    },
    difficultyPreset: 'przetrwanie',
    mapSize: 24,
    rulesBulletList: [
      'Cel: Wycena Netto min. $24 000 000 przed końcem 7. roku gry',
      'Mutatory: Bez Kredytów + Mgła Wojny',
      'Zakaz Elektrowni Atomowych — stawiaj na OZE, fuzję lub gaz',
      'Poziom trudności: Przetrwanie (Hardkor)',
    ],
  },
];

export function getWeeklyChallengeSpec(date = new Date()): WeeklyChallengeSpec {
  const { year, week } = getIsoWeekAndYear(date);
  const weekKey = `${year}-W${String(week).padStart(2, '0')}`;
  const seed = year * 1009 + week * 73 + 421;
  const tplIdx = seededIndex(seed, WEEKLY_TEMPLATES.length);
  const tpl = WEEKLY_TEMPLATES[tplIdx];
  return {
    weekKey,
    isoWeek: week,
    year,
    seed,
    title: `${tpl.title} (${weekKey})`,
    description: tpl.description,
    mapSize: tpl.mapSize,
    aiCount: tplIdx === 1 || tplIdx === 2 ? 4 : 3,
    aiDifficulty: 3,
    difficultyPreset: tpl.difficultyPreset,
    targetNetWorth: tpl.targetNetWorth,
    maxYears: tpl.maxYears,
    bannedBuildings: tpl.bannedBuildings,
    mutators: { ...tpl.mutators },
    rulesBulletList: tpl.rulesBulletList,
    badgeName: `Czempion ${weekKey}`,
    xpBonus: 450,
  };
}

export function buildWeeklyChallengeGameSettings(spec = getWeeklyChallengeSpec()): GameSettings {
  return {
    mode: 'endless',
    playerCount: spec.aiCount + 1,
    aiDifficulty: spec.aiDifficulty,
    mapSize: spec.mapSize,
    challengeDurationSeconds: 0,
    economyMultiplier: 1.0,
    disastersEnabled: true,
    victoryMode: 'solo',
    difficultyPreset: spec.difficultyPreset,
    scenarioId: 'sandbox',
    mutators: { ...spec.mutators },
    mapSeed: spec.seed,
    weeklyChallengeId: spec.weekKey,
    weeklyTargetNetWorth: spec.targetNetWorth,
    weeklyMaxYear: 2026 + spec.maxYears,
    weeklyBannedBuildings: [...spec.bannedBuildings],
  };
}
