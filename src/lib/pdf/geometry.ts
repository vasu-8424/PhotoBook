import type { FitMode, Point } from "@/types/design";
import { mmToPt } from "./units";
import type { ImageCropBounds, PdfRect } from "./types";

/**
 * Converts top-left mm coordinates to PDF bottom-left pt coordinates.
 */
export function mmRectToPdfRect(
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  pageHeightPt: number,
): PdfRect {
  const width = mmToPt(widthMm);
  const height = mmToPt(heightMm);
  const x = mmToPt(xMm);
  const y = pageHeightPt - mmToPt(yMm) - height;

  return { x, y, width, height };
}

/**
 * Calculates PDF draw and clip bounds for image rendering based on FitMode and focal point.
 */
export function calculateImageBounds(
  sourceWidth: number,
  sourceHeight: number,
  targetMm: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  pageHeightPt: number,
  fit: FitMode,
  focalPoint?: Point,
): ImageCropBounds {
  const targetPdf = mmRectToPdfRect(
    targetMm.xMm,
    targetMm.yMm,
    targetMm.widthMm,
    targetMm.heightMm,
    pageHeightPt,
  );

  const targetWidth = targetPdf.width;
  const targetHeight = targetPdf.height;
  const targetX = targetPdf.x;
  const targetY = targetPdf.y;

  if (fit === "FILL") {
    return {
      clipRect: targetPdf,
      imageRect: targetPdf,
    };
  }

  const targetAspect = targetWidth / targetHeight;
  const sourceAspect = sourceWidth / sourceHeight;

  if (fit === "CONTAIN") {
    let drawWidth: number;
    let drawHeight: number;
    let drawX: number;
    let drawY: number;

    if (sourceAspect >= targetAspect) {
      drawWidth = targetWidth;
      drawHeight = targetWidth / sourceAspect;
      drawX = targetX;
      drawY = targetY + (targetHeight - drawHeight) / 2;
    } else {
      drawHeight = targetHeight;
      drawWidth = targetHeight * sourceAspect;
      drawX = targetX + (targetWidth - drawWidth) / 2;
      drawY = targetY;
    }

    const imageRect: PdfRect = {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
    };

    return {
      clipRect: targetPdf,
      imageRect,
    };
  }

  // fit === "COVER"
  const scale = Math.max(
    targetWidth / sourceWidth,
    targetHeight / sourceHeight,
  );
  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;

  const fx = focalPoint?.x !== undefined ? Math.max(0, Math.min(1, focalPoint.x)) : 0.5;
  const fy = focalPoint?.y !== undefined ? Math.max(0, Math.min(1, focalPoint.y)) : 0.5;

  // In top-left coordinate system relative to target rectangle
  const focalPixelX = fx * scaledWidth;
  const focalPixelY = fy * scaledHeight;

  const targetCenterX = targetWidth / 2;
  const targetCenterY = targetHeight / 2;

  const offsetRelX = targetCenterX - focalPixelX;
  const offsetRelY = targetCenterY - focalPixelY;

  // Clamp offset so the image always covers the entire target area
  const minOffsetX = targetWidth - scaledWidth; // <= 0
  const maxOffsetX = 0;
  const clampedOffsetX = Math.min(maxOffsetX, Math.max(minOffsetX, offsetRelX));

  const minOffsetY = targetHeight - scaledHeight; // <= 0
  const maxOffsetY = 0;
  const clampedOffsetY = Math.min(maxOffsetY, Math.max(minOffsetY, offsetRelY));

  // In top-left coordinates:
  // Element top-left is at (targetMm.xMm, targetMm.yMm)
  // Image top-left in pt from page top is: mmToPt(targetMm.yMm) + clampedOffsetY
  const targetTopPt = mmToPt(targetMm.yMm);
  const targetLeftPt = mmToPt(targetMm.xMm);

  const imageTopPt = targetTopPt + clampedOffsetY;
  const imageLeftPt = targetLeftPt + clampedOffsetX;

  // Convert top-left image origin to PDF bottom-left origin:
  const imagePdfY = pageHeightPt - imageTopPt - scaledHeight;
  const imagePdfX = imageLeftPt;

  return {
    clipRect: targetPdf,
    imageRect: {
      x: imagePdfX,
      y: imagePdfY,
      width: scaledWidth,
      height: scaledHeight,
    },
  };
}

/**
 * Calculates spread slice placement across left and right pages with gutter.
 */
export function calculateSpreadBounds(
  sourceWidth: number,
  sourceHeight: number,
  pageWidthMm: number,
  pageHeightMm: number,
  gutterMm: number,
  fit: FitMode = "COVER",
  focalPoint?: Point,
): {
  leftSlice: ImageCropBounds;
  rightSlice: ImageCropBounds;
} {
  const totalSpreadWidthMm = pageWidthMm * 2 + gutterMm;
  const pageHeightPt = mmToPt(pageHeightMm);
  const totalSpreadWidthPt = mmToPt(totalSpreadWidthMm);

  let scale: number;
  if (fit === "CONTAIN") {
    scale = Math.min(totalSpreadWidthPt / sourceWidth, pageHeightPt / sourceHeight);
  } else if (fit === "FILL") {
    // Fill treats width and height separately, handled below
    scale = 1;
  } else {
    // COVER
    scale = Math.max(totalSpreadWidthPt / sourceWidth, pageHeightPt / sourceHeight);
  }

  const scaledWidth = fit === "FILL" ? totalSpreadWidthPt : sourceWidth * scale;
  const scaledHeight = fit === "FILL" ? pageHeightPt : sourceHeight * scale;

  const fx = focalPoint?.x !== undefined ? Math.max(0, Math.min(1, focalPoint.x)) : 0.5;
  const fy = focalPoint?.y !== undefined ? Math.max(0, Math.min(1, focalPoint.y)) : 0.5;

  let clampedOffsetX = 0;
  let clampedOffsetY = 0;

  if (fit === "COVER") {
    const focalPixelX = fx * scaledWidth;
    const focalPixelY = fy * scaledHeight;

    const offsetRelX = totalSpreadWidthPt / 2 - focalPixelX;
    const offsetRelY = pageHeightPt / 2 - focalPixelY;

    const minOffsetX = totalSpreadWidthPt - scaledWidth;
    const minOffsetY = pageHeightPt - scaledHeight;

    clampedOffsetX = Math.min(0, Math.max(minOffsetX, offsetRelX));
    clampedOffsetY = Math.min(0, Math.max(minOffsetY, offsetRelY));
  } else if (fit === "CONTAIN") {
    clampedOffsetX = (totalSpreadWidthPt - scaledWidth) / 2;
    clampedOffsetY = (pageHeightPt - scaledHeight) / 2;
  }

  // On the left page:
  // Spread origin x=0 corresponds to left page x=0
  const leftPageClip: PdfRect = {
    x: 0,
    y: 0,
    width: mmToPt(pageWidthMm),
    height: pageHeightPt,
  };

  const leftImagePdfY = pageHeightPt - clampedOffsetY - scaledHeight;
  const leftImagePdfX = clampedOffsetX;

  const leftSlice: ImageCropBounds = {
    clipRect: leftPageClip,
    imageRect: {
      x: leftImagePdfX,
      y: leftImagePdfY,
      width: scaledWidth,
      height: scaledHeight,
    },
  };

  // On the right page:
  // Spread x = (pageWidthMm + gutterMm) corresponds to right page x=0
  const rightShiftPt = mmToPt(pageWidthMm + gutterMm);
  const rightPageClip: PdfRect = {
    x: 0,
    y: 0,
    width: mmToPt(pageWidthMm),
    height: pageHeightPt,
  };

  const rightImagePdfX = clampedOffsetX - rightShiftPt;
  const rightImagePdfY = leftImagePdfY;

  const rightSlice: ImageCropBounds = {
    clipRect: rightPageClip,
    imageRect: {
      x: rightImagePdfX,
      y: rightImagePdfY,
      width: scaledWidth,
      height: scaledHeight,
    },
  };

  return { leftSlice, rightSlice };
}

export function getSafeAreaMm(
  docWidthMm: number,
  docHeightMm: number,
  safeAreaMm: number,
) {
  return {
    minX: safeAreaMm,
    maxX: docWidthMm - safeAreaMm,
    minY: safeAreaMm,
    maxY: docHeightMm - safeAreaMm,
  };
}
