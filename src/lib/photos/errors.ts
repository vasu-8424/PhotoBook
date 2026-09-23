export type PhotoPipelineErrorCode =
  | "PHOTO_FILE_MISSING"
  | "PHOTO_FILE_TOO_LARGE"
  | "PHOTO_UNSUPPORTED_FORMAT"
  | "PHOTO_INVALID_MIME"
  | "PHOTO_CORRUPTED"
  | "PHOTO_DIMENSIONS_TOO_LARGE"
  | "PHOTO_TOO_MANY_PIXELS"
  | "PHOTO_PROCESSING_FAILED"
  | "PHOTO_STORAGE_FAILED"
  | "PHOTO_NOT_FOUND"
  | "PHOTO_ACCESS_DENIED"
  | "PHOTO_EXPIRED";

export class PhotoPipelineError extends Error {
  public readonly code: PhotoPipelineErrorCode;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: PhotoPipelineErrorCode,
    details?: unknown,
  ) {
    super(message);
    this.name = "PhotoPipelineError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, PhotoPipelineError.prototype);
  }
}

export const USER_FRIENDLY_ERROR_MESSAGES: Record<
  PhotoPipelineErrorCode,
  string
> = {
  PHOTO_FILE_MISSING: "No photo file was provided.",
  PHOTO_FILE_TOO_LARGE: "This photo is larger than the 25MB allowed file size limit.",
  PHOTO_UNSUPPORTED_FORMAT:
    "Unsupported image format. Please upload a JPEG, PNG, or WebP photo.",
  PHOTO_INVALID_MIME: "The photo's reported file type does not match its contents.",
  PHOTO_CORRUPTED:
    "The photo file appears to be corrupted and cannot be opened.",
  PHOTO_DIMENSIONS_TOO_LARGE:
    "The image width or height exceeds our maximum supported dimension limit (12,000px).",
  PHOTO_TOO_MANY_PIXELS:
    "The total image resolution is too high to process safely.",
  PHOTO_PROCESSING_FAILED:
    "An error occurred while preparing your photo. Please try uploading it again.",
  PHOTO_STORAGE_FAILED:
    "Unable to save the photo to secure storage. Please try again.",
  PHOTO_NOT_FOUND: "The requested photo could not be found.",
  PHOTO_ACCESS_DENIED: "You do not have permission to access this photo.",
  PHOTO_EXPIRED: "This temporary photo has expired.",
};

export function getUserFriendlyErrorMessage(
  errorOrCode: PhotoPipelineErrorCode | PhotoPipelineError | Error,
): string {
  if (typeof errorOrCode === "string") {
    return (
      USER_FRIENDLY_ERROR_MESSAGES[errorOrCode] ||
      "An unexpected error occurred while processing your photo."
    );
  }
  if (errorOrCode instanceof PhotoPipelineError) {
    return (
      USER_FRIENDLY_ERROR_MESSAGES[errorOrCode.code] ||
      errorOrCode.message
    );
  }
  return "An unexpected error occurred while processing your photo.";
}
