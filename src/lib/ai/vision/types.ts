import type { PhotoOrientation } from "@/types/photo";

export type SceneCategory =
  | "TRAVEL"
  | "NATURE"
  | "CITY"
  | "INDOOR"
  | "OUTDOOR"
  | "FOOD"
  | "EVENT"
  | "PORTRAIT"
  | "ARCHITECTURE"
  | "SPORT"
  | "FAMILY"
  | "COUPLE"
  | "OTHER";

export type TimeOfDay =
  | "MORNING"
  | "AFTERNOON"
  | "EVENING"
  | "NIGHT"
  | "UNKNOWN";

export interface SceneAnalysis {
  category: SceneCategory;
  description: string;
  environment?: string;
  timeOfDay?: TimeOfDay;
}

export type SubjectType =
  | "PERSON"
  | "ANIMAL"
  | "VEHICLE"
  | "BUILDING"
  | "FOOD"
  | "LANDSCAPE"
  | "OBJECT"
  | "OTHER";

export type SubjectProminence =
  | "PRIMARY"
  | "SECONDARY"
  | "BACKGROUND";

export interface SubjectAnalysis {
  type: SubjectType;
  count: number;
  prominence: SubjectProminence;
  description: string;
}

export type SubjectPosition =
  | "LEFT"
  | "CENTER"
  | "RIGHT"
  | "TOP"
  | "BOTTOM"
  | "MULTIPLE"
  | "UNCLEAR";

export type CompositionBalance =
  | "BALANCED"
  | "LEFT_HEAVY"
  | "RIGHT_HEAVY"
  | "CENTERED"
  | "ASYMMETRIC"
  | "UNCLEAR";

export type NegativeSpaceAmount =
  | "NONE"
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export type DepthLevel =
  | "FLAT"
  | "MODERATE"
  | "DEEP"
  | "UNCLEAR";

export type CropSafetyLevel =
  | "SAFE"
  | "MODERATE"
  | "RISKY"
  | "UNKNOWN";

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface CompositionAnalysis {
  subjectPosition: SubjectPosition;
  balance: CompositionBalance;
  negativeSpace: NegativeSpaceAmount;
  depth: DepthLevel;
  cropSafety: CropSafetyLevel;
  focalPoint?: NormalizedPoint;
}

export type OverallQuality = "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
export type SharpnessLevel = "SHARP" | "ACCEPTABLE" | "SOFT" | "BLURRY";
export type ExposureLevel = "GOOD" | "DARK" | "BRIGHT" | "MIXED";
export type CompositionQuality = "STRONG" | "ACCEPTABLE" | "WEAK";
export type PrintSuitability = "YES" | "MAYBE" | "NO";

export interface VisualQualityAnalysis {
  overall: OverallQuality;
  sharpness: SharpnessLevel;
  exposure: ExposureLevel;
  composition: CompositionQuality;
  usableForPrint: PrintSuitability;
  confidence: number;
}

export type ColorMood =
  | "WARM"
  | "COOL"
  | "NEUTRAL"
  | "VIBRANT"
  | "MUTED"
  | "DARK"
  | "BRIGHT"
  | "MIXED";

export interface ColorAnalysis {
  dominant: string[];
  mood: ColorMood;
}

export type LocationClueType =
  | "LANDMARK"
  | "SIGN"
  | "ENVIRONMENT"
  | "LANGUAGE"
  | "ARCHITECTURE"
  | "OTHER";

export interface LocationClue {
  clue: string;
  type: LocationClueType;
  confidence: number;
}

export type OccasionType =
  | "TRAVEL"
  | "PERSONAL_MEMORIES"
  | "BIRTHDAY"
  | "WEDDING"
  | "FESTIVAL"
  | "FAMILY"
  | "GRADUATION"
  | "COUPLE"
  | "BABY"
  | "OTHER";

export interface OccasionClue {
  occasion: OccasionType;
  evidence: string;
  confidence: number;
}

export interface AnalysisConfidence {
  overall: number;
  scene: number;
  subjects: number;
  composition: number;
  location: number;
  occasion: number;
}

export interface PhotoAnalysis {
  schemaVersion: "1.0.0";
  photoId: string;
  orientation: PhotoOrientation;
  visualDescription: string;
  scene: SceneAnalysis;
  subjects: SubjectAnalysis[];
  peopleCount: number;
  composition: CompositionAnalysis;
  visualQuality: VisualQualityAnalysis;
  colors: ColorAnalysis;
  textDetected: boolean;
  textSummary?: string;
  locationClues: LocationClue[];
  occasionClues: OccasionClue[];
  tags: string[];
  confidence: AnalysisConfidence;
}

export type PhotoAnalysisStatus =
  | "NOT_ANALYZED"
  | "ANALYZING"
  | "ANALYZED"
  | "FAILED";

export interface AnalyzePhotoInput {
  photoId: string;
  bookId: string;
  aiDerivativeUrl: string;
}

export interface AnalyzePhotoOptions {
  bypassCache?: boolean;
}

export interface PhotoAnalysisRecord {
  id: string;
  photoId: string;
  bookId: string;
  userId?: string;
  schemaVersion: "1.0.0";
  analysisJson: PhotoAnalysis;
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

export interface SinglePhotoAnalysisResult {
  photoId: string;
  status: PhotoAnalysisStatus;
  analysis?: PhotoAnalysis;
  error?: string;
  fromCache?: boolean;
  actualModel?: string;
}

export interface BatchAnalysisResult {
  total: number;
  succeeded: number;
  failed: number;
  results: SinglePhotoAnalysisResult[];
}
