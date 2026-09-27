import type { LayoutTemplate } from "../types";
import {
  createBookPage,
  createImageElement,
  createTextElement,
  getPageBounds,
  roundMm,
} from "./helpers";

export const MINIMAL_ONE_PHOTO: LayoutTemplate = {
  id: "MINIMAL_ONE_PHOTO",
  name: "Minimal One Photo",
  description: "One quiet photograph floating inside generous, meditative white margins.",
  family: "MINIMAL",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["PORTRAIT", "LANDSCAPE", "SQUARE"],
  supportsText: false,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "LOW",
  canonicalLayoutType: "HERO",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const imgW = roundMm(bounds.safeWidthMm * 0.75);
    const imgH = roundMm(bounds.safeHeightMm * 0.65);
    const imgX = bounds.minSafeX + (bounds.safeWidthMm - imgW) / 2;
    const imgY = bounds.minSafeY + (bounds.safeHeightMm - imgH) / 2;

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

export const MINIMAL_TWO_PHOTO: LayoutTemplate = {
  id: "MINIMAL_TWO_PHOTO",
  name: "Minimal Two Photo",
  description: "Two restrained square or rectangular frames floating in serene balance.",
  family: "MINIMAL",
  minPhotos: 2,
  maxPhotos: 2,
  preferredOrientations: ["PORTRAIT", "SQUARE"],
  supportsText: false,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "LOW",
  canonicalLayoutType: "SPLIT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const gutter = 14;
    const colW = roundMm((bounds.safeWidthMm * 0.8 - gutter) / 2);
    const colH = roundMm(bounds.safeHeightMm * 0.55);
    const startX = bounds.minSafeX + (bounds.safeWidthMm - (colW * 2 + gutter)) / 2;
    const startY = bounds.minSafeY + (bounds.safeHeightMm - colH) / 2;

    const p0 = ctx.photos[0];
    const p1 = ctx.photos[1] || p0;

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId: p0.assetId,
        xMm: startX,
        yMm: startY,
        widthMm: colW,
        heightMm: colH,
        fit: "COVER",
        focalPoint: p0.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_1`,
        assetId: p1.assetId,
        xMm: startX + colW + gutter,
        yMm: startY,
        widthMm: colW,
        heightMm: colH,
        fit: "COVER",
        focalPoint: p1.focalPoint,
      }),
    ];

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

export const MINIMAL_TEXT_LEFT: LayoutTemplate = {
  id: "MINIMAL_TEXT_LEFT",
  name: "Minimal Text Left",
  description: "Poetic text phrase in generous left margin with intimate square or vertical photo on right.",
  family: "MINIMAL",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["PORTRAIT", "SQUARE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "LOW",
  canonicalLayoutType: "PHOTO_TEXT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const textW = roundMm(bounds.safeWidthMm * 0.38);
    const photoW = roundMm(bounds.safeWidthMm * 0.52);
    const photoH = roundMm(bounds.safeHeightMm * 0.65);
    const photoX = bounds.maxSafeX - photoW;
    const photoY = bounds.minSafeY + (bounds.safeHeightMm - photoH) / 2;

    const elements = [
      createTextElement({
        id: `el_${ctx.pageId}_quote`,
        text: ctx.editorial?.headline || "The silence before the crossing.",
        xMm: bounds.minSafeX,
        yMm: photoY + 25,
        widthMm: textW,
        heightMm: 25,
        role: "EDITORIAL_HEADLINE",
        typography: ctx.typography,
        theme: ctx.theme,
        bounds,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId,
        xMm: photoX,
        yMm: photoY,
        widthMm: photoW,
        heightMm: photoH,
        fit: "COVER",
        focalPoint: photo?.focalPoint,
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

export const MINIMAL_TEXT_RIGHT: LayoutTemplate = {
  id: "MINIMAL_TEXT_RIGHT",
  name: "Minimal Text Right",
  description: "Intimate photograph on left margin with serene poetic text floating in right margin.",
  family: "MINIMAL",
  minPhotos: 1,
  maxPhotos: 1,
  preferredOrientations: ["PORTRAIT", "SQUARE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "LOW",
  canonicalLayoutType: "PHOTO_TEXT",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const photo = ctx.photos[0];
    const assetId = photo ? photo.assetId : "fallback_photo";

    const photoW = roundMm(bounds.safeWidthMm * 0.52);
    const photoH = roundMm(bounds.safeHeightMm * 0.65);
    const textW = roundMm(bounds.safeWidthMm * 0.38);
    const textX = bounds.minSafeX + photoW + 10;
    const photoY = bounds.minSafeY + (bounds.safeHeightMm - photoH) / 2;

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId,
        xMm: bounds.minSafeX,
        yMm: photoY,
        widthMm: photoW,
        heightMm: photoH,
        fit: "COVER",
        focalPoint: photo?.focalPoint,
      }),
      createTextElement({
        id: `el_${ctx.pageId}_quote`,
        text: ctx.editorial?.headline || "A place held in remembrance.",
        xMm: textX,
        yMm: photoY + 25,
        widthMm: textW,
        heightMm: 25,
        role: "EDITORIAL_HEADLINE",
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

export const MINIMAL_CENTERED: LayoutTemplate = {
  id: "MINIMAL_CENTERED",
  name: "Minimal Centered",
  description: "Strictly centered photograph with a single delicate date/location marker below.",
  family: "MINIMAL",
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

    const imgW = roundMm(bounds.safeWidthMm * 0.8);
    const imgH = roundMm(bounds.safeHeightMm * 0.58);
    const imgX = bounds.minSafeX + (bounds.safeWidthMm - imgW) / 2;
    const imgY = bounds.minSafeY + (bounds.safeHeightMm - imgH) / 2 - 8;

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
        id: `el_${ctx.pageId}_meta`,
        text: [ctx.editorial?.location, ctx.editorial?.date].filter(Boolean).join(" · ") || "ARCHIVAL PRINT",
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

export const MINIMAL_TEMPLATES = [
  MINIMAL_ONE_PHOTO,
  MINIMAL_TWO_PHOTO,
  MINIMAL_TEXT_LEFT,
  MINIMAL_TEXT_RIGHT,
  MINIMAL_CENTERED,
];
