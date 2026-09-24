/**
 * Central configuration for Part 9 & 9A Production Orchestration & Job State Machine
 */

export const JOB_TYPES = {
  BOOK_GENERATION: "BOOK_GENERATION",
  PHOTO_PROCESSING: "PHOTO_PROCESSING",
  VISION_ANALYSIS: "VISION_ANALYSIS",
  EDITORIAL_GENERATION: "EDITORIAL_GENERATION",
  DESIGN_GENERATION: "DESIGN_GENERATION",
  PDF_EXPORT: "PDF_EXPORT",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

export const JOB_STATUSES = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const BOOK_GENERATION_STEPS = [
  "PHOTOS",
  "VISION",
  "EDITORIAL",
  "DESIGN",
  "FINALIZING",
] as const;

export type BookGenerationStep = (typeof BOOK_GENERATION_STEPS)[number];

export interface GenerationMilestone {
  stage: string;
  progressPercent: number;
  label: string;
  userDescription: string;
}

/**
 * Section 49: Deterministic UX milestone progress percentages
 */
export const STEP_PROGRESS_PERCENTAGES: Record<BookGenerationStep | "SUCCEEDED", number> = {
  PHOTOS: 20,
  VISION: 45,
  EDITORIAL: 65,
  DESIGN: 85,
  FINALIZING: 95,
  SUCCEEDED: 100,
};

export const GENERATION_MILESTONES: Record<string, GenerationMilestone> = {
  QUEUED: {
    stage: "QUEUED",
    progressPercent: 5,
    label: "Queued",
    userDescription: "Securing your generation queue...",
  },
  PROCESSING_PHOTOS: {
    stage: "PROCESSING_PHOTOS",
    progressPercent: 20,
    label: "Preparing Photos",
    userDescription: "Normalizing orientations and preparing secure derivatives...",
  },
  ANALYZING_PHOTOS: {
    stage: "ANALYZING_PHOTOS",
    progressPercent: 45,
    label: "Understanding Photos",
    userDescription: "Understanding your memories with Vision AI...",
  },
  CREATING_STORY: {
    stage: "CREATING_STORY",
    progressPercent: 65,
    label: "Finding Story",
    userDescription: "Structuring your narrative and sequence with Editorial AI...",
  },
  DESIGNING: {
    stage: "DESIGNING",
    progressPercent: 85,
    label: "Composing Magazine",
    userDescription: "Composing your layout and typography with Design AI...",
  },
  PREVIEW_READY: {
    stage: "PREVIEW_READY",
    progressPercent: 100,
    label: "Preview Ready",
    userDescription: "Your personal photo magazine is ready to inspect and edit.",
  },
};

/**
 * Section 45: Job-level retry configuration (distinct from AI gateway retries)
 */
export const JOB_RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMs: 1000,
  transientErrorCodes: [
    "NETWORK_ERROR",
    "TIMEOUT",
    "RATE_LIMIT",
    "RATE_LIMIT_429",
    "SERVER_ERROR_5XX",
    "TEMPORARY_PROVIDER_ERROR",
    "TEMPORARY_STORAGE_ERROR",
    "TEMPORARY_DATABASE_ERROR",
    "STORAGE_TIMEOUT",
    "TRANSIENT_FAILURE",
  ],
  nonRetryableErrorCodes: [
    "INVALID_SCHEMA",
    "INVALID_ASSET",
    "INVALID_FONT",
    "INVALID_GEOMETRY",
    "AUTH_ERROR",
    "PERMISSION_ERROR",
    "CONTENT_REFUSAL",
    "COST_LIMIT",
    "MISSING_BOOK",
    "MISSING_DESIGN",
    "UNSUPPORTED_SCHEMA_VERSION",
    "BOOK_NOT_FOUND",
    "JOB_NOT_FOUND",
    "UNAUTHORIZED",
  ],
} as const;

export const PDF_RETENTION = {
  expiresAfterHours: 24,
  bucket: "book-pdfs",
  signedUrlExpiresSeconds: 3600 * 24, // 24 hours
} as const;

