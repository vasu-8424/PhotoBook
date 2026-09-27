import type { BookSpread } from "@/types/design";
import type { LayoutTemplate } from "../types";
import {
  createBookPage,
  createImageElement,
  createTextElement,
  getPageBounds,
  roundMm,
} from "./helpers";

export const FULL_SPREAD: LayoutTemplate = {
  id: "FULL_SPREAD",
  name: "Full Bleed Panoramic Spread",
  description: "Breathtaking panoramic photograph stretching seamlessly across both left and right pages with full bleed.",
  family: "SPREAD",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["LANDSCAPE"],
  supportsText: false,
  supportsQuote: false,
  supportsSpread: true,
  visualDensity: "LOW",
  canonicalLayoutType: "SPREAD",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    // Safe focal point avoiding central gutter fold [0.46, 0.54]
    const fp = photo?.focalPoint ? { ...photo.focalPoint } : undefined;
    if (fp && fp.x > 0.46 && fp.x < 0.54) {
      fp.x = fp.x <= 0.5 ? 0.45 : 0.55;
    }

    const leftPageId = ctx.spreadContext?.leftPageId || ctx.pageId;
    const rightPageId =
      ctx.spreadContext?.rightPageId || `${ctx.pageId}_right`;
    const rightPageNum = ctx.pageNumber + 1;

    // Per-page element bounds within allowable document limits
    const leftElements = [
      createImageElement({
        id: `el_${leftPageId}_spread_left`,
        assetId,
        xMm: -bounds.bleedMm,
        yMm: -bounds.bleedMm,
        widthMm: bounds.widthMm + bounds.bleedMm,
        heightMm: bounds.heightMm + bounds.bleedMm * 2,
        fit: "COVER",
        focalPoint: fp,
      }),
    ];

    const rightElements = [
      createImageElement({
        id: `el_${rightPageId}_spread_right`,
        assetId,
        xMm: 0,
        yMm: -bounds.bleedMm,
        widthMm: bounds.widthMm + bounds.bleedMm,
        heightMm: bounds.heightMm + bounds.bleedMm * 2,
        fit: "COVER",
        focalPoint: fp,
      }),
    ];

    const leftPage = createBookPage({
      id: leftPageId,
      pageNumber: ctx.pageNumber,
      layoutType: "SPREAD",
      elements: leftElements,
    });

    const rightPage = createBookPage({
      id: rightPageId,
      pageNumber: rightPageNum,
      layoutType: "SPREAD",
      elements: rightElements,
    });

    const spreadRecord: BookSpread = {
      id: `spd_${leftPageId}_${rightPageId}`,
      leftPageId,
      rightPageId,
      assetId,
      fit: "COVER",
      focalPoint: fp,
    };

    return {
      pages: [leftPage, rightPage],
      spreads: [spreadRecord],
    };
  },
};

export const LANDSCAPE_SPREAD: LayoutTemplate = {
  id: "LANDSCAPE_SPREAD",
  name: "Landscape Editorial Spread",
  description: "Panoramic landscape spanning across both pages with top and bottom margins, leaving room for a caption.",
  family: "SPREAD",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["LANDSCAPE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: true,
  visualDensity: "MEDIUM",
  canonicalLayoutType: "SPREAD",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const fp = photo?.focalPoint ? { ...photo.focalPoint } : undefined;
    if (fp && fp.x > 0.46 && fp.x < 0.54) {
      fp.x = fp.x <= 0.5 ? 0.45 : 0.55;
    }

    const leftPageId = ctx.spreadContext?.leftPageId || ctx.pageId;
    const rightPageId =
      ctx.spreadContext?.rightPageId || `${ctx.pageId}_right`;
    const rightPageNum = ctx.pageNumber + 1;

    const imgY = bounds.minSafeY + 15;
    const imgH = roundMm(bounds.safeHeightMm * 0.72);

    const leftElements = [
      createImageElement({
        id: `el_${leftPageId}_spread_img`,
        assetId,
        xMm: bounds.minSafeX,
        yMm: imgY,
        widthMm: bounds.widthMm - bounds.minSafeX,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: fp,
      }),
    ];

    const rightElements = [
      createImageElement({
        id: `el_${rightPageId}_spread_img`,
        assetId,
        xMm: 0,
        yMm: imgY,
        widthMm: bounds.safeWidthMm,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: fp,
      }),
      createTextElement({
        id: `el_${rightPageId}_caption`,
        text:
          ctx.editorial?.caption ||
          ctx.editorial?.location ||
          "A panoramic horizon stretching into the quiet afternoon.",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 8,
        widthMm: bounds.safeWidthMm,
        heightMm: 10,
        role: "CAPTION",
        typography: ctx.typography,
        theme: ctx.theme,
        align: "right",
        bounds,
      }),
    ];

    const leftPage = createBookPage({
      id: leftPageId,
      pageNumber: ctx.pageNumber,
      layoutType: "SPREAD",
      elements: leftElements,
    });

    const rightPage = createBookPage({
      id: rightPageId,
      pageNumber: rightPageNum,
      layoutType: "SPREAD",
      elements: rightElements,
    });

    const spreadRecord: BookSpread = {
      id: `spd_${leftPageId}_${rightPageId}`,
      leftPageId,
      rightPageId,
      assetId,
      fit: "COVER",
      focalPoint: fp,
    };

    return {
      pages: [leftPage, rightPage],
      spreads: [spreadRecord],
    };
  },
};

export const CINEMATIC_SPREAD: LayoutTemplate = {
  id: "CINEMATIC_SPREAD",
  name: "Cinematic Letterbox Spread",
  description: "Ultra-widescreen letterbox image centered across both pages with dramatic top/bottom negative space.",
  family: "SPREAD",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["LANDSCAPE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: true,
  visualDensity: "LOW",
  canonicalLayoutType: "SPREAD",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const fp = photo?.focalPoint ? { ...photo.focalPoint } : undefined;
    if (fp && fp.x > 0.46 && fp.x < 0.54) {
      fp.x = fp.x <= 0.5 ? 0.45 : 0.55;
    }

    const leftPageId = ctx.spreadContext?.leftPageId || ctx.pageId;
    const rightPageId =
      ctx.spreadContext?.rightPageId || `${ctx.pageId}_right`;
    const rightPageNum = ctx.pageNumber + 1;

    const imgH = roundMm(bounds.safeHeightMm * 0.55);
    const imgY = bounds.minSafeY + (bounds.safeHeightMm - imgH) / 2;

    const leftElements = [
      createImageElement({
        id: `el_${leftPageId}_spread_left`,
        assetId,
        xMm: -bounds.bleedMm,
        yMm: imgY,
        widthMm: bounds.widthMm + bounds.bleedMm,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: fp,
      }),
    ];

    const rightElements = [
      createImageElement({
        id: `el_${rightPageId}_spread_right`,
        assetId,
        xMm: 0,
        yMm: imgY,
        widthMm: bounds.widthMm + bounds.bleedMm,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: fp,
      }),
      createTextElement({
        id: `el_${rightPageId}_label`,
        text: ctx.editorial?.location || "CINEMA SCOPE 2.39:1",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 10,
        widthMm: bounds.safeWidthMm,
        heightMm: 8,
        role: "SMALL_LABEL",
        typography: ctx.typography,
        theme: ctx.theme,
        align: "right",
        bounds,
      }),
    ];

    const leftPage = createBookPage({
      id: leftPageId,
      pageNumber: ctx.pageNumber,
      layoutType: "SPREAD",
      elements: leftElements,
    });

    const rightPage = createBookPage({
      id: rightPageId,
      pageNumber: rightPageNum,
      layoutType: "SPREAD",
      elements: rightElements,
    });

    const spreadRecord: BookSpread = {
      id: `spd_${leftPageId}_${rightPageId}`,
      leftPageId,
      rightPageId,
      assetId,
      fit: "COVER",
      focalPoint: fp,
    };

    return {
      pages: [leftPage, rightPage],
      spreads: [spreadRecord],
    };
  },
};

export const SPREAD_TEMPLATES = [
  FULL_SPREAD,
  LANDSCAPE_SPREAD,
  CINEMATIC_SPREAD,
];
