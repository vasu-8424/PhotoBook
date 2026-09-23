import type { BookOccasion, BookStyle } from "@/types/book";
import type {
  BookDesign,
  BookSize,
  LayoutType,
  PageOrientation,
} from "@/types/design";
import type { PhotoOrientation } from "@/types/photo";
import type { EditorialPlan } from "../editorial/types";
import type { PhotoAnalysis } from "../vision/types";

export const DESIGN_AI_OUTPUT_VERSION = "1.0.0";
export const DESIGN_PROMPT_VERSION = "design-planning-v1";

/**
 * Controlled registry of approved fonts for magazine generation.
 * Print engine supports Inter (weights: 400 Regular, 700 Bold).
 */
export const APPROVED_FONTS: readonly string[] = ["Inter"] as const;
export const APPROVED_FONT_WEIGHTS: readonly number[] = [400, 700] as const;

export interface DesignPlanInput {
  bookId: string;
  occasion: BookOccasion;
  style: BookStyle;
  size: BookSize;
  orientation?: PageOrientation;
  editorialPlan: EditorialPlan;
  photos: PhotoAnalysis[];
  protectedPhotoIds?: string[];
}

export interface DesignStyleRules {
  preferredLayouts: LayoutType[];
  maxTextDensity: "LOW" | "MEDIUM" | "HIGH";
  preferredWhitespace: "LOW" | "MEDIUM" | "HIGH";
  preferredImageDominance: "LOW" | "MEDIUM" | "HIGH";
  captionStyle: "MINIMAL" | "EDITORIAL" | "CINEMATIC" | "JOURNAL";
}

export interface DesignRationale {
  overall?: string;
  pageDecisions?: Array<{
    pageId: string;
    reason: string;
  }>;
}

export interface DesignGenerationResult {
  schemaVersion: "1.0.0";
  design: BookDesign;
  rationale?: DesignRationale;
}

/**
 * Compact photo metadata summary provided to Design AI prompt
 */
export interface DesignPhotoSummary {
  photoId: string;
  orientation: PhotoOrientation;
  sceneCategory: string;
  cropSafety: string;
  focalPoint?: { x: number; y: number };
  dominantColors: string[];
  isSpreadCandidate: boolean;
  role?: string;
  sequence?: number;
  chapterId?: string;
}

/**
 * Design persistence record matching the Supabase designs table
 */
export interface DesignPlanRecord {
  id: string;
  bookId: string;
  userId?: string;
  schemaVersion: string;
  designJson: BookDesign;
  provider: string;
  model: string;
  promptVersion: string;
  inputHash: string;
  outputSchemaVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  createdAt: string;
  updatedAt: string;
}
