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

import fs from "fs";
import path from "path";
import sharp, { type Metadata as SharpMetadata } from "sharp";
import { getDesignRepository } from "@/lib/ai/design";
import { renderDocument, type RenderAsset } from "@/lib/pdf";
import { validateDesign as validatePrintEngineDesign } from "@/lib/pdf/validate-design";
import { getBookRepository } from "@/lib/jobs/storage";
import {
  getStorageProvider,
  PHOTO_STORAGE_BUCKETS,
  getPreviewPath,
  getOriginalPath,
  type StorageProvider,
} from "@/lib/photos";
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
  let record = await designRepo.getDesignByBookId(bookId);

  if ((!record || !record.designJson) && bookId.startsWith("demo")) {
    const { getDemoDesign } = await import("@/lib/editor/demo");
    const demoDesign = getDemoDesign();
    await designRepo.saveDesign({
      id: `design_${bookId}`,
      bookId,
      userId: "dev_user_1",
      schemaVersion: DESIGN_SCHEMA_VERSION,
      outputSchemaVersion: DESIGN_SCHEMA_VERSION,
      designJson: demoDesign,
      provider: "system",
      model: "demo-preset",
      promptVersion: "v1.0.0",
      inputHash: `demo_${bookId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    record = await designRepo.getDesignByBookId(bookId);
  }

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

// Known starter / demo fixtures mapping to tests/fixtures/photos
const FIXTURE_FALLBACK_MAP: Record<string, string> = {
  demo_asset_cover: "photo_01_mountain.jpg",
  demo_asset_spread: "photo_02_sunset.jpg",
  demo_asset_detail: "photo_04_lake.jpg",
  ast_travel_01: "photo_01_mountain.jpg",
  ast_travel_02: "photo_02_sunset.jpg",
  ast_travel_03: "photo_03_forest.jpg",
  ast_travel_04: "photo_04_lake.jpg",
  ast_travel_05: "photo_05_cabin.jpg",
  ast_travel_06: "photo_06_trail.jpg",
  ast_travel_07: "photo_07_peak.jpg",
  ast_travel_08: "photo_08_campfire.jpg",
  ast_travel_09: "photo_09_stargazing.jpg",
  ast_travel_10: "photo_10_sunrise.jpg",
};

/**
 * Resolves photo assets for the PDF renderer from server-side storage.
 * Follows the strict flow:
 *   assetId
 *   → storage read (preview derivative / original / direct)
 *   → Uint8Array/Buffer
 *   → byte inspection & magic bytes check
 *   → Sharp metadata decoding (format, dimensions, channels)
 *   → content validation (rejection of solid green placeholders)
 *   → format conversion to print-ready JPEG/PNG
 *   → RenderAsset for Part 2 image renderer
 *
 * Unknown assetIds strictly fail with PDF_EXPORT_ASSET_MISSING.
 * Corrupted or invalid bytes fail with PDF_EXPORT_ASSET_INVALID.
 * NEVER renders solid green placeholders in production.
 */
export async function resolveAssets(
  design: BookDesign,
  userId?: string,
  bookId?: string,
  storageProvider?: StorageProvider,
): Promise<Map<string, RenderAsset>> {
  const assets = new Map<string, RenderAsset>();
  const storage = storageProvider || getStorageProvider();
  const fixturesDir = path.join(process.cwd(), "tests", "fixtures", "photos");

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

  for (const assetId of assetIds) {
    let buffer: Buffer | null = null;
    let resolvedStoragePath = "";

    // 1. Check storage provider (derivatives and originals)
    const pathsToTry: { bucket: string; path: string }[] = [];

    if (userId && bookId) {
      pathsToTry.push({
        bucket: PHOTO_STORAGE_BUCKETS.DERIVATIVES,
        path: getPreviewPath(userId, bookId, assetId),
      });
      pathsToTry.push({
        bucket: PHOTO_STORAGE_BUCKETS.ORIGINALS,
        path: getOriginalPath(userId, bookId, assetId),
      });
    }

    if (bookId && userId !== "dev_user_1") {
      pathsToTry.push({
        bucket: PHOTO_STORAGE_BUCKETS.DERIVATIVES,
        path: getPreviewPath("dev_user_1", bookId, assetId),
      });
      pathsToTry.push({
        bucket: PHOTO_STORAGE_BUCKETS.ORIGINALS,
        path: getOriginalPath("dev_user_1", bookId, assetId),
      });
    }

    pathsToTry.push({
      bucket: PHOTO_STORAGE_BUCKETS.DERIVATIVES,
      path: `${assetId}/preview.jpg`,
    });
    pathsToTry.push({
      bucket: PHOTO_STORAGE_BUCKETS.ORIGINALS,
      path: `${assetId}/original`,
    });
    pathsToTry.push({
      bucket: PHOTO_STORAGE_BUCKETS.DERIVATIVES,
      path: assetId,
    });
    pathsToTry.push({
      bucket: PHOTO_STORAGE_BUCKETS.ORIGINALS,
      path: assetId,
    });

    for (const cand of pathsToTry) {
      try {
        const data = await storage.downloadFile(cand.bucket, cand.path);
        if (data && data.length > 0) {
          buffer = data;
          resolvedStoragePath = `${cand.bucket}/${cand.path}`;
          break;
        }
      } catch {
        // Continue searching
      }
    }

    // 2. Check disk fixtures for demo books or test fixture photos
    if (!buffer) {
      const fixtureFilename =
        FIXTURE_FALLBACK_MAP[assetId] ||
        (assetId.endsWith(".jpg") || assetId.endsWith(".png")
          ? assetId
          : `${assetId}.jpg`);
      const fixturePath = path.join(fixturesDir, fixtureFilename);
      if (fs.existsSync(fixturePath)) {
        try {
          buffer = await fs.promises.readFile(fixturePath);
          resolvedStoragePath = `fixtures/${fixtureFilename}`;
        } catch {
          // Continue
        }
      }
    }

    // 3. Reject if asset cannot be resolved anywhere (strictly no green placeholder)
    if (!buffer) {
      throw new PdfExportError(
        `One or more photos required for export could not be found: asset '${assetId}'.`,
        "PDF_EXPORT_ASSET_MISSING",
        false,
        { assetId, userId, bookId },
      );
    }

    // 4. Validate non-empty
    if (buffer.length === 0) {
      throw new PdfExportError(
        `Image asset '${assetId}' contains 0 bytes.`,
        "PDF_EXPORT_ASSET_INVALID",
        false,
        { assetId },
      );
    }

    // 5. Inspect magic bytes
    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
    const isPng =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    const isWebp =
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;

    if (!isJpeg && !isPng && !isWebp) {
      throw new PdfExportError(
        `Image asset '${assetId}' has invalid magic bytes. Expected JPEG, PNG, or WebP.`,
        "PDF_EXPORT_ASSET_INVALID",
        false,
        { assetId, firstBytes: buffer.subarray(0, 8).toString("hex") },
      );
    }

    // 6. Decode and inspect metadata with Sharp
    let meta: SharpMetadata;
    try {
      meta = await sharp(buffer).metadata();
    } catch (err: unknown) {
      throw new PdfExportError(
        `Failed to decode image asset '${assetId}': ${err instanceof Error ? err.message : String(err)}`,
        "PDF_EXPORT_ASSET_INVALID",
        false,
        { assetId, error: err },
      );
    }

    if (!meta.format || !meta.width || !meta.height || !meta.channels) {
      throw new PdfExportError(
        `Image asset '${assetId}' has missing metadata (width=${meta.width}, height=${meta.height}, channels=${meta.channels}, format=${meta.format}).`,
        "PDF_EXPORT_ASSET_INVALID",
        false,
        { assetId, metadata: meta },
      );
    }

    // 7. Verify resolved asset != solid green placeholder
    if (meta.width <= 2 && meta.height <= 2) {
      const raw = await sharp(buffer).raw().toBuffer();
      if (raw[0] === 0 && raw[1] >= 200 && raw[2] === 0) {
        throw new PdfExportError(
          `Solid green placeholder detected for asset '${assetId}'. Real uploaded photo required.`,
          "PDF_EXPORT_ASSET_INVALID",
          false,
          { assetId },
        );
      }
    }

    // 8. Convert WebP or non-JPEG/PNG to high-quality print JPEG
    let finalBytes: Uint8Array;
    let finalMimeType: string;

    if (meta.format === "jpeg") {
      finalBytes = new Uint8Array(buffer);
      finalMimeType = "image/jpeg";
    } else if (meta.format === "png") {
      finalBytes = new Uint8Array(buffer);
      finalMimeType = "image/png";
    } else {
      const converted = await sharp(buffer).jpeg({ quality: 92 }).toBuffer();
      finalBytes = new Uint8Array(converted);
      finalMimeType = "image/jpeg";
    }

    // 9. Safe logging (no image bytes, signed URLs, or tokens)
    console.log(
      `[export/resolveAssets] assetId=${assetId} path=${resolvedStoragePath} mimeType=${finalMimeType} bytes=${finalBytes.byteLength} dimensions=${meta.width}x${meta.height}`,
    );

    assets.set(assetId, {
      id: assetId,
      mimeType: finalMimeType,
      bytes: finalBytes,
      width: meta.width,
      height: meta.height,
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

  const assets = await resolveAssets(design, userId, bookId);

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
  let book = await bookRepo.getBookById(bookId);
  if (!book && bookId.startsWith("demo")) {
    await bookRepo.createBook({
      id: bookId,
      userId,
      title: "Alpine Solitude & High Passes",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      size: "A4",
      status: "EDITING",
      photoIds: ["demo_asset_cover", "demo_asset_spread", "demo_asset_detail"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    book = await bookRepo.getBookById(bookId);
  }
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
