import { hasPlayerDiscoveredPlot, hasPlayerSurveyedPlot } from '../engine/PlotSystem';
import type {
  Camera,
  GameState,
  MapHeatmapMode,
  MapPlot,
  Player,
  TerrainType,
} from '../engine/types';
import {
  TILE_HEIGHT,
  TILE_WIDTH,
  darkenColor,
  lightenColor,
  worldToScreen,
} from './utils';

const TERRAIN_COLORS: Record<TerrainType, string> = {
  grass: '#3b644c',
  forest: '#254a36',
  water: '#1e5484',
  mountain: '#6b5e50',
  desert: '#a88f59',
  coastal: '#4c829b',
  urban: '#363f52',
};

const DEPOSIT_BADGES: Record<string, { color: string; symbol: string }> = {
  coal: { color: '#94a3b8', symbol: 'C' },
  ironOre: { color: '#f59e0b', symbol: 'Fe' },
  copper: { color: '#ea580c', symbol: 'Cu' },
  gold: { color: '#fde047', symbol: 'Au' },
  oil: { color: '#fbbf24', symbol: 'Oil' },
  uranium: { color: '#84cc16', symbol: 'U' },
  rareMetals: { color: '#38bdf8', symbol: 'RM' },
  diamonds: { color: '#67e8f9', symbol: 'Di' },
  lithium: { color: '#c084fc', symbol: 'Li' },
};

function isRoadPlot(plot: MapPlot | undefined): boolean {
  return Boolean(plot && plot.hasRoad);
}

export class TerrainRenderer {
  renderStaticMapToBuffer(
    ctx: CanvasRenderingContext2D,
    plots: MapPlot[],
    players: Player[],
    mapSize: number,
    originX: number,
    originY: number,
    supersample: number,
    currentPlayerId = 'player_1',
    heatmapMode: MapHeatmapMode = 'standard',
    state?: GameState
  ): void {
    const tw = TILE_WIDTH * supersample;
    const th = TILE_HEIGHT * supersample;
    const ox = originX * supersample;
    const oy = originY * supersample;

    const playerColorMap = new Map<string, string>();
    for (const p of players) playerColorMap.set(p.id, p.color);
    const viewerPlayer = players.find((p) => p.id === currentPlayerId);

    const gridLookup = new Map<string, MapPlot>();
    for (const p of plots) gridLookup.set(`${p.gridX}_${p.gridY}`, p);

    for (const plot of plots) {
      const { screenX, screenY } = worldToScreen(plot.gridX, plot.gridY, tw, th, ox, oy);
      const ownerColor = plot.ownerId ? playerColorMap.get(plot.ownerId) ?? '#f59e0b' : null;
      this.drawTile(
        ctx,
        plot,
        screenX,
        screenY,
        tw,
        th,
        ownerColor,
        supersample,
        heatmapMode
      );

      if (isRoadPlot(plot)) {
        const hasN = isRoadPlot(gridLookup.get(`${plot.gridX}_${plot.gridY - 1}`));
        const hasE = isRoadPlot(gridLookup.get(`${plot.gridX + 1}_${plot.gridY}`));
        const hasS = isRoadPlot(gridLookup.get(`${plot.gridX}_${plot.gridY + 1}`));
        const hasW = isRoadPlot(gridLookup.get(`${plot.gridX - 1}_${plot.gridY}`));
        this.drawSeamlessIsoRoad(
          ctx,
          plot,
          screenX,
          screenY,
          tw,
          th,
          hasN,
          hasE,
          hasS,
          hasW,
          supersample
        );
      }

      if (!plot.building && plot.terrain !== 'water') {
        const discovered = hasPlayerDiscoveredPlot(plot, currentPlayerId, viewerPlayer, state);
        if (discovered && plot.deposits.length > 0) {
          this.drawDepositBadge(ctx, plot, screenX, screenY, tw);
        } else if (hasPlayerSurveyedPlot(plot, currentPlayerId) && plot.deposits.length === 0) {
          this.drawEmptySurveyBadge(ctx, screenX, screenY, tw);
        }
      }
    }

    void mapSize;
  }

  renderTargetFootprint(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    hoveredPlot: MapPlot | null,
    targetMode: 'missile' | 'nuke' | null,
    plotGrid: (MapPlot | null)[],
    gridSize: number,
    frameCount: number
  ): void {
    if (!hoveredPlot || !targetMode || gridSize <= 0) return;
    const radius = targetMode === 'nuke' ? 2 : 1;
    const tw = TILE_WIDTH * camera.zoom;
    const th = TILE_HEIGHT * camera.zoom;
    const pulse = 0.35 + Math.sin(frameCount * 0.16) * 0.2;
    const fill =
      targetMode === 'nuke' ? `rgba(132, 204, 22, ${pulse * 0.55})` : `rgba(239, 68, 68, ${pulse * 0.55})`;
    const stroke = targetMode === 'nuke' ? '#a3e635' : '#ef4444';

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const gx = hoveredPlot.gridX + dx;
        const gy = hoveredPlot.gridY + dy;
        if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) continue;
        const p = plotGrid[gy * gridSize + gx];
        if (!p) continue;
        const { screenX, screenY } = worldToScreen(gx, gy, tw, th, camera.x, camera.y);
        this.strokeDiamond(ctx, screenX, screenY, tw, th, fill, stroke, dx === 0 && dy === 0 ? 2.4 : 1.3);
      }
    }
  }

  renderHoverAndSelection(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    hoveredPlot: MapPlot | null,
    selectedPlot: MapPlot | null,
    frameCount: number
  ): void {
    const tw = TILE_WIDTH * camera.zoom;
    const th = TILE_HEIGHT * camera.zoom;

    if (hoveredPlot && hoveredPlot.id !== selectedPlot?.id) {
      const { screenX, screenY } = worldToScreen(
        hoveredPlot.gridX,
        hoveredPlot.gridY,
        tw,
        th,
        camera.x,
        camera.y
      );
      this.strokeDiamond(ctx, screenX, screenY, tw, th, 'rgba(255,255,255,0.14)', '#e2e8f0', 1.8);
    }

    if (selectedPlot) {
      const { screenX, screenY } = worldToScreen(
        selectedPlot.gridX,
        selectedPlot.gridY,
        tw,
        th,
        camera.x,
        camera.y
      );
      const pulse = Math.sin(frameCount * 0.09) * 0.25 + 0.75;
      this.strokeDiamond(
        ctx,
        screenX,
        screenY,
        tw,
        th,
        'rgba(245,158,11,0.12)',
        `rgba(245, 158, 11, ${pulse})`,
        2.4
      );
    }
  }

  private strokeDiamond(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    tw: number,
    th: number,
    fill: string,
    stroke: string,
    lineWidth: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - th / 2);
    ctx.lineTo(cx + tw / 2, cy);
    ctx.lineTo(cx, cy + th / 2);
    ctx.lineTo(cx - tw / 2, cy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  private drawTile(
    ctx: CanvasRenderingContext2D,
    plot: MapPlot,
    cx: number,
    cy: number,
    tw: number,
    th: number,
    ownerColor: string | null,
    supersample: number,
    heatmapMode: MapHeatmapMode
  ): void {
    const baseColor = TERRAIN_COLORS[plot.terrain];
    const topX = cx;
    const topY = cy - th / 2;
    const rightX = cx + tw / 2;
    const rightY = cy;
    const bottomX = cx;
    const bottomY = cy + th / 2;
    const leftX = cx - tw / 2;
    const leftY = cy;

    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(rightX, rightY);
    ctx.lineTo(bottomX, bottomY);
    ctx.lineTo(leftX, leftY);
    ctx.closePath();
    ctx.fillStyle =
      (plot.gridX + plot.gridY) % 2 === 0 ? lightenColor(baseColor, 0.04) : baseColor;
    ctx.fill();

    if (plot.terrain !== 'water') {
      const depth = 4 * supersample;
      ctx.fillStyle = darkenColor(baseColor, 0.34);
      ctx.beginPath();
      ctx.moveTo(leftX, leftY);
      ctx.lineTo(bottomX, bottomY);
      ctx.lineTo(bottomX, bottomY + depth);
      ctx.lineTo(leftX, leftY + depth);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = darkenColor(baseColor, 0.48);
      ctx.beginPath();
      ctx.moveTo(bottomX, bottomY);
      ctx.lineTo(rightX, rightY);
      ctx.lineTo(rightX, rightY + depth);
      ctx.lineTo(bottomX, bottomY + depth);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.14)';
      ctx.lineWidth = 0.9 * supersample;
      ctx.beginPath();
      ctx.moveTo(cx - 8 * supersample, cy);
      ctx.quadraticCurveTo(cx, cy - 2 * supersample, cx + 8 * supersample, cy);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.8 * supersample;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(rightX, rightY);
    ctx.lineTo(bottomX, bottomY);
    ctx.lineTo(leftX, leftY);
    ctx.closePath();
    ctx.stroke();

    if (ownerColor) {
      ctx.fillStyle = `${ownerColor}24`;
      ctx.fill();
      ctx.strokeStyle = ownerColor;
      ctx.lineWidth = 1.6 * supersample;
      ctx.stroke();
    }

    if (plot.isSseZone && plot.terrain !== 'water') {
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(rightX, rightY);
      ctx.lineTo(bottomX, bottomY);
      ctx.lineTo(leftX, leftY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.9 * supersample;
      ctx.stroke();
      if (!plot.building) {
        ctx.fillStyle = 'rgba(253, 224, 71, 0.9)';
        ctx.font = `700 ${Math.round(6.5 * supersample)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SSE 0%', cx, cy + 5 * supersample);
      }
    }

    this.drawTerrainDetails(ctx, plot.terrain, cx, cy, supersample);

    if ((plot.irradiatedTicks ?? 0) > 0 && plot.terrain !== 'water') {
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(rightX, rightY);
      ctx.lineTo(bottomX, bottomY);
      ctx.lineTo(leftX, leftY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(132, 204, 22, 0.36)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(163, 230, 53, 0.78)';
      ctx.lineWidth = 1.4 * supersample;
      ctx.stroke();

      ctx.fillStyle = 'rgba(190, 242, 100, 0.9)';
      ctx.font = `700 ${Math.round(9 * supersample)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☢', cx, cy - 1 * supersample);
    }

    if (heatmapMode !== 'standard' && plot.terrain !== 'water') {
      const heatFill = this.getHeatmapTint(plot, heatmapMode);
      if (heatFill) {
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(rightX, rightY);
        ctx.lineTo(bottomX, bottomY);
        ctx.lineTo(leftX, leftY);
        ctx.closePath();
        ctx.fillStyle = heatFill;
        ctx.fill();
      }
    }
  }

  private getHeatmapTint(plot: MapPlot, mode: MapHeatmapMode): string | null {
    switch (mode) {
      case 'response_time': {
        const eta = plot.responseEta ?? 99;
        if (eta <= 2) return 'rgba(16, 185, 129, 0.42)';
        if (eta <= 5) return 'rgba(245, 158, 11, 0.42)';
        return 'rgba(244, 63, 94, 0.45)';
      }
      case 'security': {
        if (plot.building?.type === 'policeStation') return 'rgba(56, 189, 248, 0.5)';
        if (plot.crimeScore >= 35) return 'rgba(244, 63, 94, 0.48)';
        if (plot.crimeScore >= 18) return 'rgba(245, 158, 11, 0.36)';
        return 'rgba(16, 185, 129, 0.22)';
      }
      case 'environment': {
        if (plot.neighborPenalty >= 20) return 'rgba(244, 63, 94, 0.45)';
        if (plot.attractiveness >= 72) return 'rgba(16, 185, 129, 0.4)';
        return 'rgba(148, 163, 184, 0.14)';
      }
      case 'logistics': {
        if (plot.hasRoad) {
          if (plot.roadBlocked || (plot.blockedPlayers?.length ?? 0) > 0) {
            return 'rgba(239, 68, 68, 0.55)';
          }
          if (plot.roadType === 'highway') return 'rgba(250, 204, 21, 0.42)';
          return 'rgba(56, 189, 248, 0.32)';
        }
        return null;
      }
      default:
        return null;
    }
  }

  private drawTerrainDetails(
    ctx: CanvasRenderingContext2D,
    terrain: TerrainType,
    cx: number,
    cy: number,
    scale: number
  ): void {
    switch (terrain) {
      case 'forest': {
        const trees = [
          { dx: -8, dy: -2 },
          { dx: 5, dy: -4 },
          { dx: -1, dy: 4 },
        ];
        for (const t of trees) {
          const tx = cx + t.dx * scale;
          const ty = cy + t.dy * scale;
          ctx.fillStyle = '#173827';
          ctx.beginPath();
          ctx.moveTo(tx, ty - 8 * scale);
          ctx.lineTo(tx + 3.6 * scale, ty + 1.5 * scale);
          ctx.lineTo(tx - 3.6 * scale, ty + 1.5 * scale);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'mountain': {
        ctx.fillStyle = '#857766';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 11 * scale);
        ctx.lineTo(cx + 9 * scale, cy + 2 * scale);
        ctx.lineTo(cx - 9 * scale, cy + 2 * scale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#5c5145';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 11 * scale);
        ctx.lineTo(cx + 9 * scale, cy + 2 * scale);
        ctx.lineTo(cx + 1 * scale, cy + 2 * scale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 11 * scale);
        ctx.lineTo(cx + 3.2 * scale, cy - 5.5 * scale);
        ctx.lineTo(cx - 3.2 * scale, cy - 5.5 * scale);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'urban': {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
        ctx.lineWidth = 0.8 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - 10 * scale, cy);
        ctx.lineTo(cx, cy - 5 * scale);
        ctx.lineTo(cx + 10 * scale, cy);
        ctx.lineTo(cx, cy + 5 * scale);
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'coastal': {
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.3)';
        ctx.lineWidth = 0.9 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - 7 * scale, cy);
        ctx.quadraticCurveTo(cx, cy - 2 * scale, cx + 7 * scale, cy);
        ctx.stroke();
        break;
      }
      default:
        break;
    }
  }

  /**
   * Bezszwowe wielokąty izometryczne dla dróg lokalnych i dwupasmowych autostrad:
   * krawędzie równoległe do boków rombu całkowicie eliminują szczeliny między kafelkami!
   */
  private drawSeamlessIsoRoad(
    ctx: CanvasRenderingContext2D,
    plot: MapPlot,
    cx: number,
    cy: number,
    tw: number,
    th: number,
    hasN: boolean,
    hasE: boolean,
    hasS: boolean,
    hasW: boolean,
    scale: number
  ): void {
    const isHighway = plot.roadType === 'highway';
    const r = isHighway ? 0.24 : 0.16;
    const rc = r + (isHighway ? 0.045 : 0.032);

    // Bazowe pół-wektory krawędzi rombu:
    // granica N/S leży wzdłuż (+tw/2, +th/2), granica E/W leży wzdłuż (+tw/2, -th/2)
    const nsEdgeX = tw * 0.5;
    const nsEdgeY = th * 0.5;
    const ewEdgeX = tw * 0.5;
    const ewEdgeY = -th * 0.5;

    const drawRibbon = (
      ratio: number,
      color: string,
      drawCenterDiamond = true
    ) => {
      ctx.fillStyle = color;

      const drawQuad = (dxEnd: number, dyEnd: number, px: number, py: number) => {
        ctx.beginPath();
        ctx.moveTo(cx - px * ratio, cy - py * ratio);
        ctx.lineTo(cx + px * ratio, cy + py * ratio);
        ctx.lineTo(cx + dxEnd + px * ratio, cy + dyEnd + py * ratio);
        ctx.lineTo(cx + dxEnd - px * ratio, cy + dyEnd - py * ratio);
        ctx.closePath();
        ctx.fill();
      };

      const anyArm = hasN || hasE || hasS || hasW;
      if (hasN || !anyArm) drawQuad(tw * 0.25, -th * 0.25, nsEdgeX, nsEdgeY);
      if (hasS || !anyArm) drawQuad(-tw * 0.25, th * 0.25, nsEdgeX, nsEdgeY);
      if (hasE) drawQuad(tw * 0.25, th * 0.25, ewEdgeX, ewEdgeY);
      if (hasW) drawQuad(-tw * 0.25, -th * 0.25, ewEdgeX, ewEdgeY);

      if (drawCenterDiamond) {
        // Romb środkowy łączący idealnie ramiona N/S oraz E/W
        ctx.beginPath();
        ctx.moveTo(cx, cy - th * ratio);
        ctx.lineTo(cx + tw * ratio, cy);
        ctx.lineTo(cx, cy + th * ratio);
        ctx.lineTo(cx - tw * ratio, cy);
        ctx.closePath();
        ctx.fill();
      }
    };

    // 1. Krawężnik / barierka autostrady
    drawRibbon(rc, isHighway ? '#94a3b8' : '#141923', true);
    // 2. Nawierzchnia asfaltowa
    drawRibbon(r, isHighway ? '#1e293b' : '#2d3545', true);

    // 3. Pasy rozdzielające
    ctx.strokeStyle = isHighway ? '#fbbf24' : 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = Math.max(1, (isHighway ? 1.8 : 1.1) * scale);
    ctx.setLineDash(isHighway ? [4 * scale, 2.5 * scale] : [3 * scale, 3 * scale]);

    const anyArm = hasN || hasE || hasS || hasW;
    const strokeAxis = (dx: number, dy: number) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx, cy + dy);
      ctx.stroke();
    };
    if (hasN || !anyArm) strokeAxis(tw * 0.25, -th * 0.25);
    if (hasS || !anyArm) strokeAxis(-tw * 0.25, th * 0.25);
    if (hasE) strokeAxis(tw * 0.25, th * 0.25);
    if (hasW) strokeAxis(-tw * 0.25, -th * 0.25);
    ctx.setLineDash([]);

    // 4. Miniaturowa bramka myta lub czerwony szlaban blokady tranzytu
    const hasBlockade = plot.roadBlocked || (plot.blockedPlayers?.length ?? 0) > 0;
    if (hasBlockade) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.6 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 7 * scale, cy - 3 * scale);
      ctx.lineTo(cx + 7 * scale, cy + 3 * scale);
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(cx, cy - 5 * scale, 3.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    } else if (plot.tollRate !== 'free') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - 5 * scale, cy - 6 * scale, 10 * scale, 3 * scale);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx - 5 * scale, cy - 6 * scale, 10 * scale, 1.1 * scale);
    }
  }

  private drawDepositBadge(
    ctx: CanvasRenderingContext2D,
    plot: MapPlot,
    cx: number,
    cy: number,
    tw: number
  ): void {
    const scale = tw / TILE_WIDTH;
    const dep = plot.deposits[0];
    if (!dep) return;
    const info = DEPOSIT_BADGES[dep.type] ?? { color: '#f59e0b', symbol: 'R' };

    const r = 6.5 * scale;
    ctx.fillStyle = 'rgba(11, 15, 23, 0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = info.color;
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 ${Math.round(6 * scale)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.symbol, cx, cy + 0.5 * scale);
  }

  private drawEmptySurveyBadge(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    tw: number
  ): void {
    const scale = tw / TILE_WIDTH;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.beginPath();
    ctx.arc(cx, cy, 4.2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 0.9 * scale;
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 ${Math.max(5, Math.round(4.8 * scale))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('∅', cx, cy + 0.3 * scale);
  }
}
