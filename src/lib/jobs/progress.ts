import { GENERATION_MILESTONES } from "@/config/jobs";
import type { BookRecord, BookJob, GenerationProgressState } from "./types";
import type { BookStatus } from "@/types/book";

/**
 * Maps a book lifecycle status to its corresponding progress percentage and friendly copy.
 */
export function getMilestoneInfo(status: BookStatus): {
  progress: number;
  label: string;
  userDescription: string;
} {
  const milestone = GENERATION_MILESTONES[status];
  if (milestone) {
    return {
      progress: milestone.progressPercent,
      label: milestone.label,
      userDescription: milestone.userDescription,
    };
  }

  switch (status) {
    case "DRAFT":
      return {
        progress: 0,
        label: "Draft",
        userDescription: "Draft magazine created. Ready to add photos.",
      };
    case "UPLOADING":
      return {
        progress: 10,
        label: "Uploading",
        userDescription: "Uploading your photographs safely...",
      };
    case "EDITING":
      return {
        progress: 100,
        label: "Editing",
        userDescription: "Ready to fine-tune and customize in the visual editor.",
      };
    case "EXPORTING":
      return {
        progress: 90,
        label: "Exporting",
        userDescription: "Rendering print-ready 300 DPI vector PDF...",
      };
    case "COMPLETED":
      return {
        progress: 100,
        label: "Completed",
        userDescription: "Print PDF ready for download.",
      };
    case "FAILED":
      return {
        progress: 0,
        label: "Failed",
        userDescription: "Generation encountered an issue. Your uploaded photos are safe.",
      };
    case "CANCELLED":
      return {
        progress: 0,
        label: "Cancelled",
        userDescription: "Generation was cancelled.",
      };
    default:
      return {
        progress: 0,
        label: status,
        userDescription: "Processing...",
      };
  }
}

/**
 * Assembles a standardized, client-facing progress state from the active job and book record.
 */
export function formatProgressState(
  book: BookRecord,
  job?: BookJob | null,
): GenerationProgressState {
  const milestone = getMilestoneInfo(book.status);
  const isTerminal = ["PREVIEW_READY", "EDITING", "COMPLETED", "FAILED", "CANCELLED"].includes(
    book.status,
  );

  return {
    bookId: book.id,
    jobId: job?.id,
    status: book.status,
    progress: job?.progress ?? milestone.progress,
    currentStep: job?.currentStep ?? milestone.label,
    userDescription: job?.errorMessage ? job.errorMessage : milestone.userDescription,
    error: job?.errorMessage,
    isTerminal,
  };
}
