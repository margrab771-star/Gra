import type { ArchetypeId } from '../engine/types';

export interface ArchetypeModifiers {
  startingCashMult: number;
  loanInterestMult: number;
  stockAccessCorpLevelDelta: number;
  industrialUpkeepMult: number;
  miningYieldMult: number;
  heavyBuildCostMult: number;
  roadBuildCostMult: number;
  baseApprovalDelta: number;
  pollutionFineMult: number;
  researchSpeedMult: number;
  labPatentCostMult: number;
  advancedPowerUsageMult: number;
  tollRevenueMult: number;
  passengerFleetCostMult: number;
  surveyCostMult: number;
  retailMarginDelta: number;
  renewableRecycleMult: number;
  coalHeavyCostMult: number;
  incineratorApprovalPenalty: number;
}

export interface ArchetypeDefinition {
  id: ArchetypeId;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  tagline: string;
  pros: string[];
  cons: string[];
  modifiers: ArchetypeModifiers;
}

const DEFAULT_MODIFIERS: ArchetypeModifiers = {
  startingCashMult: 1,
  loanInterestMult: 1,
  stockAccessCorpLevelDelta: 0,
  industrialUpkeepMult: 1,
  miningYieldMult: 1,
  heavyBuildCostMult: 1,
  roadBuildCostMult: 1,
  baseApprovalDelta: 0,
  pollutionFineMult: 1,
  researchSpeedMult: 1,
  labPatentCostMult: 1,
  advancedPowerUsageMult: 1,
  tollRevenueMult: 1,
  passengerFleetCostMult: 1,
  surveyCostMult: 1,
  retailMarginDelta: 0,
  renewableRecycleMult: 1,
  coalHeavyCostMult: 1,
  incineratorApprovalPenalty: 0,
};

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDefinition> = {
  standard: {
    id: 'standard',
    name: 'Standardowy Konglomerat',
    shortName: 'Standardowy',
    icon: '🏢',
    color: '#94a3b8',
    tagline: 'Zbalansowany start bez modyfikatorów i ukrytych kar.',
    pros: ['Brak jakichkolwiek osłabień sektorowych', 'Pełna elastyczność strategiczna w każdym etapie gry'],
    cons: ['Brak wyspecjalizowanych premii na starcie'],
    modifiers: { ...DEFAULT_MODIFIERS },
  },
  investment_fund: {
    id: 'investment_fund',
    name: 'Fundusz Inwestycyjny',
    shortName: 'Fundusz',
    icon: '💼',
    color: '#fbbf24',
    tagline: 'Tani kapitał i przewaga giełdowa kosztem ciężkiego przemysłu.',
    pros: [
      '+25% gotówki startowej na agresywne przejęcia i giełdę',
      '-20% oprocentowania kredytów i wcześniejszy dostęp do giełdy',
    ],
    cons: [
      '+15% kosztów utrzymania zakładów przemysłowych',
      '-10% wydajności wydobycia złóż mineralnych',
    ],
    modifiers: {
      ...DEFAULT_MODIFIERS,
      startingCashMult: 1.25,
      loanInterestMult: 0.8,
      stockAccessCorpLevelDelta: -1,
      industrialUpkeepMult: 1.15,
      miningYieldMult: 0.9,
    },
  },
  industrial_giant: {
    id: 'industrial_giant',
    name: 'Gigant Przemysłowy',
    shortName: 'Przemysł',
    icon: '🏭',
    color: '#f97316',
    tagline: 'Potęga surowcowo-fabryczna kosztem wizerunku i kar środowiskowych.',
    pros: [
      '-15% kosztu budowy kopalń, hut, fabryk i dróg',
      '+10% wydajności produkcji i wydobycia surowców',
    ],
    cons: [
      '-15% bazowego poparcia społecznego od 1. dnia',
      '+20% kar finansowych za zanieczyszczenia i spalarnie',
    ],
    modifiers: {
      ...DEFAULT_MODIFIERS,
      heavyBuildCostMult: 0.85,
      roadBuildCostMult: 0.85,
      miningYieldMult: 1.1,
      baseApprovalDelta: -15,
      pollutionFineMult: 1.2,
    },
  },
  tech_incubator: {
    id: 'tech_incubator',
    name: 'Inkubator Technologiczny',
    shortName: 'Tech Lab',
    icon: '🔬',
    color: '#38bdf8',
    tagline: 'Szybkie patenty i R&D kosztem mniejszego kapitału oraz ogromnego poboru MW.',
    pros: [
      '+20% szybkości zdobywania i realizacji badań R&D',
      '-15% kosztu wdrożenia technologii, laboratoriów i patentów',
    ],
    cons: [
      '-20% gotówki startowej w portfelu',
      '+20% poboru prądu (MW) przez obiekty high-tech i przemysł',
    ],
    modifiers: {
      ...DEFAULT_MODIFIERS,
      researchSpeedMult: 1.2,
      labPatentCostMult: 0.85,
      startingCashMult: 0.8,
      advancedPowerUsageMult: 1.2,
    },
  },
  logistics_cartel: {
    id: 'logistics_cartel',
    name: 'Kartel Logistyczny',
    shortName: 'Logistyka',
    icon: '🛣️',
    color: '#a855f7',
    tagline: 'Król autostrad i transportu pasażerskiego kosztem drogiej geologii i handlu.',
    pros: [
      '+25% przychodu z myta na własnych autostradach',
      '-20% kosztu budowy i utrzymania floty, stacji pasażerskich i transportu',
    ],
    cons: [
      '+25% kosztu odwiertów i badań geologicznych',
      '-10% marży w obiektach handlu detalicznego i rozrywki',
    ],
    modifiers: {
      ...DEFAULT_MODIFIERS,
      tollRevenueMult: 1.25,
      passengerFleetCostMult: 0.8,
      surveyCostMult: 1.25,
      retailMarginDelta: -0.1,
    },
  },
  eco_innovator: {
    id: 'eco_innovator',
    name: 'Eko-Innowator',
    shortName: 'Eko-Lider',
    icon: '🌱',
    color: '#10b981',
    tagline: 'Mistrz OZE, recyklingu i wyborców — z wysoką barierą dla węgla.',
    pros: [
      '+15% wydajności OZE (wiatr, słońce, geotermia, fuzja) i recyklingu',
      '+12% bazowego poparcia społecznego wyborców',
    ],
    cons: [
      '+30% kosztu budowy obiektów węglowych i przemysłu ciężkiego',
      'Spalarnie odpadów powodują dotkliwą utratę poparcia (-4 pkt/cykl)',
    ],
    modifiers: {
      ...DEFAULT_MODIFIERS,
      renewableRecycleMult: 1.15,
      baseApprovalDelta: 12,
      coalHeavyCostMult: 1.3,
      incineratorApprovalPenalty: 4,
    },
  },
};

export const ARCHETYPE_LIST: ArchetypeDefinition[] = Object.values(ARCHETYPES);

export function getArchetypeDefinition(id?: ArchetypeId): ArchetypeDefinition {
  return (id && ARCHETYPES[id]) || ARCHETYPES.standard;
}
