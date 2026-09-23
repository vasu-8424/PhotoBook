import crypto from "crypto";

function sanitizeSegment(segment: string): string {
  // Allow only alphanumeric characters, hyphens, and underscores
  const clean = segment.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) {
    throw new Error(`Invalid path segment: ${segment}`);
  }
  return clean;
}

export function generateAssetId(): string {
  return `photo_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function getOriginalPath(
  userId: string,
  bookId: string,
  assetId: string,
): string {
  return `${sanitizeSegment(userId)}/${sanitizeSegment(bookId)}/${sanitizeSegment(assetId)}/original`;
}

export function getAIDerivativePath(
  userId: string,
  bookId: string,
  assetId: string,
): string {
  return `${sanitizeSegment(userId)}/${sanitizeSegment(bookId)}/${sanitizeSegment(assetId)}/ai.jpg`;
}

export function getPreviewPath(
  userId: string,
  bookId: string,
  assetId: string,
): string {
  return `${sanitizeSegment(userId)}/${sanitizeSegment(bookId)}/${sanitizeSegment(assetId)}/preview.jpg`;
}

export function getThumbnailPath(
  userId: string,
  bookId: string,
  assetId: string,
): string {
  return `${sanitizeSegment(userId)}/${sanitizeSegment(bookId)}/${sanitizeSegment(assetId)}/thumb.jpg`;
}

export function getAssetFolderPath(
  userId: string,
  bookId: string,
  assetId: string,
): string {
  return `${sanitizeSegment(userId)}/${sanitizeSegment(bookId)}/${sanitizeSegment(assetId)}`;
}

export function getBookFolderPath(userId: string, bookId: string): string {
  return `${sanitizeSegment(userId)}/${sanitizeSegment(bookId)}`;
}
