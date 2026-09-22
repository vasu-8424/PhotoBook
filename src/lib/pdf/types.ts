export interface PdfRenderOptions {
  outputDpi?: number;
  validate?: boolean;
}

export interface PdfRenderResult {
  pdfBytes: Uint8Array;
  pageCount: number;
  warnings: string[];
  validationErrors: string[];
}

export interface RenderAsset {
  id: string;
  mimeType: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface PrintValidationIssue {
  code: string;
  message: string;
  pageId?: string;
  elementId?: string;
  assetId?: string;
}

export interface PrintValidationResult {
  valid: boolean;
  errors: PrintValidationIssue[];
  warnings: PrintValidationIssue[];
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageCropBounds {
  clipRect: PdfRect;
  imageRect: PdfRect;
}
