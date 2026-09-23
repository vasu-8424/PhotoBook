import type {
  AnalysisConfidence,
  CompositionAnalysis,
  VisualQualityAnalysis,
} from "./types";

export interface ConfidenceAssessment {
  isHighConfidence: boolean;
  isLowConfidence: boolean;
  flaggedAreas: string[];
  averageConfidence: number;
}

export interface PrintAdvisory {
  usableForPrint: "YES" | "MAYBE" | "NO";
  isAdvisoryOnly: true;
  recommendation: string;
}

/**
 * Assesses the confidence signals from the analysis.
 * Identifies areas with weak model confidence (< 0.6).
 */
export function assessAnalysisConfidence(
  confidence: AnalysisConfidence,
): ConfidenceAssessment {
  const scores: Array<[string, number]> = [
    ["scene", confidence.scene],
    ["subjects", confidence.subjects],
    ["composition", confidence.composition],
    ["location", confidence.location],
    ["occasion", confidence.occasion],
  ];

  const flaggedAreas = scores
    .filter(([, score]) => score < 0.6)
    .map(([area]) => area);

  const averageConfidence =
    scores.reduce((sum, [, score]) => sum + score, 0) / scores.length;

  return {
    isHighConfidence: confidence.overall >= 0.8 && flaggedAreas.length === 0,
    isLowConfidence: confidence.overall < 0.6 || flaggedAreas.length >= 2,
    flaggedAreas,
    averageConfidence: Math.round(averageConfidence * 100) / 100,
  };
}

/**
 * Returns advisory print guidance based on AI visual quality.
 * NOTE: Per Section 14, visual quality is strictly advisory metadata and
 * must NEVER automatically delete or reject a user's photo.
 */
export function getPrintAdvisory(
  quality: VisualQualityAnalysis,
): PrintAdvisory {
  if (quality.usableForPrint === "YES" && quality.overall !== "POOR") {
    return {
      usableForPrint: "YES",
      isAdvisoryOnly: true,
      recommendation: "Visual quality appears well-suited for print placement.",
    };
  }

  if (quality.usableForPrint === "NO" || quality.overall === "POOR") {
    return {
      usableForPrint: "NO",
      isAdvisoryOnly: true,
      recommendation:
        "AI detected potential softness or exposure limitations. Recommend pairing with smaller layouts or verifying print DPI.",
    };
  }

  return {
    usableForPrint: "MAYBE",
    isAdvisoryOnly: true,
    recommendation:
      "Visual quality is acceptable for standard layout placement.",
  };
}

/**
 * Checks if cropping may pose a risk to main subjects.
 */
export function isCropRisky(composition: CompositionAnalysis): boolean {
  return (
    composition.cropSafety === "RISKY" ||
    composition.negativeSpace === "NONE" ||
    composition.subjectPosition === "MULTIPLE"
  );
}
