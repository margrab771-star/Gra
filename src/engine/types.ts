// ─── Core Union Types (erasableSyntaxOnly & JSON-serializable) ────────────────

export type GamePhase = 'MainMenu' | 'Setup' | 'Lobby' | 'Playing' | 'GameOver';

export type GameSpeed = 0 | 0.5 | 1 | 2 | 5 | 10;

export type GameMode = 'challenge1h' | 'endless' | 'mp_fast' | 'mp_long';

export type CorporationLevel = 1 | 2 | 3 | 4 | 5;

export type TerrainType =
  | 'grass'
  | 'forest'
  | 'water'
  | 'mountain'
  | 'desert'
  | 'coastal'
  | 'urban';

export type ResourceType =
  | 'coal'
  | 'ironOre'
  | 'copper'
  | 'gold'
  | 'oil'
  | 'uranium'
  | 'rareMetals'
  | 'gravel'
  | 'water'
  | 'steel'
  | 'fuel'
  | 'chemicals'
  | 'electronics'
  | 'semiconductors'
  | 'prefabs'
  | 'electricity'
  | 'jewelry'
  | 'weapons'
  | 'diamonds'
  | 'lithium'
  | 'sewage'
  | 'waste'
  | 'batteries';

export type BuildingCategory =
  | 'mining'
  | 'processing'
  | 'energy'
  | 'logistics'
  | 'real_estate'
  | 'attractions'
  | 'finance'
  | 'education'
  | 'safety'
  | 'influence'
  | 'military'
  | 'waste';

export type RoadClass = 'none' | 'local' | 'highway' | 'bridge';

export type TollRate = 'free' | 'low' | 'standard' | 'high' | 'prohibitive';

export type MapHeatmapMode =
  | 'standard'
  | 'response_time'
  | 'security'
  | 'environment'
  | 'logistics';

export type EmergencyServiceKind = 'fire' | 'hazmat' | 'medical' | 'police';

export type BuildingType =
  // Kopalnie i wydobycie
  | 'coalMine'
  | 'ironMine'
  | 'copperMine'
  | 'goldMine'
  | 'rareMetalsMine'
  | 'uraniumMine'
  | 'quarry'
  | 'oilWell'
  | 'waterPlant'
  // Przemysł i przetwórstwo
  | 'oilRefinery'
  | 'steelMill'
  | 'copperCablePlant'
  | 'chemicalPlant'
  | 'electronicsFactory'
  | 'semiconductorFab'
  | 'prefabFactory'
  | 'jewelryWorkshop'
  | 'weaponsComplex'
  | 'spaceCenter'
  // Energetyka i logistyka wielomodalna
  | 'coalPowerPlant'
  | 'hydroPowerPlant'
  | 'renewableFarm'
  | 'nuclearPowerPlant'
  | 'warehouse'
  | 'cargoPort'
  | 'cargoAirport'
  // Nieruchomości, atrakcje, usługi i finanse
  | 'corporateHQ'
  | 'hotel'
  | 'resort'
  | 'officeTower'
  | 'shoppingMall'
  | 'amusementPark'
  | 'culturalCenter'
  | 'marinaPromenade'
  | 'casino'
  | 'investmentBank'
  | 'mediaAgency'
  // Edukacja, bezpieczeństwo, zdrowie i wpływy
  | 'highSchool'
  | 'university'
  | 'rdLab'
  | 'hospital'
  | 'fireStation'
  | 'hazmatBase'
  | 'policeStation'
  | 'lobbyOffice'
  | 'churchFoundation'
  | 'intelligenceCenter'
  | 'militaryBase'
  // Nowe budynki v4.5
  | 'windFarm'
  | 'solarFarm'
  | 'gasPowerPlant'
  | 'geothermalPlant'
  | 'fusionReactor'
  | 'sewagePlant'
  | 'wasteIncinerator'
  | 'recyclingPlant'
  | 'uraniumEnrichment'
  | 'coldStorage'
  | 'diamondMine'
  | 'lithiumMine'
  | 'batteryFactory'
  | 'jewelryLuxury'
  // Transport pasażerski i struktury miejskie/tech v6.0
  | 'busDepot'
  | 'metroStation'
  | 'trainStation'
  | 'passengerTerminal'
  | 'apartmentComplex'
  | 'gastronomyBoulevard'
  | 'cityPark'
  | 'arenaStadium'
  | 'conventionCenter'
  | 'lawFirm'
  | 'prAgency'
  | 'dataCenter'
  | 'biotechLab'
  | 'verticalFarm'
  | 'compositeShipyard'
  // Rozbudowa Ścieki i Odpady
  | 'wasteLandfill'
  | 'bioSewagePlant'
  | 'closedLoopSewagePlant'
  | 'plasmaGasificationPlant';

export type ArchetypeId =
  | 'standard'
  | 'investment_fund'
  | 'industrial_giant'
  | 'tech_incubator'
  | 'logistics_cartel'
  | 'eco_innovator';

export type DifficultyPreset = 'rozruch' | 'standard' | 'kryzysowy' | 'przetrwanie';

export type ScenarioId =
  | 'sandbox'
  | 'fallen_giant'
  | 'green_transition'
  | 'cold_war'
  | 'gold_rush';

export type GovernmentKind = 'free_market' | 'ecological' | 'interventionist';

export type HQVariantId = 'classic' | 'golden' | 'eco_dome' | 'cyber_citadel';

export type AchievementCategory =
  | 'economy'
  | 'industry'
  | 'politics'
  | 'multiplayer'
  | 'extreme';

export type TechBranch = 'industrial' | 'modern' | 'logistics' | 'safety' | 'military';

export type InfluencePillar = 'financial' | 'military' | 'social';

export type EntrepreneurBranch =
  | 'finance'
  | 'negotiation'
  | 'logistics'
  | 'technology'
  | 'influence';

export type AIStrategy =
  | 'industrialist'
  | 'energyMagnate'
  | 'realEstate'
  | 'shadowBroker'
  | 'military'
  | 'supplyChain';

export type ArticleType = 'positive' | 'negative' | 'neutral' | 'opportunity' | 'forecast';

export type NodeStatus = 'locked' | 'available' | 'researching' | 'done' | 'excluded';

export type ConnectionStatus = 'local' | 'connected' | 'disconnected' | 'ai_takeover';

// ─── Geometry & Renderer Types ────────────────────────────────────────────────

export interface Position {
  x: number;
  y: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  targetZoom: number;
}

export interface DepthSortable {
  gridX: number;
  gridY: number;
}

export interface Vehicle {
  id: string;
  sourcePlotId: string;
  destinationPlotId: string;
  routePlotIds: string[];
  routeSegment: number;
  progress: number; // 0..1 within current segment
  speed: number;
  type:
    | 'truck'
    | 'bus'
    | 'ship'
    | 'plane'
    | 'fireTruck'
    | 'hazmatTruck'
    | 'ambulance'
    | 'policeCar'
    | 'helicopter'
    | 'metro'
    | 'train';
  cargo: ResourceType | null;
  ownerId: string;
}

export interface TransportRouteLine {
  fromPlotId: string;
  toPlotId: string;
  mode: 'road' | 'sea' | 'air';
  ownerId: string;
}

export interface ActiveFuelDelivery {
  fromPlotId: string;
  toPlotId: string;
  resource: ResourceType;
  mode: 'road' | 'sea' | 'air';
  ownerId: string;
}

export interface ActiveB2BRoute {
  contractId: string;
  fromPlotId: string;
  toPlotId: string;
  resource: ResourceType;
  mode: 'road' | 'sea' | 'air';
  ownerId: string;
}

export interface ServiceDispatch {
  id: string;
  targetPlotId: string;
  incidentKind: HazardState['kind'];
  serviceKind: EmergencyServiceKind;
  stationPlotId: string;
  status: 'en_route' | 'on_scene' | 'queued';
  etaTicks: number;
  totalEtaTicks: number;
  usesHelicopter: boolean;
}

// ─── Requirements System ──────────────────────────────────────────────────────

export interface NonFinancialRequirements {
  minWorkerSkill?: number;
  requiredBuildings?: BuildingType[];
  requiredEntrepreneurSkill?: string;
  requiredGlobalTech?: string;
  requiredResources?: Partial<Record<ResourceType, number>>;
  requiresPowerSurplus?: boolean;
  requiresWaterAccess?: boolean;
  requiredCorpLevel?: CorporationLevel;
  minVoterApproval?: number;
  requiredInfluenceScore?: number;
  requiredTechCount?: number;
}

export interface RequirementCheckItem {
  id: string;
  label: string;
  met: boolean;
  hint: string;
  missingResource?: { resource: ResourceType; missingAmount: number; spotCost: number };
}

// ─── Market & Commodities ─────────────────────────────────────────────────────

export interface PriceCandle {
  tick: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ResourceDefinition {
  type: ResourceType;
  name: string;
  genitiveName: string;
  emoji: string;
  unit: string;
  category: 'raw' | 'processed' | 'energy' | 'hightech' | 'utility';
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  volatility: number;
  elasticity: number;
  description: string;
  tradeable?: boolean;
}

export interface ResourcePrice {
  type: ResourceType;
  name: string;
  emoji: string;
  unit: string;
  price: number;
  previousPrice: number;
  basePrice: number;
  changePercent: number;
  supply: number;
  demand: number;
  history: number[];
  candles: PriceCandle[];
}

export interface ResourceDeposit {
  type: ResourceType;
  amount: number;
  richness: number;
  discovered: boolean;
}

// ─── Plot, Offers & Spatial Grid ──────────────────────────────────────────────

export interface SynergyBreakdownItem {
  kind: 'retail_zone' | 'entertainment_district' | 'innovation_campus' | 'industrial_cluster' | 'passenger_hub' | 'smog_penalty' | 'park_mitigation';
  label: string;
  percentDelta: number;
  sourcePlotId?: string;
}

export interface Plot {
  id: string;
  gridX: number;
  gridY: number;
  terrain: TerrainType;
  ownerId: string | null;
  basePrice: number;
  price: number;
  deposits: ResourceDeposit[];
  surveyed: boolean;
  surveyedBy: Record<string, boolean>;
  building: Building | null;
  hasRoad: boolean;
  roadType: RoadClass;
  tollRate: TollRate;
  roadBlocked: boolean;
  blockedPlayers: string[];
  tollRevenueTotal: number;
  isPlayerRoad?: boolean;
  hasElectricity: boolean;
  hasWater: boolean;
  attractiveness: number;
  neighborPenalty: number;
  attractionBonus: number; // synergy from nearby parks/cultural centers/marinas
  synergyPercent?: number;
  passengerDemandPercent?: number;
  activeSynergies?: SynergyBreakdownItem[];
  crimeScore: number;
  responseEta?: number;
  purchasable: boolean;
  distanceToRoad: number;
  irradiatedTicks?: number;
  disasterDamagedTicks?: number;
}

export type MapPlot = Plot;

export interface PlotOffer {
  id: string;
  plotId: string;
  gridX: number;
  gridY: number;
  fromPlayerId: string;
  fromName: string;
  toPlayerId: string;
  toName: string;
  offeredPrice: number;
  includeBuilding: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  counterPrice?: number;
  createdTick: number;
}

// ─── Building, Hazards & Internal Tech Tree ───────────────────────────────────

export interface HazardState {
  kind: 'fire' | 'chemical_leak' | 'radiation' | 'medical_accident' | 'robbery';
  severity: number; // 1..3
  ticksRemaining: number;
  contained: boolean;
  responderBuildingId?: string;
  destructionProgress?: number; // 0..100: po 100% budynek staje się ruiną!
}

export interface BuildingUpgradeEffect {
  productionBonus?: number;
  costReduction?: number;
  workerReduction?: number;
  electricityDelta?: number;
  waterDelta?: number;
  sewageDelta?: number;
  wasteDelta?: number;
  sewageTreatmentBonus?: number;
  wasteProcessingBonus?: number;
  recyclesResources?: boolean;
  pollutionDelta?: number;
  breakdownRiskDelta?: number;
  wearRateDelta?: number;
  influenceBonus?: number;
  tariffBonus?: number;
  droughtProtection?: boolean;
  blackoutProtection?: boolean;
  cleanFilter?: boolean;
  researchBonus?: number;
  storageMultiplier?: number;
  hazmatUnlocked?: boolean;
  companyWideCoverage?: boolean;
  safetyRangeBonus?: number;
  fleetCapacityBonus?: number;
  fleetSpeedBonus?: number;
  helicopterDispatch?: boolean;
  espionageDefenseBonus?: number;
  crimeReductionBonus?: number;
  tacticalMissileUnlocked?: boolean;
  isApex?: boolean;
}

export interface BuildingTechNode {
  id: string;
  name: string;
  description: string;
  tradeoffNote: string;
  cost: number;
  researchTicks: number;
  progress: number;
  status: NodeStatus;
  prerequisites: string[];
  exclusiveWith?: string[];
  category: 'efficiency' | 'capacity' | 'green' | 'monopoly' | 'special' | 'apex' | 'flagship';
  effects: BuildingUpgradeEffect;
  tier: 1 | 2 | 3 | 4;
  isApex?: boolean;
  isFlagship?: boolean;
  graphPos: Position;
  requirements?: NonFinancialRequirements;
}

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  shortName: string;
  category: BuildingCategory;
  requiredCorpLevel: CorporationLevel;
  icon: string;
  description: string;
  strategyHint: string;
  baseCost: number;
  buildConstructionInputs: Partial<Record<ResourceType, number>>;
  requiredTerrain: TerrainType[];
  requiredDeposit?: ResourceType;
  maxWorkers: number;
  minSkillRequired: number;
  baseMaintenance: number;
  baseRevenue: number;
  inputs: Partial<Record<ResourceType, number>>;
  outputs: Partial<Record<ResourceType, number>>;
  electricityUsage: number;
  waterUsage: number;
  sewageUsage?: number;
  wasteUsage?: number;
  pollutionLevel: number;
  storageCapacity: number;
  unlockTech?: string;
  requirements?: NonFinancialRequirements;
  specialEffects: string[];
  internalTechTree: Omit<BuildingTechNode, 'progress' | 'status'>[];
}

export interface BuildingCosts {
  inputs: number;
  wages: number;
  zus: number;
  energy: number;
  water: number;
  transport: number;
  maintenance: number;
  environmentalFine: number;
  taxes: number;
  total: number;
}

export interface BuildingStatusFlags {
  noPower: boolean;
  noWater: boolean;
  breakdown: boolean;
  storageFull: boolean;
  upgradeActive: boolean;
  understaffed: boolean;
  droughtHit: boolean;
  boycotted: boolean;
  onFire: boolean;
  hazmatIncident: boolean;
  noRoadLink: boolean;
  robberyActive?: boolean;
  missingInputs?: boolean;
  sewageCrisis?: boolean;
  wasteCrisis?: boolean;
  disasterStruck?: boolean;
  onStrike?: boolean;
  noFuel?: boolean;
}

export interface Building {
  id: string;
  type: BuildingType;
  plotId: string;
  ownerId: string;
  name: string;
  category: BuildingCategory;
  icon: string;
  level: number;
  visualTier?: number;
  upgradeFlashTicks?: number;
  condition: number;
  damagePercent: number;
  destroyedRuins?: boolean;
  autoRepairEnabled: boolean;
  autoRepairThreshold: number;
  insured?: boolean;
  insuranceClaimsCount?: number;
  strikeTicks?: number;
  hqVariant?: HQVariantId;
  workers: number;
  maxWorkers: number;
  workerSkill: number;
  efficiency: number;
  isActive: boolean;
  selected: boolean;
  stockpileOutput: boolean;
  storage: Partial<Record<ResourceType, number>>;
  storageCapacity: number;
  techTree: BuildingTechNode[];
  activeResearchId: string | null;
  revenue: number;
  costs: BuildingCosts;
  netProfit: number;
  productionPerTick: Partial<Record<ResourceType, number>>;
  consumptionPerTick: Partial<Record<ResourceType, number>>;
  status: BuildingStatusFlags;
  activeHazard: HazardState | null;
  hasRoadConnection: boolean;
  logisticsMode: 'road' | 'sea' | 'air' | 'isolated';
  fleetSize?: number;
  maxFleetSize?: number;
  fleetType?: EmergencyServiceKind;
  crimeLevel?: number;
  sabotagedTicks: number;
  boycottedTicks: number;
  // v8.0 fizyczne paliwo elektrowni
  fuelLevel?: number;
  fuelStored?: number;
  fuelMax?: number;
  fuelResource?: ResourceType;
  fuelSourceMode?: 'none' | 'mine' | 'b2b' | 'market';
  emergencyMarketImport?: boolean;
}

// ─── Utility & Resource Balance Report ────────────────────────────────────────

export interface ClusterUtilitySummary {
  clusterId: number;
  label: string;
  electricityProduced: number;
  electricityConsumed: number;
  electricityNet: number;
  electricityCoverageRatio: number;
  waterProduced: number;
  waterConsumed: number;
  waterNet: number;
  waterCoverageRatio: number;
  sewageProduced: number;
  sewageTreated: number;
  sewageNet: number;
  wasteProduced: number;
  wasteProcessed: number;
  wasteNet: number;
  buildingCount: number;
}

export interface UtilityBalanceReport {
  electricityProduced: number;
  electricityConsumed: number;
  electricityNet: number;
  electricityCoverageRatio: number;
  electricityByPlant: { label: string; produced: number }[];
  electricityConsumers: { label: string; consumed: number }[];
  waterProduced: number;
  waterConsumed: number;
  waterNet: number;
  waterCoverageRatio: number;
  waterSources: { label: string; produced: number }[];
  waterConsumers: { label: string; consumed: number }[];
  sewageProduced: number;
  sewageTreated: number;
  sewageNet: number;
  wasteProduced: number;
  wasteProcessed: number;
  wasteNet: number;
  clusters?: ClusterUtilitySummary[];
  isolatedClusterCount?: number;
  resourceBalances: {
    resource: ResourceType;
    produced: number;
    b2bImport: number;
    consumed: number;
    b2bExport: number;
    net: number;
  }[];
}

// ─── HR & ZUS ─────────────────────────────────────────────────────────────────

export interface ZUSBreakdown {
  emerytalna: number;
  rentowa: number;
  wypadkowa: number;
  fp: number;
  fgsp: number;
  zdrowotnaInfo: number;
  totalEmployerRate: number;
  totalAmount: number;
}

// ─── B2B Contracts ────────────────────────────────────────────────────────────

export interface B2BContract {
  id: string;
  sellerId: string;
  buyerId: string;
  sellerName: string;
  buyerName: string;
  resource: ResourceType;
  quantityPerTick: number;
  pricePerUnit: number;
  durationTicks: number;
  remainingTicks: number;
  status: 'proposed' | 'open_listing' | 'active' | 'cancelled' | 'completed';
  totalValueDelivered: number;
  kind?: 'recurring' | 'spot' | 'barter';
  barterResource?: ResourceType;
  barterQtyPerTick?: number;
  listingSide?: 'sell' | 'buy';
  blockedReason?: string;
  transportMode?: 'road' | 'sea' | 'air' | 'blocked';
}

// ─── Global Tech & Entrepreneur Trees ─────────────────────────────────────────

export interface TechNode {
  id: string;
  name: string;
  description: string;
  branch: TechBranch;
  cost: number;
  moneyCost: number;
  researchTicks: number;
  progress: number;
  status: NodeStatus;
  prerequisites: string[];
  effects: string[];
  position: Position;
  unlocksBuildings?: BuildingType[];
  modifiers: {
    miningBonus?: number;
    processingBonus?: number;
    energyBonus?: number;
    logisticsReduction?: number;
    militaryPower?: number;
    sabotageDefense?: number;
    sabotageAttack?: number;
    droughtShield?: number;
    researchSpeed?: number;
    taxReduction?: number;
    safetyBonus?: number;
  };
}

export interface SkillNode {
  id: string;
  name: string;
  description: string;
  branch: EntrepreneurBranch;
  cashCost: number;
  skillPointCost: number;
  status: NodeStatus;
  prerequisites: string[];
  effects: string[];
  position: Position;
  tier?: number;
  isApex?: boolean;
  requiredCorpLevel?: CorporationLevel;
  requiredInfluenceScore?: number;
  requiredGlobalTechCount?: number;
  modifiers: {
    profitBonus?: number;
    taxReduction?: number;
    loanInterestReduction?: number;
    sellPriceBonus?: number;
    buyPriceDiscount?: number;
    buyoutDiscount?: number;
    transportDiscount?: number;
    warehouseDiscount?: number;
    researchDiscount?: number;
    researchSpeedBonus?: number;
    influencePowerBonus?: number;
    socialInfluenceStart?: number;
    militaryInfluenceBonus?: number;
    plotNegotiationBonus?: number;
    safetyDiscount?: number;
  };
}

// ─── Influence & Politics ─────────────────────────────────────────────────────

export interface InfluenceAction {
  id: string;
  name: string;
  pillar: InfluencePillar;
  description: string;
  cost: number;
  cooldownTicks: number;
  requiredScore: number;
  requiresTargetPlayer?: boolean;
  requiresTargetBuilding?: boolean;
  requiresTargetPlot?: boolean;
  estimatedEffect: string;
  requiredTech?: string;
}

export interface InfluenceScores {
  financial: number;
  military: number;
  social: number;
  churchSupport: number;
  mediaControl: number;
  voterApproval: number;
}

// ─── Loans & Finance ──────────────────────────────────────────────────────────

export interface Loan {
  id: string;
  bankName: string;
  principal: number;
  interestRate: number;
  remainingAmount: number;
  paymentPerTick: number;
  remainingTicks: number;
}

export interface CorporateBond {
  id: string;
  issuerId: string;
  principal: number;
  couponRate: number;
  remainingAmount: number;
  paymentPerTick: number;
  remainingTicks: number;
}

export interface CorporateStock {
  companyId: string;
  companyName: string;
  color: string;
  sharePrice: number;
  previousPrice: number;
  changePercent: number;
  priceHistory: number[];
  dividendPerShareTick: number;
  totalDividendsPaid: number;
  holdings: Record<string, number>; // holderId -> % (0..100)
}

export interface FinancialHistoryPoint {
  tick: number;
  label: string;
  revenue: number;
  costs: number;
  netIncome: number;
  netWorth: number;
}

export interface MonopolyShare {
  resource: ResourceType;
  name: string;
  emoji: string;
  playerShare: number;
  leaderName: string;
  leaderId: string;
}

// ─── Newspaper & Events ───────────────────────────────────────────────────────

export interface EventEffect {
  kind:
    | 'priceMultiplier'
    | 'demandMultiplier'
    | 'taxDelta'
    | 'zusDelta'
    | 'hydroPenalty'
    | 'waterPenalty'
    | 'energyPenalty'
    | 'weatherCloudy'
    | 'disasterDamage'
    | 'strikeRisk'
    | 'voterMoodDelta'
    | 'researchBoost';
  target?: ResourceType | 'all';
  value: number;
}

export interface GameEvent {
  id: string;
  templateId: string;
  name: string;
  description: string;
  category: 'weather' | 'economy' | 'policy' | 'labor' | 'opportunity' | 'disaster';
  effects: EventEffect[];
  durationTicks: number;
  remainingTicks: number;
  isForecastPending?: boolean;
  forecastTicksRemaining?: number;
  mitigationHint: string;
}

export interface NewsArticle {
  id: string;
  headline: string;
  brief: string;
  fullText: string;
  analysis: string;
  hints: string[];
  type: ArticleType;
  dateLabel: string;
  tick: number;
  read: boolean;
  relatedResource?: ResourceType;
  focusPlotId?: string;
}

// ─── Coalitions, Patents, Tenders, Market Cycles, Chat & Blasts ───────────────

export interface Coalition {
  id: string;
  name: string;
  tag: string;
  color: string;
  leaderId: string;
  memberIds: string[];
  invitedPlayerIds: string[];
  shareGeology: boolean;
  createdTick: number;
}

export interface NonAggressionPact {
  id: string;
  playerAId: string;
  playerBId: string;
  status: 'proposed' | 'active';
  expiresTick: number;
}

export interface TradeEmbargo {
  issuerId: string;
  targetId: string;
  expiresTick: number;
}

export interface PatentRecord {
  techId: string;
  techName: string;
  ownerId: string;
  ownerName: string;
  royaltyPerTick: number;
  grantedTick: number;
  expiresTick: number;
  totalRoyaltiesEarned: number;
}

export interface GovernmentTender {
  id: string;
  title: string;
  description: string;
  kind: 'resource_delivery' | 'clean_energy';
  requirements: Partial<Record<ResourceType, number>>;
  requiredCleanMW?: number;
  deliveredByPlayer: Record<string, Partial<Record<ResourceType, number>>>;
  cashReward: number;
  influenceReward: number;
  voterMoodReward: number;
  deadlineTick: number;
  status: 'open' | 'awarded' | 'expired';
  winnerId?: string;
  winnerName?: string;
}

export type MarketSectorKey = 'gold_luxury' | 'energy' | 'tech' | 'industry' | 'green';
export type MarketCyclePhase = 'hossa' | 'korekta' | 'banka' | 'krach';

export interface MarketCycleState {
  sector: MarketSectorKey;
  name: string;
  phase: MarketCyclePhase;
  multiplier: number;
  ticksRemaining: number;
  indexValue: number;
  previousIndexValue: number;
  changePercent: number;
  history: number[];
}

export interface VisualBlastEffect {
  id: string;
  kind: 'missile' | 'nuke' | 'earthquake' | 'tornado' | 'flood';
  centerX: number;
  centerY: number;
  radius: number;
  createdTick: number;
  ticksRemaining: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  companyName: string;
  color: string;
  text: string;
  tick: number;
  timestamp: number;
  pingPlot?: {
    plotId: string;
    gridX: number;
    gridY: number;
    label: string;
  };
}

// ─── Leaderboard & Save Slots ─────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: string;
  rank: number;
  playerName: string;
  companyName: string;
  netWorth: number;
  strategy: string;
  score: number;
  mode: GameMode;
  date: string;
  isCurrentPlayer?: boolean;
  source?: 'local' | 'supabase';
}

export type SaveSlotId = 'autosave' | 'slot1' | 'slot2' | 'slot3';

export interface SaveSlotMeta {
  slotId: SaveSlotId;
  label: string;
  companyName: string;
  mode: GameMode;
  gameDateLabel: string;
  challengeTimeRemaining: number;
  netWorth: number;
  savedAt: number;
}

export interface LastMpSession {
  roomCode: string;
  playerName: string;
  companyName: string;
  color: string;
  isHost: boolean;
  updatedAt: number;
}

// ─── v6.0 & v7.0 Expansion Types (Profiles, Archetypes, Secrets, Mutators, Auctions) ───

export interface MutatorFlags {
  fogOfWar: boolean;
  noLoans: boolean;
  volatileMarket: boolean;
  freeLocalRoads: boolean;
  extremeClimate: boolean;
}

export interface SecretGoal {
  id: string;
  templateId: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unitLabel: string;
  completed: boolean;
  completedTick?: number;
  rewardCash: number;
  rewardInfluence: number;
  rewardDominanceBonus: number;
  rewardXp: number;
}

export interface LiveAuctionState {
  id: string;
  plotId: string;
  gridX: number;
  gridY: number;
  title: string;
  description: string;
  startingBid: number;
  currentBid: number;
  highestBidderId: string | null;
  highestBidderName: string | null;
  minIncrement: number;
  secondsRemaining: number;
  startedAtMs: number;
  expiresAtMs: number;
  bidsCount: number;
  sellerPlayerId?: string | null;
  status: 'active' | 'settled' | 'cancelled';
}

export interface GovernmentElectionState {
  currentGov: GovernmentKind;
  nextElectionTick: number;
  lastElectionTick: number;
  lobbyVotes: Record<GovernmentKind, number>;
  lastWinnerSummary?: string;
}

export interface CloneBlueprint {
  buildingType: BuildingType;
  unlockedTechIds: string[];
  fleetSize: number;
  insured: boolean;
  stockpileOutput: boolean;
  autoRepairEnabled: boolean;
  autoRepairThreshold: number;
  baseCost: number;
  upgradesCost: number;
  fleetCost: number;
  totalCost: number;
  includeUpgrades: boolean;
}

export interface MatchStatSample {
  tick: number;
  label: string;
  players: Record<
    string,
    {
      netWorth: number;
      cash: number;
      incomePerTick: number;
      influence: number;
      approval: number;
    }
  >;
}

export interface MatchFunAward {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  playerId: string;
  companyName: string;
  color: string;
  valueLabel: string;
}

export interface PlayerCardProfile {
  accountId: string;
  nick: string;
  level: number;
  xp: number;
  avatar: string;
  frameId: string;
  titleId: string;
  pinnedBadgeIds: string[];
  hqVariant: HQVariantId;
}

export interface LifetimeRecords {
  highestNetWorth: number;
  fastestDominanceTicks: number | null;
  longestWinStreak: number;
  currentWinStreak: number;
  biggestSingleDeal: number;
  mostOwnedPlots: number;
  matchesPlayed: number;
  matchesWon: number;
  secretGoalsCompleted: number;
  weeklyBestScore?: {
    weekKey: string;
    netWorth: number;
    ticks: number;
    date: string;
  } | null;
}

export interface MatchRecordEntry {
  id: string;
  date: string;
  mode: GameMode;
  scenario: ScenarioId;
  difficulty: string;
  won: boolean;
  rank: number;
  totalPlayers: number;
  netWorth: number;
  durationTicks: number;
  xpEarned: number;
  isWeekly?: boolean;
  weekKey?: string;
}

export interface UserAccountProfile {
  id: string;
  nick: string;
  pinHash: string;
  isGuest: boolean;
  createdAt: number;
  xp: number;
  level: number;
  avatar: string;
  frameId: string;
  titleId: string;
  hqVariant: HQVariantId;
  unlockedAchievements: string[];
  unlockedCosmetics: string[];
  pinnedBadgeIds: string[];
  records: LifetimeRecords;
  matchHistory: MatchRecordEntry[];
}

export interface PlayerMatchStatsAccum {
  maxDebt: number;
  tollEarned: number;
  peakMarketTradeProfit: number;
  totalPollution: number;
  greenScore: number;
  bailiffSeizures: number;
  stockDividendsAndTrades: number;
  patentsOwnedCount: number;
  highApprovalTicks: number;
  ownedPlotsPeak: number;
}

// ─── Player ───────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  companyName: string;
  color: string;
  isAI: boolean;
  aiStrategy?: AIStrategy;
  aiDifficulty?: number;
  connectionStatus: ConnectionStatus;
  peerId?: string;
  corporationLevel: CorporationLevel;
  cash: number;
  netWorth: number;
  incomePerMin: number;
  expensesPerMin: number;
  cashFlowPerMin: number;
  electricityBalance: number;
  waterBalance: number;
  sewageBalance?: number;
  wasteBalance?: number;
  researchPoints: number;
  skillPoints: number;
  reputation: number;
  militaryPower: number;
  influence: InfluenceScores;
  globalTech: Record<string, { status: NodeStatus; progress: number }>;
  entrepreneurSkills: Record<string, NodeStatus>;
  loans: Loan[];
  bonds: CorporateBond[];
  inspectionRisk: number;
  warehouseStockpile: Partial<Record<ResourceType, number>>;
  stockLocations?: Record<string, Partial<Record<ResourceType, number>>>;
  defaultAutoRepair: { enabled: boolean; threshold: number };
  activeTaxReliefTicks: number;
  spiedPlayers: Record<string, number>;
  actionCooldowns: Record<string, number>;
  financialHistory: FinancialHistoryPoint[];
  lastTickRevenueByCategory: Record<string, number>;
  lastTickCostsByCategory: Record<string, number>;
  lastTickTaxes: { cit: number; property: number; environmental: number };
  dominantStrategy: string;
  totalRevenueEarned: number;
  isEliminated: boolean;
  insolvencyGraceTicks?: number;
  insolvencyReason?: string;
  coalitionId?: string | null;
  leftCoalitionCooldown?: number;
  secretNuclearRevealed?: boolean;
  nuclearProjectActive?: boolean;
  nuclearProjectProgress?: number;
  nuclearWarheadsReady?: number;
  nuclearDetectedByPlayers?: string[];
  pinnedResources?: ResourceType[];
  // v6.0 & v7.0
  archetype?: ArchetypeId;
  hqVariant?: HQVariantId;
  playerCard?: PlayerCardProfile;
  secretGoals?: SecretGoal[];
  secretGoalDominanceBonus?: number;
  revealedFogPlots?: Record<string, boolean>;
  skillMilestonesEarned?: string[];
  statsAccum?: PlayerMatchStatsAccum;
}

// ─── Game Time & Settings ─────────────────────────────────────────────────────

export interface GameTime {
  tick: number;
  day: number;
  month: number;
  year: number;
  hour: number;
  minute: number;
}

export type DominationThreshold = 65 | 70 | 75 | 80 | 85;

export interface GameSettings {
  mode: GameMode;
  playerCount: number;
  aiDifficulty: number;
  mapSize: number;
  challengeDurationSeconds: number;
  economyMultiplier: number;
  disastersEnabled?: boolean;
  victoryMode?: 'solo' | 'coalition';
  dominationThreshold?: number;
  difficultyPreset?: DifficultyPreset;
  scenarioId?: ScenarioId;
  mutators?: MutatorFlags;
  mapSeed?: number;
  weeklyChallengeId?: string;
  weeklyTargetNetWorth?: number;
  weeklyMaxYear?: number;
  weeklyBannedBuildings?: BuildingType[];
}

export interface DisconnectAlert {
  playerId: string;
  playerName: string;
  companyName: string;
  timestamp: number;
}

export interface SpeedRequest {
  playerId: string;
  playerName: string;
  requestedSpeed: GameSpeed;
  timestamp: number;
}

export interface GameState {
  phase: GamePhase;
  speed: GameSpeed;
  time: GameTime;
  elapsedSeconds: number;
  lastSyncTimestamp: number;
  speedRequest: SpeedRequest | null;
  settings: GameSettings;
  challengeTimeRemaining: number;
  challengeCompleted: boolean;
  winnerId: string | null;
  winningCoalitionId?: string | null;
  victoryReason: string | null;
  players: Player[];
  currentPlayerId: string;
  plots: Plot[];
  resourcePrices: ResourcePrice[];
  globalTechDefs: TechNode[];
  entrepreneurSkillDefs: SkillNode[];
  activeEvents: GameEvent[];
  pendingForecasts: GameEvent[];
  news: NewsArticle[];
  contracts: B2BContract[];
  plotOffers: PlotOffer[];
  vehicles: Vehicle[];
  transportLines: TransportRouteLine[];
  dispatches: ServiceDispatch[];
  fuelDeliveries?: ActiveFuelDelivery[];
  b2bRoutes?: ActiveB2BRoute[];
  stocks: CorporateStock[];
  coalitions?: Coalition[];
  naps?: NonAggressionPact[];
  embargoes?: TradeEmbargo[];
  patents?: PatentRecord[];
  tenders?: GovernmentTender[];
  marketCycles?: MarketCycleState[];
  blastEffects?: VisualBlastEffect[];
  chatMessages?: ChatMessage[];
  networkRevision?: number;
  taxRate: number;
  zusMultiplier: number;
  baseInterestRate: number;
  voterMood: number;
  laborShortageIndex: number;
  activeLaws: string[];
  monopolyThreshold: number;
  disconnectAlert: DisconnectAlert | null;
  notifications: GameNotification[];
  // v6.0 & v7.0
  government?: GovernmentElectionState;
  liveAuction?: LiveAuctionState | null;
  matchStatsHistory?: MatchStatSample[];
  greenTransitionEntered?: boolean;
  carbonTaxActive?: boolean;
}

export interface GameNotification {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'danger';
  tick: number;
  focusPlotId?: string;
}

// ─── Multiplayer Network Messages ─────────────────────────────────────────────

export interface LobbyPlayer {
  id: string;
  peerId: string;
  name: string;
  companyName: string;
  color: string;
  isHost: boolean;
  isAI: boolean;
  aiStrategy?: AIStrategy;
  ready: boolean;
  connected: boolean;
  archetype?: ArchetypeId;
  playerCard?: PlayerCardProfile;
}

export interface LobbyState {
  roomCode: string;
  mode: 'mp_fast' | 'mp_long';
  mapSize: number;
  aiDifficulty: number;
  maxPlayers: number;
  players: LobbyPlayer[];
  gameStarted: boolean;
  disastersEnabled: boolean;
  victoryMode: 'solo' | 'coalition';
  dominationThreshold?: number;
  difficultyPreset?: DifficultyPreset;
  scenarioId?: ScenarioId;
  mutators?: MutatorFlags;
}

export type PlayerAction =
  | { type: 'buyPlot'; playerId: string; plotId: string }
  | { type: 'sellPlot'; playerId: string; plotId: string }
  | { type: 'surveyPlot'; playerId: string; plotId: string }
  | { type: 'surveyArea'; playerId: string; plotId: string }
  | { type: 'buildPlayerRoad'; playerId: string; plotId: string; roadClass?: 'local' | 'highway' | 'bridge' }
  | {
      type: 'setRoadPolicy';
      playerId: string;
      plotId: string;
      tollRate?: TollRate;
      roadBlocked?: boolean;
      toggleBlockedPlayerId?: string;
    }
  | { type: 'buyServiceVehicle'; playerId: string; buildingId: string }
  | { type: 'tradeStock'; playerId: string; targetCompanyId: string; shareDeltaPercent: number }
  | { type: 'issueBond'; playerId: string; amount: number }
  | {
      type: 'greyMarketAction';
      playerId: string;
      actionId: 'black_arms' | 'black_fuel' | 'tax_shelter' | 'bribe_auditor';
    }
  | { type: 'proposePlotOffer'; playerId: string; plotId: string; offeredPrice: number; includeBuilding: boolean }
  | {
      type: 'respondPlotOffer';
      playerId: string;
      offerId: string;
      response: 'accept' | 'reject' | 'counter';
      counterPrice?: number;
    }
  | { type: 'buildOnPlot'; playerId: string; plotId: string; buildingType: BuildingType }
  | { type: 'demolishBuilding'; playerId: string; plotId: string }
  | { type: 'repairBuilding'; playerId: string; buildingId: string }
  | { type: 'setAutoRepair'; playerId: string; buildingId: string; enabled: boolean; threshold: number }
  | {
      type: 'applyAutoRepairTemplate';
      playerId: string;
      enabled: boolean;
      threshold: number;
      setAsDefault: boolean;
    }
  | { type: 'toggleStockpile'; playerId: string; buildingId: string }
  | { type: 'sellWarehouseStock'; playerId: string; resource: ResourceType; amount: number }
  | { type: 'buyWarehouseStock'; playerId: string; resource: ResourceType; amount: number }
  | { type: 'researchBuildingTech'; playerId: string; buildingId: string; nodeId: string }
  | { type: 'hireWorkers'; playerId: string; buildingId: string; count: number }
  | { type: 'fireWorkers'; playerId: string; buildingId: string; count: number }
  | { type: 'trainWorkers'; playerId: string; buildingId: string }
  | { type: 'researchGlobalTech'; playerId: string; nodeId: string }
  | { type: 'unlockSkill'; playerId: string; nodeId: string }
  | { type: 'takeLoan'; playerId: string; amount: number; months: number }
  | { type: 'repayLoan'; playerId: string; loanId: string }
  | {
      type: 'proposeContract';
      playerId: string;
      partnerId: string;
      resource: ResourceType;
      quantityPerTick: number;
      pricePerUnit: number;
      durationTicks: number;
      isSelling: boolean;
      kind?: 'recurring' | 'spot' | 'barter';
      barterResource?: ResourceType;
      barterQtyPerTick?: number;
      openListing?: boolean;
    }
  | { type: 'acceptContract'; playerId: string; contractId: string }
  | { type: 'cancelContract'; playerId: string; contractId: string }
  | {
      type: 'executeInfluence';
      playerId: string;
      actionId: string;
      targetPlayerId?: string;
      targetPlotId?: string;
      targetBuildingId?: string;
    }
  | { type: 'launchTacticalMissile'; playerId: string; targetPlotId: string }
  | { type: 'startNuclearProject'; playerId: string }
  | { type: 'launchNuclearStrike'; playerId: string; targetPlotId: string }
  | { type: 'createCoalition'; playerId: string; name: string; tag: string; color: string }
  | { type: 'inviteCoalition'; playerId: string; targetPlayerId: string }
  | { type: 'respondCoalitionInvite'; playerId: string; coalitionId: string; accept: boolean }
  | { type: 'leaveCoalition'; playerId: string }
  | { type: 'toggleCoalitionGeology'; playerId: string }
  | { type: 'proposeNAP'; playerId: string; targetPlayerId: string }
  | { type: 'acceptNAP'; playerId: string; napId: string }
  | { type: 'imposeEmbargo'; playerId: string; targetPlayerId: string }
  | { type: 'submitTenderDelivery'; playerId: string; tenderId: string }
  | {
      type: 'sendChatMessage';
      playerId: string;
      text: string;
      pingPlot?: { plotId: string; gridX: number; gridY: number; label: string };
    }
  | { type: 'setSpeed'; playerId: string; speed: GameSpeed }
  | { type: 'requestSpeedChange'; playerId: string; speed: GameSpeed }
  | { type: 'dismissSpeedRequest'; playerId: string }
  // v6.0 & v7.0 batch & meta actions
  | { type: 'batchBuyPlots'; playerId: string; plotIds: string[] }
  | { type: 'batchSurveyPlots'; playerId: string; plotIds: string[] }
  | { type: 'batchBuildRoad'; playerId: string; plotIds: string[]; roadClass: 'local' | 'highway' | 'bridge' }
  | { type: 'toggleEmergencyFuelImport'; playerId: string; buildingId: string }
  | { type: 'applyHighwayPolicyToAll'; playerId: string; tollRate: TollRate; roadBlocked: boolean }
  | {
      type: 'cloneBuilding';
      playerId: string;
      plotId: string;
      sourceBuildingId: string;
      includeUpgrades: boolean;
    }
  | { type: 'toggleInsurance'; playerId: string; buildingId: string }
  | { type: 'placeAuctionBid'; playerId: string; auctionId: string; bidAmount: number }
  | { type: 'lobbyElection'; playerId: string; govKind: GovernmentKind; useInfluence: boolean }
  | { type: 'revealFogPlot'; playerId: string; plotId: string };
