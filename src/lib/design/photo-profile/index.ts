import type { PhotoAnalysis } from "@/lib/ai/vision/types";
import type { PhotoAsset } from "@/types/photo";
import type {
  PhotoLayoutProfile,
  PhotoOrientation,
  PreferredTreatment,
} from "../types";

export interface BuildProfileOptions {
  asset?: Partial<PhotoAsset>;
  analysis?: Partial<PhotoAnalysis>;
  defaultWidth?: number;
  defaultHeight?: number;
}

/**
 * Deterministically computes orientation based on width and height dimensions.
 * Avoids any LLM inference for pure geometric classification.
 */
export function determineOrientation(
  width: number,
  height: number,
): PhotoOrientation {
  if (!width || !height || height <= 0 || width <= 0) {
    return "LANDSCAPE";
  }

  const ratio = width / height;
  if (ratio > 1.05) {
    return "LANDSCAPE";
  } else if (ratio < 0.95) {
    return "PORTRAIT";
  }
  return "SQUARE";
}

/**
 * Deterministically computes normalized aspect ratio (width / height) to 2 decimals.
 */
export function determineAspectRatio(width: number, height: number): number {
  if (!height || height <= 0 || !width || width <= 0) {
    return 1.5;
  }
  return Math.round((width / height) * 100) / 100;
}

/**
 * Builds a normalized PhotoLayoutProfile from existing PhotoAsset and/or PhotoAnalysis metadata.
 */
export function buildPhotoLayoutProfile(
  assetId: string,
  options: BuildProfileOptions = {},
): PhotoLayoutProfile {
  const { asset, analysis } = options;

  const widthPx = asset?.width || options.defaultWidth || 2400;
  const heightPx = asset?.height || options.defaultHeight || 1600;

  const orientation = determineOrientation(widthPx, heightPx);
  const aspectRatio = determineAspectRatio(widthPx, heightPx);

  // Quality calculation from visual quality
  let qualityScore = 0.75;
  if (analysis?.visualQuality) {
    const vq = analysis.visualQuality;
    const overallScore =
      vq.overall === "EXCELLENT"
        ? 1.0
        : vq.overall === "GOOD"
        ? 0.82
        : vq.overall === "FAIR"
        ? 0.6
        : 0.35;

    const sharpnessMod =
      vq.sharpness === "SHARP"
        ? 1.0
        : vq.sharpness === "ACCEPTABLE"
        ? 0.9
        : 0.7;

    const printMod =
      vq.usableForPrint === "YES"
        ? 1.0
        : vq.usableForPrint === "MAYBE"
        ? 0.85
        : 0.5;

    qualityScore = Math.round(overallScore * sharpnessMod * printMod * 100) / 100;
  }

  // Visual weight calculation: quality, subjects, prominence
  let visualWeight = qualityScore * 0.7;
  const peopleCount = analysis?.peopleCount ?? 0;
  if (peopleCount > 0) {
    visualWeight += 0.15;
  }
  if (analysis?.subjects && analysis.subjects.some((s) => s.prominence === "PRIMARY")) {
    visualWeight += 0.15;
  }
  visualWeight = Math.min(1.0, Math.round(visualWeight * 100) / 100);

  // Crop safety score
  let cropSafety = 0.8;
  if (analysis?.composition?.cropSafety) {
    const cs = analysis.composition.cropSafety;
    cropSafety =
      cs === "SAFE" ? 1.0 : cs === "MODERATE" ? 0.75 : cs === "RISKY" ? 0.4 : 0.6;
  }

  // Subject position
  let subjectPosition: PhotoLayoutProfile["subjectPosition"] = undefined;
  if (analysis?.composition?.subjectPosition) {
    const pos = analysis.composition.subjectPosition;
    if (["LEFT", "CENTER", "RIGHT", "TOP", "BOTTOM"].includes(pos)) {
      subjectPosition = pos as PhotoLayoutProfile["subjectPosition"];
    }
  }

  // Focal point
  const focalPoint = analysis?.composition?.focalPoint
    ? {
        x: Math.max(0, Math.min(1, analysis.composition.focalPoint.x)),
        y: Math.max(0, Math.min(1, analysis.composition.focalPoint.y)),
      }
    : undefined;

  // Determine preferred layout treatments
  const preferredTreatments: PreferredTreatment[] = [];

  if (qualityScore >= 0.85 && orientation === "LANDSCAPE" && cropSafety >= 0.7) {
    preferredTreatments.push("SPREAD");
    preferredTreatments.push("FULL_BLEED");
  }

  if (qualityScore >= 0.75) {
    preferredTreatments.push("HERO");
  }

  if (orientation === "PORTRAIT") {
    preferredTreatments.push("PORTRAIT_FRAME");
  } else if (orientation === "LANDSCAPE") {
    preferredTreatments.push("LANDSCAPE_FRAME");
  }

  if (cropSafety >= 0.7) {
    preferredTreatments.push("CROPPED");
  }

  return {
    assetId,
    orientation,
    aspectRatio,
    widthPx,
    heightPx,
    qualityScore,
    visualWeight,
    focalPoint,
    peopleCount,
    subjectPosition,
    cropSafety,
    preferredTreatments,
  };
}

/**
 * Batch builds layout profiles for a list of photo IDs and analysis records.
 */
export function buildPhotoLayoutProfiles(
  photos: Array<{
    assetId: string;
    asset?: Partial<PhotoAsset>;
    analysis?: Partial<PhotoAnalysis>;
  }>,
): Map<string, PhotoLayoutProfile> {
  const map = new Map<string, PhotoLayoutProfile>();
  for (const item of photos) {
    const profile = buildPhotoLayoutProfile(item.assetId, {
      asset: item.asset,
      analysis: item.analysis,
    });
    map.set(item.assetId, profile);
  }
  return map;
}
