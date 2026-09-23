import type { PhotoOrientation } from "@/types/photo";

export type PhotoAssetStatus =
  | "UPLOADING"
  | "UPLOADED"
  | "VALIDATING"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "EXPIRED"
  | "DELETING";

export interface ImageValidationResult {
  valid: boolean;
  format: "jpeg" | "png" | "webp";
  mimeType: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  hasExif: boolean;
  orientation?: number;
}

export interface GeneratedDerivative {
  buffer: Buffer;
  width: number;
  height: number;
  format: "jpeg";
  fileSizeBytes: number;
  storagePath: string;
}

export interface ProcessedPhotoResult {
  assetId: string;
  userId: string;
  bookId: string;
  originalFilename: string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: number;
  orientation: PhotoOrientation;
  fileSizeBytes: number;
  contentHash: string;
  status: PhotoAssetStatus;
  originalStoragePath: string;
  aiDerivative: GeneratedDerivative;
  previewDerivative: GeneratedDerivative;
  thumbnail: GeneratedDerivative;
  processingVersion: string;
  createdAt: string;
  expiresAt: string;
}

export interface UploadUrlRequest {
  userId: string;
  bookId: string;
  filename: string;
  fileSizeBytes: number;
  mimeType: string;
}

export interface UploadUrlResponse {
  assetId: string;
  uploadUrl: string;
  storagePath: string;
  bucket: string;
  expiresInSeconds: number;
}

export interface ProcessPhotoRequest {
  assetId: string;
  userId: string;
  bookId: string;
  originalFilename: string;
}

export interface SignedUrlOptions {
  expiresInSeconds?: number;
}
