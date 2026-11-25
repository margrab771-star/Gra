import type { InfluenceAction } from '../engine/types';

export const INFLUENCE_ACTIONS: InfluenceAction[] = [
  // ─── Filar Finansowy ───────────────────────────────────────────────────────
  {
    id: 'bribery',
    name: 'Łapówka Urzędnicza',
    pillar: 'financial',
    description:
      'Dyskretne wsparcie dla urzędników nadzoru budowlanego i skarbowego. Natychmiast buduje wpływy finansowe i tymczasowo chroni przed karami środowiskowymi.',
    cost: 65_000,
    cooldownTicks: 14,
    requiredScore: 0,
    estimatedEffect: '+12 wpływów fin., 10 tur tarczy przed karami i kontrolami',
  },
  {
    id: 'lobbying',
    name: 'Lobbing Podatkowo-Składkowy',
    pillar: 'financial',
    description:
      'Finansowanie think-tanków i grup lobbingowych w celu uzyskania ulg w podatku CIT dla Twojej grupy kapitałowej.',
    cost: 185_000,
    cooldownTicks: 24,
    requiredScore: 20,
    estimatedEffect: '-40% podatku CIT dla Twojej firmy przez 20 tur, +15 wpływów fin.',
  },
  {
    id: 'buy_law',
    name: 'Kupno Ustawy Rynkowej',
    pillar: 'financial',
    description:
      'Przeforsuj ustawę deregulacyjną obniżającą ogólnokrajowe narzuty i podatek CIT oraz wzmacniającą Twoją pozycję monopolistyczną.',
    cost: 540_000,
    cooldownTicks: 45,
    requiredScore: 60,
    estimatedEffect: 'Obniża CIT w państwie o 2 p.p., +25 wpływów fin., podbija udział w rynku',
  },
  {
    id: 'forced_buyout',
    name: 'Ustawa o Przymusowym Wykupie',
    pillar: 'financial',
    description:
      'Przy miażdżącej przewadze kapitałowej (Etap 4+) zmuś konkurenta do sprzedaży strategicznej działki. Może zostać zablokowana przez Kontrwywiad / Kancelarię Antymonopolową celu!',
    cost: 1_450_000,
    cooldownTicks: 75,
    requiredScore: 110,
    requiresTargetPlayer: true,
    requiresTargetPlot: true,
    estimatedEffect: 'Przejmuje wskazaną działkę i obiekt rywala (chroni przed nią Kontrwywiad/Biuro Lobbingu)',
  },

  // ─── Filar Militarny ("Abordaż" i Siła) ────────────────────────────────────
  {
    id: 'espionage',
    name: 'Szpiegostwo Przemysłowe',
    pillar: 'military',
    description:
      'Wykradnij księgi finansowe, rezerwy gotówki, plany inwestycyjne rywala oraz raporty o tajnych programach nuklearnych.',
    cost: 115_000,
    cooldownTicks: 20,
    requiredScore: 15,
    requiresTargetPlayer: true,
    estimatedEffect: 'Ujawnia pełne finanse i tajne projekty wroga na 20 tur i przejmuje +15 pkt badań',
  },
  {
    id: 'sabotage',
    name: 'Sabotaż Infrastruktury',
    pillar: 'military',
    description:
      'Uderz w kluczowy zakład konkurenta (np. elektrownię lub hutę), uszkadzając maszyny i przerywając łańcuch dostaw.',
    cost: 220_000,
    cooldownTicks: 30,
    requiredScore: 35,
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
    cost: 820_000,
    cooldownTicks: 55,
    requiredScore: 75,
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
    cost: 2_600_000,
    cooldownTicks: 110,
    requiredScore: 130,
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
    cost: 85_000,
    cooldownTicks: 15,
    requiredScore: 0,
    estimatedEffect: '+20 poparcia Kościoła, +15 wpływów społ., +8 nastrojów wyborców',
  },
  {
    id: 'media_campaign',
    name: 'Kampania Medialna i PR',
    pillar: 'social',
    description:
      'Steruj przekazem w prasie i telewizji, kreując wizerunek narodowego czempiona i poprawiając własną reputację.',
    cost: 130_000,
    cooldownTicks: 18,
    requiredScore: 18,
    estimatedEffect: '+20 kontroli mediów, +18 wpływów społ., +10 reputacji, +8 poparcia wyborców',
  },
  {
    id: 'voter_mobilization',
    name: 'Zakulisowa Mobilizacja Wyborców',
    pillar: 'social',
    description:
      'Wykorzystaj kościół, media i związki zawodowe do przeforsowania korzystnych regulacji pracowniczych i podatkowych.',
    cost: 260_000,
    cooldownTicks: 30,
    requiredScore: 45,
    estimatedEffect: 'Zwiększa przychylność rządu (-10% ZUS) i +25 wpływów społ.',
  },
  {
    id: 'organize_boycott',
    name: 'Bojkot Konsumencki Rywala',
    pillar: 'social',
    description:
      'Ukryta kampania medialno-społeczna wywołuje bojkot produktów i nieruchomości wybranego rywala.',
    cost: 240_000,
    cooldownTicks: 28,
    requiredScore: 40,
    requiresTargetPlayer: true,
    estimatedEffect: 'Obniża przychody wszystkich obiektów rywala o 35% na 12 tur!',
  },
];
