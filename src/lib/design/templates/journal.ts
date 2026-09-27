import type { DesignElement } from "@/types/design";
import type { LayoutTemplate } from "../types";
import {
  createBookPage,
  createImageElement,
  createTextElement,
  getPageBounds,
  roundMm,
} from "./helpers";

export const JOURNAL_STRIP: LayoutTemplate = {
  id: "JOURNAL_STRIP",
  name: "Journal Photo Strip",
  description: "Vertical filmstrip of three sequential moments aligned with explorer diary notes.",
  family: "JOURNAL",
  minPhotos: 3,
  maxPhotos: 3,
  preferredOrientations: ["LANDSCAPE", "SQUARE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "HIGH",
  canonicalLayoutType: "PHOTO_STRIP",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const gutter = 6;
    const stripW = roundMm(bounds.safeWidthMm * 0.52);
    const noteW = roundMm(bounds.safeWidthMm - stripW - 12);
    const photoH = roundMm((bounds.safeHeightMm - gutter * 2 - 20) / 3);
    const startY = bounds.minSafeY + 10;

    const p0 = ctx.photos[0];
    const p1 = ctx.photos[1] || p0;
    const p2 = ctx.photos[2] || p0;

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId: p0.assetId,
        xMm: bounds.minSafeX,
        yMm: startY,
        widthMm: stripW,
        heightMm: photoH,
        fit: "COVER",
        focalPoint: p0.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_1`,
        assetId: p1.assetId,
        xMm: bounds.minSafeX,
        yMm: startY + photoH + gutter,
        widthMm: stripW,
        heightMm: photoH,
        fit: "COVER",
        focalPoint: p1.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_2`,
        assetId: p2.assetId,
        xMm: bounds.minSafeX,
        yMm: startY + (photoH + gutter) * 2,
        widthMm: stripW,
        heightMm: photoH,
        fit: "COVER",
        focalPoint: p2.focalPoint,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_date`,
        text: ctx.editorial?.date || "OCTOBER 14",
        xMm: bounds.minSafeX + stripW + 12,
        yMm: startY + 5,
        widthMm: noteW,
        heightMm: 8,
        role: "SMALL_LABEL",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_headline`,
        text: ctx.editorial?.headline || "Field Notes",
        xMm: bounds.minSafeX + stripW + 12,
        yMm: startY + 15,
        widthMm: noteW,
        heightMm: 14,
        role: "EDITORIAL_HEADLINE",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_notes`,
        text:
          ctx.editorial?.bodyText ||
          ctx.editorial?.caption ||
          "A quiet sequence recorded along the mountain pass. The fog moved quickly through the pines, softening every line.",
        xMm: bounds.minSafeX + stripW + 12,
        yMm: startY + 34,
        widthMm: noteW,
        heightMm: 50,
        role: "BODY",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
    ];

    return {
      pages: [
        createBookPage({
          id: ctx.pageId,
          pageNumber: ctx.pageNumber,
          layoutType: "PHOTO_STRIP",
          elements,
        }),
      ],
    };
  },
};

export const JOURNAL_NOTE: LayoutTemplate = {
  id: "JOURNAL_NOTE",
  name: "Journal Note",
  description: "Archival notebook composition featuring a centered photo plate with reflective field memo.",
  family: "JOURNAL",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["LANDSCAPE", "SQUARE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "MEDIUM",
  canonicalLayoutType: "PHOTO_TEXT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const imgW = roundMm(bounds.safeWidthMm * 0.85);
    const imgH = roundMm(bounds.safeHeightMm * 0.55);
    const imgX = bounds.minSafeX + (bounds.safeWidthMm - imgW) / 2;
    const imgY = bounds.minSafeY + 10;

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId,
        xMm: imgX,
        yMm: imgY,
        widthMm: imgW,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: photo?.focalPoint,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_date`,
        text: ctx.editorial?.date || "ENTRY NO. 07",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 12,
        widthMm: bounds.safeWidthMm,
        heightMm: 8,
        role: "SMALL_LABEL",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_note`,
        text:
          ctx.editorial?.bodyText ||
          ctx.editorial?.caption ||
          "We paused here by the stone wall. The wind carried the faint scent of woodsmoke from the valley below.",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 22,
        widthMm: roundMm(bounds.safeWidthMm * 0.9),
        heightMm: 25,
        role: "BODY",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
    ];

    return {
      pages: [
        createBookPage({
          id: ctx.pageId,
          pageNumber: ctx.pageNumber,
          layoutType: "PHOTO_TEXT",
          elements,
        }),
      ],
    };
  },
};

export const JOURNAL_POLAROID: LayoutTemplate = {
  id: "JOURNAL_POLAROID",
  name: "Journal Polaroid",
  description: "Classic instant photograph frame with wide bottom border and handwritten-style caption.",
  family: "JOURNAL",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["SQUARE", "PORTRAIT"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "LOW",
  canonicalLayoutType: "PHOTO_TEXT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    // White polaroid container dimensions
    const polaroidW = roundMm(bounds.safeWidthMm * 0.82);
    const photoInnerW = roundMm(polaroidW * 0.88);
    const photoInnerH = roundMm(photoInnerW * 1.0); // Square photo window
    const polaroidH = roundMm(photoInnerH + 35); // Generous bottom chin

    const polaroidX = bounds.minSafeX + (bounds.safeWidthMm - polaroidW) / 2;
    const polaroidY = bounds.minSafeY + (bounds.safeHeightMm - polaroidH) / 2 - 5;
    const photoX = polaroidX + (polaroidW - photoInnerW) / 2;
    const photoY = polaroidY + (polaroidW - photoInnerW) / 2;

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId,
        xMm: photoX,
        yMm: photoY,
        widthMm: photoInnerW,
        heightMm: photoInnerH,
        fit: "COVER",
        focalPoint: photo?.focalPoint,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_caption`,
        text: ctx.editorial?.caption || ctx.editorial?.location || "Unforgettable afternoon in the sun",
        xMm: photoX,
        yMm: photoY + photoInnerH + 8,
        widthMm: photoInnerW,
        heightMm: 12,
        role: "CAPTION",
        typography: ctx.typography,
        theme: ctx.theme,
        align: "center",
        bounds,
      }),
    ];

    return {
      pages: [
        createBookPage({
          id: ctx.pageId,
          pageNumber: ctx.pageNumber,
          layoutType: "PHOTO_TEXT",
          elements,
        }),
      ],
    };
  },
};

export const JOURNAL_COLLAGE: LayoutTemplate = {
  id: "JOURNAL_COLLAGE",
  name: "Journal Collage",
  description: "Casual explorer scrapbook collage with three varied photo placements and organic margins.",
  family: "JOURNAL",
  minPhotos: 3,
  maxPhotos: 3,
  preferredOrientations: ["PORTRAIT", "LANDSCAPE", "SQUARE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "HIGH",
  canonicalLayoutType: "COLLAGE",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const p0 = ctx.photos[0];
    const p1 = ctx.photos[1] || p0;
    const p2 = ctx.photos[2] || p0;

    const w1 = roundMm(bounds.safeWidthMm * 0.6);
    const h1 = roundMm(bounds.safeHeightMm * 0.48);

    const w2 = roundMm(bounds.safeWidthMm * 0.48);
    const h2 = roundMm(bounds.safeHeightMm * 0.35);

    const w3 = roundMm(bounds.safeWidthMm * 0.44);
    const h3 = roundMm(bounds.safeHeightMm * 0.35);

    const elements: DesignElement[] = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId: p0.assetId,
        xMm: bounds.minSafeX,
        yMm: bounds.minSafeY + 5,
        widthMm: w1,
        heightMm: h1,
        fit: "COVER",
        focalPoint: p0.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_1`,
        assetId: p1.assetId,
        xMm: bounds.maxSafeX - w2,
        yMm: bounds.minSafeY + 18,
        widthMm: w2,
        heightMm: h2,
        fit: "COVER",
        focalPoint: p1.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_2`,
        assetId: p2.assetId,
        xMm: bounds.minSafeX + 10,
        yMm: bounds.maxSafeY - h3 - 10,
        widthMm: w3,
        heightMm: h3,
        fit: "COVER",
        focalPoint: p2.focalPoint,
      }),
    ];

    if (ctx.editorial?.caption) {
      elements.push(
        createTextElement({
          id: `el_${ctx.pageId}_caption`,
          text: ctx.editorial.caption,
          xMm: bounds.maxSafeX - w2,
          yMm: bounds.maxSafeY - 25,
          widthMm: w2,
          heightMm: 15,
          role: "CAPTION",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
      );
    }

    return {
      pages: [
        createBookPage({
          id: ctx.pageId,
          pageNumber: ctx.pageNumber,
          layoutType: "COLLAGE",
          elements,
        }),
      ],
    };
  },
};

export const JOURNAL_DATE: LayoutTemplate = {
  id: "JOURNAL_DATE",
  name: "Journal Date Header",
  description: "Date-stamped archival log entry with bold chronological stamp over landscape visual.",
  family: "JOURNAL",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["LANDSCAPE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "MEDIUM",
  canonicalLayoutType: "PHOTO_TEXT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const dateStr = ctx.editorial?.date || "SEPTEMBER 2026";
    const imgH = roundMm(bounds.safeHeightMm * 0.62);
    const imgY = bounds.minSafeY + 22;

    const elements = [
      createTextElement({
        id: `el_${ctx.pageId}_date_head`,
        text: dateStr,
        xMm: bounds.minSafeX,
        yMm: bounds.minSafeY + 5,
        widthMm: bounds.safeWidthMm,
        heightMm: 12,
        role: "EDITORIAL_HEADLINE",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId,
        xMm: bounds.minSafeX,
        yMm: imgY,
        widthMm: bounds.safeWidthMm,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: photo?.focalPoint,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_loc`,
        text: ctx.editorial?.location || "FIELD STATION LOG",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 8,
        widthMm: bounds.safeWidthMm,
        heightMm: 8,
        role: "SMALL_LABEL",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
    ];

    return {
      pages: [
        createBookPage({
          id: ctx.pageId,
          pageNumber: ctx.pageNumber,
          layoutType: "PHOTO_TEXT",
          elements,
        }),
      ],
    };
  },
};

export const JOURNAL_TEMPLATES = [
  JOURNAL_STRIP,
  JOURNAL_NOTE,
  JOURNAL_POLAROID,
  JOURNAL_COLLAGE,
  JOURNAL_DATE,
];
