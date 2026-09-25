/**
 * Part 10 — PDF Export & Print Delivery Engine
 * lib/export/validate-pdf.ts
 *
 * Post-render PDF validation.
 * Verifies structure, page count, page dimensions, and non-emptiness.
 * Does NOT use browser, canvas, or screenshot mechanisms.
 */

import { PDFDocument } from "pdf-lib";
import { PdfExportError } from "./errors";

export interface PdfValidationOptions {
  expectedPageCount: number;
  expectedWidthMm: number;
  expectedHeightMm: number;
  /** Tolerance in mm for dimension comparison (default: 1mm) */
  dimensionToleranceMm?: number;
}

export interface PdfValidationResult {
  valid: boolean;
  actualPageCount: number;
  actualWidthMm: number;
  actualHeightMm: number;
  errors: string[];
  warnings: string[];
}

const PT_TO_MM = 25.4 / 72;

/**
 * Validates the structural integrity and correctness of a generated PDF.
 * Throws PdfExportError with code PDF_EXPORT_VALIDATION_ERROR on failure.
 */
export async function validatePdfArtifact(
  pdfBytes: Uint8Array,
  options: PdfValidationOptions,
): Promise<PdfValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tolerance = options.dimensionToleranceMm ?? 1;

  // 1. Non-empty check
  if (!pdfBytes || pdfBytes.byteLength === 0) {
    throw new PdfExportError(
      "Generated PDF is empty (0 bytes).",
      "PDF_EXPORT_VALIDATION_ERROR",
      false,
    );
  }

  // 2. Parse PDF to verify structural validity
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  } catch (parseErr) {
    throw new PdfExportError(
      `Generated PDF cannot be parsed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      "PDF_EXPORT_VALIDATION_ERROR",
      false,
    );
  }

  // 3. Page count validation
  const actualPageCount = pdfDoc.getPageCount();
  if (actualPageCount === 0) {
    errors.push("PDF contains no pages.");
  }
  if (actualPageCount !== options.expectedPageCount) {
    errors.push(
      `Page count mismatch: expected ${options.expectedPageCount}, got ${actualPageCount}.`,
    );
  }

  // 4. Page dimension validation (check first page as representative)
  let actualWidthMm = 0;
  let actualHeightMm = 0;

  if (actualPageCount > 0) {
    const firstPage = pdfDoc.getPage(0);
    const size = firstPage.getSize();
    actualWidthMm = size.width * PT_TO_MM;
    actualHeightMm = size.height * PT_TO_MM;

    const widthDiff = Math.abs(actualWidthMm - options.expectedWidthMm);
    const heightDiff = Math.abs(actualHeightMm - options.expectedHeightMm);

    if (widthDiff > tolerance) {
      warnings.push(
        `Page width mismatch: expected ${options.expectedWidthMm.toFixed(1)}mm, got ${actualWidthMm.toFixed(1)}mm (diff ${widthDiff.toFixed(2)}mm).`,
      );
    }
    if (heightDiff > tolerance) {
      warnings.push(
        `Page height mismatch: expected ${options.expectedHeightMm.toFixed(1)}mm, got ${actualHeightMm.toFixed(1)}mm (diff ${heightDiff.toFixed(2)}mm).`,
      );
    }
  }

  // 5. Minimum file size sanity check (a structurally valid PDF is at least 1KB)
  if (pdfBytes.byteLength < 1024) {
    warnings.push(
      `PDF is suspiciously small (${pdfBytes.byteLength} bytes). Content may be missing.`,
    );
  }

  const valid = errors.length === 0;

  if (!valid) {
    throw new PdfExportError(
      `PDF validation failed: ${errors.join("; ")}`,
      "PDF_EXPORT_VALIDATION_ERROR",
      false,
    );
  }

  return {
    valid,
    actualPageCount,
    actualWidthMm,
    actualHeightMm,
    errors,
    warnings,
  };
}
