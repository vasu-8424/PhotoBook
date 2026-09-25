/**
 * Part 10 — PDF Export & Print Delivery Engine
 * lib/export/service.ts
 *
 * Authoritative export service.
 *
 * Responsibilities:
 *   loadDesign()         — loads persisted BookDesign from database
 *   calculateDesignHash()— deterministic SHA-256 hash (Part 7 canonical)
 *   validateDesign()     — runs Part 2 print engine validation
 *   resolveAssets()      — loads photo assets for the PDF renderer
 *   renderPdf()          — invokes Part 2 Print Engine (never Konva)
 *   validatePdf()        — structural validation of rendered PDF
 *   calculateChecksum()  — SHA-256 of final PDF bytes
 *   storePdf()           — uploads to private book-pdfs bucket
 *   persistMetadata()    — writes pdf_exports record
 *
 * The service is called by the async PDF_EXPORT job worker.
 * It never runs inside a long synchronous API request.
 */

import { getDesignRepository } from "@/lib/ai/design";
import { renderDocument, type RenderAsset } from "@/lib/pdf";
import { validateDesign as validatePrintEngineDesign } from "@/lib/pdf/validate-design";
import { getBookRepository } from "@/lib/jobs/storage";
import { DESIGN_SCHEMA_VERSION } from "@/types/design";
import { computeDesignHash, computePdfSha256 } from "./hash";
import { validatePdfArtifact } from "./validate-pdf";
import { uploadPdf } from "./storage";
import { getPdfExportRepository } from "./repository";
import { PdfExportError, classifyExportError } from "./errors";
import type { PdfExportRecord, PdfExportStep } from "./types";
import type { BookDesign } from "@/types/design";

// -----------------------------------------------------------------------
// PDF_RETENTION — 30 days per spec (overrides the legacy 24h config)
// -----------------------------------------------------------------------
const PDF_RETENTION_DAYS = 30;

// -----------------------------------------------------------------------
// Step Progress Callback
// -----------------------------------------------------------------------

export type ExportProgressCallback = (step: PdfExportStep, progress: number) => void;

// -----------------------------------------------------------------------
// Export Context
// -----------------------------------------------------------------------

export interface ExportContext {
  exportId: string;
  bookId: string;
  userId: string;
  jobId?: string;
  requestId?: string;
}

// -----------------------------------------------------------------------
// Export Service Result
// -----------------------------------------------------------------------

export interface ExportServiceResult {
  exportId: string;
  storagePath: string;
  designHash: string;
  fileSizeBytes: number;
  pageCount: number;
  widthMm: number;
  heightMm: number;
  sha256: string;
  warnings: string[];
}

// -----------------------------------------------------------------------
// Step 1: Load Persisted Design
// -----------------------------------------------------------------------

/**
 * Loads the persisted BookDesign from the database.
 * NEVER accepts unsaved browser state or Konva state.
 * Rejects if no persisted design exists.
 */
export async function loadPersistedDesign(bookId: string): Promise<BookDesign> {
  const designRepo = getDesignRepository();
  const record = await designRepo.getDesignByBookId(bookId);

  if (!record || !record.designJson) {
    throw new PdfExportError(
      "No saved design found. Please save your magazine before exporting.",
      "PDF_EXPORT_DESIGN_INVALID",
      false,
    );
  }

  const design = record.designJson;

  if (design.schemaVersion !== DESIGN_SCHEMA_VERSION) {
    throw new PdfExportError(
      `Unsupported design schema version: ${design.schemaVersion}. Expected ${DESIGN_SCHEMA_VERSION}.`,
      "PDF_EXPORT_DESIGN_INVALID",
      false,
    );
  }

  return design;
}

// -----------------------------------------------------------------------
// Step 2: Validate Design
// -----------------------------------------------------------------------

/**
 * Validates the BookDesign against all Part 2 print engine constraints.
 * Rejects designs with invalid geometry, unknown fonts, invalid sizes, etc.
 */
export function validateDesignForExport(design: BookDesign): void {
  const result = validatePrintEngineDesign(design);

  if (!result.valid) {
    const summary = result.errors
      .map((e) => `[${e.code}] ${e.message}`)
      .join("; ");

    throw new PdfExportError(
      `Print Engine design validation failed: ${summary}`,
      "PDF_EXPORT_DESIGN_INVALID",
      false,
      result.errors,
    );
  }
}

// -----------------------------------------------------------------------
// Step 3: Resolve Assets
// -----------------------------------------------------------------------

/**
 * Resolves photo assets for the PDF renderer.
 * Currently uses a validated minimal placeholder while real asset
 * loading is wired in. The key invariant is that ONLY asset IDs
 * referenced by the persisted BookDesign are resolved.
 *
 * NOTE: Asset authorization is enforced at the API layer (book ownership).
 * The render step only processes what the persisted design references.
 */
export async function resolveAssets(
  design: BookDesign,
): Promise<Map<string, RenderAsset>> {
  const assets = new Map<string, RenderAsset>();

  // Canonical 1×1 transparent PNG placeholder for server-side rendering.
  // In production Phase 2, this will be replaced with real EXIF-stripped
  // derivative loading from the book-photos bucket, using the existing
  // Part 4 photo storage pipeline.
  const minimalPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );

  const assetIds = new Set<string>();

  // Collect all asset IDs referenced by the design
  for (const page of design.pages) {
    for (const el of page.elements) {
      if (el.type === "image" && el.assetId) {
        assetIds.add(el.assetId);
      }
    }
  }
  for (const spread of design.spreads || []) {
    if (spread.assetId) {
      assetIds.add(spread.assetId);
    }
  }

  for (const id of assetIds) {
    assets.set(id, {
      id,
      mimeType: "image/png",
      bytes: new Uint8Array(minimalPng),
      width: 1200,
      height: 800,
    });
  }

  return assets;
}

// -----------------------------------------------------------------------
// Step 4: Render PDF via Part 2 Print Engine
// -----------------------------------------------------------------------

/**
 * Renders the PDF using the Part 2 Print Engine (render-document.ts).
 * Never uses Konva, html2canvas, browser rendering, or screenshots.
 */
export async function renderPdfDocument(
  design: BookDesign,
  assets: Map<string, RenderAsset>,
): Promise<{ pdfBytes: Uint8Array; pageCount: number; warnings: string[] }> {
  try {
    const result = await renderDocument(design, assets, {
      outputDpi: 300,
    });

    return {
      pdfBytes: result.pdfBytes,
      pageCount: result.pageCount,
      warnings: result.warnings || [],
    };
  } catch (err: unknown) {
    const classified = classifyExportError(err);
    throw new PdfExportError(
      `Part 2 Print Engine rendering failed: ${classified.message}`,
      "PDF_EXPORT_RENDER_ERROR",
      classified.retryable,
      err,
    );
  }
}

// -----------------------------------------------------------------------
// Main Export Orchestrator
// -----------------------------------------------------------------------

/**
 * Runs the complete export pipeline for a single export record.
 * Called by the PDF_EXPORT job worker (runPdfExportJob / runPdfExportWorker).
 *
 * Pipeline:
 *   LOADING     → load persisted design
 *   VALIDATING  → validate print engine constraints
 *   RENDERING   → render via Part 2 (server-side, no browser)
 *   FINALIZING  → validate PDF, compute checksum, upload, persist metadata
 *   COMPLETE    → return result
 */
export async function runExportService(
  ctx: ExportContext,
  onProgress?: ExportProgressCallback,
): Promise<ExportServiceResult> {
  const { exportId, bookId, userId, jobId } = ctx;
  const exportRepo = getPdfExportRepository();

  // LOADING
  onProgress?.("LOADING", 10);
  await exportRepo.update(exportId, { status: "RUNNING" });

  const design = await loadPersistedDesign(bookId);
  const designHash = computeDesignHash(design);

  // VALIDATING
  onProgress?.("VALIDATING", 25);
  validateDesignForExport(design);

  const assets = await resolveAssets(design);

  // RENDERING
  onProgress?.("RENDERING", 50);
  const { pdfBytes, pageCount, warnings } = await renderPdfDocument(design, assets);

  // FINALIZING
  onProgress?.("FINALIZING", 80);

  // Post-render PDF structural validation
  await validatePdfArtifact(pdfBytes, {
    expectedPageCount: pageCount,
    expectedWidthMm: design.document.widthMm,
    expectedHeightMm: design.document.heightMm,
  });

  // Compute checksum AFTER validation
  const sha256 = computePdfSha256(pdfBytes);
  const fileSizeBytes = pdfBytes.byteLength;

  // Upload to private storage
  const storagePath = await uploadPdf(userId, bookId, designHash, pdfBytes);

  // Persist final metadata
  const expiresAt = new Date(
    Date.now() + PDF_RETENTION_DAYS * 24 * 3600 * 1000,
  ).toISOString();

  await exportRepo.update(exportId, {
    status: "SUCCEEDED",
    jobId: jobId,
    storagePath,
    fileSizeBytes,
    pageCount,
    widthMm: design.document.widthMm,
    heightMm: design.document.heightMm,
    sha256,
    completedAt: new Date().toISOString(),
    expiresAt,
  });

  // COMPLETE
  onProgress?.("COMPLETE", 100);

  return {
    exportId,
    storagePath,
    designHash,
    fileSizeBytes,
    pageCount,
    widthMm: design.document.widthMm,
    heightMm: design.document.heightMm,
    sha256,
    warnings,
  };
}

// -----------------------------------------------------------------------
// Top-level: Trigger PDF_EXPORT async job
// -----------------------------------------------------------------------

/**
 * Creates a PDF export record + a corresponding PDF_EXPORT job.
 * Enforces idempotency:
 *   - Returns existing SUCCEEDED export if designHash matches.
 *   - Returns existing QUEUED/RUNNING job if active for same hash.
 *   - Creates a fresh execution for retry after failure (terminal jobs
 *     are never resurrected; a new record + job is created).
 */
export async function triggerPdfExport(
  bookId: string,
  userId: string,
): Promise<{
  exportId: string;
  jobId: string;
  designHash: string;
  reused: boolean;
}> {
  // 1. Load and validate persisted design
  const design = await loadPersistedDesign(bookId);
  const designHash = computeDesignHash(design);

  // Verify book ownership
  const bookRepo = getBookRepository();
  const book = await bookRepo.getBookById(bookId);
  if (!book) {
    throw new PdfExportError("Book not found.", "PDF_EXPORT_DESIGN_INVALID", false);
  }
  if (book.userId !== userId) {
    throw new PdfExportError("Unauthorized.", "PDF_EXPORT_DESIGN_INVALID", false);
  }

  const exportRepo = getPdfExportRepository();

  // 2. Check for existing SUCCEEDED export with same designHash
  const existingSucceeded = await exportRepo.getByDesignHash(bookId, designHash);
  if (existingSucceeded) {
    return {
      exportId: existingSucceeded.id,
      jobId: existingSucceeded.jobId || `job_export_${bookId}_reused`,
      designHash,
      reused: true,
    };
  }

  // 3. Check for existing ACTIVE export with same designHash
  const existingActive = await exportRepo.getActiveByBookId(bookId, designHash);
  if (existingActive) {
    return {
      exportId: existingActive.id,
      jobId: existingActive.jobId || `job_export_${bookId}_active`,
      designHash,
      reused: false,
    };
  }

  // 4. Create fresh export record and job
  const exportId = `exp_${bookId}_${Date.now()}`;
  const jobId = `job_export_${bookId}_${Date.now()}`;

  const exportRecord: PdfExportRecord = {
    id: exportId,
    bookId,
    jobId,
    userId,
    designHash,
    schemaVersion: design.schemaVersion,
    status: "QUEUED",
    createdAt: new Date().toISOString(),
  };

  await exportRepo.create(exportRecord);

  // Create the background job record
  const { getJobRepository } = await import("@/lib/jobs/storage");
  const jobRepo = getJobRepository();
  await jobRepo.createJob({
    id: jobId,
    bookId,
    userId,
    type: "PDF_EXPORT",
    status: "QUEUED",
    progress: 0,
    attempts: 0,
    maxAttempts: 1,
    stepDetails: { designHash, exportId },
    idempotencyKey: `pdf_export_${bookId}_${designHash.slice(0, 16)}`,
    createdAt: new Date().toISOString(),
  });

  return { exportId, jobId, designHash, reused: false };
}

/**
 * Runs the export job asynchronously.
 * This is called after triggerPdfExport() to do the actual work.
 */
export async function runPdfExportWorker(
  exportId: string,
  bookId: string,
  userId: string,
  jobId: string,
): Promise<void> {
  const exportRepo = getPdfExportRepository();
  const bookRepo = getBookRepository();
  const { getJobRepository } = await import("@/lib/jobs/storage");
  const jobRepo = getJobRepository();

  // QUEUED -> RUNNING
  try {
    await jobRepo.updateJob(jobId, {
      status: "RUNNING",
      attempts: 1,
      startedAt: new Date().toISOString(),
      progress: 10,
    });
  } catch {
    // Job may have been updated by concurrent caller — proceed
  }

  await bookRepo.updateBookStatus(bookId, "EXPORTING");

  try {
    await runExportService(
      { exportId, bookId, userId, jobId },
      async (step, progress) => {
        try {
          await jobRepo.updateJob(jobId, {
            currentStep: step,
            progress,
          });
        } catch {
          // Non-critical progress update failure
        }
      },
    );

    // Job -> SUCCEEDED
    await jobRepo.updateJob(jobId, {
      status: "SUCCEEDED",
      progress: 100,
      currentStep: "COMPLETE",
      completedAt: new Date().toISOString(),
    });

    await bookRepo.updateBookStatus(bookId, "COMPLETED");
  } catch (err: unknown) {
    const classified = classifyExportError(err);
    const rawMsg = err instanceof Error ? err.message : String(err);

    console.error(
      `[export/service] runPdfExportWorker FAILED exportId=${exportId} jobId=${jobId}:`,
      rawMsg,
    );

    // Mark export record as FAILED
    try {
      await exportRepo.update(exportId, {
        status: "FAILED",
        errorCode: classified.code,
        errorMessage: classified.message,
        completedAt: new Date().toISOString(),
      });
    } catch {
      // Best-effort
    }

    // Mark job as FAILED
    try {
      await jobRepo.updateJob(jobId, {
        status: "FAILED",
        errorCode: classified.code,
        errorMessage: classified.message,
        completedAt: new Date().toISOString(),
      });
    } catch {
      // Best-effort
    }

    // Return book to EDITING — never mark book permanently as FAILED
    await bookRepo.updateBookStatus(bookId, "EDITING");
  }
}
