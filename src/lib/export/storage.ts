/**
 * Part 10 — PDF Export & Print Delivery Engine
 * lib/export/storage.ts
 *
 * PDF storage operations using the existing Part 4 storage provider.
 * All PDFs are stored in the PRIVATE 'book-pdfs' bucket.
 * No public URLs are ever generated.
 */

import { getStorageProvider } from "@/lib/photos";
import { PDF_RETENTION } from "@/config/jobs";
import { PdfExportError } from "./errors";
import { computeExportStoragePath } from "./hash";

export const PDF_BUCKET = PDF_RETENTION.bucket; // "book-pdfs"

/** Duration for signed download URLs (must be short-lived). */
export const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour

/**
 * Uploads the PDF bytes to private storage.
 * Returns the deterministic storage path.
 * Throws PdfExportError with PDF_EXPORT_STORAGE_ERROR on failure.
 */
export async function uploadPdf(
  userId: string,
  bookId: string,
  designHash: string,
  pdfBytes: Uint8Array,
): Promise<string> {
  const storage = getStorageProvider();
  const storagePath = computeExportStoragePath(userId, bookId, designHash);

  try {
    await storage.uploadFile(
      PDF_BUCKET,
      storagePath,
      Buffer.from(pdfBytes),
      "application/pdf",
    );
    return storagePath;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[export/storage] Upload failed for ${storagePath}:`, msg);
    throw new PdfExportError(
      `Failed to store PDF artifact: ${msg}`,
      "PDF_EXPORT_STORAGE_ERROR",
      true,
      err,
    );
  }
}

/**
 * Generates a short-lived signed download URL for a private PDF.
 * NEVER returns a permanent public URL.
 * The signed URL is ephemeral — must not be stored in the database.
 */
export async function generateSignedDownloadUrl(storagePath: string): Promise<{
  url: string;
  expiresInSeconds: number;
}> {
  const storage = getStorageProvider();

  try {
    const url = await storage.createSignedDownloadUrl(PDF_BUCKET, storagePath, {
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    });
    return { url, expiresInSeconds: SIGNED_URL_TTL_SECONDS };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[export/storage] Signed URL generation failed for ${storagePath}:`, msg);
    throw new PdfExportError(
      `Failed to generate download URL: ${msg}`,
      "PDF_EXPORT_STORAGE_ERROR",
      true,
      err,
    );
  }
}

/**
 * Verifies that the PDF artifact still exists in storage.
 * Used before generating a download URL for an existing export.
 */
export async function verifyPdfExists(storagePath: string): Promise<boolean> {
  const storage = getStorageProvider();
  try {
    // Attempt to generate a signed URL — success implies artifact exists
    await storage.createSignedDownloadUrl(PDF_BUCKET, storagePath, {
      expiresInSeconds: 60,
    });
    return true;
  } catch {
    return false;
  }
}
