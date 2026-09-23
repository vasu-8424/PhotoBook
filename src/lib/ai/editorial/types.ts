import type { BookOccasion, BookStyle } from "@/types/book";
import type { PhotoOrientation } from "@/types/photo";
import type { PhotoAnalysis } from "../vision/types";

export const EDITORIAL_SCHEMA_VERSION = "1.0.0";

export type EditorialPhotoRole =
  | "OPENING"
  | "HERO"
  | "ESTABLISHING"
  | "MOMENT"
  | "DETAIL"
  | "PORTRAIT"
  | "TRANSITION"
  | "CLOSING"
  | "SUPPORTING";

export interface EditorialPhoto {
  photoId: string;
  sequence: number;
  chapterId: string;
  role: EditorialPhotoRole;
  importance: number;
  transitionReason?: string;
}

export interface EditorialChapter {
  id: string;
  title: string;
  summary: string;
  photoIds: string[];
  order: number;
  mood?: string;
  transitionIn?: string;
  transitionOut?: string;
}

export interface EditorialCaption {
  photoId: string;
  text: string;
  style: "DESCRIPTIVE" | "EDITORIAL" | "MINIMAL" | "JOURNAL";
  confidence: number;
}

export interface EditorialPacing {
  opening: "SLOW" | "MODERATE" | "IMMEDIATE";
  middle: "SLOW" | "MODERATE" | "FAST";
  ending: "QUIET" | "REFLECTIVE" | "ENERGETIC";
  rhythm: "CALM" | "BALANCED" | "DYNAMIC";
}

export interface EditorialConfidence {
  overall: number;
  narrative: number;
  grouping: number;
  pacing: number;
  captions: number;
}

export interface EditorialPhotoDisposition {
  photoId: string;
  included: boolean;
  reason?: string;
}

export interface EditorialPlan {
  schemaVersion: "1.0.0";
  bookId: string;
  title: string;
  subtitle?: string;
  narrativeSummary: string;
  chapters: EditorialChapter[];
  photoSequence: EditorialPhoto[];
  coverCandidateIds: string[];
  openingPhotoId?: string;
  closingPhotoId?: string;
  pacing: EditorialPacing;
  captions: EditorialCaption[];
  editorialNotes: string[];
  confidence: EditorialConfidence;
  titleCandidates?: string[];
  photoDispositions?: EditorialPhotoDisposition[];
}

export interface EditorialInput {
  bookId: string;
  occasion: BookOccasion;
  style: BookStyle;
  title?: string;
  photos: PhotoAnalysis[];
  protectedPhotoIds?: string[];
}

/**
 * Compact summary of PhotoAnalysis used in prompts to minimize input tokens
 */
export interface EditorialPhotoSummary {
  photoId: string;
  orientation: PhotoOrientation;
  description: string;
  scene: string;
  timeOfDay?: string;
  subjects: string[];
  peopleCount: number;
  focalPoint?: { x: number; y: number };
  cropSafety: string;
  quality: string;
  dominantColors: string[];
  colorMood: string;
  locationClues: string[];
  occasionClues: string[];
  tags: string[];
}

export interface EditorialPlanRecord {
  id: string;
  bookId: string;
  userId?: string;
  schemaVersion: "1.0.0";
  planJson: EditorialPlan;
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
