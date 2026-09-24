import type { BookOccasion, BookSize, BookStatus, BookStyle } from "@/types/book";
import type { BookGenerationStep, JobStatus, JobType } from "@/config/jobs";

export type { BookGenerationStep, JobStatus, JobType };

/**
 * Section 43: Deterministic structured Job Error
 */
export interface JobError {
  code: string;
  message: string;
  retryable: boolean;
  stage?: BookGenerationStep;
  occurredAt: string;
}

/**
 * Section 13 & 37: Book Generation & Async Job Model
 */
export interface BookJob {
  id: string;
  bookId: string;
  userId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  currentStep?: BookGenerationStep | string;
  stepDetails?: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  error?: JobError;
  cancelRequested?: boolean;
  lastHeartbeatAt?: string;
  nextAttemptAt?: string;
  // Backwards-compatible error fields
  errorCode?: string;
  errorMessage?: string;
  errorRetryable?: boolean;
  idempotencyKey?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}


export interface BookRecord {
  id: string;
  userId: string;
  title?: string;
  occasion: BookOccasion;
  style: BookStyle;
  size: BookSize;
  status: BookStatus;
  photoIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BookExportRecord {
  id: string;
  bookId: string;
  userId: string;
  designHash: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  storagePath?: string;
  fileSizeBytes?: number;
  pageCount?: number;
  downloadUrl?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
}

export interface GenerationProgressState {
  bookId: string;
  jobId?: string;
  status: BookStatus;
  progress: number;
  currentStep: string;
  userDescription: string;
  error?: string;
  isTerminal: boolean;
}

export interface GenerationContext {
  bookId: string;
  userId: string;
  occasion: BookOccasion;
  style: BookStyle;
  size: BookSize;
  photoIds: string[];
}
