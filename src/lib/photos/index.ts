export { processUploadedPhoto } from "./process";
export type { ProcessPhotoInput } from "./process";

export { validateImageBuffer } from "./validate";

export {
  generateAIDerivative,
  generatePreviewDerivative,
} from "./derivatives";

export { generateThumbnail } from "./thumbnails";

export {
  calculateOrientation,
  calculateAspectRatio,
  computeContentHash,
} from "./metadata";

export {
  PhotoPipelineError,
  getUserFriendlyErrorMessage,
  USER_FRIENDLY_ERROR_MESSAGES,
} from "./errors";
export type { PhotoPipelineErrorCode } from "./errors";

export {
  generateAssetId,
  getOriginalPath,
  getAIDerivativePath,
  getPreviewPath,
  getThumbnailPath,
  getAssetFolderPath,
  getBookFolderPath,
} from "./paths";

export {
  getStorageProvider,
  setStorageProvider,
  InMemoryStorageProvider,
  SupabaseStorageProvider,
  deleteOriginal,
  deleteDerivatives,
  deleteAllAssetFiles,
} from "./storage";
export type { StorageProvider } from "./storage";

export {
  PHOTO_UPLOAD_CONFIG,
  PHOTO_DIMENSION_LIMITS,
  PHOTO_STORAGE_BUCKETS,
  DERIVATIVE_SPECS,
  PHOTO_RETENTION,
  PHOTO_PROCESSING_VERSION,
  AI_DERIVATIVE_VERSION,
  PREVIEW_VERSION,
  THUMBNAIL_VERSION,
  SUPPORTED_PHOTO_MIME_TYPES,
} from "@/config/photos";
export type { SupportedPhotoMimeType } from "@/config/photos";

export type {
  PhotoAssetStatus,
  ImageValidationResult,
  GeneratedDerivative,
  ProcessedPhotoResult,
  UploadUrlRequest,
  UploadUrlResponse,
  ProcessPhotoRequest,
  SignedUrlOptions,
} from "./types";
