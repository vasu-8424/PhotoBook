import type { LayoutTemplate } from "../types";
import {
  createBookPage,
  createImageElement,
  createTextElement,
  getPageBounds,
  roundMm,
} from "./helpers";

export const MAGAZINE_COVER_STYLE: LayoutTemplate = {
  id: "MAGAZINE_COVER_STYLE",
  name: "Magazine Cover Style",
  description: "Striking editorial page with commanding headline, location tag, and full-width imagery.",
  family: "MAGAZINE",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["PORTRAIT", "LANDSCAPE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "MEDIUM",
  canonicalLayoutType: "EDITORIAL_GRID",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const imgH = roundMm(bounds.safeHeightMm * 0.68);
    const imgY = bounds.minSafeY + 28;

    const elements = [
      createTextElement({
        id: `el_${ctx.pageId}_kicker`,
        text: ctx.editorial?.location || "SPECIAL FEATURE",
        xMm: bounds.minSafeX,
        yMm: bounds.minSafeY + 2,
        widthMm: bounds.safeWidthMm,
        heightMm: 6,
        role: "SMALL_LABEL",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_headline`,
        text: ctx.editorial?.headline || "CHRONICLES OF LIGHT",
        xMm: bounds.minSafeX,
        yMm: bounds.minSafeY + 10,
        widthMm: bounds.safeWidthMm,
        heightMm: 16,
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
        id: `el_${ctx.pageId}_caption`,
        text: ctx.editorial?.caption || "A rare glimpse beyond the edge of the ordinary.",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 6,
        widthMm: bounds.safeWidthMm,
        heightMm: 8,
        role: "CAPTION",
        typography: ctx.typography,
        theme: ctx.theme,
        align: "right",
        bounds,
      }),
    ];

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

export const MAGAZINE_FEATURE: LayoutTemplate = {
  id: "MAGAZINE_FEATURE",
  name: "Magazine Feature",
  description: "Classic magazine spread with large hero visual across top and two-column story typography below.",
  family: "MAGAZINE",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["LANDSCAPE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "HIGH",
  canonicalLayoutType: "PHOTO_TEXT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const imgH = roundMm(bounds.safeHeightMm * 0.48);
    const imgY = bounds.minSafeY + 5;
    const textY = imgY + imgH + 10;
    const colGutter = 8;
    const colW = roundMm((bounds.safeWidthMm - colGutter) / 2);

    const elements = [
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
        id: `el_${ctx.pageId}_head`,
        text: ctx.editorial?.headline || "The Journey Forward",
        xMm: bounds.minSafeX,
        yMm: textY,
        widthMm: bounds.safeWidthMm,
        heightMm: 12,
        role: "EDITORIAL_HEADLINE",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_col1`,
        text:
          ctx.editorial?.bodyText ||
          "We set out at first light, before the mist had lifted from the valleys. The road ahead felt like a promise written in stone and sunlight.",
        xMm: bounds.minSafeX,
        yMm: textY + 16,
        widthMm: colW,
        heightMm: 35,
        role: "BODY",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_col2`,
        text:
          ctx.editorial?.caption ||
          "Every corner turned revealed another chapter of landscape, unchanged by time, waiting for those who look closely.",
        xMm: bounds.minSafeX + colW + colGutter,
        yMm: textY + 16,
        widthMm: colW,
        heightMm: 35,
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

export const MAGAZINE_INTERVIEW: LayoutTemplate = {
  id: "MAGAZINE_INTERVIEW",
  name: "Magazine Interview",
  description: "Intimate editorial dialogue layout pairing a portrait with pull-quote and transcribed reflections.",
  family: "MAGAZINE",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["PORTRAIT", "SQUARE"],
  supportsText: true,
  supportsQuote: true,
  supportsSpread: false,
  visualDensity: "MEDIUM",
  canonicalLayoutType: "PHOTO_TEXT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const photoW = roundMm(bounds.safeWidthMm * 0.46);
    const photoH = roundMm(bounds.safeHeightMm * 0.65);
    const textX = bounds.minSafeX + photoW + 10;
    const textW = roundMm(bounds.safeWidthMm - photoW - 10);
    const imgY = bounds.minSafeY + 15;

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId,
        xMm: bounds.minSafeX,
        yMm: imgY,
        widthMm: photoW,
        heightMm: photoH,
        fit: "COVER",
        focalPoint: photo?.focalPoint,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_quote`,
        text: `"${ctx.editorial?.quote || ctx.editorial?.headline || "Memory is an art of selective affection."}"`,
        xMm: textX,
        yMm: imgY + 5,
        widthMm: textW,
        heightMm: 30,
        role: "QUOTE",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_body`,
        text:
          ctx.editorial?.bodyText ||
          "When asked what remained vivid from that week, the answer was immediate: not the grand monuments, but the sound of rain on corrugated zinc.",
        xMm: textX,
        yMm: imgY + 45,
        widthMm: textW,
        heightMm: 45,
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

export const MAGAZINE_QUOTE: LayoutTemplate = {
  id: "MAGAZINE_QUOTE",
  name: "Magazine Pull Quote",
  description: "Dominant editorial pull quote anchoring the top half with an offset intimate photo plate below.",
  family: "MAGAZINE",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["LANDSCAPE", "SQUARE", "PORTRAIT"],
  supportsText: true,
  supportsQuote: true,
  supportsSpread: false,
  visualDensity: "MEDIUM",
  canonicalLayoutType: "PHOTO_TEXT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const quoteY = bounds.minSafeY + 15;
    const quoteH = 32;
    const imgY = quoteY + quoteH + 15;
    const imgW = roundMm(bounds.safeWidthMm * 0.85);
    const imgH = roundMm(bounds.safeHeightMm * 0.52);
    const imgX = bounds.minSafeX + (bounds.safeWidthMm - imgW) / 2;

    const elements = [
      createTextElement({
        id: `el_${ctx.pageId}_quote`,
        text: `"${ctx.editorial?.quote || ctx.editorial?.headline || "We do not remember days; we remember moments."}"`,
        xMm: bounds.minSafeX,
        yMm: quoteY,
        widthMm: bounds.safeWidthMm,
        heightMm: quoteH,
        role: "QUOTE",
        typography: ctx.typography,
        theme: ctx.theme,
        align: "center",
        bounds,
      }),
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
        id: `el_${ctx.pageId}_author`,
        text: ctx.editorial?.caption || "CESARE PAVESE",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 8,
        widthMm: bounds.safeWidthMm,
        heightMm: 8,
        role: "SMALL_LABEL",
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

export const MAGAZINE_CAPTION: LayoutTemplate = {
  id: "MAGAZINE_CAPTION",
  name: "Magazine Caption Plate",
  description: "Full-width photo plate paired with an architectural, structured side caption block.",
  family: "MAGAZINE",
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

    const imgH = roundMm(bounds.safeHeightMm * 0.66);
    const imgY = bounds.minSafeY + 10;

    const elements = [
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
        id: `el_${ctx.pageId}_no`,
        text: `PLATE ${ctx.pageNumber < 10 ? "0" + ctx.pageNumber : ctx.pageNumber}`,
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 10,
        widthMm: 35,
        heightMm: 8,
        role: "SMALL_LABEL",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_desc`,
        text:
          ctx.editorial?.caption ||
          ctx.editorial?.headline ||
          "Photographed on location. Natural light, early autumn stillness.",
        xMm: bounds.minSafeX + 40,
        yMm: imgY + imgH + 10,
        widthMm: roundMm(bounds.safeWidthMm - 40),
        heightMm: 16,
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
          layoutType: "PHOTO_TEXT",
          elements,
        }),
      ],
    };
  },
};

export const MAGAZINE_TEMPLATES = [
  MAGAZINE_COVER_STYLE,
  MAGAZINE_FEATURE,
  MAGAZINE_INTERVIEW,
  MAGAZINE_QUOTE,
  MAGAZINE_CAPTION,
];
