import { DEFAULT_PIXELS_PER_MM } from "./constants";
import type { DisplayScale } from "./types";

/**
 * Rounds a millimeter value to clean precision (default 2 decimal places)
 * to avoid floating-point accumulation (e.g., 20.000000004 -> 20.00).
 */
export function roundMm(value: number, precision: number = 2): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

/**
 * Converts physical millimeters to screen pixels using the given effective scale.
 */
export function mmToPx(mm: number, effectiveScale: number): number {
  return mm * effectiveScale;
}

/**
 * Converts screen pixels to physical millimeters and cleans floating-point noise.
 */
export function pxToMm(px: number, effectiveScale: number): number {
  if (effectiveScale <= 0) return 0;
  return roundMm(px / effectiveScale);
}

/**
 * Converts typography points (pt) to screen pixels.
 * 1 pt = 25.4 / 72 mm.
 */
export function ptToPx(pt: number, effectiveScale: number): number {
  const mm = pt * (25.4 / 72);
  return mmToPx(mm, effectiveScale);
}

/**
 * Converts screen pixels to typography points (pt).
 */
export function pxToPt(px: number, effectiveScale: number): number {
  if (effectiveScale <= 0) return 12;
  const mm = px / effectiveScale;
  return Math.round((mm * (72 / 25.4)) * 10) / 10;
}

export interface RectMm {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface RectPx {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function mmRectToPxRect(rect: RectMm, effectiveScale: number): RectPx {
  return {
    x: mmToPx(rect.xMm, effectiveScale),
    y: mmToPx(rect.yMm, effectiveScale),
    width: mmToPx(rect.widthMm, effectiveScale),
    height: mmToPx(rect.heightMm, effectiveScale),
  };
}

export function pxRectToMmRect(rect: RectPx, effectiveScale: number): RectMm {
  return {
    xMm: pxToMm(rect.x, effectiveScale),
    yMm: pxToMm(rect.y, effectiveScale),
    widthMm: pxToMm(rect.width, effectiveScale),
    heightMm: pxToMm(rect.height, effectiveScale),
  };
}

/**
 * Computes optimal display scale to fit page canvas into available container bounds.
 */
export function calculateDisplayScale(
  pageWidthMm: number,
  pageHeightMm: number,
  viewportWidthPx: number,
  viewportHeightPx: number,
  zoom: number,
): DisplayScale {
  const paddingPx = 64; // Workspace margin
  const availW = Math.max(200, viewportWidthPx - paddingPx);
  const availH = Math.max(200, viewportHeightPx - paddingPx);

  const baseScaleW = availW / pageWidthMm;
  const baseScaleH = availH / pageHeightMm;

  // Base scale fits canvas cleanly inside viewport at zoom = 1.0
  const basePixelsPerMm = Math.min(baseScaleW, baseScaleH, DEFAULT_PIXELS_PER_MM * 1.5);
  const pixelsPerMm = Math.max(1.0, basePixelsPerMm);

  return {
    pixelsPerMm,
    zoom,
    effectiveScale: pixelsPerMm * zoom,
  };
}
