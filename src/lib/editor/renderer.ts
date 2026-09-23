import type { FitMode, Point } from "@/types/design";

export interface SourceCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates source image crop coordinates for Konva.Image matching the Print Engine's
 * COVER / CONTAIN / FILL semantics with focal point alignment.
 */
export function calculateKonvaImageCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidthPx: number,
  targetHeightPx: number,
  fit: FitMode = "COVER",
  focalPoint?: Point,
): SourceCropRect | undefined {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidthPx <= 0 || targetHeightPx <= 0) {
    return undefined;
  }

  if (fit === "FILL") {
    // Fill stretches source to target without cropping
    return undefined;
  }

  if (fit === "CONTAIN") {
    // Contain renders full source within bounding frame without cropping
    return undefined;
  }

  // COVER: crop source image to match target aspect ratio with focal point alignment
  const fp = focalPoint || { x: 0.5, y: 0.5 };
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidthPx / targetHeightPx;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (sourceAspect > targetAspect) {
    // Source is wider than target -> crop sides
    cropHeight = sourceHeight;
    cropWidth = sourceHeight * targetAspect;
    cropX = (sourceWidth - cropWidth) * fp.x;
    cropY = 0;
  } else {
    // Source is taller than target -> crop top/bottom
    cropWidth = sourceWidth;
    cropHeight = sourceWidth / targetAspect;
    cropX = 0;
    cropY = (sourceHeight - cropHeight) * fp.y;
  }

  // Ensure crop box stays within source image boundaries
  cropX = Math.max(0, Math.min(cropX, sourceWidth - cropWidth));
  cropY = Math.max(0, Math.min(cropY, sourceHeight - cropHeight));

  return {
    x: Math.round(cropX),
    y: Math.round(cropY),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  };
}
