import type {
  ArchetypeId,
  BuildingType,
  DifficultyPreset,
  HQVariantId,
  MutatorFlags,
  ScenarioId,
  UiThemeId,
} from '../engine/types';

export const STARTER_UNLOCKED_SCENARIOS: ScenarioId[] = ['sandbox', 'gold_rush'];
export const STARTER_UNLOCKED_ARCHETYPES: ArchetypeId[] = ['standard', 'industrial_giant'];

export interface RewardMultiplierBreakdown {
  totalMultiplier: number;
  presetMult: number;
  aiBonus: number;
  mutatorBonus: number;
  breakdown: string[];
}

const PRESET_MULTIPLIER: Record<DifficultyPreset, number> = {
  rozruch: 0.85,
  standard: 1.0,
  kryzysowy: 1.35,
  przetrwanie: 1.75,
};

const MUTATOR_BONUSES: { key: keyof MutatorFlags; label: string; bonus: number }[] = [
  { key: 'noLoans', label: 'Bez Kredytów', bonus: 0.25 },
  { key: 'fogOfWar', label: 'Mgła Wojny', bonus: 0.2 },
  { key: 'volatileMarket', label: 'Szalona Giełda', bonus: 0.15 },
  { key: 'extremeClimate', label: 'Ekstremalny Klimat', bonus: 0.2 },
  { key: 'globalBreakthroughs', label: 'Globalne Przełomy Rynkowe', bonus: 0.15 },
];

/**
 * Wylicza łączny mnożnik nagród XP i Złotych Monet „M” na podstawie trudności gospodarki,
 * poziomu botów AI (gdy w grze występują boty AI) oraz włączonych mutatorów zasad.
 */
export function computeRewardMultiplier(opts: {
  difficultyPreset?: DifficultyPreset;
  aiDifficulty?: number;
  aiCount?: number;
  mutators?: Partial<MutatorFlags>;
}): RewardMultiplierBreakdown {
  const preset = opts.difficultyPreset ?? 'standard';
  const presetMult = PRESET_MULTIPLIER[preset] ?? 1.0;
  const breakdown: string[] = [`Gospodarka (${preset}): ×${presetMult.toFixed(2)}`];

  const hasBots = (opts.aiCount ?? 1) > 0;
  const aiLvl = opts.aiDifficulty ?? 2;
  const aiBonus = !hasBots
    ? 0
    : aiLvl <= 1
      ? 0
      : aiLvl === 2
        ? 0.1
        : aiLvl === 3
          ? 0.2
          : 0.25;
  if (aiBonus > 0) {
    breakdown.push(`Boty AI (poz. ${aiLvl}): +${Math.round(aiBonus * 100)}%`);
  }

  let mutatorBonus = 0;
  const muts = opts.mutators ?? {};
  for (const m of MUTATOR_BONUSES) {
    if (muts[m.key]) {
      mutatorBonus += m.bonus;
      breakdown.push(`${m.label}: +${Math.round(m.bonus * 100)}%`);
    }
  }

  const totalMultiplier = Number((presetMult * (1 + aiBonus + mutatorBonus)).toFixed(2));
  return {
    totalMultiplier,
    presetMult,
    aiBonus,
    mutatorBonus: Number(mutatorBonus.toFixed(2)),
    breakdown,
  };
}

export type ShopCategory = 'scenario' | 'archetype' | 'theme' | 'hq' | 'frame' | 'monument';

export interface ShopItemDefinition {
  id: string;
  category: ShopCategory;
  name: string;
  preview: string;
  priceMCoins: number;
  description: string;
  zeroP2WNote: string;
  unlockScenarioId?: ScenarioId;
  unlockArchetypeId?: ArchetypeId;
  uiThemeId?: UiThemeId;
  hqVariantId?: HQVariantId;
  frameId?: string;
  monumentBuildingType?: BuildingType;
  unlockIdsGranted: string[];
}

export const UI_THEME_META: Record<
  UiThemeId,
  { id: UiThemeId; label: string; badge: string; previewColors: [string, string, string]; description: string }
> = {
  theme_fintech: {
    id: 'theme_fintech',
    label: 'Dark Fintech Terminal',
    badge: '🟦',
    previewColors: ['#080c14', '#111827', '#38bdf8'],
    description: 'Domyślny, kontrastowy styl analityczny błękitu i bursztynu.',
  },
  theme_gold: {
    id: 'theme_gold',
    label: 'Wall Street Gold',
    badge: '🟨',
    previewColors: ['#0c0a06', '#1c160c', '#f59e0b'],
    description: 'Prestiżowa paleta obsydianu i czystego złota dla zarządów VIP.',
  },
  theme_emerald: {
    id: 'theme_emerald',
    label: 'Emerald Terminal',
    badge: '🟩',
    previewColors: ['#06110e', '#0d1f19', '#10b981'],
    description: 'Szmaragdowy parkiet hossy i zrównoważonego kapitału.',
  },
  theme_crimson: {
    id: 'theme_crimson',
    label: 'Crimson War Room',
    badge: '🟥',
    previewColors: ['#11070a', '#1e0e14', '#f43f5e'],
    description: 'Agresywny styl pokoju wojennego M&A oraz dyplomacji twardej ręki.',
  },
};

export const SHOP_ITEMS: ShopItemDefinition[] = [
  // 1. Scenariusze
  {
    id: 'shop_scen_fallen_giant',
    category: 'scenario',
    name: 'Scenariusz: Upadły Gigant',
    preview: '🏚️',
    priceMCoins: 350,
    description: 'Odblokowuje rywalizację o przejęcie i rewitalizację aktywów zbankrutowanego kolosa w centrum mapy.',
    zeroP2WNote: 'Nowe zasady rozgrywki dla wszystkich uczestników pokoju (Host udostępnia gościom).',
    unlockScenarioId: 'fallen_giant',
    unlockIdsGranted: ['scen_fallen_giant'],
  },
  {
    id: 'shop_scen_green_transition',
    category: 'scenario',
    name: 'Scenariusz: Zielona Transformacja',
    preview: '🌱',
    priceMCoins: 450,
    description: 'W połowie partii wchodzi globalny podatek węglowy — wygraj stawiając na OZE, fuzję i niskoemisyjny przemysł.',
    zeroP2WNote: 'Zbalansowany tryb tematyczny; darmowy dostęp dla gości w lobby Hosta.',
    unlockScenarioId: 'green_transition',
    unlockIdsGranted: ['scen_green_transition'],
  },
  {
    id: 'shop_scen_cold_war',
    category: 'scenario',
    name: 'Scenariusz: Zimna Wojna i Zbrojenia',
    preview: '🚀',
    priceMCoins: 550,
    description: 'Zaawansowany wyścig technologiczny o zlecenia wojskowe, wywiad oraz dominację strategiczną.',
    zeroP2WNote: 'Równe warunki startowe dla każdego gracza w sesji.',
    unlockScenarioId: 'cold_war',
    unlockIdsGranted: ['scen_cold_war'],
  },

  // 2. Archetypy Korporacji
  {
    id: 'shop_arch_investment_fund',
    category: 'archetype',
    name: 'Archetyp: Fundusz Inwestycyjny',
    preview: '🏦',
    priceMCoins: 300,
    description: 'Więcej gotówki i wysokie marże na nieruchomościach, lecz wyższy podatek CIT i brak rabatu przemysłowego.',
    zeroP2WNote: 'Asymetria 2 atuty + 2 ograniczenia (0% Pay-to-Win).',
    unlockArchetypeId: 'investment_fund',
    unlockIdsGranted: ['arch_investment_fund'],
  },
  {
    id: 'shop_arch_tech_incubator',
    category: 'archetype',
    name: 'Archetyp: Inkubator High-Tech',
    preview: '💻',
    priceMCoins: 350,
    description: 'Przyspieszone badania R&D i bonus do sektora chipów/baterii w zamian za droższy serwis i większy pobór prądu.',
    zeroP2WNote: 'Asymetria 2 atuty + 2 ograniczenia (0% Pay-to-Win).',
    unlockArchetypeId: 'tech_incubator',
    unlockIdsGranted: ['arch_tech_incubator'],
  },
  {
    id: 'shop_arch_logistics_cartel',
    category: 'archetype',
    name: 'Archetyp: Kartel Logistyczny',
    preview: '🚛',
    priceMCoins: 400,
    description: 'Niższe koszty dróg i transportu oraz wyższe wpływy z myta za cenę wyższych składek i niższej reputacji.',
    zeroP2WNote: 'Asymetria 2 atuty + 2 ograniczenia (0% Pay-to-Win).',
    unlockArchetypeId: 'logistics_cartel',
    unlockIdsGranted: ['arch_logistics_cartel'],
  },
  {
    id: 'shop_arch_eco_innovator',
    category: 'archetype',
    name: 'Archetyp: Ekologiczny Innowator',
    preview: '🌿',
    priceMCoins: 450,
    description: 'Premia do czystej energii i poparcia wyborców kosztem droższych zakładów ciężkiego przemysłu.',
    zeroP2WNote: 'Asymetria 2 atuty + 2 ograniczenia (0% Pay-to-Win).',
    unlockArchetypeId: 'eco_innovator',
    unlockIdsGranted: ['arch_eco_innovator'],
  },

  // 3. Motywy Kolorystyczne Interfejsu
  {
    id: 'shop_theme_gold',
    category: 'theme',
    name: 'Motyw: Wall Street Gold',
    preview: '🟨',
    priceMCoins: 420,
    description: 'Ciemny terminal giełdowy ze złotymi ramkami, suwakami i akcentami premium.',
    zeroP2WNote: 'Wyłącznie wygląd UI — zero wpływu na balans rozgrywki.',
    uiThemeId: 'theme_gold',
    unlockIdsGranted: ['theme_gold'],
  },
  {
    id: 'shop_theme_emerald',
    category: 'theme',
    name: 'Motyw: Emerald Terminal',
    preview: '🟩',
    priceMCoins: 420,
    description: 'Szmaragdowy motyw analityczny w klimacie wielkich biur maklerskich.',
    zeroP2WNote: 'Wyłącznie wygląd UI — zero wpływu na balans rozgrywki.',
    uiThemeId: 'theme_emerald',
    unlockIdsGranted: ['theme_emerald'],
  },
  {
    id: 'shop_theme_crimson',
    category: 'theme',
    name: 'Motyw: Crimson War Room',
    preview: '🟥',
    priceMCoins: 480,
    description: 'Ciemno-karminowa oprawa sztabu dowodzenia korporacją.',
    zeroP2WNote: 'Wyłącznie wygląd UI — zero wpływu na balans rozgrywki.',
    uiThemeId: 'theme_crimson',
    unlockIdsGranted: ['theme_crimson'],
  },

  // 4. Skórki HQ 2.5D
  {
    id: 'shop_hq_golden',
    category: 'hq',
    name: 'HQ: Złota Wieża Fortuny',
    preview: '🏛️',
    priceMCoins: 500,
    description: 'Pozłacana siedziba korporacji widoczna dla wszystkich graczy na mapie 2.5D.',
    zeroP2WNote: 'Kosmetyka 2.5D (można też odblokować osiągnięciem $25M).',
    hqVariantId: 'golden',
    unlockIdsGranted: ['hq_golden'],
  },
  {
    id: 'shop_hq_eco_dome',
    category: 'hq',
    name: 'HQ: Eko-Kopuła OZE',
    preview: '🌿',
    priceMCoins: 500,
    description: 'Szklana biosfera zarządu z zielonymi tarasami na mapie izometrycznej.',
    zeroP2WNote: 'Kosmetyka 2.5D (zero bonusów w ekonomii).',
    hqVariantId: 'eco_dome',
    unlockIdsGranted: ['hq_eco_dome'],
  },
  {
    id: 'shop_hq_cyber_citadel',
    category: 'hq',
    name: 'HQ: Cytadela Cybernetyczna',
    preview: '⚡',
    priceMCoins: 650,
    description: 'Obsydianowo-neonowy wieżowiec High-Tech z anteną kwantową.',
    zeroP2WNote: 'Kosmetyka 2.5D (zero bonusów w ekonomii).',
    hqVariantId: 'cyber_citadel',
    unlockIdsGranted: ['hq_cyber_citadel'],
  },
  {
    id: 'shop_hq_monolith',
    category: 'hq',
    name: 'HQ: Monolit Obsydianowy',
    preview: '🖤',
    priceMCoins: 700,
    description: 'Monumentalny, czarny kryształ zarządczy z diodowym rdzeniem świetlnym.',
    zeroP2WNote: 'Kosmetyka 2.5D (zero bonusów w ekonomii).',
    hqVariantId: 'monolith_obsidian',
    unlockIdsGranted: ['hq_monolith'],
  },

  // 5. Animowane Ramki Karty Prezesa
  {
    id: 'shop_frame_neon',
    category: 'frame',
    name: 'Ramka: Neonowy Impuls (Anim.)',
    preview: '💠',
    priceMCoins: 280,
    description: 'Pulsujące błękitne obramowanie karty uczestnika w Lobby i Profilu.',
    zeroP2WNote: 'Kosmetyka społecznościowa — widoczna w Lobby P2P.',
    frameId: 'frame_neon_pulse',
    unlockIdsGranted: ['frame_neon_pulse'],
  },
  {
    id: 'shop_frame_gold_aura',
    category: 'frame',
    name: 'Ramka: Złota Aura Giełdy (Anim.)',
    preview: '✨',
    priceMCoins: 380,
    description: 'Złociste, połyskujące tło karty gracza wyróżniające doświadczonych inwestorów.',
    zeroP2WNote: 'Kosmetyka społecznościowa — widoczna w Lobby P2P.',
    frameId: 'frame_golden_aura',
    unlockIdsGranted: ['frame_golden_aura'],
  },
  {
    id: 'shop_frame_crimson_matrix',
    category: 'frame',
    name: 'Ramka: Szkarłatna Matryca (Anim.)',
    preview: '🔥',
    priceMCoins: 380,
    description: 'Krwistoczerwona animowana rama sztabu strategicznego.',
    zeroP2WNote: 'Kosmetyka społecznościowa — widoczna w Lobby P2P.',
    frameId: 'frame_crimson_matrix',
    unlockIdsGranted: ['frame_crimson_matrix'],
  },

  // 6. Prestiżowe Dekoracje 2.5D na mapę (statystyki 1:1 jak Park Miejski)
  {
    id: 'shop_mon_fountain',
    category: 'monument',
    name: 'Pomnik 2.5D: Fontanna Korporacyjna',
    preview: '⛲',
    priceMCoins: 320,
    description: 'Dekoracyjny plac wodny 2.5D (statystyki 1:1 jak Park Miejski — zero P2W).',
    zeroP2WNote: 'Identyczny koszt, utrzymanie i neutralizacja smogu jak Park Miejski.',
    monumentBuildingType: 'monumentFountain',
    unlockIdsGranted: ['mon_fountain'],
  },
  {
    id: 'shop_mon_obelisk',
    category: 'monument',
    name: 'Pomnik 2.5D: Obelisk Wall Street',
    preview: '🗼',
    priceMCoins: 420,
    description: 'Złoto-marmurowy obelisk na mapę izometryczną (statystyki 1:1 jak Park Miejski).',
    zeroP2WNote: 'Identyczny koszt, utrzymanie i neutralizacja smogu jak Park Miejski.',
    monumentBuildingType: 'monumentObelisk',
    unlockIdsGranted: ['mon_obelisk'],
  },
  {
    id: 'shop_mon_helipad',
    category: 'monument',
    name: 'Pomnik 2.5D: Lądowisko Odrzutowców',
    preview: '🛩️',
    priceMCoins: 520,
    description: 'Ekskluzywna strefa VIP z lądowiskiem prywatnym (statystyki 1:1 jak Park Miejski).',
    zeroP2WNote: 'Identyczny koszt, utrzymanie i neutralizacja smogu jak Park Miejski.',
    monumentBuildingType: 'monumentHelipad',
    unlockIdsGranted: ['mon_helipad'],
  },
  {
    id: 'shop_mon_founder',
    category: 'monument',
    name: 'Pomnik 2.5D: Złoty Pomnik Założyciela',
    preview: '🗽',
    priceMCoins: 680,
    description: 'Ikoniczna statua założyciela imperium na cokole (statystyki 1:1 jak Park Miejski).',
    zeroP2WNote: 'Identyczny koszt, utrzymanie i neutralizacja smogu jak Park Miejski.',
    monumentBuildingType: 'monumentFounder',
    unlockIdsGranted: ['mon_founder'],
  },
];

export const SCENARIO_SHOP_ITEM_ID: Partial<Record<ScenarioId, string>> = {
  fallen_giant: 'scen_fallen_giant',
  green_transition: 'scen_green_transition',
  cold_war: 'scen_cold_war',
};

export const ARCHETYPE_SHOP_ITEM_ID: Partial<Record<ArchetypeId, string>> = {
  investment_fund: 'arch_investment_fund',
  tech_incubator: 'arch_tech_incubator',
  logistics_cartel: 'arch_logistics_cartel',
  eco_innovator: 'arch_eco_innovator',
};

export const MONUMENT_COSMETIC_BY_BUILDING: Partial<Record<BuildingType, string>> = {
  monumentFountain: 'mon_fountain',
  monumentObelisk: 'mon_obelisk',
  monumentHelipad: 'mon_helipad',
  monumentFounder: 'mon_founder',
};

export function isScenarioUnlocked(
  unlockedCosmetics: string[],
  scenarioId: ScenarioId,
  hostUnlockedScenarios?: ScenarioId[]
): boolean {
  if (STARTER_UNLOCKED_SCENARIOS.includes(scenarioId)) return true;
  if (hostUnlockedScenarios?.includes(scenarioId)) return true;
  const reqId = SCENARIO_SHOP_ITEM_ID[scenarioId];
  return reqId ? unlockedCosmetics.includes(reqId) : true;
}

export function isArchetypeUnlocked(unlockedCosmetics: string[], archetypeId: ArchetypeId): boolean {
  if (STARTER_UNLOCKED_ARCHETYPES.includes(archetypeId)) return true;
  const reqId = ARCHETYPE_SHOP_ITEM_ID[archetypeId];
  return reqId ? unlockedCosmetics.includes(reqId) : true;
}

export function getUnlockedScenariosForProfile(unlockedCosmetics: string[]): ScenarioId[] {
  const all: ScenarioId[] = ['sandbox', 'gold_rush', 'fallen_giant', 'green_transition', 'cold_war'];
  return all.filter((id) => isScenarioUnlocked(unlockedCosmetics, id));
}

export function getUnlockedMonumentsForProfile(unlockedCosmetics: string[]): BuildingType[] {
  return (Object.entries(MONUMENT_COSMETIC_BY_BUILDING) as [BuildingType, string][])
    .filter(([, unlockId]) => unlockedCosmetics.includes(unlockId))
    .map(([bType]) => bType);
}
