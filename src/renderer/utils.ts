import type { DepthSortable } from '../engine/types';

// ─── Tile size constants ───────────────────────────────────────────────────

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export function getTileWidth(): number {
  return TILE_WIDTH;
}

export function getTileHeight(): number {
  return TILE_HEIGHT;
}

// ─── Coordinate conversions ────────────────────────────────────────────────

/**
 * Convert grid (x, y) to screen pixel coordinates using isometric projection.
 * Standard 2:1 isometric diamond layout.
 */
export function worldToScreen(
  x: number,
  y: number,
  tileWidth: number,
  tileHeight: number,
  offsetX: number,
  offsetY: number,
): { screenX: number; screenY: number } {
  const screenX = (x - y) * (tileWidth / 2) + offsetX;
  const screenY = (x + y) * (tileHeight / 2) + offsetY;
  return { screenX, screenY };
}

/**
 * Reverse isometric conversion: screen pixel to grid coordinates.
 * Returns fractional grid coords – callers should Math.floor for tile lookup.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  tileWidth: number,
  tileHeight: number,
  offsetX: number,
  offsetY: number,
): { gridX: number; gridY: number } {
  const sx = screenX - offsetX;
  const sy = screenY - offsetY;
  const gridX = (sx / (tileWidth / 2) + sy / (tileHeight / 2)) / 2;
  const gridY = (sy / (tileHeight / 2) - sx / (tileWidth / 2)) / 2;
  return { gridX, gridY };
}

// ─── Depth sorting (painter's algorithm) ───────────────────────────────────

/**
 * Sort an array of items for correct isometric overlap.
 * Items with higher (gridX + gridY) are drawn later (on top).
 * Ties broken by gridX so left-to-right overlap is correct.
 */
export function sortByDepth<T extends DepthSortable>(items: T[]): T[] {
  return items.slice().sort((a, b) => {
    const depthA = a.gridX + a.gridY;
    const depthB = b.gridX + b.gridY;
    if (depthA !== depthB) return depthA - depthB;
    return a.gridX - b.gridX;
  });
}

// ─── Color utilities ───────────────────────────────────────────────────────

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse a hex color string (#RGB or #RRGGBB) into an RGB object.
 */
export function hexToRgb(hex: string): RGB {
  let cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

/**
 * Convert an RGB object back to a hex color string (#rrggbb).
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number): string => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Linearly interpolate between two hex colors by factor t (0..1).
 */
export function interpolateColor(
  color1: string,
  color2: string,
  t: number,
): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const clamped = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: c1.r + (c2.r - c1.r) * clamped,
    g: c1.g + (c2.g - c1.g) * clamped,
    b: c1.b + (c2.b - c1.b) * clamped,
  });
}

/**
 * Lighten a hex color by a given factor (0..1).
 */
export function lightenColor(hex: string, factor: number): string {
  return interpolateColor(hex, '#ffffff', factor);
}

/**
 * Darken a hex color by a given factor (0..1).
 */
export function darkenColor(hex: string, factor: number): string {
  return interpolateColor(hex, '#000000', factor);
}
