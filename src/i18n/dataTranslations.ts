import { BUILDING_DEFINITIONS } from '../data/buildings';
import type {
  ActiveBreakthroughState,
  ArchetypeId,
  BuildingCategory,
  CorporationLevel,
  DifficultyPreset,
  GameEvent,
  GlobalBreakthroughId,
  GovernmentKind,
  GovernmentTender,
  MapHeatmapMode,
  MarketCyclePhase,
  MarketCycleState,
  MarketSectorKey,
  NewsArticle,
  PatentRecord,
  PvPDivisionId,
  ResourceType,
  ScenarioId,
  SecretGoal,
  TerrainType,
  TollRate,
  UiThemeId,
} from '../engine/types';
import type { Language } from './index';
import { BUILDINGS_EN } from './buildingsEn';

// ─── 1. Zasoby / Surowce (23) ────────────────────────────────────────────────

export const RESOURCES_EN: Record<
  ResourceType,
  { name: string; unit: string; description: string }
> = {
  coal: {
    name: 'Coal',
    unit: 't',
    description: 'Essential thermal fuel and smelting reducer for steel and copper works.',
  },
  ironOre: {
    name: 'Iron Ore',
    unit: 't',
    description: 'Primary feedstock for blast-furnace steel mills and heavy industry.',
  },
  copper: {
    name: 'Copper',
    unit: 't',
    description: 'Vital for power grids, cables, electronics, and semiconductor manufacturing.',
  },
  gold: {
    name: 'Gold',
    unit: 'kg',
    description: 'Recession safe-haven store of value and input for luxury jewelry & electronics.',
  },
  oil: {
    name: 'Crude Oil',
    unit: 'bbl',
    description: 'Core feedstock driving refineries, transport fuel, and chemical plants.',
  },
  uranium: {
    name: 'Uranium',
    unit: 'kg',
    description: 'Strategic nuclear element fueling fission power plants.',
  },
  rareMetals: {
    name: 'Rare Earths',
    unit: 'kg',
    description: 'Essential for semiconductor lithography, luxury jewelry, electronics, and aerospace.',
  },
  gravel: {
    name: 'Gravel & Stone',
    unit: 't',
    description: 'Affordable construction aggregate for roads and concrete prefabs.',
  },
  water: {
    name: 'Industrial Water',
    unit: 'm³',
    description: 'Critical coolant for power stations, smelters, and chemical plants. Vulnerable to droughts.',
  },
  steel: {
    name: 'Steel',
    unit: 't',
    description: 'Industrial backbone needed for prefabs, heavy frames, and armaments.',
  },
  fuel: {
    name: 'Fuel',
    unit: 'kl',
    description: 'Refined fuel spikes immediately raise road, maritime, and air freight expenses!',
  },
  chemicals: {
    name: 'Chemicals',
    unit: 't',
    description: 'Industrial reagents powering chip fabs, electronics, and defense factories.',
  },
  prefabs: {
    name: 'Prefabs',
    unit: 't',
    description: 'Modular structural elements for developers, towers, and megaprojects.',
  },
  electronics: {
    name: 'Electronics',
    unit: 'pcs',
    description: 'High-margin digital hardware assembled from semiconductors, copper, and gold.',
  },
  semiconductors: {
    name: 'Semiconductors',
    unit: 'pcs',
    description: 'Advanced economy bottleneck powering electronics and defense systems.',
  },
  electricity: {
    name: 'Electricity',
    unit: 'MWh',
    description: 'Lifeblood of industry. Power monopolies command steep tariffs across the entire map.',
  },
  jewelry: {
    name: 'Luxury Jewelry',
    unit: 'pcs',
    description: 'High-margin artisanal goods crafted from gold, rare metals, and diamonds.',
  },
  weapons: {
    name: 'Armaments',
    unit: 'sets',
    description: 'Military hardware boosting PMC strength and government defense tenders.',
  },
  diamonds: {
    name: 'Diamonds',
    unit: 'ct',
    description: 'Ultra-rare crystals for luxury jewelry, lasers, and quantum optics. Highly cyclical!',
  },
  lithium: {
    name: 'Lithium',
    unit: 't',
    description: 'White gold of green energy — vital for EV battery gigafactories and fusion reactors.',
  },
  batteries: {
    name: 'EV Lithium Batteries',
    unit: 'kWh',
    description: 'High-margin grid storage and EV packs lifting corporate green approval.',
  },
  sewage: {
    name: 'Industrial Sewage',
    unit: 'm³',
    description: 'Municipal wastewater from mills, hotels, and hospitals. Untreated discharge triggers fines.',
  },
  waste: {
    name: 'Waste & Refuse',
    unit: 't',
    description: 'Industrial waste requiring Incinerators (cheap, smoky) or Recycling Plants (metal recovery).',
  },
};

export function localizeResourceUnit(unit: string, lang: Language): string {
  if (lang === 'pl') return unit;
  if (unit === 'szt.') return 'pcs';
  if (unit === 'kpl.') return 'sets';
  return unit;
}

export function localizeResourceName(
  type: ResourceType,
  fallbackName: string,
  lang: Language
): string {
  if (lang === 'pl') return fallbackName;
  return RESOURCES_EN[type]?.name ?? fallbackName;
}

export function localizeResourceDescription(
  type: ResourceType,
  fallbackDesc: string,
  lang: Language
): string {
  if (lang === 'pl') return fallbackDesc;
  return RESOURCES_EN[type]?.description ?? fallbackDesc;
}

// ─── 2. Globalne Drzewko Badań (28) ─────────────────────────────────────────

const GLOBAL_TECH_EN: Record<
  string,
  { name: string; description: string; effects: string[] }
> = {
  ind_geology: {
    name: 'Mineral Geophysics & Georadar',
    description: 'Unlocks 3x3 Area Geological Scan and boosts mine extraction.',
    effects: ['Unlocks 3x3 Area Survey (Georadar)', '+10% mine extraction', '-30% survey cost'],
  },
  ind_metallurgy: {
    name: 'Steel & Copper Metallurgy',
    description: 'Optimizes blast furnaces and copper refining for national power grids.',
    effects: ['+14% processing output', 'Stronger steel & cable plant margins'],
  },
  ind_gold_jewelry: {
    name: 'Gold Refining & Jewelry Craft',
    description: 'Unlocks Gold Mines and high-margin Luxury Jewelry Boutiques.',
    effects: ['Unlocks Gold Mine & Jewelry Salon', '+15% luxury retail margins'],
  },
  ind_automation: {
    name: 'Industrial Automation',
    description: 'Robotic assembly lines slash workforce payroll tax burdens.',
    effects: ['+18% factory output', '-15% employer payroll taxes'],
  },
  ind_clean_heavy: {
    name: 'Clean Industrial Tech',
    description: 'Advanced scrubbers cut environmental penalties and unlock Vertical Farms.',
    effects: ['-50% environmental fines', 'Less voter disapproval', 'Unlocks Vertical Farm'],
  },
  ind_mega_extraction: {
    name: 'Deep-Crust Extraction',
    description: 'Reaches deep uranium, gold, rare earth, diamond, and lithium deposits.',
    effects: [
      '+22% critical mineral mine output',
      'Unlocks Diamond Mine, Lithium Mine & Luxury Diamond House',
    ],
  },
  ind_recycling: {
    name: 'Advanced Industrial Recycling',
    description: 'Zero-smog hydrometallurgical recovery of steel, copper, rare earths, and lithium.',
    effects: [
      'Unlocks Advanced Recycling & Plasma Gasification Plant',
      'Clean metal recovery without voter backlash',
    ],
  },
  mod_grid: {
    name: 'Smart Power Grids',
    description: 'Cuts transmission losses and stabilizes plant power delivery.',
    effects: ['+12% power plant efficiency', '-15% electricity bills'],
  },
  mod_hydro_shield: {
    name: 'Retention & Closed Water Loops',
    description: 'Shields plants and reactors against drought shortages.',
    effects: ['60% drought protection · -20% water usage', 'Unlocks Closed-Loop Sewage Plant'],
  },
  mod_semiconductors: {
    name: 'Silicon Lithography',
    description: 'Unlocks precision semiconductor and high-tech electronics manufacturing.',
    effects: ['Unlocks Semiconductor Fab', '+15% high-tech margins'],
  },
  mod_nuclear: {
    name: 'Gen-III+ Nuclear Fission',
    description: 'Safe high-output nuclear energy capable of monopolizing grid supply.',
    effects: ['Unlocks Nuclear Power Plant', '+20% power output'],
  },
  mod_ai_erp: {
    name: 'Industrial Artificial Intelligence',
    description: 'Algorithmic B2B logistics, EV battery production, and cloud datacenters.',
    effects: [
      '+20% R&D speed',
      '+15% empire-wide output',
      'Unlocks EV Battery Factory & Data Center',
    ],
  },
  mod_enrichment: {
    name: 'Uranium Isotope Centrifuges',
    description: 'Precision uranium fuel enrichment for Gen-IV reactors and covert programs.',
    effects: ['Unlocks Uranium Enrichment Plant', '+18% nuclear power plant capacity'],
  },
  mod_aerospace: {
    name: 'Aerospace & Orbital Program',
    description: '21st-century engineering pinnacle — unlocks the Aerospace Launch Complex.',
    effects: ['Unlocks Space Center', 'Huge prestige and orbital cashflow'],
  },
  mod_fusion: {
    name: 'Thermonuclear Fusion',
    description: 'Final energy revolution: zero-emission fusion reactor of colossal output.',
    effects: ['Unlocks Fusion Reactor', '+25% power grid output'],
  },
  ind_logistics: {
    name: 'Intermodal Freight Hubs',
    description: 'Integrated transfer hubs cushion fuel price spikes and unlock Passenger Rail.',
    effects: ['-18% road transport costs', 'Faster truck dispatch fleet'],
  },
  log_maritime: {
    name: 'Maritime Cargo & Seaports',
    description: 'Unlocks Cargo Seaports and freighters bridging river-split territories.',
    effects: ['Unlocks Cargo Port & Composite Shipyard', 'Cheap maritime coal, ore, oil & steel shipping'],
  },
  log_copper_grid: {
    name: 'Heavy Power Trunks & Containers',
    description: 'Integrates copper transmission corridors and B2B container standards.',
    effects: ['+12% power grid output', '-15% logistics costs'],
  },
  log_air_cargo: {
    name: 'Cargo & VIP Aviation',
    description: 'Unlocks Cargo Airports & VIP Terminals bypassing rival roadblockades.',
    effects: ['Unlocks Cargo Airport & VIP Air Terminal', 'Blockade-proof aerial logistics'],
  },
  saf_fire_prevention: {
    name: 'Industrial Safety & Fire Codes',
    description: 'Modern suppression codes cut fire frequency and machine wear.',
    effects: ['-20% plant fire risk', 'Higher Fire Station readiness'],
  },
  saf_medicine: {
    name: 'Occupational Medicine & Clinics',
    description: 'Unlocks Corporate Hospitals & Biotech Labs cutting staff absenteeism.',
    effects: ['Unlocks Hospital & Biotech/Pharma Lab', 'Reduces absenteeism and mining injuries'],
  },
  saf_hazmat: {
    name: 'HAZMAT & Lab Containment',
    description: 'Unlocks dedicated HAZMAT Bases and Fire Dept chemical response upgrades.',
    effects: ['Unlocks HAZMAT Base & Fire HAZMAT units', 'Protects chem, chip & nuclear plants'],
  },
  saf_crisis_shield: {
    name: 'Integrated Crisis Shield',
    description: 'Full automated fire, medical, and radiological monitoring network.',
    effects: ['-28% environmental fine severity', 'Higher voter trust (+approval)'],
  },
  mil_compliance: {
    name: 'Corporate Counterintelligence',
    description: 'Protects treasury data, geology maps, and factories against rival spies.',
    effects: ['+22% defense against sabotage and espionage'],
  },
  mil_arms: {
    name: 'Armaments & PMC Doctrine',
    description: 'Authorizes weapons manufacturing and Private Military Bases (PMC).',
    effects: ['Unlocks Defense Works & PMC Military Base', '+25 military strength'],
  },
  mil_cyber: {
    name: 'Cyber-Intel & OSINT',
    description: 'Unlocks the Intelligence Center and covert information ops.',
    effects: ['Unlocks Intelligence Center', '+22% espionage & sabotage effectiveness'],
  },
  mil_boarding: {
    name: 'Corporate Boarding Doctrine',
    description: 'Tactical buyout units engineered to seize weakened rival assets.',
    effects: ['+28% Corporate Raid success odds', '+40 military strength'],
  },
  mil_coup: {
    name: 'Coup Protocol',
    description: 'Extreme military-corporate takeover restructuring state authority.',
    effects: ['Unlocks Coup d’État in Military Pillar', '+75 military power'],
  },
};

export function localizeTechNode<
  T extends { id: string; name: string; description: string; effects: string[] },
>(node: T, lang: Language): T {
  if (lang === 'pl') return node;
  const en = GLOBAL_TECH_EN[node.id];
  return en ? { ...node, ...en } : node;
}

// ─── 3. Drzewko Prezesa (40) ─────────────────────────────────────────────────

const ENTREPRENEUR_SKILLS_EN: Record<
  string,
  { name: string; description: string; effects: string[] }
> = {
  ent_fin_1: { name: 'Balance Sheet Analyst', description: 'Financial mastery elevates margins across every holding.', effects: ['+8% operating margin in all buildings'] },
  ent_fin_2: { name: 'CIT Tax Optimization', description: 'Legal tax shields and capex deductions shrink corporate income taxes.', effects: ['-18% corporate tax (CIT) paid'] },
  ent_fin_3: { name: 'Credit Shark', description: 'AAA institutional rating lowers interest rates on bank loans and bonds.', effects: ['-2.5 pp loan interest rate', '+8% operating margin'] },
  ent_fin_spec: { name: 'Commodity Speculator', description: 'Sharp market execution cushions swings and improves selling spreads.', effects: ['+8% commodity market sell prices', '-15% warehouse upkeep'] },
  ent_fin_4: { name: 'Dividend Emperor', description: 'Advanced capital allocation maximizing return on corporate equity.', effects: ['+14% operating margin', '-10% CIT tax'] },
  ent_fin_hedge: { name: 'Alpha Arbitrage Fund', description: 'Exploits informational edges during market bubbles and crashes.', effects: ['+10% market sell price', '-8% resource buy discount'] },
  ent_fin_holding: { name: 'Offshore Holding Structure', description: 'Cross-border treasury consolidation slashes debt & tax drag.', effects: ['-12% CIT tax', '-2 pp loan interest', '+12% margin'] },
  ent_fin_apex: { name: 'Monopoly Architect (Flagship Project)', description: 'Pinnacle financial authority commanding treasury liquidity and equity pricing.', effects: ['+22% empire margin', '+12% sale prices', '-10% CIT tax'] },

  ent_neg_1: { name: 'Hard Negotiator', description: 'Better B2B contract terms and cheaper raw input sourcing.', effects: ['+5% product sell price', '-5% input purchase cost'] },
  ent_neg_2: { name: 'Land & B2B Broker', description: 'Makes AI and rivals markedly more receptive to plot buyout offers.', effects: ['+15% plot offer acceptance', '+7% sell price'] },
  ent_neg_3: { name: 'Hostile Takeover Master', description: 'Slashes costs on Forced Buyout laws and corporate raids.', effects: ['-22% hostile asset buyout cost'] },
  ent_neg_sec: { name: 'Asset Security Doctrine', description: 'Private guards, fire suppression, and patrols protect critical plants.', effects: ['-20% safety/PPP upkeep', '+10 military strength'] },
  ent_neg_4: { name: 'Cartel Architect', description: 'Commanding leverage in international deals and territorial acquisitions.', effects: ['+10% sell price', '-10% input cost', '+15% plot negotiation'] },
  ent_neg_fortress: { name: 'Legal Fortress Shield', description: 'Makes rivals’ forced buyouts harder while reducing regulatory inspection exposure.', effects: ['-25% security/HAZMAT cost', '+15 defense strength', '-12% takeover cost'] },
  ent_neg_syndicate: { name: 'Continental Syndicate', description: 'Map-wide trade intelligence and rapid territorial expansion.', effects: ['+20% plot buyout odds', '+10% margin', '+25 military strength'] },
  ent_neg_apex: { name: 'King of Resources & Expansion (Flagship Project)', description: 'Undisputed B2B & real-estate hegemon enjoying unstoppable buyouts.', effects: ['+18% sell price', '-15% input buy discount', '-25% takeover costs'] },

  ent_log_1: { name: 'Fleet Operations Director', description: 'Route discipline shields freight from high fuel and highway tolls.', effects: ['-20% road, sea & air transport costs'] },
  ent_log_2: { name: 'Just-in-Time Inventory', description: 'Cheaper speculative warehousing and tighter industrial OHS costs.', effects: ['-25% warehouse cost', '-15% freight cost', '-15% safety/OHS cost'] },
  ent_log_3: { name: 'Multimodal Corridor', description: 'Seamless synergy between seaports, air hubs, and private highways.', effects: ['-22% freight costs', '-10% raw purchase prices'] },
  ent_log_heavy: { name: 'Mine-to-Mill Vertical Integration', description: 'Direct conveyor and industrial rail feeds boost smelter profitability.', effects: ['+10% operating margin', '-15% storage & logistics hub cost'] },
  ent_log_4: { name: 'Global Supply Chain Dominance', description: 'Near-zero shipping losses even under severe oil shocks.', effects: ['-20% transport cost', '+8% empire margin'] },
  ent_log_automation: { name: '24/7 Industrial Autopilot', description: 'Synchronized mining, recycling, and logistics run nonstop.', effects: ['+12% plant output', '-8% input procurement cost'] },
  ent_log_titan_net: { name: 'Continental Megahub Grid', description: 'Interconnected land, sea, and air hubs operating as one organism.', effects: ['-20% freight', '-25% warehousing', '+10% margin'] },
  ent_log_apex: { name: 'Titan of Industry & Logistics (Flagship Project)', description: 'Frictionless industrial logistics delivering supreme empire margins.', effects: ['+22% profit in all plants', '-25% transport', '-12% input costs'] },

  ent_tech_1: { name: 'Science Patron', description: 'Scholarships and technical sponsorship reduce R&D costs.', effects: ['-15% tech research costs', '+15% research speed'] },
  ent_tech_2: { name: 'Patent Incubator', description: 'Accelerates internal upgrade research inside every building.', effects: ['+22% R&D speed inside buildings and labs'] },
  ent_tech_3: { name: 'Industry 5.0 Visionary', description: 'Synergy between capital and science lifts advanced factories.', effects: ['-20% R&D cost', '+12% empire margin'] },
  ent_tech_eco: { name: 'Green Transition Pioneer', description: 'Supports recycling and renewables while cutting eco & safety drag.', effects: ['-20% safety & eco compliance', '-8% green tax burden'] },
  ent_tech_4: { name: 'Conglomerate Chancellor', description: 'Unmatched global R&D speed paired with tighter hazard prevention.', effects: ['+25% research speed', '-25% safety services cost'] },
  ent_tech_quantum: { name: 'Academy of Fusion & Quantum Optics', description: 'Trains elite scientists for fusion reactors and quantum networks.', effects: ['+14% high-tech margin', '-15% R&D cost'] },
  ent_tech_singularity: { name: 'R&D Breakthrough Center', description: 'Proprietary institutes keep your patents a decade ahead of rivals.', effects: ['+28% R&D speed', '-25% rollout costs', '+10% sale prices'] },
  ent_tech_apex: { name: 'Technology Visionary (Flagship Project)', description: 'Highest scientific authority delivering extraordinary R&D velocity.', effects: ['+35% global & Flagship R&D speed', '+20% profit', '-10% CIT'] },

  ent_inf_1: { name: 'Elite & Civic Goodwill', description: 'Builds immediate political credibility among opinion leaders.', effects: ['+15 social/church influence', '+20% influence action potency'] },
  ent_inf_2: { name: 'Backroom Strategist', description: 'Deep ties across media, councils, and parliament sustain leverage.', effects: ['+30% potency across all 3 Influence Pillars'] },
  ent_inf_3: { name: 'Master of Public Narrative', description: 'Lobbying, PR stunts, and media blitzes land with sharp precision.', effects: ['+30% strength across all Pillars', '+15 social influence'] },
  ent_inf_pmc: { name: 'Defense Licenses & Counterintel', description: 'Lays the institutional foundation for private tactical units.', effects: ['+25 military strength', '-15% raid & takeover costs'] },
  ent_inf_4: { name: 'Market Sovereign', description: 'Commands peak parliamentary, tariff, and buyout authority.', effects: ['+30% strength across all Pillars', '-15% plot buyout cost'] },
  ent_inf_deterrence: { name: 'Deterrence Doctrine', description: 'Fortifies PMC bases, anti-sabotage defenses, and strategic strike power.', effects: ['+40 military strength', '-20% safety service costs'] },
  ent_inf_kingmaker: { name: 'Parliament Kingmaker', description: 'Cabinet policy aligns with your boardroom priorities.', effects: ['+32% Pillar strength', '-10% CIT', '+30 military power'] },
  ent_inf_apex: { name: 'Gray Eminence of Empire (Flagship Project)', description: 'Supreme backroom power over media, parliament, and security forces.', effects: ['+40% Pillar strength', '+60 military pts', '+18% political profit'] },
};

export function localizeSkillNode<
  T extends { id: string; name: string; description: string; effects: string[] },
>(node: T, lang: Language): T {
  if (lang === 'pl') return node;
  const en = ENTREPRENEUR_SKILLS_EN[node.id];
  return en ? { ...node, ...en } : node;
}

// ─── 4. Akcje Wpływów (12) ──────────────────────────────────────────────────

const INFLUENCE_ACTIONS_EN: Record<
  string,
  { name: string; description: string; estimatedEffect: string }
> = {
  bribery: {
    name: 'Official Bribe',
    description:
      'Discreet payment to tax and building inspectors. Builds financial leverage and shields against environmental fines briefly.',
    estimatedEffect: '+12 fin. influence, 10 ticks protection from fines & inspections',
  },
  lobbying: {
    name: 'Tax & Payroll Lobbying',
    description: 'Funds think-tanks and lobbyists to secure major CIT deductions for your group.',
    estimatedEffect: '-40% corporate CIT tax for 20 ticks, +15 financial influence',
  },
  buy_law: {
    name: 'Pass Deregulation Act',
    description:
      'Enacts national deregulation cutting corporate CIT rates nationwide while boosting your market standing.',
    estimatedEffect: 'Lowers national CIT by 2 pp, +25 fin. influence, boosts market share',
  },
  forced_buyout: {
    name: 'Forced Buyout Decree',
    description:
      'At overwhelming scale (Tier 4+), forces a rival to sell a strategic plot. Can be blocked by Counterintel / Lobby Law Firms!',
    estimatedEffect: 'Seizes target rival plot & facility (Counterintel/Lobby Firm can block)',
  },
  espionage: {
    name: 'Industrial Espionage',
    description:
      'Steals rival ledgers, cash reserves, investment blueprints, and covert nuclear telemetry.',
    estimatedEffect: 'Reveals full rival finances & covert projects for 20 ticks + 15 R&D pts',
  },
  sabotage: {
    name: 'Infrastructure Sabotage',
    description: 'Strikes a key rival facility (power plant or mill), damaging gear and halting runs.',
    estimatedEffect: 'Damages target facility (-45% condition) and halts production for 8 ticks',
  },
  corporate_raid: {
    name: 'Corporate Raid',
    description: 'Forcible seizure of a rival facility using private tactical teams and legal writs.',
    estimatedEffect: 'Transfers targeted rival building and plot straight to your ownership!',
  },
  coup_attempt: {
    name: 'Corporate Coup d’État',
    description: 'Extreme corporate-military operation overthrowing the cabinet in your favor.',
    estimatedEffect: 'Immediate seizure of state control (or huge dominance surge)',
  },
  church_donation: {
    name: 'Clergy Alliance & Endowment',
    description:
      'Generous grants to clergy and civic foundations cultivate conservative voter trust and ward off boycotts.',
    estimatedEffect: '+20 Church approval, +15 social influence, +8 voter mood',
  },
  media_campaign: {
    name: 'Media & PR Blitz',
    description:
      'Shapes press and broadcast coverage to champion your brand and restore corporate reputation.',
    estimatedEffect: '+20 Media control, +18 social influence, +10 reputation, +8 voter mood',
  },
  voter_mobilization: {
    name: 'Grassroots Voter Mobilization',
    description: 'Rallies civic groups and unions to secure lower payroll overhead and pro-business rules.',
    estimatedEffect: 'Softens government stance (-10% payroll ZUS) and +25 social influence',
  },
  organize_boycott: {
    name: 'Rival Consumer Boycott',
    description: 'Covert media agitation ignites public boycotts across a target rival’s retail assets.',
    estimatedEffect: 'Slashes revenue of all rival assets by 35% for 12 ticks!',
  },
};

export function localizeInfluenceAction<
  T extends { id: string; name: string; description: string; estimatedEffect: string },
>(action: T, lang: Language): T {
  if (lang === 'pl') return action;
  const en = INFLUENCE_ACTIONS_EN[action.id];
  return en ? { ...action, ...en } : action;
}

// ─── 5. Archetypy, Scenariusze, Poziomy Trudności, Rządy, Teren, Kategorie ────

const ARCHETYPES_EN: Record<
  ArchetypeId,
  { name: string; shortName: string; tagline: string; pros: string[]; cons: string[] }
> = {
  standard: {
    name: 'Standard Conglomerate',
    shortName: 'Standard',
    tagline: 'Balanced start with zero modifiers or hidden penalties.',
    pros: ['Zero hidden handicaps — ideal benchmark for learning & PvP'],
    cons: ['No specialized economic discount or sector bonus'],
  },
  investment_fund: {
    name: 'Investment Fund',
    shortName: 'Invest Fund',
    tagline: 'Cheap capital and stock exchange edge at the cost of heavy industry.',
    pros: [
      '+15% starting cash for aggressive buyouts & stock trading',
      '-20% loan interest and immediate equity advantage',
    ],
    cons: [
      '+15% industrial plant maintenance overhead',
      '-10% raw mineral extraction yield',
    ],
  },
  industrial_giant: {
    name: 'Industrial Giant',
    shortName: 'Industrial',
    tagline: 'Raw-material & factory powerhouse trading off civic image and green fines.',
    pros: [
      '-15% construction cost for mines, smelters, factories & roads',
      '+10% raw extraction & factory processing volume',
    ],
    cons: [
      '-15% base public voter approval from Day 1',
      '+20% environmental & incinerator compliance fines',
    ],
  },
  tech_incubator: {
    name: 'Tech Incubator',
    shortName: 'Tech Lab',
    tagline: 'Rapid patents and R&D speed at the cost of leaner starting cash and higher MW draw.',
    pros: [
      '+20% R&D speed and research generation',
      '-15% technology, lab, and patent deployment costs',
    ],
    cons: [
      '-10% starting cash reserve',
      '+12% electricity (MW) draw in high-tech & industrial plants',
    ],
  },
  logistics_cartel: {
    name: 'Logistics Cartel',
    shortName: 'Logistics',
    tagline: 'Highway tolls and passenger transit titan with pricier geology surveys.',
    pros: [
      '+45% toll revenue collected on private highways',
      '-20% passenger fleet & station upkeep and -15% road costs',
    ],
    cons: [
      '+25% geological survey & drilling cost',
      '-5% profit margin in retail & entertainment venues',
    ],
  },
  eco_innovator: {
    name: 'Eco-Innovator',
    shortName: 'Eco-Leader',
    tagline: 'Renewables, recycling, and voter champion facing steep coal & heavy barriers.',
    pros: [
      '+15% efficiency on renewables (wind, solar, geo, fusion) & recycling',
      '+12% base public voter approval',
    ],
    cons: [
      '+30% construction cost for coal & heavy industry plants',
      'Waste incinerators trigger harsh approval penalties (-4 pts/tick)',
    ],
  },
};

export function localizeArchetype<
  T extends {
    id: ArchetypeId;
    name: string;
    shortName: string;
    tagline: string;
    pros: string[];
    cons: string[];
  },
>(arch: T, lang: Language): T {
  if (lang === 'pl') return arch;
  const en = ARCHETYPES_EN[arch.id];
  return en ? { ...arch, ...en } : arch;
}

const SCENARIOS_EN: Record<
  ScenarioId,
  { name: string; tagline: string; description: string; recommendedPlayers: string }
> = {
  sandbox: {
    name: 'Classic Sandbox',
    tagline: 'Pure open competition on equal rules',
    description:
      'Standard balanced start with zero forced constraints — open economics, diplomacy, and empire-building.',
    recommendedPlayers: '1–8 players',
  },
  fallen_giant: {
    name: 'Fall of a Giant',
    tagline: 'Bankrupting conglomerate in the center of the map',
    description:
      'An aging central conglomerate collapses with ready-made factories, power stations, and highways auctioned by the bailiff every few months.',
    recommendedPlayers: '2–8 players',
  },
  green_transition: {
    name: 'Green Transition',
    tagline: 'Steep CO₂ tax & incinerator ban mid-game',
    description:
      'Around Year 2, harsh carbon taxes and an incinerator ban take effect. Renewables, recycling, lithium, batteries & fusion win.',
    recommendedPlayers: '1–8 players',
  },
  cold_war: {
    name: 'Corporate Cold War',
    tagline: '2 rival blocs from Minute 1 with active embargoes',
    description:
      'Corporations start divided into two opposing alliances locked in trade embargoes and an intense tech & arms race.',
    recommendedPlayers: '4–8 players',
  },
  gold_rush: {
    name: 'Gold & Diamond Rush',
    tagline: 'Rich hidden seams & volatile boom-bust markets',
    description:
      'Far richer underground deposits of gold, diamonds, and lithium paired with turbocharged market swings.',
    recommendedPlayers: '1–8 players',
  },
};

export function localizeScenario<
  T extends {
    id: ScenarioId;
    name: string;
    tagline: string;
    description: string;
    recommendedPlayers: string;
  },
>(s: T, lang: Language): T {
  if (lang === 'pl') return s;
  const en = SCENARIOS_EN[s.id];
  return en ? { ...s, ...en } : s;
}

const DIFFICULTY_PRESETS_EN: Record<DifficultyPreset, { label: string; description: string }> = {
  rozruch: {
    label: 'Starter (Easy)',
    description: '+30% starting cash, lower taxes & interest, gentler utility deficits, fewer crashes.',
  },
  standard: {
    label: 'Standard (Balanced)',
    description: 'Default balanced economy, stock market volatility, and emergency response rules.',
  },
  kryzysowy: {
    label: 'Crisis (Hard)',
    description: '-15% starting cash, higher taxes & maintenance, harsher utility penalties, faster bailiff.',
  },
  przetrwanie: {
    label: 'Survival (Hardcore)',
    description: '-22% starting cash, costly debt, fierce stock swings & strict safety/utility fines.',
  },
};

export function localizeDifficultyPreset<
  T extends { id: DifficultyPreset; label: string; description: string },
>(d: T, lang: Language): T {
  if (lang === 'pl') return d;
  const en = DIFFICULTY_PRESETS_EN[d.id];
  return en ? { ...d, ...en } : d;
}

const GOVERNMENTS_EN: Record<GovernmentKind, { name: string; summary: string }> = {
  free_market: {
    name: 'Free-Market Cabinet',
    summary: '-3% CIT, -20% road & capex costs, but +45% strike risk under low wages.',
  },
  ecological: {
    name: 'Green Coalition Cabinet',
    summary: '+25% subsidies for renewables, recycling & parks, but +55% emissions/coal penalties.',
  },
  interventionist: {
    name: 'Interventionist Cabinet',
    summary: '-1.5 pp loan interest and +35% government tender rewards, but +12% payroll taxes.',
  },
};

export function localizeGovernment<T extends { id: GovernmentKind; name: string; summary: string }>(
  g: T,
  lang: Language
): T {
  if (lang === 'pl') return g;
  const en = GOVERNMENTS_EN[g.id];
  return en ? { ...g, ...en } : g;
}

const CORP_LEVELS_EN: Record<
  CorporationLevel,
  { name: string; requiresTechOrEdu: string; description: string }
> = {
  1: {
    name: 'Start-up',
    requiresTechOrEdu: 'No prerequisites',
    description: 'Starter plots, private roads, coal, iron, steel, water, and basic utilities.',
  },
  2: {
    name: 'Enterprise',
    requiresTechOrEdu: 'Min. 2 facilities & $5.4M net worth',
    description: 'Unlocks Copper, Crude Oil, Chemicals, Hospitals, Cargo Ports & Theme Parks.',
  },
  3: {
    name: 'Capital Group',
    requiresTechOrEdu: 'Min. 4 facilities, High School & $7.8M net worth',
    description: 'Unlocks Gold, Jewelry, Rare Metals, Electronics, Invest Banks & Foundations.',
  },
  4: {
    name: 'Conglomerate',
    requiresTechOrEdu: 'Min. 6 facilities, University & $11.5M net worth',
    description: 'Unlocks HAZMAT Bases, Cargo Airports, Semiconductors, Uranium & Defense Works.',
  },
  5: {
    name: 'Megacorporation',
    requiresTechOrEdu: 'Min. 8 facilities, R&D Lab & $17M net worth',
    description: 'Unlocks Nuclear Power Plants and the Aerospace Launch Complex.',
  },
};

export function localizeCorpLevel<
  T extends { level: CorporationLevel; name: string; requiresTechOrEdu: string; description: string },
>(c: T, lang: Language): T {
  if (lang === 'pl') return c;
  const en = CORP_LEVELS_EN[c.level];
  return en ? { ...c, ...en } : c;
}

const TERRAINS_EN: Record<TerrainType, string> = {
  grass: 'Plains',
  forest: 'Forest',
  water: 'Water / River',
  mountain: 'Mountains',
  desert: 'Desert',
  coastal: 'Coastline',
  urban: 'Urban Core',
};

export function localizeTerrain(t: TerrainType, fallback: string, lang: Language): string {
  return lang === 'pl' ? fallback : TERRAINS_EN[t] ?? fallback;
}

const BUILDING_CATEGORIES_EN: Record<BuildingCategory, string> = {
  mining: 'Extraction',
  processing: 'Processing',
  energy: 'Energy',
  waste: 'Sewage & Waste',
  logistics: 'Logistics',
  real_estate: 'Real Estate',
  attractions: 'Luxury & Leisure',
  finance: 'Finance',
  education: 'Education & R&D',
  safety: 'Health & Safety',
  influence: 'Influence',
  military: 'Security',
};

export function localizeBuildingCategory(
  cat: BuildingCategory,
  fallback: string,
  lang: Language
): string {
  return lang === 'pl' ? fallback : BUILDING_CATEGORIES_EN[cat] ?? fallback;
}

const AI_STRATEGY_EN: Record<string, string> = {
  industrialist: 'Industrial & Commodity Baron',
  energyMagnate: 'Energy & Tech Monopolist',
  realEstate: 'Real-Estate Tycoon',
  shadowBroker: 'Gray Eminence',
  military: 'Corporate Mercenary',
  supplyChain: 'B2B Supply-Chain Architect',
  'Baron Surowcowo-Przemysłowy': 'Industrial & Commodity Baron',
  'Monopolista Energetyczno-Tech': 'Energy & Tech Monopolist',
  'Magnat Nieruchomości': 'Real-Estate Tycoon',
  'Magnat Nieruchomości i Luksusu': 'Real-Estate & Luxury Tycoon',
  'Szara Eminencja': 'Gray Eminence',
  'Najemnik Korporacyjny': 'Corporate Mercenary',
  'Korporacyjny Kondotier': 'Corporate Condottiere',
  'Architekt Łańcuchów B2B': 'B2B Supply-Chain Architect',
  'Strategia Zrównoważona': 'Balanced Strategy',
  'Konglomerat Dywersyfikowany': 'Diversified Conglomerate',
};

export function localizeAiStrategy(key: string | undefined, fallback: string, lang: Language): string {
  if (!key || lang === 'pl') return fallback;
  return AI_STRATEGY_EN[key] ?? fallback;
}

const TOLL_RATE_EN: Record<TollRate, string> = {
  free: 'Free ($0)',
  low: 'Low ($750)',
  standard: 'Standard ($1,800)',
  high: 'High ($3,800)',
  prohibitive: 'Prohibitive ($7,500)',
};

export function localizeTollRate(rate: TollRate, fallback: string, lang: Language): string {
  return lang === 'pl' ? fallback : TOLL_RATE_EN[rate] ?? fallback;
}

const HEATMAP_EN: Record<MapHeatmapMode, string> = {
  standard: 'Standard',
  response_time: 'Emergency Speed',
  security: 'Security',
  environment: 'Appeal',
  logistics: 'Roads & Tolls',
};

export function localizeHeatmapMode(mode: MapHeatmapMode, fallback: string, lang: Language): string {
  return lang === 'pl' ? fallback : HEATMAP_EN[mode] ?? fallback;
}

export function localizeDifficultyLabel(idx: number, fallback: string, lang: Language): string {
  if (lang === 'pl') return fallback;
  return ['Easy', 'Normal', 'Ambitious', 'Expert', 'Market Shark'][idx] ?? fallback;
}

// ─── 6. Tajne Cele, Osiągnięcia, Kosmetyki, Sklep, Karnet ────────────────────

const SECRET_GOALS_EN: Record<
  string,
  { title: string; description: string; unitLabel: string }
> = {
  goal_copper_iron_monopoly: {
    title: 'King of Steel & Copper',
    description: 'Capture at least 60% of map-wide Copper or Iron Ore extraction.',
    unitLabel: '% share',
  },
  goal_gold_diamonds_share: {
    title: 'Bullion & Diamond Magnate',
    description: 'Control at least 55% of total Gold, Diamond, or Jewelry output on the map.',
    unitLabel: '% share',
  },
  goal_high_approval_2y: {
    title: 'Civic Public Trust',
    description: 'Maintain 85%+ voter approval continuously for 60 cycles (~2 game years).',
    unitLabel: 'ticks >=85%',
  },
  goal_patents_2: {
    title: 'Patent Pioneer',
    description: 'Secure at least 2 exclusive technological patents before rivals.',
    unitLabel: 'patents',
  },
  goal_toll_transport_500k: {
    title: 'King of Arteries & Tolls',
    description: 'Earn $140,000 combined revenue from highway tolls and passenger transit.',
    unitLabel: '$ tolls',
  },
  goal_rival_bailiff: {
    title: 'Relentless Market Pressure',
    description: 'Force a rival into bailiff auction or seize a rival asset at bankruptcy auction.',
    unitLabel: 'seizures',
  },
  goal_green_power_80mw: {
    title: 'Green Grid Architect',
    description: 'Operate at least 80 MW of clean capacity (wind, solar, hydro, geo, fusion).',
    unitLabel: 'MW clean',
  },
  goal_urban_synergy: {
    title: 'Dream District Developer',
    description: 'Run 4 commercial/service assets simultaneously with min. +25% district synergy.',
    unitLabel: 'assets',
  },
};

export function localizeSecretGoal<
  T extends Pick<SecretGoal, 'templateId' | 'title' | 'description' | 'unitLabel'>,
>(g: T, lang: Language): T {
  if (lang === 'pl') return g;
  const en = SECRET_GOALS_EN[g.templateId];
  return en ? { ...g, ...en } : g;
}

const ACH_CATEGORIES_EN: Record<string, string> = {
  economy: 'Economy & Exchange',
  industry: 'Industry & Commodities',
  politics: 'Politics & Warfare',
  multiplayer: 'Multiplayer & Alliances',
  extreme: 'Extreme Challenges',
};

export function localizeAchievementCategory(cat: string, fallback: string, lang: Language): string {
  return lang === 'pl' ? fallback : ACH_CATEGORIES_EN[cat] ?? fallback;
}

const ACHIEVEMENTS_EN: Record<
  string,
  { name: string; description: string; badgeLabel: string; cosmeticLabel?: string }
> = {
  ach_first_million: { name: 'Vault Millionaire', description: 'Reach over $10,000,000 net worth during one session.', badgeLabel: 'Capitalist' },
  ach_tycoon_25m: { name: 'Quarter-Billion Giant', description: 'Surpass $25,000,000 net worth in a match.', badgeLabel: '$25M Tycoon', cosmeticLabel: 'HQ: Golden Fortune Tower' },
  ach_tycoon_50m: { name: 'Market Billionaire', description: 'Surpass $50,000,000 net worth in a single match.', badgeLabel: '$50M Emperor', cosmeticLabel: 'Frame: Golden Exchange Crown' },
  ach_debt_free_winner: { name: 'Clean Balance Sheet', description: 'Reach Corp Level 4+ with zero active bank loans.', badgeLabel: 'Debt-Free' },
  ach_crash_survivor: { name: 'Crash Survivor', description: 'Weather a stock crash with positive cashflow and climb above $12M.', badgeLabel: 'Crash Survivor' },
  ach_stock_shark: { name: 'Trading Floor Shark', description: 'Acquire over 25% of shares in a rival corporation.', badgeLabel: 'Stock Shark' },
  ach_diamond_king: { name: 'Diamond King', description: 'Extract diamonds while operating a Luxury Diamond Jewelry House.', badgeLabel: 'Diamond King' },
  ach_green_visionary: { name: 'Green Visionary', description: 'Generate at least 120 MW from renewables/fusion with zero active coal plants.', badgeLabel: 'Green Visionary', cosmeticLabel: 'HQ: Eco-Dome Renewables' },
  ach_hightech_monopoly: { name: 'High-Tech Monopolist', description: 'Operate a Semiconductor Fab, Battery Factory, and Data Center simultaneously.', badgeLabel: 'High-Tech King', cosmeticLabel: 'HQ: Cyber Citadel' },
  ach_toll_master: { name: 'Master of Tolls', description: 'Earn over $200,000 purely from highway tolls and passenger hubs.', badgeLabel: 'Toll Master' },
  ach_synergy_master: { name: 'District Architect', description: 'Achieve at least +45% combined synergy on a single commercial site.', badgeLabel: 'Urbanist' },
  ach_patent_lord: { name: 'Patent Lord', description: 'Claim at least 2 exclusive tech patents first in one session.', badgeLabel: 'Inventor' },
  ach_beloved_leader: { name: 'Voter Favorite', description: 'Maintain public voter approval at or above 90%.', badgeLabel: 'Public Idol' },
  ach_pmc_commander: { name: 'PMC Warlord', description: 'Build a PMC Military Base and launch a 3x3 Tactical Missile.', badgeLabel: 'Commander' },
  ach_atomic_deterrent: { name: 'Nuclear Deterrent', description: 'Complete the covert nuclear project and assemble a ready warhead.', badgeLabel: 'Atomic', cosmeticLabel: 'Frame: Crimson Imperium' },
  ach_bailiff_hunter: { name: 'Relentless Bailiff', description: 'Force a bankruptcy liquidation or win a rival plot at bailiff auction.', badgeLabel: 'Bailiff' },
  ach_tender_ace: { name: 'State Contractor', description: 'Win or fulfill 100% of a strategic government tender.', badgeLabel: 'Gov Partner' },
  ach_flagship_builder: { name: 'Flagship Architect', description: 'Complete a Tier 4 Flagship upgrade on any major asset.', badgeLabel: 'Flagship Pro' },
  ach_coalition_architect: { name: 'Coalition Architect', description: 'Found an alliance and secure an allied victory.', badgeLabel: 'Alliance Lead', cosmeticLabel: 'Frame: Emerald Network' },
  ach_b2b_trader: { name: 'B2B Trade Baron', description: 'Complete 3 B2B trade contracts.', badgeLabel: 'B2B Exporter' },
  ach_fog_scout: { name: 'Master of Intel', description: 'Uncover hidden fog-of-war enemy sectors or detect a covert nuke program.', badgeLabel: 'Spymaster' },
  ach_diplomat_nap: { name: 'Peace Pact', description: 'Sign a Non-Aggression Pact (NAP) with another corporation.', badgeLabel: 'Diplomat' },
  ach_mp_victor: { name: 'WebRTC Arena Champion', description: 'Win a live Multiplayer match against human opponents.', badgeLabel: 'MP Winner' },
  ach_hardcore_survivor: { name: 'Iron Survivor', description: 'Reach at least $15M net worth on Survival (Hardcore) difficulty.', badgeLabel: 'Hardcore', cosmeticLabel: 'Frame: Crimson Imperium' },
  ach_no_loans_titan: { name: 'Self-Financed Titan', description: 'Win a match with the "No Bank Loans" mutator active.', badgeLabel: 'No Loans' },
  ach_secret_double: { name: 'Double Mission Ace', description: 'Complete both Secret Personal Goals in a single match.', badgeLabel: 'Goal Master' },
  ach_weekly_champion: { name: 'Weekly Challenge Champion', description: 'Complete an official Weekly Challenge before the year limit.', badgeLabel: 'Weekly Ace' },
  ach_land_baron: { name: 'Continental Land Baron', description: 'Own at least 25 land plots simultaneously on the map.', badgeLabel: 'Landlord' },
};

export function localizeAchievement<
  T extends {
    id: string;
    name: string;
    description: string;
    badgeLabel: string;
    unlockCosmetic?: { kind: 'hq' | 'frame' | 'emblem'; id: string; label: string };
  },
>(ach: T, lang: Language): T {
  if (lang === 'pl') return ach;
  const en = ACHIEVEMENTS_EN[ach.id];
  if (!en) return ach;
  return {
    ...ach,
    name: en.name,
    description: en.description,
    badgeLabel: en.badgeLabel,
    unlockCosmetic:
      ach.unlockCosmetic && en.cosmeticLabel
        ? { ...ach.unlockCosmetic, label: en.cosmeticLabel }
        : ach.unlockCosmetic,
  };
}

const TITLES_EN: Record<string, { label: string; unlockHint: string }> = {
  title_startup: { label: 'Market Pioneer', unlockHint: 'Starter title on every account' },
  title_diamond_king: { label: 'Diamond King', unlockHint: 'Achievement: Diamond King' },
  title_bailiff: { label: 'Relentless Bailiff', unlockHint: 'Achievement: Relentless Bailiff' },
  title_green_visionary: { label: 'Green Visionary', unlockHint: 'Achievement: Green Visionary' },
  title_crash_survivor: { label: 'Crash Survivor', unlockHint: 'Achievement: Crash Survivor' },
  title_coalition_architect: { label: 'Coalition Architect', unlockHint: 'Achievement: Coalition Architect' },
  title_toll_master: { label: 'Highway Sovereign', unlockHint: 'Achievement: Master of Tolls' },
  title_weekly_champ: { label: 'Weekly Champion', unlockHint: 'Complete any Weekly Challenge' },
  title_high_stakes: { label: 'High-Stakes Leader', unlockHint: 'Battle Pass Season 1 (Tier 8)' },
  title_bp_tycoon: { label: 'Wall Street Baron', unlockHint: 'Battle Pass Season 1 (Tier 18)' },
  title_season_one: { label: 'Season 1 Architect', unlockHint: 'Complete Tier 30 Battle Pass S1' },
  title_prestige_star: { label: 'Prestige Veteran ★', unlockHint: 'Activate Prestige at Level 100' },
};

export function localizeTitle<
  T extends { id: string; label: string; unlockHint?: string },
>(t: T, lang: Language): T {
  if (lang === 'pl') return t;
  const en = TITLES_EN[t.id];
  return en ? { ...t, ...en } : t;
}

const COSMETICS_EN: Record<string, { name: string; description: string; unlockHint: string }> = {
  hq_classic: { name: 'Classic Glass Skyscraper', description: 'Standard corporate headquarters tower.', unlockHint: 'Unlocked by default' },
  hq_golden: { name: 'Golden Fortune Tower', description: 'Gilded facade with crown spire and VIP illumination.', unlockHint: 'Reach $25M net worth or unlock 6 achievements' },
  hq_eco_dome: { name: 'Eco-Dome Renewables', description: 'Futuristic biosphere with lush terraces and rooftop solar.', unlockHint: 'Achievement "Green Visionary" or Account Lv 10' },
  hq_cyber_citadel: { name: 'Cyber Citadel', description: 'Obsidian-neon high-tech core topped by a quantum spire.', unlockHint: 'Achievement "High-Tech Monopolist" or CEO Shop' },
  hq_monolith: { name: 'Obsidian Monolith', description: 'Minimalist fortress clad in volcanic glass and LED bands.', unlockHint: 'CEO Shop or Battle Pass Tier 14' },
  hq_platinum: { name: 'Platinum Prestige Spire', description: 'Season 1 pinnacle HQ silhouette with platinum crown lighting.', unlockHint: 'Battle Pass Season 1 (Tier 28)' },
  frame_slate: { name: 'Steel Terminal', description: 'Classic executive profile border.', unlockHint: 'Unlocked by default' },
  frame_gold: { name: 'Golden Exchange Crown', description: 'Gleaming gold trim of elite institutional funds.', unlockHint: 'Account Lv 4+ or $50M Tycoon achievement' },
  frame_emerald: { name: 'Emerald Network', description: 'Neon emerald border for clean-grid pioneers.', unlockHint: 'Battle Pass Tier 4 or Coalition achievement' },
  frame_crimson: { name: 'Crimson Imperium', description: 'Elite finish forged for corporate raids & Hardcore runs.', unlockHint: 'Unlock "Iron Survivor" or "Nuclear Deterrent"' },
  frame_neon_pulse: { name: 'Neon Pulse (Anim.)', description: 'Animated terminal cyan pulse along participant cards.', unlockHint: 'CEO Shop or Battle Pass Tier 17' },
  frame_golden_aura: { name: 'Golden Exchange Aura (Anim.)', description: 'Animated golden aura shining across Multiplayer lobby cards.', unlockHint: 'CEO Shop or Battle Pass Tier 26' },
  frame_crimson_matrix: { name: 'Crimson Matrix (Anim.)', description: 'Animated war-room frame reserved for market sharks.', unlockHint: 'CEO Shop' },
};

export function localizeCosmetic<
  T extends { id: string; name: string; description: string; unlockHint: string },
>(c: T, lang: Language): T {
  if (lang === 'pl') return c;
  const en = COSMETICS_EN[c.id];
  return en ? { ...c, ...en } : c;
}

const UI_THEMES_EN: Record<UiThemeId, { label: string; description: string }> = {
  theme_fintech: { label: 'Dark Fintech Terminal', description: 'Default high-contrast cyan & amber analytics suite.' },
  theme_gold: { label: 'Wall Street Gold', description: 'Obsidian terminal accented with warm executive gold.' },
  theme_emerald: { label: 'Emerald Terminal', description: 'Bull-market emerald desk for growth and clean capital.' },
  theme_crimson: { label: 'Crimson War Room', description: 'High-stakes crimson suite for M&A and aggressive play.' },
};

export function localizeUiTheme<T extends { id: UiThemeId; label: string; description: string }>(
  t: T,
  lang: Language
): T {
  if (lang === 'pl') return t;
  const en = UI_THEMES_EN[t.id];
  return en ? { ...t, ...en } : t;
}

const SHOP_ITEMS_EN: Record<
  string,
  { name: string; description: string; zeroP2WNote: string }
> = {
  shop_scen_fallen_giant: {
    name: 'Scenario: Fall of a Giant',
    description: 'Unlocks fierce auctions over a collapsing central conglomerate’s ready assets.',
    zeroP2WNote: 'Fresh ruleset shared free with all guests inside your hosted lobby.',
  },
  shop_scen_green_transition: {
    name: 'Scenario: Green Transition',
    description: 'Mid-game carbon taxes & incinerator ban favor renewables, fusion & clean tech.',
    zeroP2WNote: 'Balanced thematic mode; guests join host rooms free.',
  },
  shop_scen_cold_war: {
    name: 'Scenario: Corporate Cold War',
    description: 'High-tech arms & supply race split across two opposing blocs from Minute 1.',
    zeroP2WNote: 'Fair symmetrical start for every player in the lobby.',
  },
  shop_arch_investment_fund: {
    name: 'Archetype: Investment Fund',
    description: 'More starting capital and cheaper loans balanced by pricier industry upkeep.',
    zeroP2WNote: 'Symmetric trade-off: 2 perks + 2 drawbacks (0% Pay-to-Win).',
  },
  shop_arch_tech_incubator: {
    name: 'Archetype: Tech Incubator',
    description: 'Faster R&D and patent rollouts balanced by leaner cash & higher MW draw.',
    zeroP2WNote: 'Symmetric trade-off: 2 perks + 2 drawbacks (0% Pay-to-Win).',
  },
  shop_arch_logistics_cartel: {
    name: 'Archetype: Logistics Cartel',
    description: 'Massive toll boost and cheaper roads/fleets offset by pricier surveys.',
    zeroP2WNote: 'Symmetric trade-off: 2 perks + 2 drawbacks (0% Pay-to-Win).',
  },
  shop_arch_eco_innovator: {
    name: 'Archetype: Eco-Innovator',
    description: 'Clean energy efficiency & voter approval offset by costly heavy industry.',
    zeroP2WNote: 'Symmetric trade-off: 2 perks + 2 drawbacks (0% Pay-to-Win).',
  },
  shop_theme_gold: {
    name: 'Theme: Wall Street Gold',
    description: 'Dark executive terminal featuring gold borders, sliders, and VIP accents.',
    zeroP2WNote: 'Pure UI styling — zero impact on game balance.',
  },
  shop_theme_emerald: {
    name: 'Theme: Emerald Terminal',
    description: 'Emerald institutional analytics theme styled after top brokerage desks.',
    zeroP2WNote: 'Pure UI styling — zero impact on game balance.',
  },
  shop_theme_crimson: {
    name: 'Theme: Crimson War Room',
    description: 'Dark crimson tactical command look for boardroom rivalries.',
    zeroP2WNote: 'Pure UI styling — zero impact on game balance.',
  },
  shop_hq_golden: {
    name: 'HQ: Golden Fortune Tower',
    description: 'Gilded corporate headquarters visible to everyone on the 2.5D isometric map.',
    zeroP2WNote: '2.5D cosmetic (also unlockable via $25M net worth achievement).',
  },
  shop_hq_eco_dome: {
    name: 'HQ: Eco-Dome Renewables',
    description: 'Glass biosphere HQ with lush garden terraces on the 2.5D map.',
    zeroP2WNote: '2.5D cosmetic (zero economic bonuses).',
  },
  shop_hq_cyber_citadel: {
    name: 'HQ: Cyber Citadel',
    description: 'Obsidian-neon high-tech tower crowned by a quantum array.',
    zeroP2WNote: '2.5D cosmetic (zero economic bonuses).',
  },
  shop_hq_monolith: {
    name: 'HQ: Obsidian Monolith',
    description: 'Monumental black crystal executive citadel with glowing light strips.',
    zeroP2WNote: '2.5D cosmetic (zero economic bonuses).',
  },
  shop_frame_neon: {
    name: 'Frame: Neon Pulse (Anim.)',
    description: 'Pulsing cyan border showcasing your executive card in lobbies & profiles.',
    zeroP2WNote: 'Social cosmetic visible in P2P lobbies.',
  },
  shop_frame_gold_aura: {
    name: 'Frame: Golden Exchange Aura (Anim.)',
    description: 'Shimmering gold background highlight for seasoned traders.',
    zeroP2WNote: 'Social cosmetic visible in P2P lobbies.',
  },
  shop_frame_crimson_matrix: {
    name: 'Frame: Crimson Matrix (Anim.)',
    description: 'Bold animated crimson frame reserved for strategic sharks.',
    zeroP2WNote: 'Social cosmetic visible in P2P lobbies.',
  },
  shop_mon_fountain: {
    name: '2.5D Monument: Corporate Fountain',
    description: 'Decorative 2.5D water plaza (1:1 identical stats to City Park — Zero P2W).',
    zeroP2WNote: 'Exact same cost, upkeep & smog clearing as City Park.',
  },
  shop_mon_obelisk: {
    name: '2.5D Monument: Wall Street Obelisk',
    description: 'Gold-marble market obelisk on the 2.5D map (1:1 stats with City Park).',
    zeroP2WNote: 'Exact same cost, upkeep & smog clearing as City Park.',
  },
  shop_mon_helipad: {
    name: '2.5D Monument: Executive Helipad',
    description: 'Exclusive VIP landing pad plaza (1:1 stats with City Park).',
    zeroP2WNote: 'Exact same cost, upkeep & smog clearing as City Park.',
  },
  shop_mon_founder: {
    name: '2.5D Monument: Golden Founder Statue',
    description: 'Iconic pedestal statue of the conglomerate founder (1:1 stats with City Park).',
    zeroP2WNote: 'Exact same cost, upkeep & smog clearing as City Park.',
  },
};

export function localizeShopItem<
  T extends { id: string; name: string; description: string; zeroP2WNote: string },
>(item: T, lang: Language): T {
  if (lang === 'pl') return item;
  const en = SHOP_ITEMS_EN[item.id];
  return en ? { ...item, ...en } : item;
}

const BATTLE_PASS_TIER_EN: Record<number, string> = {
  1: '+60 M-Coins',
  2: 'CEO Starter Bundle (+70 M)',
  3: '+80 M-Coins',
  4: 'Frame: Emerald Network',
  5: '2.5D Monument: Corporate Fountain',
  6: '+90 M-Coins',
  7: '+100 M-Coins',
  8: 'Title: High-Stakes Leader',
  9: '+105 M-Coins',
  10: '2.5D Monument: Wall Street Obelisk',
  11: '+110 M-Coins',
  12: 'HQ: Golden Fortune Tower',
  13: '+120 M-Coins',
  14: 'HQ Skin: Obsidian Monolith',
  15: 'UI Theme: Emerald Terminal + Neon Frame',
  16: '+125 M-Coins',
  17: 'Frame (Anim.): Neon Pulse',
  18: 'Title: Wall Street Baron',
  19: '+130 M-Coins',
  20: '2.5D Monument: Executive Helipad',
  21: '+140 M-Coins',
  22: 'UI Theme: Crimson War Room',
  23: '+150 M-Coins',
  24: 'HQ: Cyber Citadel',
  25: 'UI Theme: Wall Street Gold + Gold Aura',
  26: 'Frame (Anim.): Golden Exchange Aura',
  27: '+175 M-Coins',
  28: 'HQ Skin: Platinum Prestige Spire',
  29: '+210 M-Coins',
  30: 'S1 Finale: Golden Founder Statue + 300 M',
};

export function localizeBattlePassTierTitle(
  level: number,
  fallback: string,
  lang: Language
): string {
  return lang === 'pl' ? fallback : BATTLE_PASS_TIER_EN[level] ?? fallback;
}

const PVP_DIVISION_EN: Record<PvPDivisionId, string> = {
  startup: 'Start-up',
  investor: 'Investor',
  director: 'Director',
  oligarch: 'Oligarch',
  magnate: 'Magnate',
};

export function localizePvPDivisionLabel(
  id: PvPDivisionId,
  fallback: string,
  lang: Language
): string {
  return lang === 'pl' ? fallback : PVP_DIVISION_EN[id] ?? fallback;
}

const QUESTS_EN: Record<string, { title: string; description: string }> = {
  dq_b2b_2: { title: 'Contract Deal-Maker', description: 'Complete or fulfill 2 B2B market contracts.' },
  dq_bridge_1: { title: 'Bridge Architect', description: 'Construct a Road Bridge spanning across a river.' },
  dq_self_fuel_50: { title: 'Energy Self-Sufficiency', description: 'Run power plants on your own network fuel for 50 ticks.' },
  dq_roads_6: { title: 'Asphalt Backbone', description: 'Build at least 6 road or highway tiles.' },
  dq_plots_8: { title: 'Territorial Expansion', description: 'Hold 8 land plots simultaneously in one match.' },
  wq_b2b_6: { title: 'B2B Trade Baron', description: 'Complete 6 total B2B contracts across matches.' },
  wq_green_4: { title: 'Corporate Green Deal', description: 'Operate 4 active renewable or eco facilities.' },
  wq_podium_2: { title: 'Wall Street Podium', description: 'Finish 2 matches in Top 2 or win outright.' },
  wq_self_fuel_150: { title: 'Resource Independence', description: 'Operate power plants on captive fuel for 150 ticks.' },
};

export function localizeQuest<T extends { id: string; title: string; description: string }>(
  q: T,
  lang: Language
): T {
  if (lang === 'pl') return q;
  const en = QUESTS_EN[q.id];
  return en ? { ...q, ...en } : q;
}

// ─── 7. Wyzwanie Tygodnia, Cykle Giełdowe, Patenty, Przetargi, Zdarzenia ───

const WEEKLY_TEMPLATES_EN: Array<{
  plTitlePrefix: string;
  title: string;
  description: string;
  rulesBulletList: string[];
}> = [
  {
    plTitlePrefix: 'Zielony Skok Bez Długów',
    title: 'Debt-Free Green Leap',
    description: 'Hit target net worth with zero bank credit and zero dirty coal generation.',
    rulesBulletList: [
      'Goal: Min. $30,000,000 Net Worth before end of Year 8',
      'Forbidden: Coal Power Plants & Waste Incinerators',
      'Mutator: No Bank Loans — zero external borrowing',
      'Difficulty: Crisis · 4 players (You + 3 AI)',
    ],
  },
  {
    plTitlePrefix: 'Krwawy Rynek Surowcowy',
    title: 'Cutthroat Commodity Floor',
    description: 'Weather extreme market volatility and amass a fortune on a fixed map seed.',
    rulesBulletList: [
      'Goal: Min. $36,000,000 Net Worth before end of Year 7',
      'Mutators: Crazy Market + Fog of War + Extreme Climate',
      'Starter Perk: Free Local Roads',
      'Difficulty: Crisis · 5 players (You + 4 AI)',
    ],
  },
  {
    plTitlePrefix: 'Czysta Logistyka Kontynentalna',
    title: 'Clean Continental Logistics',
    description: 'Bridge distant deposits via highways and transit across a large seeded map.',
    rulesBulletList: [
      'Goal: Min. $42,000,000 Net Worth before end of Year 9',
      'Large 32x32 map (identical terrain & deposits for all players)',
      'Forbidden: Coal Power Plants · Mutator: Crazy Market',
      'Difficulty: Standard · 5 players (You + 4 AI)',
    ],
  },
  {
    plTitlePrefix: 'Hardkorowy Ekstraktor Kryzysowy',
    title: 'Hardcore Crisis Extractor',
    description: 'Ruthless taxes and zero loans — pure operating margin survival test.',
    rulesBulletList: [
      'Goal: Min. $24,000,000 Net Worth before end of Year 7',
      'Mutators: No Bank Loans + Fog of War',
      'Forbidden: Nuclear Power Plants — rely on renewables, fusion or gas',
      'Difficulty: Survival (Hardcore)',
    ],
  },
];

export function localizeWeeklyChallenge<
  T extends {
    weekKey: string;
    title: string;
    description: string;
    rulesBulletList: string[];
    badgeName: string;
  },
>(spec: T, lang: Language): T {
  if (lang === 'pl') return spec;
  const found = WEEKLY_TEMPLATES_EN.find((w) => spec.title.startsWith(w.plTitlePrefix));
  if (!found) {
    return { ...spec, badgeName: `Champion ${spec.weekKey}` };
  }
  return {
    ...spec,
    title: `${found.title} (${spec.weekKey})`,
    description: found.description,
    rulesBulletList: found.rulesBulletList,
    badgeName: `Champion ${spec.weekKey}`,
  };
}

const MARKET_SECTOR_EN: Record<MarketSectorKey, string> = {
  gold_luxury: 'Gold & Luxury Index (GLD)',
  energy: 'Energy & Power Index (NRG)',
  tech: 'High-Tech & Batteries Index (TEC)',
  industry: 'Heavy Industry Index (IND)',
  green: 'Clean Economy & Media Index (ECO)',
};

const MARKET_PHASE_EN: Record<MarketCyclePhase, string> = {
  hossa: 'BULL MARKET',
  korekta: 'PULLBACK',
  krach: 'BEAR CRASH',
  banka: 'BUBBLE',
};

export function localizeMarketCycleName(
  c: Pick<MarketCycleState, 'sector' | 'name'>,
  lang: Language
): string {
  return lang === 'pl' ? c.name : MARKET_SECTOR_EN[c.sector] ?? c.name;
}

export function localizeMarketCyclePhase(
  phase: MarketCyclePhase,
  lang: Language
): string {
  if (lang === 'pl') {
    const PL: Record<MarketCyclePhase, string> = {
      hossa: 'HOSSA',
      korekta: 'KOREKTA',
      krach: 'KRACH',
      banka: 'BAŃKA',
    };
    return PL[phase] ?? phase;
  }
  return MARKET_PHASE_EN[phase] ?? phase;
}

const PATENT_LABELS_EN: Record<string, string> = {
  ind_mega_extraction: 'Patent: Deep-Crust Deposit Extraction',
  ind_recycling: 'Patent: Industrial Metal Reclamation',
  mod_semiconductors: 'Patent: EUV Silicon Lithography',
  mod_ai_erp: 'Patent: Industrial AI & Solid-State Cells',
  mod_fusion: 'Patent: Tokamak Fusion Reactor',
  mod_enrichment: 'Patent: Isotope Enrichment Centrifuges',
  saf_hazmat: 'Patent: HAZMAT Rapid Neutralization',
  mil_cyber: 'Patent: Quantum Cyber-Defense Grids',
};

export function localizePatent<T extends Pick<PatentRecord, 'techId' | 'techName'>>(
  pt: T,
  lang: Language
): T {
  if (lang === 'pl') return pt;
  const enName = PATENT_LABELS_EN[pt.techId];
  return enName ? { ...pt, techName: enName } : pt;
}

const TENDER_EN_BY_PL_TITLE: Record<string, { title: string; description: string }> = {
  'Krajowa Rezerwa Paliwowo-Stalowa': {
    title: 'National Strategic Fuel & Steel Reserve',
    description: 'Strategic delivery of 35 t Steel and 28 kl Fuel for state reserves.',
  },
  'Program Elektryfikacji Transportu Publicznego': {
    title: 'Public Transit Electrification Program',
    description: 'Supply 18 kWh EV Lithium Batteries and 25 pcs Industrial Electronics.',
  },
  'Krajowy Program Prefabrykacji i Wodociągów': {
    title: 'National Prefab & Waterworks Initiative',
    description: 'Secure delivery of 45 t Prefabs and 30 t Gravel for state infrastructure.',
  },
  'Czysta Sieć Zielonej Energii OZE': {
    title: 'Clean Renewables Grid Mandate',
    description: 'Hold the largest active clean power output (min. 90 MW) at tender close.',
  },
};

export function localizeTender<T extends Pick<GovernmentTender, 'title' | 'description'>>(
  tender: T,
  lang: Language
): T {
  if (lang === 'pl') return tender;
  if (tender.title.startsWith('Upadek Giganta · Licytacja:')) {
    const rawSuffix = tender.title.replace('Upadek Giganta · Licytacja:', '').trim();
    return {
      ...tender,
      title: `Fall of a Giant · Bailiff Auction: ${rawSuffix}`,
      description: 'Bailiff auction of an insolvent central conglomerate industrial facility.',
    };
  }
  const en = TENDER_EN_BY_PL_TITLE[tender.title];
  return en ? { ...tender, ...en } : tender;
}

const BREAKTHROUGHS_EN: Record<
  GlobalBreakthroughId,
  { name: string; forecastHeadline: string; description: string; effectsSummary: string[] }
> = {
  ai_boom: {
    name: 'Artificial Intelligence Boom',
    forecastHeadline: 'Analysts project an explosive surge in AI compute and silicon chip demand',
    description:
      'Data Centers, Semiconductor Fabs, Battery Plants, Biotech & R&D revenues permanently rise +45%, chip/electronics/lithium base prices +35%, while High-Tech facilities draw +18% more electricity.',
    effectsSummary: [
      '+45% High-Tech revenue (Data Center, Chips, Batteries, Biotech, R&D)',
      '+35% base prices for Semiconductors, Electronics, Batteries & Lithium',
      '+18% electricity demand across High-Tech facilities',
    ],
  },
  energy_crisis: {
    name: 'Great Global Energy Crunch',
    forecastHeadline: 'Supply tensions threaten a permanent price shock across energy & fuels',
    description:
      'All power plant revenues rise permanently by +60%, and base prices of coal, crude oil, fuel, uranium & electricity surge +45%.',
    effectsSummary: [
      '+60% revenue across all power generation facilities',
      '+45% base prices for Coal, Oil, Fuel, Uranium & Electricity',
      'Massive advantage for energy self-sufficiency',
    ],
  },
  tourism_golden_era: {
    name: 'Golden Era of Tourism & Luxury',
    forecastHeadline: 'Middle-class travel & VIP capital gear up for a historic leisure boom',
    description:
      'Hotels, Resorts, Casinos, Attractions, Malls, Jewelry & Passenger Hubs permanently gain +50% revenue, with gold & jewelry prices up +25%.',
    effectsSummary: [
      '+50% revenue for Tourism, Luxury Retail & Passenger Transit',
      '+25% base prices for Gold and Luxury Jewelry',
      'Huge multiplier for Entertainment & Marina districts',
    ],
  },
};

export function localizeBreakthrough<
  T extends Pick<ActiveBreakthroughState, 'id' | 'name' | 'headline' | 'description' | 'effectsSummary'>,
>(bt: T, lang: Language): T {
  if (lang === 'pl') return bt;
  const en = BREAKTHROUGHS_EN[bt.id];
  return en
    ? {
        ...bt,
        name: en.name,
        headline: en.forecastHeadline,
        description: en.description,
        effectsSummary: en.effectsSummary,
      }
    : bt;
}

export const EVENT_TEXTS_EN_BY_PL_NAME: Record<
  string,
  {
    name: string;
    headline: string;
    forecastHeadline?: string;
    forecastBody?: string;
    body: string;
    analysis: string;
    hints: string[];
    mitigationHint: string;
  }
> = {
  'Kryzys w Cieśninie Naftowej': {
    name: 'Oil Strait Chokepoint Crisis',
    forecastHeadline: 'Tanker lane tensions — analysts forecast a sharp oil price surge!',
    forecastBody: 'Shipping monitors report naval standoffs along the main crude strait. Futures could spike within days.',
    headline: 'OIL CRISIS! Crude oil & fuel prices skyrocket!',
    body: 'Blockade of a primary maritime corridor choked crude deliveries, lifting fuel and transport expenses economy-wide.',
    analysis: 'Higher fuel automatically raises road, sea, and air freight costs. Oil drillers, refineries & stockpilers benefit most.',
    hints: ['Secure your own Oil Wells or Refinery before the spike.', 'Stockpile fuel early and sign fixed B2B contracts.'],
    mitigationHint: 'Fuel reserves, fixed B2B deals, Intermodal Freight Hubs tech.',
  },
  'Długotrwała Susza Hydrologiczna': {
    name: 'Severe Hydrological Drought',
    forecastHeadline: 'Meteorologists warn of record heat and shrinking river flows',
    forecastBody: 'Groundwater and rivers are dropping steadily, threatening power cooling towers and hydro dams.',
    headline: 'DROUGHT CRIPPLES RIVERS! Hydro dams & water intakes lose output!',
    body: 'Severe drought struck industrial water intakes, hydro turbines, and heavy cooling plants.',
    analysis: 'Hydro dams run at a fraction of capacity while industrial water & power prices surge.',
    hints: ['Research "Retention & Closed Water Loops" or Dry Cooling towers.', 'Diversify into renewables or nuclear.'],
    mitigationHint: 'Closed Water Loops tech, Nuclear Dry Cooling, Renewables.',
  },
  'Globalny Boom Cyfrowy': {
    name: 'Global Digital Chip Boom',
    forecastHeadline: 'Tech giants prepare huge orders for chips and electronics',
    forecastBody: 'Automation and datacenter growth point to explosive demand for semiconductors and rare earths.',
    headline: 'SEMICONDUCTOR BOOM! Record margins across High-Tech!',
    body: 'A wave of silicon orders drove semiconductor, electronics, and rare metal prices sharply upward.',
    analysis: 'Chip fabs, electronics works, and rare earth mines record cycle-peak profit margins.',
    hints: ['Scale Rare Metals -> Chemical Plant -> Semiconductor Fab.', 'Hire skilled engineers trained at your University.'],
    mitigationHint: 'Captive rare metal extraction and healthy chemical buffers.',
  },
  'Podwyżka Składek Pracowniczych': {
    name: 'Payroll Contribution Hike',
    forecastHeadline: 'Parliament debates higher employer payroll contributions',
    forecastBody: 'Draft fiscal bill raises mandatory wage surcharges, threatening labor-heavy margins.',
    headline: 'HIGHER PAYROLL LEVIES! Workforce costs jump +28%!',
    body: 'Higher statutory employer taxes hit labor-intensive mines and mills lacking automation.',
    analysis: 'Training lean crews and researching building automation outpaces adding extra headcount.',
    hints: ['Unlock Automation & Robotics in mines and mills.', 'Train existing workers rather than over-hiring.'],
    mitigationHint: 'Facility Automation modules, HR training, Financial Lobbying.',
  },
  'Rządowy Program Infrastrukturalny': {
    name: 'National Infrastructure Stimulus',
    forecastHeadline: 'Cabinet unveils massive housing and highway stimulus plan',
    forecastBody: 'Multi-year road and tower building tenders are poised to drive steep demand for steel & prefabs.',
    headline: 'CONSTRUCTION BOOM! Steel & prefabs hit record highs!',
    body: 'State procurement sparked a buying frenzy for structural steel, gravel aggregates, and prefabs.',
    analysis: 'Construction suppliers reap strong yields while new building capex ticks higher.',
    hints: ['Build Quarries, Prefab Plants & Steel Mills.', 'Sell stockpiled steel inventories near peak prices.'],
    mitigationHint: 'Early B2B supply contracts for steel and prefabs.',
  },
  'Kryzys Mocy Szczytowych': {
    name: 'Peak Grid Power Crunch',
    forecastHeadline: 'Grid operator warns of industrial peak electricity deficit',
    forecastBody: 'Rapid industrialization outpaces legacy turbines — higher wholesale power tariffs loom.',
    headline: 'POWER DEFICIT! MWh prices surge +60%!',
    body: 'An overloaded national grid forced emergency tariff hikes, squeezing power-hungry plants.',
    analysis: 'Coal, nuclear, and renewables generators collect massive grid export premiums.',
    hints: ['Build captive power plants to cut market exposure.', 'Upgrade Transmission Tariffs inside Nuclear Plants.'],
    mitigationHint: 'Captive generation (Renewables/Nuclear) & Smart Grids tech.',
  },
  'Pakiet Deregulacji Gospodarczej': {
    name: 'Economic Deregulation Package',
    headline: 'Corporate CIT cut! Cabinet fuels private investment',
    body: 'Business lobbying and buoyant sentiment unlocked a temporary corporate income tax reduction.',
    analysis: 'Prime window to realize profits, claim prime plots, and retire costly loans.',
    hints: ['Run factories at peak throughput during the tax holiday.'],
    mitigationHint: 'Positive cycle — liquidate warehouse stockpiles at healthy margins.',
  },
  'Fala Strajków Związkowych': {
    name: 'Wave of Labor Strikes',
    forecastHeadline: 'Heavy-industry unions announce strike readiness alert',
    forecastBody: 'Rising cost of living and industrial smog fuel unrest across factory floors.',
    headline: 'FACTORY STRIKES! Productivity drops & stoppages loom!',
    body: 'Civic unrest slowed low-skill, polluting industrial plants.',
    analysis: 'Skilled staff, clean scrubbers, and strong Church/Media outreach soften walkout impacts.',
    hints: ['Invest in HR training and track voter approval.', 'Build Social Foundations & Media Agencies to calm tensions.'],
    mitigationHint: 'HR courses, facility filters, Social Influence actions.',
  },
  'Strategiczny Kontrakt Obronny': {
    name: 'Strategic Defense Tender',
    headline: 'State opens urgent military modernization tender',
    body: 'Defense procurement lifts armaments, armor steel, and military chip valuations.',
    analysis: 'Defense complexes and strategic alloy suppliers record windfall gains.',
    hints: ['Run a Defense Works or export steel & chips to arms makers.'],
    mitigationHint: 'Diversify into defense works and strategic metals.',
  },
  'Narodowy Grant Innowacji': {
    name: 'National Innovation Grant',
    headline: 'Cabinet launches R&D & University research subsidies',
    body: 'Universities and private R&D Labs earn accelerated research point generation.',
    analysis: 'Ideal timing to catch up in tech race toward Nuclear and Aerospace.',
    hints: ['Expand High Schools, Universities & R&D Labs.'],
    mitigationHint: 'Education campuses maximize public grant windfalls.',
  },
  'Spowolnienie Koniunktury': {
    name: 'Global Economic Slowdown',
    forecastHeadline: 'Softer global PMI readings signal cooling industrial demand',
    forecastBody: 'Economists project a temporary commodity price correction and softer real-estate yields.',
    headline: 'MARKET PULLBACK! Commodity prices dip -20%!',
    body: 'Global cooling pushed raw and processed valuations lower; leveraged firms must guard liquidity.',
    analysis: 'Golden chance to snap up cheap land plots and accumulate warehouse reserves before recovery.',
    hints: ['Switch warehouses from instant export toward stockpiling.', 'Use idle cash reserves to acquire prime terrain.'],
    mitigationHint: 'Stockpile accumulation and disciplined credit exposure.',
  },
  'Premie za Czystą Energię': {
    name: 'Clean Energy Premium',
    headline: 'Green Industrial Deal: Renewable premiums & emissions penalties',
    body: 'Renewable producers enjoy higher power tariffs while unfiltered heavy plants pay higher fines.',
    analysis: 'Clean scrubber upgrades, wind/solar parks, and nuclear gain clear advantage.',
    hints: ['Install clean scrubbers in mines/mills and invest in Renewables.'],
    mitigationHint: 'Green scrubber modules inside mines, smelters, and refineries.',
  },
  'Trzęsienie Ziemi': {
    name: 'Major Earthquake',
    forecastHeadline: 'Seismologists detect rising tectonic stress beneath the region',
    forecastBody: 'Monitoring stations warn of severe seismic tremors possible within days.',
    headline: 'EARTHQUAKE STRIKES! Heavy structural & road damage!',
    body: 'Powerful seismic waves shook the map, damaging mines, smelters, plants, and roads!',
    analysis: 'Sudden wear spikes hit asset condition; plants without auto-repair risk forced shutdowns.',
    hints: ['Keep cash reserves for repairs and enable Auto-Repair defaults.'],
    mitigationHint: 'Repair reserves plus Fire & Hospital emergency readiness.',
  },
  'Katastrofalna Powódź Rzeczna': {
    name: 'Catastrophic River Flood',
    forecastHeadline: 'Torrential rains push rivers near flood stage across coastlines',
    forecastBody: 'Forecasters expect overflow along coastal plots and riverfront lowlands.',
    headline: 'FLOOD SWAMPS THE COAST! Waterfront hubs submerged!',
    body: 'Floodwaters damaged coastal complexes, riverside roads, and low-lying factories.',
    analysis: 'Coastal and lowland plains carry highest flood risk and drive reconstruction steel demand.',
    hints: ['Diversify heavy plants onto inland hills/highlands.'],
    mitigationHint: 'Prefab stocks for repairs and highland diversification.',
  },
  'Niszczycielskie Tornado': {
    name: 'Destructive Tornado',
    forecastHeadline: 'Tornado watch: severe supercell tracking across the plains',
    forecastBody: 'Meteorologists warn of an intense funnel storm threatening industrial belts.',
    headline: 'TORNADO TEARS ACROSS MAP! Power lines & plants damaged!',
    body: 'A violent twister carved through a random corridor, hitting wind turbines and factories.',
    analysis: 'Tornadoes strike narrow corridors hard — check asset damage along the track promptly.',
    hints: ['Repair struck assets immediately before ruin collapse.'],
    mitigationHint: 'Auto-repair thresholds and geographic dispersion.',
  },
  'Ekstremalna Fala Upałów i Susza': {
    name: 'Extreme Heatwave & Drought',
    forecastHeadline: 'Record heat dome approaches — water intake failure threatens grid',
    forecastBody: 'Soaring temperatures drive steep water and cooling electricity consumption.',
    headline: 'SEVERE HEATWAVE! Economy-wide cooling water crisis!',
    body: 'Record heat throttled rivers and sent industrial water & electricity tariffs soaring.',
    analysis: 'Hydro plants and open-loop cooling sites suffer sharp production slowdowns.',
    hints: ['Build Water Stations and unlock drought-protection modules.'],
    mitigationHint: 'Closed water loops, artesian wells, Renewables & Gas plants.',
  },
  'Burza Magnetyczna (Słońce)': {
    name: 'Geomagnetic Solar Storm',
    forecastHeadline: 'Observatories warn of massive X-class solar flare event',
    forecastBody: 'Coronal mass ejection risks disrupting HV transformers, chip fabs & solar parks.',
    headline: 'SOLAR STORM! Grid disruptions & electronics price surge!',
    body: 'Heavy geomagnetic currents overloaded grid transformers, dropping output -30% and lifting chip prices.',
    analysis: 'Firms running thin MW buffers plunge into sharp power deficits during solar storms.',
    hints: ['Maintain a comfortable MW generation surplus above demand!'],
    mitigationHint: 'Grid MW surplus, Smart Grids tech, EV Battery buffering.',
  },
};

export function localizeEvent<
  T extends Pick<GameEvent, 'name' | 'description' | 'mitigationHint'>,
>(ev: T, lang: Language): T {
  if (lang === 'pl') return ev;
  const en = EVENT_TEXTS_EN_BY_PL_NAME[ev.name];
  return en
    ? {
        ...ev,
        name: en.name,
        description: en.body,
        mitigationHint: en.mitigationHint,
      }
    : ev;
}

export function localizeNewsArticle(art: NewsArticle, lang: Language): NewsArticle {
  if (lang === 'pl') return art;

  // Match known Event Templates & Forecasts by exact headline/forecastHeadline
  for (const [, en] of Object.entries(EVENT_TEXTS_EN_BY_PL_NAME)) {
    if (en.forecastHeadline && art.headline.includes(en.forecastHeadline.slice(0, 12))) {
      // ignore if already EN
    }
  }
  // Check Polish event headlines or forecast tags stored on article
  for (const [plName, en] of Object.entries(EVENT_TEXTS_EN_BY_PL_NAME)) {
    if (
      art.headline === en.headline ||
      art.headline.includes(plName) ||
      (art.analysis && art.analysis.includes(plName.slice(0, 10)))
    ) {
      return {
        ...art,
        headline: en.headline,
        brief: en.body,
        fullText: en.body,
        analysis: en.analysis,
        hints: en.hints,
      };
    }
  }
  if (art.headline.startsWith('[PROGNOZA]')) {
    const matched = Object.values(EVENT_TEXTS_EN_BY_PL_NAME).find(
      (en) => en.forecastHeadline && art.analysis.length > 0 && art.headline.includes('[PROGNOZA]')
    );
    return {
      ...art,
      headline: `[FORECAST] Market & climate alert incoming`,
      brief: matched?.forecastBody ?? 'Market analysts warn of an imminent macro/weather shift.',
      fullText: matched?.forecastBody ?? art.fullText,
      analysis: matched?.analysis ?? 'Prepare warehouse buffers, liquidity, and utility redundancy.',
      hints: matched?.hints ?? ['Check Markets & Ticker gauges to hedge exposure early.'],
    };
  }
  if (art.headline.startsWith('[PROGNOZA PRZEŁOMU]')) {
    return {
      ...art,
      headline: '[BREAKTHROUGH FORECAST] Structural global market shift ahead!',
      brief: 'Global analysts project permanent structural repricing across key industrial sectors.',
      fullText: art.fullText.startsWith('Global') ? art.fullText : 'Prepare investments and supply chains for permanent global repricing.',
      analysis: 'Permanent macro shifts alter asset profitability until the end of the match.',
      hints: ['Review strategic R&D and sector exposure before impact!'],
    };
  }
  if (art.headline.startsWith('🌐 GLOBALNY PRZEŁOM')) {
    const bt = BREAKTHROUGHS_EN.ai_boom;
    return { ...art, headline: '🌐 GLOBAL BREAKTHROUGH: Artificial Intelligence Boom (Permanent!)', brief: bt.description, fullText: bt.description, hints: bt.effectsSummary };
  }
  if (art.headline.startsWith('⚡ GLOBALNY PRZEŁOM')) {
    const bt = BREAKTHROUGHS_EN.energy_crisis;
    return { ...art, headline: '⚡ GLOBAL BREAKTHROUGH: Great Energy Crunch (Permanent!)', brief: bt.description, fullText: bt.description, hints: bt.effectsSummary };
  }
  if (art.headline.startsWith('🏖️ GLOBALNY PRZEŁOM')) {
    const bt = BREAKTHROUGHS_EN.tourism_golden_era;
    return { ...art, headline: '🏖️ GLOBAL BREAKTHROUGH: Golden Era of Tourism (Permanent!)', brief: bt.description, fullText: bt.description, hints: bt.effectsSummary };
  }
  if (art.headline.startsWith('🗳️ Wyniki Wyborów Parlamentarnych:')) {
    const gov = art.headline.includes('Wolnorynkowy')
      ? GOVERNMENTS_EN.free_market.name
      : art.headline.includes('Ekologiczny')
        ? GOVERNMENTS_EN.ecological.name
        : GOVERNMENTS_EN.interventionist.name;
    return {
      ...art,
      headline: `🗳️ Parliamentary Election Result: ${gov} takes power`,
      brief: 'New fiscal taxes, green subsidies, and labor policy parameters take effect immediately.',
      analysis: 'Use the Influence panel to lobby upcoming elections ahead of schedule.',
      hints: ['Check Influence -> Government tab for exact active policy modifiers.'],
    };
  }
  if (art.headline.startsWith('🌿 SCENARIUSZ:')) {
    return {
      ...art,
      headline: '🌿 SCENARIO: Green Transition Carbon Package enacted!',
      brief: 'Carbon taxes tripled on coal & heavy smog, while waste incinerators are banned!',
      fullText: 'Green Transition mid-game shock: clean power, lithium, batteries & recycling take center stage.',
      analysis: 'Replace coal/incinerators with clean alternatives promptly to preserve margins.',
      hints: ['Pivot toward Renewables, Fusion, Recycling, and Batteries.'],
    };
  }
  if (art.headline.startsWith('📜 Nowy Przetarg Rządowy:')) {
    const plT = art.headline.replace('📜 Nowy Przetarg Rządowy:', '').trim();
    const enT = TENDER_EN_BY_PL_TITLE[plT];
    return {
      ...art,
      headline: `📜 New Government Tender: ${enT?.title ?? plT}`,
      brief: enT?.description ?? 'Check Finance / B2B Tenders to submit bids for cash & influence rewards.',
      analysis: 'Winning state contracts awards substantial treasury cash, influence & voter goodwill.',
      hints: ['Open Finance / Contracts to inspect tender requirements.'],
    };
  }
  if (art.headline.startsWith('🏆') && art.headline.includes('wygrywa przetarg')) {
    return {
      ...art,
      headline: art.headline.replace('wygrywa przetarg', 'wins government tender'),
      brief: 'Winning corporation collected state procurement cash, influence & public approval rewards.',
      hints: ['Watch Finance / Tenders for the next state contract window.'],
    };
  }
  if (art.headline.startsWith('🏅 Przyznano wyłączny')) {
    return {
      ...art,
      headline: art.headline.replace('Przyznano wyłączny', 'Exclusive Patent Granted:'),
      brief: 'First-mover innovator earns recurring patent royalties for 140 ticks!',
      analysis: 'Leading R&D investments secure long-term passive patent royalties.',
      hints: ['Check active patents in the Tech Tree and Finance tabs.'],
    };
  }
  if (art.headline.startsWith('🎯 Tajny Cel Ujawniony!')) {
    return {
      ...art,
      headline: art.headline.replace('🎯 Tajny Cel Ujawniony!', '🎯 Secret Goal Achieved!').replace('ukończyła', 'completed'),
      brief: 'Board disclosed a completed covert corporate strategy, claiming cash, influence & dominance bonus!',
      analysis: 'Completed secret goals accelerate path to market domination cleanly.',
      hints: ['Track your active Secret Goals inside the CEO / HUD panel.'],
    };
  }
  if (art.headline.startsWith('🔨 Licytacja Zakończona:')) {
    return {
      ...art,
      headline: art.headline.replace('🔨 Licytacja Zakończona:', '🔨 Auction Closed:').replace('przejmuje', 'acquires'),
      brief: 'Asset ownership transferred cleanly at bailiff liquidation auction.',
      hints: ['Monitor Finance -> Live Auctions for distressed bargains.'],
    };
  }
  return art;
}

const MAP_SIZE_LABELS_EN: Record<number, string> = {
  20: 'Compact 20×20',
  24: 'Standard 24×24',
  32: 'Large 32×32',
  40: 'Continental 40×40',
};

export function localizeMapSizeLabel(value: number, fallback: string, lang: Language): string {
  return lang === 'pl' ? fallback : MAP_SIZE_LABELS_EN[value] ?? fallback;
}

const TUTORIAL_STEPS_EN: Array<{ title: string; content: string }> = [
  {
    title: 'Welcome to Market Dominion!',
    content:
      'Step into the CEO chair to build a global corporate empire. Start as a Level 1 Start-up and unlock copper, gold, cargo ports, air freight terminals, HAZMAT squads, and nuclear energy.',
  },
  {
    title: 'Plots, Roads & Buyout Negotiations',
    content:
      'Click any plot to acquire land, run geological surveys, or pave private asphalt roads linking mines. You can also send land buyout offers to human rivals and AI bots!',
  },
  {
    title: 'Power, Water Balance & Multimodal Logistics',
    content:
      'Click ⚡ Power or 💧 Water in the top ticker to inspect supply vs demand. Across oceans or cliffs without road access, build a Cargo Port or Cargo Airport!',
  },
  {
    title: 'Safety, Hospitals & HAZMAT',
    content:
      'Heavy industry faces fire hazards, while chemical and uranium plants risk toxic spills. Fire Stations douse flames, Hospitals protect crews, and HAZMAT Bases safeguard high-risk zones.',
  },
  {
    title: 'Good Luck Building Your Empire!',
    content:
      'Progress autosaves every few seconds and upon tab close. Advance your research trees, shape market headlines, and seize corporate dominion!',
  },
];

export function localizeTutorialStep<T extends { title: string; content: string }>(
  step: T,
  index: number,
  lang: Language
): T {
  if (lang === 'pl') return step;
  const en = TUTORIAL_STEPS_EN[index];
  return en ? { ...step, ...en } : step;
}

const MATCH_FUN_AWARDS_EN: Record<
  string,
  { title: string; subtitle: string; valueReplace?: [RegExp, string] }
> = {
  award_debt_king: {
    title: 'King of Leverage',
    subtitle: 'Highest peak credit & bond debt during the match',
  },
  award_toll_master: {
    title: 'Highway Toll Baron',
    subtitle: 'Highest cumulative tolls collected at private highway gates',
  },
  award_polluter: {
    title: 'Heaviest Polluter',
    subtitle: 'Record emission fines and heavy-industry pollution charges',
  },
  award_eco: {
    title: 'Green Samaritan',
    subtitle: 'Highest public reputation and investments in renewables & parks',
    valueReplace: [/\s*pkt$/i, ' pts'],
  },
  award_stock_shark: {
    title: 'Market Shark',
    subtitle: 'Strongest capital trading, hostile buyouts & financial influence',
    valueReplace: [/\s*pkt$/i, ' pts'],
  },
  award_bailiff: {
    title: 'Bailiff Magnet',
    subtitle: 'Most frequent court bailiff liquidations & seizures',
    valueReplace: [/\s*egzekucji$/i, ' seizures'],
  },
};

export function localizeMatchFunAward<
  T extends { id: string; title: string; subtitle: string; valueLabel: string },
>(award: T, lang: Language): T {
  if (lang === 'pl') return award;
  const en = MATCH_FUN_AWARDS_EN[award.id];
  if (!en) return award;
  const nextVal = en.valueReplace
    ? award.valueLabel.replace(en.valueReplace[0], en.valueReplace[1])
    : award.valueLabel;
  return {
    ...award,
    title: en.title,
    subtitle: en.subtitle,
    valueLabel: nextVal,
  };
}

let plShortToTypeMap: Map<string, keyof typeof BUILDINGS_EN> | null = null;
function mapShortNameToEn(shortName: string): string {
  if (!plShortToTypeMap) {
    plShortToTypeMap = new Map();
    for (const [k, def] of Object.entries(BUILDING_DEFINITIONS)) {
      plShortToTypeMap.set(def.shortName, k as keyof typeof BUILDINGS_EN);
    }
  }
  const bType = plShortToTypeMap.get(shortName);
  return bType ? BUILDINGS_EN[bType]?.shortName ?? shortName : shortName;
}

export function localizeSynergyLabel(label: string, lang: Language): string {
  if (lang === 'pl') return label;
  if (label === 'Smog i Hałas (częściowo osłonięty Parkiem)') {
    return 'Smog & Noise (partially shielded by Park)';
  }
  if (label === 'Smog i Hałas przemysłowy w sąsiedztwie') {
    return 'Nearby industrial Smog & Noise';
  }
  if (label === 'Park Miejski: Ochrona zieleni') {
    return 'City Park: Green Buffer';
  }
  const retailMatch = /^Strefa Kupujących \((.+)\)$/.exec(label);
  if (retailMatch) return `Retail Zone (${mapShortNameToEn(retailMatch[1])})`;
  const entMatch = /^Dzielnica Rozrywki \((.+)\)$/.exec(label);
  if (entMatch) return `Entertainment District (${mapShortNameToEn(entMatch[1])})`;
  const innoMatch = /^Kampus Innowacji \((.+)\)$/.exec(label);
  if (innoMatch) return `Innovation Campus (${mapShortNameToEn(innoMatch[1])})`;
  const clusterMatch = /^Klaster Przemysłowy \((.+)\)$/.exec(label);
  if (clusterMatch) return `Industrial Cluster (${mapShortNameToEn(clusterMatch[1])})`;
  const footfallMatch = /^Napływ Konsumentów \/ Transport \((\d+%)\)$/.exec(label);
  if (footfallMatch) return `Consumer Footfall / Transit (${footfallMatch[1]})`;
  return label;
}
