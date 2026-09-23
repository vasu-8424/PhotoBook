import type { BookStyle } from "@/types/book";
import { BOOK_SIZES, DEFAULT_PRINT_SETTINGS } from "@/config/book";
import type { OpenRouterMessage } from "@/lib/ai/types";
import type { EditorialPlan } from "../editorial/types";
import type { PhotoAnalysis } from "../vision/types";
import {
  APPROVED_FONTS,
  APPROVED_FONT_WEIGHTS,
  type DesignPhotoSummary,
  type DesignPlanInput,
  type DesignStyleRules,
} from "./types";

/**
 * Returns structured design rules for the chosen editorial style.
 */
export function getDesignStyleRules(style: BookStyle): DesignStyleRules {
  switch (style) {
    case "EDITORIAL":
      return {
        preferredLayouts: [
          "HERO",
          "FULL_BLEED",
          "EDITORIAL_GRID",
          "PHOTO_TEXT",
          "ASYMMETRIC",
          "SPREAD",
        ],
        maxTextDensity: "MEDIUM",
        preferredWhitespace: "HIGH",
        preferredImageDominance: "HIGH",
        captionStyle: "EDITORIAL",
      };

    case "CINEMATIC":
      return {
        preferredLayouts: [
          "FULL_BLEED",
          "SPREAD",
          "HERO",
          "PHOTO_STRIP",
          "SPLIT",
        ],
        maxTextDensity: "LOW",
        preferredWhitespace: "MEDIUM",
        preferredImageDominance: "HIGH",
        captionStyle: "CINEMATIC",
      };

    case "MINIMAL":
      return {
        preferredLayouts: [
          "HERO",
          "PHOTO_TEXT",
          "FULL_BLEED",
          "ASYMMETRIC",
        ],
        maxTextDensity: "LOW",
        preferredWhitespace: "HIGH",
        preferredImageDominance: "MEDIUM",
        captionStyle: "MINIMAL",
      };

    case "JOURNAL":
      return {
        preferredLayouts: [
          "PHOTO_TEXT",
          "MASONRY",
          "SPLIT",
          "COLLAGE",
          "EDITORIAL_GRID",
          "HERO",
        ],
        maxTextDensity: "HIGH",
        preferredWhitespace: "MEDIUM",
        preferredImageDominance: "MEDIUM",
        captionStyle: "JOURNAL",
      };

    default:
      return {
        preferredLayouts: [
          "HERO",
          "FULL_BLEED",
          "EDITORIAL_GRID",
          "PHOTO_TEXT",
        ],
        maxTextDensity: "MEDIUM",
        preferredWhitespace: "HIGH",
        preferredImageDominance: "HIGH",
        captionStyle: "EDITORIAL",
      };
  }
}

/**
 * Compresses PhotoAnalysis array into compact design summaries to optimize token usage.
 */
export function compressPhotosForDesign(
  photos: PhotoAnalysis[],
  editorialPlan: EditorialPlan,
): DesignPhotoSummary[] {
  const seqMap = new Map(
    editorialPlan.photoSequence.map((p) => [p.photoId, p]),
  );

  return photos.map((p) => {
    const seq = seqMap.get(p.photoId);
    const fp = p.composition.focalPoint;

    // Spread candidate heuristic:
    // Landscape orientation, crop safety is SAFE, and if focal point exists, it is not dangerously centered in the middle gutter fold
    const isSpreadCandidate =
      p.orientation === "LANDSCAPE" &&
      p.composition.cropSafety === "SAFE" &&
      (!fp || Math.abs(fp.x - 0.5) > 0.12);

    return {
      photoId: p.photoId,
      orientation: p.orientation,
      sceneCategory: p.scene.category,
      cropSafety: p.composition.cropSafety,
      focalPoint: fp ? { x: fp.x, y: fp.y } : undefined,
      dominantColors: p.colors.dominant ? p.colors.dominant.slice(0, 2) : ["#1E293B"],
      isSpreadCandidate,
      role: seq?.role,
      sequence: seq?.sequence,
      chapterId: seq?.chapterId,
    };
  });
}

/**
 * Builds the AI Gateway messages for Design AI generation.
 */
export function buildDesignMessages(input: DesignPlanInput): OpenRouterMessage[] {
  const sizeConfig = BOOK_SIZES[input.size] || BOOK_SIZES.A4;
  const printConfig = DEFAULT_PRINT_SETTINGS;
  const styleRules = getDesignStyleRules(input.style);
  const photoSummaries = compressPhotosForDesign(input.photos, input.editorialPlan);

  const docConfig = {
    size: input.size,
    widthMm: sizeConfig.dimensions.width,
    heightMm: sizeConfig.dimensions.height,
    bleedMm: printConfig.bleedMm,
    safeAreaMm: printConfig.safeAreaMm,
    gutterMm: printConfig.gutterMm,
    dpi: printConfig.dpi,
    orientation: input.orientation || sizeConfig.orientation,
  };

  const safeBounds = {
    minX: docConfig.safeAreaMm,
    maxX: docConfig.widthMm - docConfig.safeAreaMm,
    minY: docConfig.safeAreaMm,
    maxY: docConfig.heightMm - docConfig.safeAreaMm,
    safeWidth: docConfig.widthMm - docConfig.safeAreaMm * 2,
    safeHeight: docConfig.heightMm - docConfig.safeAreaMm * 2,
  };

  const systemPrompt = `You are a world-class magazine Art Director generating a canonical Design JSON v1.0.0 for Memory Magazine.
You must transform an EditorialPlan into a beautifully composed, print-safe photo magazine design.

CRITICAL PHYSICAL & GEOMETRIC RULES:
1. PHYSICAL MILLIMETER UNITS ONLY:
   - All page coordinates (xMm, yMm) and dimensions (widthMm, heightMm) MUST be numbers in millimeters (mm).
   - NEVER use pixels, CSS px, percentages, or strings like "100%".
   - Document dimensions are exactly: widthMm = ${docConfig.widthMm}, heightMm = ${docConfig.heightMm}.
   - Bleed: ${docConfig.bleedMm}mm, Safe Area: ${docConfig.safeAreaMm}mm, Gutter: ${docConfig.gutterMm}mm.

2. TEXT MUST REMAIN IN SAFE AREA:
   - For all text elements:
     * xMm >= ${safeBounds.minX}
     * xMm + widthMm <= ${safeBounds.maxX}
     * yMm >= ${safeBounds.minY}
     * yMm + heightMm <= ${safeBounds.maxY}
   - NEVER place titles, captions, or text in the bleed area or margin.

3. APPROVED TYPOGRAPHY ONLY:
   - fontFamily MUST be one of: ${JSON.stringify(APPROVED_FONTS)}
   - fontWeight MUST be one of: ${JSON.stringify(APPROVED_FONT_WEIGHTS)} (400 for regular/body/captions, 700 for titles/headings)
   - fontSizePt MUST be in points (e.g. Cover Title: 32-36pt, Chapter Title: 20-24pt, Section/Page Title: 14-18pt, Captions: 9-11pt, Body: 10-12pt).
   - color MUST be hex '#RRGGBB' (e.g. '#0F172A', '#334155', '#FFFFFF', '#64748B').

4. IMAGE ELEMENTS & BLEED:
   - Full bleed images can extend beyond trim by ${docConfig.bleedMm}mm:
     * xMm: -${docConfig.bleedMm}, yMm: -${docConfig.bleedMm}
     * widthMm: ${docConfig.widthMm + 2 * docConfig.bleedMm}, heightMm: ${docConfig.heightMm + 2 * docConfig.bleedMm}
   - Inset images should sit comfortably within page margins or align with safe area.
   - fit MUST be "COVER", "CONTAIN", or "FILL". Preserve focalPoint from photo metadata when available.

5. ALLOWED LAYOUT TYPES ONLY:
   Use only: "FULL_BLEED", "HERO", "SPLIT", "ASYMMETRIC", "MASONRY", "EDITORIAL_GRID", "PHOTO_STRIP", "PHOTO_TEXT", "COLLAGE", "SPREAD".
   Do NOT invent custom layout names.

6. TWO-PAGE SPREADS:
   - A spread connects leftPageId (page N) and rightPageId (page N+1).
   - Left page MUST immediately precede right page.
   - Both pages MUST use the EXACT SAME assetId (never split image files).
   - Gutter fold is at the binding edge: DO NOT split faces or critical focal points through the center gutter.
   - Use spreads only on photos flagged with isSpreadCandidate=true.

7. STRICT PHOTO INTEGRITY:
   - Every assetId MUST come from the provided photo IDs. NEVER invent photo IDs.
   - Every protected photo ID in protectedPhotoIds MUST appear in the design.
   - Page 1 MUST be the COVER page with a hero image (chosen from coverCandidateIds) and the book title.
   - Page numbering MUST be contiguous integers starting at 1 (1, 2, 3, ... N).
   - All element IDs and page IDs must be unique strings (e.g. "page_1", "el_img_1_1").

8. RHYTHM & PACING:
   - Avoid monotonous repetition (e.g. 5 HERO layouts in a row). Vary visual density: Full Bleed -> Split -> Detail Grid -> Spread -> Photo Text.

OUTPUT FORMAT:
Return a JSON object conforming exactly to this schema:
{
  "schemaVersion": "1.0.0",
  "design": {
    "schemaVersion": "1.0.0",
    "document": {
      "schemaVersion": "1.0.0",
      "size": "${docConfig.size}",
      "widthMm": ${docConfig.widthMm},
      "heightMm": ${docConfig.heightMm},
      "bleedMm": ${docConfig.bleedMm},
      "safeAreaMm": ${docConfig.safeAreaMm},
      "gutterMm": ${docConfig.gutterMm},
      "dpi": ${docConfig.dpi},
      "orientation": "${docConfig.orientation}"
    },
    "pages": [
      {
        "id": "page_1",
        "pageNumber": 1,
        "layoutType": "HERO",
        "elements": [
          {
            "id": "el_1_cover_img",
            "type": "image",
            "assetId": "<photoId>",
            "xMm": 0,
            "yMm": 0,
            "widthMm": ${docConfig.widthMm},
            "heightMm": ${Math.round(docConfig.heightMm * 0.7)},
            "fit": "COVER"
          },
          {
            "id": "el_1_cover_title",
            "type": "text",
            "text": "${input.editorialPlan.title.replace(/"/g, '\\"')}",
            "xMm": ${safeBounds.minX},
            "yMm": ${Math.round(docConfig.heightMm * 0.75)},
            "widthMm": ${safeBounds.safeWidth},
            "heightMm": 25,
            "fontFamily": "Inter",
            "fontWeight": 700,
            "fontSizePt": 32,
            "lineHeight": 1.2,
            "letterSpacingPt": -0.5,
            "color": "#0F172A",
            "align": "center"
          }
        ]
      }
    ],
    "spreads": []
  },
  "rationale": {
    "overall": "High-level summary of the magazine's visual rhythm and design choices",
    "pageDecisions": [
      { "pageId": "page_1", "reason": "Cover layout featuring hero photo with prominent typography" }
    ]
  }
}`;

  const userPayload = {
    bookId: input.bookId,
    occasion: input.occasion,
    style: input.style,
    styleRules,
    documentConfig: docConfig,
    safeBounds,
    editorialPlan: {
      title: input.editorialPlan.title,
      subtitle: input.editorialPlan.subtitle,
      narrativeSummary: input.editorialPlan.narrativeSummary,
      coverCandidateIds: input.editorialPlan.coverCandidateIds,
      openingPhotoId: input.editorialPlan.openingPhotoId,
      closingPhotoId: input.editorialPlan.closingPhotoId,
      pacing: input.editorialPlan.pacing,
      chapters: input.editorialPlan.chapters.map((c) => ({
        id: c.id,
        title: c.title,
        order: c.order,
        photoIds: c.photoIds,
        mood: c.mood,
      })),
      captions: input.editorialPlan.captions,
    },
    photos: photoSummaries,
    protectedPhotoIds: input.protectedPhotoIds || [],
  };

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: `Create a complete magazine design for book "${input.editorialPlan.title}" using the following structured editorial plan and photos:\n\n${JSON.stringify(userPayload, null, 2)}`,
    },
  ];
}
