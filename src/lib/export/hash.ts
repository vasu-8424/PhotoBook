/**
 * Part 10 — PDF Export & Print Delivery Engine
 * lib/export/hash.ts
 *
 * Deterministic design hash utilities for export idempotency.
 * Delegates to the canonical implementation in lib/jobs/idempotency.ts
 * to ensure a single hashing contract across the application.
 */

import { computeDesignHash, computeDeterministicHash } from "@/lib/jobs/idempotency";
import type { BookDesign } from "@/types/design";

export { computeDesignHash, computeDeterministicHash };

/**
 * Computes the deterministic export storage path.
 * Pattern: {userId}/{bookId}/{designHash}/magazine.pdf
 *
 * IMPORTANT: Never include email, name, or PII in the path.
 * userId here is the Supabase auth UUID (opaque identifier).
 */
export function computeExportStoragePath(
  userId: string,
  bookId: string,
  designHash: string,
): string {
  return `${userId}/${bookId}/${designHash}/magazine.pdf`;
}

/**
 * Computes SHA-256 of the final PDF bytes for integrity verification.
 * This runs after the PDF is rendered and validated.
 */
export function computePdfSha256(pdfBytes: Uint8Array): string {
  // Node.js crypto — safe in server-only export worker context
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.createHash("sha256").update(Buffer.from(pdfBytes)).digest("hex");
}

/**
 * Validates that two design hashes represent the same logical document.
 * Used to confirm idempotency before skipping a re-render.
 */
export function designHashesMatch(hashA: string, hashB: string): boolean {
  return hashA === hashB;
}

/**
 * Generates a deterministic export idempotency key.
 * Used to prevent duplicate active export jobs for the same book + design.
 */
export function computeExportJobIdempotencyKey(bookId: string, designHash: string): string {
  return `pdf_export_${bookId}_${designHash.slice(0, 16)}`;
}

/**
 * Re-exports for callers that only need design hashing from the export layer.
 */
export type { BookDesign };
