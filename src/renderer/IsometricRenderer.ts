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
  private cachedMapSize = 0;
  private offscreenOriginX = 0;
  private offscreenOriginY = 0;
  private offscreenLogicalW = 1;
  private offscreenLogicalH = 1;

  // O(1) plot lookup index
  private plotById = new Map<string, Plot>();
  private plotGrid: (Plot | null)[] = [];
  private plotGridSize = 0;
  private sortedBuildings: Plot[] = [];
  private cachedPlotRef: Plot[] | null = null;

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

    // Sygnatura statycznej warstwy terenu + prywatnej geologii + dróg/autostrad + aktywnej heatmapy
    const curPid = state.currentPlayerId;
    let sig = `${mapSize}_${state.plots.length}_${curPid}_${heatmapMode}_`;
    for (let i = 0; i < state.plots.length; i++) {
      const p = state.plots[i];
      const surv = p.surveyedBy?.[curPid] ? 1 : 0;
      if (p.ownerId || p.hasRoad || p.building || surv || heatmapMode !== 'standard') {
        sig += `${i}:${p.ownerId ?? ''}:${p.roadType}:${p.tollRate}:${p.roadBlocked ? 1 : 0}:${p.building?.type ?? ''}:${surv}:${heatmapMode === 'response_time' ? p.responseEta ?? 99 : ''}:${heatmapMode === 'security' ? p.crimeScore : ''};`;
      }
    }

    if (sig !== this.cachedTerrainSignature || this.cachedMapSize !== mapSize) {
      this.cachedTerrainSignature = sig;
      this.cachedMapSize = mapSize;

      const xMin = -(mapSize - 1) * (TILE_WIDTH / 2) - TILE_WIDTH;
      const xMax = (mapSize - 1) * (TILE_WIDTH / 2) + TILE_WIDTH;
      const yMin = -TILE_HEIGHT;
      const yMax = (mapSize - 1) * TILE_HEIGHT + TILE_HEIGHT * 1.5;

      this.offscreenOriginX = -xMin;
      this.offscreenOriginY = -yMin;
      this.offscreenLogicalW = Math.ceil(xMax - xMin);
      this.offscreenLogicalH = Math.ceil(yMax - yMin);

      this.offscreenCanvas.width = this.offscreenLogicalW * OFFSCREEN_SUPERSAMPLE;
      this.offscreenCanvas.height = this.offscreenLogicalH * OFFSCREEN_SUPERSAMPLE;
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
        OFFSCREEN_SUPERSAMPLE,
        curPid,
        heatmapMode
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
    heatmapMode: MapHeatmapMode = 'standard'
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

    // 2. Podświetlenie wyłącznie najechanego i wybranego pola
    const hoveredPlot = hoveredPlotId ? this.plotById.get(hoveredPlotId) ?? null : null;
    const selectedPlot = selectedPlotId ? this.plotById.get(selectedPlotId) ?? null : null;
    this.terrainRenderer.renderHoverAndSelection(
      ctx,
      camera,
      hoveredPlot,
      selectedPlot,
      this.frameCount
    );

    const tw = TILE_WIDTH * camera.zoom;
    const th = TILE_HEIGHT * camera.zoom;

    // 2b. Opcjonalna warstwa linii logistycznych (morskie, lotnicze, drogowe)
    if ((showTransportRoutes || heatmapMode === 'logistics') && state.transportLines?.length > 0 && camera.zoom >= 0.4) {
      this.renderTransportLines(ctx, state, camera, tw, th);
    }

    // 3. Budynki (sortowanie depth wykonane tylko przy zmianie planszy)
    this.buildingRenderer.tick();
    const playerColorMap = new Map<string, string>();
    for (const p of state.players) playerColorMap.set(p.id, p.color);

    for (const plot of this.sortedBuildings) {
      if (!plot.building) continue;
      const { screenX, screenY } = worldToScreen(plot.gridX, plot.gridY, tw, th, camera.x, camera.y);
      if (
        screenX + tw * 2 < 0 ||
        screenX - tw * 2 > this.width ||
        screenY + th * 4 < 0 ||
        screenY - th * 4 > this.height
      ) {
        continue;
      }
      const ownerColor = playerColorMap.get(plot.building.ownerId) ?? '#f59e0b';
      const b = plot.id === selectedPlotId ? { ...plot.building, selected: true } : plot.building;
      this.buildingRenderer.renderBuilding(ctx, b, screenX, screenY, tw, th, ownerColor);
    }

    // 4. Animowane pojazdy jadące po sieci dróg, morzu i w powietrzu
    this.vehicleRenderer.renderVehicles(ctx, vehicles, camera, this.plotById);

    ctx.restore();
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
