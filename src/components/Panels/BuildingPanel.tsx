import React, { useState } from 'react';
import { SERVICE_VEHICLE_COST } from '../../config/gameConfig';
import { RESOURCE_DEFINITIONS, TRADEABLE_RESOURCE_LIST } from '../../data/resources';
import { BUILDING_DEFINITIONS } from '../../data/buildings';
import {
  getInsurancePremiumPerTick,
  getPhysicalInputSpecsForBuilding,
  getPlayerWarehouseCapacitySummary,
  getPowerPlantFuelSpec,
  getRepairCost,
  getResourceStorageSplitPercent,
} from '../../engine/BuildingSystem';
import { getSafetyCoverageForPlot, getStationEffectiveMaxFleet } from '../../engine/HazardSystem';
import { calculateZUSBreakdown, getTrainingCost } from '../../engine/HRSystem';
import {
  getSuggestedPlotBuyoutValuation,
  isPlotBuildingVisibleToViewer,
} from '../../engine/PlotSystem';
import { evaluateNonFinancialRequirements } from '../../engine/RequirementsSystem';
import { hasExternalMarketAccess } from '../../engine/TransportSystem';
import type { Building, BuildingTechNode, BuildingType, EmergencyServiceKind, GameState, Player, Plot, ResourceType } from '../../engine/types';
import { BUILDINGS_EN, translateBuildingTechNode } from '../../i18n/buildingsEn';
import {
  localizeResourceName,
  localizeResourceUnit,
  localizeSynergyLabel,
} from '../../i18n/dataTranslations';
import { useI18n } from '../../i18n/useI18n';
import { formatMoney } from '../../utils/formatters';
import { DarkNumberInput, DarkToggle } from '../HUD/DarkControls';

interface BuildingPanelProps {
  plot: Plot;
  building: Building;
  gameState: GameState;
  currentPlayer: Player;
  onResearchTech: (buildingId: string, nodeId: string) => void;
  onHire: (buildingId: string, count: number) => void;
  onFire: (buildingId: string, count: number) => void;
  onTrain: (buildingId: string) => void;
  onRepair: (buildingId: string) => void;
  onSetAutoRepair: (buildingId: string, enabled: boolean, threshold: number) => void;
  onApplyAutoRepairTemplate: (enabled: boolean, threshold: number, setAsDefault: boolean) => void;
  onBuyMissingResource: (resource: ResourceType, amount: number) => void;
  onToggleStockpile: (buildingId: string) => void;
  onSetStockpileAllocation?: (opts: {
    globalPercent?: number;
    resource?: ResourceType;
    resourcePercent?: number | null;
  }) => void;
  onAcceptContract?: (contractId: string) => void;
  onRejectContract?: (contractId: string) => void;
  onCancelContract?: (contractId: string) => void;
  onBuyServiceVehicle?: (buildingId: string) => void;
  onDemolish: (plotId: string) => void;
  onCloneBuilding?: (buildingType: BuildingType) => void;
  onStartCloneBlueprint?: (buildingId: string, buildingType: BuildingType) => void;
  onToggleInsurance?: (buildingId: string) => void;
  onToggleEmergencyFuelImport?: (buildingId: string) => void;
  onRevealFogPlot?: (plotId: string) => void;
  onOpenB2BMarket?: () => void;
  onProposePlotOffer?: (
    plotId: string,
    offeredPrice: number,
    includeBuilding: boolean
  ) => void;
  onProposeContract: (
    partnerId: string,
    resource: ResourceType,
    qty: number,
    price: number,
    duration: number,
    isSelling: boolean
  ) => void;
  onClose: () => void;
}

type TabKey = 'finance' | 'logistics' | 'tech' | 'hr' | 'b2b';

export const BuildingPanel: React.FC<BuildingPanelProps> = React.memo(
  ({
    plot,
    building,
    gameState,
    currentPlayer,
    onResearchTech,
    onHire,
    onFire,
    onTrain,
    onRepair,
    onSetAutoRepair,
    onApplyAutoRepairTemplate,
    onBuyMissingResource,
    onToggleStockpile,
    onSetStockpileAllocation,
    onAcceptContract,
    onRejectContract,
    onCancelContract,
    onBuyServiceVehicle,
    onDemolish,
    onCloneBuilding,
    onStartCloneBlueprint,
    onToggleInsurance,
    onToggleEmergencyFuelImport,
    onRevealFogPlot,
    onOpenB2BMarket,
    onProposePlotOffer,
    onProposeContract,
    onClose,
  }) => {
    const { t, lang } = useI18n();
    const buildingName =
      lang === 'en' ? BUILDINGS_EN[building.type]?.name ?? building.name : building.name;
    const [tab, setTab] = useState<TabKey>('finance');
    const [confirmDemolish, setConfirmDemolish] = useState(false);
    const [selectedTechId, setSelectedTechId] = useState<string>(building.techTree[0]?.id ?? '');
    const [setAsDefaultTpl, setSetAsDefaultTpl] = useState(true);
    const [includeBldgOffer, setIncludeBldgOffer] = useState(true);
    const suggestedBuyout = getSuggestedPlotBuyoutValuation(plot, includeBldgOffer);
    const [offerPrice, setOfferPrice] = useState<number>(suggestedBuyout);

    // Stan formularza B2B
    const rivals = gameState.players.filter((p) => p.id !== currentPlayer.id && !p.isEliminated);
    const defaultRes =
      (Object.keys(building.productionPerTick)[0] as ResourceType) ??
      (Object.keys(building.consumptionPerTick)[0] as ResourceType) ??
      'steel';
    const [partnerId, setPartnerId] = useState<string>(rivals[0]?.id ?? '');
    const [contractRes, setContractRes] = useState<ResourceType>(defaultRes);
    const [contractQty, setContractQty] = useState<number>(6);
    const [contractPrice, setContractPrice] = useState<number>(
      gameState.resourcePrices.find((r) => r.type === defaultRes)?.price ?? 250
    );
    const [contractDuration, setContractDuration] = useState<number>(25);
    const [isSelling, setIsSelling] = useState<boolean>(true);

    const isMine = building.ownerId === currentPlayer.id;
    const isWarehouse = building.type === 'warehouse';
    const warehouseSummary = isWarehouse && isMine ? getPlayerWarehouseCapacitySummary(gameState, currentPlayer) : null;
    const thisWhSummary = warehouseSummary?.warehouses.find((w) => w.plot.id === plot.id);
    const [customSplitRes, setCustomSplitRes] = useState<ResourceType>('steel');

    const producedPerTickByRes: Partial<Record<ResourceType, number>> = {};
    if (isWarehouse && isMine) {
      for (const pl of gameState.plots) {
        if (pl.ownerId !== currentPlayer.id || !pl.building || pl.building.destroyedRuins) continue;
        for (const [rk, amt] of Object.entries(pl.building.productionPerTick ?? {})) {
          if (rk === 'electricity' || rk === 'water' || RESOURCE_DEFINITIONS[rk as ResourceType]?.tradeable === false) {
            continue;
          }
          const r = rk as ResourceType;
          producedPerTickByRes[r] = (producedPerTickByRes[r] ?? 0) + (amt ?? 0);
        }
        const defOut = BUILDING_DEFINITIONS[pl.building.type]?.outputs ?? {};
        for (const rk of Object.keys(defOut)) {
          if (rk === 'electricity' || rk === 'water' || RESOURCE_DEFINITIONS[rk as ResourceType]?.tradeable === false) {
            continue;
          }
          const r = rk as ResourceType;
          if (producedPerTickByRes[r] === undefined) producedPerTickByRes[r] = 0;
        }
      }
      for (const rk of Object.keys(currentPlayer.stockpileAllocation?.byResource ?? {})) {
        if (rk === 'electricity' || rk === 'water' || RESOURCE_DEFINITIONS[rk as ResourceType]?.tradeable === false) {
          continue;
        }
        const r = rk as ResourceType;
        if (producedPerTickByRes[r] === undefined) producedPerTickByRes[r] = 0;
      }
      for (const [rk, amt] of Object.entries(currentPlayer.warehouseStockpile ?? {})) {
        if (
          rk === 'electricity' ||
          rk === 'water' ||
          RESOURCE_DEFINITIONS[rk as ResourceType]?.tradeable === false ||
          (amt ?? 0) <= 0.05
        ) {
          continue;
        }
        const r = rk as ResourceType;
        if (producedPerTickByRes[r] === undefined) producedPerTickByRes[r] = 0;
      }
    }
    const warehouseResourceList = Object.keys(producedPerTickByRes) as ResourceType[];
    const globalStorePct = currentPlayer.stockpileAllocation?.globalPercent ?? 30;
    const owner = gameState.players.find((p) => p.id === building.ownerId);
    const trainingCost = getTrainingCost(building);
    const zusDetails = calculateZUSBreakdown(building.costs.wages, gameState.zusMultiplier);
    const repairCost = getRepairCost(building);
    const safety = getSafetyCoverageForPlot(gameState, building.ownerId, plot);

    const rawSelectedTechNode: BuildingTechNode | undefined =
      building.techTree.find((n) => n.id === selectedTechId) ?? building.techTree[0];
    const selectedTechNode: BuildingTechNode | undefined = rawSelectedTechNode
      ? translateBuildingTechNode(rawSelectedTechNode, lang)
      : undefined;

    const selectedReqEval = rawSelectedTechNode
      ? evaluateNonFinancialRequirements(
          rawSelectedTechNode.requirements,
          currentPlayer,
          gameState,
          building,
          plot
        )
      : { allMet: true, items: [] };

    const isBuildingVisible = isPlotBuildingVisibleToViewer(
      plot,
      currentPlayer.id,
      currentPlayer,
      gameState
    );
    const insurancePremium = getInsurancePremiumPerTick(building);
    const synergyList = plot.activeSynergies ?? [];
    const totalSynergyPct = synergyList.reduce((sum, item) => sum + item.percentDelta, 0);

    if (!isBuildingVisible) {
      return (
        <div className="space-y-3 text-sm animate-fadeIn">
          <div className="flex items-start justify-between border-b border-[#243044] pb-2.5 gap-2">
            <div>
              <div className="text-xs font-mono text-amber-400">
                {t('bldg.fogSector', { x: plot.gridX, y: plot.gridY })}
              </div>
              <h3 className="text-base font-bold text-slate-100">{t('bldg.fogUnknown')}</h3>
              <div className="text-[11px] text-slate-400">
                {t('bldg.owner')}{' '}
                <span style={{ color: owner?.color }} className="font-semibold">
                  {owner?.companyName ?? t('bldg.rivalFallback')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hidden md:flex w-7 h-7 rounded bg-[#1c2434] text-slate-400 hover:text-white items-center justify-center shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-amber-500/40 space-y-2.5 text-xs">
            <p className="text-slate-300 leading-relaxed">{t('bldg.fogDesc')}</p>
            {onRevealFogPlot && (
              <button
                type="button"
                disabled={currentPlayer.cash < 280_000 && currentPlayer.influence.military < 25}
                onClick={() => onRevealFogPlot(plot.id)}
                className="w-full py-2.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold transition-colors"
              >
                {t('bldg.revealIntelBtn', { cost: formatMoney(280_000) })}
              </button>
            )}
          </div>

          {onProposePlotOffer && owner && (
            <div className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-2 text-xs">
              <div className="font-semibold text-amber-300">{t('bldg.blindBuyoutTitle')}</div>
              <DarkToggle
                checked={includeBldgOffer}
                onChange={(v) => {
                  setIncludeBldgOffer(v);
                  setOfferPrice(getSuggestedPlotBuyoutValuation(plot, v));
                }}
                label={t('bldg.blindIncludeBuilding')}
              />
              <DarkNumberInput value={offerPrice} onChange={setOfferPrice} min={10000} step={10000} />
              <button
                type="button"
                disabled={currentPlayer.cash < offerPrice}
                onClick={() => onProposePlotOffer(plot.id, offerPrice, includeBldgOffer)}
                className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold"
              >
                {t('bldg.submitBuyoutBtn', { price: formatMoney(offerPrice) })}
              </button>
            </div>
          )}
        </div>
      );
    }

    const logisticsLabel =
      building.logisticsMode === 'air'
        ? t('bldg.logAir')
        : building.logisticsMode === 'sea'
          ? t('bldg.logSea')
          : building.logisticsMode === 'isolated'
            ? t('bldg.logIsolated')
            : t('bldg.logRoad');

    return (
      <div className="space-y-3 text-sm animate-fadeIn">
        {/* Nagłówek obiektu */}
        <div className="flex items-start justify-between border-b border-[#243044] pb-2.5 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">{building.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-slate-100 leading-tight">{buildingName}</h3>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[10px]">
                  {t('bldg.lvlShort', { lvl: building.level })}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono text-[10px]">
                  {t('bldg.visualTier', { tier: building.visualTier ?? 0 })}
                </span>
                {(building.visualTier ?? 0) >= 4 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-bold text-[10px]">
                    {t('bldg.flagshipBadge')}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {t('bldg.owner')}{' '}
                <span style={{ color: owner?.color }} className="font-medium">
                  {owner?.companyName}
                </span>{' '}
                · ({plot.gridX}, {plot.gridY})
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isMine && !building.destroyedRuins && (onStartCloneBlueprint || onCloneBuilding) && (
              <button
                type="button"
                onClick={() =>
                  onStartCloneBlueprint
                    ? onStartCloneBlueprint(building.id, building.type)
                    : onCloneBuilding?.(building.type)
                }
                className="px-2 py-1 rounded bg-[#182235] hover:bg-[#22314a] border border-sky-500/40 text-sky-300 text-[11px] font-semibold"
                title={t('bldg.cloneTitle')}
              >
                {t('bldg.cloneBtn')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="hidden md:flex w-7 h-7 rounded bg-[#1c2434] text-slate-400 hover:text-white items-center justify-center shrink-0"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Czerwony baner twardej blokady przy braku drogi */}
        {!building.destroyedRuins &&
          building.type !== 'corporateHQ' &&
          building.type !== 'cityPark' &&
          (building.status.noRoadLink || building.logisticsMode === 'isolated') && (
            <div className="p-2.5 rounded-xl bg-rose-950/80 border-2 border-rose-500 text-rose-100 text-xs font-semibold flex items-start gap-2 shadow-[0_0_16px_rgba(244,63,94,0.25)]">
              <span className="text-base shrink-0 animate-pulse">🚫🛣️</span>
              <span>{t('bldg.noRoadBanner')}</span>
            </div>
          )}

        {/* Widok RUIN po pożarze lub katastrofie */}
        {building.destroyedRuins && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/60 space-y-2 text-xs">
            <div className="font-bold text-rose-200 flex items-center gap-1.5">
              <span>{t('bldg.ruinsTitle')}</span>
            </div>
            <p className="text-rose-200/80 leading-relaxed">{t('bldg.ruinsDesc')}</p>
            {isMine && (
              <button
                type="button"
                onClick={() => onDemolish(plot.id)}
                className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                {t('bldg.clearRuinsBtn', {
                  cost: formatMoney(Math.max(5000, Math.round(BUILDING_DEFINITIONS[building.type].baseCost * 0.12))),
                })}
              </button>
            )}
          </div>
        )}

        {/* Alerty statusowe i zagrożenia */}
        {!building.destroyedRuins &&
          (building.status.onFire ||
            building.status.robberyActive ||
            building.status.hazmatIncident ||
            building.activeHazard ||
            building.status.missingInputs ||
            building.status.sewageCrisis ||
            building.status.wasteCrisis ||
            building.status.disasterStruck ||
            building.status.noPower ||
            building.status.noWater ||
            building.status.breakdown ||
            building.status.droughtHit ||
            building.status.boycotted) && (
            <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-500/40 text-xs text-rose-200 space-y-1">
              {(building.status.onFire || building.activeHazard?.kind === 'fire') && (
                <div className="text-orange-300 font-semibold space-y-1">
                  <div>
                    {t('bldg.fireActive')}{' '}
                    {building.activeHazard?.contained
                      ? t('bldg.fireContained')
                      : t('bldg.fireDispatched')}
                  </div>
                  {(building.activeHazard?.destructionProgress ?? 0) > 0 && (
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px]">
                        <span>{t('bldg.destructionPct')}</span>
                        <span className="font-mono">{Math.round(building.activeHazard?.destructionProgress ?? 0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500"
                          style={{ width: `${Math.min(100, building.activeHazard?.destructionProgress ?? 0)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(building.status.robberyActive || building.activeHazard?.kind === 'robbery') && (
                <div className="text-rose-300 font-semibold">
                  {t('bldg.robberyActive')}{' '}
                  {building.activeHazard?.contained
                    ? t('bldg.robberyContained')
                    : t('bldg.robberyDispatched')}
                </div>
              )}
              {(building.status.hazmatIncident ||
                (building.activeHazard &&
                  building.activeHazard.kind !== 'fire' &&
                  building.activeHazard.kind !== 'robbery')) && (
                <div className="text-lime-300 font-semibold space-y-1">
                  <div>
                    {t('bldg.hazmatActive')}{' '}
                    {building.activeHazard?.contained
                      ? t('bldg.hazmatContained')
                      : t('bldg.hazmatDispatched')}
                  </div>
                  {(building.activeHazard?.destructionProgress ?? 0) > 0 && (
                    <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-lime-500"
                        style={{ width: `${Math.min(100, building.activeHazard?.destructionProgress ?? 0)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
              {building.status.missingInputs && (
                <div className="flex items-center justify-between gap-2 text-rose-300 font-semibold">
                  <span>{t('bldg.missingInputs')}</span>
                  {onOpenB2BMarket && (
                    <button
                      type="button"
                      onClick={onOpenB2BMarket}
                      className="px-2 py-0.5 rounded bg-sky-600/30 border border-sky-400/50 text-sky-200 text-[10px]"
                    >
                      {t('bldg.b2bMarketLink')}
                    </button>
                  )}
                </div>
              )}
              {building.status.sewageCrisis && (
                <div className="text-teal-300">{t('bldg.sewageCrisis')}</div>
              )}
              {building.status.wasteCrisis && (
                <div className="text-lime-300">{t('bldg.wasteCrisis')}</div>
              )}
              {building.status.disasterStruck && (
                <div className="text-amber-300">{t('bldg.disasterStruck')}</div>
              )}
              {building.status.breakdown && <div>{t('bldg.breakdownAlert')}</div>}
              {building.status.noPower && <div>{t('bldg.noPowerAlert')}</div>}
            {building.status.noWater && <div>{t('bldg.noWaterAlert')}</div>}
            {building.status.droughtHit && <div>{t('bldg.droughtHitAlert')}</div>}
            {building.status.boycotted && <div>{t('bldg.boycottedAlert')}</div>}
          </div>
        )}

        {/* Logistyka i pokrycie służb na całej mapie */}
        <div className="p-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-[11px] flex flex-wrap items-center justify-between gap-2">
          <span className="text-slate-300">{logisticsLabel}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`px-1.5 py-0.5 rounded border ${
                safety.hasFireStation
                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title={t('bldg.fireTitle')}
            >
              🚒 {safety.hasFireStation ? `${safety.fireEta ?? 1}T` : t('bldg.noneShort')}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded border ${
                safety.hasHazmat
                  ? 'bg-lime-500/15 border-lime-500/35 text-lime-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title={t('bldg.hazmatTitle')}
            >
              ☣️ {safety.hasHazmat ? `${safety.hazmatEta ?? 1}T` : t('bldg.noneShort')}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded border ${
                safety.hasHospital
                  ? 'bg-sky-500/15 border-sky-500/35 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title={t('bldg.hospitalTitle')}
            >
              🏥 {safety.hasHospital ? `${safety.hospitalEta ?? 1}T` : t('bldg.noneShort')}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded border ${
                safety.hasPolice
                  ? 'bg-blue-500/15 border-blue-400/35 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title={t('bldg.policeTitle')}
            >
              🚓 {safety.hasPolice ? `${Math.round(safety.policePatrolRatio * 100)}%` : t('bldg.noneShort')}
            </span>
          </div>
        </div>

        {/* Aktywne Synergie i Otoczenie */}
        <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-200">{t('bldg.synergiesTitle')}</span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-400/35 text-sky-300">
                {t('bldg.demandBadge', { pct: Math.round(plot.passengerDemandPercent ?? 100) })}
              </span>
              {synergyList.length > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded border font-bold ${
                    totalSynergyPct >= 0
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
                  }`}
                >
                  {totalSynergyPct >= 0 ? `+${totalSynergyPct}%` : `${totalSynergyPct}%`}
                </span>
              )}
            </div>
          </div>
          {synergyList.length === 0 ? (
            <div className="text-slate-400">{t('bldg.noSynergies')}</div>
          ) : (
            <div className="space-y-1">
              {synergyList.map((syn, idx) => (
                <div
                  key={`${syn.label}_${idx}`}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#131b2b]"
                >
                  <span className="text-slate-200 truncate">{localizeSynergyLabel(syn.label, lang)}</span>
                  <span
                    className={`font-mono font-semibold shrink-0 ${
                      syn.percentDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {syn.percentDelta >= 0 ? `+${syn.percentDelta}%` : `${syn.percentDelta}%`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zarządzanie Flotą Pojazdów (Remiza / HAZMAT / Szpital / Policja) */}
        {isMine &&
          (building.type === 'fireStation' ||
            building.type === 'hazmatBase' ||
            building.type === 'hospital' ||
            building.type === 'policeStation') && (
            <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-sky-500/35 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sky-300">{t('bldg.fleetTitle')}</span>
                <span className="font-mono text-slate-200 font-bold">
                  {t('bldg.fleetCount', {
                    cur: building.fleetSize ?? 2,
                    max: getStationEffectiveMaxFleet(building),
                  })}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>
                  {t('bldg.fleetInAction')}{' '}
                  {
                    (gameState.dispatches ?? []).filter(
                      (d) => d.stationPlotId === plot.id && d.status !== 'queued'
                    ).length
                  }{' '}
                  · {lang === 'en' ? 'Helicopters:' : 'Śmigłowce:'}{' '}
                  {building.techTree.some((t) => t.status === 'done' && t.effects.helicopterDispatch)
                    ? t('bldg.fleetHeliYes')
                    : t('bldg.fleetHeliNo')}
                </span>
              </div>
              {onBuyServiceVehicle &&
                (building.fleetSize ?? 2) < getStationEffectiveMaxFleet(building) && (
                  <button
                    type="button"
                    onClick={() => onBuyServiceVehicle(building.id)}
                    className="w-full py-1.5 rounded bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/45 text-sky-200 font-semibold"
                  >
                    {t('bldg.buyVehicleBtn', {
                      cost: formatMoney(
                        SERVICE_VEHICLE_COST[
                          (building.fleetType ?? 'fire') as EmergencyServiceKind
                        ]
                      ),
                    })}
                  </button>
                )}
            </div>
          )}

        {/* Oferta wykupu budynku/działki należącego do konkurenta */}
        {!isMine && onProposePlotOffer && (
          <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-amber-500/35 space-y-2 text-xs">
            <div className="font-semibold text-amber-300">
              {t('bldg.makeBuyoutOffer', { company: owner?.companyName ?? '' })}
            </div>
            <DarkToggle
              checked={includeBldgOffer}
              onChange={(inc) => {
                setIncludeBldgOffer(inc);
                setOfferPrice(getSuggestedPlotBuyoutValuation(plot, inc));
              }}
              label={t('bldg.includeStructureLabel', { name: buildingName })}
            />
            <div className="flex items-center gap-2">
              <DarkNumberInput
                value={offerPrice}
                onChange={setOfferPrice}
                min={10000}
                step={10000}
                className="flex-1"
              />
              <button
                type="button"
                disabled={currentPlayer.cash < offerPrice}
                onClick={() => onProposePlotOffer(plot.id, offerPrice, includeBldgOffer)}
                className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-40 shrink-0"
              >
                {t('bldg.sendOfferBtn')}
              </button>
            </div>
          </div>
        )}

        {/* Paski zniszczenia i efektywności */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-[#0b0f17] border border-[#243044]">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>{t('bldg.damageLabel')}</span>
              <span
                className={`font-mono font-bold ${
                  building.damagePercent >= 60
                    ? 'text-rose-400'
                    : building.damagePercent >= 30
                      ? 'text-amber-300'
                      : 'text-emerald-400'
                }`}
              >
                {Math.round(building.damagePercent)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  building.damagePercent >= 60
                    ? 'bg-rose-500'
                    : building.damagePercent >= 30
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(4, building.damagePercent))}%` }}
              />
            </div>
          </div>

          <div className="p-2 rounded-lg bg-[#0b0f17] border border-[#243044]">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>{t('bldg.efficiencyLabel')}</span>
              <span className="font-mono text-sky-300 font-bold">{building.efficiency}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-300"
                style={{ width: `${Math.min(100, building.efficiency * 0.65)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Zakładki */}
        <div
          className={`grid ${isWarehouse && isMine ? 'grid-cols-5' : 'grid-cols-4'} gap-1 p-1 rounded-lg bg-[#0b0f17] border border-[#243044] text-[11px]`}
        >
          {[
            { key: 'finance', label: t('bldg.tabFinance') },
            ...(isWarehouse && isMine ? [{ key: 'logistics', label: t('bldg.tabLogistics') }] : []),
            { key: 'tech', label: t('bldg.tabTech') },
            { key: 'hr', label: t('bldg.tabHr') },
            { key: 'b2b', label: t('bldg.tabB2B') },
          ].map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key as TabKey)}
              className={`py-1.5 px-1 rounded font-medium transition-all truncate ${
                tab === tb.key
                  ? 'bg-[#1c2638] text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* ── SEKCJA ZARZĄDZANIA ZAPASAMI I PODZIAŁEM MAGAZYNU (LOGISTYKA / FINANSE MAGAZYNU) ── */}
        {isWarehouse && isMine && warehouseSummary && (tab === 'logistics' || tab === 'finance') && (
          <div className="p-3 rounded-lg bg-[#0b0f17] border border-amber-500/35 space-y-3 text-xs animate-fadeIn">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-amber-300">{t('bldg.whSplitTitle')}</span>
              <span className="font-mono font-bold text-slate-100">
                {warehouseSummary.totalUsed.toFixed(1)} / {warehouseSummary.totalCapacity} t
              </span>
            </div>

            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-[#151c28] border border-[#243044] overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (warehouseSummary.totalUsed / Math.max(1, warehouseSummary.totalCapacity)) * 100)}%`,
                  }}
                />
              </div>
              {thisWhSummary && warehouseSummary.warehouses.length > 1 && (
                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>{t('bldg.thisWarehouse', { x: plot.gridX, y: plot.gridY })}</span>
                  <span className="font-mono text-slate-300">
                    {thisWhSummary.used.toFixed(1)} / {thisWhSummary.capacity} t
                  </span>
                </div>
              )}
            </div>

            {onSetStockpileAllocation && (
              <div className="p-2.5 rounded-lg bg-[#131b2b] border border-[#243044] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-200 font-semibold">{t('bldg.globalSplitLabel')}</span>
                  <span className="font-mono text-[11px]">
                    <span className="text-amber-300">📦 {globalStorePct}%</span>
                    <span className="text-slate-500"> / </span>
                    <span className="text-emerald-300">💹 {100 - globalStorePct}%</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={globalStorePct}
                  onChange={(e) => onSetStockpileAllocation({ globalPercent: Number(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{t('bldg.storePct', { pct: globalStorePct })}</span>
                  <span>{t('bldg.exportPct', { pct: 100 - globalStorePct })}</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[0, 25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => onSetStockpileAllocation({ globalPercent: pct })}
                      className={`py-1 rounded border text-[10px] font-mono transition-colors ${
                        globalStorePct === pct
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-bold'
                          : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">
                  {t('bldg.perResSplitHeader', { count: warehouseResourceList.length })}
                </span>
                {onSetStockpileAllocation && (
                  <div className="flex items-center gap-1">
                    <select
                      value={customSplitRes}
                      onChange={(e) => setCustomSplitRes(e.target.value as ResourceType)}
                      className="bg-[#151c28] border border-[#2d3b52] rounded px-1.5 py-0.5 text-[10px] text-slate-200"
                    >
                      {TRADEABLE_RESOURCE_LIST.map((rk) => (
                        <option key={rk} value={rk}>
                          {RESOURCE_DEFINITIONS[rk].emoji}{' '}
                          {localizeResourceName(rk, RESOURCE_DEFINITIONS[rk].name, lang)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        onSetStockpileAllocation({ resource: customSplitRes, resourcePercent: globalStorePct })
                      }
                      className="px-1.5 py-0.5 rounded bg-sky-600/25 border border-sky-400/40 text-[10px] text-sky-200"
                      title={t('bldg.addRuleTitle')}
                    >
                      {t('bldg.addRuleBtn')}
                    </button>
                  </div>
                )}
              </div>

              {warehouseResourceList.length === 0 ? (
                <div className="p-2 rounded bg-[#131b2b] border border-[#243044] text-slate-400 text-[11px]">
                  {t('bldg.noWhRes')}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                  {warehouseResourceList.map((rk) => {
                    const rd = RESOURCE_DEFINITIONS[rk];
                    const customVal = currentPlayer.stockpileAllocation?.byResource?.[rk];
                    const effPct = getResourceStorageSplitPercent(currentPlayer, rk);
                    const stockAmt = currentPlayer.warehouseStockpile[rk] ?? 0;
                    const rate = producedPerTickByRes[rk] ?? 0;
                    return (
                      <div key={rk} className="p-2 rounded bg-[#131b2b] border border-[#243044] space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-100">
                            {rd.emoji} {localizeResourceName(rk, rd.name, lang)}
                            <span className="ml-1.5 font-mono text-[10px] text-slate-400">
                              ({stockAmt.toFixed(1)} {localizeResourceUnit(rd.unit, lang)} · +{rate.toFixed(1)}/T)
                            </span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-amber-300">
                              {t('bldg.magExpShort', { store: effPct, exp: 100 - effPct })}
                            </span>
                            {customVal !== undefined && onSetStockpileAllocation && (
                              <button
                                type="button"
                                onClick={() => onSetStockpileAllocation({ resource: rk, resourcePercent: null })}
                                className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-[9px] text-slate-300"
                                title={t('bldg.resetGlobalTitle')}
                              >
                                {t('bldg.resetGlobalBtn')}
                              </button>
                            )}
                          </div>
                        </div>
                        {onSetStockpileAllocation && (
                          <>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={effPct}
                              onChange={(e) =>
                                onSetStockpileAllocation({
                                  resource: rk,
                                  resourcePercent: Number(e.target.value),
                                })
                              }
                              className="w-full accent-amber-400 cursor-pointer"
                            />
                            <div className="grid grid-cols-5 gap-1">
                              {[0, 25, 50, 75, 100].map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => onSetStockpileAllocation({ resource: rk, resourcePercent: pct })}
                                  className={`py-0.5 rounded border text-[10px] font-mono ${
                                    effPct === pct
                                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold'
                                      : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="text-[10px] text-slate-400">
                {t('bldg.whOverflowHint', { cap: warehouseSummary.totalCapacity })}
              </div>
            </div>
          </div>
        )}

        {/* ── ZAKŁADKA FINANSE I AUTONAPRAWA ── */}
        {tab === 'finance' && (
          <div className="space-y-2.5 animate-fadeIn">
            <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1.5 text-xs">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-300">{t('bldg.revenuePerTick')}</span>
                <span className="font-mono text-emerald-400">+{formatMoney(building.revenue)}</span>
              </div>
              <div className="border-t border-[#1b2434] pt-1.5 space-y-1 text-slate-400">
                <Row label={t('bldg.costInputs')} val={-building.costs.inputs} />
                <Row label={t('bldg.costWages')} val={-building.costs.wages} />
                <Row label={t('bldg.costZus')} val={-building.costs.zus} />
                <Row label={t('bldg.costTransport')} val={-building.costs.transport} />
                <Row label={t('bldg.costUtilities')} val={-(building.costs.energy + building.costs.water)} />
                <Row label={t('bldg.costMaintenance')} val={-building.costs.maintenance} />
                {building.costs.environmentalFine > 0 && (
                  <Row label={t('bldg.costEnvFine')} val={-building.costs.environmentalFine} highlightRed />
                )}
                <Row label={t('bldg.costTaxes')} val={-building.costs.taxes} />
              </div>
              <div className="border-t border-[#243044] pt-1.5 flex justify-between font-bold text-sm">
                <span className="text-slate-100">{t('bldg.netProfitPerTick')}</span>
                <span className={`font-mono ${building.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {building.netProfit >= 0 ? '+' : ''}
                  {formatMoney(building.netProfit)}
                </span>
              </div>
            </div>

            {/* Produkcja i magazynowanie */}
            {Object.keys(building.productionPerTick).length > 0 && (
              <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-300 font-medium">{t('bldg.productionVolume')}</span>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => onToggleStockpile(building.id)}
                      className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                        building.stockpileOutput
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-[#182130] border-[#2d3b52] text-slate-300'
                      }`}
                    >
                      {building.stockpileOutput ? t('bldg.stockpileBtn') : t('bldg.sellSpotBtn')}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(building.productionPerTick).map(([res, amt]) => {
                    const rdef = RESOURCE_DEFINITIONS[res as ResourceType];
                    const splitPct = building.stockpileOutput
                      ? 100
                      : getResourceStorageSplitPercent(currentPlayer, res as ResourceType);
                    return (
                      <span
                        key={res}
                        className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-mono"
                      >
                        {rdef.emoji} +{amt} {localizeResourceUnit(rdef.unit, lang)}/T
                        {res !== 'electricity' && res !== 'water' && RESOURCE_DEFINITIONS[res as ResourceType]?.tradeable !== false && isMine && (
                          <span className="ml-1.5 text-[10px] text-amber-300">
                            ({t('bldg.magExpShort', { store: splitPct, exp: 100 - splitPct })})
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Zunifikowany Panel Zapasu Wsadów / Surowców (wszystkie budynki zużywające surowce + elektrownie) */}
            {(() => {
              const inputSpecs = getPhysicalInputSpecsForBuilding(building.type);
              const fuelSpec = getPowerPlantFuelSpec(building.type);
              if (inputSpecs.length === 0) return null;
              const canMarketImport = hasExternalMarketAccess(gameState, plot, currentPlayer.id);
              const srcText = (mode?: 'none' | 'mine' | 'b2b' | 'market') =>
                mode === 'mine'
                  ? t('bldg.fuelSrcMine')
                  : mode === 'b2b'
                    ? t('bldg.fuelSrcB2B')
                    : mode === 'market'
                      ? t('bldg.fuelSrcMarket')
                      : t('bldg.fuelSrcNone');

              return (
                <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-amber-500/35 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-amber-300">
                      {t('bldg.inputsBufferTitle')}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {inputSpecs.length} {lang === 'en' ? 'inputs' : 'wsady'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {inputSpecs.map((spec) => {
                      const rDef = RESOURCE_DEFINITIONS[spec.resource];
                      const resLabel = localizeResourceName(spec.resource, spec.label, lang);
                      const unit = localizeResourceUnit(rDef?.unit ?? 't', lang);
                      const buf = building.inputBuffers?.[spec.resource];
                      const stored = spec.isPowerFuel
                        ? (building.fuelStored ?? buf?.stored ?? 0)
                        : (buf?.stored ?? 0);
                      const maxStock = spec.isPowerFuel
                        ? (building.fuelMax ?? spec.maxStock)
                        : (buf?.max ?? spec.maxStock);
                      const pct = Math.max(
                        0,
                        Math.min(100, Math.round((stored / Math.max(0.1, maxStock)) * 100))
                      );
                      const usagePerCycle =
                        building.consumptionPerTick?.[spec.resource] ?? spec.consumptionPerTick;
                      const srcMode = spec.isPowerFuel
                        ? (building.fuelSourceMode ?? buf?.sourceMode)
                        : buf?.sourceMode;
                      const barColor =
                        pct >= 55 ? 'bg-emerald-400' : pct >= 25 ? 'bg-amber-400' : 'bg-rose-500';
                      const textColor =
                        pct >= 55
                          ? 'text-emerald-300'
                          : pct >= 25
                            ? 'text-amber-300'
                            : 'text-rose-400';

                      return (
                        <div
                          key={spec.resource}
                          className="p-2 rounded bg-[#111827] border border-[#243044] space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-100">
                              {rDef?.emoji ?? '📦'} {resLabel}
                            </span>
                            <span className={`font-mono font-bold ${textColor}`}>
                              {stored.toFixed(1)} / {maxStock.toFixed(1)} {unit} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-[#151c28] rounded-full overflow-hidden border border-[#243044]">
                            <div
                              className={`h-full transition-all duration-300 ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-slate-300 flex flex-wrap justify-between gap-1">
                            <span>{t('bldg.fuelSourceLabel', { src: srcText(srcMode) })}</span>
                            <span className="font-mono text-slate-400">
                              {t('bldg.inputDemandCycle', {
                                amt: Number(usagePerCycle.toFixed(2)),
                                unit,
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {fuelSpec && building.status.noFuel && (
                    <div className="p-1.5 rounded bg-rose-950/50 border border-rose-500/45 text-[11px] text-rose-200">
                      {t('bldg.fuelEmptyBanner')}
                    </div>
                  )}

                  {fuelSpec && isMine && onToggleEmergencyFuelImport && (
                    <div className="pt-1 border-t border-[#1e293b] space-y-1">
                      <DarkToggle
                        checked={Boolean(building.emergencyMarketImport)}
                        onChange={() => onToggleEmergencyFuelImport(building.id)}
                        label={t('bldg.fuelEmergencyToggle')}
                      />
                      {!canMarketImport && (
                        <div className="text-[10px] text-rose-300">
                          {t('bldg.fuelNoMarketAccess')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Polisa Ubezpieczeniowa Majątku */}
            {isMine && !building.destroyedRuins && onToggleInsurance && (
              <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-sky-500/35 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sky-300">{t('bldg.insuranceTitle')}</span>
                  <button
                    type="button"
                    onClick={() => onToggleInsurance(building.id)}
                    className={`px-2.5 py-1 rounded font-bold text-[11px] border transition-colors ${
                      building.insured
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-800 border-slate-600 text-slate-300'
                    }`}
                  >
                    {building.insured ? t('bldg.insuranceActive') : t('bldg.insuranceBuy')}
                  </button>
                </div>
                <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-1">
                  <span>{t('bldg.insurancePremium', { cost: formatMoney(insurancePremium) })}</span>
                  <span>{t('bldg.insuranceClaims', { count: building.insuranceClaimsCount ?? 0 })}</span>
                </div>
              </div>
            )}

            {/* Karta Autonaprawy + Szablon Globalny */}
            {isMine && (
              <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-200">{t('bldg.autoRepairTitle')}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onSetAutoRepair(
                        building.id,
                        !building.autoRepairEnabled,
                        building.autoRepairThreshold
                      )
                    }
                    className={`px-2.5 py-1 rounded font-bold text-[11px] border transition-colors ${
                      building.autoRepairEnabled
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-800 border-slate-600 text-slate-400'
                    }`}
                  >
                    {building.autoRepairEnabled ? t('bldg.autoRepairOn') : t('bldg.autoRepairOff')}
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-400">{t('bldg.autoRepairThreshold')}</span>
                    <div className="flex items-center gap-1">
                      <DarkNumberInput
                        value={building.autoRepairThreshold}
                        onChange={(v) =>
                          onSetAutoRepair(building.id, building.autoRepairEnabled, v)
                        }
                        min={5}
                        max={90}
                        step={5}
                        className="w-24 text-xs"
                      />
                      <span className="text-amber-300 font-mono">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={90}
                    step={5}
                    value={building.autoRepairThreshold}
                    onChange={(e) =>
                      onSetAutoRepair(
                        building.id,
                        building.autoRepairEnabled,
                        Number(e.target.value)
                      )
                    }
                    className="w-full"
                  />
                </div>

                <DarkToggle
                  checked={setAsDefaultTpl}
                  onChange={setSetAsDefaultTpl}
                  label={t('bldg.autoRepairSetDefault')}
                />

                <button
                  type="button"
                  onClick={() =>
                    onApplyAutoRepairTemplate(
                      building.autoRepairEnabled,
                      building.autoRepairThreshold,
                      setAsDefaultTpl
                    )
                  }
                  className="w-full py-1.5 px-2.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-semibold text-[11px] transition-colors"
                >
                  {t('bldg.autoRepairApplyAll')}
                </button>
              </div>
            )}

            {isMine && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={building.damagePercent <= 0.5 || currentPlayer.cash < repairCost}
                  onClick={() => onRepair(building.id)}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#182235] hover:bg-[#1f2d45] border border-sky-500/40 text-sky-300 text-xs font-semibold disabled:opacity-40"
                >
                  {t('bldg.repairBtn', { cost: formatMoney(repairCost) })}
                </button>
                {!confirmDemolish ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDemolish(true)}
                    className="py-2 px-3 rounded-lg bg-[#1c2434] hover:bg-rose-950/50 border border-[#334155] text-rose-300 text-xs font-medium"
                  >
                    {t('bldg.demolishBtn')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDemolish(plot.id)}
                    className="py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    {t('bldg.confirmBtn')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ZAKŁADKA WEWNĘTRZNE DRZEWKO TECH (NODE-LINK TREE) ── */}
        {tab === 'tech' && (
          <div className="space-y-3 animate-fadeIn">
            {/* Graf węzłów z krzywymi Beziera SVG (poszerzony pod poziom EKSTRA / APEX) */}
            <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044] overflow-x-auto">
              <div className="relative min-w-[680px] h-[300px]">
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* Połączenia zależności */}
                  {building.techTree.map((node) =>
                    node.prerequisites.map((preId) => {
                      const pre = building.techTree.find((x) => x.id === preId);
                      if (!pre) return null;
                      const x1 = pre.graphPos.x + 150;
                      const y1 = pre.graphPos.y + 26;
                      const x2 = node.graphPos.x;
                      const y2 = node.graphPos.y + 26;
                      const mx = (x1 + x2) / 2;
                      const isDone = pre.status === 'done';
                      return (
                        <path
                          key={`${pre.id}_${node.id}`}
                          d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke={isDone ? '#10b981' : '#334155'}
                          strokeWidth={isDone ? 2.5 : 1.5}
                          strokeDasharray={isDone ? undefined : '4 4'}
                        />
                      );
                    })
                  )}
                  {/* Łącznik wykluczających się gałęzi */}
                  {building.techTree.map((node) =>
                    (node.exclusiveWith ?? []).map((exId) => {
                      if (node.id > exId) return null;
                      const ex = building.techTree.find((x) => x.id === exId);
                      if (!ex) return null;
                      return (
                        <line
                          key={`ex_${node.id}_${ex.id}`}
                          x1={node.graphPos.x + 75}
                          y1={node.graphPos.y + 52}
                          x2={ex.graphPos.x + 75}
                          y2={ex.graphPos.y}
                          stroke="#f43f5e"
                          strokeWidth={1.2}
                          strokeDasharray="3 3"
                          strokeOpacity={0.55}
                        />
                      );
                    })
                  )}
                </svg>

                {building.techTree.map((rawNode) => {
                  const node = translateBuildingTechNode(rawNode, lang);
                  const isSel = selectedTechNode?.id === node.id;
                  const st = node.status;
                  const isApex = Boolean(node.effects.isApex || node.tier === 4);

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedTechId(node.id)}
                      style={{ left: node.graphPos.x, top: node.graphPos.y }}
                      className={`absolute w-[150px] p-2 rounded-lg border text-left transition-all duration-150 ${
                        st === 'done'
                          ? isApex
                            ? 'bg-amber-950/60 border-amber-400 text-amber-100 shadow-[0_0_16px_rgba(250,204,21,0.3)]'
                            : 'bg-emerald-950/60 border-emerald-400 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                          : st === 'researching'
                            ? 'bg-sky-950/70 border-sky-400 text-sky-100'
                            : st === 'available'
                              ? isApex
                                ? 'bg-[#1c162b] border-amber-400 text-amber-100 animate-node-avail hover:scale-[1.03]'
                                : 'bg-[#151c28] border-amber-400/70 text-slate-100 animate-node-avail hover:scale-[1.03]'
                              : st === 'excluded'
                                ? 'bg-[#121016] border-rose-900/40 text-slate-500 opacity-55 line-through'
                                : isApex
                                  ? 'bg-[#141020] border-amber-500/35 text-slate-400 opacity-80'
                                  : 'bg-[#101520] border-[#243044] text-slate-500 opacity-70'
                      } ${isSel ? 'ring-2 ring-white/80' : ''}`}
                    >
                      <div className="flex items-center justify-between text-[9px] font-mono mb-0.5">
                        <span className={isApex ? 'text-amber-300 font-bold' : ''}>
                          {isApex ? t('bldg.nodeFlagshipPrefix') : ''}
                          {st === 'done'
                            ? t('bldg.nodeDone')
                            : st === 'researching'
                              ? `${Math.round(node.progress)}%`
                              : st === 'excluded'
                                ? t('bldg.nodeExcluded')
                                : st === 'available'
                                  ? t('bldg.nodeAvail')
                                  : t('bldg.nodeLocked')}
                        </span>
                        <span className="text-amber-300">{Math.round(node.cost / 1000)}k</span>
                      </div>
                      <div className="text-[11px] font-semibold leading-tight line-clamp-2">
                        {node.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inspektor wybranego modułu z listą wymagań */}
            {selectedTechNode && (
              <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-100 text-sm">{selectedTechNode.name}</div>
                    <p className="text-slate-400 mt-0.5">{selectedTechNode.description}</p>
                  </div>
                  <span className="font-mono font-bold text-amber-300 shrink-0">
                    {formatMoney(selectedTechNode.cost)}
                  </span>
                </div>

                <div className="text-[11px] text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2 py-1.5 rounded">
                  ⚖️ {selectedTechNode.tradeoffNote}
                </div>

                {selectedTechNode.exclusiveWith && selectedTechNode.exclusiveWith.length > 0 && (
                  <div className="text-[11px] text-rose-300">{t('bldg.exclusiveWarn')}</div>
                )}

                {selectedReqEval.items.length > 0 && (
                  <div className="p-2 rounded bg-[#111827] border border-[#1e293b] space-y-1">
                    <div className="text-[10px] font-semibold uppercase text-slate-400">
                      {t('bldg.reqHeader')}
                    </div>
                    {selectedReqEval.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-2 text-[11px]">
                        <div className={item.met ? 'text-emerald-400' : 'text-rose-400'}>
                          <span className="font-bold mr-1">{item.met ? '✓' : '✕'}</span>
                          <span>{item.label}</span>
                          {!item.met && (
                            <div className="text-[10px] text-slate-400 pl-3.5">{item.hint}</div>
                          )}
                        </div>
                        {item.missingResource && isMine && (
                          <button
                            type="button"
                            onClick={() =>
                              onBuyMissingResource(
                                item.missingResource!.resource,
                                item.missingResource!.missingAmount
                              )
                            }
                            disabled={currentPlayer.cash < item.missingResource.spotCost}
                            className="px-1.5 py-0.5 rounded bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/40 text-sky-200 text-[10px] shrink-0 disabled:opacity-40"
                          >
                            {t('bldg.spotBuyBtn', { cost: formatMoney(item.missingResource.spotCost) })}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedTechNode.status === 'researching' && (
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-sky-300 mb-1">
                      <span>{t('bldg.researchingLabel')}</span>
                      <span>{Math.round(selectedTechNode.progress)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-sky-400 transition-all duration-200"
                        style={{ width: `${selectedTechNode.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {isMine && selectedTechNode.status === 'available' && (
                  <button
                    type="button"
                    disabled={
                      Boolean(building.activeResearchId) ||
                      !selectedReqEval.allMet ||
                      currentPlayer.cash < selectedTechNode.cost
                    }
                    onClick={() => onResearchTech(building.id, selectedTechNode.id)}
                    className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-40 transition-colors"
                  >
                    {t('bldg.deployNodeBtn', { ticks: selectedTechNode.researchTicks })}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ZAKŁADKA KADRY HR I SKŁADKI ZUS ── */}
        {tab === 'hr' && (
          <div className="space-y-3 text-xs animate-fadeIn">
            <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">{t('bldg.hrEmployment')}</span>
                <span className="font-mono text-sm font-bold text-slate-100">
                  {building.workers} / {building.maxWorkers}
                </span>
              </div>
              {isMine && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onFire(building.id, 2)}
                    disabled={building.workers <= 0}
                    className="flex-1 py-1.5 rounded bg-[#182130] hover:bg-rose-950/50 border border-[#2d3b52] text-rose-300 disabled:opacity-40"
                  >
                    {t('bldg.hrFire2')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onHire(building.id, 2)}
                    disabled={building.workers >= building.maxWorkers}
                    className="flex-1 py-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 font-semibold disabled:opacity-40"
                  >
                    {t('bldg.hrHire2')}
                  </button>
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">{t('bldg.hrSkillHeader')}</span>
                <span className="font-mono font-bold text-sky-300">{building.workerSkill}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${building.workerSkill}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">{t('bldg.hrSkillDesc')}</p>
              {isMine && (
                <button
                  type="button"
                  onClick={() => onTrain(building.id)}
                  disabled={
                    building.workerSkill >= 100 ||
                    currentPlayer.cash < trainingCost ||
                    building.workers === 0
                  }
                  className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold disabled:opacity-40"
                >
                  {t('bldg.hrTrainBtn', { cost: formatMoney(trainingCost) })}
                </button>
              )}
            </div>

            <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1">
              <div className="font-semibold text-slate-200 mb-1">
                {t('bldg.zusTitle', { rate: zusDetails.totalEmployerRate.toFixed(1) })}
              </div>
              <Row label={t('bldg.zusPension')} val={-zusDetails.emerytalna} />
              <Row label={t('bldg.zusDisability')} val={-zusDetails.rentowa} />
              <Row label={t('bldg.zusAccident')} val={-zusDetails.wypadkowa} />
              <Row label={t('bldg.zusLaborFund')} val={-(zusDetails.fp + zusDetails.fgsp)} />
              <div className="border-t border-[#1b2434] pt-1 flex justify-between font-semibold text-amber-300">
                <span>{t('bldg.laborShortageLabel')}</span>
                <span className="font-mono">{t('bldg.wagePressureVal', { pct: gameState.laborShortageIndex })}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── ZAKŁADKA DOSTAWY B2B ── */}
        {tab === 'b2b' && (
          <div className="space-y-3 text-xs animate-fadeIn">
            {isMine && rivals.length > 0 && (
              <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
                <div className="font-semibold text-slate-200">{t('bldg.b2bNewTitle')}</div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={partnerId}
                    onChange={(e) => setPartnerId(e.target.value)}
                    className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100"
                  >
                    {rivals.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.companyName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={isSelling ? 'sell' : 'buy'}
                    onChange={(e) => setIsSelling(e.target.value === 'sell')}
                    className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100"
                  >
                    <option value="sell">{t('bldg.b2bSellTo')}</option>
                    <option value="buy">{t('bldg.b2bBuyFrom')}</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={contractRes}
                    onChange={(e) => {
                      const res = e.target.value as ResourceType;
                      setContractRes(res);
                      setContractPrice(gameState.resourcePrices.find((r) => r.type === res)?.price ?? 200);
                    }}
                    className="bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100"
                  >
                    {Object.values(RESOURCE_DEFINITIONS).map((rd) => (
                      <option key={rd.type} value={rd.type}>
                        {localizeResourceName(rd.type, rd.name, lang)}
                      </option>
                    ))}
                  </select>
                  <DarkNumberInput
                    value={contractQty}
                    onChange={setContractQty}
                    min={1}
                    max={100}
                    step={1}
                  />
                  <DarkNumberInput
                    value={contractPrice}
                    onChange={setContractPrice}
                    min={10}
                    step={10}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">{t('bldg.b2bDuration')}</span>
                  <DarkNumberInput
                    value={contractDuration}
                    onChange={setContractDuration}
                    min={5}
                    max={120}
                    step={5}
                    className="w-28"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onProposeContract(
                      partnerId,
                      contractRes,
                      contractQty,
                      contractPrice,
                      contractDuration,
                      isSelling
                    )
                  }
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  {t('bldg.b2bProposeBtn')}
                </button>
              </div>
            )}

            {gameState.contracts.some(
              (c) =>
                (c.status === 'pending' || c.status === 'proposed') &&
                (c.responderId
                  ? c.responderId === currentPlayer.id
                  : c.proposerId !== currentPlayer.id && (c.sellerId === currentPlayer.id || c.buyerId === currentPlayer.id))
            ) && (
              <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/40 space-y-1.5">
                <div className="font-semibold text-amber-300">{t('bldg.b2bPendingTitle')}</div>
                {gameState.contracts
                  .filter(
                    (c) =>
                      (c.status === 'pending' || c.status === 'proposed') &&
                      (c.responderId
                        ? c.responderId === currentPlayer.id
                        : c.proposerId !== currentPlayer.id && (c.sellerId === currentPlayer.id || c.buyerId === currentPlayer.id))
                  )
                  .map((c) => (
                    <div key={c.id} className="p-2 rounded bg-[#151c28] flex justify-between items-center gap-2">
                      <div>
                        <div className="text-slate-100 font-medium">
                          {RESOURCE_DEFINITIONS[c.resource].emoji}{' '}
                          {localizeResourceName(c.resource, RESOURCE_DEFINITIONS[c.resource].name, lang)} · {c.quantityPerTick}/T
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {c.sellerName} → {c.buyerName} · {formatMoney(c.pricePerUnit)}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {onAcceptContract && (
                          <button
                            type="button"
                            onClick={() => onAcceptContract(c.id)}
                            className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                          >
                            ✓
                          </button>
                        )}
                        {onRejectContract && (
                          <button
                            type="button"
                            onClick={() => onRejectContract(c.id)}
                            className="px-2 py-1 rounded bg-rose-600/40 hover:bg-rose-600/60 text-rose-200"
                          >
                            ✕
                          </button>
                        )}
                        {onCancelContract && !onRejectContract && (
                          <button
                            type="button"
                            onClick={() => onCancelContract(c.id)}
                            className="px-2 py-1 rounded bg-rose-600/40 text-rose-200"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1.5">
              <div className="font-semibold text-slate-300">{t('bldg.b2bActiveTitle')}</div>
              {gameState.contracts.filter(
                (c) => c.status === 'active' && (c.sellerId === currentPlayer.id || c.buyerId === currentPlayer.id)
              ).length === 0 ? (
                <div className="text-slate-500">{t('bldg.b2bNone')}</div>
              ) : (
                gameState.contracts
                  .filter(
                    (c) => c.status === 'active' && (c.sellerId === currentPlayer.id || c.buyerId === currentPlayer.id)
                  )
                  .map((c) => (
                    <div key={c.id} className="p-2 rounded bg-[#151c28] flex justify-between items-center">
                      <div>
                        <div className="text-slate-100 font-medium">
                          {RESOURCE_DEFINITIONS[c.resource].emoji}{' '}
                          {localizeResourceName(c.resource, RESOURCE_DEFINITIONS[c.resource].name, lang)} · {c.quantityPerTick}/T
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {c.sellerName} → {c.buyerName}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-amber-300">{formatMoney(c.pricePerUnit)}</div>
                        <div className="text-[10px] text-slate-400">{c.remainingTicks}T</div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

const Row: React.FC<{ label: string; val: number; highlightRed?: boolean }> = ({
  label,
  val,
  highlightRed,
}) => (
  <div className="flex justify-between">
    <span className={highlightRed ? 'text-rose-400' : ''}>{label}</span>
    <span className={`font-mono ${highlightRed ? 'text-rose-400 font-semibold' : 'text-slate-200'}`}>
      {formatMoney(val)}
    </span>
  </div>
);
