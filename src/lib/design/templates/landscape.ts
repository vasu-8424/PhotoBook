import type { DesignElement } from "@/types/design";
import type { LayoutTemplate } from "../types";
import {
  createBookPage,
  createImageElement,
  createTextElement,
  getPageBounds,
  roundMm,
} from "./helpers";

export const LANDSCAPE_FULL: LayoutTemplate = {
  id: "LANDSCAPE_FULL",
  name: "Landscape Full Bleed Horizontal",
  description: "Wide landscape photograph bleeding across left and right edges with top and bottom breathing room.",
  family: "LANDSCAPE",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["LANDSCAPE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "LOW",
  canonicalLayoutType: "HERO",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const imgY = bounds.minSafeY + 20;
    const imgHeight = roundMm(bounds.widthMm * 0.65);

    const elements: DesignElement[] = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId,
        xMm: -bounds.bleedMm,
        yMm: imgY,
        widthMm: bounds.widthMm + bounds.bleedMm * 2,
        heightMm: imgHeight,
        fit: "COVER",
        focalPoint: photo?.focalPoint,
      }),
    ];

    if (ctx.editorial?.caption || ctx.editorial?.location) {
      elements.push(
        createTextElement({
          id: `el_${ctx.pageId}_caption`,
          text: ctx.editorial.caption || ctx.editorial.location || "Vast expanses, quiet wonder.",
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
          layoutType: "HERO",
          elements,
        }),
      ],
    };
  },
};

export const LANDSCAPE_WITH_TEXT: LayoutTemplate = {
  id: "LANDSCAPE_WITH_TEXT",
  name: "Landscape With Text",
  description: "Horizontal photo anchored at top with a substantial editorial headline and narrative below.",
  family: "LANDSCAPE",
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

    const imgH = roundMm(bounds.safeHeightMm * 0.52);
    const imgY = bounds.minSafeY + 5;

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
        text: ctx.editorial?.headline || "Horizons in Transition",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 12,
        widthMm: bounds.safeWidthMm,
        heightMm: 14,
        role: "EDITORIAL_HEADLINE",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_body`,
        text:
          ctx.editorial?.bodyText ||
          ctx.editorial?.caption ||
          "Traveling through open terrain changes how one measures distance. The horizon ceases to be a destination and becomes an ongoing companion.",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 30,
        widthMm: roundMm(bounds.safeWidthMm * 0.88),
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

export const LANDSCAPE_STACK: LayoutTemplate = {
  id: "LANDSCAPE_STACK",
  name: "Landscape Stack",
  description: "Two stacked horizontal landscapes forming an eye-level editorial comparison.",
  family: "LANDSCAPE",
  minPhotos: 2,
  maxPhotos: 2,
  preferredOrientations: ["LANDSCAPE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "MEDIUM",
  canonicalLayoutType: "SPLIT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const gutter = 8;
    const imgH = roundMm((bounds.safeHeightMm - gutter - 24) / 2);
    const imgY0 = bounds.minSafeY + 5;
    const imgY1 = imgY0 + imgH + gutter;

    const p0 = ctx.photos[0];
    const p1 = ctx.photos[1] || p0;

    const elements: DesignElement[] = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId: p0.assetId,
        xMm: bounds.minSafeX,
        yMm: imgY0,
        widthMm: bounds.safeWidthMm,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: p0.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_1`,
        assetId: p1.assetId,
        xMm: bounds.minSafeX,
        yMm: imgY1,
        widthMm: bounds.safeWidthMm,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: p1.focalPoint,
      }),
    ];

    if (ctx.editorial?.caption || ctx.editorial?.headline) {
      elements.push(
        createTextElement({
          id: `el_${ctx.pageId}_caption`,
          text: ctx.editorial.caption || ctx.editorial.headline || "Twin moments along the trail.",
          xMm: bounds.minSafeX,
          yMm: imgY1 + imgH + 6,
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

export const LANDSCAPE_TRIPTYCH: LayoutTemplate = {
  id: "LANDSCAPE_TRIPTYCH",
  name: "Landscape Triptych",
  description: "Three slender stacked panoramic ribbons showcasing panoramic sequence or motion.",
  family: "LANDSCAPE",
  minPhotos: 3,
  maxPhotos: 3,
  preferredOrientations: ["LANDSCAPE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "HIGH",
  canonicalLayoutType: "EDITORIAL_GRID",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const gutter = 6;
    const imgH = roundMm((bounds.safeHeightMm - gutter * 2 - 20) / 3);
    const y0 = bounds.minSafeY + 5;

    const p0 = ctx.photos[0];
    const p1 = ctx.photos[1] || p0;
    const p2 = ctx.photos[2] || p0;

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId: p0.assetId,
        xMm: bounds.minSafeX,
        yMm: y0,
        widthMm: bounds.safeWidthMm,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: p0.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_1`,
        assetId: p1.assetId,
        xMm: bounds.minSafeX,
        yMm: y0 + imgH + gutter,
        widthMm: bounds.safeWidthMm,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: p1.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_2`,
        assetId: p2.assetId,
        xMm: bounds.minSafeX,
        yMm: y0 + (imgH + gutter) * 2,
        widthMm: bounds.safeWidthMm,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: p2.focalPoint,
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

export const LANDSCAPE_CINEMATIC: LayoutTemplate = {
  id: "LANDSCAPE_CINEMATIC",
  name: "Landscape Cinematic",
  description: "Letterbox wide aspect photo framed against dark backdrop with delicate tracking label.",
  family: "LANDSCAPE",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["LANDSCAPE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "LOW",
  canonicalLayoutType: "HERO",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const imgW = bounds.safeWidthMm;
    const imgH = roundMm(imgW / 2.1); // ~2.1:1 panoramic ratio
    const imgY = bounds.minSafeY + roundMm((bounds.safeHeightMm - imgH) / 2) - 10;

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId,
        xMm: bounds.minSafeX,
        yMm: imgY,
        widthMm: imgW,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: photo?.focalPoint,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_meta`,
        text: ctx.editorial?.location || "CINEMATOGRAPHIC ARCHIVE",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 12,
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
          layoutType: "HERO",
          elements,
        }),
      ],
    };
  },
};

export const LANDSCAPE_TEMPLATES = [
  LANDSCAPE_FULL,
  LANDSCAPE_WITH_TEXT,
  LANDSCAPE_STACK,
  LANDSCAPE_TRIPTYCH,
  LANDSCAPE_CINEMATIC,
];
