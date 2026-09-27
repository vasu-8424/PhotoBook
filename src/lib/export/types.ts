/**
 * Part 10 — PDF Export & Print Delivery Engine
 * lib/export/types.ts
 *
 * Canonical types for the export subsystem.
 * These extend the Part 9 BookExportRecord with Part 10 required fields.
 */

// -----------------------------------------------------------------------
// Export Status — strict Part 10 enum
// -----------------------------------------------------------------------

export type PdfExportStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED";

// -----------------------------------------------------------------------
// Export Step — internal workflow position inside a RUNNING job
// -----------------------------------------------------------------------

export type PdfExportStep =
  | "LOADING"
  | "VALIDATING"
  | "RENDERING"
  | "FINALIZING"
  | "COMPLETE";

// -----------------------------------------------------------------------
// Export Error Codes — explicit, safe application-level codes
// -----------------------------------------------------------------------

export type PdfExportErrorCode =
  | "PDF_EXPORT_DESIGN_INVALID"
  | "PDF_EXPORT_ASSET_MISSING"
  | "PDF_EXPORT_ASSET_INVALID"
  | "PDF_EXPORT_ASSET_UNAUTHORIZED"
  | "PDF_EXPORT_FONT_ERROR"
  | "PDF_EXPORT_LOW_DPI"
  | "PDF_EXPORT_RENDER_ERROR"
  | "PDF_EXPORT_STORAGE_ERROR"
  | "PDF_EXPORT_VALIDATION_ERROR"
  | "PDF_EXPORT_CANCELLED"
  | "PDF_EXPORT_UNKNOWN_ERROR";

// -----------------------------------------------------------------------
// Full export record — canonical shape persisted in pdf_exports
// -----------------------------------------------------------------------

export interface PdfExportRecord {
  id: string;
  bookId: string;
  jobId?: string;
  userId: string;
  designId?: string;
  designHash: string;
  schemaVersion: string;
  status: PdfExportStatus;
  storagePath?: string;
  fileSizeBytes?: number;
  pageCount?: number;
  widthMm?: number;
  heightMm?: number;
  sha256?: string;
  errorCode?: PdfExportErrorCode;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
}

// -----------------------------------------------------------------------
// API response shapes
// -----------------------------------------------------------------------

/** Response from POST /api/books/[bookId]/export */
export interface ExportTriggerResponse {
  exportId: string;
  jobId: string;
  status: PdfExportStatus;
  designHash: string;
  /** present when status === SUCCEEDED */
  reused?: boolean;
}

/** Response from GET /api/books/[bookId]/export */
export interface ExportStatusResponse {
  exportId: string;
  jobId?: string;
  status: PdfExportStatus;
  progress: number;
  currentStep: PdfExportStep;
  pageCount?: number;
  fileSizeBytes?: number;
  designHash?: string;
  errorCode?: string;
}

/** Response from GET /api/books/[bookId]/export/download */
export interface ExportDownloadResponse {
  signedUrl: string;
  /** Seconds until the signed URL expires */
  expiresInSeconds: number;
  fileSizeBytes?: number;
  pageCount?: number;
  sha256?: string;
}

// -----------------------------------------------------------------------
// Internal render result (extends Part 2 result with checksum)
// -----------------------------------------------------------------------

export interface PdfRenderArtifact {
  pdfBytes: Uint8Array;
  pageCount: number;
  fileSizeBytes: number;
  sha256: string;
  warnings: string[];
}
