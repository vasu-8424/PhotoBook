import crypto from "crypto";
import type { BookDesign } from "@/types/design";

/**
 * Deterministically sorts object keys deeply to produce stable string representations.
 */
function canonicalizeValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val !== "object") return val;

  if (Array.isArray(val)) {
    return val.map(canonicalizeValue);
  }

  const obj = val as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = canonicalizeValue(obj[k]);
  }
  return sorted;
}

/**
 * Computes a deterministic SHA-256 hash of any JSON-serializable payload.
 */
export function computeDeterministicHash(payload: unknown): string {
  const canonical = canonicalizeValue(payload);
  const jsonStr = JSON.stringify(canonical);
  return crypto.createHash("sha256").update(jsonStr).digest("hex");
}

/**
 * Computes deterministic idempotency key for background jobs.
 */
export function computeJobIdempotencyKey(
  bookId: string,
  jobType: string,
  inputSignature: unknown,
): string {
  const hash = computeDeterministicHash({ bookId, jobType, inputSignature });
  return `job_${bookId}_${jobType.toLowerCase()}_${hash.slice(0, 16)}`;
}

/**
 * Computes a canonical SHA-256 hash of a BookDesign.
 * Ensures reproducible vector PDF exports and cache identity.
 */
export function computeDesignHash(design: BookDesign): string {
  return computeDeterministicHash({
    schemaVersion: design.schemaVersion,
    document: design.document,
    pages: design.pages,
    spreads: design.spreads,
  });
}

/**
 * Computes deterministic export identity to prevent duplicate concurrent exports.
 */
export function computeExportIdempotencyKey(bookId: string, designHash: string): string {
  return `export_${bookId}_${designHash.slice(0, 16)}`;
}
