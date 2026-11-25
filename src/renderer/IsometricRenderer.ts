import type { Camera, GameState, MapHeatmapMode, Plot, Vehicle } from '../engine/types';
import { BuildingRenderer } from './BuildingRenderer';
import { TerrainRenderer } from './TerrainRenderer';
import { VehicleRenderer } from './VehicleRenderer';
import { TILE_HEIGHT, TILE_WIDTH, screenToWorld, sortByDepth, worldToScreen } from './utils';

const OFFSCREEN_SUPERSAMPLE = 2;

export class IsometricRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrainRenderer = new TerrainRenderer();
  private buildingRenderer = new BuildingRenderer();
  private vehicleRenderer = new VehicleRenderer();
  private width = 800;
  private height = 600;
  private dpr = 1;
  private frameCount = 0;

  // Offscreen static terrain buffer
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private cachedTerrainSignature = '';
  private cachedQuickKey = '';
  private cachedMapSize = 0;
  private cachedSupersample = OFFSCREEN_SUPERSAMPLE;
  private offscreenOriginX = 0;
  private offscreenOriginY = 0;
  private offscreenLogicalW = 1;
  private offscreenLogicalH = 1;

  // O(1) plot lookup index & cached palette
  private plotById = new Map<string, Plot>();
  private plotGrid: (Plot | null)[] = [];
  private plotGridSize = 0;
  private sortedBuildings: Plot[] = [];
  private cachedPlotRef: Plot[] | null = null;
  private playerColorMap = new Map<string, string>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not initialize 2D Canvas context');
    this.ctx = ctx;

    this.offscreenCanvas = document.createElement('canvas');
    const octx = this.offscreenCanvas.getContext('2d');
    if (!octx) throw new Error('Could not initialize offscreen Canvas context');
    this.offscreenCtx = octx;
  }

  resize(width: number, height: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
  }

  private syncPlotCache(state: GameState, heatmapMode: MapHeatmapMode): void {
    const mapSize = state.settings.mapSize;
    const curPid = state.currentPlayerId;

    // Buduj indeks O(1) gdy tablica działek się zmieniła
    if (this.cachedPlotRef !== state.plots) {
      this.cachedPlotRef = state.plots;
      this.plotGridSize = mapSize;
      this.plotById.clear();
      this.plotGrid = new Array(mapSize * mapSize).fill(null);
      for (const p of state.plots) {
        this.plotById.set(p.id, p);
        if (p.gridX >= 0 && p.gridX < mapSize && p.gridY >= 0 && p.gridY < mapSize) {
          this.plotGrid[p.gridY * mapSize + p.gridX] = p;
        }
      }
      this.sortedBuildings = sortByDepth(state.plots.filter((p) => p.building !== null));
    }

    const quickKey = `${mapSize}_${state.plots.length}_${curPid}_${heatmapMode}_${state.time.tick}_${state.networkRevision ?? 0}_${state.coalitions?.length ?? 0}`;
    if (quickKey === this.cachedQuickKey && this.cachedMapSize === mapSize) {
      return;
    }
    this.cachedQuickKey = quickKey;

    // Sygnatura statycznej warstwy terenu + prywatnej geologii + dróg/autostrad + skażenia + aktywnej heatmapy
    let sig = `${mapSize}_${state.plots.length}_${curPid}_${heatmapMode}_${state.coalitions?.length ?? 0}_`;
    for (let i = 0; i < state.plots.length; i++) {
      const p = state.plots[i];
      const surv = p.surveyedBy?.[curPid] ? 1 : 0;
      const rad = (p.irradiatedTicks ?? 0) > 0 ? 1 : 0;
      if (p.ownerId || p.hasRoad || p.building || surv || rad || heatmapMode !== 'standard') {
        sig += `${i}:${p.ownerId ?? ''}:${p.roadType}:${p.tollRate}:${p.roadBlocked ? 1 : 0}:${p.building?.type ?? ''}:${surv}:${rad}:${heatmapMode === 'response_time' ? p.responseEta ?? 99 : ''}:${heatmapMode === 'security' ? p.crimeScore : ''};`;
      }
    }

    if (sig !== this.cachedTerrainSignature || this.cachedMapSize !== mapSize) {
      this.cachedTerrainSignature = sig;
      this.cachedMapSize = mapSize;
      this.cachedSupersample = mapSize >= 32 ? 1.5 : OFFSCREEN_SUPERSAMPLE;

      const xMin = -(mapSize - 1) * (TILE_WIDTH / 2) - TILE_WIDTH;
      const xMax = (mapSize - 1) * (TILE_WIDTH / 2) + TILE_WIDTH;
      const yMin = -TILE_HEIGHT;
      const yMax = (mapSize - 1) * TILE_HEIGHT + TILE_HEIGHT * 1.5;

      this.offscreenOriginX = -xMin;
      this.offscreenOriginY = -yMin;
      this.offscreenLogicalW = Math.ceil(xMax - xMin);
      this.offscreenLogicalH = Math.ceil(yMax - yMin);

      this.offscreenCanvas.width = Math.ceil(this.offscreenLogicalW * this.cachedSupersample);
      this.offscreenCanvas.height = Math.ceil(this.offscreenLogicalH * this.cachedSupersample);
      this.offscreenCtx.clearRect(
        0,
        0,
        this.offscreenCanvas.width,
        this.offscreenCanvas.height
      );

      this.terrainRenderer.renderStaticMapToBuffer(
        this.offscreenCtx,
        state.plots,
        state.players,
        mapSize,
        this.offscreenOriginX,
        this.offscreenOriginY,
        this.cachedSupersample,
        curPid,
        heatmapMode,
        state
      );
    }
  }

  render(
    state: GameState,
    camera: Camera,
    hoveredPlotId: string | null,
    selectedPlotId: string | null,
    vehicles: Vehicle[],
    showTransportRoutes = true,
    heatmapMode: MapHeatmapMode = 'standard',
    targetMode: 'missile' | 'nuke' | null = null
  ): void {
    this.frameCount++;
    this.syncPlotCache(state, heatmapMode);

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Głębokie tło terminala
    ctx.fillStyle = '#0a101b';
    ctx.fillRect(0, 0, this.width, this.height);

    // 1. Jedno wywołanie drawImage z bufora offscreen dla całego statycznego terenu + dróg!
    const destX = camera.x - this.offscreenOriginX * camera.zoom;
    const destY = camera.y - this.offscreenOriginY * camera.zoom;
    const destW = this.offscreenLogicalW * camera.zoom;
    const destH = this.offscreenLogicalH * camera.zoom;
    ctx.drawImage(this.offscreenCanvas, destX, destY, destW, destH);

    // 2. Podświetlenie najechanego, wybranego pola oraz strefy rażenia (rakieta/atom)
    const hoveredPlot = hoveredPlotId ? this.plotById.get(hoveredPlotId) ?? null : null;
    const selectedPlot = selectedPlotId ? this.plotById.get(selectedPlotId) ?? null : null;
    this.terrainRenderer.renderHoverAndSelection(
      ctx,
      camera,
      hoveredPlot,
      selectedPlot,
      this.frameCount
    );
    if (targetMode) {
      this.terrainRenderer.renderTargetFootprint(
        ctx,
        camera,
        hoveredPlot,
        targetMode,
        this.plotGrid,
        this.plotGridSize,
        this.frameCount
      );
    }

    const tw = TILE_WIDTH * camera.zoom;
    const th = TILE_HEIGHT * camera.zoom;

    // 2b. Opcjonalna warstwa linii logistycznych (morskie, lotnicze, drogowe)
    if ((showTransportRoutes || heatmapMode === 'logistics') && state.transportLines?.length > 0 && camera.zoom >= 0.4) {
      this.renderTransportLines(ctx, state, camera, tw, th);
    }

    // 3. Budynki z pełnym Viewport Cullingiem i zerową alokacją obiektów na klatkę
    this.buildingRenderer.tick();
    this.playerColorMap.clear();
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      this.playerColorMap.set(p.id, p.color);
    }

    for (let i = 0; i < this.sortedBuildings.length; i++) {
      const plot = this.sortedBuildings[i];
      if (!plot.building) continue;
      const { screenX, screenY } = worldToScreen(plot.gridX, plot.gridY, tw, th, camera.x, camera.y);
      if (
        screenX + tw * 1.8 < 0 ||
        screenX - tw * 1.8 > this.width ||
        screenY + th * 3.8 < 0 ||
        screenY - th * 3.8 > this.height
      ) {
        continue;
      }
      const ownerColor = this.playerColorMap.get(plot.building.ownerId) ?? '#f59e0b';
      this.buildingRenderer.renderBuilding(
        ctx,
        plot.building,
        screenX,
        screenY,
        tw,
        th,
        ownerColor,
        plot.id === selectedPlotId
      );
    }

    // 4. Animowane pojazdy jadące po sieci dróg, morzu i w powietrzu
    this.vehicleRenderer.renderVehicles(ctx, vehicles, camera, this.plotById);

    // 5. Efekty fal uderzeniowych, wybuchów rakiet/nuke i katastrof naturalnych
    if (state.blastEffects && state.blastEffects.length > 0) {
      this.renderBlastEffects(ctx, state, camera, tw, th);
    }

    ctx.restore();
  }

  private renderBlastEffects(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camera: Camera,
    tw: number,
    th: number
  ): void {
    const effects = state.blastEffects ?? [];
    for (const fx of effects) {
      const { screenX, screenY } = worldToScreen(fx.centerX, fx.centerY, tw, th, camera.x, camera.y);
      const pulse = (Math.sin(this.frameCount * 0.22) + 1) * 0.5;
      const rx = fx.radius * tw * (0.65 + pulse * 0.35);
      const ry = fx.radius * th * (0.65 + pulse * 0.35);

      ctx.save();
      if (fx.kind === 'nuke') {
        const g = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, rx);
        g.addColorStop(0, 'rgba(254, 240, 138, 0.75)');
        g.addColorStop(0.45, 'rgba(249, 115, 22, 0.5)');
        g.addColorStop(0.85, 'rgba(132, 204, 22, 0.25)');
        g.addColorStop(1, 'rgba(132, 204, 22, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.lineWidth = 2.5 * camera.zoom;
        ctx.stroke();
      } else if (fx.kind === 'missile') {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.32)';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.9)';
        ctx.lineWidth = 2.2 * camera.zoom;
        ctx.stroke();
      } else {
        ctx.strokeStyle =
          fx.kind === 'flood'
            ? 'rgba(56, 189, 248, 0.72)'
            : fx.kind === 'tornado'
              ? 'rgba(203, 213, 225, 0.75)'
              : 'rgba(245, 158, 11, 0.72)';
        ctx.lineWidth = 2.0 * camera.zoom;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderTransportLines(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camera: Camera,
    tw: number,
    th: number
  ): void {
    ctx.save();
    for (const line of state.transportLines) {
      const from = this.plotById.get(line.fromPlotId);
      const to = this.plotById.get(line.toPlotId);
      if (!from || !to) continue;
      const p1 = worldToScreen(from.gridX, from.gridY, tw, th, camera.x, camera.y);
      const p2 = worldToScreen(to.gridX, to.gridY, tw, th, camera.x, camera.y);

      ctx.beginPath();
      if (line.mode === 'air') {
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.55)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 5]);
        const midX = (p1.screenX + p2.screenX) / 2;
        const midY = (p1.screenY + p2.screenY) / 2 - 28 * camera.zoom;
        ctx.moveTo(p1.screenX, p1.screenY - 6 * camera.zoom);
        ctx.quadraticCurveTo(midX, midY, p2.screenX, p2.screenY - 6 * camera.zoom);
      } else if (line.mode === 'sea') {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([8, 4]);
        ctx.moveTo(p1.screenX, p1.screenY);
        ctx.lineTo(p2.screenX, p2.screenY);
      } else {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 4]);
        ctx.moveTo(p1.screenX, p1.screenY);
        ctx.lineTo(p2.screenX, p2.screenY);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Matematyczny hit-testing O(1) — zero pętli po wszystkich działkach.
   */
  getPlotAtScreen(
    screenX: number,
    screenY: number,
    camera: Camera,
    plots: Plot[]
  ): Plot | null {
    const tw = TILE_WIDTH * camera.zoom;
    const th = TILE_HEIGHT * camera.zoom;
    const { gridX, gridY } = screenToWorld(screenX, screenY, tw, th, camera.x, camera.y);
    const gx = Math.round(gridX);
    const gy = Math.round(gridY);

    if (this.plotGridSize > 0) {
      if (gx < 0 || gx >= this.plotGridSize || gy < 0 || gy >= this.plotGridSize) {
        return null;
      }
      return this.plotGrid[gy * this.plotGridSize + gx] ?? null;
    }

    const mapSize = Math.round(Math.sqrt(plots.length));
    if (gx < 0 || gx >= mapSize || gy < 0 || gy >= mapSize) return null;
    return plots[gy * mapSize + gx] ?? null;
  }
}
