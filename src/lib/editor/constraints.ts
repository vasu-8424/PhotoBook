import type { BookDocument } from "@/types/design";
import { APPROVED_FONTS, APPROVED_FONT_WEIGHTS, MIN_ELEMENT_DIMENSION_MM } from "./constants";
import { roundMm } from "./coordinates";

export interface BoundingBoxMm {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

/**
 * Constrains an image's position to keep it within allowable page & bleed bounds.
 */
export function constrainImagePosition(
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  doc: BookDocument,
): { xMm: number; yMm: number } {
  const bleed = doc.bleedMm;
  const minX = -bleed;
  const maxX = doc.widthMm + bleed - widthMm;
  const minY = -bleed;
  const maxY = doc.heightMm + bleed - heightMm;

  return {
    xMm: roundMm(Math.max(minX, Math.min(xMm, maxX))),
    yMm: roundMm(Math.max(minY, Math.min(yMm, maxY))),
  };
}

/**
 * Constrains a text element's position strictly within the safe area boundary.
 */
export function constrainTextPosition(
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  doc: BookDocument,
): { xMm: number; yMm: number } {
  const safe = doc.safeAreaMm;
  const minX = safe;
  const maxX = Math.max(minX, doc.widthMm - safe - widthMm);
  const minY = safe;
  const maxY = Math.max(minY, doc.heightMm - safe - heightMm);

  return {
    xMm: roundMm(Math.max(minX, Math.min(xMm, maxX))),
    yMm: roundMm(Math.max(minY, Math.min(yMm, maxY))),
  };
}

/**
 * Enforces positive minimum dimensions and page bounds.
 */
export function constrainDimensions(
  widthMm: number,
  heightMm: number,
  maxWidthMm: number,
  maxHeightMm: number,
  minDimensionMm: number = MIN_ELEMENT_DIMENSION_MM,
): { widthMm: number; heightMm: number } {
  return {
    widthMm: roundMm(Math.max(minDimensionMm, Math.min(widthMm, maxWidthMm))),
    heightMm: roundMm(Math.max(minDimensionMm, Math.min(heightMm, maxHeightMm))),
  };
}

/**
 * Verifies if a photo asset is protected from deletion or arbitrary destruction.
 */
export function isProtectedPhoto(
  assetId: string | undefined,
  protectedPhotoIds: string[] | undefined,
): boolean {
  if (!assetId || !protectedPhotoIds || protectedPhotoIds.length === 0) {
    return false;
  }
  return protectedPhotoIds.includes(assetId);
}

/**
 * Verifies that a font family and weight are supported by the Print Engine.
 */
export function isApprovedFont(
  fontFamily: string,
  fontWeight: number,
): boolean {
  const isFamily = (APPROVED_FONTS as readonly string[]).includes(fontFamily);
  const isWeight = (APPROVED_FONT_WEIGHTS as readonly number[]).includes(fontWeight);
  return isFamily && isWeight;
}

/**
 * Verifies that a spread's focal point does not land dangerously across the central gutter fold.
 */
export function isGutterSafe(focalPointX?: number): boolean {
  if (focalPointX === undefined) return true;
  // Dangerous center fold zone: 0.46 to 0.54
  return focalPointX <= 0.46 || focalPointX >= 0.54;
}
