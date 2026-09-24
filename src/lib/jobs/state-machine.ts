/**
 * Part 9A: Authoritative Job State Machine Engine
 *
 * Implements deterministic transition rules, terminal state immutability,
 * forward-only step advancement, book status mapping, and smart resume detection.
 */

import {
  BOOK_GENERATION_STEPS,
  JOB_RETRY_CONFIG,
  JOB_STATUSES,
  STEP_PROGRESS_PERCENTAGES,
  type BookGenerationStep,
  type JobStatus,
} from "@/config/jobs";
import type { BookStatus } from "@/types/book";
import type { BookJob, JobError } from "./types";
import { getStorageProvider, PHOTO_STORAGE_BUCKETS, getAIDerivativePath } from "@/lib/photos";
import { getAnalysisRepository } from "@/lib/ai/vision";
import { getEditorialRepository } from "@/lib/ai/editorial";
import { getDesignRepository } from "@/lib/ai/design";
import { validateDesign as validatePrintEngineDesign } from "@/lib/pdf/validate-design";

// ============================================================================
// Errors
// ============================================================================

export class InvalidJobTransitionError extends Error {
  public readonly currentStatus?: string;
  public readonly targetStatus?: string;
  public readonly jobId?: string;

  constructor(message: string, currentStatus?: string, targetStatus?: string, jobId?: string) {
    super(message);
    this.name = "InvalidJobTransitionError";
    this.currentStatus = currentStatus;
    this.targetStatus = targetStatus;
    this.jobId = jobId;
  }
}

// ============================================================================
// Transition Validation Rules (Sections 3, 4, 5, 36)
// ============================================================================

/**
 * Section 9: Terminal statuses.
 * Once a job reaches one of these, its status must NEVER be mutated.
 */
export const TERMINAL_JOB_STATUSES = new Set<JobStatus>([
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export function isTerminalStatus(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.has(status);
}

/**
 * Valid transitions mapping:
 * QUEUED  -> RUNNING, CANCELLED
 * RUNNING -> SUCCEEDED, FAILED, CANCELLED
 * Terminal statuses have NO valid transitions.
 */
const VALID_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["SUCCEEDED", "FAILED", "CANCELLED", "QUEUED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
};

/**
 * Section 4 & 5: Check if a transition between two JobStatus values is valid.
 */
export function canTransitionJob(
  currentStatus: JobStatus,
  nextStatus: JobStatus,
): boolean {
  if (currentStatus === nextStatus) {
    return false;
  }
  const allowed = VALID_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(nextStatus) : false;
}

/**
 * Section 70: Authoritative transition function for jobs.
 * Rejects invalid transitions and mutations on terminal jobs.
 */
export function transitionJob(
  job: BookJob,
  nextStatus: JobStatus,
  updates?: Partial<BookJob>,
): BookJob {
  if (isTerminalStatus(job.status)) {
    throw new InvalidJobTransitionError(
      `Cannot transition terminal job ${job.id} from status ${job.status} to ${nextStatus}. Terminal states are immutable.`,
      job.status,
      nextStatus,
      job.id,
    );
  }

  if (!canTransitionJob(job.status, nextStatus)) {
    throw new InvalidJobTransitionError(
      `Invalid transition for job ${job.id}: cannot transition from ${job.status} to ${nextStatus}.`,
      job.status,
      nextStatus,
      job.id,
    );
  }

  const now = new Date().toISOString();
  const transitioned: BookJob = {
    ...job,
    ...updates,
    status: nextStatus,
    startedAt:
      nextStatus === "RUNNING"
        ? updates?.startedAt || job.startedAt || now
        : job.startedAt,
    completedAt:
      isTerminalStatus(nextStatus)
        ? updates?.completedAt || job.completedAt || now
        : job.completedAt,
    lastHeartbeatAt:
      nextStatus === "RUNNING"
        ? updates?.lastHeartbeatAt || now
        : job.lastHeartbeatAt,
  };

  return transitioned;
}

// ============================================================================
// Step Transitions (Sections 11, 12, 14, 71)
// ============================================================================

const STEP_SEQUENCE: readonly BookGenerationStep[] = BOOK_GENERATION_STEPS;

/**
 * Validates forward-only step transitions:
 * PHOTOS -> VISION -> EDITORIAL -> DESIGN -> FINALIZING
 */
export function canAdvanceStep(
  currentStep?: BookGenerationStep | string,
  nextStep?: BookGenerationStep,
): boolean {
  if (!nextStep) return false;

  // First step starting from initial/queued state (supports starting at earliest invalid stage on resume)
  if (!currentStep || currentStep === "QUEUED") {
    return true;
  }

  // Same step (re-entering stage on retry)
  if (currentStep === nextStep) {
    return true;
  }

  const currentIndex = STEP_SEQUENCE.indexOf(currentStep as BookGenerationStep);
  const nextIndex = STEP_SEQUENCE.indexOf(nextStep);

  if (currentIndex === -1 || nextIndex === -1) {
    return false;
  }

  // Must advance forward sequentially
  return nextIndex === currentIndex + 1;
}

/**
 * Section 71: Advance internal book generation step.
 */
export function advanceBookGenerationStep(
  job: BookJob,
  nextStep: BookGenerationStep,
  progress?: number,
): BookJob {
  if (job.status !== "RUNNING") {
    throw new InvalidJobTransitionError(
      `Cannot advance step on job ${job.id}: job must be in RUNNING status, but is ${job.status}.`,
      job.status,
      undefined,
      job.id,
    );
  }

  if (!canAdvanceStep(job.currentStep as BookGenerationStep, nextStep)) {
    throw new InvalidJobTransitionError(
      `Invalid step advancement for job ${job.id}: cannot move from step ${job.currentStep} to ${nextStep}. Steps must proceed linearly: ${STEP_SEQUENCE.join(" -> ")}.`,
      job.currentStep,
      nextStep,
      job.id,
    );
  }

  const milestoneProgress =
    progress !== undefined ? progress : STEP_PROGRESS_PERCENTAGES[nextStep];

  return {
    ...job,
    currentStep: nextStep,
    progress: milestoneProgress,
    lastHeartbeatAt: new Date().toISOString(),
  };
}

// ============================================================================
// Book Status Mapping (Section 56, 57, 58)
// ============================================================================

/**
 * Section 56: Exact mapping from Job Step to Product BookStatus.
 */
export function getBookStatusForJobStep(
  step: BookGenerationStep | "QUEUED" | "SUCCEEDED" | "FAILED" | "CANCELLED",
  fallbackStatus: BookStatus = "DRAFT",
): BookStatus {
  switch (step) {
    case "QUEUED":
      return fallbackStatus;
    case "PHOTOS":
      return "PROCESSING_PHOTOS";
    case "VISION":
      return "ANALYZING_PHOTOS";
    case "EDITORIAL":
      return "CREATING_STORY";
    case "DESIGN":
      return "DESIGNING";
    case "FINALIZING":
      return "DESIGNING";
    case "SUCCEEDED":
      return "PREVIEW_READY";
    case "FAILED":
      return "FAILED";
    case "CANCELLED":
      return fallbackStatus;
    default:
      return fallbackStatus;
  }
}

// ============================================================================
// Error & Retry Decisions (Sections 43, 44, 46, 47)
// ============================================================================

export function isRetryableError(code: string, error?: unknown): boolean {
  if ((JOB_RETRY_CONFIG.nonRetryableErrorCodes as readonly string[]).includes(code)) {
    return false;
  }
  if ((JOB_RETRY_CONFIG.transientErrorCodes as readonly string[]).includes(code)) {
    return true;
  }
  // Inspect error object if provided
  if (error && typeof error === "object" && "retryable" in error) {
    return Boolean((error as { retryable: boolean }).retryable);
  }
  return false;
}

export function createJobError(
  code: string,
  message: string,
  stage?: BookGenerationStep,
  rawError?: unknown,
): JobError {
  return {
    code,
    message,
    retryable: isRetryableError(code, rawError),
    stage,
    occurredAt: new Date().toISOString(),
  };
}

// ============================================================================
// Smart Resume / Earliest Invalid Stage (Sections 60-65)
// ============================================================================

/**
 * Sections 60-65: Deterministically inspect existing artifacts and discover
 * the earliest missing or invalid stage to resume from.
 */
export async function determineEarliestInvalidStage(
  bookId: string,
  userId: string,
  photoIds: string[],
): Promise<BookGenerationStep> {
  const storage = getStorageProvider();

  // 1. Inspect Photo Assets (Part 4)
  for (const photoId of photoIds) {
    const aiDerivPath = getAIDerivativePath(userId, bookId, photoId);
    try {
      await storage.createSignedDownloadUrl(
        PHOTO_STORAGE_BUCKETS.DERIVATIVES,
        aiDerivPath,
      );
    } catch {
      return "PHOTOS";
    }
  }

  // 2. Inspect Photo Analysis records (Part 5)
  const analysisRepo = getAnalysisRepository();
  for (const photoId of photoIds) {
    const record = await analysisRepo.getAnalysisByPhotoId(photoId);
    if (!record || !record.analysisJson || record.analysisJson.visualQuality?.usableForPrint === "NO") {
      return "VISION";
    }
  }

  // 3. Inspect Editorial Plan (Part 6)
  const editorialRepo = getEditorialRepository();
  const planRecord = await editorialRepo.getPlanByBookId(bookId);
  if (
    !planRecord ||
    !planRecord.planJson ||
    !planRecord.planJson.chapters ||
    planRecord.planJson.chapters.length === 0
  ) {
    return "EDITORIAL";
  }

  // 4. Inspect Design JSON (Part 7)
  const designRepo = getDesignRepository();
  const designRecord = await designRepo.getDesignByBookId(bookId);
  if (!designRecord || !designRecord.designJson) {
    return "DESIGN";
  }

  const valResult = validatePrintEngineDesign(designRecord.designJson);
  if (!valResult.valid) {
    return "DESIGN";
  }

  // If all prior artifacts exist and are valid, resume at FINALIZING
  return "FINALIZING";
}
