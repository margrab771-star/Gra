import type { AchievementCategory, HQVariantId } from '../engine/types';

export interface AchievementDefinition {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  badgeEmoji: string;
  badgeLabel: string;
  xpReward: number;
  unlockTitle?: string;
  unlockCosmetic?: { kind: 'hq' | 'frame' | 'emblem'; id: string; label: string };
}

export interface CosmeticItem {
  id: string;
  kind: 'hq' | 'frame' | 'emblem';
  name: string;
  preview: string;
  description: string;
  unlockHint: string;
  hqVariantId?: HQVariantId;
}

export const PROFILE_AVATARS = ['👔', '🦊', '🦅', '🦁', '🦉', '🐉', '💎', '🛰️', '🎩', '⚡', '🌿', '🏦'];

export const HQ_COSMETICS: CosmeticItem[] = [
  {
    id: 'hq_classic',
    kind: 'hq',
    hqVariantId: 'classic',
    name: 'Klasyczny Wieżowiec',
    preview: '🏢',
    description: 'Standardowy przeszklony wieżowiec zarządu korporacji.',
    unlockHint: 'Odblokowany domyślnie',
  },
  {
    id: 'hq_golden',
    kind: 'hq',
    hqVariantId: 'golden',
    name: 'Złota Wieża Fortuny',
    preview: '🏛️',
    description: 'Złocona fasada ze złotym iglicowym wieńcem i iluminacją VIP.',
    unlockHint: 'Osiągnij $25M wyceny netto lub odblokuj 6 osiągnięć',
  },
  {
    id: 'hq_eco_dome',
    kind: 'hq',
    hqVariantId: 'eco_dome',
    name: 'Eko-Kopuła OZE',
    preview: '🌿',
    description: 'Futurystyczna biosfera z tarasami zieleni i panelami słonecznymi.',
    unlockHint: 'Osiągnięcie „Zielony Wizjoner” lub 10 poziom konta',
  },
  {
    id: 'hq_cyber_citadel',
    kind: 'hq',
    hqVariantId: 'cyber_citadel',
    name: 'Cytadela Cybernetyczna',
    preview: '⚡',
    description: 'Obsydianowo-neonowy rdzeń zarządczy klasy High-Tech z anteną kwantową.',
    unlockHint: 'Osiągnięcie „Monopolista High-Tech” lub Sklep Prezesa',
  },
  {
    id: 'hq_monolith',
    kind: 'hq',
    hqVariantId: 'monolith_obsidian',
    name: 'Monolit Obsydianowy',
    preview: '🖤',
    description: 'Minimalistyczna forteca zarządu ze szkła wulkanicznego i diodowych pasm.',
    unlockHint: 'Sklep Prezesa lub Poziom 10 Karnetu Sezon 1',
  },
  {
    id: 'hq_platinum',
    kind: 'hq',
    hqVariantId: 'platinum_spire',
    name: 'Platynowa Iglica Prestiżu',
    preview: '💎',
    description: 'Najwyższa kosmetyczna sylwetka HQ Sezonu 1 z platynowym światłem koronnym.',
    unlockHint: 'Poziom 30 Karnetu Prezesa Sezon 1',
  },
];

export const FRAME_COSMETICS: CosmeticItem[] = [
  {
    id: 'frame_slate',
    kind: 'frame',
    name: 'Stalowy Terminal',
    preview: '▫️',
    description: 'Klasyczna ramka karty Prezesa.',
    unlockHint: 'Odblokowana domyślnie',
  },
  {
    id: 'frame_gold',
    kind: 'frame',
    name: 'Złota Korona Giełdy',
    preview: '🟡',
    description: 'Złote obramowanie z połyskiem elitarnego funduszu.',
    unlockHint: 'Poziom Konta 4+ lub 5 osiągnięć ekonomicznych',
  },
  {
    id: 'frame_emerald',
    kind: 'frame',
    name: 'Szmaragdowa Sieć',
    preview: '🟢',
    description: 'Neonowa zielona ramka pionierów czystej energii.',
    unlockHint: 'Ukończ 2 Tajne Cele lub 3 wygrane mecze',
  },
  {
    id: 'frame_crimson',
    kind: 'frame',
    name: 'Szkarłat Imperium',
    preview: '🔴',
    description: 'Elitarne wykończenie dla weteranów wojen korporacyjnych i Hardkoru.',
    unlockHint: 'Odblokuj osiągnięcie „Żelazny Przetrwalnik” lub „Atomowy Odstraszacz”',
  },
  {
    id: 'frame_neon_pulse',
    kind: 'frame',
    name: 'Neonowy Impuls (Anim.)',
    preview: '💠',
    description: 'Animowana ramka pulsująca błękitem terminala HFT.',
    unlockHint: 'Sklep Prezesa lub Poziom 15 Karnetu Sezon 1',
  },
  {
    id: 'frame_golden_aura',
    kind: 'frame',
    name: 'Złota Aura Giełdy (Anim.)',
    preview: '✨',
    description: 'Animowana złota poświata karty gracza w lobby multiplayer.',
    unlockHint: 'Sklep Prezesa lub Poziom 25 Karnetu Sezon 1',
  },
  {
    id: 'frame_crimson_matrix',
    kind: 'frame',
    name: 'Szkarłatna Matryca (Anim.)',
    preview: '🔥',
    description: 'Pulsująca obwódka wojenna zarezerwowana dla rekinów rynku.',
    unlockHint: 'Sklep Prezesa',
  },
];

export const TITLES_CATALOG: { id: string; label: string; unlockHint: string }[] = [
  { id: 'title_startup', label: 'Pionier Rynku', unlockHint: 'Domyślny tytuł każdego konta' },
  { id: 'title_diamond_king', label: 'Król Diamentów', unlockHint: 'Osiągnięcie: Król Diamentów' },
  { id: 'title_bailiff', label: 'Bezlitosny Komornik', unlockHint: 'Osiągnięcie: Bezlitosny Komornik' },
  { id: 'title_green_visionary', label: 'Zielony Wizjoner', unlockHint: 'Osiągnięcie: Zielony Wizjoner' },
  { id: 'title_crash_survivor', label: 'Ocalały z Krachu', unlockHint: 'Osiągnięcie: Ocalały z Krachu' },
  { id: 'title_coalition_architect', label: 'Architekt Koalicji', unlockHint: 'Osiągnięcie: Architekt Koalicji' },
  { id: 'title_toll_master', label: 'Król Autostrad', unlockHint: 'Osiągnięcie: Mistrz Myta' },
  { id: 'title_weekly_champ', label: 'Czempion Tygodnia', unlockHint: 'Ukończ dowolne Wyzwanie Tygodnia' },
  { id: 'title_high_stakes', label: 'Lider Wysokich Stawek', unlockHint: 'Karnet Sezon 1 (Poziom 8)' },
  { id: 'title_bp_tycoon', label: 'Baron Wall Street', unlockHint: 'Karnet Sezon 1 (Poziom 18)' },
  { id: 'title_season_one', label: 'Architekt Rynku S1', unlockHint: 'Ukończ Poziom 30 Karnetu Sezon 1' },
  { id: 'title_prestige_star', label: 'Weteran Prestiżu ★', unlockHint: 'Aktywuj Prestiż na Poziomie 20+' },
];

export const ACHIEVEMENT_CATEGORIES: { key: AchievementCategory; label: string; icon: string }[] = [
  { key: 'economy', label: 'Ekonomia i Giełda', icon: '📈' },
  { key: 'industry', label: 'Przemysł i Surowce', icon: '⛏️' },
  { key: 'politics', label: 'Polityka i Wojna', icon: '🏛️' },
  { key: 'multiplayer', label: 'Multiplayer i Koalicje', icon: '🌐' },
  { key: 'extreme', label: 'Ekstremalne', icon: '🔥' },
];

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // 1. Ekonomia i Giełda (6)
  {
    id: 'ach_first_million',
    category: 'economy',
    name: 'Milion w Sejfie',
    description: 'Zgromadź ponad $10 000 000 wyceny netto podczas jednej sesji.',
    badgeEmoji: '💵',
    badgeLabel: 'Kapitalista',
    xpReward: 120,
  },
  {
    id: 'ach_tycoon_25m',
    category: 'economy',
    name: 'Koncern ćwierćmiliardowy',
    description: 'Przekrocz $25 000 000 wyceny netto w trakcie rozgrywki.',
    badgeEmoji: '🏛️',
    badgeLabel: 'Magnat $25M',
    xpReward: 260,
    unlockCosmetic: { kind: 'hq', id: 'hq_golden', label: 'HQ: Złota Wieża Fortuny' },
  },
  {
    id: 'ach_tycoon_50m',
    category: 'economy',
    name: 'Miliarder Rynkowy',
    description: 'Przekrocz $50 000 000 wyceny netto w jednej grze.',
    badgeEmoji: '👑',
    badgeLabel: 'Imperator $50M',
    xpReward: 420,
    unlockCosmetic: { kind: 'frame', id: 'frame_gold', label: 'Ramka: Złota Korona Giełdy' },
  },
  {
    id: 'ach_debt_free_winner',
    category: 'economy',
    name: 'Czysty Bilans',
    description: 'Osiągnij Poziom Korporacji 4+ bez żadnego aktywnego kredytu.',
    badgeEmoji: '⚖️',
    badgeLabel: 'Czysty Bilans',
    xpReward: 180,
  },
  {
    id: 'ach_crash_survivor',
    category: 'economy',
    name: 'Ocalały z Krachu',
    description: 'Przetrwaj krach giełdowy utrzymując dodatni przepływ gotówki i wyjdź powyżej $12M.',
    badgeEmoji: '📉',
    badgeLabel: 'Ocalały z Krachu',
    xpReward: 240,
    unlockTitle: 'title_crash_survivor',
  },
  {
    id: 'ach_stock_shark',
    category: 'economy',
    name: 'Rekin Parkietu',
    description: 'Wykup ponad 25% udziałów giełdowych konkurencyjnej spółki.',
    badgeEmoji: '🦈',
    badgeLabel: 'Rekin Giełdy',
    xpReward: 200,
  },

  // 2. Przemysł i Surowce (6)
  {
    id: 'ach_diamond_king',
    category: 'industry',
    name: 'Król Diamentów',
    description: 'Wydobywaj diamenty i posiadaj równocześnie Salon Jubilerski Luksusowy.',
    badgeEmoji: '💎',
    badgeLabel: 'Król Diamentów',
    xpReward: 220,
    unlockTitle: 'title_diamond_king',
  },
  {
    id: 'ach_green_visionary',
    category: 'industry',
    name: 'Zielony Wizjoner',
    description: 'Wygeneruj co najmniej 120 MW z OZE lub fuzji przy zero działających elektrowni węglowych.',
    badgeEmoji: '🌿',
    badgeLabel: 'Zielony Wizjoner',
    xpReward: 250,
    unlockTitle: 'title_green_visionary',
    unlockCosmetic: { kind: 'hq', id: 'hq_eco_dome', label: 'HQ: Eko-Kopuła OZE' },
  },
  {
    id: 'ach_hightech_monopoly',
    category: 'industry',
    name: 'Monopolista High-Tech',
    description: 'Posiadaj jednocześnie Fabrykę Półprzewodników, Baterii oraz Centrum Danych.',
    badgeEmoji: '⚡',
    badgeLabel: 'Król High-Tech',
    xpReward: 280,
    unlockCosmetic: { kind: 'hq', id: 'hq_cyber_citadel', label: 'HQ: Cytadela Cybernetyczna' },
  },
  {
    id: 'ach_toll_master',
    category: 'industry',
    name: 'Mistrz Myta',
    description: 'Zarób ponad $200 000 wyłącznie z płatnych autostrad i stacji pasażerskich.',
    badgeEmoji: '🛣️',
    badgeLabel: 'Mistrz Myta',
    xpReward: 190,
    unlockTitle: 'title_toll_master',
  },
  {
    id: 'ach_synergy_master',
    category: 'industry',
    name: 'Architekt Dzielnic',
    description: 'Uzyskaj co najmniej +45% łącznej synergii na jednym obiekcie komercyjnym.',
    badgeEmoji: '🏙️',
    badgeLabel: 'Urbanista',
    xpReward: 210,
  },
  {
    id: 'ach_patent_lord',
    category: 'industry',
    name: 'Król Patentów',
    description: 'Zarejestruj jako pierwszy co najmniej 2 patenty technologiczne w jednym meczu.',
    badgeEmoji: '📜',
    badgeLabel: 'Wynalazca',
    xpReward: 200,
  },

  // 3. Polityka i Wojna (6)
  {
    id: 'ach_beloved_leader',
    category: 'politics',
    name: 'Ulubieniec Wyborców',
    description: 'Utrzymaj poparcie społeczne na poziomie co najmniej 90%.',
    badgeEmoji: '❤️',
    badgeLabel: 'Idol Wyborców',
    xpReward: 180,
  },
  {
    id: 'ach_pmc_commander',
    category: 'politics',
    name: 'Wódz Prywatnej Armii',
    description: 'Wybuduj Bazę Wojskową PMC i wystrzel rakietę taktyczną 3×3.',
    badgeEmoji: '🪖',
    badgeLabel: 'Kondotier',
    xpReward: 220,
  },
  {
    id: 'ach_atomic_deterrent',
    category: 'politics',
    name: 'Atomowy Odstraszacz',
    description: 'Ukończ tajny projekt jądrowy i zbuduj gotową głowicę.',
    badgeEmoji: '☢️',
    badgeLabel: 'Atom',
    xpReward: 300,
    unlockCosmetic: { kind: 'frame', id: 'frame_crimson', label: 'Ramka: Szkarłat Imperium' },
  },
  {
    id: 'ach_bailiff_hunter',
    category: 'politics',
    name: 'Bezlitosny Komornik',
    description: 'Doprowadź do licytacji majątku lub przejmij działkę rywala na aukcji/wykupie.',
    badgeEmoji: '🔨',
    badgeLabel: 'Komornik',
    xpReward: 230,
    unlockTitle: 'title_bailiff',
  },
  {
    id: 'ach_tender_ace',
    category: 'politics',
    name: 'Kontrahent Państwa',
    description: 'Wygraj lub ukończ w 100% rządowy przetarg strategiczny.',
    badgeEmoji: '🏛️',
    badgeLabel: 'Partner Rządu',
    xpReward: 160,
  },
  {
    id: 'ach_flagship_builder',
    category: 'politics',
    name: 'Projekt Flagowy',
    description: 'Ukończ finalne ulepszenie poziomu 4 w dowolnym kluczowym obiekcie.',
    badgeEmoji: '⭐',
    badgeLabel: 'Architekt Flagowy',
    xpReward: 240,
  },

  // 4. Multiplayer i Koalicje (5)
  {
    id: 'ach_coalition_architect',
    category: 'multiplayer',
    name: 'Architekt Koalicji',
    description: 'Załóż koalicję i wygraj partię lub zdobądź sojuszniczą dominację.',
    badgeEmoji: '🤝',
    badgeLabel: 'Architekt Koalicji',
    xpReward: 260,
    unlockTitle: 'title_coalition_architect',
    unlockCosmetic: { kind: 'frame', id: 'frame_emerald', label: 'Ramka: Szmaragdowa Sieć' },
  },
  {
    id: 'ach_b2b_trader',
    category: 'multiplayer',
    name: 'Baron Handlu B2B',
    description: 'Zrealizuj 3 kontrakty handlowe B2B (lub z innymi spółkami).',
    badgeEmoji: '🚛',
    badgeLabel: 'Eksporter B2B',
    xpReward: 170,
  },
  {
    id: 'ach_fog_scout',
    category: 'multiplayer',
    name: 'Mistrz Wywiadu',
    description: 'Zdemaskuj ukryte sektory wroga w trybie Mgły Wojny lub wykryj program atomowy.',
    badgeEmoji: '🕵️',
    badgeLabel: 'Szpieg',
    xpReward: 210,
  },
  {
    id: 'ach_diplomat_nap',
    category: 'multiplayer',
    name: 'Pakt Pokoju',
    description: 'Zawrzyj Pakt o Nieagresji (NAP) z inną korporacją.',
    badgeEmoji: '🕊️',
    badgeLabel: 'Dyplomata',
    xpReward: 140,
  },
  {
    id: 'ach_mp_victor',
    category: 'multiplayer',
    name: 'Mistrz Pokoju WebRTC',
    description: 'Wygraj rozgrywkę Multiplayer przeciwko żywym graczom lub pełnemu lobby.',
    badgeEmoji: '🌐',
    badgeLabel: 'Zwycięzca MP',
    xpReward: 320,
  },

  // 5. Ekstremalne (5 -> łącznie 28 osiągnięć!)
  {
    id: 'ach_hardcore_survivor',
    category: 'extreme',
    name: 'Żelazny Przetrwalnik',
    description: 'Osiągnij co najmniej $15M wyceny na poziomie trudności Przetrwanie (Hardkor).',
    badgeEmoji: '🔥',
    badgeLabel: 'Hardkorowiec',
    xpReward: 380,
    unlockCosmetic: { kind: 'frame', id: 'frame_crimson', label: 'Ramka: Szkarłat Imperium' },
  },
  {
    id: 'ach_no_loans_titan',
    category: 'extreme',
    name: 'Samofinansowanie',
    description: 'Wygraj partię z włączonym mutatorem „Bez Kredytów”.',
    badgeEmoji: '🧱',
    badgeLabel: 'Bez Kredytów',
    xpReward: 340,
  },
  {
    id: 'ach_secret_double',
    category: 'extreme',
    name: 'Podwójny Agent Sukcesu',
    description: 'Ukończ oba Tajne Cele Osobiste w jednej partii.',
    badgeEmoji: '🎯',
    badgeLabel: 'Mistrz Celów',
    xpReward: 260,
  },
  {
    id: 'ach_weekly_champion',
    category: 'extreme',
    name: 'Czempion Wyzwania Tygodnia',
    description: 'Ukończ oficjalne Wyzwanie Tygodnia przed upływem limitu lat.',
    badgeEmoji: '🏆',
    badgeLabel: 'Tygodniowy As',
    xpReward: 400,
    unlockTitle: 'title_weekly_champ',
  },
  {
    id: 'ach_land_baron',
    category: 'extreme',
    name: 'Baronet Kontynentu',
    description: 'Posiadaj jednocześnie co najmniej 25 działek na mapie.',
    badgeEmoji: '🗺️',
    badgeLabel: 'Władca Ziemi',
    xpReward: 220,
  },
];

export function getAchievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
