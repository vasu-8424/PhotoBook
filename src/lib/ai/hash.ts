import crypto from "crypto";

/**
 * Deterministically sorts object keys for consistent hashing.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalStringify(obj[key])}`,
  );
  return `{${entries.join(",")}}`;
}

/**
 * Computes a deterministic SHA-256 hash for any input structure.
 */
export function computeInputHash(data: unknown): string {
  const canonicalJson = canonicalStringify(data);
  return crypto.createHash("sha256").update(canonicalJson).digest("hex");
}
