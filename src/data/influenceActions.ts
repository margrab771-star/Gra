import type { InfluenceAction } from '../engine/types';

export const INFLUENCE_ACTIONS: InfluenceAction[] = [
  // ─── Filar Finansowy ───────────────────────────────────────────────────────
  {
    id: 'bribery',
    name: 'Łapówka Urzędnicza',
    pillar: 'financial',
    description:
      'Dyskretne wsparcie dla urzędników nadzoru budowlanego i skarbowego. Natychmiast buduje wpływy finansowe i tymczasowo chroni przed karami środowiskowymi.',
    cost: 45_000,
    cooldownTicks: 10,
    requiredScore: 0,
    estimatedEffect: '+12 wpływów fin., 10 tur tarczy przed karami i kontrolami',
  },
  {
    id: 'lobbying',
    name: 'Lobbing Podatkowo-Składkowy',
    pillar: 'financial',
    description:
      'Finansowanie think-tanków i grup lobbingowych w celu uzyskania ulg w podatku CIT dla Twojej grupy kapitałowej.',
    cost: 120_000,
    cooldownTicks: 18,
    requiredScore: 15,
    estimatedEffect: '-40% podatku CIT dla Twojej firmy przez 20 tur, +15 wpływów fin.',
  },
  {
    id: 'buy_law',
    name: 'Kupno Ustawy Rynkowej',
    pillar: 'financial',
    description:
      'Przeforsuj ustawę deregulacyjną obniżającą ogólnokrajowe narzuty ZUS lub podatek CIT oraz wzmacniającą Twoją pozycję monopolistyczną.',
    cost: 320_000,
    cooldownTicks: 30,
    requiredScore: 40,
    estimatedEffect: 'Obniża CIT w państwie o 2 p.p., +25 wpływów fin., podbija udział w rynku',
  },
  {
    id: 'forced_buyout',
    name: 'Ustawa o Przymusowym Wykupie',
    pillar: 'financial',
    description:
      'Przy absolutnej przewadze kapitałowej zmuś wybranego konkurenta do sprzedaży strategicznej działki z budynkiem po cenie urzędowej — bez prawa negocjacji!',
    cost: 650_000,
    cooldownTicks: 40,
    requiredScore: 70,
    requiresTargetPlayer: true,
    requiresTargetPlot: true,
    estimatedEffect: 'Przejmuje wskazaną działkę i obiekt konkurenta bez możliwości odmowy',
  },

  // ─── Filar Militarny ("Abordaż" i Siła) ────────────────────────────────────
  {
    id: 'espionage',
    name: 'Szpiegostwo Przemysłowe',
    pillar: 'military',
    description:
      'Wykradnij księgi finansowe, rezerwy gotówki i plany inwestycyjne rywala, a także wykradnij punkty badań.',
    cost: 75_000,
    cooldownTicks: 14,
    requiredScore: 10,
    requiresTargetPlayer: true,
    estimatedEffect: 'Ujawnia pełne finanse wroga na 20 tur i przejmuje +15 pkt badań',
  },
  {
    id: 'sabotage',
    name: 'Sabotaż Infrastruktury',
    pillar: 'military',
    description:
      'Uderz w kluczowy zakład konkurenta (np. elektrownię lub hutę), uszkadzając maszyny i przerywając łańcuch dostaw.',
    cost: 140_000,
    cooldownTicks: 20,
    requiredScore: 25,
    requiresTargetPlayer: true,
    requiresTargetBuilding: true,
    estimatedEffect: 'Uszkadza obiekt wroga (-45% stanu) i wstrzymuje produkcję na 8 tur',
  },
  {
    id: 'corporate_raid',
    name: 'Abordaż Korporacyjny',
    pillar: 'military',
    description:
      'Siłowe przejęcie obiektu lub aktywa konkurenta za pomocą prywatnych jednostek taktycznych i nakazów przejęcia.',
    cost: 480_000,
    cooldownTicks: 32,
    requiredScore: 55,
    requiredTech: 'mil_boarding',
    requiresTargetPlayer: true,
    requiresTargetBuilding: true,
    estimatedEffect: 'Przejmuje wybrany budynek i działkę przeciwnika na własność!',
  },
  {
    id: 'coup_attempt',
    name: 'Zamach Stanu',
    pillar: 'military',
    description:
      'Skrajna operacja korporacyjno-militarna: obalenie rządu i narzucenie dyktatu gospodarczego Twojego konglomeratu.',
    cost: 1_500_000,
    cooldownTicks: 80,
    requiredScore: 95,
    requiredTech: 'mil_coup',
    estimatedEffect: 'Natychmiastowe przejęcie kontroli nad państwem (lub gigantyczny skok monopolu)',
  },

  // ─── Filar Ukryty / Społeczny (Wyborcy, Kościół, Media) ────────────────────
  {
    id: 'church_donation',
    name: 'Sojusz i Dotacja Kościelna',
    pillar: 'social',
    description:
      'Hojne wsparcie dla duchowieństwa i fundacji społecznych buduje zaufanie konserwatywnych wyborców oraz chroni przed bojkotami.',
    cost: 65_000,
    cooldownTicks: 12,
    requiredScore: 0,
    estimatedEffect: '+20 poparcia Kościoła, +15 wpływów społ., +8 nastrojów wyborców',
  },
  {
    id: 'media_campaign',
    name: 'Kampania Medialna i PR',
    pillar: 'social',
    description:
      'Steruj przekazem w prasie i telewizji, kreując wizerunek narodowego czempiona i poprawiając własną reputację.',
    cost: 95_000,
    cooldownTicks: 14,
    requiredScore: 15,
    estimatedEffect: '+20 kontroli mediów, +18 wpływów społ., +10 reputacji',
  },
  {
    id: 'voter_mobilization',
    name: 'Zakulisowa Mobilizacja Wyborców',
    pillar: 'social',
    description:
      'Wykorzystaj kościół, media i związki zawodowe do przeforsowania korzystnych regulacji pracowniczych i podatkowych.',
    cost: 180_000,
    cooldownTicks: 22,
    requiredScore: 35,
    estimatedEffect: 'Zwiększa przychylność rządu (-10% ZUS na 18 tur) i +25 wpływów społ.',
  },
  {
    id: 'organize_boycott',
    name: 'Bojkot Konsumencki Rywala',
    pillar: 'social',
    description:
      'Ukryta kampania medialno-społeczna wywołuje bojkot produktów i nieruchomości wybranego rywala.',
    cost: 150_000,
    cooldownTicks: 20,
    requiredScore: 30,
    requiresTargetPlayer: true,
    estimatedEffect: 'Obniża przychody wszystkich obiektów rywala o 35% na 12 tur!',
  },
];
