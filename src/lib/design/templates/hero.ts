import type { DesignElement } from "@/types/design";
import type { LayoutTemplate } from "../types";
import {
  createBookPage,
  createImageElement,
  createTextElement,
  getPageBounds,
} from "./helpers";

export const HERO_FULL_BLEED: LayoutTemplate = {
  id: "HERO_FULL_BLEED",
  name: "Hero Full Bleed",
  description: "Maximum cinematic impact where photograph extends to all 4 edges with full bleed.",
  family: "HERO",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["LANDSCAPE", "PORTRAIT"],
  supportsText: false,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "LOW",
  canonicalLayoutType: "FULL_BLEED",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId,
        xMm: -bounds.bleedMm,
        yMm: -bounds.bleedMm,
        widthMm: bounds.widthMm + bounds.bleedMm * 2,
        heightMm: bounds.heightMm + bounds.bleedMm * 2,
        fit: "COVER",
        focalPoint: photo?.focalPoint,
      }),
    ];

    return {
      pages: [
        createBookPage({
          id: ctx.pageId,
          pageNumber: ctx.pageNumber,
          layoutType: "FULL_BLEED",
          elements,
        }),
      ],
    };
  },
};

export const HERO_LANDSCAPE: LayoutTemplate = {
  id: "HERO_LANDSCAPE",
  name: "Hero Landscape",
  description: "Generous landscape photo anchored within elegant editorial margins.",
  family: "HERO",
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

    const imgX = bounds.minSafeX;
    const imgY = bounds.minSafeY + 15;
    const imgW = bounds.safeWidthMm;
    const imgH = bounds.safeHeightMm * 0.72;

    const elements: DesignElement[] = [
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
    ];

    if (ctx.editorial?.caption || ctx.editorial?.headline) {
      elements.push(
        createTextElement({
          id: `el_${ctx.pageId}_caption`,
          text: ctx.editorial.caption || ctx.editorial.headline || "A moment captured in time.",
          xMm: bounds.minSafeX,
          yMm: imgY + imgH + 8,
          widthMm: bounds.safeWidthMm,
          heightMm: 12,
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

export const HERO_PORTRAIT: LayoutTemplate = {
  id: "HERO_PORTRAIT",
  name: "Hero Portrait",
  description: "Large vertical portrait framed with refined breathing room.",
  family: "HERO",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["PORTRAIT"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "LOW",
  canonicalLayoutType: "HERO",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const imgW = bounds.safeWidthMm * 0.85;
    const imgH = bounds.safeHeightMm * 0.85;
    const imgX = bounds.minSafeX + (bounds.safeWidthMm - imgW) / 2;
    const imgY = bounds.minSafeY + 5;

    const elements: DesignElement[] = [
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
    ];

    if (ctx.editorial?.caption || ctx.editorial?.location) {
      elements.push(
        createTextElement({
          id: `el_${ctx.pageId}_caption`,
          text: ctx.editorial.caption || ctx.editorial.location || "Captured in timeless stillness.",
          xMm: bounds.minSafeX,
          yMm: imgY + imgH + 6,
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
          layoutType: "HERO",
          elements,
        }),
      ],
    };
  },
};

export const HERO_WITH_CAPTION: LayoutTemplate = {
  id: "HERO_WITH_CAPTION",
  name: "Hero With Caption",
  description: "Substantial focal image with structured editorial headline and two-line caption below.",
  family: "HERO",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["LANDSCAPE", "PORTRAIT"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "MEDIUM",
  canonicalLayoutType: "HERO",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const imgX = bounds.minSafeX;
    const imgY = bounds.minSafeY + 10;
    const imgW = bounds.safeWidthMm;
    const imgH = bounds.safeHeightMm * 0.65;

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
        text: ctx.editorial?.headline || "Moments that linger",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 10,
        widthMm: bounds.safeWidthMm,
        heightMm: 12,
        role: "EDITORIAL_HEADLINE",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_caption`,
        text:
          ctx.editorial?.caption ||
          ctx.editorial?.bodyText ||
          "Light filtering across the horizon, revealing the quiet poetry of everyday life.",
        xMm: bounds.minSafeX,
        yMm: imgY + imgH + 24,
        widthMm: bounds.safeWidthMm * 0.85,
        heightMm: 16,
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
          layoutType: "HERO",
          elements,
        }),
      ],
    };
  },
};

export const HERO_WITH_BOTTOM_LABEL: LayoutTemplate = {
  id: "HERO_WITH_BOTTOM_LABEL",
  name: "Hero With Bottom Label",
  description: "Dramatic hero with minimalist tracked location / date label at the bottom safe boundary.",
  family: "HERO",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["LANDSCAPE", "SQUARE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "LOW",
  canonicalLayoutType: "HERO",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const imgX = bounds.minSafeX;
    const imgY = bounds.minSafeY + 5;
    const imgW = bounds.safeWidthMm;
    const imgH = bounds.safeHeightMm * 0.8;

    const labelText = [ctx.editorial?.location, ctx.editorial?.date]
      .filter(Boolean)
      .join(" · ") || "DOCUMENTARY ARCHIVE";

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
        text: labelText,
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

export const HERO_TEMPLATES = [
  HERO_FULL_BLEED,
  HERO_LANDSCAPE,
  HERO_PORTRAIT,
  HERO_WITH_CAPTION,
  HERO_WITH_BOTTOM_LABEL,
];
