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
    const playerPrestigeMap = new Map<string, number>();
    for (const p of players) {
      playerColorMap.set(p.id, p.color);
      playerPrestigeMap.set(p.id, p.playerCard?.prestigeLevel ?? 0);
    }
    const viewerPlayer = players.find((p) => p.id === currentPlayerId);

    const gridLookup = new Map<string, MapPlot>();
    for (const p of plots) gridLookup.set(`${p.gridX}_${p.gridY}`, p);

    for (const plot of plots) {
      const { screenX, screenY } = worldToScreen(plot.gridX, plot.gridY, tw, th, ox, oy);
      const ownerColor = plot.ownerId ? playerColorMap.get(plot.ownerId) ?? '#f59e0b' : null;
      const ownerPrestige = plot.ownerId ? playerPrestigeMap.get(plot.ownerId) ?? 0 : 0;
      this.drawTile(
        ctx,
        plot,
        screenX,
        screenY,
        tw,
        th,
        ownerColor,
        supersample,
        heatmapMode,
        ownerPrestige
      );
    }

    for (const plot of plots) {
      const { screenX, screenY } = worldToScreen(plot.gridX, plot.gridY, tw, th, ox, oy);

      if (isRoadPlot(plot)) {
        const nPlot = gridLookup.get(`${plot.gridX}_${plot.gridY - 1}`);
        const ePlot = gridLookup.get(`${plot.gridX + 1}_${plot.gridY}`);
        const sPlot = gridLookup.get(`${plot.gridX}_${plot.gridY + 1}`);
        const wPlot = gridLookup.get(`${plot.gridX - 1}_${plot.gridY}`);
        this.drawSeamlessIsoRoad(
          ctx,
          plot,
          screenX,
          screenY,
          tw,
          th,
          nPlot,
          ePlot,
          sPlot,
          wPlot,
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
    heatmapMode: MapHeatmapMode,
    ownerPrestige = 0
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
      ctx.lineWidth = (ownerPrestige >= 1 ? 2.1 : 1.6) * supersample;
      ctx.stroke();

      if (ownerPrestige >= 1) {
        const inset = 0.86;
        const pTopY = cy - (th / 2) * inset;
        const pRightX = cx + (tw / 2) * inset;
        const pBottomY = cy + (th / 2) * inset;
        const pLeftX = cx - (tw / 2) * inset;
        ctx.beginPath();
        ctx.moveTo(cx, pTopY);
        ctx.lineTo(pRightX, cy);
        ctx.lineTo(cx, pBottomY);
        ctx.lineTo(pLeftX, cy);
        ctx.closePath();
        ctx.strokeStyle = ownerPrestige >= 2 ? 'rgba(226, 232, 240, 0.92)' : 'rgba(250, 204, 21, 0.88)';
        ctx.lineWidth = 1.25 * supersample;
        ctx.stroke();
        if (ownerPrestige >= 2) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
          ctx.lineWidth = 0.65 * supersample;
          ctx.stroke();
        }
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
   * Bezszwowe wielokąty izometryczne dla dróg lokalnych, autostrad i mostów z płynnymi najazdami:
   * krawędzie dopasowane 1:1 do wysokości i szerokości sąsiednich dróg eliminują uskoki i szczeliny.
   */
  private drawSeamlessIsoRoad(
    ctx: CanvasRenderingContext2D,
    plot: MapPlot,
    cx: number,
    cy: number,
    tw: number,
    th: number,
    nPlot: MapPlot | undefined,
    ePlot: MapPlot | undefined,
    sPlot: MapPlot | undefined,
    wPlot: MapPlot | undefined,
    scale: number
  ): void {
    const isBridge = plot.roadType === 'bridge';
    const isHighway = plot.roadType === 'highway';
    const hasN = isRoadPlot(nPlot);
    const hasE = isRoadPlot(ePlot);
    const hasS = isRoadPlot(sPlot);
    const hasW = isRoadPlot(wPlot);
    const anyArm = hasN || hasE || hasS || hasW;

    const neighborHighway =
      isBridge &&
      ((hasN && nPlot?.roadType === 'highway') ||
        (hasE && ePlot?.roadType === 'highway') ||
        (hasS && sPlot?.roadType === 'highway') ||
        (hasW && wPlot?.roadType === 'highway'));
    const neighborLocal =
      isBridge &&
      ((hasN && nPlot?.roadType === 'local') ||
        (hasE && ePlot?.roadType === 'local') ||
        (hasS && sPlot?.roadType === 'local') ||
        (hasW && wPlot?.roadType === 'local'));

    const bridgeLift = -3.0 * scale;
    const deckCy = isBridge ? cy + bridgeLift : cy;
    const baseRoadRatio = isHighway ? 0.24 : isBridge && neighborHighway && !neighborLocal ? 0.22 : 0.16;
    const curbExtra = isHighway ? 0.045 : isBridge ? 0.036 : 0.032;

    const armTipLift = (neighbor: MapPlot | undefined): number => {
      if (!isBridge) return 0;
      return neighbor && isRoadPlot(neighbor) && neighbor.roadType === 'bridge' ? bridgeLift : 0;
    };
    const armTipRoadRatio = (neighbor: MapPlot | undefined): number => {
      if (!neighbor || !isRoadPlot(neighbor)) return baseRoadRatio;
      if (neighbor.roadType === 'highway') return 0.24;
      if (neighbor.roadType === 'local') return 0.16;
      return baseRoadRatio;
    };
    const armTipCurbRatio = (neighbor: MapPlot | undefined): number => {
      if (!neighbor || !isRoadPlot(neighbor)) return baseRoadRatio + curbExtra;
      if (neighbor.roadType === 'highway') return 0.24 + 0.045;
      if (neighbor.roadType === 'local') return 0.16 + 0.032;
      return baseRoadRatio + curbExtra;
    };

    const nsEdgeX = tw * 0.5;
    const nsEdgeY = th * 0.5;
    const ewEdgeX = tw * 0.5;
    const ewEdgeY = -th * 0.5;

    const arms: {
      active: boolean;
      dx: number;
      dy: number;
      px: number;
      py: number;
      neighbor: MapPlot | undefined;
    }[] = [
      { active: hasN || !anyArm, dx: tw * 0.25, dy: -th * 0.25, px: nsEdgeX, py: nsEdgeY, neighbor: nPlot },
      { active: hasS || !anyArm, dx: -tw * 0.25, dy: th * 0.25, px: nsEdgeX, py: nsEdgeY, neighbor: sPlot },
      { active: hasE, dx: tw * 0.25, dy: th * 0.25, px: ewEdgeX, py: ewEdgeY, neighbor: ePlot },
      { active: hasW, dx: -tw * 0.25, dy: -th * 0.25, px: ewEdgeX, py: ewEdgeY, neighbor: wPlot },
    ];

    if (isBridge) {
      ctx.save();
      // Miękki cień pomostu na wodzie + odbicia fali wokół betonowych filarów
      ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 4.0 * scale, tw * 0.24, th * 0.19, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(186, 230, 253, 0.38)';
      ctx.beginPath();
      ctx.ellipse(cx - 5.2 * scale, cy + 4.8 * scale, 3.6 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 5.2 * scale, cy + 4.8 * scale, 3.6 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Betonowe filary schodzące do lustra wody (lewa ściana jasna, prawa zacieniona)
      const pierTop = deckCy + 0.8 * scale;
      const pierH = 7.4 * scale;
      ctx.fillStyle = '#64748b';
      ctx.fillRect(cx - 7.0 * scale, pierTop, 1.8 * scale, pierH);
      ctx.fillRect(cx + 3.8 * scale, pierTop, 1.8 * scale, pierH);
      ctx.fillStyle = '#475569';
      ctx.fillRect(cx - 5.2 * scale, pierTop, 1.6 * scale, pierH);
      ctx.fillRect(cx + 5.6 * scale, pierTop, 1.6 * scale, pierH);

      // Betonowe ścianki przyczółków na zjazdach z mostu na ląd
      for (const arm of arms) {
        if (!arm.active) continue;
        const tipLift = armTipLift(arm.neighbor);
        if (tipLift === bridgeLift) continue;
        const tipCy = cy + tipLift;
        const rTip = armTipCurbRatio(arm.neighbor);
        const rCenter = baseRoadRatio + curbExtra;
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(cx + arm.px * rCenter, deckCy + arm.py * rCenter);
        ctx.lineTo(cx + arm.dx + arm.px * rTip, tipCy + arm.dy + arm.py * rTip);
        ctx.lineTo(cx + arm.dx + arm.px * rTip, tipCy + arm.dy + arm.py * rTip + 2.2 * scale);
        ctx.lineTo(cx + arm.px * rCenter, deckCy + arm.py * rCenter + 3.0 * scale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(cx - arm.px * rCenter, deckCy - arm.py * rCenter);
        ctx.lineTo(cx + arm.dx - arm.px * rTip, tipCy + arm.dy - arm.py * rTip);
        ctx.lineTo(cx + arm.dx - arm.px * rTip, tipCy + arm.dy - arm.py * rTip + 2.2 * scale);
        ctx.lineTo(cx - arm.px * rCenter, deckCy - arm.py * rCenter + 3.0 * scale);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    const drawRibbon = (
      centerRatio: number,
      getTipRatio: (n: MapPlot | undefined) => number,
      color: string
    ) => {
      ctx.fillStyle = color;

      for (const arm of arms) {
        if (!arm.active) continue;
        const tipCy = cy + armTipLift(arm.neighbor);
        const tipRatio = getTipRatio(arm.neighbor);
        ctx.beginPath();
        ctx.moveTo(cx - arm.px * centerRatio, deckCy - arm.py * centerRatio);
        ctx.lineTo(cx + arm.px * centerRatio, deckCy + arm.py * centerRatio);
        ctx.lineTo(
          cx + arm.dx + arm.px * tipRatio,
          tipCy + arm.dy + arm.py * tipRatio
        );
        ctx.lineTo(
          cx + arm.dx - arm.px * tipRatio,
          tipCy + arm.dy - arm.py * tipRatio
        );
        ctx.closePath();
        ctx.fill();
      }

      // Romb środkowy łączący bezszwowo wszystkie aktywne ramiona
      ctx.beginPath();
      ctx.moveTo(cx, deckCy - th * centerRatio);
      ctx.lineTo(cx + tw * centerRatio, deckCy);
      ctx.lineTo(cx, deckCy + th * centerRatio);
      ctx.lineTo(cx - tw * centerRatio, deckCy);
      ctx.closePath();
      ctx.fill();
    };

    // 1. Krawężnik / stalowo-betonowa balustrada mostu
    drawRibbon(
      baseRoadRatio + curbExtra,
      armTipCurbRatio,
      isBridge ? '#94a3b8' : isHighway ? '#94a3b8' : '#141923'
    );

    // 2. Jednolita nawierzchnia asfaltowa zgrana kolorem z sąsiednimi drogami
    const asphaltColor = isHighway
      ? '#1e293b'
      : isBridge && neighborHighway && !neighborLocal
        ? '#1e293b'
        : '#2d3545';
    drawRibbon(baseRoadRatio, armTipRoadRatio, asphaltColor);

    // 3. Zewnętrzne stalowe barierki ochronne mostu ze słupkami (zostawiając otwarty przejazd na krawędzi)
    if (isBridge) {
      const rGuard = baseRoadRatio + curbExtra * 0.72;
      ctx.save();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1.1, 1.35 * scale);
      for (const arm of arms) {
        if (!arm.active) continue;
        const tipCy = cy + armTipLift(arm.neighbor);
        const rTipGuard = armTipRoadRatio(arm.neighbor) + curbExtra * 0.65;
        ctx.beginPath();
        ctx.moveTo(cx + arm.px * rGuard, deckCy + arm.py * rGuard - 1.2 * scale);
        ctx.lineTo(
          cx + arm.dx + arm.px * rTipGuard,
          tipCy + arm.dy + arm.py * rTipGuard - 0.8 * scale
        );
        ctx.moveTo(cx - arm.px * rGuard, deckCy - arm.py * rGuard - 1.2 * scale);
        ctx.lineTo(
          cx + arm.dx - arm.px * rTipGuard,
          tipCy + arm.dy - arm.py * rTipGuard - 0.8 * scale
        );
        ctx.stroke();

        // Równe słupki barierki pośrodku przęsła
        ctx.fillStyle = '#e2e8f0';
        const midX1 = (cx + arm.px * rGuard + cx + arm.dx + arm.px * rTipGuard) * 0.5;
        const midY1 = (deckCy + arm.py * rGuard + tipCy + arm.dy + arm.py * rTipGuard) * 0.5;
        const midX2 = (cx - arm.px * rGuard + cx + arm.dx - arm.px * rTipGuard) * 0.5;
        const midY2 = (deckCy - arm.py * rGuard + tipCy + arm.dy - arm.py * rTipGuard) * 0.5;
        ctx.fillRect(midX1 - 0.7 * scale, midY1 - 2.0 * scale, 1.4 * scale, 2.0 * scale);
        ctx.fillRect(midX2 - 0.7 * scale, midY2 - 2.0 * scale, 1.4 * scale, 2.0 * scale);
      }
      ctx.restore();
    }

    // 4. Przerywane pasy ruchu identyczne z sąsiednimi drogami
    const useAmberStripe = isHighway || (isBridge && neighborHighway && !neighborLocal);
    ctx.strokeStyle = useAmberStripe ? '#fbbf24' : 'rgba(226, 232, 240, 0.6)';
    ctx.lineWidth = Math.max(1, (useAmberStripe ? 1.8 : 1.1) * scale);
    ctx.setLineDash(useAmberStripe ? [4 * scale, 2.5 * scale] : [3 * scale, 3 * scale]);

    for (const arm of arms) {
      if (!arm.active) continue;
      const tipCy = cy + armTipLift(arm.neighbor);
      ctx.beginPath();
      ctx.moveTo(cx, deckCy);
      ctx.lineTo(cx + arm.dx, tipCy + arm.dy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 5. Miniaturowa bramka myta lub czerwony szlaban blokady tranzytu
    const hasBlockade = plot.roadBlocked || (plot.blockedPlayers?.length ?? 0) > 0;
    if (hasBlockade) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.6 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 7 * scale, deckCy - 3 * scale);
      ctx.lineTo(cx + 7 * scale, deckCy + 3 * scale);
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(cx, deckCy - 5 * scale, 3.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    } else if (plot.tollRate !== 'free') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - 5 * scale, deckCy - 6 * scale, 10 * scale, 3 * scale);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx - 5 * scale, deckCy - 6 * scale, 10 * scale, 1.1 * scale);
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
