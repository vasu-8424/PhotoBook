import type {
  BookDocument,
  BookPage,
  DesignElement,
  FitMode,
  ImageElement,
  LayoutType,
  Point,
  ShapeElement,
  TextElement,
} from "@/types/design";
import type { BookTheme, TypographicRole, TypographySystem } from "../types";
import { resolveRoleStyle } from "../typography";

export function roundMm(val: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export interface PageBounds {
  widthMm: number;
  heightMm: number;
  safeAreaMm: number;
  bleedMm: number;
  minSafeX: number;
  minSafeY: number;
  maxSafeX: number;
  maxSafeY: number;
  safeWidthMm: number;
  safeHeightMm: number;
}

export function getPageBounds(doc: BookDocument): PageBounds {
  const widthMm = doc.widthMm;
  const heightMm = doc.heightMm;
  const safeAreaMm = doc.safeAreaMm;
  const bleedMm = doc.bleedMm;

  const minSafeX = safeAreaMm;
  const minSafeY = safeAreaMm;
  const maxSafeX = widthMm - safeAreaMm;
  const maxSafeY = heightMm - safeAreaMm;

  return {
    widthMm,
    heightMm,
    safeAreaMm,
    bleedMm,
    minSafeX,
    minSafeY,
    maxSafeX,
    maxSafeY,
    safeWidthMm: roundMm(maxSafeX - minSafeX),
    safeHeightMm: roundMm(maxSafeY - minSafeY),
  };
}

export function createImageElement(options: {
  id: string;
  assetId: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fit?: FitMode;
  focalPoint?: Point;
  rotation?: number;
  opacity?: number;
}): ImageElement {
  return {
    id: options.id,
    type: "image",
    assetId: options.assetId,
    xMm: roundMm(options.xMm),
    yMm: roundMm(options.yMm),
    widthMm: roundMm(options.widthMm),
    heightMm: roundMm(options.heightMm),
    fit: options.fit || "COVER",
    focalPoint: options.focalPoint,
    rotation: options.rotation,
    opacity: options.opacity,
  };
}

export function createTextElement(options: {
  id: string;
  text: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  role: TypographicRole;
  typography: TypographySystem;
  theme: BookTheme;
  align?: "left" | "center" | "right";
  overrideColor?: string;
  bounds?: PageBounds;
}): TextElement {
  const style = resolveRoleStyle(options.role, options.typography, options.theme);

  let x = options.xMm;
  let y = options.yMm;
  let w = options.widthMm;
  let h = options.heightMm;

  // Strict safe area boundary clamping if bounds provided
  if (options.bounds) {
    if (x < options.bounds.minSafeX) {
      w = Math.max(10, w - (options.bounds.minSafeX - x));
      x = options.bounds.minSafeX;
    }
    if (x + w > options.bounds.maxSafeX) {
      w = Math.max(10, options.bounds.maxSafeX - x);
    }
    if (y < options.bounds.minSafeY) {
      h = Math.max(5, h - (options.bounds.minSafeY - y));
      y = options.bounds.minSafeY;
    }
    if (y + h > options.bounds.maxSafeY) {
      h = Math.max(5, options.bounds.maxSafeY - y);
    }
  }

  return {
    id: options.id,
    type: "text",
    text: options.text,
    xMm: roundMm(x),
    yMm: roundMm(y),
    widthMm: roundMm(w),
    heightMm: roundMm(h),
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSizePt: style.fontSizePt,
    lineHeight: style.lineHeight,
    letterSpacingPt: style.letterSpacingPt,
    color: options.overrideColor || style.color,
    align: options.align || style.align || "left",
  };
}

export function createShapeElement(options: {
  id: string;
  shape: "rectangle" | "line" | "circle";
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fill?: string;
  stroke?: string;
  strokeWidthMm?: number;
}): ShapeElement {
  return {
    id: options.id,
    type: "shape",
    shape: options.shape,
    xMm: roundMm(options.xMm),
    yMm: roundMm(options.yMm),
    widthMm: roundMm(options.widthMm),
    heightMm: roundMm(options.heightMm),
    fill: options.fill,
    stroke: options.stroke,
    strokeWidthMm: options.strokeWidthMm,
  };
}

export function createBookPage(options: {
  id: string;
  pageNumber: number;
  layoutType: LayoutType;
  elements: DesignElement[];
}): BookPage {
  return {
    id: options.id,
    pageNumber: options.pageNumber,
    layoutType: options.layoutType,
    elements: options.elements,
  };
}
