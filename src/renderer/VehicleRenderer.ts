import type { Camera, MapPlot, ResourceType, Vehicle } from '../engine/types';
import { TILE_HEIGHT, TILE_WIDTH, worldToScreen } from './utils';

const CARGO_COLORS: Partial<Record<ResourceType, string>> = {
  coal: '#27272a',
  ironOre: '#b45309',
  copper: '#ea580c',
  gold: '#fde047',
  oil: '#0f172a',
  uranium: '#84cc16',
  rareMetals: '#38bdf8',
  gravel: '#94a3b8',
  water: '#0ea5e9',
  steel: '#cbd5e1',
  fuel: '#f59e0b',
  chemicals: '#a855f7',
  electronics: '#22d3ee',
  semiconductors: '#6366f1',
  prefabs: '#ea580c',
  electricity: '#fde047',
  weapons: '#f43f5e',
  jewelry: '#f472b6',
};

export class VehicleRenderer {
  private tickCount = 0;

  renderVehicles(
    ctx: CanvasRenderingContext2D,
    vehicles: Vehicle[],
    camera: Camera,
    plotMap: Map<string, MapPlot>
  ): void {
    this.tickCount++;
    const tw = TILE_WIDTH * camera.zoom;
    const th = TILE_HEIGHT * camera.zoom;
    if (camera.zoom < 0.36) return;

    for (const vehicle of vehicles) {
      const route = vehicle.routePlotIds;
      if (!route || route.length < 2) continue;
      const seg = Math.max(0, Math.min(route.length - 2, vehicle.routeSegment));
      const src = plotMap.get(route[seg]);
      const dst = plotMap.get(route[seg + 1]);
      if (!src || !dst) continue;

      const t = Math.max(0, Math.min(1, vehicle.progress));
      const wx = src.gridX + (dst.gridX - src.gridX) * t;
      const wy = src.gridY + (dst.gridY - src.gridY) * t;

      const { screenX, screenY } = worldToScreen(wx, wy, tw, th, camera.x, camera.y);
      const srcS = worldToScreen(src.gridX, src.gridY, tw, th, camera.x, camera.y);
      const dstS = worldToScreen(dst.gridX, dst.gridY, tw, th, camera.x, camera.y);
      const angle = Math.atan2(dstS.screenY - srcS.screenY, dstS.screenX - srcS.screenX);

      ctx.save();
      ctx.translate(screenX, screenY);
      switch (vehicle.type) {
        case 'truck':
          this.drawTruck(ctx, camera.zoom, angle, vehicle.cargo);
          break;
        case 'fireTruck':
          this.drawFireTruck(ctx, camera.zoom, angle);
          break;
        case 'hazmatTruck':
          this.drawHazmatTruck(ctx, camera.zoom, angle);
          break;
        case 'ambulance':
          this.drawAmbulance(ctx, camera.zoom, angle);
          break;
        case 'policeCar':
          this.drawPoliceCar(ctx, camera.zoom, angle);
          break;
        case 'helicopter':
          this.drawHelicopter(ctx, camera.zoom, angle);
          break;
        case 'ship':
          this.drawShip(ctx, camera.zoom, angle, vehicle.cargo);
          break;
        case 'plane':
          this.drawPlane(ctx, camera.zoom, angle);
          break;
        default:
          this.drawBus(ctx, camera.zoom, angle);
          break;
      }
      ctx.restore();
    }
  }

  private drawTruck(
    ctx: CanvasRenderingContext2D,
    zoom: number,
    angle: number,
    cargo: ResourceType | null
  ): void {
    const s = zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 2.5 * s, 7 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-6 * s, -3 * s, 4 * s, 6 * s);
    ctx.fillStyle = cargo ? CARGO_COLORS[cargo] ?? '#f59e0b' : '#94a3b8';
    ctx.fillRect(-2 * s, -3 * s, 8 * s, 6 * s);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(-6 * s, -3 * s, 12 * s, 6 * s);
  }

  private drawFireTruck(ctx: CanvasRenderingContext2D, zoom: number, angle: number): void {
    const s = zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 2.5 * s, 8 * s, 3.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-7 * s, -3.2 * s, 14 * s, 6.4 * s);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-2 * s, -1.2 * s, 8 * s, 2.4 * s);
    const blinkBlue = Math.floor(this.tickCount / 6) % 2 === 0;
    ctx.fillStyle = blinkBlue ? '#38bdf8' : '#f87171';
    ctx.beginPath();
    ctx.arc(3 * s, 0, 2 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHazmatTruck(ctx: CanvasRenderingContext2D, zoom: number, angle: number): void {
    const s = zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 2.5 * s, 8 * s, 3.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-7 * s, -3.2 * s, 14 * s, 6.4 * s);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-3 * s, -2 * s, 4 * s, 4 * s);
    const pulse = Math.floor(this.tickCount / 6) % 2 === 0;
    ctx.fillStyle = pulse ? '#a3e635' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(4 * s, 0, 2 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawAmbulance(ctx: CanvasRenderingContext2D, zoom: number, angle: number): void {
    const s = zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 2.5 * s, 7.5 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-6.5 * s, -3 * s, 13 * s, 6 * s);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-3 * s, -0.7 * s, 5 * s, 1.4 * s);
    const blink = Math.floor(this.tickCount / 5) % 2 === 0;
    ctx.fillStyle = blink ? '#38bdf8' : '#ef4444';
    ctx.beginPath();
    ctx.arc(3.5 * s, 0, 1.7 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPoliceCar(ctx: CanvasRenderingContext2D, zoom: number, angle: number): void {
    const s = zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 2.2 * s, 6.5 * s, 2.8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(-5.5 * s, -2.8 * s, 11 * s, 5.6 * s);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-1.5 * s, -2.8 * s, 3.5 * s, 5.6 * s);
    const redFirst = Math.floor(this.tickCount / 5) % 2 === 0;
    ctx.fillStyle = redFirst ? '#ef4444' : '#38bdf8';
    ctx.fillRect(0, -2 * s, 1.4 * s, 2 * s);
    ctx.fillStyle = redFirst ? '#38bdf8' : '#ef4444';
    ctx.fillRect(0, 0, 1.4 * s, 2 * s);
  }

  private drawHelicopter(ctx: CanvasRenderingContext2D, zoom: number, angle: number): void {
    const s = zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 11 * s, 6 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, -11 * s);
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-6 * s, -2.5 * s, 9 * s, 5 * s);
    ctx.fillStyle = '#334155';
    ctx.fillRect(-10 * s, -0.8 * s, 4 * s, 1.6 * s);
    ctx.restore();

    // Wirnik
    const rot = this.tickCount * 0.45;
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.lineWidth = 1.2 * s;
    for (let i = 0; i < 2; i++) {
      const a = rot + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(a) * 8 * s, -Math.sin(a) * 5 * s);
      ctx.lineTo(Math.cos(a) * 8 * s, Math.sin(a) * 5 * s);
      ctx.stroke();
    }
  }

  private drawShip(
    ctx: CanvasRenderingContext2D,
    zoom: number,
    angle: number,
    cargo: ResourceType | null
  ): void {
    const s = zoom;
    ctx.rotate(angle);
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(-14 * s, -3 * s);
    ctx.lineTo(-9 * s, 0);
    ctx.lineTo(-14 * s, 3 * s);
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(10 * s, 0);
    ctx.lineTo(5 * s, -4 * s);
    ctx.lineTo(-9 * s, -4 * s);
    ctx.lineTo(-9 * s, 4 * s);
    ctx.lineTo(5 * s, 4 * s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = cargo ? CARGO_COLORS[cargo] ?? '#38bdf8' : '#0ea5e9';
    ctx.fillRect(-6 * s, -2.5 * s, 9 * s, 5 * s);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-8 * s, -2 * s, 2 * s, 4 * s);
  }

  private drawPlane(ctx: CanvasRenderingContext2D, zoom: number, angle: number): void {
    const s = zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 12 * s, 7 * s, 3 * s, angle, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, -10 * s);
    ctx.rotate(angle);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-7 * s, -1.6 * s, 14 * s, 3.2 * s);
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(1 * s, -9 * s);
    ctx.lineTo(4 * s, 0);
    ctx.lineTo(1 * s, 9 * s);
    ctx.lineTo(-2 * s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-7 * s, -3.5 * s, 2.5 * s, 7 * s);
  }

  private drawBus(ctx: CanvasRenderingContext2D, zoom: number, angle: number): void {
    const s = zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 2.5 * s, 8 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-7 * s, -3 * s, 14 * s, 6 * s);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-7 * s, -0.5 * s, 14 * s, 1.3 * s);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(-7 * s, -3 * s, 14 * s, 6 * s);
  }
}
