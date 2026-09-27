import type { DesignElement } from "@/types/design";
import type { LayoutTemplate } from "../types";
import {
  createBookPage,
  createImageElement,
  createTextElement,
  getPageBounds,
  roundMm,
} from "./helpers";

export const TWO_PORTRAITS: LayoutTemplate = {
  id: "TWO_PORTRAITS",
  name: "Two Portraits",
  description: "Balanced twin vertical portrait composition side-by-side with an intentional rhythm.",
  family: "PORTRAIT",
  minPhotos: 2,
  maxPhotos: 2,
  preferredOrientations: ["PORTRAIT", "SQUARE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "MEDIUM",
  canonicalLayoutType: "SPLIT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const gutter = 8;
    const colWidth = roundMm((bounds.safeWidthMm - gutter) / 2);
    const imgHeight = roundMm(bounds.safeHeightMm * 0.78);
    const imgY = bounds.minSafeY + 12;

    const p0 = ctx.photos[0];
    const p1 = ctx.photos[1] || ctx.photos[0];

    const elements: DesignElement[] = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId: p0.assetId,
        xMm: bounds.minSafeX,
        yMm: imgY,
        widthMm: colWidth,
        heightMm: imgHeight,
        fit: "COVER",
        focalPoint: p0.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_1`,
        assetId: p1.assetId,
        xMm: bounds.minSafeX + colWidth + gutter,
        yMm: imgY,
        widthMm: colWidth,
        heightMm: imgHeight,
        fit: "COVER",
        focalPoint: p1.focalPoint,
      }),
    ];

    if (ctx.editorial?.caption || ctx.editorial?.headline) {
      elements.push(
        createTextElement({
          id: `el_${ctx.pageId}_caption`,
          text: ctx.editorial.caption || ctx.editorial.headline || "Parallel perspectives.",
          xMm: bounds.minSafeX,
          yMm: imgY + imgHeight + 8,
          widthMm: bounds.safeWidthMm,
          heightMm: 10,
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
          layoutType: "SPLIT",
          elements,
        }),
      ],
    };
  },
};

export const THREE_PORTRAITS: LayoutTemplate = {
  id: "THREE_PORTRAITS",
  name: "Three Portraits",
  description: "Triptych of three vertical portraits marching rhythmically across the page.",
  family: "PORTRAIT",
  minPhotos: 3,
  maxPhotos: 3,
  preferredOrientations: ["PORTRAIT"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "HIGH",
  canonicalLayoutType: "EDITORIAL_GRID",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const gutter = 6;
    const colWidth = roundMm((bounds.safeWidthMm - gutter * 2) / 3);
    const imgHeight = roundMm(bounds.safeHeightMm * 0.72);
    const imgY = bounds.minSafeY + 15;

    const p0 = ctx.photos[0];
    const p1 = ctx.photos[1] || p0;
    const p2 = ctx.photos[2] || p0;

    const elements: DesignElement[] = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId: p0.assetId,
        xMm: bounds.minSafeX,
        yMm: imgY,
        widthMm: colWidth,
        heightMm: imgHeight,
        fit: "COVER",
        focalPoint: p0.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_1`,
        assetId: p1.assetId,
        xMm: bounds.minSafeX + colWidth + gutter,
        yMm: imgY,
        widthMm: colWidth,
        heightMm: imgHeight,
        fit: "COVER",
        focalPoint: p1.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_2`,
        assetId: p2.assetId,
        xMm: bounds.minSafeX + (colWidth + gutter) * 2,
        yMm: imgY,
        widthMm: colWidth,
        heightMm: imgHeight,
        fit: "COVER",
        focalPoint: p2.focalPoint,
      }),
    ];

    if (ctx.editorial?.caption || ctx.editorial?.headline) {
      elements.push(
        createTextElement({
          id: `el_${ctx.pageId}_caption`,
          text: ctx.editorial.caption || ctx.editorial.headline || "A sequential character study.",
          xMm: bounds.minSafeX,
          yMm: imgY + imgHeight + 8,
          widthMm: bounds.safeWidthMm,
          heightMm: 10,
          role: "CAPTION",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
          bounds,
        }),
      );
    }

    return {
      pages: [
        createBookPage({
          id: ctx.pageId,
          pageNumber: ctx.pageNumber,
          layoutType: "EDITORIAL_GRID",
          elements,
        }),
      ],
    };
  },
};

export const PORTRAIT_WITH_TEXT: LayoutTemplate = {
  id: "PORTRAIT_WITH_TEXT",
  name: "Portrait With Text",
  description: "Asymmetrical editorial spread with a dominant portrait on one side and a refined typographic story column on the other.",
  family: "PORTRAIT",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["PORTRAIT"],
  supportsText: true,
  supportsQuote: true,
  supportsSpread: false,
  visualDensity: "MEDIUM",
  canonicalLayoutType: "PHOTO_TEXT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const gutter = 12;
    const photoWidth = roundMm(bounds.safeWidthMm * 0.55);
    const textWidth = roundMm(bounds.safeWidthMm - photoWidth - gutter);
    const imgHeight = roundMm(bounds.safeHeightMm * 0.85);
    const imgY = bounds.minSafeY + 10;

    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId,
        xMm: bounds.minSafeX,
        yMm: imgY,
        widthMm: photoWidth,
        heightMm: imgHeight,
        fit: "COVER",
        focalPoint: photo?.focalPoint,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_head`,
        text: ctx.editorial?.headline || "A Quieter Rhythm",
        xMm: bounds.minSafeX + photoWidth + gutter,
        yMm: imgY + 10,
        widthMm: textWidth,
        heightMm: 22,
        role: "EDITORIAL_HEADLINE",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_body`,
        text:
          ctx.editorial?.bodyText ||
          "There are places where time slows to the cadence of the breeze. We paused here, noting how the shadows grew longer with each passing thought.",
        xMm: bounds.minSafeX + photoWidth + gutter,
        yMm: imgY + 38,
        widthMm: textWidth,
        heightMm: 45,
        role: "BODY",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
    ];

    if (ctx.editorial?.quote) {
      elements.push(
        createTextElement({
          id: `el_${ctx.pageId}_quote`,
          text: `"${ctx.editorial.quote}"`,
          xMm: bounds.minSafeX + photoWidth + gutter,
          yMm: imgY + 90,
          widthMm: textWidth,
          heightMm: 25,
          role: "QUOTE",
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
          layoutType: "PHOTO_TEXT",
          elements,
        }),
      ],
    };
  },
};

export const PORTRAIT_OFFSET: LayoutTemplate = {
  id: "PORTRAIT_OFFSET",
  name: "Portrait Offset",
  description: "Delicate offset portrait surrounded by asymmetrical negative space.",
  family: "PORTRAIT",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["PORTRAIT"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "LOW",
  canonicalLayoutType: "ASYMMETRIC",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const imgW = roundMm(bounds.safeWidthMm * 0.7);
    const imgH = roundMm(bounds.safeHeightMm * 0.72);
    const imgX = bounds.minSafeX + roundMm(bounds.safeWidthMm * 0.25);
    const imgY = bounds.minSafeY + 15;

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
        id: `el_${ctx.pageId}_label`,
        text: ctx.editorial?.location || "ARCHIVAL NOTE",
        xMm: bounds.minSafeX,
        yMm: imgY + 10,
        widthMm: roundMm(bounds.safeWidthMm * 0.2),
        heightMm: 8,
        role: "SMALL_LABEL",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_caption`,
        text: ctx.editorial?.caption || "The interplay of light, gesture, and shadow.",
        xMm: bounds.minSafeX,
        yMm: imgY + 25,
        widthMm: roundMm(bounds.safeWidthMm * 0.2),
        heightMm: 25,
        role: "CAPTION",
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
          layoutType: "ASYMMETRIC",
          elements,
        }),
      ],
    };
  },
};

export const PORTRAIT_EDITORIAL: LayoutTemplate = {
  id: "PORTRAIT_EDITORIAL",
  name: "Portrait Editorial",
  description: "High-end fashion editorial format with portrait centered and structured headline/lead paragraph below.",
  family: "PORTRAIT",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["PORTRAIT"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "MEDIUM",
  canonicalLayoutType: "PHOTO_TEXT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const imgW = roundMm(bounds.safeWidthMm * 0.75);
    const imgH = roundMm(bounds.safeHeightMm * 0.6);
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
        id: `el_${ctx.pageId}_head`,
        text: ctx.editorial?.headline || "PORTRAIT OF AN AFTERNOON",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 10,
        widthMm: bounds.safeWidthMm,
        heightMm: 12,
        role: "EDITORIAL_HEADLINE",
        typography: ctx.typography,
        theme: ctx.theme,
        align: "center",
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_caption`,
        text:
          ctx.editorial?.bodyText ||
          ctx.editorial?.caption ||
          "Moments captured not for what was spoken, but for what remained suspended in the quiet.",
        xMm: bounds.minSafeX + roundMm(bounds.safeWidthMm * 0.1),
        yMm: imgY + imgH + 24,
        widthMm: roundMm(bounds.safeWidthMm * 0.8),
        heightMm: 16,
        role: "BODY",
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

export const PORTRAIT_TEMPLATES = [
  TWO_PORTRAITS,
  THREE_PORTRAITS,
  PORTRAIT_WITH_TEXT,
  PORTRAIT_OFFSET,
  PORTRAIT_EDITORIAL,
];
