import type { BookDesign, DesignElement, FitMode, Point } from "@/types/design";

export type EditorMode = "EDIT" | "PREVIEW";
export type EditorViewMode = "SINGLE" | "SPREAD";
export type SaveStatus = "SAVED" | "SAVING" | "UNSAVED" | "ERROR";

export interface EditorAsset {
  id: string;
  previewUrl: string;
  width?: number;
  height?: number;
  mimeType?: string;
}

export type EditorAssetMap = Map<string, EditorAsset>;

export interface DisplayScale {
  pixelsPerMm: number;
  zoom: number;
  effectiveScale: number; // pixelsPerMm * zoom
}

export interface EditorState {
  design: BookDesign;
  selectedPageId: string;
  selectedElementId: string | null;
  zoom: number;
  mode: EditorMode;
  showSafeArea: boolean;
  showBleed: boolean;
  showGutter: boolean;
  viewMode: EditorViewMode;
  saveStatus: SaveStatus;
  lastSavedAt?: string;
  errorMessage?: string;
  protectedPhotoIds: string[];
}

export interface HistoryState {
  past: BookDesign[];
  present: BookDesign;
  future: BookDesign[];
}

export interface MutationResult {
  success: boolean;
  design: BookDesign;
  error?: string;
}

export interface TypographyUpdates {
  text?: string;
  fontFamily?: string;
  fontWeight?: number;
  fontSizePt?: number;
  lineHeight?: number;
  letterSpacingPt?: number;
  color?: string;
  align?: "left" | "center" | "right";
}

export interface ImageCropUpdates {
  fit?: FitMode;
  focalPoint?: Point;
}

export interface ElementSelectionInfo {
  pageId: string;
  element: DesignElement;
  isProtected: boolean;
}
