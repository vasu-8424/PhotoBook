/**
 * Part 10 — PDF Export & Print Delivery Engine
 * lib/export/errors.ts
 *
 * Structured error classes for the export subsystem.
 * All export errors map to safe, user-visible PdfExportErrorCode values.
 * Internal details (stack traces, keys, paths) are never surfaced.
 */

import type { PdfExportErrorCode } from "./types";

export class PdfExportError extends Error {
  public readonly code: PdfExportErrorCode;
  public readonly retryable: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: PdfExportErrorCode = "PDF_EXPORT_UNKNOWN_ERROR",
    retryable = false,
    details?: unknown,
  ) {
    super(message);
    this.name = "PdfExportError";
    this.code = code;
    this.retryable = retryable;
    this.details = details;
    Object.setPrototypeOf(this, PdfExportError.prototype);
  }
}

/**
 * Maps any thrown error into a safe PdfExportErrorCode.
 * Never exposes internal details to API responses.
 */
export function classifyExportError(err: unknown): {
  code: PdfExportErrorCode;
  message: string;
  retryable: boolean;
} {
  if (err instanceof PdfExportError) {
    return {
      code: err.code,
      message: getUserFriendlyExportError(err.code),
      retryable: err.retryable,
    };
  }

  const raw = err instanceof Error ? err.message : String(err);

  // Heuristic classification of common error types
  if (raw.includes("font") || raw.includes("Font")) {
    return {
      code: "PDF_EXPORT_FONT_ERROR",
      message: getUserFriendlyExportError("PDF_EXPORT_FONT_ERROR"),
      retryable: false,
    };
  }
  if (raw.includes("DPI") || raw.includes("dpi") || raw.includes("resolution")) {
    return {
      code: "PDF_EXPORT_LOW_DPI",
      message: getUserFriendlyExportError("PDF_EXPORT_LOW_DPI"),
      retryable: false,
    };
  }
  if (raw.includes("storage") || raw.includes("Storage") || raw.includes("upload")) {
    return {
      code: "PDF_EXPORT_STORAGE_ERROR",
      message: getUserFriendlyExportError("PDF_EXPORT_STORAGE_ERROR"),
      retryable: true,
    };
  }
  if (raw.includes("render") || raw.includes("Render") || raw.includes("PDF")) {
    return {
      code: "PDF_EXPORT_RENDER_ERROR",
      message: getUserFriendlyExportError("PDF_EXPORT_RENDER_ERROR"),
      retryable: true,
    };
  }
  if (raw.includes("asset") || raw.includes("Asset") || raw.includes("image")) {
    return {
      code: "PDF_EXPORT_ASSET_MISSING",
      message: getUserFriendlyExportError("PDF_EXPORT_ASSET_MISSING"),
      retryable: false,
    };
  }

  return {
    code: "PDF_EXPORT_UNKNOWN_ERROR",
    message: getUserFriendlyExportError("PDF_EXPORT_UNKNOWN_ERROR"),
    retryable: false,
  };
}

/** Returns a safe, user-facing string for each export error code. */
export function getUserFriendlyExportError(code: PdfExportErrorCode): string {
  switch (code) {
    case "PDF_EXPORT_DESIGN_INVALID":
      return "The magazine design could not be validated for print. Please save your changes and try again.";
    case "PDF_EXPORT_ASSET_MISSING":
      return "One or more photos required for export could not be found. Please re-upload any missing photos.";
    case "PDF_EXPORT_ASSET_UNAUTHORIZED":
      return "One or more photos in this export are not authorized for your account.";
    case "PDF_EXPORT_FONT_ERROR":
      return "A required font could not be embedded in the PDF. Please contact support.";
    case "PDF_EXPORT_LOW_DPI":
      return "One or more photos do not meet the minimum 300 DPI print quality requirement.";
    case "PDF_EXPORT_RENDER_ERROR":
      return "The PDF rendering engine encountered an error. Please try again.";
    case "PDF_EXPORT_STORAGE_ERROR":
      return "Could not store the generated PDF. Please try again shortly.";
    case "PDF_EXPORT_VALIDATION_ERROR":
      return "The generated PDF failed validation checks. Please try again.";
    case "PDF_EXPORT_CANCELLED":
      return "PDF export was cancelled.";
    case "PDF_EXPORT_UNKNOWN_ERROR":
    default:
      return "An unexpected error occurred during PDF export. Please try again.";
  }
}
