import sharp, { type Metadata } from "sharp";
import {
  PHOTO_UPLOAD_CONFIG,
  PHOTO_DIMENSION_LIMITS,
} from "@/config/photos";
import { PhotoPipelineError } from "./errors";
import type { ImageValidationResult } from "./types";

export async function validateImageBuffer(
  buffer: Buffer,
  reportedMimeType?: string,
): Promise<ImageValidationResult> {
  // 1. Non-empty check
  if (!buffer || buffer.length === 0) {
    throw new PhotoPipelineError(
      "The uploaded photo file is empty.",
      "PHOTO_FILE_MISSING",
    );
  }

  // 2. File size limit check
  if (buffer.length > PHOTO_UPLOAD_CONFIG.maxFileSizeBytes) {
    throw new PhotoPipelineError(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of ${PHOTO_UPLOAD_CONFIG.maxFileSizeBytes / (1024 * 1024)} MB.`,
      "PHOTO_FILE_TOO_LARGE",
      { fileSizeBytes: buffer.length, maxSizeBytes: PHOTO_UPLOAD_CONFIG.maxFileSizeBytes },
    );
  }

  // 3. Inspect image metadata via Sharp (inspects actual header/magic bytes)
  let metadata: Metadata;
  try {
    const image = sharp(buffer);
    metadata = await image.metadata();
  } catch (err: unknown) {
    throw new PhotoPipelineError(
      `The file could not be parsed as an image: ${err instanceof Error ? err.message : String(err)}`,
      "PHOTO_CORRUPTED",
      { error: err },
    );
  }

  // 4. Validate format
  const format = metadata.format;
  if (!format || (format !== "jpeg" && format !== "png" && format !== "webp")) {
    throw new PhotoPipelineError(
      `Unsupported image format '${format || "unknown"}'. Only JPEG, PNG, and WebP are supported.`,
      "PHOTO_UNSUPPORTED_FORMAT",
      { format },
    );
  }

  // Validate reported MIME type if provided
  const actualMimeType = `image/${format === "jpeg" ? "jpeg" : format}`;
  if (reportedMimeType) {
    const normReported = reportedMimeType.toLowerCase().trim();
    const isJpegMatch =
      (normReported === "image/jpeg" || normReported === "image/jpg") &&
      format === "jpeg";
    const isExactMatch = normReported === actualMimeType;

    if (!isJpegMatch && !isExactMatch) {
      throw new PhotoPipelineError(
        `Reported MIME type '${reportedMimeType}' does not match actual image format '${format}'.`,
        "PHOTO_INVALID_MIME",
        { reportedMimeType, actualMimeType },
      );
    }
  }

  // 5. Dimension bounds & decompression bomb checks
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height || width <= 0 || height <= 0) {
    throw new PhotoPipelineError(
      "The image has invalid or missing pixel dimensions.",
      "PHOTO_CORRUPTED",
      { width, height },
    );
  }

  if (
    width > PHOTO_DIMENSION_LIMITS.maxWidth ||
    height > PHOTO_DIMENSION_LIMITS.maxHeight
  ) {
    throw new PhotoPipelineError(
      `Image dimensions (${width}x${height}px) exceed the safety limit (${PHOTO_DIMENSION_LIMITS.maxWidth}x${PHOTO_DIMENSION_LIMITS.maxHeight}px).`,
      "PHOTO_DIMENSIONS_TOO_LARGE",
      { width, height, limits: PHOTO_DIMENSION_LIMITS },
    );
  }

  const totalPixels = width * height;
  if (totalPixels > PHOTO_DIMENSION_LIMITS.maxPixels) {
    throw new PhotoPipelineError(
      `Total image resolution (${(totalPixels / 1_000_000).toFixed(1)} MP) exceeds the safety limit (${PHOTO_DIMENSION_LIMITS.maxPixels / 1_000_000} MP).`,
      "PHOTO_TOO_MANY_PIXELS",
      { totalPixels, maxPixels: PHOTO_DIMENSION_LIMITS.maxPixels },
    );
  }

  // Check for EXIF
  const hasExif = Boolean(metadata.exif || metadata.orientation);

  return {
    valid: true,
    format: format as "jpeg" | "png" | "webp",
    mimeType: actualMimeType,
    width,
    height,
    fileSizeBytes: buffer.length,
    hasExif,
    orientation: metadata.orientation,
  };
}
