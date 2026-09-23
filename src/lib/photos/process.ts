import {
  PHOTO_STORAGE_BUCKETS,
  PHOTO_PROCESSING_VERSION,
  PHOTO_RETENTION,
} from "@/config/photos";
import { PhotoPipelineError } from "./errors";
import { validateImageBuffer } from "./validate";
import { calculateOrientation, calculateAspectRatio, computeContentHash } from "./metadata";
import { generateAIDerivative, generatePreviewDerivative } from "./derivatives";
import { generateThumbnail } from "./thumbnails";
import { getOriginalPath } from "./paths";
import { getStorageProvider, type StorageProvider } from "./storage";
import type { ProcessedPhotoResult } from "./types";

export interface ProcessPhotoInput {
  originalBuffer: Buffer;
  userId: string;
  bookId: string;
  assetId: string;
  originalFilename: string;
  reportedMimeType?: string;
  storageProvider?: StorageProvider;
  saveOriginal?: boolean; // default true
}

export async function processUploadedPhoto(
  input: ProcessPhotoInput,
): Promise<ProcessedPhotoResult> {
  const {
    originalBuffer,
    userId,
    bookId,
    assetId,
    originalFilename,
    reportedMimeType,
    saveOriginal = true,
  } = input;

  const storage = input.storageProvider || getStorageProvider();

  // 1. Validation (byte inspection, format, dimension limits, decompression bomb check)
  const validation = await validateImageBuffer(originalBuffer, reportedMimeType);

  // 2. Compute Content Hash and initial metadata
  const contentHash = computeContentHash(originalBuffer);

  // 3. Generate Derivatives in parallel (Orientation normalized, EXIF stripped)
  const [aiDerivative, previewDerivative, thumbnail] = await Promise.all([
    generateAIDerivative(originalBuffer, userId, bookId, assetId),
    generatePreviewDerivative(originalBuffer, userId, bookId, assetId),
    generateThumbnail(originalBuffer, userId, bookId, assetId),
  ]);

  // Orientation and aspect ratio calculated from normalized derivative dimensions
  const orientation = calculateOrientation(previewDerivative.width, previewDerivative.height);
  const aspectRatio = calculateAspectRatio(previewDerivative.width, previewDerivative.height);

  // 4. Save to secure storage buckets
  const originalStoragePath = getOriginalPath(userId, bookId, assetId);

  try {
    const uploadTasks: Promise<void>[] = [
      // AI derivative
      storage.uploadFile(
        PHOTO_STORAGE_BUCKETS.DERIVATIVES,
        aiDerivative.storagePath,
        aiDerivative.buffer,
        "image/jpeg",
      ),
      // Preview derivative
      storage.uploadFile(
        PHOTO_STORAGE_BUCKETS.DERIVATIVES,
        previewDerivative.storagePath,
        previewDerivative.buffer,
        "image/jpeg",
      ),
      // Thumbnail
      storage.uploadFile(
        PHOTO_STORAGE_BUCKETS.THUMBNAILS,
        thumbnail.storagePath,
        thumbnail.buffer,
        "image/jpeg",
      ),
    ];

    if (saveOriginal) {
      uploadTasks.push(
        storage.uploadFile(
          PHOTO_STORAGE_BUCKETS.ORIGINALS,
          originalStoragePath,
          originalBuffer,
          validation.mimeType,
        ),
      );
    }

    await Promise.all(uploadTasks);
  } catch (err: unknown) {
    throw new PhotoPipelineError(
      `Failed to upload processed derivatives to storage: ${err instanceof Error ? err.message : String(err)}`,
      "PHOTO_STORAGE_FAILED",
      { assetId, error: err },
    );
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + PHOTO_RETENTION.originalRetentionHours * 60 * 60 * 1000,
  );

  return {
    assetId,
    userId,
    bookId,
    originalFilename,
    mimeType: validation.mimeType,
    width: previewDerivative.width,
    height: previewDerivative.height,
    aspectRatio,
    orientation,
    fileSizeBytes: originalBuffer.length,
    contentHash,
    status: "READY",
    originalStoragePath,
    aiDerivative,
    previewDerivative,
    thumbnail,
    processingVersion: PHOTO_PROCESSING_VERSION,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}
