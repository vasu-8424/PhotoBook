import { z } from "zod";
import { DESIGN_SCHEMA_VERSION, type BookDesign } from "@/types/design";
import type { SchemaValidator } from "@/lib/ai/types";
import type { DesignGenerationResult } from "./types";

export const PointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const ImageElementSchema = z.object({
  id: z.preprocess((val) => (typeof val === "string" && val.length > 0 ? val : `el_img_${Math.random().toString(36).slice(2, 8)}`), z.string().min(1)),
  type: z.literal("image"),
  assetId: z.string().min(1),
  xMm: z.number(),
  yMm: z.number(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  fit: z.preprocess((val) => {
    if (typeof val === "string") {
      const upper = val.toUpperCase();
      if (upper === "COVER" || upper === "CONTAIN" || upper === "FILL") return upper;
    }
    return "COVER";
  }, z.enum(["COVER", "CONTAIN", "FILL"]).default("COVER")),
  focalPoint: PointSchema.optional(),
  rotation: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
});

export const TextElementSchema = z.object({
  id: z.preprocess((val) => (typeof val === "string" && val.length > 0 ? val : `el_txt_${Math.random().toString(36).slice(2, 8)}`), z.string().min(1)),
  type: z.literal("text"),
  text: z.string().min(1),
  xMm: z.number(),
  yMm: z.number(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  fontFamily: z.preprocess((val) => (typeof val === "string" && val.length > 0 ? val : "Inter"), z.string().default("Inter")),
  fontWeight: z.preprocess((val) => {
    if (typeof val === "number" && val > 0) return val >= 600 ? 700 : 400;
    if (val === "bold") return 700;
    return 400;
  }, z.number().positive().default(400)),
  fontSizePt: z.preprocess((val) => (typeof val === "number" && val > 0 ? val : 12), z.number().positive().default(12)),
  lineHeight: z.preprocess((val) => (typeof val === "number" && val > 0 ? val : 1.2), z.number().positive().default(1.2)),
  letterSpacingPt: z.preprocess((val) => (typeof val === "number" ? val : 0), z.number().default(0)),
  color: z.preprocess((val) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
      if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
        return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
      }
    }
    return "#0F172A";
  }, z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be hex format '#RRGGBB'").default("#0F172A")),
  align: z.preprocess((val) => {
    if (typeof val === "string") {
      const lower = val.toLowerCase();
      if (lower === "center" || lower === "right") return lower;
    }
    return "left";
  }, z.enum(["left", "center", "right"]).default("left")),
  rotation: z.number().optional(),
});

export const ShapeElementSchema = z.object({
  id: z.preprocess((val) => (typeof val === "string" && val.length > 0 ? val : `el_shp_${Math.random().toString(36).slice(2, 8)}`), z.string().min(1)),
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
  id: z.preprocess((val) => (typeof val === "string" && val.length > 0 ? val : `page_${Math.random().toString(36).slice(2, 8)}`), z.string().min(1)),
  pageNumber: z.number().int().positive(),
  layoutType: z.preprocess((val) => {
    if (typeof val === "string") {
      const upper = val.toUpperCase().replace(/\s+/g, "_");
      const valid = [
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
      ];
      if (valid.includes(upper)) return upper;
    }
    return "EDITORIAL_GRID";
  }, z.enum([
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
  ]).default("EDITORIAL_GRID")),
  elements: z.array(DesignElementSchema),
});

export const BookSpreadSchema = z.object({
  id: z.preprocess((val) => (typeof val === "string" && val.length > 0 ? val : `spread_${Math.random().toString(36).slice(2, 8)}`), z.string().min(1)),
  leftPageId: z.string().min(1),
  rightPageId: z.string().min(1),
  assetId: z.string().min(1).optional(),
  focalPoint: PointSchema.optional(),
  fit: z.preprocess((val) => {
    if (typeof val === "string") {
      const upper = val.toUpperCase();
      if (upper === "COVER" || upper === "CONTAIN" || upper === "FILL") return upper;
    }
    return undefined;
  }, z.enum(["COVER", "CONTAIN", "FILL"]).optional()),
});

export const BookDocumentSchema = z.object({
  schemaVersion: z.preprocess((val) => (typeof val === "string" ? val : DESIGN_SCHEMA_VERSION), z.string().default(DESIGN_SCHEMA_VERSION)),
  size: z.preprocess((val) => {
    if (typeof val === "string") {
      const upper = val.toUpperCase();
      if (["A4", "SQUARE_210", "A5", "LETTER", "CUSTOM"].includes(upper)) return upper;
    }
    return "A4";
  }, z.enum(["A4", "SQUARE_210", "A5", "LETTER", "CUSTOM"]).default("A4")),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  bleedMm: z.preprocess((val) => (typeof val === "number" ? val : 3), z.number().min(0).default(3)),
  safeAreaMm: z.preprocess((val) => (typeof val === "number" ? val : 10), z.number().min(0).default(10)),
  gutterMm: z.preprocess((val) => (typeof val === "number" ? val : 5), z.number().min(0).default(5)),
  dpi: z.preprocess((val) => (typeof val === "number" ? val : 300), z.number().positive().default(300)),
  orientation: z.preprocess((val) => {
    if (typeof val === "string") {
      const upper = val.toUpperCase();
      if (["PORTRAIT", "LANDSCAPE", "SQUARE"].includes(upper)) return upper;
    }
    return "PORTRAIT";
  }, z.enum(["PORTRAIT", "LANDSCAPE", "SQUARE"]).default("PORTRAIT")),
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

