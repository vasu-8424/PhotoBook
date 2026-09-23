import { z } from "zod";
import type { PhotoAnalysis } from "./types";
import type { SchemaValidator } from "@/lib/ai/types";

export const SceneSchema = z.object({
  category: z.enum([
    "TRAVEL",
    "NATURE",
    "CITY",
    "INDOOR",
    "OUTDOOR",
    "FOOD",
    "EVENT",
    "PORTRAIT",
    "ARCHITECTURE",
    "SPORT",
    "FAMILY",
    "COUPLE",
    "OTHER",
  ]),
  description: z.string().min(1),
  environment: z.string().optional(),
  timeOfDay: z
    .enum(["MORNING", "AFTERNOON", "EVENING", "NIGHT", "UNKNOWN"])
    .optional(),
});

export const SubjectSchema = z.object({
  type: z.enum([
    "PERSON",
    "ANIMAL",
    "VEHICLE",
    "BUILDING",
    "FOOD",
    "LANDSCAPE",
    "OBJECT",
    "OTHER",
  ]),
  count: z.number().int().min(0),
  prominence: z.enum(["PRIMARY", "SECONDARY", "BACKGROUND"]),
  description: z.string(),
});

export const NormalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const CompositionSchema = z.object({
  subjectPosition: z.enum([
    "LEFT",
    "CENTER",
    "RIGHT",
    "TOP",
    "BOTTOM",
    "MULTIPLE",
    "UNCLEAR",
  ]),
  balance: z.enum([
    "BALANCED",
    "LEFT_HEAVY",
    "RIGHT_HEAVY",
    "CENTERED",
    "ASYMMETRIC",
    "UNCLEAR",
  ]),
  negativeSpace: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]),
  depth: z.enum(["FLAT", "MODERATE", "DEEP", "UNCLEAR"]),
  cropSafety: z.enum(["SAFE", "MODERATE", "RISKY", "UNKNOWN"]),
  focalPoint: NormalizedPointSchema.optional(),
});

export const VisualQualitySchema = z.object({
  overall: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR"]),
  sharpness: z.enum(["SHARP", "ACCEPTABLE", "SOFT", "BLURRY"]),
  exposure: z.enum(["GOOD", "DARK", "BRIGHT", "MIXED"]),
  composition: z.enum(["STRONG", "ACCEPTABLE", "WEAK"]),
  usableForPrint: z.enum(["YES", "MAYBE", "NO"]),
  confidence: z.number().min(0).max(1),
});

export const ColorSchema = z.object({
  dominant: z.array(z.string()),
  mood: z.enum([
    "WARM",
    "COOL",
    "NEUTRAL",
    "VIBRANT",
    "MUTED",
    "DARK",
    "BRIGHT",
    "MIXED",
  ]),
});

export const LocationClueSchema = z.object({
  clue: z.string().min(1),
  type: z.enum([
    "LANDMARK",
    "SIGN",
    "ENVIRONMENT",
    "LANGUAGE",
    "ARCHITECTURE",
    "OTHER",
  ]),
  confidence: z.number().min(0).max(1),
});

export const OccasionClueSchema = z.object({
  occasion: z.enum([
    "TRAVEL",
    "PERSONAL_MEMORIES",
    "BIRTHDAY",
    "WEDDING",
    "FESTIVAL",
    "FAMILY",
    "GRADUATION",
    "COUPLE",
    "BABY",
    "OTHER",
  ]),
  evidence: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const AnalysisConfidenceSchema = z.object({
  overall: z.number().min(0).max(1),
  scene: z.number().min(0).max(1),
  subjects: z.number().min(0).max(1),
  composition: z.number().min(0).max(1),
  location: z.number().min(0).max(1),
  occasion: z.number().min(0).max(1),
});

export const PhotoAnalysisSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  photoId: z.string().min(1),
  orientation: z.enum(["PORTRAIT", "LANDSCAPE", "SQUARE"]),
  visualDescription: z.string().min(1),
  scene: SceneSchema,
  subjects: z.array(SubjectSchema),
  peopleCount: z.number().int().min(0),
  composition: CompositionSchema,
  visualQuality: VisualQualitySchema,
  colors: ColorSchema,
  textDetected: z.boolean(),
  textSummary: z.string().optional(),
  locationClues: z.array(LocationClueSchema),
  occasionClues: z.array(OccasionClueSchema),
  tags: z.array(z.string()).min(1),
  confidence: AnalysisConfidenceSchema,
});

/**
 * Validates raw JSON output against PhotoAnalysisSchema v1.0.0.
 * Conforms to SchemaValidator<T> interface from AI Gateway.
 */
export const validatePhotoAnalysis: SchemaValidator<PhotoAnalysis> = (
  data: unknown,
) => {
  const result = PhotoAnalysisSchema.safeParse(data);
  if (result.success) {
    return {
      valid: true,
      data: result.data as PhotoAnalysis,
    };
  }

  const issues = result.error?.issues ?? [];
  const formattedErrors = issues
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join("; ");

  return {
    valid: false,
    error: `PhotoAnalysis validation failed: ${formattedErrors}`,
  };
};
