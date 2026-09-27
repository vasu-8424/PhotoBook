import type { DesignElement } from "@/types/design";
import type { LayoutTemplate } from "../types";
import {
  createBookPage,
  createImageElement,
  createTextElement,
  getPageBounds,
  roundMm,
} from "./helpers";

export const EDITORIAL_GRID_2: LayoutTemplate = {
  id: "EDITORIAL_GRID_2",
  name: "Editorial Grid 2",
  description: "Harmonious two-photo composition positioned diagonally with editorial breathing space.",
  family: "GRID",
  minPhotos: 2,
  maxPhotos: 2,
  preferredOrientations: ["PORTRAIT", "SQUARE", "LANDSCAPE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "MEDIUM",
  canonicalLayoutType: "EDITORIAL_GRID",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const gutter = 10;
    const w = roundMm((bounds.safeWidthMm - gutter) * 0.75);
    const h = roundMm((bounds.safeHeightMm - gutter - 20) / 2);

    const p0 = ctx.photos[0];
    const p1 = ctx.photos[1] || p0;

    const elements: DesignElement[] = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId: p0.assetId,
        xMm: bounds.minSafeX,
        yMm: bounds.minSafeY + 10,
        widthMm: w,
        heightMm: h,
        fit: "COVER",
        focalPoint: p0.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_1`,
        assetId: p1.assetId,
        xMm: bounds.maxSafeX - w,
        yMm: bounds.minSafeY + 10 + h + gutter,
        widthMm: w,
        heightMm: h,
        fit: "COVER",
        focalPoint: p1.focalPoint,
      }),
    ];

    if (ctx.editorial?.caption) {
      elements.push(
        createTextElement({
          id: `el_${ctx.pageId}_caption`,
          text: ctx.editorial.caption,
          xMm: bounds.minSafeX,
          yMm: bounds.maxSafeY - 12,
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
          layoutType: "EDITORIAL_GRID",
          elements,
        }),
      ],
    };
  },
};

export const EDITORIAL_GRID_3: LayoutTemplate = {
  id: "EDITORIAL_GRID_3",
  name: "Editorial Grid 3",
  description: "Dynamic trio layout with one dominant featured photo over two supporting square/portrait frames.",
  family: "GRID",
  minPhotos: 3,
  maxPhotos: 3,
  preferredOrientations: ["LANDSCAPE", "PORTRAIT", "SQUARE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "HIGH",
  canonicalLayoutType: "EDITORIAL_GRID",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const gutter = 8;
    const topH = roundMm(bounds.safeHeightMm * 0.48);
    const bottomH = roundMm(bounds.safeHeightMm * 0.38);
    const colW = roundMm((bounds.safeWidthMm - gutter) / 2);

    const p0 = ctx.photos[0];
    const p1 = ctx.photos[1] || p0;
    const p2 = ctx.photos[2] || p0;

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId: p0.assetId,
        xMm: bounds.minSafeX,
        yMm: bounds.minSafeY + 5,
        widthMm: bounds.safeWidthMm,
        heightMm: topH,
        fit: "COVER",
        focalPoint: p0.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_1`,
        assetId: p1.assetId,
        xMm: bounds.minSafeX,
        yMm: bounds.minSafeY + 5 + topH + gutter,
        widthMm: colW,
        heightMm: bottomH,
        fit: "COVER",
        focalPoint: p1.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_2`,
        assetId: p2.assetId,
        xMm: bounds.minSafeX + colW + gutter,
        yMm: bounds.minSafeY + 5 + topH + gutter,
        widthMm: colW,
        heightMm: bottomH,
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

export const EDITORIAL_GRID_4: LayoutTemplate = {
  id: "EDITORIAL_GRID_4",
  name: "Editorial Grid 4",
  description: "Curated 2x2 quartet of photographs with precise symmetrical gutters and editorial margins.",
  family: "GRID",
  minPhotos: 4,
  maxPhotos: 4,
  preferredOrientations: ["SQUARE", "PORTRAIT", "LANDSCAPE"],
  supportsText: false,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "HIGH",
  canonicalLayoutType: "EDITORIAL_GRID",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const gutter = 7;
    const colW = roundMm((bounds.safeWidthMm - gutter) / 2);
    const rowH = roundMm((bounds.safeHeightMm - gutter - 15) / 2);
    const y0 = bounds.minSafeY + 5;
    const y1 = y0 + rowH + gutter;

    const p0 = ctx.photos[0];
    const p1 = ctx.photos[1] || p0;
    const p2 = ctx.photos[2] || p0;
    const p3 = ctx.photos[3] || p0;

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId: p0.assetId,
        xMm: bounds.minSafeX,
        yMm: y0,
        widthMm: colW,
        heightMm: rowH,
        fit: "COVER",
        focalPoint: p0.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_1`,
        assetId: p1.assetId,
        xMm: bounds.minSafeX + colW + gutter,
        yMm: y0,
        widthMm: colW,
        heightMm: rowH,
        fit: "COVER",
        focalPoint: p1.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_2`,
        assetId: p2.assetId,
        xMm: bounds.minSafeX,
        yMm: y1,
        widthMm: colW,
        heightMm: rowH,
        fit: "COVER",
        focalPoint: p2.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_3`,
        assetId: p3.assetId,
        xMm: bounds.minSafeX + colW + gutter,
        yMm: y1,
        widthMm: colW,
        heightMm: rowH,
        fit: "COVER",
        focalPoint: p3.focalPoint,
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

export const ASYMMETRIC_GRID: LayoutTemplate = {
  id: "ASYMMETRIC_GRID",
  name: "Asymmetric Grid",
  description: "One vertical hero column on the left balanced against two smaller stacked photos on the right.",
  family: "GRID",
  minPhotos: 3,
  maxPhotos: 3,
  preferredOrientations: ["PORTRAIT", "LANDSCAPE", "SQUARE"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "HIGH",
  canonicalLayoutType: "ASYMMETRIC",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const gutter = 8;
    const leftW = roundMm(bounds.safeWidthMm * 0.58);
    const rightW = roundMm(bounds.safeWidthMm - leftW - gutter);
    const totalH = roundMm(bounds.safeHeightMm * 0.85);
    const rightH = roundMm((totalH - gutter) / 2);
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
        widthMm: leftW,
        heightMm: totalH,
        fit: "COVER",
        focalPoint: p0.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_1`,
        assetId: p1.assetId,
        xMm: bounds.minSafeX + leftW + gutter,
        yMm: startY,
        widthMm: rightW,
        heightMm: rightH,
        fit: "COVER",
        focalPoint: p1.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_2`,
        assetId: p2.assetId,
        xMm: bounds.minSafeX + leftW + gutter,
        yMm: startY + rightH + gutter,
        widthMm: rightW,
        heightMm: rightH,
        fit: "COVER",
        focalPoint: p2.focalPoint,
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

export const MIXED_ORIENTATION_GRID: LayoutTemplate = {
  id: "MIXED_ORIENTATION_GRID",
  name: "Mixed Orientation Grid",
  description: "Expertly pairs 1 wide landscape photo with 2 tall portrait photos into a coherent editorial unit.",
  family: "GRID",
  minPhotos: 3,
  maxPhotos: 3,
  preferredOrientations: ["LANDSCAPE", "PORTRAIT"],
  supportsText: true,
  supportsQuote: false,
  supportsSpread: false,
  visualDensity: "HIGH",
  canonicalLayoutType: "EDITORIAL_GRID",
  compile(ctx) {
    const bounds = getPageBounds(ctx.document);
    const gutter = 8;

    // Identify which is landscape and which are portraits if possible
    let landscapePhoto = ctx.photos.find((p) => p.orientation === "LANDSCAPE");
    const portraitPhotos = ctx.photos.filter((p) => p !== landscapePhoto);

    if (!landscapePhoto) {
      landscapePhoto = ctx.photos[0];
    }
    const p1 = portraitPhotos[0] || ctx.photos[1] || landscapePhoto;
    const p2 = portraitPhotos[1] || ctx.photos[2] || landscapePhoto;

    const topH = roundMm(bounds.safeHeightMm * 0.44);
    const bottomH = roundMm(bounds.safeHeightMm * 0.42);
    const colW = roundMm((bounds.safeWidthMm - gutter) / 2);
    const y0 = bounds.minSafeY + 5;
    const y1 = y0 + topH + gutter;

    const elements = [
      createImageElement({
        id: `el_${ctx.pageId}_img_0`,
        assetId: landscapePhoto.assetId,
        xMm: bounds.minSafeX,
        yMm: y0,
        widthMm: bounds.safeWidthMm,
        heightMm: topH,
        fit: "COVER",
        focalPoint: landscapePhoto.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_1`,
        assetId: p1.assetId,
        xMm: bounds.minSafeX,
        yMm: y1,
        widthMm: colW,
        heightMm: bottomH,
        fit: "COVER",
        focalPoint: p1.focalPoint,
      }),
      createImageElement({
        id: `el_${ctx.pageId}_img_2`,
        assetId: p2.assetId,
        xMm: bounds.minSafeX + colW + gutter,
        yMm: y1,
        widthMm: colW,
        heightMm: bottomH,
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

export const GRID_TEMPLATES = [
  EDITORIAL_GRID_2,
  EDITORIAL_GRID_3,
  EDITORIAL_GRID_4,
  ASYMMETRIC_GRID,
  MIXED_ORIENTATION_GRID,
];
