import type { BuildingType } from '../engine/types';

export interface BuildingTextEn {
  name: string;
  shortName: string;
  description: string;
  strategyHint: string;
  specialEffects: string[];
}

export interface NodeTextEn {
  name: string;
  description: string;
  tradeoffNote: string;
}

export const BUILDINGS_EN: Record<BuildingType, BuildingTextEn> = {
  quarry: {
    name: 'Stone Quarry',
    shortName: 'Quarry',
    description: 'Low-cost gravel and aggregate extraction for roads and prefab construction.',
    strategyHint: 'Great budget starter for construction chains and expanding your private road network.',
    specialEffects: ['Operates without rare mineral deposits on mountains, plains, or deserts'],
  },
  coalMine: {
    name: 'Coal Mine',
    shortName: 'Coal Mine',
    description: 'Extracts bituminous coal for steel mills, copper smelters, and coal power plants.',
    strategyHint: 'Cheap fuel backbone for early coal power or B2B sales to heavy smelters.',
    specialEffects: ['Extracts Coal', 'Lowers appeal of nearby hotels'],
  },
  ironMine: {
    name: 'Iron Ore Mine',
    shortName: 'Iron Mine',
    description: 'Extracts raw iron ore — an essential feedstock for steelmaking.',
    strategyHint: 'Pair with a Coal Mine and Steel Mill for an integrated industrial chain.',
    specialEffects: ['Extracts Iron Ore'],
  },
  copperMine: {
    name: 'Copper Mine',
    shortName: 'Copper Mine',
    description: 'Extracts copper ore vital for power grids, cables, and electronics manufacturing.',
    strategyHint: 'Indispensable for electronics, power cables, and semiconductor fabs.',
    specialEffects: ['Essential feedstock for cable and electronics industries'],
  },
  goldMine: {
    name: 'Gold Mine',
    shortName: 'Gold Mine',
    description: 'Extracts pure gold — a financial safe haven and luxury jewelry feedstock.',
    strategyHint: 'Gold holds strong value during recessions and fuels luxury jewelry salons.',
    specialEffects: ['Extracts Gold insulated against market downturns'],
  },
  oilWell: {
    name: 'Oil Derrick',
    shortName: 'Oil Well',
    description: 'Pumps crude oil — the base for fuel, industrial chemicals, and logistics costs.',
    strategyHint: 'Protects your empire against fuel shocks and boosts refinery margins.',
    specialEffects: ['Key fuel feedstock for the economy'],
  },
  rareMetalsMine: {
    name: 'Rare Earths Mine',
    shortName: 'Rare Metals',
    description: 'Extracts rare earth elements for semiconductors, jewelry, and aerospace electronics.',
    strategyHint: 'High-tech market bottleneck offering high unit margins.',
    specialEffects: ['Critical input for semiconductors and aerospace'],
  },
  uraniumMine: {
    name: 'Uranium Mine',
    shortName: 'Uranium Mine',
    description: 'Extracts uranium ore for nuclear reactors. Requires HAZMAT oversight.',
    strategyHint: 'Essential foundation for a self-sufficient Nuclear Power Plant monopoly.',
    specialEffects: ['Feeds nuclear fuel enrichment and reactors'],
  },
  waterPlant: {
    name: 'Water Intake & Treatment Station',
    shortName: 'Water Station',
    description: 'Pumps clean industrial water into your network and lowers cooling expenses.',
    strategyHint: 'Safe utility backbone during droughts; sells surplus water to the market.',
    specialEffects: ['Supplies grid water for nearby plants', 'Sensitive to extreme droughts'],
  },
  steelMill: {
    name: 'Steel Mill',
    shortName: 'Steel Mill',
    description: 'Smelts iron ore and coal into structural steel.',
    strategyHint: 'Heart of heavy industry — supplies steel to factories and the commodity market.',
    specialEffects: ['Processes ore into Steel', 'High emissions without scrubbers'],
  },
  copperCablePlant: {
    name: 'Copper Smelter & Cable Works',
    shortName: 'Cable Works',
    description: 'Refines copper into high-voltage transmission cables and grid components.',
    strategyHint: 'Boosts copper margins and stabilizes grid power output (+18 MW net).',
    specialEffects: ['Stabilizes power grid (+18 MW net)', 'Processes Copper into cables'],
  },
  prefabFactory: {
    name: 'Prefabricated Elements Plant',
    shortName: 'Prefab Factory',
    description: 'Turns gravel and steel into ready-to-assemble construction modules.',
    strategyHint: 'Lowers expansion bottlenecks and generates steady B2B construction demand.',
    specialEffects: ['Steady construction margins'],
  },
  oilRefinery: {
    name: 'Oil Refinery',
    shortName: 'Refinery',
    description: 'Distills crude oil into refined fuel and industrial chemicals.',
    strategyHint: 'Highest margins during logistics booms and oil supply crunches.',
    specialEffects: ['Co-produces Fuel and Chemicals simultaneously'],
  },
  chemicalPlant: {
    name: 'Chemical Plant',
    shortName: 'Chemicals',
    description: 'Produces reagents and chemicals. Requires water access and HAZMAT coverage.',
    strategyHint: 'Supplies gold/uranium/rare metal mines and semiconductor fabs.',
    specialEffects: ['High water consumption', 'Chemical leaks require HAZMAT response'],
  },
  jewelryWorkshop: {
    name: 'Jewelry Workshop & Boutique',
    shortName: 'Jewelry Salon',
    description: 'Crafts luxury jewelry from gold and rare metals. Strong synergy with attractions and hotels!',
    strategyHint: 'Huge margins during booms and high voter approval.',
    specialEffects: ['High brand prestige (+reputation)', 'Synergy near Parks, Marinas & Hotels'],
  },
  electronicsFactory: {
    name: 'Electronics Factory',
    shortName: 'Electronics',
    description: 'Assembles high-tech electronics from semiconductors, copper, gold, and chemicals.',
    strategyHint: 'High value-added manufacturing on a compact footprint.',
    specialEffects: ['Clean high-tech industry'],
  },
  semiconductorFab: {
    name: 'Semiconductor Fab',
    shortName: 'Semiconductors',
    description: 'Ultra-precision silicon lithography requiring copper, rare metals, chemicals, and pure water.',
    strategyHint: 'Modern economy bottleneck — ideal for B2B market dominance!',
    specialEffects: ['Requires Silicon Lithography tech and University'],
  },
  weaponsComplex: {
    name: 'Defense & Armaments Complex',
    shortName: 'Defense Works',
    description: 'Manufactures armaments and tactical systems while boosting Military Pillar strength.',
    strategyHint: 'Core supplier for Corporate Mercenary strategies and defense tenders.',
    specialEffects: ['Supplies Weapons and strengthens Military influence'],
  },
  spaceCenter: {
    name: 'Aerospace & Launch Complex',
    shortName: 'Spaceport',
    description: 'Endgame megaproject turning electronics, fuel, and rare metals into orbital contracts.',
    strategyHint: 'Crown jewel of R&D progression granting immense prestige and cash flow.',
    specialEffects: ['Endgame megaproject', '+4 research pts / tick', 'Massive contract revenue'],
  },
  coalPowerPlant: {
    name: 'Coal Power Plant',
    shortName: 'Coal Plant',
    description: 'Burns coal to generate abundant cheap electricity for your grid and market export.',
    strategyHint: 'Reliable early-game power capacity, though exposed to emissions penalties.',
    specialEffects: ['Affordable early power (+150 MW)', 'Exports surplus power', 'High CO₂ emissions'],
  },
  hydroPowerPlant: {
    name: 'Hydroelectric Dam',
    shortName: 'Hydro Plant',
    description: 'Clean, zero-fuel renewable energy. Requires coastal/river access and is sensitive to droughts!',
    strategyHint: 'Low operating cost, though output drops sharply in severe droughts without retention.',
    specialEffects: ['Zero emissions', 'Highly vulnerable to droughts!'],
  },
  renewableFarm: {
    name: 'Hybrid Renewables Farm (Wind & Solar)',
    shortName: 'Renewables Farm',
    description: 'Zero-emission wind and solar installation with zero fuel dependency.',
    strategyHint: 'Immune to fuel shortages and droughts; boosts public approval.',
    specialEffects: ['Zero emissions', 'Independent of water and fossil fuels'],
  },
  nuclearPowerPlant: {
    name: 'Nuclear Power Plant',
    shortName: 'Nuclear Plant',
    description: 'Massive electricity generator powered by uranium and cooling water. Requires HAZMAT protection.',
    strategyHint: 'Colossal profits and potential to monopolize map-wide electricity supply.',
    specialEffects: ['Huge grid output', 'Requires cooling water and HAZMAT coverage'],
  },
  warehouse: {
    name: 'Commodity Warehouse (Speculative)',
    shortName: 'Warehouse',
    description: 'Stores commodity stockpiles ahead of newspaper-forecasted price spikes and shields against shortages.',
    strategyHint: 'Accumulate cheap oil, steel, or chips and liquidate at market peaks!',
    specialEffects: ['Expands empire storage capacity', 'Buffer shield against supply crunches'],
  },
  cargoPort: {
    name: 'Cargo Seaport (Shipping Fleet)',
    shortName: 'Cargo Port',
    description: 'Connects river-split shores via freighters hauling bulk coal, ore, oil, and steel.',
    strategyHint: 'Bypasses missing bridges — ideal for heavy raw materials.',
    specialEffects: ['Unlocks maritime cargo fleet (animated ships)', 'Connects isolated shores'],
  },
  cargoAirport: {
    name: 'Cargo Air Hub',
    shortName: 'Cargo Airport',
    description: 'Rapid air freight bypassing rival roadblockades, missing roads, and rivers!',
    strategyHint: 'Complete logistics independence for gold, jewelry, electronics, chips, and urgent B2B.',
    specialEffects: ['Bypasses rival road blockades (animated planes)', '+15% margin on high-tech freight'],
  },
  hotel: {
    name: 'Business Hotel',
    shortName: 'Hotel',
    description: 'Earns steady revenue scaled by local appeal. Gains large bonuses beside parks and marinas!',
    strategyHint: 'Build in clean zones and cluster beside Attractions.',
    specialEffects: ['Revenue scales with tile appeal and nearby Attractions'],
  },
  resort: {
    name: 'Luxury Coastal Resort',
    shortName: 'Resort',
    description: 'Upscale leisure complex with huge synergy near Marinas and Amusement Parks.',
    strategyHint: 'Major revenue and elite influence when kept clear of heavy industry.',
    specialEffects: ['Very high yields in clean districts', 'Generates elite influence'],
  },
  officeTower: {
    name: 'Class-AAA Office Tower (Helipad)',
    shortName: 'Office Tower',
    description: 'Modern glass skyscraper generating stable corporate leasing income.',
    strategyHint: 'Cornerstone of real-estate strategy in dense urban hubs.',
    specialEffects: ['Stable lease cashflow insulated from commodity swings'],
  },
  shoppingMall: {
    name: 'Shopping Mall',
    shortName: 'Mall',
    description: 'Large-format retail powerhouse fueled by positive consumer and voter sentiment.',
    strategyHint: 'Thrives in cheerful consumer booms and transit hubs.',
    specialEffects: ['Profits rise with higher voter approval'],
  },
  amusementPark: {
    name: 'Amusement Park',
    shortName: 'Theme Park',
    description: 'Boosts nearby hotels, resorts, and jewelry salons while raising land values!',
    strategyHint: 'Place beside your hotels and malls for strong district synergy and voter goodwill.',
    specialEffects: ['+25% revenue for nearby hotels/jewelry', 'Raises land values and voter approval'],
  },
  culturalCenter: {
    name: 'Congress & Cultural Center',
    shortName: 'Culture Center',
    description: 'Prestigious concert and conference hall boosting urban hotels, offices, and boutiques.',
    strategyHint: 'Ideal in urban cores — elevates corporate reputation and voter mood.',
    specialEffects: ['Synergy with hotels, offices, and jewelers', '+0.4 voter approval / tick'],
  },
  marinaPromenade: {
    name: 'Seaside Marina & Promenade',
    shortName: 'Marina',
    description: 'Waterfront yacht promenade creating an exclusive coastal tourism district.',
    strategyHint: 'Build on coastal plots beside Resorts and Jewelry Salons for massive multipliers.',
    specialEffects: ['Strongly boosts coastal resort and hotel yields'],
  },
  investmentBank: {
    name: 'Investment Bank & Brokerage',
    shortName: 'Invest. Bank',
    description: 'Earns capital market commissions, lowers credit rates, and strengthens the Financial Pillar.',
    strategyHint: 'Capital multiplier for mature corporate conglomerates.',
    specialEffects: ['+2 Financial influence / 5 ticks', 'Cheaper credit access'],
  },
  mediaAgency: {
    name: 'Media Conglomerate Agency',
    shortName: 'Media Agency',
    description: 'Monetizes advertising while shaping public debate, media control, and voter mood.',
    strategyHint: 'Core Gray Eminence building — steer public opinion and pressure rivals.',
    specialEffects: ['Passively boosts media control and social influence'],
  },
  highSchool: {
    name: 'Technical High School',
    shortName: 'Tech School',
    description: 'Trains skilled technicians, eases wage pressure, and generates research points.',
    strategyHint: 'Prevents skilled labor shortages before payroll costs erode your margins!',
    specialEffects: ['+2 research pts / tick', 'Eases map-wide labor shortage (-12%)'],
  },
  university: {
    name: 'Technical University',
    shortName: 'University',
    description: 'Primary engine for global tech trees, engineers, and medical specialists.',
    strategyHint: 'Prerequisite for Corporate Group expansion, HAZMAT, Nuclear, and Space.',
    specialEffects: ['+6 research pts / tick', 'Sharply reduces skilled labor shortages (-22%)'],
  },
  rdLab: {
    name: 'R&D Research Lab',
    shortName: 'R&D Lab',
    description: 'Private corporate laboratory generating heavy research points and industrial patents.',
    strategyHint: 'Unlocks Megacorporation (Tier 5), HAZMAT shields, and Cargo Air hubs.',
    specialEffects: ['+9 research pts / tick', 'Powered by electronics and chemicals'],
  },
  hospital: {
    name: 'Corporate Hospital & Clinic',
    shortName: 'Hospital',
    description: 'Maintains an ambulance fleet dispatched by road across the map; cuts HR absenteeism.',
    strategyHint: 'Add ambulances and unlock Air Medevac to cover roadless outposts!',
    specialEffects: ['Map-wide road ambulance fleet', '+12% HR efficiency', '+voter approval'],
  },
  fireStation: {
    name: 'Fire Station',
    shortName: 'Fire Dept.',
    description: 'Dispatches fire engines across roads and highways to extinguish fires map-wide.',
    strategyHint: 'Build highways and expand fleet garages to save distant mines rapidly.',
    specialEffects: ['Road-dispatched fire engines map-wide', 'Highways reduce response damage'],
  },
  hazmatBase: {
    name: 'HAZMAT Response Base',
    shortName: 'HAZMAT Base',
    description: 'Specialized mobile response fleet tackling chemical leaks and radiological hazards map-wide.',
    strategyHint: 'Essential before running chemical, semiconductor, or nuclear sites without catastrophic fines.',
    specialEffects: ['Mobile HAZMAT fleet map-wide (roads & highways)'],
  },
  policeStation: {
    name: 'Security & Police HQ (PPP)',
    shortName: 'Police / Sec.',
    description: 'Dispatches patrol cruisers map-wide, reducing heists on casinos/banks and blocking espionage.',
    strategyHint: 'Crucial near casinos, jewelers, and against aggressive spy networks!',
    specialEffects: ['Animated police patrols map-wide', 'Lowers robbery risk & counters rival spies'],
  },
  lobbyOffice: {
    name: 'Corporate Lobbying Office',
    shortName: 'Lobby Office',
    description: 'Hires former officials and legal strategists for passive Financial Pillar growth.',
    strategyHint: 'Lay legislative groundwork for Market Laws and Forced Buyouts.',
    specialEffects: ['Passively builds financial influence', 'Strengthens parliamentary lobbying'],
  },
  churchFoundation: {
    name: 'Social & Church Foundation',
    shortName: 'Social Found.',
    description: 'Civic and religious outreach calming labor unrest and cultivating conservative voter support.',
    strategyHint: 'Quietly stabilizes workforce morale and builds social influence.',
    specialEffects: ['Passively raises Church & Voter support', 'Calms industrial strikes'],
  },
  intelligenceCenter: {
    name: 'Intelligence & Spec-Ops Center',
    shortName: 'Intel Center',
    description: 'Headquarters for corporate counterintelligence, cybersecurity, and raid defense.',
    strategyHint: 'Shields assets against sabotage and boosts Military Pillar strength.',
    specialEffects: ['+8 military strength & sabotage defense', '+2 research pts / tick'],
  },
  corporateHQ: {
    name: 'Corporate Headquarters (HQ)',
    shortName: 'Corporate HQ',
    description: 'Prestigious executive citadel (max 1 per firm) that evolves architecturally with Corp Level!',
    strategyHint: 'Cuts administrative overhead and anchors your primary road dispatch network.',
    specialEffects: ['2.5D visual evolves across Corp Tiers (1->5)', 'Central corporate road anchor'],
  },
  casino: {
    name: 'Grand Casino Complex',
    shortName: 'VIP Casino',
    description: 'Generates high cash revenue beside hotels, though raises crime and upsets conservative factions.',
    strategyHint: 'Place beside Police HQ and Hotels to capture maximum profits without heist losses!',
    specialEffects: ['Huge cash yield (+Hotel/Resort/Jewelry synergy)', 'Raises crime (needs Police) & lowers Church mood'],
  },
  militaryBase: {
    name: 'PMC Military Base (Private Army)',
    shortName: 'PMC Base',
    description: 'Private corporate army supplied by arms and fuel. Requires 75%+ approval. Unlocks 3x3 Tactical Missile at Flagship!',
    strategyHint: 'Cannot be rushed early — demands 75%+ political backing, unlocking 3x3 missiles and nuclear prerequisites.',
    specialEffects: ['Requires min. 75% political/voter approval', 'Flagship unlocks 3x3 Tactical Missile', 'Prerequisite for secret Nuclear Program'],
  },
  windFarm: {
    name: 'Wind Farm',
    shortName: 'Wind Farm',
    description: 'Zero-emission wind turbines with zero fuel cost; output fluctuates slightly with wind.',
    strategyHint: 'Low upkeep, zero pollution fines, and solid voter goodwill.',
    specialEffects: ['Zero emissions', 'Boosts voter approval', 'Slightly weather-dependent'],
  },
  solarFarm: {
    name: 'Solar PV Park',
    shortName: 'Solar Park',
    description: 'Clean photovoltaic power field peaking on sunny deserts and plains.',
    strategyHint: 'Excels in deserts; pair with battery storage for round-the-clock stability.',
    specialEffects: ['Zero emissions', '+20% sunlight bonus in deserts', 'Drops in cloudy weather'],
  },
  gasPowerPlant: {
    name: 'Combined-Cycle Gas Plant',
    shortName: 'Gas Plant',
    description: 'High, steady power output stabilizing the grid with far lower emissions than coal.',
    strategyHint: 'Ideal bridge generator before Nuclear and Fusion — strong MW capacity.',
    specialEffects: ['High reliable capacity (195 MW)', '3x cleaner than coal plants'],
  },
  geothermalPlant: {
    name: 'Geothermal Power Plant',
    shortName: 'Geothermal',
    description: 'Costly upfront yet ultra-reliable zero-emission deep earth power immune to weather.',
    strategyHint: 'Most dependable clean power on mountain and coastal plots.',
    specialEffects: ['Zero emissions & weather-proof', 'Requires mountain or coastal terrain'],
  },
  fusionReactor: {
    name: 'Thermonuclear Fusion Reactor',
    shortName: 'Fusion Reactor',
    description: 'Peak energy engineering: produces immense zero-emission power from lithium and water.',
    strategyHint: 'Dominate energy across huge maps with zero nuclear meltdown risk.',
    specialEffects: ['Massive clean power (1200 MW)', 'Zero emissions', 'Requires Lithium & R&D'],
  },
  sewagePlant: {
    name: 'Wastewater Treatment Plant',
    shortName: 'Sewage Plant',
    description: 'Treats industrial wastewater from factories, hotels, and hospitals. Can be built on forests.',
    strategyHint: 'Prevents sanitation crises, worker illness, and steep voter penalties.',
    specialEffects: ['Treats 140 m³ sewage / tick', 'Buildable on forests', 'Recovers water'],
  },
  wasteIncinerator: {
    name: 'Waste-to-Energy Incinerator',
    shortName: 'Incinerator',
    description: 'Cheaply disposes huge waste volumes and generates electricity, but heavily pollutes the district!',
    strategyHint: 'Budget waste fix on remote land — watch out for eco fines and angry voters!',
    specialEffects: ['Burns 160 t waste / tick & outputs +42 MW', 'Buildable on forests', 'WARNING: Heavy smog & voter penalty!'],
  },
  recyclingPlant: {
    name: 'Advanced Recycling Plant',
    shortName: 'Recycling',
    description: 'Clean alternative to incinerators: boosts voter approval and recovers Steel, Copper, Rare Metals & Lithium!',
    strategyHint: 'Pricier upfront, yet yields free strategic metals straight into your warehouse in closed MP!',
    specialEffects: ['Processes 150 t waste / tick (+voter mood)', 'Buildable on forests', 'Recovers steel, copper, rare metals & lithium!'],
  },
  uraniumEnrichment: {
    name: 'Uranium Enrichment Facility',
    shortName: 'Uranium Enrich.',
    description: 'Refines uranium ore into enriched nuclear fuel — essential for the secret Nuclear Program!',
    strategyHint: 'Pair near a HAZMAT Base and University — key to warheads or enriched fuel export.',
    specialEffects: ['Prerequisite for Secret Nuclear Program', 'Multiplies uranium fuel output'],
  },
  coldStorage: {
    name: 'Cold Storage & Multimodal Logistics Hub',
    shortName: 'Logistics Hub',
    description: 'Massive speculative buffer shielding your corporation against crashes and input shortages.',
    strategyHint: 'Cuts freight friction and multiplies speculative storage capacity by 10x.',
    specialEffects: ['Massive stock buffer (2400 u)', 'Road logistics transfer point'],
  },
  diamondMine: {
    name: 'Diamond Mine',
    shortName: 'Diamond Mine',
    description: 'Extracts ultra-rare kimberlite diamonds. Huge unit value yet volatile in bubbles and crashes!',
    strategyHint: 'Requires Georadar discovery and Deep Extraction research.',
    specialEffects: ['Extracts high-margin Diamonds'],
  },
  lithiumMine: {
    name: 'Lithium Brine Mine',
    shortName: 'Lithium Mine',
    description: 'Extracts battery-grade lithium from brines and rock for EV factories and Fusion Reactors.',
    strategyHint: 'Core upstream partner for EV Battery Gigafactories under green laws.',
    specialEffects: ['Extracts Lithium for EV Batteries and Fusion'],
  },
  batteryFactory: {
    name: 'EV Lithium Battery Gigafactory',
    shortName: 'Battery Factory',
    description: 'Processes Lithium, Copper, and Chemicals into EV Batteries while boosting green approval.',
    strategyHint: 'High margins during green transitions; partner with Lithium & Copper producers in MP.',
    specialEffects: ['Produces EV Batteries (+16 MW grid support)', 'Green transition reputation boost'],
  },
  jewelryLuxury: {
    name: 'Diamond Jewelry & Quantum Optics House',
    shortName: 'Luxury Diamonds',
    description: 'Refines Diamonds, Gold, and Rare Metals into ultra-luxury jewelry and precision optics.',
    strategyHint: 'Explosive boom profits, though exposed to luxury market busts.',
    specialEffects: ['Highest luxury/optics margin', 'Synergy with Casinos, Resorts & Marinas'],
  },
  busDepot: {
    name: 'City Bus Depot',
    shortName: 'Bus Depot',
    description: 'Launches animated municipal bus fleets boosting local shopper foot traffic (+22% within 4 tiles).',
    strategyHint: 'Affordable early booster in Shopping Districts beside Malls, Hotels & Restaurants.',
    specialEffects: ['+22% Local Demand within 4 road tiles', 'Animated road buses + fare revenue'],
  },
  metroStation: {
    name: 'Subway / Metro Station',
    shortName: 'Metro Station',
    description: 'Congestion-proof underground transit driving massive footfall into Malls, Casinos & Offices.',
    strategyHint: 'Build in urban cores — delivers up to +55% passenger demand within 5 tiles.',
    specialEffects: ['+42% Local Demand within 5 tiles (traffic-proof)', 'Strong synergy with Malls, Casinos & Offices'],
  },
  trainStation: {
    name: 'Intercity Passenger Rail Station',
    shortName: 'Train Station',
    description: 'Regional rail hub bringing tourists, shoppers, and specialists from across the map.',
    strategyHint: 'Lifts global passenger demand for hotels, resorts, retail, and attractions map-wide!',
    specialEffects: ['+16% global passenger demand empire-wide', 'Extra local hotel/mall bonus within 5 tiles'],
  },
  passengerTerminal: {
    name: 'International VIP Air Terminal',
    shortName: 'VIP Terminal',
    description: 'International passenger terminal flying affluent VIP travelers directly into your districts.',
    strategyHint: 'Massive synergy with Casinos, Resorts, Luxury Diamond Houses, and Arenas.',
    specialEffects: ['+28% global passenger demand & +50% VIP tier boost', 'VIP synergy with Casino, Resort & Luxury Jewelry'],
  },
  apartmentComplex: {
    name: 'Residential Apartment Complex',
    shortName: 'Apartments',
    description: 'Modern urban housing supplying skilled HR staff and local consumers. Sensitive to heavy smog.',
    strategyHint: 'Build away from heavy mills or shield with a City Park to feed Malls & Dining!',
    specialEffects: ['Boosts nearby retail & dining customer base (+20%)', 'Lifts voter approval & labor supply'],
  },
  gastronomyBoulevard: {
    name: 'Culinary Boulevard & Dining',
    shortName: 'Dining Strip',
    description: 'Vibrant restaurant district forming Buyer Zones beside Malls, Hotels, Apartments & Casinos.',
    strategyHint: 'Multiplies neighboring retail income and thrives near Bus Depots and Metro Stations!',
    specialEffects: ['Buyer Zone core (+15%..+30% nearby retail)', 'High sensitivity to Transit Demand'],
  },
  cityPark: {
    name: 'City Park & Botanical Garden',
    shortName: 'City Park',
    description: 'Green urban lungs neutralizing up to 60% of nearby smog/noise penalties while boosting appeal!',
    strategyHint: 'Place between factories and hotels/apartments to protect their profits!',
    specialEffects: ['Neutralizes smog & noise penalties within 2 tiles', 'Boosts tile appeal (+14) and voter mood'],
  },
  arenaStadium: {
    name: 'Entertainment Arena & Stadium',
    shortName: 'Arena / Stadium',
    description: 'Multi-purpose concert and sports arena generating huge ticket yields and Entertainment District synergy.',
    strategyHint: 'Pair beside Hotels, Resorts, Casinos & Metro for the top-earning Entertainment hub!',
    specialEffects: ['Entertainment District core (+24% beside hotels/casinos)', 'Boosts voter approval & prestige'],
  },
  conventionCenter: {
    name: 'Convention & Trade Expo Center',
    shortName: 'Expo Center',
    description: 'International exhibition halls bridging B2B commerce, tech conferences, and business travel.',
    strategyHint: 'Strong synergy with Hotels, Offices, Rail Stations, and VIP Air Terminals.',
    specialEffects: ['Bridges Entertainment & Business zones (+18% synergy)', 'Boosts finance influence & B2B visibility'],
  },
  lawFirm: {
    name: 'Corporate Law & M&A Firm',
    shortName: 'Law Firm',
    description: 'Specialists in M&A, tax law, and antitrust shielding against hostile takeovers and lowering CIT.',
    strategyHint: 'Cuts corporate taxes and raises formidable defenses against share & plot buyouts!',
    specialEffects: ['Strengthens legal shield against hostile buyouts', 'Lowers CIT rate & regulatory fine risks'],
  },
  prAgency: {
    name: 'PR & Brand Marketing Agency',
    shortName: 'PR Agency',
    description: 'Protects corporate image against boycotts and strikes while boosting consumer demand.',
    strategyHint: 'Affordable voter-approval shield before strikes and great support for retail zones.',
    specialEffects: ['Shields against boycotts & strikes', 'Boosts Buyer Zones & corporate reputation'],
  },
  dataCenter: {
    name: 'Cloud AI Data Center',
    shortName: 'Data Center',
    description: 'Massive AI server complex drawing heavy power and cooling water while earning B2B cloud & R&D points.',
    strategyHint: 'Build beside University or R&D Lab to unlock the Innovation Campus (+25% research speed & output)!',
    specialEffects: ['Generates +7 R&D pts / tick & stable B2B cloud income', 'Forms Innovation Campus with University & R&D Lab'],
  },
  biotechLab: {
    name: 'Biotech & Pharma Lab',
    shortName: 'Biotech / Pharma',
    description: 'High-margin pharmaceutical synthesis from chemicals. Supports workforce health (HAZMAT advised).',
    strategyHint: 'Guard with a HAZMAT Base and cluster in an Innovation Campus beside R&D Labs.',
    specialEffects: ['High pharma margin & voter approval boost', 'Synergy inside Innovation Campus (Uni/R&D)'],
  },
  verticalFarm: {
    name: 'Vertical Hydroponic Farm',
    shortName: 'Vertical Farm',
    description: 'Multi-tier LED hydroponics running on closed-loop water with zero emissions — beautifies districts!',
    strategyHint: 'Pairs cleanly beside Dining Strips and Apartments; minimal water footprint!',
    specialEffects: ['Clean urban production (+10% nearby dining & housing)', 'Ultra-low water use & positive voter image'],
  },
  compositeShipyard: {
    name: 'Composites Plant & Shipyard',
    shortName: 'Shipyard',
    description: 'Coastal industrial complex crafting vessels and carbon composites from steel and chemicals.',
    strategyHint: 'Place on coasts inside Industrial Clusters to unlock high-value export contracts.',
    specialEffects: ['Converts Steel & Chemicals into Prefabs & Marine Electronics', 'Boosts Industrial Clusters & Cargo Ports'],
  },
  wasteLandfill: {
    name: 'Basic Landfill & Sorting Yard',
    shortName: 'Landfill Yard',
    description: 'Cheapest early waste buffer (+80 t capacity) using minimal power, slightly lowering nearby residential appeal.',
    strategyHint: 'Affordable early waste solution — place away from hotels, apartments, and parks.',
    specialEffects: ['Handles +80 t waste / tick using just 4 MW', 'Available at Tier 1 on Plains, Forests & Deserts', 'Slightly reduces nearby residential/hotel appeal'],
  },
  bioSewagePlant: {
    name: 'Biological Sewage Treatment',
    shortName: 'Bio Sewage Plant',
    description: 'Mid-tier activated-sludge biological treatment (+280 m³) with zero odor penalties or appeal loss.',
    strategyHint: 'Safe near urban zones — strong mid-game upgrade over starter treatment plants.',
    specialEffects: ['Treats +280 m³ sewage / tick & returns +28 m³ water', 'Zero emissions & no neighbor appeal penalty'],
  },
  closedLoopSewagePlant: {
    name: 'Closed-Loop Membrane Sewage Plant',
    shortName: 'Closed-Loop Water',
    description: 'Endgame membrane recovery plant handling +500 m³ sewage and reclaiming +120 m³ ultra-pure process water!',
    strategyHint: 'Requires University & Retention tech. Protects late-game megacorps from droughts.',
    specialEffects: ['+500 m³ sewage capacity / tick & +120 m³ reclaimed water', 'Zero emissions drought shield'],
  },
  plasmaGasificationPlant: {
    name: 'Plasma Gasification Plant (Zero-Waste)',
    shortName: 'Plasma Zero-Waste',
    description: 'Endgame plasma arc facility destroying +400 t waste cleanly while outputting +85 MW & recovering Rare Metals, Copper & Steel!',
    strategyHint: 'Requires R&D Lab & Recycling — replaces smoky incinerators cleanly in endgame.',
    specialEffects: ['Destroys +400 t waste / tick with zero pollution or voter penalty', 'Outputs +85 MW clean power & recovers Rare Metals, Copper & Steel'],
  },
  monumentFountain: {
    name: 'Corporate Fountain Plaza (2.5D)',
    shortName: 'VIP Fountain',
    description: 'Prestige 2.5D water plaza with identical stats to City Park (100% Zero Pay-to-Win).',
    strategyHint: 'Place near luxury hotels or HQ to neutralize smog and showcase prestige.',
    specialEffects: ['Identical stats to City Park (Zero P2W)', 'Neutralizes nearby smog & noise'],
  },
  monumentObelisk: {
    name: 'Wall Street Obelisk (2.5D)',
    shortName: 'Market Obelisk',
    description: 'Monumental granite exchange obelisk with identical stats to City Park (Zero Pay-to-Win).',
    strategyHint: 'Showcases prestige in financial districts while cleansing urban air.',
    specialEffects: ['Identical stats to City Park (Zero P2W)', 'Neutralizes nearby smog & noise'],
  },
  monumentHelipad: {
    name: 'Private Executive Helipad (2.5D)',
    shortName: 'VIP Helipad',
    description: 'Exclusive executive landing pad with identical stats to City Park (Zero Pay-to-Win).',
    strategyHint: 'Matches City Park economics while showcasing Season prestige.',
    specialEffects: ['Identical stats to City Park (Zero P2W)', 'Neutralizes nearby smog & noise'],
  },
  monumentFounder: {
    name: 'Golden Founder Statue (2.5D)',
    shortName: 'Founder Statue',
    description: 'Season 1 Finale prestige statue with identical stats to City Park (Zero Pay-to-Win).',
    strategyHint: 'Crown monument beside Corporate HQ with full City Park ecological benefits.',
    specialEffects: ['Identical stats to City Park (Zero P2W)', 'Neutralizes nearby smog & noise'],
  },
};

const MINING_CLEAN_FILTER_EN: Record<string, string> = {
  quarry: 'Dust-Suppression Water Sprays',
  coal: 'Methane Scrubbers & Dust Collectors',
  iron: 'Low-Noise Crushers & Particulate Filters',
  copper: 'Zero-Tailings Flotation System',
  gold: 'Cyanide-Free Clean Extraction',
  oil: 'Hermetic Wellhead Sealing',
  rare: 'Closed-Loop Hydrometallurgy',
  uranium: 'Radiation Shielding & HEPA Filtration',
  diamond: 'Dustless Kimberlite Separation',
  lithium: 'Closed-Loop Brine Evaporation',
};

const EXPLICIT_NODES_EN: Record<string, NodeTextEn> = {
  // waterPlant (5)
  water_deep: {
    name: 'Deep Artesian Wells (Anti-Drought)',
    description: 'Taps underground aquifers independent of surface river levels.',
    tradeoffNote: 'Protects intake from droughts and adds +35% water output.',
  },
  water_smart: {
    name: 'Automated Pressure Valves',
    description: 'Reduces required shift staffing and pipeline leakage losses.',
    tradeoffNote: '-40% staffing payroll, +15% electricity use.',
  },
  water_tariff: {
    name: 'Priority Industrial Contracts',
    description: 'Long-term water delivery tariffs for cooling towers and chemical plants.',
    tradeoffNote: '+35% water supply revenue.',
  },
  water_recycle: {
    name: 'Reverse Osmosis & Brine Recovery',
    description: 'Reclaims industrial process water in a closed loop while cutting pump power draw.',
    tradeoffNote: '+30% treatment yield, -20% power, -18% upkeep.',
  },
  water_apex: {
    name: 'Metropolitan Aqueduct & Membrane Hub (Flagship Project)',
    description: 'Regional water backbone sustaining factories and districts through prolonged droughts.',
    tradeoffNote: 'Flagship Project: +75% water supply, -25% costs, +25 social influence, drought shield.',
  },

  // spaceCenter (5)
  space_reusable: {
    name: 'Reusable Launch Vehicles',
    description: 'Slashes propellant and component consumption on every orbital mission.',
    tradeoffNote: '-35% input & upkeep costs, +25% mission revenue.',
  },
  space_sat_monopoly: {
    name: 'Commercial Satellite Constellation',
    description: 'Global monopoly over orbital broadband and earth-observation feeds.',
    tradeoffNote: '+55% revenue and +25 social influence.',
  },
  space_methalox: {
    name: 'Next-Gen Methalox Engines',
    description: 'Cleaner cryogenic methane burn cuts turnaround wear and launch pad soot.',
    tradeoffNote: '-20% launch costs, -25% pad wear rate.',
  },
  space_cryo_depot: {
    name: 'Orbital Cryogenic Propellant Depot',
    description: 'Low-Earth-orbit refueling stations accelerate deep-space research missions.',
    tradeoffNote: '+30% revenue, +35% research speed, 2x buffer capacity.',
  },
  space_apex: {
    name: 'Deep-Space Orbital Complex (Flagship Project)',
    description: 'Asteroid mining logistics and global orbital telecommunications monopoly.',
    tradeoffNote: 'Flagship Project: +90% revenue, +70 influence, +80% research points.',
  },

  // coalPowerPlant (5)
  coalpwr_supercritical: {
    name: 'Ultra-Supercritical Boilers',
    description: 'Higher thermal efficiency extracting more megawatts per ton of coal.',
    tradeoffNote: '+35% power output, but +15% water draw and +30% boiler wear.',
  },
  coalpwr_ccs: {
    name: 'Flue-Gas Desulfurization & CCS',
    description: 'Captures CO₂ and sulfur exhaust to shield against environmental fines.',
    tradeoffNote: 'Cuts emissions by 70% and prevents civic protests.',
  },
  coalpwr_auto: {
    name: 'Digital Grid Load Dispatch',
    description: 'Automates boiler balancing and cuts round-the-clock shift headcount.',
    tradeoffNote: '-30% staffing and -12% maintenance cost.',
  },
  coalpwr_fluidized: {
    name: 'Fluidized-Bed Steam Injection',
    description: 'Cleaner low-particulate combustion while maintaining steady baseload power.',
    tradeoffNote: '+28% MW capacity, -15% fuel cost.',
  },
  coalpwr_apex: {
    name: 'Zero-Emission IGCC Superblock (Flagship Project)',
    description: 'Closed-loop coal gasification with full waste-heat cogeneration.',
    tradeoffNote: 'Flagship Project: +60% MW capacity, full scrubbers, -30% costs, 2.5D upgrade!',
  },

  // hydroPowerPlant (5)
  hydro_reservoir: {
    name: 'Upstream Retention Basin',
    description: 'Stores reserve river water ahead of seasonal dry spells.',
    tradeoffNote: 'Shields dam against 65% of drought output losses.',
  },
  hydro_kaplan: {
    name: 'High-Efficiency Kaplan Turbines',
    description: 'Extracts maximum torque even during lower river flow periods.',
    tradeoffNote: '+40% power generation.',
  },
  hydro_pumped: {
    name: 'Pumped-Storage Peaking Loop',
    description: 'Stores cheap off-peak energy uphill and unleashes peak grid capacity.',
    tradeoffNote: '+32% MW capacity & full blackout protection.',
  },
  hydro_sediment: {
    name: 'Automated Silt Sluices & Flow Sensors',
    description: 'Protects turbine blades from river silt and lowers structural upkeep.',
    tradeoffNote: '-25% upkeep cost and slower turbine wear.',
  },
  hydro_apex: {
    name: 'AI HydroGrid Mega-Dam (Flagship Project)',
    description: 'Smart turbine orchestration and deep retention resilient to any climate swing.',
    tradeoffNote: 'Flagship Project: +65% MW capacity, full drought shield, 2.5D upgrade!',
  },

  // renewableFarm (5)
  oze_battery: {
    name: 'Grid-Scale LFP Battery Packs',
    description: 'Smooths intermittency spikes and stabilizes continuous grid delivery.',
    tradeoffNote: '+35% power capacity & full blackout immunity.',
  },
  oze_perovskite: {
    name: 'Perovskite Cells & Wind AI Trackers',
    description: 'Higher solar conversion efficiency coupled with yaw-tracking turbines.',
    tradeoffNote: '+25% output, -20% servicing expense.',
  },
  oze_inverter: {
    name: 'Grid-Forming Smart Inverters',
    description: 'Supplies synthetic grid inertia, boosting reliability and green standing.',
    tradeoffNote: '+25% MW output, +12 social influence.',
  },
  oze_microgrid: {
    name: 'Drone Inspection & Wash Bots',
    description: 'Autonomous blade and panel upkeep without halting generation.',
    tradeoffNote: '-22% maintenance costs, -25% wear rate.',
  },
  oze_apex: {
    name: 'Smart-Grid Renewables Park (Flagship Project)',
    description: 'Integrated renewables complex with utility storage and AI load forecasting.',
    tradeoffNote: 'Flagship Project: +70% power and full weather & blackout immunity.',
  },

  // nuclearPowerPlant (5)
  nuc_gen4: {
    name: 'Gen-IV SMR Closed-Cycle Reactors',
    description: 'Closes the fuel loop to boost output dramatically per kilogram of uranium.',
    tradeoffNote: '+50% MW capacity and -25% nuclear fuel cost.',
  },
  nuc_tariff: {
    name: 'Monopolistic Transmission Tariffs',
    description: 'Captures regional grid wheeling fees and boosts wholesale electricity margins.',
    tradeoffNote: '+35% power sales revenue and +20 financial influence.',
  },
  nuc_drycool: {
    name: 'Dry-Cycle Cooling Towers',
    description: 'Prevents reactor throttling during severe river droughts.',
    tradeoffNote: '-60% water draw and full drought protection.',
  },
  nuc_grid_mux: {
    name: 'HVDC National Transmission Dispatch',
    description: 'Eliminates long-line transmission losses and stabilizes grid pricing.',
    tradeoffNote: '+22% power revenue, -15% cost & blackout shield.',
  },
  nuc_apex: {
    name: 'Gen-IV Nuclear Complex (Flagship Project)',
    description: 'Closed fuel cycle with dry cooling and redundant containment safety.',
    tradeoffNote: 'Flagship Project: +75% MW output, +35 influence, full drought & blackout immunity!',
  },

  // warehouse (5)
  wh_highbay: {
    name: 'Automated High-Bay Racking',
    description: 'Triples bulk commodity storage density on the same plot.',
    tradeoffNote: '3x storage capacity.',
  },
  wh_wms: {
    name: 'Automated WMS Robotics',
    description: 'Cuts handling payroll and prevents commodity shrinkage.',
    tradeoffNote: '-40% staffing and -25% upkeep costs.',
  },
  wh_crossdock: {
    name: 'Express Cross-Docking Bays',
    description: 'Accelerates truck turnaround while expanding buffer reserves.',
    tradeoffNote: '+35% logistics revenue & 4x warehouse capacity.',
  },
  wh_hedging: {
    name: 'Futures & Inventory Arbitrage Desk',
    description: 'Synchronizes warehouse drawdowns with exchange price signals.',
    tradeoffNote: '+30% profit, -18% upkeep, +10 influence.',
  },
  wh_apex: {
    name: 'Quantum Automated Logistics Hub (Flagship Project)',
    description: 'Ultra-dense robotic commodity vault running at minimal overhead.',
    tradeoffNote: 'Flagship Project: 5x capacity, -45% costs, +40% revenue.',
  },

  // cargoPort (5)
  port_cranes: {
    name: 'Ship-to-Shore Container Cranes',
    description: 'Doubles berth loading throughput and port freight income.',
    tradeoffNote: '+65% sea freight revenue and 2x port buffer.',
  },
  port_lng: {
    name: 'Low-Emission LNG Freighters',
    description: 'Slashes vessel fuel burn and marine dock operating expenses.',
    tradeoffNote: '-35% fuel and maintenance expenses.',
  },
  port_dredging: {
    name: 'Deep-Draft Panamax Channel',
    description: 'Welcomes mega bulk carriers regardless of ocean tides.',
    tradeoffNote: '+40% freight revenue & 2.5x quay storage.',
  },
  port_customs: {
    name: 'Free-Trade Zone & AI Customs Gate',
    description: 'Automates export clearances for bulk commodities and finished goods.',
    tradeoffNote: '-22% operating expenses & +15 influence.',
  },
  port_apex: {
    name: 'Global Deepwater Ocean Terminal (Flagship Project)',
    description: 'Automated ultra-max gantry terminal anchoring intercontinental shipping.',
    tradeoffNote: 'Flagship Project: +85% revenue, 3x storage, +20 influence.',
  },

  // cargoAirport (5)
  air_nighthub: {
    name: 'Express Overnight Cargo Sort',
    description: 'Automated air-freight hub for chips, electronics, and bullion.',
    tradeoffNote: '+60% air cargo revenue.',
  },
  air_saf: {
    name: 'High-Efficiency Widebody Freighters',
    description: 'Next-gen turbofans drastically lower aviation fuel burn.',
    tradeoffNote: '-30% fuel and upkeep cost.',
  },
  air_coldchain: {
    name: 'High-Tech Vault & Cleanroom Terminal',
    description: 'Secure climate-controlled bays for wafers, gold, and diamonds.',
    tradeoffNote: '+35% air revenue & 2x terminal capacity.',
  },
  air_ils_cat3: {
    name: 'All-Weather ILS CAT-III Avionics',
    description: 'Allows uninterrupted takeoffs during storms, fog, and grid brownouts.',
    tradeoffNote: 'Blackout immunity, -25% wear rate & -18% costs.',
  },
  air_apex: {
    name: 'Intercontinental SuperCargo Hub (Flagship Project)',
    description: 'Long-range freighter hub bypassing every road and border bottleneck.',
    tradeoffNote: 'Flagship Project: +85% revenue, -35% costs, +25 influence.',
  },

  // hotel (5)
  hotel_budget: {
    name: 'Standardized Business Chain',
    description: 'Modular room turnarounds capture high business volume at low cost.',
    tradeoffNote: '+35% base revenue and -20% servicing cost.',
  },
  hotel_vip: {
    name: 'VIP Executive Suites & Club',
    description: 'Luxury penthouse floors hosting politicians and corporate chairmen.',
    tradeoffNote: '+50% revenue and passive +15 social & financial influence!',
  },
  hotel_eco: {
    name: 'Eco-Hospitality Certification',
    description: 'Smart utility savings appeal to sustainability-conscious travelers.',
    tradeoffNote: '-30% electricity & water draw, +10% efficiency.',
  },
  hotel_loyalty: {
    name: 'Corporate Frequent-Stay Program',
    description: 'Locks in high occupancy even during softer consumer cycles.',
    tradeoffNote: '+30% lease revenue, +10 financial influence.',
  },
  hotel_apex: {
    name: 'Grand Imperium 7-Star Hotel (Flagship Project)',
    description: 'Flagship metropolitan landmark welcoming global financial elites.',
    tradeoffNote: 'Flagship Project: +80% revenue, +30 financial & social influence.',
  },

  // resort (5)
  resort_spa: {
    name: 'Executive Spa & Retreat Wing',
    description: 'Corporate summits boost year-round occupancy beyond tourist season.',
    tradeoffNote: '+45% revenue and +20 influence.',
  },
  resort_desal: {
    name: 'Private Desalination & Reuse Plant',
    description: 'Insulates the resort completely from municipal water droughts.',
    tradeoffNote: '-50% grid water draw and drought shield.',
  },
  resort_golf: {
    name: 'Championship Golf & Diplomat Club',
    description: 'Discreet boardroom retreats expand corporate political leverage.',
    tradeoffNote: '+35% revenue and +20 political influence.',
  },
  resort_marina_pier: {
    name: 'Overwater Villas & Private Pier',
    description: 'Ultra-private oceanfront suites attracting affluent visitors map-wide.',
    tradeoffNote: '+30% revenue and -18% servicing cost.',
  },
  resort_apex: {
    name: 'Private Elite Archipelago (Flagship Project)',
    description: 'Continental pinnacle of coastal luxury hospitality and diplomatic prestige.',
    tradeoffNote: 'Flagship Project: +85% revenue, +35 influence, complete water independence.',
  },

  // officeTower (5)
  office_helipad: {
    name: 'VIP Helipad & Global Tenants',
    description: 'Attracts flagship corporate headquarters willing to pay premium rents.',
    tradeoffNote: '+45% lease revenue, +12 financial influence.',
  },
  office_bms: {
    name: 'Smart Building BMS Automation',
    description: 'Automated HVAC and lighting scheduling cuts tower operating draw.',
    tradeoffNote: '-35% power draw and lower upkeep.',
  },
  office_trading_floor: {
    name: 'Brokerage Trading Floor & M&A Wing',
    description: 'Houses hedge funds and international corporate law partners.',
    tradeoffNote: '+35% leases and +18 financial influence.',
  },
  office_sky_garden: {
    name: 'Green Sky Terraces & Rain Harvest',
    description: 'ESG-certified floors draw blue-chip tenants while cutting water bills.',
    tradeoffNote: '-25% water draw, -15% cost & +12 social influence.',
  },
  office_apex: {
    name: 'Sky-Tower Megascrapper (Flagship Project)',
    description: 'Iconic skyline financial spire commanding maximum corporate rents.',
    tradeoffNote: 'Flagship Project: +75% income, +25 financial influence, -25% power draw.',
  },

  // shoppingMall (5)
  mall_omnichannel: {
    name: 'E-Commerce & Dark Store Hub',
    description: 'Blends brick-and-mortar retail with rapid local courier fulfillment.',
    tradeoffNote: '+35% revenue even in cooler consumer cycles.',
  },
  mall_solar_roof: {
    name: 'Rooftop Solar Canopy',
    description: 'Offsets mall lighting and HVAC electricity consumption.',
    tradeoffNote: '-50% grid electricity consumption.',
  },
  mall_luxury_wing: {
    name: 'Luxury Brand Arcade & IMAX',
    description: 'Elevates average basket value and keeps shoppers on-site longer.',
    tradeoffNote: '+40% revenue and +15 social influence.',
  },
  mall_ev_plaza: {
    name: 'Fast-Charge EV Transit Plaza',
    description: 'Drivers charging EVs funnel steadily into boutiques and cafes.',
    tradeoffNote: '-20% maintenance and +15 social influence.',
  },
  mall_apex: {
    name: 'Galleria Retail Metropolis (Flagship Project)',
    description: '24/7 luxury shopping, dining, and omnichannel fulfillment landmark.',
    tradeoffNote: 'Flagship Project: +70% revenue, +20 social influence, leaner energy draw.',
  },

  // amusementPark (5)
  park_coaster: {
    name: 'Mega-Coasters & VR Pavilions',
    description: 'Draws nationwide visitors and lifts adjacent hotel occupancy.',
    tradeoffNote: '+45% ticket sales and stronger hotel synergy.',
  },
  park_events: {
    name: 'Family Festivals & Civic PR',
    description: 'Sponsored community events brighten public perception of your firm.',
    tradeoffNote: '+20 social influence, -20% maintenance.',
  },
  park_waterzone: {
    name: 'All-Season Indoor Waterpark',
    description: 'Keeps visitor traffic surging even during autumn storms and cold snaps.',
    tradeoffNote: '+38% ticket revenue and -15% upkeep.',
  },
  park_media_studio: {
    name: 'Live Concert Arena & Broadcast Stage',
    description: 'Televised festivals boost corporate recognition nationwide.',
    tradeoffNote: '+25% revenue and +25 social influence.',
  },
  park_apex: {
    name: 'Holo-World Theme Kingdom (Flagship Project)',
    description: 'Futuristic destination generating massive civic influence and tourist inflows.',
    tradeoffNote: 'Flagship Project: +75% revenue, +40 social influence!',
  },

  // culturalCenter (5)
  cult_expo: {
    name: 'International Trade & Culture Forums',
    description: 'Draws foreign investors and boosts nearby hospitality yields.',
    tradeoffNote: '+40% revenue and +25 social influence.',
  },
  cult_acoustics: {
    name: 'Modular Concert Hall Acoustics',
    description: 'Streamlines stage changeovers to lower event production overhead.',
    tradeoffNote: '-25% maintenance and +18 influence.',
  },
  cult_gala: {
    name: 'National Business Awards Gala',
    description: 'Annual televised ceremony lifting prestige of neighboring towers.',
    tradeoffNote: '+45% revenue and +25 influence.',
  },
  cult_museum: {
    name: 'Contemporary Art Patronage Wing',
    description: 'Endowed exhibitions build deep civic goodwill and media prestige.',
    tradeoffNote: '+25% revenue, +30 social influence.',
  },
  cult_apex: {
    name: 'World Economic & Cultural Forum (Flagship Project)',
    description: 'Host venue for global summits uniting heads of state and market leaders.',
    tradeoffNote: 'Flagship Project: +75% revenue, +50 social & financial influence.',
  },

  // marinaPromenade (5)
  marina_yacht: {
    name: 'VIP Superyacht Club',
    description: 'Attracts the nation’s wealthiest executives and capital holders.',
    tradeoffNote: '+50% revenue and +20 financial influence.',
  },
  marina_boulevard: {
    name: 'Year-Round Bistro Boardwalk',
    description: 'Keeps coastal promenade foot traffic lively outside sailing season.',
    tradeoffNote: '+35% revenue and -20% upkeep cost.',
  },
  marina_regatta: {
    name: 'Sponsored International Regatta',
    description: 'Broadcast sailing races lift local coastal appeal and tenant value.',
    tradeoffNote: '+45% revenue and +25 financial influence.',
  },
  marina_dutyfree: {
    name: 'Seaplane Pier & Tax-Free Wharf',
    description: 'Links coastal resorts seamlessly with fast executive air arrivals.',
    tradeoffNote: '+30% revenue, -25% water draw & lower upkeep.',
  },
  marina_apex: {
    name: 'Billionaire Superyacht Riviera (Flagship Project)',
    description: 'Premier deepwater berth complex featuring an exclusive luxury duty-free strip.',
    tradeoffNote: 'Flagship Project: +80% revenue, +35 financial influence.',
  },

  // investmentBank (5)
  bank_hft: {
    name: 'Algorithmic HFT Trading Desk',
    description: 'Captures spread profits across commodity volatility swings.',
    tradeoffNote: '+45% fee & commission revenue.',
  },
  bank_lobby_fund: {
    name: 'Policy & Campaign Finance Fund',
    description: 'Converts banking surplus directly into legislative leverage.',
    tradeoffNote: '+30 financial influence and cheaper lobbying.',
  },
  bank_ma_desk: {
    name: 'Strategic M&A Advisory Desk',
    description: 'Expands underwriting fees and strengthens market buyout positioning.',
    tradeoffNote: '+40% banking commissions and +25 financial influence.',
  },
  bank_vault: {
    name: 'Underground Bullion Vault & Compliance Shield',
    description: 'Secures reserves while deterring rival spies and hostile takeover attempts.',
    tradeoffNote: '+25% counterintelligence shield and -22% upkeep.',
  },
  bank_apex: {
    name: 'Global Investment Bank Alpha (Flagship Project)',
    description: 'Private corporate clearinghouse setting terms across capital markets.',
    tradeoffNote: 'Flagship Project: +80% commissions, +55 financial influence.',
  },

  // mediaAgency (5)
  media_digital: {
    name: 'Social Feed Amplification Algorithms',
    description: 'Micro-targets voter demographics with tailored economic messaging.',
    tradeoffNote: '+40% media outreach & +25% ad revenue.',
  },
  media_fact: {
    name: 'Investigative PR Defense Unit',
    description: 'Protects corporate reputation and blunts hostile consumer boycotts.',
    tradeoffNote: 'Defends firm image and cuts upkeep by -20%.',
  },
  media_streaming: {
    name: '24/7 Business News & Streaming Network',
    description: 'Scales advertising impressions via nationwide live economic broadcasts.',
    tradeoffNote: '+40% ad revenue, +25 media influence.',
  },
  media_polls: {
    name: 'Polling & Election Strategy Institute',
    description: 'Precision voter analytics ahead of parliamentary cycles.',
    tradeoffNote: '+30 social influence, +15% counterintelligence shield.',
  },
  media_apex: {
    name: 'Global Satellite Media Empire (Flagship Project)',
    description: 'Integrated broadcast and digital network steering national consensus.',
    tradeoffNote: 'Flagship Project: +75% revenue, +55 social/media influence.',
  },

  // highSchool (5)
  hs_dual: {
    name: 'Sponsored Factory Apprenticeships',
    description: 'Accelerates technician certification and boosts research output.',
    tradeoffNote: '+50% research output, higher workforce qualification.',
  },
  hs_digital: {
    name: 'CNC & Mechatronics Labs',
    description: 'Modern training simulators reduce classroom instructor load.',
    tradeoffNote: '-25% maintenance cost and +30% research points.',
  },
  hs_apprentice: {
    name: 'Corporate Graduate Pipeline',
    description: 'Places certified specialists directly into smelters, refineries, and offices.',
    tradeoffNote: '+45% research points, +35% training income.',
  },
  hs_cyberlab: {
    name: 'Industrial Automation Workshop',
    description: 'Teaches robotics programming at low recurring cost.',
    tradeoffNote: '+40% research points, -20% maintenance.',
  },
  hs_apex: {
    name: 'Elite Industry 4.0 Polytechnic High (Flagship Project)',
    description: 'Premier feeder academy supplying automation and robotics talent.',
    tradeoffNote: 'Flagship Project: +90% research points, -30% upkeep.',
  },

  // university (5)
  uni_spin: {
    name: 'Tech Transfer & Patent Licensing Office',
    description: 'Commercializes academic breakthroughs into profitable corporate patents.',
    tradeoffNote: '+100% licensing income and +40% research output.',
  },
  uni_stem: {
    name: 'School of Nuclear Physics & AI',
    description: 'Rapidly accelerates breakthrough research capacity.',
    tradeoffNote: '+80% research points, +20% electricity draw.',
  },
  uni_grants: {
    name: 'Startup Venture Park & Incubator',
    description: 'Monetizes spin-offs via industrial research partnerships.',
    tradeoffNote: '+60% campus revenue, +45% research pts, +15 influence.',
  },
  uni_cryo: {
    name: 'Materials Science & Cryptography Center',
    description: 'Speeds up advanced global tech milestones on a lean operating budget.',
    tradeoffNote: '+65% research points, -20% operating costs.',
  },
  uni_apex: {
    name: 'Nobel-Tech & Fusion Campus (Flagship Project)',
    description: 'World-class polytechnic driving flagship breakthroughs and nuclear mastery.',
    tradeoffNote: 'Flagship Project: +120% research pts, +40% patent revenue, +25 influence.',
  },

  // rdLab (5)
  rd_supercomp: {
    name: 'AI Molecular Simulation Cluster',
    description: 'High-speed computer modeling drastically accelerates discoveries.',
    tradeoffNote: '+65% research points, +35% electricity draw.',
  },
  rd_clean: {
    name: 'ISO-1 Ultra-Cleanroom',
    description: 'Lowers hazardous lab waste and prevents experiment failures.',
    tradeoffNote: '-25% maintenance and zero breakdown risk.',
  },
  rd_sim_twin: {
    name: 'Digital Twin Patent Factory',
    description: 'Simulates full prototypes digitally for rapid market licensing.',
    tradeoffNote: '+60% research points, +50% licensing fees.',
  },
  rd_modular: {
    name: 'Automated Reagent Synthesis',
    description: 'Cuts expensive chemical waste and reagent consumption.',
    tradeoffNote: '-25% maintenance, +45% research speed.',
  },
  rd_apex: {
    name: 'Quantum Research Institute (Flagship Project)',
    description: 'Premier deep-tech facility unlocking fusion, aerospace, and AI breakthroughs.',
    tradeoffNote: 'Flagship Project: +130% research points, -30% upkeep.',
  },

  // hospital (5)
  hosp_telemed: {
    name: 'Expanded Fleet & Air Medevac Heli',
    description: 'Adds +2 ambulances and lets medevac helicopters reach roadless tiles.',
    tradeoffNote: 'Roadless heli dispatch + 2 ambulances + 35% clinic revenue.',
  },
  hosp_trauma: {
    name: 'Industrial Occupational Trauma Wing',
    description: 'Faster emergency triage teams boost ambulance response speed by +35%.',
    tradeoffNote: '-35% upkeep costs and faster emergency response.',
  },
  hosp_diagnostics: {
    name: 'Precision MRI & Surgical Center',
    description: 'Executive healthcare packages elevate medical margin and R&D output.',
    tradeoffNote: '+45% revenue, +25% research points.',
  },
  hosp_preventive: {
    name: 'Mobile Preventive Health Clinics',
    description: 'Extra field unit reaches remote mines to curb workforce absenteeism.',
    tradeoffNote: '+1 fleet ambulance, +20 social influence, -18% upkeep.',
  },
  hosp_apex: {
    name: 'Robotic Medicine & Air Rescue Hub (Flagship Project)',
    description: 'Rapid nationwide medical shield protecting workforce uptime everywhere.',
    tradeoffNote: 'Flagship Project: +3 fleet vehicles, +60% speed, +35 social influence.',
  },

  // fireStation (5)
  fire_dispatch: {
    name: 'Expanded Garages & High-Speed Trucks',
    description: 'Adds +2 response bays and accelerates road deployment by +40%.',
    tradeoffNote: '+2 fleet capacity and +40% dispatch speed.',
  },
  fire_hazmat_unit: {
    name: 'Lab HAZMAT Unit & Fire Helicopters',
    description: 'Equips crews for chemical spills and airborne firefighting over roadless tiles!',
    tradeoffNote: 'Handles HAZMAT incidents and dispatches over blocked/roadless plots.',
  },
  fire_hydrants: {
    name: 'High-Pressure Booster Pumps',
    description: 'Refills tanker engines rapidly with lower municipal water draw.',
    tradeoffNote: '-25% water draw, -20% maintenance, +25% dispatch speed.',
  },
  fire_rescue_command: {
    name: 'Thermal Drone Overwatch Dispatch',
    description: 'Detects industrial hotspots before fires spread to neighboring assets.',
    tradeoffNote: '+2 fleet trucks, +25% speed & +15% asset defense.',
  },
  fire_apex: {
    name: 'National Emergency Command Hub (Flagship Project)',
    description: 'Autonomous heavy fire apparatus paired with full aerial suppression fleet.',
    tradeoffNote: 'Flagship Project: +4 fleet capacity, +65% speed, helicopters & HAZMAT.',
  },

  // hazmatBase (5)
  hazmat_mobile_lab: {
    name: 'Decontamination Drones & +2 Units',
    description: 'Expands HAZMAT fleet by 2 units and enables aerial drops past roadblocks.',
    tradeoffNote: '+2 fleet bays, +45% speed, aerial dispatch over roadless plots.',
  },
  hazmat_sensor_grid: {
    name: 'Spectrometric Leak Sensor Network',
    description: 'Early alerts catch trace leaks inside refineries and chemical plants.',
    tradeoffNote: '-25% costs, +20% response speed, lower incident risk.',
  },
  hazmat_cryo_seal: {
    name: 'Autonomous Neutralization Rovers',
    description: 'Shielded robotics safely enter radiological and toxic hazard perimeters.',
    tradeoffNote: '+2 HAZMAT units and +20 social influence.',
  },
  hazmat_bunker_lab: {
    name: 'Toxicology Antidote Lab',
    description: 'Develops industrial sorbents generating extra research and patent income.',
    tradeoffNote: '+35% revenue and +40% research points.',
  },
  hazmat_apex: {
    name: 'Radiological & Chemical Shield HQ (Flagship Project)',
    description: 'Peak containment readiness protecting the entire map against severe spills.',
    tradeoffNote: 'Flagship Project: +3 HAZMAT units, +70% speed, drones, -35% upkeep.',
  },

  // policeStation (5)
  police_patrols: {
    name: 'Mobile Cruisers & Armored Convoys',
    description: 'Adds +2 patrol cars and speeds up map-wide emergency response by +40%.',
    tradeoffNote: '+2 patrol units, stronger heist deterrence.',
  },
  police_cyber: {
    name: 'Cyber-Security & Counterintelligence',
    description: 'Protects financial books, geology maps, and facilities from rival spies.',
    tradeoffNote: '+35% defense against espionage and regulatory audits.',
  },
  police_swat: {
    name: 'SWAT Tactical Units & Helicopters',
    description: 'Enables rapid air intervention against heists and strengthens Military Pillar.',
    tradeoffNote: 'Roadless helicopter response + 20 military defense points.',
  },
  police_drones: {
    name: 'Patrol Drones & ANPR Camera Grid',
    description: 'Continuous corridor surveillance deters cargo hijackings.',
    tradeoffNote: '+18% crime reduction, +20% spy defense, +20% fleet speed.',
  },
  police_apex: {
    name: 'Corporate Security & Intel Agency (Flagship Project)',
    description: 'Zero-heist urban coverage and reinforced shield against hostile buyouts.',
    tradeoffNote: 'Flagship Project: +4 patrol cars, +55% spy & hostile takeover shield!',
  },

  // lobbyOffice (5)
  lobby_thinktank: {
    name: 'Policy Think-Tank & Whitepapers',
    description: 'Frames corporate policy priorities as objective economic studies.',
    tradeoffNote: '+35 financial influence and -20% office maintenance.',
  },
  lobby_legal: {
    name: 'Antitrust & Merger Defense Counsel',
    description: 'Protects your conglomerate against regulatory fines and merger blocks.',
    tradeoffNote: '+50% advisory income and stronger corporate standing.',
  },
  lobby_parliament: {
    name: 'Parliamentary Caucus & Bill Drafting',
    description: 'Translates industry proposals smoothly into favorable tax legislation.',
    tradeoffNote: '+40 financial influence & +35% consulting revenue.',
  },
  lobby_tax_shield: {
    name: 'Compliance & Anti-Takeover Desk',
    description: 'Builds regulatory poison pills blocking rival forced buyouts.',
    tradeoffNote: '-25% operating cost, +25% counterintelligence defense.',
  },
  lobby_apex: {
    name: 'Architects of Law Chancery (Flagship Project)',
    description: 'Drafts market frameworks and shuts down rival forced-buyout moves.',
    tradeoffNote: 'Flagship Project: +65 financial influence, +50% anti-buyout shield.',
  },

  // churchFoundation (5)
  church_charity: {
    name: 'Parish Outreach & Aid Network',
    description: 'Deepens grassroots trust among conservative voters and communities.',
    tradeoffNote: '+40 social and church influence.',
  },
  church_radio: {
    name: 'Community Radio Network',
    description: 'Aligns civic outreach with pro-growth corporate messaging.',
    tradeoffNote: '+25 influence and +60% donor income.',
  },
  church_academy: {
    name: 'Charity Scholarships & Clinics',
    description: 'Sustained philanthropy wins deep loyalty from workforces and voters.',
    tradeoffNote: '+35 social/church influence, -20% costs.',
  },
  church_media_net: {
    name: 'National Civic Television & Press',
    description: 'Scales foundation messaging into every corner of the map.',
    tradeoffNote: '+30 influence and +45% foundation revenue.',
  },
  church_apex: {
    name: 'Grand National Civic Patronage (Flagship Project)',
    description: 'Unmatched social coalition immunizing operations against strikes and unrest.',
    tradeoffNote: 'Flagship Project: +75 social & church influence, high voter loyalty.',
  },

  // intelligenceCenter (5)
  intel_sigint: {
    name: 'SIGINT Intercept & Cyber-Shield',
    description: 'Blocks rival espionage networks and boosts offensive ops reliability.',
    tradeoffNote: '+35 military power & influence.',
  },
  intel_specops: {
    name: 'Corporate Boarding Legal Ops',
    description: 'Prepares tactical buyout briefs and enforcement strike packages.',
    tradeoffNote: '-25% spec-ops overhead cost.',
  },
  intel_orbital: {
    name: 'SAR Imaging & Thermal Satellites',
    description: 'Tracks hidden rival sites across the map in real time.',
    tradeoffNote: '+35% spy defense and +40% research points.',
  },
  intel_counter_ops: {
    name: 'Financial Counter-Ops & Audit Bureau',
    description: 'Undermines rival credibility while cutting tactical op expenses.',
    tradeoffNote: '+35 military strength, -20% op upkeep.',
  },
  intel_apex: {
    name: 'Echelon Global Defense Net (Flagship Project)',
    description: 'Detects rival nuclear programs early and neutralizes hostile sabotage.',
    tradeoffNote: 'Flagship Project: +60 military pts, +65% spy shield, +70% research.',
  },

  // corporateHQ (5)
  hq_erp: {
    name: 'Enterprise ERP Analytics Suite',
    description: 'Lifts HQ leasing income and streamlines empire-wide management.',
    tradeoffNote: '+45% HQ revenue, -25% maintenance.',
  },
  hq_ir: {
    name: 'Investor Relations Directorate',
    description: 'Strengthens Stock Exchange credibility and institutional trust.',
    tradeoffNote: '+30 financial influence and equity valuation support.',
  },
  hq_penthouse: {
    name: 'Executive Penthouse & VIP Helipad',
    description: 'Peak corporate prestige generating research synergy and influence.',
    tradeoffNote: '+50% research speed, major market prestige.',
  },
  hq_audit: {
    name: 'Corporate Audit & Risk Committee',
    description: 'Hardens boardroom security against leaks and trims overhead.',
    tradeoffNote: '-20% upkeep, +25% counterintelligence shield, +15 influence.',
  },
  hq_apex: {
    name: 'Imperium Executive Citadel (Flagship Project)',
    description: 'Monumental 2.5D central complex radiating ultimate financial authority.',
    tradeoffNote: 'Flagship Project: +90% HQ income, +80 influence, +60% research!',
  },

  // casino (5)
  cas_vip: {
    name: 'High-Roller VIP Salon',
    description: 'Private gaming tables catering to tycoons and celebrities.',
    tradeoffNote: '+55% casino revenue.',
  },
  cas_cctv: {
    name: 'Biometric Security & Surveillance',
    description: 'Spots card counters and cuts vulnerability to armed heists.',
    tradeoffNote: '+30% heist defense and -20% upkeep.',
  },
  cas_resort: {
    name: 'Grand Casino Palace & Star Gala',
    description: 'Unites high-stakes gaming with luxury jewelry boutiques and suites.',
    tradeoffNote: '+75% income when supplied with luxury jewelry.',
  },
  cas_fintech_cage: {
    name: 'Private Cage & Crypto VIP Credit',
    description: 'Encrypted high-limit settlements cut vault robbery exposure.',
    tradeoffNote: '+30% revenue, +15 influence & +15% robbery protection.',
  },
  cas_apex: {
    name: 'Monte-Carlo Fortune Palace (Flagship Project)',
    description: 'Global entertainment capital producing colossal cash flow and influence.',
    tradeoffNote: 'Flagship Project: +95% casino revenue, +40 financial influence, full security.',
  },

  // militaryBase (5)
  pmc_convoys: {
    name: 'Armored Convoys & Perimeter Guard',
    description: 'Hardens every company facility against raids and industrial sabotage.',
    tradeoffNote: '+35% spy and sabotage defense.',
  },
  pmc_raid_team: {
    name: 'Rapid Corporate Boarding Squads',
    description: 'Elite tactical teams raising Military Pillar projection.',
    tradeoffNote: '+45 military influence and strike readiness.',
  },
  pmc_sat: {
    name: 'Recon Drones & Tactical Satellites',
    description: 'Battlefield surveillance dominance and military R&D telemetry.',
    tradeoffNote: '+40% research points, +50 defense & prestige.',
  },
  pmc_academy: {
    name: 'Field Proving Ground & Logistics Corps',
    description: 'Cuts live-fire equipment wear while raising PMC prestige.',
    tradeoffNote: '-20% base upkeep, -20% wear rate, +25 military points.',
  },
  pmc_apex_missile: {
    name: '3x3 Tactical Missile Arsenal (Flagship Project)',
    description: 'Unlocks devastating 3x3 Tactical Missile strikes capable of leveling entire blocks!',
    tradeoffNote: 'Flagship Project: Unlocks 3x3 Tactical Missile, +70 military pts & top 2.5D look!',
  },

  // windFarm (5)
  wind_offshore: {
    name: 'High-Altitude 8 MW Turbines',
    description: 'Taller towers tap stronger, steadier upper wind currents.',
    tradeoffNote: '+40% power generation.',
  },
  wind_ai_pitch: {
    name: 'Active Pitch & Anti-Icing Blades',
    description: 'Prevents winter shutdowns while cutting gearbox wear.',
    tradeoffNote: '-25% upkeep cost, -20% gearbox wear.',
  },
  wind_hv_transformer: {
    name: 'High-Voltage Grid Substation',
    description: 'Cuts transmission drop and stabilizes output to the national grid.',
    tradeoffNote: '+35% MW output, blackout protection.',
  },
  wind_radar_eco: {
    name: 'Avian Radar & Green PR Certification',
    description: 'Eco-certified wind operations strengthen civic backing.',
    tradeoffNote: '+20 social influence, +15% base output.',
  },
  wind_apex: {
    name: 'Direct-Drive Super-Turbines (Flagship Project)',
    description: 'Neodymium direct-drive rotors harvest power even in light breezes.',
    tradeoffNote: 'Flagship Project: +70% MW output, -30% upkeep, 2.5D upgrade!',
  },

  // solarFarm (5)
  solar_bifacial: {
    name: 'Bifacial Sun-Tracking Arrays',
    description: 'Continuously aligns panels with solar elevation throughout the day.',
    tradeoffNote: '+42% output and lower cloud losses.',
  },
  solar_micro_storage: {
    name: 'Field-Side LFP Container Batteries',
    description: 'Sustains power dispatch after dusk and through passing storms.',
    tradeoffNote: '+25% capacity, full blackout immunity.',
  },
  solar_tandem: {
    name: 'Silicon-Perovskite Tandem Panels',
    description: 'Record power density per square meter of desert or plain.',
    tradeoffNote: '+35% MW output and +12 social influence.',
  },
  solar_robot_clean: {
    name: 'Autonomous Dust-Cleaning Bots',
    description: 'Ideal for deserts and mining belts — preserves crystal panel clarity.',
    tradeoffNote: '-25% maintenance and -25% wear rate.',
  },
  solar_apex: {
    name: 'Quantum Solar Concentrator (Flagship Project)',
    description: 'Multi-junction quantum arrays generating clean power even under cloud cover.',
    tradeoffNote: 'Flagship Project: +75% MW output, weather resilient, 2.5D upgrade!',
  },

  // gasPowerPlant (5)
  gas_ccgt: {
    name: 'Combined-Cycle CCGT Recovery',
    description: 'Captures exhaust heat to lift turbine thermal efficiency to 62%.',
    tradeoffNote: '+35% power and -20% fuel consumption.',
  },
  gas_chp: {
    name: 'Industrial CHP Cogeneration',
    description: 'Saves cooling water while lowering regulatory emission fees.',
    tradeoffNote: '-30% water use, -2 pollution pts, -15% costs.',
  },
  gas_hydrogen_blend: {
    name: 'H2-Ready Peaking Turbines',
    description: 'Raises peak dispatch capacity with cleaner combustion exhaust.',
    tradeoffNote: '+35% MW capacity and +15 social influence.',
  },
  gas_fast_ramp: {
    name: '5-Minute Fast-Ramp Grid Start',
    description: 'Covers sudden demand surges and guards against grid collapses.',
    tradeoffNote: 'Blackout immunity, -25% turbine wear.',
  },
  gas_apex: {
    name: 'Allam-Cycle Zero-Emission Plant (Flagship Project)',
    description: 'Supercritical CO₂ power cycle achieving ultra-clean high output.',
    tradeoffNote: 'Flagship Project: +65% MW power, zero eco fines, -25% upkeep!',
  },

  // geothermalPlant (5)
  geo_deep: {
    name: '5-km Deep HDR Wells',
    description: 'Taps hotter deep strata while supplying industrial process heat.',
    tradeoffNote: '+45% power and drought resilience.',
  },
  geo_binary: {
    name: 'Closed Binary ORC Loop',
    description: 'Recirculates working fluid with zero steam loss from boreholes.',
    tradeoffNote: '-40% water draw, -25% upkeep costs.',
  },
  geo_lithium_brine: {
    name: 'Mineral Brine Co-Extraction',
    description: 'Recovers valuable trace salts from hot brine to offset generation cost.',
    tradeoffNote: '+35% efficiency, +20 social influence.',
  },
  geo_titanium: {
    name: 'Anti-Corrosion Titanium Heat Exchangers',
    description: 'Shields wellheads from H2S corrosion and high-pressure failures.',
    tradeoffNote: '-35% wear rate, zero breakdown risk.',
  },
  geo_apex: {
    name: 'Ultra-Deep Mantle Geo Plant (Flagship Project)',
    description: 'Closed deep-crust loop outputting massive zero-emission baseload power.',
    tradeoffNote: 'Flagship Project: +75% MW output and premier green prestige.',
  },

  // fusionReactor (5)
  fus_plasma: {
    name: 'HTS Superconducting Magnets',
    description: 'Confines high-density plasma at record sustained efficiency.',
    tradeoffNote: '+40% power capacity and +35% research speed.',
  },
  fus_tritium: {
    name: 'Self-Sustaining Tritium Breeding Blanket',
    description: 'Closes the fusion fuel cycle, slashing lithium draw and upkeep.',
    tradeoffNote: '-25% maintenance cost, -35% cooling water.',
  },
  fus_divertor: {
    name: 'Liquid-Metal Plasma Divertor',
    description: 'Eliminates wall thermal bottlenecks for nonstop full-power runs.',
    tradeoffNote: '+45% MW output & complete blackout protection.',
  },
  fus_ai_confinement: {
    name: 'Microsecond AI Magnetic Control',
    description: 'Predicts plasma instabilities early while producing breakthrough data.',
    tradeoffNote: '+65% research points, +25 social influence.',
  },
  fus_apex: {
    name: 'Artificial Sun Iter-Fusion (Flagship Project)',
    description: 'Zero-emission power star supplying boundless electricity map-wide.',
    tradeoffNote: 'Flagship Project: +80% output, +50 influence, -30% maintenance.',
  },

  // sewagePlant (5)
  sew_biogas: {
    name: 'Anaerobic Biogas Digesters',
    description: 'Converts sludge into internal power while boosting flow capacity.',
    tradeoffNote: '+50% sewage treatment & lower grid power draw.',
  },
  sew_membrane: {
    name: 'MBR Membrane Bioreactors',
    description: 'Dense hollow-fiber membranes reclaim far more clean industrial water.',
    tradeoffNote: '+35% water output, -20% maintenance.',
  },
  sew_phosphorus: {
    name: 'Nutrient & Process Water Recovery',
    description: 'Sells reclaimed water back to industry to boost station margins.',
    tradeoffNote: '+45% sewage treatment and +15 social influence.',
  },
  sew_odor_shield: {
    name: 'Sealed Bio-Scrubbers & Odor Shield',
    description: 'Lets treatment run beside commercial zones without neighborhood penalties.',
    tradeoffNote: 'Drought shield, +25% treatment capacity, -20% wear.',
  },
  sew_apex: {
    name: 'Clean Water Bio-Refinery (Flagship Project)',
    description: 'Turns 100% of wastewater into industrial process water and fertilizer.',
    tradeoffNote: 'Flagship Project: +100% sewage capacity, +25 social influence, water revenue.',
  },

  // wasteIncinerator (5)
  inc_scrub: {
    name: 'Afterburners & Dioxin Scrubbers',
    description: 'Cuts particulate fallout while capturing extra thermal megawatts.',
    tradeoffNote: '-50% emissions fines and +30% power capacity.',
  },
  inc_chp_turbine: {
    name: 'High-Pressure Steam Turbines',
    description: 'Converts furnace combustion heat into higher electricity output.',
    tradeoffNote: '+35% MW generation, -20% upkeep.',
  },
  inc_autosort: {
    name: 'Automated RDF Fuel Shredders',
    description: 'Pre-sorts waste streams to raise calorific throughput.',
    tradeoffNote: '+45% waste disposal, +25% power output.',
  },
  inc_slag_reuse: {
    name: 'Bottom-Ash Aggregate Recovery',
    description: 'Keeps grates clear while further cutting smokestack particulates.',
    tradeoffNote: '-2 pollution pts, -25% kiln wear, +10 influence.',
  },
  inc_apex: {
    name: 'Plasma-Enhanced Waste CHP (Flagship Project)',
    description: 'High-temp gasification removes visible smoke while maximizing MW output.',
    tradeoffNote: 'Flagship Project: +80% disposal & MW power, eliminates smog fines!',
  },

  // recyclingPlant (5)
  rec_plasma: {
    name: 'Laser-Plasma Alloy Sorting',
    description: 'Maximizes recovery of critical rare elements from e-waste.',
    tradeoffNote: '+50% metal recovery and +40% waste throughput.',
  },
  rec_optical_sort: {
    name: 'Near-Infrared Optical Sorters',
    description: 'Rapidly separates alloys and plastics with minimal manual labor.',
    tradeoffNote: '-30% staffing, -20% operating costs.',
  },
  rec_lithium_loop: {
    name: 'EV Battery Hydrometallurgy Line',
    description: 'Recovers battery-grade lithium, copper, and rare earth stocks cleanly.',
    tradeoffNote: '+45% metal recovery and +35% waste capacity.',
  },
  rec_green_badge: {
    name: 'Circular Economy Public Program',
    description: 'Showcases green closed-loop manufacturing to boost civic pride.',
    tradeoffNote: '+25 social influence, -30% water draw.',
  },
  rec_apex: {
    name: 'Closed-Loop Urban Mine (Flagship Project)',
    description: 'Recovers double strategic metals while neutralizing empire waste streams.',
    tradeoffNote: 'Flagship Project: +85% metal yield, +80% waste capacity, +30 social influence!',
  },

  // coldStorage (5)
  cold_asrs: {
    name: 'Automated AS/RS Crane Racks',
    description: 'Doubles storage density while slashing refrigeration labor.',
    tradeoffNote: '2x buffer capacity, -30% upkeep.',
  },
  cold_ammonia: {
    name: 'Cascade Low-Draw Chillers',
    description: 'Maintains deep sub-zero storage using far less grid electricity.',
    tradeoffNote: '-35% power draw, -18% servicing cost.',
  },
  cold_rail_hub: {
    name: 'Rail Siding & Intermodal Bay',
    description: 'Scales bulk rail logistics capacity and widens reserve storage.',
    tradeoffNote: '+40% hub revenue, 2.5x buffer capacity.',
  },
  cold_backup_gen: {
    name: 'UPS Power & Phase-Change Insulation',
    description: 'Protects perishable stockpiles during grid blackouts and heatwaves.',
    tradeoffNote: 'Blackout & drought immunity, +12 influence.',
  },
  cold_apex: {
    name: 'Autonomous Distribution Megahub (Flagship Project)',
    description: 'Unmanned intermodal logistics command center for long-haul freight.',
    tradeoffNote: 'Flagship Project: 3x buffer, +60% revenue, -40% upkeep.',
  },

  // V6 Explicit 5-Node Buildings (19 x 5 = 95 nodes)
  bus_t1: { name: 'Digital GPS Scheduling', description: 'Optimizes municipal routes and shortens transfer waits.', tradeoffNote: '+22% fare revenue, -12% fuel cost.' },
  bus_t2: { name: 'Articulated Fleet Expansion', description: 'High-capacity buses carry rush-hour crowds into shopping zones.', tradeoffNote: '+25% passenger capacity & demand boost.' },
  bus_t3: { name: 'Zero-Emission Electric Buses', description: 'Quiet battery fleet eliminates exhaust and engine noise downtown.', tradeoffNote: '-2 pollution, clean environmental filter.' },
  bus_t4: { name: 'Dedicated Express Bus Lanes', description: 'Priority transit corridors accelerate commuter arrival times.', tradeoffNote: '+30% income and -15% local staff turnover.' },
  bus_flagship: { name: 'Autonomous Metro BRT Network (Flagship Project)', description: 'Fully automated rapid bus transit linking the entire region.', tradeoffNote: '+55% revenue, maximum demand radius & social influence.' },

  metro_t1: { name: 'Contactless NFC Turnstiles', description: 'Speeds up peak commuter throughput in stations.', tradeoffNote: '+24% ticket yield, less cashier staff.' },
  metro_t2: { name: 'Underground Retail Concourses', description: 'Subterranean boutiques and kiosks leased inside station halls.', tradeoffNote: '+28% station retail leasing income.' },
  metro_t3: { name: 'Regenerative Braking Grid', description: 'Captures braking electricity from trains to cut grid bills.', tradeoffNote: '-25% MW draw and lower maintenance.' },
  metro_t4: { name: '90-Second Autonomous Headways', description: 'Doubles driverless metro frequency across business corridors.', tradeoffNote: '+38% income, +20 social influence.' },
  metro_flagship: { name: 'Express Loop Metro Line (Flagship Project)', description: 'High-speed underground ring uniting every urban commerce hub.', tradeoffNote: '+65% income, blackout shield & high prestige.' },

  train_t1: { name: 'InterCity Long-Haul Platforms', description: 'Handles rapid inter-regional passenger express services.', tradeoffNote: '+25% passenger inflow & fare income.' },
  train_t2: { name: 'Station Galleria & Park-and-Ride', description: 'Commercial tenant concourse serving daily travelers.', tradeoffNote: '+26% base income, -10% upkeep.' },
  train_t3: { name: 'Electric Hybrid Locomotives', description: 'Modern rolling stock lowers emissions and rail wear.', tradeoffNote: '-20% maintenance and clean emission filter.' },
  train_t4: { name: 'High-Speed Rail Corridor (HSR)', description: 'Halves travel times from neighboring metropolitan regions.', tradeoffNote: '+40% income and +20 political influence.' },
  train_flagship: { name: 'Continental Maglev Terminal (Flagship Project)', description: 'National-scale ultra-high-speed magnetic rail hub.', tradeoffNote: '+70% revenue and massive consumer inflow.' },

  viptrm_t1: { name: 'Duty-Free Luxury Arcade & Lounge', description: 'Private VIP lounges lift high-roller traveler spending.', tradeoffNote: '+28% terminal retail income.' },
  viptrm_t2: { name: 'Dual Parallel Runways', description: 'Doubles international charter and executive flight capacity.', tradeoffNote: '+34% income & reduced runway downtime.' },
  viptrm_t3: { name: 'Sustainable Aviation Fuel (SAF)', description: 'Lowers terminal carbon footprint and aviation tax overhead.', tradeoffNote: '-25% eco fines and lower fuel cost.' },
  viptrm_t4: { name: 'Transcontinental Executive Routes', description: 'Direct nonstop connections to global financial capitals.', tradeoffNote: '+42% income and +25 financial influence.' },
  viptrm_flagship: { name: 'Global Megahub Transfer Airport (Flagship Project)', description: 'World-class transit hub energizing tourism & luxury map-wide.', tradeoffNote: '+75% income and +45 prestige points.' },

  apt_t1: { name: 'Ground-Floor Retail & Cafes', description: 'Leases ground-floor units to neighborhood shops and bakeries.', tradeoffNote: '+22% recurring lease revenue.' },
  apt_t2: { name: 'Smart-Home & Rooftop Solar', description: 'Rooftop panels trim grid electricity draw across apartments.', tradeoffNote: '-30% MW draw and higher tenant appeal.' },
  apt_t3: { name: 'Green Terraces & Rainwater Catch', description: 'Bioswales cut water bills while uplifting district quality.', tradeoffNote: '-25% water draw and +10 social influence.' },
  apt_t4: { name: 'Executive Penthouse Tower', description: 'Luxury sky-level residences tailored for senior corporate talent.', tradeoffNote: '+38% income and recession resilience.' },
  apt_flagship: { name: 'Net-Zero Future Living Quarter (Flagship Project)', description: 'Self-sufficient premium urban residential district.', tradeoffNote: '+65% rents, drought & blackout immunity.' },

  gastro_t1: { name: 'Heated All-Season Patios & Events', description: 'Maintains busy dining traffic year-round and on weekends.', tradeoffNote: '+24% culinary sales.' },
  gastro_t2: { name: 'Central Commissary & Bulk Sourcing', description: 'Cuts food waste and kitchen procurement overhead.', tradeoffNote: '-22% operating cost.' },
  gastro_t3: { name: 'Bio-Waste Compost & Grease Traps', description: 'Trims trash output and improves residential goodwill.', tradeoffNote: '-35% waste, +10 social influence.' },
  gastro_t4: { name: 'Michelin-Starred Flagship Dining', description: 'Signature chefs draw affluent tourists and executives.', tradeoffNote: '+38% margin, stronger hotel synergy.' },
  gastro_flagship: { name: 'International Culinary Boulevard (Flagship Project)', description: 'Famous 24/7 dining promenade pulling huge visitor crowds.', tradeoffNote: '+68% revenue and +24 social influence.' },

  park_t1: { name: 'Jogging Trails & Open Amphitheater', description: 'Boosts botanical conservatory ticket sales and civic events.', tradeoffNote: '+30% yield and higher civic approval.' },
  park_t2: { name: 'Stormwater Retention Ponds', description: 'Captures rainfall for park irrigation without grid water draw.', tradeoffNote: '-45% water usage, drought resilience.' },
  park_t3: { name: 'Anti-Smog Botanical Tree Barrier', description: 'Dense foliage buffers particulates from nearby mines and mills.', tradeoffNote: '-4 local pollution & cleaner air.' },
  park_t4: { name: 'Tropical Glasshouse & Garden Cafe', description: 'Year-round botanical conservatory attracting paid visitors.', tradeoffNote: '+45% park yield and +15 influence.' },
  park_flagship: { name: 'Royal Eco-Park & Arboretum (Flagship Project)', description: 'Monumental botanical district lifting metropolitan prestige.', tradeoffNote: '+85% yield, +30 influence and strong smog buffer.' },

  arena_t1: { name: 'VIP Corporate Luxury Boxes', description: 'Annual hospitality suites leased by partner corporations.', tradeoffNote: '+26% recurring sponsor income.' },
  arena_t2: { name: 'Retractable All-Weather Roof', description: 'Hosts sold-out tours year-round regardless of storms.', tradeoffNote: '+30% attendance and zero rainouts.' },
  arena_t3: { name: 'Smart LED Rig & Zero-Waste Sorting', description: 'Slashes match-night megawatt spikes and stadium trash.', tradeoffNote: '-28% power draw and -25% waste.' },
  arena_t4: { name: 'Global Multimedia Broadcast Rights', description: 'Distributes major finals and live concerts worldwide.', tradeoffNote: '+40% income and +25 media influence.' },
  arena_flagship: { name: 'Olympic Entertainment Complex (Flagship Project)', description: 'Premier global stadium anchoring mega-events and tourism.', tradeoffNote: '+72% revenue and +45 social influence.' },

  expo_t1: { name: 'Industrial Trade Show Pavilions', description: 'Attracts international commodity buyers to annual expos.', tradeoffNote: '+24% exhibition hall revenue.' },
  expo_t2: { name: 'Hybrid Conference Broadcast Suite', description: 'Livestreamed summits lower event staffing expenses.', tradeoffNote: '-18% operating costs and +12% R&D.' },
  expo_t3: { name: 'LEED-Certified Green Expo Halls', description: 'Efficient climate control and rooftop solar reduce bills.', tradeoffNote: '-25% electricity and water draw.' },
  expo_t4: { name: 'World Economic Summit Host Hall', description: 'Annual forum uniting leaders boosts national standing.', tradeoffNote: '+36% income, +28 financial influence.' },
  expo_flagship: { name: 'Global G20 Summit Complex (Flagship Project)', description: 'Prestigious convention center hosting global economic summits.', tradeoffNote: '+65% income and +42 influence points.' },

  law_t1: { name: 'M&A Arbitration Practice', description: 'Defends corporate shares against hostile takeover bids.', tradeoffNote: '+25% defense against espionage & buyouts.' },
  law_t2: { name: 'Cross-Border Contract Desk', description: 'Streamlines high-stakes B2B deals and government tenders.', tradeoffNote: '+24% advisory retainer income.' },
  law_t3: { name: 'Environmental & Regulatory Defense', description: 'Appeals trim heavy compliance fines and enforcement risk.', tradeoffNote: '-20% compliance and fine expenses.' },
  law_t4: { name: 'IP & Patent Enforcement Taskforce', description: 'Strengthens protection around proprietary R&D technologies.', tradeoffNote: '+34% income and +22 financial influence.' },
  law_flagship: { name: 'Supreme Corporate Chancery (Flagship Project)', description: 'Premier legal powerhouse shaping national commercial standards.', tradeoffNote: '+58% profit, +45% legal shield & +35 influence.' },

  pr_t1: { name: 'Viral Social Media Campaigns', description: 'Rapidly lifts public perception and voter approval.', tradeoffNote: '+22% ad fees and +10 social influence.' },
  pr_t2: { name: '24/7 Crisis Communications War Room', description: 'Rapidly neutralizes rival PR attacks and boycott scares.', tradeoffNote: '-20% crisis costs & +15% rival PR defense.' },
  pr_t3: { name: 'ESG Branding & Green Credentials', description: 'Softens public backlash around heavy manufacturing sites.', tradeoffNote: '+15 influence and improved eco perception.' },
  pr_t4: { name: 'Luxury Brand Repositioning', description: 'Elevates retail prices across jewelry, hotels, and malls.', tradeoffNote: '+36% profit and +12% pricing margin.' },
  pr_flagship: { name: 'Public Narrative Dominion Agency (Flagship Project)', description: 'Full-spectrum influence studio steering voter & consumer mood.', tradeoffNote: '+62% revenue, +40 social influence.' },

  dc_t1: { name: 'Liquid Immersion Rack Cooling', description: 'Drastically cuts fresh water evaporation across server halls.', tradeoffNote: '-40% water draw and +18% compute throughput.' },
  dc_t2: { name: 'Tensor-Grid AI Compute Clusters', description: 'Leases heavy AI compute capacity to finance and biotech firms.', tradeoffNote: '+34% cloud income and +30% research.' },
  dc_t3: { name: 'District Waste-Heat Recovery', description: 'Recaptures server rack heat to cut net utility bills.', tradeoffNote: '-22% grid MW draw.' },
  dc_t4: { name: 'Encrypted Sovereign Cloud Vaults', description: 'Secures classified contracts and shields company records.', tradeoffNote: '+40% profit and +45% spy defense.' },
  dc_flagship: { name: 'Quantum Super-AI Cloud Core (Flagship Project)', description: 'World-leading compute engine driving corporate breakthroughs.', tradeoffNote: '+75% profit, +85% R&D & blackout/drought shield.' },

  bio_t1: { name: 'Antibiotic Synthesis Lines', description: 'Boosts margins while supporting workforce public health.', tradeoffNote: '+26% income and faster medical R&D.' },
  bio_t2: { name: 'High-Purity Bioreactor Arrays', description: 'Extracts greater pharmaceutical yield per ton of chemicals.', tradeoffNote: '+30% output, -15% input waste.' },
  bio_t3: { name: 'BSL-4 Containment Airlocks', description: 'Slashes bio-HAZMAT incident risks and toxic effluent.', tradeoffNote: '-45% breakdown risk & cleaner water outflow.' },
  bio_t4: { name: 'Gene Therapy & Precision Oncology', description: 'Breakthrough biologic treatments with extraordinary value.', tradeoffNote: '+44% profits and +22 social influence.' },
  bio_flagship: { name: 'Regenerative Medicine Institute (Flagship Project)', description: 'Flagship biomedical complex boosting longevity & public approval.', tradeoffNote: '+78% profit, +35% R&D & +35 influence.' },

  vfarm_t1: { name: 'Full-Spectrum Horticulture LEDs', description: 'Increases annual harvest cycles within the same plot.', tradeoffNote: '+25% crop throughput.' },
  vfarm_t2: { name: 'Aeroponic Mist Closed-Loop', description: 'Atomized nutrient mist lowers water draw nearly to zero.', tradeoffNote: '-60% water draw and drought resilience.' },
  vfarm_t3: { name: 'Harvesting Robotics & Packline', description: 'Automation trims manual farm labor expenses.', tradeoffNote: '-35% staff required and lower upkeep.' },
  vfarm_t4: { name: 'Direct Farm-to-Table Bistro Supply', description: 'Ships ultra-fresh greens straight into culinary zones.', tradeoffNote: '+38% income and +14 social influence.' },
  vfarm_flagship: { name: 'Autonomous Agro-Ecological Tower (Flagship Project)', description: 'Skyscraping vertical farm feeding the entire metropolis.', tradeoffNote: '+70% crops, drought/fault proof & +25 influence.' },

  shipyd_t1: { name: 'Heavy Gantry Cranes & Drydock', description: 'Accelerates hull assembly and composite panel fabrication.', tradeoffNote: '+25% production throughput.' },
  shipyd_t2: { name: 'Carbon-Fiber Curing Autoclave', description: 'Produces high-margin lightweight marine & aerospace hulls.', tradeoffNote: '+28% revenue and margin.' },
  shipyd_t3: { name: 'Enclosed Composite Paint Booths', description: 'Solvent scrubbers protect coastal waters and neighborhoods.', tradeoffNote: '-3 pollution & eco filter protection.' },
  shipyd_t4: { name: 'AI Robotic Hull Welding', description: 'Cuts labor overhead and heavy machinery fatigue.', tradeoffNote: '-25% headcount, -20% maintenance cost.' },
  shipyd_flagship: { name: 'National Composite Naval Arsenal (Flagship Project)', description: 'Massive coastal shipyard crafting mega-freighters & composites.', tradeoffNote: '+68% output, +35 influence & full yard upgrade.' },

  landfill_t1: { name: 'Heavy Compactor Presses', description: 'Increases bale density inside cells to handle more volume.', tradeoffNote: '+25% waste disposal capacity.' },
  landfill_t2: { name: 'Pre-Sort Material Recovery Belt', description: 'Recovers basic plastics and scrap metal from mixed haulage.', tradeoffNote: '+20% disposal capacity, +18% revenue.' },
  landfill_t3: { name: 'Geomembrane Liner & Leachate Catch', description: 'Seals cells and suppresses odor drift toward neighbors.', tradeoffNote: '-2 pollution & lower eco penalties.' },
  landfill_t4: { name: 'Automated Yard Loaders', description: 'Reduces manual sorting crew expenses.', tradeoffNote: '-20% staffing and -18% maintenance.' },
  landfill_flagship: { name: 'Mechanized Secondary Sorting Complex (Flagship Project)', description: 'Upgrades basic landfill into an engineered waste processing hub.', tradeoffNote: '+45% waste capacity, +35% revenue & lower upkeep.' },

  biosew_t1: { name: 'Nitrifying Bio-Media Beds', description: 'Accelerates biological breakdown of industrial nitrates.', tradeoffNote: '+25% sewage capacity.' },
  biosew_t2: { name: 'Polishing Reed-Bed Lagoons', description: 'Natural tertiary filtration raises clean water recovery.', tradeoffNote: '+22% water yield and +20% sewage flow.' },
  biosew_t3: { name: 'Sludge Biogas Cogeneration', description: 'Burns captured biogas to power aeration blowers cleanly.', tradeoffNote: '-35% grid electricity usage.' },
  biosew_t4: { name: 'Submerged MBR Membrane Cassettes', description: 'Multiplies sewage processing density on the same footprint.', tradeoffNote: '+35% sewage capacity, -15% upkeep.' },
  biosew_flagship: { name: 'Metropolitan Bio-Sewage Refinery (Flagship Project)', description: 'Automated biological treatment facility serving entire regions.', tradeoffNote: '+55% sewage capacity, +35% reclaimed water & +20 influence.' },

  closedsew_t1: { name: 'Pressurized Ultrafiltration Skids', description: 'Boosts first-stage industrial wastewater filtration volume.', tradeoffNote: '+30% sewage capacity.' },
  closedsew_t2: { name: 'Ozone & Activated Carbon Cascades', description: 'Polishes reclaimed water pure enough for chip fabs & labs.', tradeoffNote: '+30% income and +25% sewage treatment.' },
  closedsew_t3: { name: 'Pump Energy Recovery Turbines', description: 'Captures reverse-osmosis pressure energy to lower power bills.', tradeoffNote: '-30% electricity draw & -15% servicing.' },
  closedsew_t4: { name: 'AI Water Chemistry Telemetry', description: 'Automated inline sensing shrinks lab operator headcount.', tradeoffNote: '-22% staffing and +35% sewage flow.' },
  closedsew_flagship: { name: 'Zero-Loss Reverse Osmosis Grid (Flagship Project)', description: 'Pinnacle closed-loop water plant achieving near-100% recovery.', tradeoffNote: '+70% sewage flow, +55% income & +30 eco influence.' },

  plasma_t1: { name: 'High-Arc Plasma Torches', description: 'Accelerates gasification of toughest hazardous industrial streams.', tradeoffNote: '+30% waste processing throughput.' },
  plasma_t2: { name: 'Syngas Combined-Cycle Turbines', description: 'Cleanly converts synthesis gas into electricity & recovered metals.', tradeoffNote: '+30% power and metal recovery.' },
  plasma_t3: { name: 'Plasma Slag Vitrification', description: 'Locks mineral residue into inert glass aggregate with zero dust.', tradeoffNote: 'Clean scrubber shield, -18% maintenance.' },
  plasma_t4: { name: 'Magnetic Rare-Earth Separation', description: 'Captures additional trace copper and rare metals from plasma ash.', tradeoffNote: '+35% resource recovery, -20% staffing.' },
  plasma_flagship: { name: 'Closed-Matter Plasma Reactor (Flagship Project)', description: 'Autonomous Zero-Waste plant turning waste dumps into clean MW & rare metals.', tradeoffNote: '+65% waste disposal, +50% yield & +40 influence.' },
};

const MONUMENT_SUFFIX_MAP: Record<string, NodeTextEn> = {
  _t1: { name: 'Guided Tours & Plaza Events', description: 'Boosts visitor ticket fees and district activity.', tradeoffNote: '+30% civic yields and stronger voter mood.' },
  _t2: { name: 'Rainwater Retention Basin', description: 'Supplies plaza landscaping without tapping city mains.', tradeoffNote: '-45% water usage, drought immunity.' },
  _t3: { name: 'Anti-Smog Botanical Shield', description: 'Reduces particulate smog drifting across nearby blocks.', tradeoffNote: '-4 local pollution.' },
  _t4: { name: 'VIP Exhibition Pavilion', description: 'Draws affluent tourists and executive footfall.', tradeoffNote: '+45% plaza yield and +15 influence.' },
  _flagship: { name: 'Grand Civic Heritage Complex (Flagship Project)', description: 'Monumental urban centerpiece elevating the entire skyline.', tradeoffNote: '+85% yield, +30 influence and potent smog shield.' },
};

function lookupBuildingTechNodeEn(
  node: { id: string; name: string; description: string; tradeoffNote: string }
): NodeTextEn {
  const explicit = EXPLICIT_NODES_EN[node.id];
  if (explicit) return explicit;

  // Monument variants
  for (const monPrefix of ['monumentFounder', 'monumentObelisk', 'monumentHelipad', 'monumentFountain']) {
    if (node.id.startsWith(monPrefix)) {
      const suffix = node.id.slice(monPrefix.length);
      if (MONUMENT_SUFFIX_MAP[suffix]) return MONUMENT_SUFFIX_MAP[suffix];
    }
  }

  // Mining shared tree
  for (const mPrefix of Object.keys(MINING_CLEAN_FILTER_EN)) {
    if (node.id === `${mPrefix}_auto`) {
      return {
        name: 'Automation & Robotics',
        description: 'Automated haulers and cutters reduce manual crew overhead.',
        tradeoffNote: '-35% staff & payroll tax, +35% electricity, +20% output.',
      };
    }
    if (node.id === `${mPrefix}_deep`) {
      return {
        name: 'Deep Shaft Extraction',
        description: 'Pushes output from deeper seams at the cost of higher equipment wear.',
        tradeoffNote: '+48% output, but +45% wear rate and +15% breakdown risk.',
      };
    }
    if (node.id === `${mPrefix}_filters`) {
      return {
        name: MINING_CLEAN_FILTER_EN[mPrefix],
        description: 'Dust capture, noise insulation, and closed tailings protect nearby zones.',
        tradeoffNote: 'Clears eco fines and shields voter approval nearby.',
      };
    }
    if (node.id === `${mPrefix}_ai_dispatch`) {
      return {
        name: 'Digital Geology & Predictive Ops',
        description: 'Seismic telemetry and predictive servicing curb unscheduled outages.',
        tradeoffNote: '+28% output, -18% maintenance, -25% wear rate.',
      };
    }
    if (node.id === `${mPrefix}_mega_shaft`) {
      return {
        name: 'Mega-Scale Ore Hoist Shaft',
        description: 'Upgrades primary haulage infrastructure to full conglomerate capacity.',
        tradeoffNote: '+40% output and 2x buffer capacity, higher power draw.',
      };
    }
    if (node.id === `${mPrefix}_apex`) {
      return {
        name: 'Autonomous AI Mine (Flagship Project)',
        description: 'Driverless deep shafts with underground laser ore sorting.',
        tradeoffNote: 'Flagship Project: +65% extraction, -35% costs, 3x buffer, top 2.5D look!',
      };
    }
  }

  // Processing shared tree
  for (const pPrefix of ['steel', 'cable', 'prefab', 'refinery', 'chem', 'jewelry', 'elec', 'semi', 'weapons', 'enrich', 'battery', 'diamlux']) {
    if (node.id === `${pPrefix}_lean`) {
      return {
        name: 'Lean Lines & Robotics',
        description: 'Precision batch dosing reduces scrap waste and manual staffing.',
        tradeoffNote: '-30% headcount payroll, -14% input costs, +25% electricity draw.',
      };
    }
    if (node.id === `${pPrefix}_overdrive`) {
      return {
        name: 'Peak Overdrive Throughput',
        description: 'Runs furnaces and lines past nameplate speed during price spikes.',
        tradeoffNote: '+45% throughput, but +50% wear rate and +20% water draw.',
      };
    }
    if (node.id === `${pPrefix}_scrubber`) {
      return {
        name: 'Closed Water Loop & Scrubbers',
        description: 'Process water recycling paired with dust-free flue gas capture.',
        tradeoffNote: '-40% water draw, drought shield, and zero eco fines.',
      };
    }
    if (node.id === `${pPrefix}_iso_b2b`) {
      return {
        name: 'B2B Export Quality Certification',
        description: 'Precision QA labs and freight buffers tailored for long-term contracts.',
        tradeoffNote: '+24% output/revenue and 2x cargo buffer capacity.',
      };
    }
    if (node.id === `${pPrefix}_smart_factory`) {
      return {
        name: 'Industry 4.0 Digital Twin',
        description: 'Full campus integration and predictive sensor maintenance.',
        tradeoffNote: '+35% efficiency, -30% equipment wear rate.',
      };
    }
    if (node.id === `${pPrefix}_apex`) {
      return {
        name: '24/7 Automated AI Factory (Flagship Project)',
        description: 'Fully autonomous lights-out manufacturing floor with molecular QA.',
        tradeoffNote: 'Flagship Project: +65% efficiency, -40% staff payroll, -35% cost, 2.5D look!',
      };
    }
  }

  return { name: node.name, description: node.description, tradeoffNote: node.tradeoffNote };
}

export function translateBuildingTechNode<
  T extends { id: string; name: string; description: string; tradeoffNote: string },
>(node: T, lang: 'pl' | 'en'): T {
  if (lang === 'pl') return node;
  return { ...node, ...lookupBuildingTechNodeEn(node) };
}

export function translateBuildingDef<
  T extends {
    type: BuildingType;
    name: string;
    shortName: string;
    description: string;
    strategyHint: string;
    specialEffects: string[];
  },
>(def: T, lang: 'pl' | 'en'): T {
  if (lang === 'pl') return def;
  const en = BUILDINGS_EN[def.type];
  return en ? { ...def, ...en } : def;
}
