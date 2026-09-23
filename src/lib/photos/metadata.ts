import crypto from "crypto";
import type { PhotoOrientation } from "@/types/photo";

export function calculateOrientation(
  width: number,
  height: number,
): PhotoOrientation {
  if (width <= 0 || height <= 0) {
    return "SQUARE";
  }

  const ratio = width / height;
  // If within 5% of square, classify as SQUARE
  if (ratio >= 0.95 && ratio <= 1.05) {
    return "SQUARE";
  }

  return ratio > 1.05 ? "LANDSCAPE" : "PORTRAIT";
}

export function calculateAspectRatio(width: number, height: number): number {
  if (width <= 0 || height <= 0) {
    return 1;
  }
  return Number((width / height).toFixed(4));
}

export function computeContentHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
