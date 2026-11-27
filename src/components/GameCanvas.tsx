import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GAME_CONFIG,
  HEATMAP_MODE_OPTIONS,
  TERRAIN_NAMES,
  TOLL_RATE_CONFIG,
} from '../config/gameConfig';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { computeCloneBlueprint } from '../engine/BuildingSystem';
import {
  estimateBatchPlotsPurchaseCost,
  getExpansionPriceMultiplier,
  getPlayerOwnedPlotCount,
  getPlotPurchasePrice,
  getRoadBuildCostForPlot,
  hasPlayerSurveyedPlot,
  isPlotBuildingVisibleToViewer,
} from '../engine/PlotSystem';
import { stepVehiclePositions } from '../engine/TransportSystem';
import type { BuildingType, GameState, MapHeatmapMode, Plot } from '../engine/types';
import { useIsometricCamera } from '../hooks/useIsometricCamera';
import { IsometricRenderer } from '../renderer/IsometricRenderer';
import { TILE_HEIGHT, TILE_WIDTH } from '../renderer/utils';
import { formatCompactMoney, formatMoney } from '../utils/formatters';
import { DarkToggle } from './HUD/DarkControls';

type MapToolMode = 'normal' | 'area_select' | 'road_local' | 'road_highway' | 'road_bridge';

interface CloneBlueprintSource {
  buildingId: string;
  buildingType: BuildingType;
  includeUpgrades: boolean;
}

interface GameCanvasProps {
  gameState: GameState;
  selectedPlotId: string | null;
  showTransportRoutes?: boolean;
  heatmapMode?: MapHeatmapMode;
  targetMode?: 'missile' | 'nuke' | null;
  cloneBuildingType?: BuildingType | null;
  cloneBlueprintSource?: CloneBlueprintSource | null;
  mapToolMode?: MapToolMode;
  areaSelectedPlotIds?: string[];
  hoveredBuildType?: BuildingType | null;
  focusRequest?: { plotId: string; nonce: number } | null;
  onCancelSpecialMode?: () => void;
  onTargetPlot?: (plotId: string) => void;
  onChangeHeatmapMode?: (mode: MapHeatmapMode) => void;
  onChangeMapToolMode?: (mode: MapToolMode) => void;
  onAreaSelectionChange?: (plotIds: string[]) => void;
  onBatchBuyPlots?: (plotIds: string[]) => void;
  onBatchSurveyPlots?: (plotIds: string[]) => void;
  onBatchBuildRoad?: (plotIds: string[], roadClass: 'local' | 'highway' | 'bridge') => void;
  onToggleCloneUpgrades?: (includeUpgrades: boolean) => void;
  onSelectPlot: (plotId: string | null) => void;
}

function buildManhattanRoadPath(
  plots: Plot[],
  startPlot: Plot,
  endPlot: Plot,
  allowWaterBridge = false
): string[] {
  const mapSize = Math.round(Math.sqrt(plots.length));
  const byCoord = new Map<string, Plot>();
  for (const p of plots) {
    byCoord.set(`${p.gridX},${p.gridY}`, p);
  }
  const pathIds: string[] = [];
  const seen = new Set<string>();
  const pushCoord = (gx: number, gy: number) => {
    if (gx < 0 || gy < 0 || gx >= mapSize || gy >= mapSize) return;
    const p = byCoord.get(`${gx},${gy}`);
    if (!p || (!allowWaterBridge && p.terrain === 'water') || p.building || (p.irradiatedTicks ?? 0) > 0) return;
    if (!seen.has(p.id)) {
      seen.add(p.id);
      pathIds.push(p.id);
    }
  };
  let cx = startPlot.gridX;
  let cy = startPlot.gridY;
  pushCoord(cx, cy);
  const dx = endPlot.gridX > cx ? 1 : -1;
  while (cx !== endPlot.gridX && pathIds.length < 48) {
    cx += dx;
    pushCoord(cx, cy);
  }
  const dy = endPlot.gridY > cy ? 1 : -1;
  while (cy !== endPlot.gridY && pathIds.length < 48) {
    cy += dy;
    pushCoord(cx, cy);
  }
  return pathIds;
}

export const GameCanvas: React.FC<GameCanvasProps> = React.memo(
  ({
    gameState,
    selectedPlotId,
    showTransportRoutes = true,
    heatmapMode = 'standard',
    targetMode = null,
    cloneBuildingType = null,
    cloneBlueprintSource = null,
    mapToolMode = 'normal',
    areaSelectedPlotIds = [],
    hoveredBuildType = null,
    focusRequest = null,
    onCancelSpecialMode,
    onTargetPlot,
    onChangeHeatmapMode,
    onChangeMapToolMode,
    onAreaSelectionChange,
    onBatchBuyPlots,
    onBatchSurveyPlots,
    onBatchBuildRoad,
    onToggleCloneUpgrades,
    onSelectPlot,
  }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const tooltipTitleRef = useRef<HTMLDivElement>(null);
    const tooltipSubRef = useRef<HTMLDivElement>(null);

    const rendererRef = useRef<IsometricRenderer | null>(null);
    const stateRef = useRef(gameState);
    const selectedRef = useRef(selectedPlotId);
    const showRoutesRef = useRef(showTransportRoutes);
    const heatmapRef = useRef<MapHeatmapMode>(heatmapMode);
    const targetModeRef = useRef<'missile' | 'nuke' | null>(targetMode);
    const mapToolModeRef = useRef<MapToolMode>(mapToolMode);
    const areaSelectedRef = useRef<string[]>(areaSelectedPlotIds);
    const hoveredBuildTypeRef = useRef<BuildingType | null>(hoveredBuildType);
    const cloneBlueprintRef = useRef<CloneBlueprintSource | null>(cloneBlueprintSource);
    const hoveredPlotIdRef = useRef<string | null>(null);
    const containerWidthRef = useRef(800);

    // Interaktywny stan przeciągania obszaru i dróg bez re-renderów Reacta podczas ruchu myszą
    const specialDragKindRef = useRef<'none' | 'area' | 'road'>('none');
    const dragStartPlotRef = useRef<Plot | null>(null);
    const liveAreaIdsRef = useRef<string[]>([]);
    const liveRoadIdsRef = useRef<string[]>([]);
    const [roadPreviewInfo, setRoadPreviewInfo] = useState<{ count: number; cost: number } | null>(
      null
    );

    const { cameraRef, centerOn, zoomBy, stepCameraAnimation, handlers } = useIsometricCamera(
      typeof window !== 'undefined' ? window.innerWidth * 0.45 : 500,
      130,
      1.05
    );

    useEffect(() => {
      stateRef.current = gameState;
      selectedRef.current = selectedPlotId;
      showRoutesRef.current = showTransportRoutes;
      heatmapRef.current = heatmapMode;
      targetModeRef.current = targetMode;
      mapToolModeRef.current = mapToolMode;
      areaSelectedRef.current = areaSelectedPlotIds;
      hoveredBuildTypeRef.current = hoveredBuildType;
      cloneBlueprintRef.current = cloneBlueprintSource;
    }, [
      gameState,
      selectedPlotId,
      showTransportRoutes,
      heatmapMode,
      targetMode,
      mapToolMode,
      areaSelectedPlotIds,
      hoveredBuildType,
      cloneBlueprintSource,
    ]);

    useEffect(() => {
      if (!focusRequest?.plotId) return;
      const plot = stateRef.current.plots.find((p) => p.id === focusRequest.plotId);
      const el = containerRef.current;
      if (!plot || !el) return;
      const rect = el.getBoundingClientRect();
      const targetZoom = Math.max(1.05, cameraRef.current.zoom);
      const tw = TILE_WIDTH * targetZoom;
      const th = TILE_HEIGHT * targetZoom;
      const ox = rect.width * 0.5 - (plot.gridX - plot.gridY) * (tw / 2);
      const oy = rect.height * 0.5 - (plot.gridX + plot.gridY) * (th / 2);
      centerOn(ox, oy, targetZoom);
    }, [focusRequest, centerOn, cameraRef]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mapSize = gameState.settings.mapSize;
      centerOn(rect.width * 0.48, rect.height * 0.45 - mapSize * 14, mapSize > 24 ? 0.85 : 1.05);
    }, [gameState.settings.mapSize, centerOn]);

    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const renderer = new IsometricRenderer(canvas);
      rendererRef.current = renderer;

      const updateSize = () => {
        const rect = container.getBoundingClientRect();
        containerWidthRef.current = rect.width;
        renderer.resize(rect.width, rect.height);
      };
      updateSize();

      const ro = new ResizeObserver(updateSize);
      ro.observe(container);

      let animId = 0;
      let lastTs = performance.now();
      const loop = (ts: number) => {
        const dt = Math.min(0.1, (ts - lastTs) / 1000);
        lastTs = ts;
        stepCameraAnimation();
        const st = stateRef.current;
        if (st.speed > 0 && st.phase === 'Playing') {
          stepVehiclePositions(st.vehicles, dt, st.speed);
        }
        renderer.render(
          st,
          cameraRef.current,
          hoveredPlotIdRef.current,
          selectedRef.current,
          st.vehicles,
          showRoutesRef.current,
          heatmapRef.current,
          targetModeRef.current,
          {
            areaHighlightIds:
              liveAreaIdsRef.current.length > 0 ? liveAreaIdsRef.current : areaSelectedRef.current,
            roadPreviewIds: liveRoadIdsRef.current,
            roadPreviewClass:
              mapToolModeRef.current === 'road_bridge'
                ? 'bridge'
                : mapToolModeRef.current === 'road_highway'
                  ? 'highway'
                  : 'local',
            previewBuildingType:
              hoveredBuildTypeRef.current ?? cloneBlueprintRef.current?.buildingType ?? null,
          }
        );
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(animId);
        ro.disconnect();
      };
    }, [cameraRef, stepCameraAnimation]);

    const pickPlot = (clientX: number, clientY: number): Plot | null => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer) return null;
      const rect = canvas.getBoundingClientRect();
      return renderer.getPlotAtScreen(
        clientX - rect.left,
        clientY - rect.top,
        cameraRef.current,
        stateRef.current.plots
      );
    };

    const updateTooltipDom = (plot: Plot | null, localX: number, localY: number) => {
      const box = tooltipRef.current;
      const titleEl = tooltipTitleRef.current;
      const subEl = tooltipSubRef.current;
      if (!box || !titleEl || !subEl) return;

      if (!plot || (plot.terrain === 'water' && !plot.hasRoad && mapToolModeRef.current !== 'road_bridge')) {
        box.style.opacity = '0';
        return;
      }

      box.style.opacity = '1';
      box.style.transform = `translate3d(${Math.min(localX + 14, containerWidthRef.current - 230)}px, ${Math.max(12, localY - 12)}px, 0)`;
      titleEl.textContent = `(${plot.gridX}, ${plot.gridY}) · ${TERRAIN_NAMES[plot.terrain]}`;

      const curPid = stateRef.current.currentPlayerId;
      const curPlayer = stateRef.current.players.find((p) => p.id === curPid);
      if (plot.building) {
        const visible = isPlotBuildingVisibleToViewer(plot, curPid, curPlayer, stateRef.current);
        if (!visible) {
          subEl.className = 'text-amber-300 font-mono mt-0.5';
          subEl.textContent = '🌫️ Obiekt Nieznany (Mgła Wojny)';
        } else {
          subEl.className = 'text-emerald-400 font-mono mt-0.5';
          subEl.textContent = `${plot.building.icon} ${plot.building.name} (${Math.round(plot.building.damagePercent)}% zniszcz.)`;
        }
      } else if (plot.hasRoad) {
        const owner = plot.ownerId
          ? stateRef.current.players.find((p) => p.id === plot.ownerId)?.companyName
          : 'Droga';
        const roadName =
          plot.roadType === 'bridge'
            ? 'Most Drogowy'
            : plot.roadType === 'highway'
              ? 'Autostrada'
              : 'Droga Zwykła';
        const tollTxt = plot.roadBlocked
          ? 'BLOKADA'
          : TOLL_RATE_CONFIG[plot.tollRate ?? 'free'].label;
        subEl.className = plot.roadType === 'bridge' ? 'text-sky-300 mt-0.5' : 'text-amber-300 mt-0.5';
        subEl.textContent = `${plot.roadType === 'bridge' ? '🌉' : '🛣️'} ${roadName} (${owner ?? ''}) · ${tollTxt}`;
      } else if (plot.terrain === 'water') {
        subEl.className = 'text-sky-300 mt-0.5';
        subEl.textContent = `🌉 Kliknij lub przeciągnij, aby wybudować Most Drogowy (${formatMoney(GAME_CONFIG.bridgeCost)})`;
      } else if (plot.ownerId) {
        const owner = stateRef.current.players.find((p) => p.id === plot.ownerId);
        subEl.className = 'text-sky-400 mt-0.5';
        subEl.textContent = `Właściciel: ${owner?.companyName ?? 'Gracz'}`;
      } else {
        const surveyedTxt = hasPlayerSurveyedPlot(plot, curPid)
          ? plot.deposits.length > 0
            ? ' · Złoże odkryte!'
            : ' · Zbadano: pusto'
          : '';
        const viewer = stateRef.current.players.find((p) => p.id === curPid);
        const ownedCnt = viewer ? getPlayerOwnedPlotCount(stateRef.current, viewer.id) : 0;
        const effectivePrice = getPlotPurchasePrice(plot, ownedCnt);
        const expMult = getExpansionPriceMultiplier(ownedCnt);
        subEl.className = 'text-amber-400 font-mono mt-0.5';
        subEl.textContent = `Cena: ${formatCompactMoney(effectivePrice)}${ownedCnt > 0 ? ` (×${expMult.toFixed(2)})` : ''}${surveyedTxt}`;
      }
    };

    const computeAreaIds = (startPlot: Plot, endPlot: Plot): string[] => {
      const minX = Math.min(startPlot.gridX, endPlot.gridX);
      const maxX = Math.max(startPlot.gridX, endPlot.gridX);
      const minY = Math.min(startPlot.gridY, endPlot.gridY);
      const maxY = Math.max(startPlot.gridY, endPlot.gridY);
      const ids: string[] = [];
      for (const p of stateRef.current.plots) {
        if (
          p.gridX >= minX &&
          p.gridX <= maxX &&
          p.gridY >= minY &&
          p.gridY <= maxY &&
          p.terrain !== 'water' &&
          (p.irradiatedTicks ?? 0) <= 0
        ) {
          ids.push(p.id);
          if (ids.length >= 64) break;
        }
      }
      return ids;
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const mode = mapToolModeRef.current;
      if (e.button === 0 && (e.shiftKey || mode === 'area_select')) {
        const sp = pickPlot(e.clientX, e.clientY);
        if (sp) {
          specialDragKindRef.current = 'area';
          dragStartPlotRef.current = sp;
          liveAreaIdsRef.current = computeAreaIds(sp, sp);
          return;
        }
      }
      if (e.button === 0 && (mode === 'road_local' || mode === 'road_highway' || mode === 'road_bridge')) {
        const sp = pickPlot(e.clientX, e.clientY);
        if (sp) {
          specialDragKindRef.current = 'road';
          dragStartPlotRef.current = sp;
          const allowWater = mode === 'road_bridge';
          const pathIds = buildManhattanRoadPath(stateRef.current.plots, sp, sp, allowWater);
          liveRoadIdsRef.current = pathIds;
          const st = stateRef.current;
          const lp = st.players.find((pl) => pl.id === st.currentPlayerId);
          const cls: 'local' | 'highway' | 'bridge' =
            mode === 'road_bridge' ? 'bridge' : mode === 'road_highway' ? 'highway' : 'local';
          const totalCost = lp
            ? (() => {
                let ownedStep = getPlayerOwnedPlotCount(st, lp.id);
                return pathIds.reduce((s, pid) => {
                  const pl = st.plots.find((q) => q.id === pid);
                  if (!pl) return s;
                  const effCls = cls === 'bridge' && pl.terrain !== 'water' ? 'local' : cls;
                  if (pl.hasRoad && (effCls === 'local' || effCls === 'bridge' || pl.roadType === 'highway')) return s;
                  const buyStep =
                    effCls !== 'bridge' && pl.ownerId === null && pl.purchasable && pl.terrain !== 'water'
                      ? getPlotPurchasePrice(pl, ownedStep++)
                      : 0;
                  return s + buyStep + getRoadBuildCostForPlot(st, lp, pl, effCls);
                }, 0);
              })()
            : 0;
          setRoadPreviewInfo({ count: pathIds.length, cost: totalCost });
          return;
        }
      }
      handlers.onMouseDown(e);
    };

    const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      const plot = pickPlot(e.clientX, e.clientY);
      hoveredPlotIdRef.current = plot ? plot.id : null;
      updateTooltipDom(plot, lx, ly);

      if (specialDragKindRef.current === 'area' && dragStartPlotRef.current && plot) {
        liveAreaIdsRef.current = computeAreaIds(dragStartPlotRef.current, plot);
        return;
      }
      if (specialDragKindRef.current === 'road' && dragStartPlotRef.current && plot) {
        const isBridgeMode = mapToolModeRef.current === 'road_bridge';
        const pathIds = buildManhattanRoadPath(
          stateRef.current.plots,
          dragStartPlotRef.current,
          plot,
          isBridgeMode
        );
        liveRoadIdsRef.current = pathIds;
        const st = stateRef.current;
        const lp = st.players.find((pl) => pl.id === st.currentPlayerId);
        const cls: 'local' | 'highway' | 'bridge' =
          isBridgeMode ? 'bridge' : mapToolModeRef.current === 'road_highway' ? 'highway' : 'local';
        const totalCost = lp
          ? (() => {
              let ownedStep = getPlayerOwnedPlotCount(st, lp.id);
              return pathIds.reduce((s, pid) => {
                const pl = st.plots.find((q) => q.id === pid);
                if (!pl) return s;
                const effCls = cls === 'bridge' && pl.terrain !== 'water' ? 'local' : cls;
                if (pl.hasRoad && (effCls === 'local' || effCls === 'bridge' || pl.roadType === 'highway')) return s;
                const buyStep =
                  effCls !== 'bridge' && pl.ownerId === null && pl.purchasable && pl.terrain !== 'water'
                    ? getPlotPurchasePrice(pl, ownedStep++)
                    : 0;
                return s + buyStep + getRoadBuildCostForPlot(st, lp, pl, effCls);
              }, 0);
            })()
          : 0;
        setRoadPreviewInfo({ count: pathIds.length, cost: totalCost });
        return;
      }

      handlers.onMouseMove(e);
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (specialDragKindRef.current === 'area') {
        const ids = [...liveAreaIdsRef.current];
        specialDragKindRef.current = 'none';
        dragStartPlotRef.current = null;
        liveAreaIdsRef.current = [];
        onAreaSelectionChange?.(ids);
        return;
      }
      if (specialDragKindRef.current === 'road') {
        const ids = [...liveRoadIdsRef.current];
        const cls: 'local' | 'highway' | 'bridge' =
          mapToolModeRef.current === 'road_bridge'
            ? 'bridge'
            : mapToolModeRef.current === 'road_highway'
              ? 'highway'
              : 'local';
        specialDragKindRef.current = 'none';
        dragStartPlotRef.current = null;
        liveRoadIdsRef.current = [];
        setRoadPreviewInfo(null);
        if (ids.length > 0) {
          onBatchBuildRoad?.(ids, cls);
        }
        return;
      }
      const wasClick = handlers.onMouseUp();
      if (wasClick) {
        const plot = pickPlot(e.clientX, e.clientY);
        if (plot && targetMode && onTargetPlot) {
          onTargetPlot(plot.id);
          return;
        }
        onSelectPlot(plot ? plot.id : null);
      }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
      const wasTap = handlers.onTouchEnd();
      if (wasTap && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        const plot = pickPlot(t.clientX, t.clientY);
        if (plot && targetMode && onTargetPlot) {
          onTargetPlot(plot.id);
          return;
        }
        onSelectPlot(plot ? plot.id : null);
      }
    };

    const localPlayer =
      gameState.players.find((p) => p.id === gameState.currentPlayerId) ?? gameState.players[0];
    const selectedPlotsObjs =
      areaSelectedPlotIds.length > 0
        ? gameState.plots.filter((p) => areaSelectedPlotIds.includes(p.id))
        : [];
    const buyableAreaPlots = selectedPlotsObjs.filter(
      (p) => p.purchasable && p.ownerId === null && (p.irradiatedTicks ?? 0) <= 0
    );
    const buyAreaEstimate = useMemo(
      () => estimateBatchPlotsPurchaseCost(gameState, localPlayer, buyableAreaPlots),
      [gameState, localPlayer, buyableAreaPlots]
    );
    const buyAreaTotalCost = buyAreaEstimate.totalCost;
    const surveyableAreaPlots = selectedPlotsObjs.filter(
      (p) =>
        p.terrain !== 'water' &&
        (!p.ownerId || p.ownerId === localPlayer.id) &&
        !p.hasRoad &&
        !hasPlayerSurveyedPlot(p, localPlayer.id)
    );
    const singleSurveyCost = Math.round(
      GAME_CONFIG.surveyCost * (localPlayer.globalTech['ind_geology']?.status === 'done' ? 0.7 : 1)
    );
    const surveyAreaTotalCost = surveyableAreaPlots.length * singleSurveyCost;

    const cloneSrcPlot = cloneBlueprintSource
      ? gameState.plots.find((p) => p.building?.id === cloneBlueprintSource.buildingId)
      : undefined;
    const cloneBlueprintCost =
      cloneBlueprintSource && cloneSrcPlot?.building
        ? computeCloneBlueprint(
            gameState,
            localPlayer,
            cloneSrcPlot.building,
            cloneBlueprintSource.includeUpgrades
          )
        : null;

    return (
      <div ref={containerRef} id="game-canvas" className="relative w-full h-full overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          className={`block w-full h-full touch-none ${
            targetMode || cloneBuildingType || cloneBlueprintSource || mapToolMode !== 'normal'
              ? 'cursor-crosshair'
              : 'cursor-grab active:cursor-grabbing'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => {
            if (targetMode || cloneBlueprintSource || cloneBuildingType || mapToolMode !== 'normal') {
              e.preventDefault();
              onCancelSpecialMode?.();
            }
          }}
          onMouseLeave={() => {
            specialDragKindRef.current = 'none';
            dragStartPlotRef.current = null;
            liveAreaIdsRef.current = [];
            liveRoadIdsRef.current = [];
            setRoadPreviewInfo(null);
            handlers.onMouseUp();
            hoveredPlotIdRef.current = null;
            if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
          }}
          onWheel={handlers.onWheel}
          onTouchStart={handlers.onTouchStart}
          onTouchMove={handleTouchMoveOrPass(handlers.onTouchMove)}
          onTouchEnd={handleTouchEnd}
        />

        {/* Aktywny baner celowania / klonowania 1:1 / rysowania drogi */}
        {(targetMode || cloneBlueprintSource || cloneBuildingType || roadPreviewInfo) && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0e1522]/95 border border-rose-500/60 shadow-2xl backdrop-blur-md max-w-[calc(100%-24px)]">
            <span className="text-xs font-semibold text-rose-100">
              {targetMode === 'nuke'
                ? '☢️ Wskaż działkę na mapie dla ataku jądrowego 5×5'
                : targetMode === 'missile'
                  ? '🚀 Wskaż cel uderzenia taktycznego 3×3'
                  : roadPreviewInfo
                    ? `${mapToolMode === 'road_bridge' ? '🌉 Rysowanie Mostu / Drogi' : '🛣️ Rysowanie odcinka'}: ${roadPreviewInfo.count} pól · Koszt: ${formatMoney(roadPreviewInfo.cost)}`
                    : cloneBlueprintSource && cloneBlueprintCost
                      ? `🧪 Klonowanie 1:1 „${BUILDING_DEFINITIONS[cloneBlueprintSource.buildingType]?.name ?? cloneBlueprintSource.buildingType}” · Koszt: ${formatMoney(cloneBlueprintCost.totalCost)} (baza ${formatCompactMoney(cloneBlueprintCost.baseCost)} + ulepszenia/flota ${formatCompactMoney(cloneBlueprintCost.upgradesCost + cloneBlueprintCost.fleetCost)}) · Klikaj seryjnie puste działki`
                      : `🧪 Tryb klonowania: Kliknij wolną własną działkę, aby postawić "${BUILDING_DEFINITIONS[cloneBuildingType!]?.name ?? cloneBuildingType}"`}
            </span>
            {cloneBlueprintSource && onToggleCloneUpgrades && (
              <div className="text-[11px] bg-[#162033] px-2 py-1 rounded border border-[#2d3b52]">
                <DarkToggle
                  checked={cloneBlueprintSource.includeUpgrades}
                  onChange={onToggleCloneUpgrades}
                  label="Ulepszenia 1:1"
                />
              </div>
            )}
            {onCancelSpecialMode && (
              <button
                type="button"
                onClick={onCancelSpecialMode}
                className="px-2 py-0.5 rounded bg-[#0f1623] border border-[#243044] text-[11px] text-slate-300 hover:text-white"
              >
                Anuluj (Esc/PPM)
              </button>
            )}
          </div>
        )}

        {/* Pasek hurtowego zaznaczania obszaru (Kup wszystkie / Geologia) */}
        {areaSelectedPlotIds.length > 0 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0e1522]/95 border border-sky-500/60 shadow-2xl backdrop-blur-md text-xs">
            <span className="font-semibold text-sky-300">
              📐 Zaznaczono: {areaSelectedPlotIds.length} pól
            </span>
            {onBatchBuyPlots && buyableAreaPlots.length > 0 && (
              <button
                type="button"
                disabled={localPlayer.cash < buyAreaTotalCost}
                onClick={() => onBatchBuyPlots(buyableAreaPlots.map((p) => p.id))}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold"
              >
                💰 Kup wolne ({buyableAreaPlots.length} · {formatCompactMoney(buyAreaTotalCost)})
              </button>
            )}
            {onBatchSurveyPlots && surveyableAreaPlots.length > 0 && (
              <button
                type="button"
                disabled={localPlayer.cash < surveyAreaTotalCost}
                onClick={() => onBatchSurveyPlots(surveyableAreaPlots.map((p) => p.id))}
                className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-semibold"
              >
                🔍 Geologia ({surveyableAreaPlots.length} · {formatCompactMoney(surveyAreaTotalCost)})
              </button>
            )}
            <button
              type="button"
              onClick={() => onAreaSelectionChange?.([])}
              className="px-2 py-1 rounded bg-[#182235] border border-[#2d3b52] text-slate-300"
            >
              Wyczyść
            </button>
          </div>
        )}

        {/* Pasek dynamicznych nakładek analitycznych mapy (Heatmaps) i narzędzi QoL */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5 max-w-[calc(100%-20px)]">
          {onChangeHeatmapMode && (
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0b0f17]/90 border border-[#243044] backdrop-blur-md shadow-xl">
              {HEATMAP_MODE_OPTIONS.map((hm) => (
                <button
                  key={hm.key}
                  type="button"
                  onClick={() => onChangeHeatmapMode(hm.key)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors ${
                    heatmapMode === hm.key
                      ? 'bg-amber-500/20 border border-amber-400/60 text-amber-200'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#151e2e]'
                  }`}
                  title={`Nakładka mapy: ${hm.label}`}
                >
                  <span>{hm.icon}</span>
                  <span className="hidden sm:inline">{hm.label}</span>
                </button>
              ))}
            </div>
          )}

          {onChangeMapToolMode && (
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0b0f17]/90 border border-[#243044] backdrop-blur-md shadow-xl w-fit">
              {(
                [
                  { id: 'normal', icon: '🖱️', label: 'Zwykły' },
                  { id: 'area_select', icon: '📐', label: 'Obszar (Shift)' },
                  { id: 'road_local', icon: '🛣️', label: 'Rysuj Drogę (R)' },
                  { id: 'road_highway', icon: '🟨', label: 'Rysuj Autostradę' },
                  { id: 'road_bridge', icon: '🌉', label: 'Rysuj Most' },
                ] as { id: MapToolMode; icon: string; label: string }[]
              ).map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => onChangeMapToolMode(mapToolMode === tool.id && tool.id !== 'normal' ? 'normal' : tool.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors ${
                    mapToolMode === tool.id
                      ? 'bg-sky-500/25 border border-sky-400/65 text-sky-200'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#151e2e]'
                  }`}
                >
                  <span>{tool.icon}</span>
                  <span className="hidden md:inline">{tool.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Szybkie przyciski zoom / wyśrodkowania */}
        <div className="absolute bottom-20 md:bottom-5 right-3 flex flex-col gap-1.5 z-10">
          <button
            type="button"
            onClick={() => zoomBy(1.22)}
            className="w-9 h-9 rounded-lg bg-[#111827]/90 border border-[#243044] text-slate-200 hover:border-sky-400 hover:text-sky-300 font-mono text-base flex items-center justify-center shadow-lg transition-colors"
            title="Przybliż mapę"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(0.82)}
            className="w-9 h-9 rounded-lg bg-[#111827]/90 border border-[#243044] text-slate-200 hover:border-sky-400 hover:text-sky-300 font-mono text-base flex items-center justify-center shadow-lg transition-colors"
            title="Oddal mapę"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => {
              const rect = containerRef.current?.getBoundingClientRect();
              if (rect) {
                centerOn(rect.width * 0.48, rect.height * 0.45 - gameState.settings.mapSize * 14, 1.0);
              }
            }}
            className="w-9 h-9 rounded-lg bg-[#111827]/90 border border-[#243044] text-slate-200 hover:border-amber-400 hover:text-amber-300 text-xs flex items-center justify-center shadow-lg transition-colors"
            title="Wyśrodkuj widok"
          >
            ⌖
          </button>
        </div>

        {/* Tooltip aktualizowany bezpośrednio przez DOM ref — ZERO re-renderów Reacta */}
        <div
          ref={tooltipRef}
          style={{ opacity: 0 }}
          className="hidden md:block pointer-events-none absolute top-0 left-0 z-20 px-2.5 py-1.5 rounded-md bg-[#0b0f17]/95 border border-[#2a3950] shadow-xl text-xs transition-opacity duration-75"
        >
          <div ref={tooltipTitleRef} className="font-medium text-slate-100" />
          <div ref={tooltipSubRef} />
        </div>
      </div>
    );
  }
);

function handleTouchMoveOrPass(fn: (e: React.TouchEvent<HTMLCanvasElement>) => void) {
  return fn;
}
