export const PHOTO_UPLOAD_CONFIG = {
  minPhotos: 10,
  maxPhotos: 50,
  maxFileSizeBytes: 25 * 1024 * 1024, // 25 MB
} as const;

export const PHOTO_DIMENSION_LIMITS = {
  maxWidth: 12000,
  maxHeight: 12000,
  maxPixels: 60_000_000,
} as const;

export const PHOTO_STORAGE_BUCKETS = {
  ORIGINALS: "photo-originals",
  DERIVATIVES: "photo-derivatives",
  THUMBNAILS: "photo-thumbnails",
} as const;

export const DERIVATIVE_SPECS = {
  AI: {
    format: "jpeg",
    quality: 85,
    maxDimension: 2048,
  },
  PREVIEW: {
    format: "jpeg",
    quality: 90,
    maxDimension: 2560,
  },
  THUMBNAIL: {
    format: "jpeg",
    quality: 80,
    maxDimension: 400,
  },
} as const;

export const PHOTO_RETENTION = {
  originalRetentionHours: 24,
  derivativeRetentionDays: 7,
} as const;

export const PHOTO_PROCESSING_VERSION = "photo-processing-v1";
export const AI_DERIVATIVE_VERSION = "ai-derivative-v1";
export const PREVIEW_VERSION = "preview-v1";
export const THUMBNAIL_VERSION = "thumbnail-v1";

export const SUPPORTED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type SupportedPhotoMimeType = (typeof SUPPORTED_PHOTO_MIME_TYPES)[number];
