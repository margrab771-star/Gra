import type { Building, BuildingCategory } from '../engine/types';
import { darkenColor, lightenColor } from './utils';

interface BuildingPalette {
  primary: string;
  secondary: string;
  accent: string;
}

const CATEGORY_PALETTES: Record<BuildingCategory, BuildingPalette> = {
  mining: { primary: '#8c6724', secondary: '#6b4d18', accent: '#f59e0b' },
  processing: { primary: '#56677a', secondary: '#3f4d5e', accent: '#fb7185' },
  energy: { primary: '#3b6e52', secondary: '#29503b', accent: '#facc15' },
  waste: { primary: '#4d7c0f', secondary: '#365314', accent: '#a3e635' },
  logistics: { primary: '#475569', secondary: '#334155', accent: '#38bdf8' },
  real_estate: { primary: '#2d5d8c', secondary: '#1e4268', accent: '#7dd3fc' },
  attractions: { primary: '#be185d', secondary: '#831843', accent: '#f472b6' },
  finance: { primary: '#1e3a5f', secondary: '#142945', accent: '#fbbf24' },
  education: { primary: '#948269', secondary: '#756651', accent: '#fef08a' },
  safety: { primary: '#b91c1c', secondary: '#7f1d1d', accent: '#f87171' },
  influence: { primary: '#4c346b', secondary: '#35224d', accent: '#c084fc' },
  military: { primary: '#3d4c3e', secondary: '#273328', accent: '#f43f5e' },
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export class BuildingRenderer {
  private frameCount = 0;

  tick(): void {
    this.frameCount++;
  }

  renderBuilding(
    ctx: CanvasRenderingContext2D,
    building: Building,
    screenX: number,
    screenY: number,
    tileW: number,
    tileH: number,
    ownerColor: string,
    isSelectedOverride?: boolean
  ): void {
    const scale = tileW / 64;
    const palette = CATEGORY_PALETTES[building.category] ?? CATEGORY_PALETTES.processing;
    const isSel = isSelectedOverride ?? building.selected;

    ctx.save();
    ctx.translate(screenX, screenY);

    if (isSel) {
      this.drawSelectionGlow(ctx, tileW, tileH);
    }

    if (building.destroyedRuins) {
      this.drawRuinedBuilding(ctx, scale);
      this.drawOwnerAndLevelBadge(ctx, scale, 0, ownerColor);
      ctx.restore();
      return;
    }

    const visualTier =
      building.visualTier ??
      Math.min(3, building.techTree.filter((t) => t.status === 'done').length);

    if ((building.upgradeFlashTicks ?? 0) > 0) {
      const flashAlpha = 0.28 + Math.sin(this.frameCount * 0.25) * 0.16;
      ctx.fillStyle = `rgba(250, 204, 21, ${flashAlpha})`;
      ctx.beginPath();
      ctx.ellipse(0, -4 * scale, tileW * 0.38, tileH * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    switch (building.type) {
      case 'nuclearPowerPlant':
        this.drawNuclearPlant(ctx, scale, building.level + visualTier);
        break;
      case 'hydroPowerPlant':
        this.drawHydroPlant(ctx, scale, palette, building.level + visualTier);
        break;
      case 'renewableFarm':
        this.drawRenewableFarm(ctx, scale, building.level + visualTier);
        break;
      case 'coalPowerPlant':
        this.drawCoalPlant(ctx, scale, palette, building.level + visualTier);
        break;
      case 'windFarm':
        this.drawWindFarm(ctx, scale);
        break;
      case 'solarFarm':
        this.drawSolarFarm(ctx, scale);
        break;
      case 'gasPowerPlant':
        this.drawGasPlant(ctx, scale, palette, building.level + visualTier);
        break;
      case 'geothermalPlant':
        this.drawGeothermalPlant(ctx, scale);
        break;
      case 'fusionReactor':
        this.drawFusionReactor(ctx, scale);
        break;
      case 'sewagePlant':
        this.drawSewagePlant(ctx, scale);
        break;
      case 'wasteIncinerator':
        this.drawWasteIncinerator(ctx, scale);
        break;
      case 'recyclingPlant':
        this.drawRecyclingPlant(ctx, scale);
        break;
      case 'uraniumEnrichment':
        this.drawUraniumEnrichment(ctx, scale);
        break;
      case 'coldStorage':
        this.drawColdStorage(ctx, scale, building.level + visualTier);
        break;
      case 'diamondMine':
      case 'lithiumMine':
        this.drawSpecializedMine(ctx, scale, building.type === 'diamondMine' ? '#67e8f9' : '#c084fc', palette, building.level + visualTier);
        break;
      case 'batteryFactory':
        this.drawBatteryFactory(ctx, scale, building.level + visualTier);
        break;
      case 'spaceCenter':
        this.drawSpaceCenter(ctx, scale);
        break;
      case 'warehouse':
        this.drawWarehouse(ctx, scale, palette, building.level + visualTier);
        break;
      case 'corporateHQ':
        this.drawCorporateHQ(ctx, scale, visualTier, ownerColor);
        break;
      case 'officeTower':
      case 'investmentBank':
        this.drawGlassTowerWithHelipad(
          ctx,
          scale,
          palette,
          building.level + visualTier,
          building.type === 'investmentBank'
        );
        break;
      case 'hotel':
      case 'resort':
      case 'shoppingMall':
        this.drawRealEstateComplex(
          ctx,
          scale,
          palette,
          building.level + visualTier,
          building.type === 'resort'
        );
        break;
      case 'casino':
        this.drawCasino(ctx, scale, visualTier);
        break;
      case 'churchFoundation':
        this.drawChurchFoundation(ctx, scale, palette);
        break;
      case 'oilWell':
        this.drawOilDerrick(ctx, scale);
        break;
      case 'oilRefinery':
      case 'chemicalPlant':
        this.drawRefinery(ctx, scale, palette, building.level + visualTier);
        break;
      case 'waterPlant':
        this.drawWaterPlant(ctx, scale);
        break;
      case 'cargoPort':
        this.drawCargoPort(ctx, scale, palette);
        break;
      case 'cargoAirport':
        this.drawCargoAirport(ctx, scale, palette);
        break;
      case 'hospital':
        this.drawHospital(ctx, scale, building.level + visualTier);
        break;
      case 'fireStation':
        this.drawFireStation(ctx, scale, building.level + visualTier);
        break;
      case 'hazmatBase':
        this.drawHazmatBase(ctx, scale, building.level + visualTier);
        break;
      case 'policeStation':
        this.drawPoliceStation(ctx, scale, building.level + visualTier);
        break;
      case 'militaryBase':
        this.drawMilitaryBase(ctx, scale, palette, building.level + visualTier);
        break;
      case 'amusementPark':
        this.drawAmusementPark(ctx, scale);
        break;
      case 'culturalCenter':
        this.drawCulturalCenter(ctx, scale, palette);
        break;
      case 'marinaPromenade':
        this.drawMarinaPromenade(ctx, scale, palette);
        break;
      case 'jewelryWorkshop':
      case 'jewelryLuxury':
        this.drawJewelryWorkshop(ctx, scale, palette, building.level + visualTier + (building.type === 'jewelryLuxury' ? 2 : 0));
        break;
      default:
        if (building.category === 'mining') {
          this.drawMiningBuilding(ctx, scale, palette, building.level + visualTier);
        } else if (building.category === 'processing') {
          this.drawProcessingBuilding(ctx, scale, palette, building.level + visualTier);
        } else if (building.category === 'education') {
          this.drawEducationBuilding(ctx, scale, palette, building.level + visualTier);
        } else if (building.category === 'influence') {
          this.drawInfluenceBuilding(ctx, scale, palette, building.level + visualTier);
        } else if (building.category === 'safety') {
          this.drawFireStation(ctx, scale, building.level + visualTier);
        } else if (building.category === 'attractions') {
          this.drawCulturalCenter(ctx, scale, palette);
        } else if (building.category === 'waste') {
          this.drawRecyclingPlant(ctx, scale);
        } else {
          this.drawMilitaryBuilding(ctx, scale, palette, building.level + visualTier);
        }
        break;
    }

    if (visualTier >= 1) {
      this.drawVisualTierEnhancements(ctx, scale, visualTier, building, palette);
    }

    // Efekt wizualny trwającego ulepszenia / rozbudowy modułu
    if (building.status.upgradeActive) {
      this.drawUpgradeScaffolding(ctx, scale);
    }

    // Ciemniejszy dym przy wysokim zniszczeniu budynku
    if (building.damagePercent >= 55) {
      this.drawDamageSmoke(ctx, scale);
    }

    // Aktywne zagrożenie: pożar, wyciek HAZMAT lub alarm napadu
    if (building.activeHazard?.kind === 'fire' || building.status.onFire) {
      this.drawFireHazard(ctx, scale);
    } else if (building.activeHazard?.kind === 'robbery' || building.status.robberyActive) {
      this.drawRobberyAlert(ctx, scale);
    } else if (building.activeHazard || building.status.hazmatIncident) {
      this.drawHazmatAura(ctx, scale);
    }

    if (building.activeHazard && (building.activeHazard.destructionProgress ?? 0) > 2) {
      this.drawHazardDestructionBar(ctx, scale, building.activeHazard.destructionProgress ?? 0);
    }

    this.drawOwnerAndLevelBadge(ctx, scale, building.level, ownerColor);
    this.drawStatusIcons(ctx, scale, building);

    ctx.restore();
  }

  private drawSelectionGlow(ctx: CanvasRenderingContext2D, tileW: number, tileH: number): void {
    const pulse = Math.sin(this.frameCount * 0.08) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(245, 158, 11, ${pulse})`;
    ctx.lineWidth = 2.4;
    const hw = tileW * 0.44;
    const hh = tileH * 0.44;
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.lineTo(hw, 0);
    ctx.lineTo(0, hh);
    ctx.lineTo(-hw, 0);
    ctx.closePath();
    ctx.stroke();
  }

  private drawUpgradeScaffolding(ctx: CanvasRenderingContext2D, scale: number): void {
    const pulse = 0.55 + Math.sin(this.frameCount * 0.14) * 0.35;
    ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
    ctx.lineWidth = 1.4 * scale;
    ctx.setLineDash([2.5 * scale, 2 * scale]);
    ctx.strokeRect(-14 * scale, -26 * scale, 28 * scale, 26 * scale);
    ctx.setLineDash([]);
  }

  private drawDamageSmoke(ctx: CanvasRenderingContext2D, scale: number): void {
    for (let i = 0; i < 2; i++) {
      const age = ((this.frameCount * 0.6 + i * 24) % 48) / 48;
      const sy = -18 * scale - age * 14 * scale;
      const sx = Math.sin(this.frameCount * 0.05 + i) * 3 * scale;
      ctx.fillStyle = `rgba(60, 60, 70, ${0.45 * (1 - age)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, (2 + age * 3) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMiningBuilding(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette, level: number): void {
    const h = (12 + level * 1.8) * scale;
    this.drawIsoBox(ctx, -2 * scale, 1 * scale, 19 * scale, 15 * scale, h, pal.primary, pal.secondary);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(4 * scale, 0);
    ctx.lineTo(6 * scale, -h - 11 * scale);
    ctx.lineTo(9 * scale, 0);
    ctx.stroke();
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(6 * scale, -h - 11 * scale, 2.2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawOilDerrick(ctx: CanvasRenderingContext2D, scale: number): void {
    this.drawIsoBox(ctx, 0, 2 * scale, 16 * scale, 12 * scale, 6 * scale, '#334155', '#1e293b');
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.moveTo(-4 * scale, -4 * scale);
    ctx.lineTo(0, -24 * scale);
    ctx.lineTo(4 * scale, -4 * scale);
    ctx.stroke();
    const rock = Math.sin(this.frameCount * 0.09) * 3 * scale;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.6 * scale;
    ctx.beginPath();
    ctx.moveTo(-8 * scale, -10 * scale + rock);
    ctx.lineTo(8 * scale, -12 * scale - rock);
    ctx.stroke();
  }

  private drawWaterPlant(ctx: CanvasRenderingContext2D, scale: number): void {
    this.drawIsoBox(ctx, -4 * scale, 2 * scale, 16 * scale, 14 * scale, 10 * scale, '#38bdf8', '#0284c7');
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.ellipse(6 * scale, -2 * scale, 6 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 0.8 * scale;
    ctx.stroke();
  }

  private drawProcessingBuilding(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette, level: number): void {
    const h = (16 + level * 2) * scale;
    this.drawIsoBox(ctx, 0, 1 * scale, 24 * scale, 18 * scale, h, pal.primary, pal.secondary);
    // Przemysłowe świetliki dachowe
    ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.fillRect(-8 * scale, -h + 3 * scale, 6 * scale, 2.5 * scale);
    const sx = 7 * scale;
    const sh = h + 13 * scale;
    ctx.fillStyle = '#475569';
    ctx.fillRect(sx - 2 * scale, -sh, 4 * scale, sh - h + 3 * scale);
    this.drawSmoke(ctx, sx, -sh, scale);
  }

  private drawRefinery(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette, level: number): void {
    const h = (14 + level * 1.8) * scale;
    this.drawIsoBox(ctx, -4 * scale, 2 * scale, 18 * scale, 14 * scale, h, pal.primary, pal.secondary);
    for (const dx of [6, 12]) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(dx * scale - 3 * scale, -12 * scale, 6 * scale, 12 * scale);
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.ellipse(dx * scale, -12 * scale, 3 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    this.drawSmoke(ctx, -4 * scale, -h - 6 * scale, scale * 0.8);
  }

  private drawSpaceCenter(ctx: CanvasRenderingContext2D, scale: number): void {
    this.drawIsoBox(ctx, 0, 2 * scale, 28 * scale, 22 * scale, 8 * scale, '#1e293b', '#0f172a');
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-9 * scale, -34 * scale, 4 * scale, 26 * scale);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(2 * scale, -38 * scale);
    ctx.lineTo(5 * scale, -28 * scale);
    ctx.lineTo(5 * scale, -10 * scale);
    ctx.lineTo(-1 * scale, -10 * scale);
    ctx.lineTo(-1 * scale, -28 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-1 * scale, -12 * scale, 6 * scale, 2.5 * scale);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.arc(-9 * scale, -12 * scale, 4 * scale, Math.PI, Math.PI * 1.8);
    ctx.stroke();
  }

  private drawNuclearPlant(ctx: CanvasRenderingContext2D, scale: number, level: number): void {
    const h = (19 + level * 1.8) * scale;
    for (const tx of [-6, 7]) {
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo((tx - 6) * scale, 0);
      ctx.quadraticCurveTo((tx - 3.5) * scale, -h * 0.5, (tx - 4.5) * scale, -h);
      ctx.lineTo((tx + 4.5) * scale, -h);
      ctx.quadraticCurveTo((tx + 3.5) * scale, -h * 0.5, (tx + 6) * scale, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 0.7;
      ctx.stroke();
      this.drawSteam(ctx, tx * scale, -h, scale * 0.85);
    }
    this.drawIsoBox(ctx, -10 * scale, 5 * scale, 12 * scale, 10 * scale, 9 * scale, '#475569', '#334155');
  }

  private drawHydroPlant(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette, level: number): void {
    const h = (13 + level * 1.4) * scale;
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(-16 * scale, 2 * scale);
    ctx.lineTo(-12 * scale, -h);
    ctx.lineTo(12 * scale, -h);
    ctx.lineTo(16 * scale, 2 * scale);
    ctx.closePath();
    ctx.fill();
    this.drawIsoBox(ctx, 0, 3 * scale, 10 * scale, 8 * scale, 7 * scale, pal.primary, pal.secondary);
  }

  private drawRenewableFarm(ctx: CanvasRenderingContext2D, scale: number, level: number): void {
    for (let i = 0; i < 2; i++) {
      const px = (-8 + i * 10) * scale;
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(px - 4 * scale, -4 * scale, 8 * scale, 5 * scale);
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px - 4 * scale, -4 * scale, 8 * scale, 5 * scale);
    }
    const h = (24 + level * 1.5) * scale;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(6 * scale - 1 * scale, -h, 2 * scale, h);
    const angle = this.frameCount * 0.06;
    ctx.save();
    ctx.translate(6 * scale, -h);
    ctx.rotate(angle);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.4 * scale;
    for (let b = 0; b < 3; b++) {
      const a = (b * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 11 * scale, Math.sin(a) * 11 * scale);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCoalPlant(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette, level: number): void {
    const h = (15 + level * 1.8) * scale;
    this.drawIsoBox(ctx, 0, 1 * scale, 22 * scale, 16 * scale, h, pal.primary, pal.secondary);
    for (const sx of [-5, 5]) {
      const stackH = h + 12 * scale;
      ctx.fillStyle = '#52525b';
      ctx.fillRect((sx - 1.5) * scale, -stackH, 3 * scale, stackH - h + 3 * scale);
      this.drawSmoke(ctx, sx * scale, -stackH, scale * 0.8);
    }
  }

  private drawWarehouse(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette, level: number): void {
    const h = (10 + level * 1.4) * scale;
    this.drawIsoBox(ctx, 0, 1 * scale, 24 * scale, 20 * scale, h, pal.primary, pal.secondary);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(-8 * scale, -h + 2 * scale, 16 * scale, 2 * scale);
  }

  private drawCorporateHQ(
    ctx: CanvasRenderingContext2D,
    scale: number,
    visualTier: number,
    ownerColor: string
  ): void {
    const h = (14 + visualTier * 8) * scale;
    const w = (18 + visualTier * 2) * scale;
    this.drawIsoBox(ctx, 0, 1 * scale, w, 15 * scale, h, '#1e3a5f', '#0f2342');
    // Przeszklone piętra
    const bands = 2 + visualTier * 2;
    for (let i = 1; i <= bands; i++) {
      ctx.fillStyle = 'rgba(125, 211, 252, 0.48)';
      ctx.fillRect(-w * 0.36, -i * 4 * scale, w * 0.72, 1.8 * scale);
    }
    // Złoty monogram / korona HQ na wyższych etapach
    if (visualTier >= 2) {
      const roofY = -h - 3 * scale;
      ctx.fillStyle = ownerColor;
      ctx.fillRect(-5 * scale, roofY - 3 * scale, 10 * scale, 2.2 * scale);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(0, roofY - 3 * scale);
      ctx.lineTo(0, roofY - 12 * scale);
      ctx.stroke();
    }
  }

  private drawCasino(ctx: CanvasRenderingContext2D, scale: number, visualTier: number): void {
    const h = (12 + visualTier * 2.5) * scale;
    this.drawIsoBox(ctx, 0, 2 * scale, 24 * scale, 18 * scale, h, '#6b21a8', '#4c1d95');
    // Neonowa kopuła hazardowa
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, -h, 7 * scale, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    // Migające światła neonowe
    const blink = Math.floor(this.frameCount / 8) % 2 === 0;
    ctx.fillStyle = blink ? '#f472b6' : '#38bdf8';
    ctx.fillRect(-9 * scale, -h + 2 * scale, 18 * scale, 2 * scale);
  }

  private drawPoliceStation(ctx: CanvasRenderingContext2D, scale: number, level: number): void {
    const h = (11 + level * 1.4) * scale;
    this.drawIsoBox(ctx, -1 * scale, 1 * scale, 21 * scale, 16 * scale, h, '#1e3a8a', '#172554');
    // Biały pas i niebieski dach
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-9 * scale, -h + 3 * scale, 18 * scale, 2.2 * scale);
    // Antena i kogut policyjny
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(6 * scale, -h - 8 * scale, 2.5 * scale, 8 * scale);
    const blueTurn = Math.floor(this.frameCount / 8) % 2 === 0;
    ctx.fillStyle = blueTurn ? '#38bdf8' : '#ef4444';
    ctx.beginPath();
    ctx.arc(7.2 * scale, -h - 9 * scale, 2.1 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMilitaryBase(
    ctx: CanvasRenderingContext2D,
    scale: number,
    pal: BuildingPalette,
    level: number
  ): void {
    const h = (12 + level * 1.6) * scale;
    this.drawIsoBox(ctx, -2 * scale, 2 * scale, 24 * scale, 18 * scale, h, '#3f4d36', '#252f1e');
    // Wieżyczka radarowa / bunkier
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-9 * scale, -h - 7 * scale, 6 * scale, 7 * scale);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.3 * scale;
    const sweep = Math.sin(this.frameCount * 0.08) * 3 * scale;
    ctx.beginPath();
    ctx.arc(7 * scale, -h - 4 * scale, 4.5 * scale, Math.PI, Math.PI * 1.85);
    ctx.lineTo(7 * scale + sweep, -h - 7 * scale);
    ctx.stroke();
  }

  private drawVisualTierEnhancements(
    ctx: CanvasRenderingContext2D,
    scale: number,
    visualTier: number,
    building: Building,
    pal: BuildingPalette
  ): void {
    // Tier 1+: boczny zbiornik / moduł solarny / dodatkowe skrzydło
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-13 * scale, -3 * scale, 4 * scale, 3 * scale);
    if (visualTier >= 2) {
      // Tier 2+: antena telemetryczna i neonowy akcent
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(-10 * scale, -14 * scale);
      ctx.lineTo(-10 * scale, -27 * scale);
      ctx.stroke();
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(-10 * scale, -27 * scale, 1.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    const hasHeli =
      building.techTree.some((t) => t.status === 'done' && t.effects.helicopterDispatch) ||
      visualTier >= 3;
    if (hasHeli && (building.category === 'safety' || building.type === 'militaryBase')) {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(-6 * scale, -22 * scale, 4.5 * scale, 2.2 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 0.7 * scale;
      ctx.stroke();
    }
    if (visualTier >= 4) {
      // Poziom EKSTRA / APEX (Tier 4): złoto-fioletowa korona mocy nad budynkiem
      const aura = 0.55 + Math.sin(this.frameCount * 0.12) * 0.25;
      ctx.strokeStyle = `rgba(250, 204, 21, ${aura})`;
      ctx.lineWidth = 1.6 * scale;
      ctx.beginPath();
      ctx.ellipse(0, 1 * scale, 20 * scale, 10 * scale, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.font = `700 ${Math.max(7, Math.round(7 * scale))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', -13 * scale, -18 * scale);
    }
  }

  private drawRobberyAlert(ctx: CanvasRenderingContext2D, scale: number): void {
    const flash = Math.floor(this.frameCount / 7) % 2 === 0;
    ctx.strokeStyle = flash ? 'rgba(239, 68, 68, 0.85)' : 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 2.2 * scale;
    ctx.beginPath();
    ctx.ellipse(0, -6 * scale, 17 * scale, 9 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawGlassTowerWithHelipad(
    ctx: CanvasRenderingContext2D,
    scale: number,
    pal: BuildingPalette,
    level: number,
    isBank: boolean
  ): void {
    const floors = 4 + Math.min(5, level);
    const h = floors * 4.5 * scale;
    const w = 18 * scale;
    const d = 14 * scale;

    this.drawIsoBox(ctx, 0, 1 * scale, w, d, h, pal.primary, pal.secondary);

    for (let f = 1; f < floors; f++) {
      const fy = -f * 4.5 * scale;
      ctx.fillStyle = isBank ? 'rgba(251, 191, 36, 0.35)' : 'rgba(125, 211, 252, 0.45)';
      ctx.fillRect(-w * 0.4, fy, w * 0.32, 2.2 * scale);
      ctx.fillRect(w * 0.08, fy, w * 0.32, 2.2 * scale);
    }

    const roofY = -h - d / 4 + 3.5 * scale;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(0, roofY, 5.5 * scale, 2.8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isBank ? '#fbbf24' : '#38bdf8';
    ctx.lineWidth = 0.8 * scale;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 ${Math.max(5, Math.round(4.5 * scale))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', 0, roofY + 0.5 * scale);
  }

  private drawRealEstateComplex(
    ctx: CanvasRenderingContext2D,
    scale: number,
    pal: BuildingPalette,
    level: number,
    isResort: boolean
  ): void {
    const h = (14 + level * 2) * scale;
    this.drawIsoBox(ctx, 0, 1 * scale, 22 * scale, 16 * scale, h, pal.primary, pal.secondary);
    if (isResort) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(-6 * scale, 5 * scale, 5 * scale, 2.4 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = pal.accent;
    ctx.fillRect(-7 * scale, -h + 3 * scale, 14 * scale, 2.5 * scale);
  }

  private drawChurchFoundation(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette): void {
    this.drawIsoBox(ctx, 0, 1 * scale, 18 * scale, 14 * scale, 14 * scale, '#cbd5e1', '#94a3b8');
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.moveTo(-3 * scale, -14 * scale);
    ctx.lineTo(0, -30 * scale);
    ctx.lineTo(3 * scale, -14 * scale);
    ctx.closePath();
    ctx.fill();
  }

  private drawEducationBuilding(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette, level: number): void {
    const h = (12 + level * 1.8) * scale;
    this.drawIsoBox(ctx, 0, 1 * scale, 22 * scale, 16 * scale, h, pal.primary, pal.secondary);
    ctx.fillStyle = lightenColor(pal.primary, 0.15);
    ctx.beginPath();
    ctx.moveTo(-9 * scale, -h);
    ctx.lineTo(0, -h - 6 * scale);
    ctx.lineTo(9 * scale, -h);
    ctx.closePath();
    ctx.fill();
  }

  private drawInfluenceBuilding(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette, level: number): void {
    const h = (16 + level * 1.8) * scale;
    this.drawIsoBox(ctx, 0, 1 * scale, 20 * scale, 16 * scale, h, pal.primary, pal.secondary);
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(0, -h - 3 * scale, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMilitaryBuilding(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette, level: number): void {
    const h = (13 + level * 1.8) * scale;
    this.drawIsoBox(ctx, 0, 1 * scale, 22 * scale, 18 * scale, h, pal.primary, pal.secondary);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(7 * scale, -h - 7 * scale, 3 * scale, 7 * scale);
  }

  private drawCargoPort(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette): void {
    this.drawIsoBox(ctx, -2 * scale, 2 * scale, 26 * scale, 18 * scale, 6 * scale, pal.primary, pal.secondary);
    // Kontenery portowe
    this.drawIsoBox(ctx, -6 * scale, -4 * scale, 7 * scale, 5 * scale, 4 * scale, '#ef4444', '#991b1b');
    this.drawIsoBox(ctx, 1 * scale, -4 * scale, 7 * scale, 5 * scale, 4 * scale, '#38bdf8', '#0284c7');
    // Suwnica portowa
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.6 * scale;
    ctx.beginPath();
    ctx.moveTo(6 * scale, 0);
    ctx.lineTo(6 * scale, -22 * scale);
    ctx.lineTo(-4 * scale, -22 * scale);
    ctx.stroke();
  }

  private drawCargoAirport(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette): void {
    // Pas startowy
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-16 * scale, 4 * scale);
    ctx.lineTo(10 * scale, -8 * scale);
    ctx.lineTo(16 * scale, -5 * scale);
    ctx.lineTo(-10 * scale, 7 * scale);
    ctx.closePath();
    ctx.fill();
    // Hangar i wieża kontroli lotów
    this.drawIsoBox(ctx, -6 * scale, -2 * scale, 13 * scale, 10 * scale, 8 * scale, pal.primary, pal.secondary);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(8 * scale, -23 * scale, 3 * scale, 16 * scale);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(6 * scale, -25 * scale, 7 * scale, 3.5 * scale);
  }

  private drawHospital(ctx: CanvasRenderingContext2D, scale: number, level: number): void {
    const h = (14 + level * 1.6) * scale;
    this.drawIsoBox(ctx, 0, 1 * scale, 23 * scale, 18 * scale, h, '#f8fafc', '#cbd5e1');
    // Czerwony krzyż medyczny
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-1.2 * scale, -h - 4 * scale, 2.4 * scale, 7 * scale);
    ctx.fillRect(-3.5 * scale, -h - 1.7 * scale, 7 * scale, 2.4 * scale);
  }

  private drawFireStation(ctx: CanvasRenderingContext2D, scale: number, level: number): void {
    const h = (11 + level * 1.4) * scale;
    this.drawIsoBox(ctx, -2 * scale, 1 * scale, 20 * scale, 15 * scale, h, '#dc2626', '#991b1b');
    // Bramy garażowe
    ctx.fillStyle = '#334155';
    ctx.fillRect(-8 * scale, -5 * scale, 4 * scale, 5 * scale);
    ctx.fillRect(-2 * scale, -5 * scale, 4 * scale, 5 * scale);
    // Wieża obserwacyjna z kogutem
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(6 * scale, -h - 11 * scale, 4 * scale, 11 * scale);
    const pulse = Math.floor(this.frameCount / 10) % 2 === 0;
    ctx.fillStyle = pulse ? '#38bdf8' : '#fca5a5';
    ctx.beginPath();
    ctx.arc(8 * scale, -h - 12 * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHazmatBase(ctx: CanvasRenderingContext2D, scale: number, level: number): void {
    const h = (12 + level * 1.4) * scale;
    this.drawIsoBox(ctx, 0, 2 * scale, 22 * scale, 16 * scale, h, '#eab308', '#a16207');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-7 * scale, -h + 2 * scale, 14 * scale, 3 * scale);
    ctx.fillStyle = '#a3e635';
    ctx.beginPath();
    ctx.arc(0, -h - 4 * scale, 3.2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawAmusementPark(ctx: CanvasRenderingContext2D, scale: number): void {
    this.drawIsoBox(ctx, -5 * scale, 3 * scale, 15 * scale, 11 * scale, 7 * scale, '#db2777', '#9d174d');
    // Diabelski młyn
    const cx = 4 * scale;
    const cy = -18 * scale;
    const r = 11 * scale;
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 0.8 * scale;
    for (let i = 0; i < 6; i++) {
      const a = this.frameCount * 0.03 + (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
  }

  private drawCulturalCenter(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette): void {
    this.drawIsoBox(ctx, 0, 2 * scale, 22 * scale, 17 * scale, 9 * scale, pal.primary, pal.secondary);
    // Architektoniczna kopuła koncertowa
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, -9 * scale, 8 * scale, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
  }

  private drawMarinaPromenade(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette): void {
    this.drawIsoBox(ctx, -3 * scale, 2 * scale, 22 * scale, 14 * scale, 6 * scale, pal.primary, pal.secondary);
    // Żagle jachtów
    ctx.fillStyle = '#f8fafc';
    for (const dx of [-5, 4]) {
      ctx.beginPath();
      ctx.moveTo(dx * scale, -6 * scale);
      ctx.lineTo((dx + 2) * scale, -19 * scale);
      ctx.lineTo((dx + 6) * scale, -6 * scale);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawJewelryWorkshop(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette, level: number): void {
    const h = (12 + level * 1.4) * scale;
    this.drawIsoBox(ctx, 0, 1 * scale, 18 * scale, 14 * scale, h, pal.primary, pal.secondary);
    // Złoty diament na dachu
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(0, -h - 9 * scale);
    ctx.lineTo(4 * scale, -h - 4 * scale);
    ctx.lineTo(0, -h + 1 * scale);
    ctx.lineTo(-4 * scale, -h - 4 * scale);
    ctx.closePath();
    ctx.fill();
  }

  private drawFireHazard(ctx: CanvasRenderingContext2D, scale: number): void {
    for (let i = 0; i < 4; i++) {
      const wobble = Math.sin(this.frameCount * 0.25 + i * 1.7) * 3 * scale;
      const fx = (-6 + i * 4) * scale + wobble * 0.4;
      const fh = (10 + ((this.frameCount + i * 7) % 6)) * scale;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(249, 115, 22, 0.88)' : 'rgba(239, 68, 68, 0.9)';
      ctx.beginPath();
      ctx.moveTo(fx - 3.5 * scale, -4 * scale);
      ctx.lineTo(fx + wobble * 0.3, -4 * scale - fh);
      ctx.lineTo(fx + 3.5 * scale, -4 * scale);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawHazmatAura(ctx: CanvasRenderingContext2D, scale: number): void {
    const pulse = 0.45 + Math.sin(this.frameCount * 0.14) * 0.25;
    ctx.fillStyle = `rgba(163, 230, 53, ${pulse * 0.35})`;
    ctx.beginPath();
    ctx.ellipse(0, -4 * scale, 16 * scale, 9 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(163, 230, 53, ${pulse})`;
    ctx.lineWidth = 1.4 * scale;
    ctx.stroke();
  }

  private drawIsoBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    d: number,
    h: number,
    colorFront: string,
    colorSide: string
  ): void {
    const hw = w / 2;
    const hd = d / 4;

    ctx.fillStyle = lightenColor(colorFront, 0.16);
    ctx.beginPath();
    ctx.moveTo(x, y - h - hd);
    ctx.lineTo(x + hw, y - h);
    ctx.lineTo(x, y - h + hd);
    ctx.lineTo(x - hw, y - h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colorFront;
    ctx.beginPath();
    ctx.moveTo(x - hw, y - h);
    ctx.lineTo(x, y - h + hd);
    ctx.lineTo(x, y + hd);
    ctx.lineTo(x - hw, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colorSide;
    ctx.beginPath();
    ctx.moveTo(x + hw, y - h);
    ctx.lineTo(x, y - h + hd);
    ctx.lineTo(x, y + hd);
    ctx.lineTo(x + hw, y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = darkenColor(colorFront, 0.35);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y - h - hd);
    ctx.lineTo(x + hw, y - h);
    ctx.lineTo(x + hw, y);
    ctx.lineTo(x, y + hd);
    ctx.lineTo(x - hw, y);
    ctx.lineTo(x - hw, y - h);
    ctx.closePath();
    ctx.stroke();
  }

  private drawSmoke(ctx: CanvasRenderingContext2D, x: number, topY: number, scale: number): void {
    for (let i = 0; i < 3; i++) {
      const age = ((this.frameCount * 0.4 + i * 18) % 54) / 54;
      const sy = topY - age * 18 * scale;
      const sx = x + Math.sin(this.frameCount * 0.03 + i) * 2.5 * scale;
      ctx.fillStyle = `rgba(180,190,205,${0.35 * (1 - age)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, (1.2 + age * 3.5) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawSteam(ctx: CanvasRenderingContext2D, x: number, topY: number, scale: number): void {
    for (let i = 0; i < 4; i++) {
      const age = ((this.frameCount * 0.3 + i * 14) % 56) / 56;
      const sy = topY - age * 22 * scale;
      const sx = x + Math.sin(this.frameCount * 0.02 + i * 2) * 3.5 * scale;
      ctx.fillStyle = `rgba(226,232,240,${0.28 * (1 - age)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, (2 + age * 4.5) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawOwnerAndLevelBadge(
    ctx: CanvasRenderingContext2D,
    scale: number,
    level: number,
    ownerColor: string
  ): void {
    if (scale < 0.45) return;
    const label = level <= 0 ? '✕' : level >= 1 && level <= 10 ? ROMAN[level - 1] : String(level);
    const x = 13 * scale;
    const y = -3 * scale;

    ctx.fillStyle = 'rgba(11, 15, 23, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x - 7 * scale, y - 4 * scale, 14 * scale, 8 * scale, 3 * scale);
    ctx.fill();
    ctx.strokeStyle = ownerColor;
    ctx.lineWidth = 1 * scale;
    ctx.stroke();

    ctx.fillStyle = level <= 0 ? '#fca5a5' : '#f8fafc';
    ctx.font = `700 ${Math.max(6, Math.round(5 * scale))}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 0.3 * scale);
  }

  private drawRuinedBuilding(ctx: CanvasRenderingContext2D, scale: number): void {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.beginPath();
    ctx.ellipse(0, 1 * scale, 16 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    this.drawIsoBox(ctx, -6 * scale, 2 * scale, 8 * scale, 7 * scale, 4 * scale, '#334155', '#1e293b');
    this.drawIsoBox(ctx, 4 * scale, 1 * scale, 9 * scale, 6 * scale, 5.5 * scale, '#475569', '#1e293b');
    this.drawIsoBox(ctx, 0, -2 * scale, 6 * scale, 5 * scale, 2.5 * scale, '#78350f', '#451a03');
    this.drawSmoke(ctx, 2 * scale, -6 * scale, scale * 0.85);
  }

  private drawHazardDestructionBar(ctx: CanvasRenderingContext2D, scale: number, progress: number): void {
    const w = 26 * scale;
    const h = 4 * scale;
    const x = -w / 2;
    const y = -28 * scale;
    ctx.fillStyle = 'rgba(11, 15, 23, 0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = progress > 70 ? '#ef4444' : '#f97316';
    ctx.fillRect(x + 0.5, y + 0.5, Math.max(1, (w - 1) * Math.min(1, progress / 100)), h - 1);
  }

  private drawWindFarm(ctx: CanvasRenderingContext2D, scale: number): void {
    for (const [tx, ty] of [
      [-6, 1],
      [6, -1],
    ]) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.6 * scale;
      ctx.beginPath();
      ctx.moveTo(tx * scale, ty * scale);
      ctx.lineTo(tx * scale, (ty - 19) * scale);
      ctx.stroke();
      const angle = this.frameCount * 0.08 + tx;
      for (let i = 0; i < 3; i++) {
        const a = angle + (i * Math.PI * 2) / 3;
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1.2 * scale;
        ctx.beginPath();
        ctx.moveTo(tx * scale, (ty - 19) * scale);
        ctx.lineTo((tx + Math.cos(a) * 8) * scale, (ty - 19 + Math.sin(a) * 8) * scale);
        ctx.stroke();
      }
    }
  }

  private drawSolarFarm(ctx: CanvasRenderingContext2D, scale: number): void {
    this.drawIsoBox(ctx, 0, 2 * scale, 22 * scale, 16 * scale, 3 * scale, '#1e3a8a', '#0f172a');
    for (const [px, py] of [
      [-6, -2],
      [4, -2],
      [-5, 2],
      [5, 2],
    ]) {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(px * scale - 4 * scale, py * scale - 2.5 * scale, 8 * scale, 3.5 * scale);
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 0.5 * scale;
      ctx.strokeRect(px * scale - 4 * scale, py * scale - 2.5 * scale, 8 * scale, 3.5 * scale);
    }
  }

  private drawGasPlant(ctx: CanvasRenderingContext2D, scale: number, pal: BuildingPalette, level: number): void {
    const h = (12 + level * 1.2) * scale;
    this.drawIsoBox(ctx, -3 * scale, 1 * scale, 16 * scale, 12 * scale, h, '#3b82f6', '#1e40af');
    this.drawIsoBox(ctx, 8 * scale, 0, 6 * scale, 6 * scale, h + 6 * scale, pal.primary, pal.secondary);
    this.drawSteam(ctx, 8 * scale, -h - 6 * scale, scale * 0.7);
  }

  private drawGeothermalPlant(ctx: CanvasRenderingContext2D, scale: number): void {
    this.drawIsoBox(ctx, 0, 1 * scale, 19 * scale, 14 * scale, 11 * scale, '#475569', '#334155');
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(0, -11 * scale, 4 * scale, 0, Math.PI * 2);
    ctx.fill();
    this.drawSteam(ctx, 0, -14 * scale, scale * 1.1);
  }

  private drawFusionReactor(ctx: CanvasRenderingContext2D, scale: number): void {
    this.drawIsoBox(ctx, 0, 2 * scale, 24 * scale, 18 * scale, 9 * scale, '#1e1b4b', '#312e81');
    const pulse = 0.65 + Math.sin(this.frameCount * 0.16) * 0.3;
    ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.ellipse(0, -12 * scale, 10 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(192, 132, 252, ${pulse})`;
    ctx.beginPath();
    ctx.arc(0, -12 * scale, 3.2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSewagePlant(ctx: CanvasRenderingContext2D, scale: number): void {
    this.drawIsoBox(ctx, -6 * scale, 1 * scale, 11 * scale, 10 * scale, 9 * scale, '#475569', '#334155');
    for (const [cx, cy] of [
      [5, -2],
      [6, 3],
    ]) {
      ctx.fillStyle = '#0f766e';
      ctx.beginPath();
      ctx.ellipse(cx * scale, cy * scale, 5 * scale, 2.8 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#99f6e4';
      ctx.lineWidth = 0.8 * scale;
      ctx.stroke();
    }
  }

  private drawWasteIncinerator(ctx: CanvasRenderingContext2D, scale: number): void {
    this.drawIsoBox(ctx, -2 * scale, 1 * scale, 18 * scale, 14 * scale, 11 * scale, '#78350f', '#451a03');
    this.drawIsoBox(ctx, 5 * scale, -1 * scale, 5 * scale, 5 * scale, 20 * scale, '#57534e', '#292524');
    this.drawSmoke(ctx, 5 * scale, -21 * scale, scale * 1.15);
  }

  private drawRecyclingPlant(ctx: CanvasRenderingContext2D, scale: number): void {
    this.drawIsoBox(ctx, 0, 1 * scale, 20 * scale, 15 * scale, 11 * scale, '#15803d', '#166534');
    this.drawIsoBox(ctx, 0, -10 * scale, 12 * scale, 9 * scale, 4 * scale, '#22c55e', '#15803d');
    ctx.fillStyle = '#ecfccb';
    ctx.font = `700 ${Math.max(6, Math.round(7 * scale))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♻', 0, -14 * scale);
  }

  private drawUraniumEnrichment(ctx: CanvasRenderingContext2D, scale: number): void {
    this.drawIsoBox(ctx, 0, 1 * scale, 20 * scale, 15 * scale, 12 * scale, '#3f6212', '#1a2e05');
    for (const dx of [-6, 0, 6]) {
      this.drawIsoBox(ctx, dx * scale, -11 * scale, 4 * scale, 4 * scale, 7 * scale, '#84cc16', '#4d7c0f');
    }
  }

  private drawColdStorage(ctx: CanvasRenderingContext2D, scale: number, level: number): void {
    const h = (11 + level) * scale;
    this.drawIsoBox(ctx, 0, 1 * scale, 22 * scale, 16 * scale, h, '#e0f2fe', '#7dd3fc');
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-6 * scale, -h - 2 * scale, 12 * scale, 2 * scale);
  }

  private drawSpecializedMine(
    ctx: CanvasRenderingContext2D,
    scale: number,
    gemColor: string,
    pal: BuildingPalette,
    level: number
  ): void {
    this.drawMiningBuilding(ctx, scale, pal, level);
    ctx.fillStyle = gemColor;
    ctx.beginPath();
    ctx.moveTo(0, -24 * scale);
    ctx.lineTo(3.5 * scale, -20 * scale);
    ctx.lineTo(0, -16 * scale);
    ctx.lineTo(-3.5 * scale, -20 * scale);
    ctx.closePath();
    ctx.fill();
  }

  private drawBatteryFactory(ctx: CanvasRenderingContext2D, scale: number, level: number): void {
    const h = (13 + level * 1.2) * scale;
    this.drawIsoBox(ctx, 0, 1 * scale, 21 * scale, 15 * scale, h, '#312e81', '#1e1b4b');
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(-5 * scale, -h - 4 * scale, 10 * scale, 3 * scale);
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(-2 * scale, -h - 6 * scale, 4 * scale, 2 * scale);
  }

  private drawStatusIcons(ctx: CanvasRenderingContext2D, scale: number, building: Building): void {
    const icons: string[] = [];
    if (building.status.onFire || building.activeHazard?.kind === 'fire') icons.push('🔥');
    if (building.status.robberyActive || building.activeHazard?.kind === 'robbery') icons.push('🚨');
    if (
      building.status.hazmatIncident ||
      (building.activeHazard &&
        building.activeHazard.kind !== 'fire' &&
        building.activeHazard.kind !== 'robbery')
    ) {
      icons.push('☣️');
    }
    if (building.status.noRoadLink || building.logisticsMode === 'isolated') icons.push('🛣️');
    if (building.status.missingInputs) icons.push('⛔');
    if (building.status.sewageCrisis) icons.push('🚰');
    if (building.status.wasteCrisis) icons.push('🗑️');
    if (building.status.disasterStruck) icons.push('🌪️');
    if (building.status.breakdown) icons.push('⚠️');
    if (building.status.noPower) icons.push('⚡');
    if (building.status.noWater || building.status.droughtHit) icons.push('💧');
    if (building.status.storageFull) icons.push('📦');
    if (building.status.upgradeActive) icons.push('✨');
    if (building.status.boycotted) icons.push('📢');

    if (icons.length === 0) return;

    const bounce = Math.sin(this.frameCount * 0.1) * 1.4 * scale;
    const y = -34 * scale + bounce;
    const spacing = 8 * scale;
    const startX = -((icons.length - 1) * spacing) / 2;

    ctx.font = `${Math.max(8, Math.round(7.5 * scale))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < icons.length; i++) {
      ctx.fillText(icons[i], startX + i * spacing, y);
    }
  }
}
