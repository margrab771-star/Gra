import type {
  BuildingCategory,
  CorporationLevel,
  EmergencyServiceKind,
  MapHeatmapMode,
  TerrainType,
  TollRate,
} from '../engine/types';

// ─── Configurable Game Title (Single Source of Truth) ─────────────────────────

export const GAME_CONFIG = {
  title: 'Market Dominion',
  subtitle: 'Symulator Imperium Biznesowego & Giełdy Surowców',
  version: '2.0.0',
  startingCash: 5_000_000,
  challengeDurationSeconds: 3600,
  mpFastDurationSeconds: 3600,
  defaultMapSize: 24,
  tickIntervalMs: 1000,
  ticksPerGameMonth: 30,
  baseTaxRateCIT: 0.19,
  vatExciseRate: 0.08,
  propertyTaxPerPlotPerTick: 45,
  playerRoadCost: 18_000,
  highwayCost: 68_000,
  highwayInputs: { gravel: 10, prefabs: 6 } as Record<string, number>,
  areaSurveyMultiplier: 2.3,
  baseWagePerWorkerPerTick: 18,
  baseZUSRate: 0.2048,
  baseElectricityMarketPrice: 12,
  baseWaterMarketPrice: 5,
  baseTransportCostPerTile: 3.5,
  surveyCost: 8_500,
  baseLoanInterestRate: 0.068,
  monopolyVictoryShare: 62,
  theme: {
    bgPrimary: '#0b0f17',
    bgSecondary: '#111827',
    bgCard: '#151c28',
    border: '#243044',
    emerald: '#10b981',
    crimson: '#f43f5e',
    gold: '#f59e0b',
    sky: '#38bdf8',
  },
} as const;

export const GAME_TITLE = GAME_CONFIG.title;

export const CORPORATION_LEVELS: Record<
  CorporationLevel,
  {
    level: CorporationLevel;
    name: string;
    minNetWorth: number;
    minBuildings: number;
    requiresTechOrEdu: string;
    description: string;
  }
> = {
  1: {
    level: 1,
    name: 'Start-up',
    minNetWorth: 0,
    minBuildings: 0,
    requiresTechOrEdu: 'Brak wymagań',
    description: 'Podstawowe działki, własne drogi, węgiel, żelazo, stal, woda i podstawowe usługi.',
  },
  2: {
    level: 2,
    name: 'Przedsiębiorstwo',
    minNetWorth: 5_400_000,
    minBuildings: 2,
    requiresTechOrEdu: 'Min. 2 obiekty i 5,4 mln zł wyceny',
    description: 'Odblokowuje Miedź, Ropę, Chemię, Szpital Pracowniczy, Port Towarowy i Parki Rozrywki.',
  },
  3: {
    level: 3,
    name: 'Grupa Kapitałowa',
    minNetWorth: 7_800_000,
    minBuildings: 4,
    requiresTechOrEdu: 'Min. 4 obiekty, Szkoła Średnia i 7,8 mln zł wyceny',
    description: 'Odblokowuje Złoto, Jubilerstwo, Metale Rzadkie, Elektronikę, Banki i Fundacje.',
  },
  4: {
    level: 4,
    name: 'Koncern',
    minNetWorth: 11_500_000,
    minBuildings: 6,
    requiresTechOrEdu: 'Min. 6 obiektów, Uniwersytet i 11,5 mln zł wyceny',
    description: 'Odblokowuje Bazy HAZMAT, Lotniska Cargo, Półprzewodniki, Uran i Zbrojeniówkę.',
  },
  5: {
    level: 5,
    name: 'Megakorporacja',
    minNetWorth: 17_000_000,
    minBuildings: 8,
    requiresTechOrEdu: 'Min. 8 obiektów, Lab R&D i 17 mln zł wyceny',
    description: 'Odblokowuje Elektrownię Atomową oraz Centrum Przemysłowo-Kosmiczne.',
  },
};

export const SPEED_OPTIONS: { value: 0 | 1 | 2 | 5 | 10; label: string }[] = [
  { value: 0, label: 'Pauza' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 5, label: '5×' },
  { value: 10, label: '10×' },
];

export const TERRAIN_NAMES: Record<TerrainType, string> = {
  grass: 'Równina',
  forest: 'Las',
  water: 'Woda / Rzeka',
  mountain: 'Góry',
  desert: 'Pustkowia',
  coastal: 'Wybrzeże',
  urban: 'Strefa Miejska',
};

export const BUILDING_CATEGORIES: { key: BuildingCategory; label: string; icon: string }[] = [
  { key: 'mining', label: 'Wydobycie', icon: '⛏️' },
  { key: 'processing', label: 'Przetwórstwo', icon: '🏭' },
  { key: 'energy', label: 'Energetyka', icon: '⚡' },
  { key: 'logistics', label: 'Logistyka', icon: '🚛' },
  { key: 'real_estate', label: 'Nieruchomości', icon: '🏢' },
  { key: 'attractions', label: 'Atrakcje i Luksus', icon: '🎡' },
  { key: 'finance', label: 'Finanse', icon: '🏦' },
  { key: 'education', label: 'Edukacja i R&D', icon: '🎓' },
  { key: 'safety', label: 'Zdrowie i Straż', icon: '🚒' },
  { key: 'influence', label: 'Wpływy', icon: '🏛️' },
  { key: 'military', label: 'Bezpieczeństwo', icon: '🛡️' },
];

export const MAP_SIZES = [
  { value: 20, label: 'Kompaktowa (20×20)' },
  { value: 24, label: 'Standardowa (24×24)' },
  { value: 30, label: 'Rozległa (30×30)' },
];

export const PLAYER_COLORS = [
  '#10b981',
  '#38bdf8',
  '#f59e0b',
  '#f43f5e',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

export const DIFFICULTY_LABELS = [
  'Łatwy',
  'Normalny',
  'Ambitny',
  'Ekspert',
  'Rekin Biznesu',
];

export const TOLL_RATE_CONFIG: Record<
  TollRate,
  { label: string; feePerPass: number; weightPenalty: number }
> = {
  free: { label: 'Darmowa (0 zł)', feePerPass: 0, weightPenalty: 0 },
  low: { label: 'Niska (450 zł)', feePerPass: 450, weightPenalty: 0.35 },
  standard: { label: 'Standardowa (1 200 zł)', feePerPass: 1_200, weightPenalty: 1.0 },
  high: { label: 'Wysoka (2 800 zł)', feePerPass: 2_800, weightPenalty: 2.5 },
  prohibitive: { label: 'Zaporowa (6 500 zł)', feePerPass: 6_500, weightPenalty: 6.0 },
};

export const SERVICE_VEHICLE_COST: Record<EmergencyServiceKind, number> = {
  fire: 55_000,
  hazmat: 95_000,
  medical: 65_000,
  police: 60_000,
};

export const HEATMAP_MODE_OPTIONS: { key: MapHeatmapMode; icon: string; label: string }[] = [
  { key: 'standard', icon: '🗺️', label: 'Standard' },
  { key: 'response_time', icon: '🚑', label: 'Czas Służb' },
  { key: 'security', icon: '🚓', label: 'Bezpieczeństwo' },
  { key: 'environment', icon: '🌿', label: 'Atrakcyjność' },
  { key: 'logistics', icon: '🛣️', label: 'Drogi i Myto' },
];

export const AI_STRATEGY_LABELS: Record<string, string> = {
  industrialist: 'Baron Surowcowo-Przemysłowy',
  energyMagnate: 'Monopolista Energetyczno-Tech',
  realEstate: 'Magnat Nieruchomości',
  shadowBroker: 'Szara Eminencja',
  military: 'Korporacyjny Kondotier',
  supplyChain: 'Architekt Łańcuchów B2B',
};

export interface TutorialStep {
  title: string;
  content: string;
  targetSelector?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: `Witaj w ${GAME_CONFIG.title}!`,
    content:
      'Wcielasz się w prywatnego przedsiębiorcę budującego imperium gospodarcze. Zaczynasz jako Start-up (Poziom 1) i stopniowo odblokowujesz miedź, złoto, porty, lotniska cargo, jednostki HAZMAT oraz atom.',
    position: 'center',
  },
  {
    title: 'Działki, Drogi i Negocjacje Wykupu',
    content:
      'Kliknij działkę, aby ją kupić, przebadać geologicznie lub położyć własną drogę asfaltową łączącą kopalnie. Możesz też składać oferty wykupu działek innym graczom i botom AI!',
    targetSelector: '#game-canvas',
    position: 'right',
  },
  {
    title: 'Bilans Prądu, Wody i Logistyka Wielomodalna',
    content:
      'Kliknij ikonę ⚡ Prąd lub 💧 Woda w górnym pasku, aby podejrzeć bilans produkcji vs zapotrzebowania. Gdy brakuje drogi lądowej, postaw Port Towarowy lub Lotnisko Cargo!',
    targetSelector: '#top-ticker',
    position: 'bottom',
  },
  {
    title: 'Bezpieczeństwo, Szpitale i HAZMAT',
    content:
      'Przemysł ciężki narażony jest na pożary, a zakłady chemiczne i uranowe na skażenia. Remiza Straży gasi pożary, Szpital chroni załogę, a Baza HAZMAT zabezpiecza chemię i atom.',
    targetSelector: '#toolbar-dock',
    position: 'top',
  },
  {
    title: 'Powodzenia w budowie imperium!',
    content:
      'Gra zapisuje się automatycznie co kilka sekund oraz przy wyjściu z karty. Rozwijaj drzewka technologiczne, kontroluj gazety i zdobądź dominację na rynku!',
    position: 'center',
  },
];
