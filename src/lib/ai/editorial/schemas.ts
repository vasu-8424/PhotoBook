import { z } from "zod";
import type { EditorialPlan } from "./types";
import type { SchemaValidator } from "@/lib/ai/types";

export const EditorialPhotoRoleSchema = z.enum([
  "OPENING",
  "HERO",
  "ESTABLISHING",
  "MOMENT",
  "DETAIL",
  "PORTRAIT",
  "TRANSITION",
  "CLOSING",
  "SUPPORTING",
]);

export const EditorialPhotoSchema = z.object({
  photoId: z.string().min(1),
  sequence: z.number().int().min(1),
  chapterId: z.string().min(1),
  role: EditorialPhotoRoleSchema,
  importance: z.number().min(0).max(1),
  transitionReason: z.string().optional(),
});

export const EditorialChapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  photoIds: z.array(z.string().min(1)).min(1), // Every chapter must contain at least 1 photo
  order: z.number().int().min(1),
  mood: z.string().optional(),
  transitionIn: z.string().optional(),
  transitionOut: z.string().optional(),
});

export const EditorialCaptionSchema = z.object({
  photoId: z.string().min(1),
  text: z.string().min(1),
  style: z.enum(["DESCRIPTIVE", "EDITORIAL", "MINIMAL", "JOURNAL"]),
  confidence: z.number().min(0).max(1),
});

export const EditorialPacingSchema = z.object({
  opening: z.enum(["SLOW", "MODERATE", "IMMEDIATE"]),
  middle: z.enum(["SLOW", "MODERATE", "FAST"]),
  ending: z.enum(["QUIET", "REFLECTIVE", "ENERGETIC"]),
  rhythm: z.enum(["CALM", "BALANCED", "DYNAMIC"]),
});

export const EditorialConfidenceSchema = z.object({
  overall: z.number().min(0).max(1),
  narrative: z.number().min(0).max(1),
  grouping: z.number().min(0).max(1),
  pacing: z.number().min(0).max(1),
  captions: z.number().min(0).max(1),
});

export const EditorialPhotoDispositionSchema = z.object({
  photoId: z.string().min(1),
  included: z.boolean(),
  reason: z.string().optional(),
});

export const EditorialPlanSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  bookId: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  narrativeSummary: z.string().min(1),
  chapters: z.array(EditorialChapterSchema).min(1),
  photoSequence: z.array(EditorialPhotoSchema).min(1),
  coverCandidateIds: z.array(z.string().min(1)).min(1),
  openingPhotoId: z.string().min(1).optional(),
  closingPhotoId: z.string().min(1).optional(),
  pacing: EditorialPacingSchema,
  captions: z.array(EditorialCaptionSchema),
  editorialNotes: z.array(z.string()),
  confidence: EditorialConfidenceSchema,
  titleCandidates: z.array(z.string()).optional(),
  photoDispositions: z.array(EditorialPhotoDispositionSchema).optional(),
});

/**
 * Validates raw JSON output against EditorialPlanSchema v1.0.0.
 * Conforms to SchemaValidator<EditorialPlan> interface.
 */
export const validateEditorialPlanSchema: SchemaValidator<EditorialPlan> = (
  data: unknown,
) => {
  const result = EditorialPlanSchema.safeParse(data);
  if (result.success) {
    return {
      valid: true,
      data: result.data as EditorialPlan,
    };
  }

  const issues = result.error?.issues ?? [];
  const formattedErrors = issues
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join("; ");

  return {
    valid: false,
    error: `EditorialPlan validation failed: ${formattedErrors}`,
  };
};
