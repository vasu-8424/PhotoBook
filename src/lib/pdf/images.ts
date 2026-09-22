import { type PDFDocument, type PDFImage } from "pdf-lib";
import { MM_PER_INCH } from "./constants";
import { PrintEngineError } from "./errors";
import type { RenderAsset } from "./types";

const docImageCache = new WeakMap<PDFDocument, Map<string, PDFImage>>();

export function isSupportedImageMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().trim();
  return (
    normalized === "image/jpeg" ||
    normalized === "image/jpg" ||
    normalized === "image/png"
  );
}

export function calculateEffectiveDpi(
  sourcePixelWidth: number,
  sourcePixelHeight: number,
  renderedWidthMm: number,
  renderedHeightMm: number,
): number {
  if (renderedWidthMm <= 0 || renderedHeightMm <= 0) {
    return 0;
  }
  const renderedWidthInches = renderedWidthMm / MM_PER_INCH;
  const renderedHeightInches = renderedHeightMm / MM_PER_INCH;

  const dpiX = sourcePixelWidth / renderedWidthInches;
  const dpiY = sourcePixelHeight / renderedHeightInches;

  return Math.round(Math.min(dpiX, dpiY));
}

export async function getOrEmbedImage(
  pdfDoc: PDFDocument,
  asset: RenderAsset,
): Promise<PDFImage> {
  if (!isSupportedImageMimeType(asset.mimeType)) {
    throw new PrintEngineError(
      `Unsupported image format '${asset.mimeType}'. Supported formats are JPEG and PNG.`,
      "UNSUPPORTED_ASSET",
      { assetId: asset.id, mimeType: asset.mimeType },
    );
  }

  let docCache = docImageCache.get(pdfDoc);
  if (!docCache) {
    docCache = new Map();
    docImageCache.set(pdfDoc, docCache);
  }

  const existing = docCache.get(asset.id);
  if (existing) {
    return existing;
  }

  let embedded: PDFImage;
  const normalized = asset.mimeType.toLowerCase().trim();

  try {
    if (normalized === "image/jpeg" || normalized === "image/jpg") {
      embedded = await pdfDoc.embedJpg(asset.bytes);
    } else if (normalized === "image/png") {
      embedded = await pdfDoc.embedPng(asset.bytes);
    } else {
      throw new PrintEngineError(
        `Unsupported image format '${asset.mimeType}'`,
        "UNSUPPORTED_ASSET",
      );
    }
  } catch (err: unknown) {
    if (err instanceof PrintEngineError) {
      throw err;
    }
    throw new PrintEngineError(
      `Failed to embed image asset '${asset.id}': ${err instanceof Error ? err.message : String(err)}`,
      "INVALID_ASSET",
      { assetId: asset.id, error: err },
    );
  }

  docCache.set(asset.id, embedded);
  return embedded;
}
