/**
 * Structured Error Model for Part 9 Orchestration & Background Jobs
 */

export type JobErrorCode =
  | "JOB_NOT_FOUND"
  | "BOOK_NOT_FOUND"
  | "UNAUTHORIZED"
  | "PHOTO_PROCESSING_FAILED"
  | "INSUFFICIENT_PHOTOS"
  | "VISION_ANALYSIS_FAILED"
  | "EDITORIAL_GENERATION_FAILED"
  | "DESIGN_GENERATION_FAILED"
  | "PDF_EXPORT_FAILED"
  | "DUPLICATE_JOB_ACTIVE"
  | "DESIGN_SAVE_REQUIRED"
  | "JOB_CANCELLED"
  | "TRANSIENT_FAILURE"
  | "MISSING_DESIGN"
  | "INVALID_GEOMETRY"
  | "INVALID_BOOK_STATE"
  | "INVALID_SCHEMA"
  | "INVALID_ASSET"
  | "INVALID_FONT"
  | "AUTH_ERROR"
  | "PERMISSION_ERROR"
  | "CONTENT_REFUSAL"
  | "COST_LIMIT"
  | "MISSING_BOOK"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "UNEXPECTED_ERROR";


export class JobExecutionError extends Error {
  public readonly code: JobErrorCode;
  public readonly retryable: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: JobErrorCode = "UNEXPECTED_ERROR",
    retryable: boolean = false,
    details?: unknown,
  ) {
    super(message);
    this.name = "JobExecutionError";
    this.code = code;
    this.retryable = retryable;
    this.details = details;
    Object.setPrototypeOf(this, JobExecutionError.prototype);
  }
}

export function getUserFriendlyJobError(code: JobErrorCode, rawMessage?: string): string {
  switch (code) {
    case "UNAUTHORIZED":
      return "You do not have permission to view or manage this book.";
    case "BOOK_NOT_FOUND":
      return "The requested photo magazine could not be found.";
    case "INSUFFICIENT_PHOTOS":
      return "Please select at least 5 photos to create a magazine.";
    case "PHOTO_PROCESSING_FAILED":
      return "We could not process one or more of your photos. Your files remain safe.";
    case "VISION_ANALYSIS_FAILED":
      return "Vision AI analysis encountered a temporary problem understanding your photos.";
    case "EDITORIAL_GENERATION_FAILED":
      return "Editorial AI encountered an issue sequencing your narrative.";
    case "DESIGN_GENERATION_FAILED":
      return "Design AI could not finalize the magazine layout. You can retry safely.";
    case "PDF_EXPORT_FAILED":
      return "Unable to render print PDF. Please ensure all modifications are saved and try again.";
    case "JOB_CANCELLED":
      return "Generation was cancelled.";
    default:
      return (
        rawMessage ||
        "Something went wrong while creating your magazine. Your uploaded photos are still safe. You can retry generation."
      );
  }
}
