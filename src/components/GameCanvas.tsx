import React, { useEffect, useRef } from 'react';
import { HEATMAP_MODE_OPTIONS, TERRAIN_NAMES, TOLL_RATE_CONFIG } from '../config/gameConfig';
import { hasPlayerSurveyedPlot } from '../engine/PlotSystem';
import { stepVehiclePositions } from '../engine/TransportSystem';
import type { GameState, MapHeatmapMode, Plot } from '../engine/types';
import { useIsometricCamera } from '../hooks/useIsometricCamera';
import { IsometricRenderer } from '../renderer/IsometricRenderer';
import { formatCompactMoney } from '../utils/formatters';

interface GameCanvasProps {
  gameState: GameState;
  selectedPlotId: string | null;
  showTransportRoutes?: boolean;
  heatmapMode?: MapHeatmapMode;
  onChangeHeatmapMode?: (mode: MapHeatmapMode) => void;
  onSelectPlot: (plotId: string | null) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = React.memo(
  ({
    gameState,
    selectedPlotId,
    showTransportRoutes = true,
    heatmapMode = 'standard',
    onChangeHeatmapMode,
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
    const hoveredPlotIdRef = useRef<string | null>(null);
    const containerWidthRef = useRef(800);

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
    }, [gameState, selectedPlotId, showTransportRoutes, heatmapMode]);

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
          heatmapRef.current
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

      if (!plot || plot.terrain === 'water') {
        box.style.opacity = '0';
        return;
      }

      box.style.opacity = '1';
      box.style.transform = `translate3d(${Math.min(localX + 14, containerWidthRef.current - 230)}px, ${Math.max(12, localY - 12)}px, 0)`;
      titleEl.textContent = `(${plot.gridX}, ${plot.gridY}) · ${TERRAIN_NAMES[plot.terrain]}`;

      const curPid = stateRef.current.currentPlayerId;
      if (plot.building) {
        subEl.className = 'text-emerald-400 font-mono mt-0.5';
        subEl.textContent = `${plot.building.icon} ${plot.building.name} (${Math.round(plot.building.damagePercent)}% zniszcz.)`;
      } else if (plot.hasRoad) {
        const owner = plot.ownerId
          ? stateRef.current.players.find((p) => p.id === plot.ownerId)?.companyName
          : 'Droga';
        const roadName = plot.roadType === 'highway' ? 'Autostrada' : 'Droga Zwykła';
        const tollTxt = plot.roadBlocked
          ? 'BLOKADA'
          : TOLL_RATE_CONFIG[plot.tollRate ?? 'free'].label;
        subEl.className = 'text-amber-300 mt-0.5';
        subEl.textContent = `🛣️ ${roadName} (${owner ?? ''}) · ${tollTxt}`;
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
        subEl.className = 'text-amber-400 font-mono mt-0.5';
        subEl.textContent = `Cena: ${formatCompactMoney(plot.price)}${surveyedTxt}`;
      }
    };

    const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      handlers.onMouseMove(e);
      const rect = e.currentTarget.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      const plot = pickPlot(e.clientX, e.clientY);
      hoveredPlotIdRef.current = plot ? plot.id : null;
      updateTooltipDom(plot, lx, ly);
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const wasClick = handlers.onMouseUp();
      if (wasClick) {
        const plot = pickPlot(e.clientX, e.clientY);
        onSelectPlot(plot ? plot.id : null);
      }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
      const wasTap = handlers.onTouchEnd();
      if (wasTap && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        const plot = pickPlot(t.clientX, t.clientY);
        onSelectPlot(plot ? plot.id : null);
      }
    };

    return (
      <div ref={containerRef} id="game-canvas" className="relative w-full h-full overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          className="block w-full h-full cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={handlers.onMouseDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handlers.onMouseUp();
            hoveredPlotIdRef.current = null;
            if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
          }}
          onWheel={handlers.onWheel}
          onTouchStart={handlers.onTouchStart}
          onTouchMove={handleTouchMoveOrPass(handlers.onTouchMove)}
          onTouchEnd={handleTouchEnd}
        />

        {/* Pasek dynamicznych nakładek analitycznych mapy (Heatmaps) */}
        {onChangeHeatmapMode && (
          <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0b0f17]/90 border border-[#243044] backdrop-blur-md shadow-xl max-w-[calc(100%-20px)]">
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
