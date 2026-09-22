export const DESIGN_SCHEMA_VERSION = "1.0.0";

export type BookSize =
  | "A4"
  | "SQUARE_210"
  | "A5"
  | "LETTER"
  | "CUSTOM";

export type PageOrientation =
  | "PORTRAIT"
  | "LANDSCAPE"
  | "SQUARE";

export type LayoutType =
  | "FULL_BLEED"
  | "HERO"
  | "SPLIT"
  | "ASYMMETRIC"
  | "MASONRY"
  | "EDITORIAL_GRID"
  | "PHOTO_STRIP"
  | "PHOTO_TEXT"
  | "COLLAGE"
  | "SPREAD";

export type FitMode =
  | "COVER"
  | "CONTAIN"
  | "FILL";

export interface DimensionsMm {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface BookDocument {
  schemaVersion: string;

  size: BookSize;

  widthMm: number;
  heightMm: number;

  bleedMm: number;
  safeAreaMm: number;
  gutterMm: number;

  dpi: number;

  orientation: PageOrientation;
}

export interface ImageElement {
  id: string;

  type: "image";

  assetId: string;

  xMm: number;
  yMm: number;

  widthMm: number;
  heightMm: number;

  fit: FitMode;

  focalPoint?: Point;

  rotation?: number;

  opacity?: number;
}

export interface TextElement {
  id: string;

  type: "text";

  text: string;

  xMm: number;
  yMm: number;

  widthMm: number;
  heightMm: number;

  fontFamily: string;
  fontWeight: number;

  fontSizePt: number;

  lineHeight: number;

  letterSpacingPt: number;

  color: string;

  align: "left" | "center" | "right";

  rotation?: number;
}

export interface ShapeElement {
  id: string;

  type: "shape";

  shape:
    | "rectangle"
    | "line"
    | "circle";

  xMm: number;
  yMm: number;

  widthMm: number;
  heightMm: number;

  fill?: string;

  stroke?: string;

  strokeWidthMm?: number;
}

export type DesignElement =
  | ImageElement
  | TextElement
  | ShapeElement;

export interface BookPage {
  id: string;

  pageNumber: number;

  layoutType: LayoutType;

  elements: DesignElement[];
}

export interface BookSpread {
  id: string;

  leftPageId: string;

  rightPageId: string;

  assetId?: string;

  focalPoint?: Point;

  fit?: FitMode;
}

export interface BookDesign {
  schemaVersion: string;

  document: BookDocument;

  pages: BookPage[];

  spreads: BookSpread[];
}
