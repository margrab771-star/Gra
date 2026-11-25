import React, { useState } from 'react';
import {
  BUILDING_CATEGORIES,
  CORPORATION_LEVELS,
  TERRAIN_NAMES,
} from '../../config/gameConfig';
import { BUILDING_DEFINITION_LIST } from '../../data/buildings';
import { RESOURCE_DEFINITIONS } from '../../data/resources';
import { checkBuildingRequirements, getBuildingConstructionCost } from '../../engine/BuildingSystem';
import { hasPlayerDiscoveredPlot } from '../../engine/PlotSystem';
import { evaluateNonFinancialRequirements } from '../../engine/RequirementsSystem';
import type {
  BuildingCategory,
  BuildingType,
  GameState,
  Player,
  Plot,
  ResourceType,
  TechBranch,
} from '../../engine/types';
import { formatMoney } from '../../utils/formatters';
import { DarkToggle } from '../HUD/DarkControls';

interface BuildSelectorProps {
  plot: Plot;
  gameState: GameState;
  currentPlayer: Player;
  onBuild: (plotId: string, buildingType: BuildingType) => void;
  onBuyMissingResource: (resource: ResourceType, amount: number) => void;
  onBack: () => void;
}

const TECH_BRANCH_LABELS: Record<TechBranch, string> = {
  industrial: 'Przemysł i Wydobycie',
  modern: 'Nauka i Energetyka',
  logistics: 'Logistyka i Handel',
  safety: 'BHP, Medycyna i Atrakcje',
  military: 'Nauka Militarna',
};

export const BuildSelector: React.FC<BuildSelectorProps> = React.memo(
  ({ plot, gameState, currentPlayer, onBuild, onBuyMissingResource, onBack }) => {
    const [selectedCategory, setSelectedCategory] = useState<BuildingCategory | 'all'>('all');
    const [showLockedTiers, setShowLockedTiers] = useState<boolean>(false);

    const corpTier = CORPORATION_LEVELS[currentPlayer.corporationLevel];
    const nextTier =
      currentPlayer.corporationLevel < 5
        ? CORPORATION_LEVELS[(currentPlayer.corporationLevel + 1) as 2 | 3 | 4 | 5]
        : null;

    const ownedBldCount = gameState.plots.filter(
      (p) => p.ownerId === currentPlayer.id && p.building !== null
    ).length;

    const categoryFiltered = BUILDING_DEFINITION_LIST.filter(
      (def) => selectedCategory === 'all' || def.category === selectedCategory
    );

    const buildableNow = categoryFiltered.filter(
      (def) =>
        def.requiredCorpLevel <= currentPlayer.corporationLevel &&
        (!def.unlockTech || currentPlayer.globalTech[def.unlockTech]?.status === 'done')
    );

    const lockedCount = categoryFiltered.length - buildableNow.length;
    const filtered = showLockedTiers ? categoryFiltered : buildableNow;

    return (
      <div id="build-selector" className="space-y-3 animate-fadeIn">
        <div className="flex items-center justify-between border-b border-[#243044] pb-2 gap-2">
          <div className="min-w-0">
            <div className="text-xs font-mono text-amber-400 truncate">
              INWESTYCJA NA ({plot.gridX}, {plot.gridY}) · {TERRAIN_NAMES[plot.terrain]}
            </div>
            <h3 className="text-sm font-semibold text-slate-100">
              Katalog Struktur ({filtered.length}/{categoryFiltered.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="px-2.5 py-1.5 rounded bg-[#1c2434] hover:bg-[#263146] text-xs text-slate-200 shrink-0 transition-colors"
          >
            ← Wróć
          </button>
        </div>

        {/* Status Etapu Korporacji i ciemny przełącznik podglądu przyszłych struktur */}
        <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-amber-300">
              Etap {corpTier.level}/5: {corpTier.name}
            </span>
            {nextTier && (
              <span className="text-slate-400 truncate" title={nextTier.description}>
                Następny: {formatMoney(nextTier.minNetWorth)}, {nextTier.minBuildings} bud.
              </span>
            )}
          </div>
          <DarkToggle
            checked={showLockedTiers}
            onChange={setShowLockedTiers}
            label={`Podgląd przyszłych / zablokowanych struktur (${lockedCount})`}
            sublabel={
              showLockedTiers
                ? 'Widzisz wszystkie budynki z pełną checklistą wymagań'
                : 'Pokazuje wyłącznie odblokowane inwestycje na Twoim etapie'
            }
          />
        </div>

        {/* Wielowierszowa siatka kategorii — 100% widoczności */}
        <div className="flex flex-wrap gap-1.5 pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              selectedCategory === 'all'
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
            }`}
          >
            🌐 Wszystkie
          </button>
          {BUILDING_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key)}
              title={cat.label}
              className={`px-2 py-1 rounded-md text-[11px] font-medium border flex items-center gap-1 transition-colors ${
                selectedCategory === cat.key
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                  : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Lista struktur */}
        <div className="space-y-2.5 max-h-[54vh] md:max-h-[58vh] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="p-4 rounded-lg bg-[#0b0f17] border border-[#243044] text-center text-xs text-slate-400 space-y-2">
              <div>Brak odblokowanych struktur w tej kategorii na obecnym etapie.</div>
              <button
                type="button"
                onClick={() => setShowLockedTiers(true)}
                className="px-3 py-1.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 font-semibold"
              >
                Włącz podgląd przyszłych struktur
              </button>
            </div>
          ) : (
            filtered.map((def) => {
              const check = checkBuildingRequirements(currentPlayer, plot, def.type, gameState);
              const totalCost = getBuildingConstructionCost(def.type, gameState, currentPlayer);
              const inputEntries = Object.entries(def.inputs);
              const outputEntries = Object.entries(def.outputs);
              const constructionEntries = Object.entries(def.buildConstructionInputs);
              const reqEval = evaluateNonFinancialRequirements(
                def.requirements,
                currentPlayer,
                gameState,
                undefined,
                plot
              );

              const requiredCorpInfo = CORPORATION_LEVELS[def.requiredCorpLevel];
              const corpMet = currentPlayer.corporationLevel >= def.requiredCorpLevel;
              const terrainMet = def.requiredTerrain.includes(plot.terrain);
              const depositMet = def.requiredDeposit
                ? hasPlayerDiscoveredPlot(plot, currentPlayer.id, currentPlayer, gameState) &&
                  plot.deposits.some((d) => d.type === def.requiredDeposit)
                : true;
              const cashMet = currentPlayer.cash >= totalCost;
              const unlockTechDef = def.unlockTech
                ? gameState.globalTechDefs.find((t) => t.id === def.unlockTech)
                : undefined;
              const unlockTechMet = def.unlockTech
                ? currentPlayer.globalTech[def.unlockTech]?.status === 'done'
                : true;
              const hqDuplicate =
                def.type === 'corporateHQ' &&
                gameState.plots.some(
                  (p) => p.ownerId === currentPlayer.id && p.building?.type === 'corporateHQ'
                );

              const showFullChecklist =
                !check.ok || showLockedTiers || !corpMet || !unlockTechMet;

              return (
                <div
                  key={def.type}
                  className={`p-3 rounded-lg border transition-all ${
                    check.ok
                      ? 'bg-[#0b0f17] border-[#243044] hover:border-amber-400/60'
                      : 'bg-[#0b0f17]/80 border-[#1b2434]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-xl shrink-0">{def.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-100 text-sm leading-tight">
                            {def.name}
                          </span>
                          {!corpMet && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-[10px] font-semibold text-amber-300">
                              🔒 Etap {def.requiredCorpLevel}: {requiredCorpInfo.name}
                            </span>
                          )}
                          {def.type === 'corporateHQ' && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-400/40 text-[10px] font-semibold text-sky-300">
                              Maks. 1 / firma
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          {def.description}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`font-mono text-xs font-bold shrink-0 ${
                        cashMet ? 'text-amber-300' : 'text-rose-400'
                      }`}
                    >
                      {formatMoney(totalCost)}
                    </span>
                  </div>

                  {/* Wsad / Produkcja / Media */}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    {inputEntries.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        Wsad:{' '}
                        {inputEntries
                          .map(([r, q]) => `${RESOURCE_DEFINITIONS[r as ResourceType].name} (${q})`)
                          .join(', ')}
                      </span>
                    )}
                    {outputEntries.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        Produkcja:{' '}
                        {outputEntries
                          .map(([r, q]) => `${RESOURCE_DEFINITIONS[r as ResourceType].name} (${q})`)
                          .join(', ')}
                      </span>
                    )}
                    {def.baseRevenue > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        Usługi: {formatMoney(def.baseRevenue)}/T
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-[#182130] text-slate-300">
                      👥 {def.maxWorkers} et. · ⚡{' '}
                      {def.electricityUsage < 0
                        ? `+${Math.abs(def.electricityUsage)} MW`
                        : `-${def.electricityUsage} MW`}{' '}
                      · 💧{' '}
                      {def.waterUsage < 0
                        ? `+${Math.abs(def.waterUsage)} m³`
                        : `-${def.waterUsage} m³`}
                      {(def.sewageUsage ?? 0) !== 0 &&
                        ` · 🚰 ${(def.sewageUsage ?? 0) < 0 ? `+${Math.abs(def.sewageUsage ?? 0)}` : `-${def.sewageUsage}`} m³`}
                      {(def.wasteUsage ?? 0) !== 0 &&
                        ` · 🗑️ ${(def.wasteUsage ?? 0) < 0 ? `+${Math.abs(def.wasteUsage ?? 0)}` : `-${def.wasteUsage}`} t`}
                    </span>
                  </div>

                  {/* Pełna checklista wymagań odblokowania i budowy */}
                  {showFullChecklist && (
                    <div className="mt-2 p-2 rounded bg-[#111827] border border-[#1e293b] space-y-1 text-[11px]">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Checklista Wymagań i Odblokowania
                      </div>

                      {def.requiredCorpLevel > 1 && (
                        <div className={corpMet ? 'text-emerald-400' : 'text-rose-400'}>
                          <span className="font-bold mr-1">{corpMet ? '✓' : '✕'}</span>
                          <span>
                            Etap {def.requiredCorpLevel}/5: {requiredCorpInfo.name} (Wycena{' '}
                            {formatMoney(currentPlayer.netWorth)} /{' '}
                            {formatMoney(requiredCorpInfo.minNetWorth)} · Budynki:{' '}
                            {ownedBldCount}/{requiredCorpInfo.minBuildings})
                          </span>
                          {!corpMet && (
                            <div className="text-[10px] text-slate-400 pl-3.5">
                              {requiredCorpInfo.requiresTechOrEdu}
                            </div>
                          )}
                        </div>
                      )}

                      {unlockTechDef &&
                        !reqEval.items.some((i) => i.id === `tech_${unlockTechDef.id}`) && (
                          <div className={unlockTechMet ? 'text-emerald-400' : 'text-rose-400'}>
                            <span className="font-bold mr-1">{unlockTechMet ? '✓' : '✕'}</span>
                            <span>
                              Technologia [{TECH_BRANCH_LABELS[unlockTechDef.branch]}]:{' '}
                              {unlockTechDef.name}
                            </span>
                          </div>
                        )}

                      <div className={terrainMet ? 'text-emerald-400' : 'text-rose-400'}>
                        <span className="font-bold mr-1">{terrainMet ? '✓' : '✕'}</span>
                        <span>
                          Teren: {def.requiredTerrain.map((t) => TERRAIN_NAMES[t]).join(', ')}
                        </span>
                      </div>

                      {def.requiredDeposit && (
                        <div className={depositMet ? 'text-emerald-400' : 'text-rose-400'}>
                          <span className="font-bold mr-1">{depositMet ? '✓' : '✕'}</span>
                          <span>
                            Odkryte złoże {RESOURCE_DEFINITIONS[def.requiredDeposit].genitiveName}{' '}
                            (przez Badanie Geologiczne)
                          </span>
                        </div>
                      )}

                      {hqDuplicate && (
                        <div className="text-rose-400">
                          <span className="font-bold mr-1">✕</span>
                          <span>Siedziba Główna HQ została już zbudowana w Twoim imperium.</span>
                        </div>
                      )}

                      {reqEval.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-2"
                        >
                          <div className={item.met ? 'text-emerald-400' : 'text-rose-400'}>
                            <span className="font-bold mr-1">{item.met ? '✓' : '✕'}</span>
                            <span>{item.label}</span>
                            {!item.met && (
                              <div className="text-[10px] text-slate-400 pl-3.5">{item.hint}</div>
                            )}
                          </div>
                          {item.missingResource && (
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
                              +Kup ({formatMoney(item.missingResource.spotCost)})
                            </button>
                          )}
                        </div>
                      ))}

                      {constructionEntries.length > 0 && (
                        <div className="text-slate-300 pt-0.5">
                          <span className="text-sky-400 mr-1">🧱</span>
                          Koszt surowcowy budowy: brak (wymagany tylko budżet i technologia)
                        </div>
                      )}

                      <div className={cashMet ? 'text-emerald-400' : 'text-rose-400'}>
                        <span className="font-bold mr-1">{cashMet ? '✓' : '✕'}</span>
                        <span>
                          Budżet budowy: {formatMoney(totalCost)} (masz{' '}
                          {formatMoney(currentPlayer.cash)})
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span
                      className="text-[11px] text-slate-400 italic leading-snug"
                      title={def.strategyHint}
                    >
                      {def.strategyHint}
                    </span>
                    <button
                      type="button"
                      disabled={!check.ok}
                      onClick={() => onBuild(plot.id, def.type)}
                      className="px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold shrink-0 transition-colors"
                    >
                      {check.ok ? 'Buduj' : 'Zablokowane'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }
);
