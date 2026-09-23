import { z } from "zod";
import { DESIGN_SCHEMA_VERSION, type BookDesign } from "@/types/design";
import type { SchemaValidator } from "@/lib/ai/types";
import type { DesignGenerationResult } from "./types";

export const PointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const ImageElementSchema = z.object({
  id: z.string().min(1),
  type: z.literal("image"),
  assetId: z.string().min(1),
  xMm: z.number(),
  yMm: z.number(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  fit: z.enum(["COVER", "CONTAIN", "FILL"]),
  focalPoint: PointSchema.optional(),
  rotation: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
});

export const TextElementSchema = z.object({
  id: z.string().min(1),
  type: z.literal("text"),
  text: z.string().min(1),
  xMm: z.number(),
  yMm: z.number(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  fontFamily: z.string().min(1),
  fontWeight: z.number().positive(),
  fontSizePt: z.number().positive(),
  lineHeight: z.number().positive(),
  letterSpacingPt: z.number(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be hex format '#RRGGBB'"),
  align: z.enum(["left", "center", "right"]),
  rotation: z.number().optional(),
});

export const ShapeElementSchema = z.object({
  id: z.string().min(1),
  type: z.literal("shape"),
  shape: z.enum(["rectangle", "line", "circle"]),
  xMm: z.number(),
  yMm: z.number(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  fill: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  stroke: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  strokeWidthMm: z.number().min(0).optional(),
});

export const DesignElementSchema = z.discriminatedUnion("type", [
  ImageElementSchema,
  TextElementSchema,
  ShapeElementSchema,
]);

export const BookPageSchema = z.object({
  id: z.string().min(1),
  pageNumber: z.number().int().positive(),
  layoutType: z.enum([
    "FULL_BLEED",
    "HERO",
    "SPLIT",
    "ASYMMETRIC",
    "MASONRY",
    "EDITORIAL_GRID",
    "PHOTO_STRIP",
    "PHOTO_TEXT",
    "COLLAGE",
    "SPREAD",
  ]),
  elements: z.array(DesignElementSchema),
});

export const BookSpreadSchema = z.object({
  id: z.string().min(1),
  leftPageId: z.string().min(1),
  rightPageId: z.string().min(1),
  assetId: z.string().min(1).optional(),
  focalPoint: PointSchema.optional(),
  fit: z.enum(["COVER", "CONTAIN", "FILL"]).optional(),
});

export const BookDocumentSchema = z.object({
  schemaVersion: z.string(),
  size: z.enum(["A4", "SQUARE_210", "A5", "LETTER", "CUSTOM"]),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  bleedMm: z.number().min(0),
  safeAreaMm: z.number().min(0),
  gutterMm: z.number().min(0),
  dpi: z.number().positive(),
  orientation: z.enum(["PORTRAIT", "LANDSCAPE", "SQUARE"]),
});

export const BookDesignSchema = z.object({
  schemaVersion: z.literal(DESIGN_SCHEMA_VERSION),
  document: BookDocumentSchema,
  pages: z.array(BookPageSchema).min(1),
  spreads: z.array(BookSpreadSchema),
});

export const DesignRationaleSchema = z.object({
  overall: z.string().optional(),
  pageDecisions: z
    .array(
      z.object({
        pageId: z.string(),
        reason: z.string(),
      }),
    )
    .optional(),
});

export const DesignGenerationResultSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  design: BookDesignSchema,
  rationale: DesignRationaleSchema.optional(),
});

/**
 * Validates and parses raw AI output into a strictly checked DesignGenerationResult.
 * Conforms to SchemaValidator<DesignGenerationResult> interface.
 * Handles both wrapped { schemaVersion, design, rationale } and direct { document, pages, spreads } responses.
 */
export const validateDesignGenerationResultSchema: SchemaValidator<DesignGenerationResult> = (
  raw: unknown,
) => {
  if (!raw || typeof raw !== "object") {
    return {
      valid: false,
      error: "Design output must be a valid JSON object.",
    };
  }

  const obj = raw as Record<string, unknown>;

  // If the model returned direct BookDesign without outer wrapper:
  if (obj.document && Array.isArray(obj.pages)) {
    const parsedDesign = BookDesignSchema.safeParse(obj);
    if (!parsedDesign.success) {
      const formattedErrors = parsedDesign.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return {
        valid: false,
        error: `Direct BookDesign failed schema validation: ${formattedErrors}`,
      };
    }
    return {
      valid: true,
      data: {
        schemaVersion: "1.0.0",
        design: parsedDesign.data as BookDesign,
      },
    };
  }

  // Standard wrapped DesignGenerationResult
  const parsed = DesignGenerationResultSchema.safeParse(obj);
  if (!parsed.success) {
    const formattedErrors = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      valid: false,
      error: `Design AI output failed schema validation: ${formattedErrors}`,
    };
  }

  return {
    valid: true,
    data: parsed.data as DesignGenerationResult,
  };
};

