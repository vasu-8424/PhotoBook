import {
  JOB_RETRY_CONFIG,
  JOB_TYPES,
  STEP_PROGRESS_PERCENTAGES,
  type BookGenerationStep,
} from "@/config/jobs";
import type { BookStatus } from "@/types/book";
import { executeDesignStep } from "./steps/design-step";
import { executeEditorialStep } from "./steps/editorial-step";
import { executePhotoStep } from "./steps/photo-step";
import { executeVisionStep } from "./steps/vision-step";
import { JobExecutionError, getUserFriendlyJobError } from "./errors";
import { computeJobIdempotencyKey } from "./idempotency";
import { formatProgressState } from "./progress";
import {
  getBookRepository,
  getJobRepository,
  type BookRepository,
  type JobRepository,
} from "./storage";
import type {
  BookJob,
  BookRecord,
  GenerationContext,
  GenerationProgressState,
  JobError,
} from "./types";
import {
  advanceBookGenerationStep,
  determineEarliestInvalidStage,
  getBookStatusForJobStep,
  isRetryableError,
  transitionJob,
} from "./state-machine";
import { getDesignRepository } from "@/lib/ai/design";
import { getAnalysisRepository, type PhotoAnalysis } from "@/lib/ai/vision";
import { getEditorialRepository, type EditorialPlan } from "@/lib/ai/editorial";
import { validateDesign as validatePrintEngineDesign } from "@/lib/pdf/validate-design";

/**
 * Creates or retrieves an active book generation job with duplicate protection.
 */
export async function createBookGenerationJob(
  bookId: string,
  userId: string,
  bookRepo: BookRepository = getBookRepository(),
  jobRepo: JobRepository = getJobRepository(),
): Promise<BookJob> {
  const book = await bookRepo.getBookById(bookId);
  if (!book) {
    throw new JobExecutionError("Book not found.", "BOOK_NOT_FOUND", false);
  }

  if (book.userId !== userId) {
    throw new JobExecutionError(
      "You do not have permission to manage this book.",
      "UNAUTHORIZED",
      false,
    );
  }

  // Section 39 & 41: Check for active job
  const activeJob = await jobRepo.getActiveJobByBookId(
    bookId,
    JOB_TYPES.BOOK_GENERATION,
  );
  if (activeJob) {
    return activeJob;
  }

  const idempotencyKey = computeJobIdempotencyKey(
    bookId,
    JOB_TYPES.BOOK_GENERATION,
    { photoIds: book.photoIds, style: book.style, size: book.size },
  );

  const jobId = `job_gen_${bookId}_${Date.now()}`;
  const job: BookJob = {
    id: jobId,
    bookId,
    userId,
    type: JOB_TYPES.BOOK_GENERATION,
    status: "QUEUED",
    progress: 5,
    currentStep: "QUEUED",
    attempts: 0,
    maxAttempts: JOB_RETRY_CONFIG.maxAttempts,
    idempotencyKey,
    createdAt: new Date().toISOString(),
  };

  await jobRepo.createJob(job);
  return job;
}

/**
 * Resumable multi-stage pipeline executor.
 * Runs through Photos -> Vision -> Editorial -> Design -> Finalizing -> Preview Ready.
 */
export async function runBookGeneration(
  jobId: string,
  bookRepo: BookRepository = getBookRepository(),
  jobRepo: JobRepository = getJobRepository(),
): Promise<BookJob> {
  let job = await jobRepo.getJobById(jobId);
  if (!job) {
    throw new JobExecutionError(`Job ${jobId} not found.`, "JOB_NOT_FOUND", false);
  }

  if (job.status === "SUCCEEDED") {
    return job;
  }

  const book = await bookRepo.getBookById(job.bookId);
  if (!book) {
    throw new JobExecutionError(
      `Book ${job.bookId} not found.`,
      "BOOK_NOT_FOUND",
      false,
    );
  }

  // Mark job running and record attempt (QUEUED -> RUNNING transition)
  job = await jobRepo.updateJob(jobId, {
    status: "RUNNING",
    currentStep: "QUEUED",
    attempts: job.attempts + 1,
    startedAt: job.startedAt || new Date().toISOString(),
  });

  const ctx: GenerationContext = {
    bookId: book.id,
    userId: book.userId,
    occasion: book.occasion,
    style: book.style,
    size: book.size,
    photoIds: book.photoIds || [],
  };

  // Section 60 & 61: Determine earliest invalid stage and resume there
  const earliestStage = await determineEarliestInvalidStage(
    book.id,
    book.userId,
    book.photoIds || [],
  );

  const STEP_ORDER: BookGenerationStep[] = [
    "PHOTOS",
    "VISION",
    "EDITORIAL",
    "DESIGN",
    "FINALIZING",
  ];
  const startIdx = STEP_ORDER.indexOf(earliestStage);

  let currentStage: BookGenerationStep = earliestStage;
  let readyPhotoIds = ctx.photoIds;
  let analyses: PhotoAnalysis[] = [];
  let editorialPlan: EditorialPlan | null = null;

  try {
    // ------------------------------------------------------------------------
    // Step 1: Photo Processing (Part 4)
    // ------------------------------------------------------------------------
    if (startIdx <= STEP_ORDER.indexOf("PHOTOS")) {
      await checkCancellation(jobId, jobRepo);
      currentStage = "PHOTOS";
      job = await updateWorkflowStage(bookRepo, jobRepo, book.id, job, "PHOTOS");
      const photoResult = await executePhotoStep(ctx);
      readyPhotoIds = photoResult.readyPhotoIds;
    }

    // ------------------------------------------------------------------------
    // Step 2: Vision Analysis (Part 5)
    // ------------------------------------------------------------------------
    if (startIdx <= STEP_ORDER.indexOf("VISION")) {
      await checkCancellation(jobId, jobRepo);
      currentStage = "VISION";
      job = await updateWorkflowStage(bookRepo, jobRepo, book.id, job, "VISION");
      const visionResult = await executeVisionStep(ctx, readyPhotoIds);
      analyses = visionResult.analyses;
    } else {
      const analysisRepo = getAnalysisRepository();
      const records = await Promise.all(
        readyPhotoIds.map((pid) => analysisRepo.getAnalysisByPhotoId(pid)),
      );
      analyses = records
        .map((r) => r?.analysisJson)
        .filter((a): a is PhotoAnalysis => Boolean(a));
    }

    // ------------------------------------------------------------------------
    // Step 3: Editorial Planning (Part 6)
    // ------------------------------------------------------------------------
    if (startIdx <= STEP_ORDER.indexOf("EDITORIAL")) {
      await checkCancellation(jobId, jobRepo);
      currentStage = "EDITORIAL";
      job = await updateWorkflowStage(bookRepo, jobRepo, book.id, job, "EDITORIAL");
      const editorialResult = await executeEditorialStep(ctx, analyses);
      editorialPlan = editorialResult.plan;
    } else {
      const editorialRepo = getEditorialRepository();
      const planRecord = await editorialRepo.getPlanByBookId(book.id);
      editorialPlan = planRecord?.planJson || null;
    }

    // ------------------------------------------------------------------------
    // Step 4: Design Planning (Part 7)
    // ------------------------------------------------------------------------
    if (startIdx <= STEP_ORDER.indexOf("DESIGN")) {
      await checkCancellation(jobId, jobRepo);
      currentStage = "DESIGN";
      job = await updateWorkflowStage(bookRepo, jobRepo, book.id, job, "DESIGN");
      await executeDesignStep(ctx, editorialPlan!, analyses);
    }


    // ------------------------------------------------------------------------
    // Step 5: Finalizing (Section 26: Deterministic Checks Only, No AI)
    // ------------------------------------------------------------------------
    await checkCancellation(jobId, jobRepo);
    currentStage = "FINALIZING";
    job = await updateWorkflowStage(bookRepo, jobRepo, book.id, job, "FINALIZING");

    const designRepo = getDesignRepository();
    const finalDesignRecord = await designRepo.getDesignByBookId(book.id);
    if (!finalDesignRecord || !finalDesignRecord.designJson) {
      throw new JobExecutionError(
        "Finalizing failed: Design artifact does not exist in storage.",
        "MISSING_DESIGN",
        false,
      );
    }

    const valResult = validatePrintEngineDesign(finalDesignRecord.designJson);
    if (!valResult.valid) {
      throw new JobExecutionError(
        `Finalizing failed: Design integrity validation errors: ${valResult.errors?.map((e) => e.message).join(", ")}`,
        "INVALID_GEOMETRY",
        false,
      );
    }

    // ------------------------------------------------------------------------
    // Step 6: Preview Ready / Job Success (Section 27 & 54: Terminal Artifact Rule)
    // ------------------------------------------------------------------------
    await checkCancellation(jobId, jobRepo);

    const completed = await jobRepo.updateJob(jobId, {
      status: "SUCCEEDED",
      progress: STEP_PROGRESS_PERCENTAGES.SUCCEEDED,
      currentStep: "FINALIZING",
      completedAt: new Date().toISOString(),
    });

    await bookRepo.updateBookStatus(book.id, "PREVIEW_READY");
    return completed;
  } catch (err: unknown) {
    const isRetryable =
      err instanceof JobExecutionError
        ? err.retryable
        : isRetryableError(
            err instanceof JobExecutionError ? err.code : "UNEXPECTED_ERROR",
            err,
          );
    const errorCode =
      err instanceof JobExecutionError ? err.code : "UNEXPECTED_ERROR";
    const rawMessage = err instanceof Error ? err.message : String(err);
    const userMessage = getUserFriendlyJobError(errorCode, rawMessage);
    console.error(`[runBookGeneration Failed] jobId=${jobId} stage=${currentStage} code=${errorCode}:`, rawMessage);

    const willRetry = isRetryable && job.attempts < job.maxAttempts;

    const errorDetails: JobError = {
      code: errorCode,
      message: userMessage,
      retryable: willRetry,
      stage: currentStage,
      occurredAt: new Date().toISOString(),
    };

    if (willRetry) {
      // Section 7 & 44: Transient failure with remaining attempts -> status = QUEUED, nextAttemptAt = ...
      const queuedJob = await jobRepo.updateJob(jobId, {
        status: "QUEUED",
        error: errorDetails,
        errorCode,
        errorMessage: userMessage,
        errorRetryable: true,
        nextAttemptAt: new Date(Date.now() + JOB_RETRY_CONFIG.backoffMs).toISOString(),
      });
      return queuedJob;
    }

    const failedJob = await jobRepo.updateJob(jobId, {
      status: "FAILED",
      error: errorDetails,
      errorCode,
      errorMessage: userMessage,
      errorRetryable: false,
      completedAt: new Date().toISOString(),
    });

    await bookRepo.updateBookStatus(book.id, "FAILED");
    return failedJob;
  }
}

/**
 * Resumes a failed or interrupted generation job without re-running completed stages.
 * Uses determineEarliestInvalidStage to detect exactly where to resume.
 */
export async function retryBookGeneration(
  bookId: string,
  userId: string,
  bookRepo: BookRepository = getBookRepository(),
  jobRepo: JobRepository = getJobRepository(),
): Promise<BookJob> {
  const book = await bookRepo.getBookById(bookId);
  if (!book) {
    throw new JobExecutionError("Book not found.", "BOOK_NOT_FOUND", false);
  }
  if (book.userId !== userId) {
    throw new JobExecutionError("Unauthorized.", "UNAUTHORIZED", false);
  }

  // Section 60-65: Determine earliest missing/invalid artifact
  const earliestStage = await determineEarliestInvalidStage(
    bookId,
    userId,
    book.photoIds || [],
  );

  // Section 9 & 35: Create fresh execution job (do not mutate terminal job)
  const retryJob = await createBookGenerationJob(bookId, userId, bookRepo, jobRepo);
  return runBookGeneration(retryJob.id, bookRepo, jobRepo);
}

/**
 * Cancels an active generation job safely without corrupting completed artifacts.
 */
export async function cancelBookGeneration(
  jobId: string,
  userId: string,
  bookRepo: BookRepository = getBookRepository(),
  jobRepo: JobRepository = getJobRepository(),
): Promise<BookJob> {
  const job = await jobRepo.getJobById(jobId);
  if (!job) {
    throw new JobExecutionError("Job not found.", "JOB_NOT_FOUND", false);
  }
  if (job.userId !== userId) {
    throw new JobExecutionError("Unauthorized.", "UNAUTHORIZED", false);
  }

  const cancelled = await jobRepo.updateJob(jobId, {
    status: "CANCELLED",
    completedAt: new Date().toISOString(),
  });

  await bookRepo.updateBookStatus(job.bookId, "CANCELLED");
  return cancelled;
}

/**
 * Retrieves the current user-facing generation progress state for polling.
 */
export async function getBookGenerationStatus(
  bookId: string,
  userId: string,
  bookRepo: BookRepository = getBookRepository(),
  jobRepo: JobRepository = getJobRepository(),
): Promise<GenerationProgressState> {
  const book = await bookRepo.getBookById(bookId);
  if (!book) {
    throw new JobExecutionError("Book not found.", "BOOK_NOT_FOUND", false);
  }
  if (book.userId !== userId) {
    throw new JobExecutionError("Unauthorized.", "UNAUTHORIZED", false);
  }

  const activeJob = await jobRepo.getActiveJobByBookId(
    bookId,
    JOB_TYPES.BOOK_GENERATION,
  );
  if (activeJob) {
    return formatProgressState(book, activeJob);
  }

  const allJobs = await jobRepo.listJobsByBookId(bookId);
  const latestJob = allJobs.length > 0 ? allJobs[0] : null;

  return formatProgressState(book, latestJob);
}

// ============================================================================
// Internal Helpers
// ============================================================================

async function updateWorkflowStage(
  bookRepo: BookRepository,
  jobRepo: JobRepository,
  bookId: string,
  job: BookJob,
  step: BookGenerationStep,
): Promise<BookJob> {
  const productStatus = getBookStatusForJobStep(step);
  const advanced = advanceBookGenerationStep(job, step);

  await Promise.all([
    bookRepo.updateBookStatus(bookId, productStatus),
    jobRepo.updateJob(job.id, {
      currentStep: advanced.currentStep,
      progress: advanced.progress,
      lastHeartbeatAt: advanced.lastHeartbeatAt,
    }),
  ]);

  return advanced;
}

async function checkCancellation(
  jobId: string,
  jobRepo: JobRepository,
): Promise<void> {
  const current = await jobRepo.getJobById(jobId);
  if (current?.cancelRequested || current?.status === "CANCELLED") {
    throw new JobExecutionError("Job was cancelled.", "JOB_CANCELLED", false);
  }
}

