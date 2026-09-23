import { AIGatewayError } from "@/lib/ai/errors";
import { EDITORIAL_CONFIG } from "@/config/ai";
import type { BookStyle } from "@/types/book";
import type { EditorialPlan } from "./types";

/**
 * Validates deterministic editorial integrity rules on an AI-generated EditorialPlan.
 * Rejects hallucinated photo IDs, non-contiguous sequences, empty chapters, or invalid caption references.
 * Throws AIGatewayError with code EDITORIAL_INTEGRITY_ERROR on violation.
 */
export function validateEditorialPlanIntegrity(
  plan: EditorialPlan,
  authoritativePhotoIds: Set<string>,
  style?: BookStyle,
): void {
  // 1. Photo ID Integrity: Sequence
  const sequencePhotoIds = new Set<string>();
  const sequenceNumbers = new Set<number>();

  for (const item of plan.photoSequence) {
    if (!authoritativePhotoIds.has(item.photoId)) {
      throw new AIGatewayError(
        `Editorial integrity error: Model hallucinated unknown photoId '${item.photoId}' in sequence.`,
        "EDITORIAL_INTEGRITY_ERROR",
        { isRetryable: false, details: { hallucinatedId: item.photoId } },
      );
    }

    if (sequencePhotoIds.has(item.photoId)) {
      throw new AIGatewayError(
        `Editorial integrity error: Photo '${item.photoId}' appears multiple times in sequence.`,
        "EDITORIAL_INTEGRITY_ERROR",
        { isRetryable: false, details: { photoId: item.photoId } },
      );
    }
    sequencePhotoIds.add(item.photoId);

    if (sequenceNumbers.has(item.sequence)) {
      throw new AIGatewayError(
        `Editorial integrity error: Duplicate sequence number '${item.sequence}' found in photoSequence.`,
        "EDITORIAL_INTEGRITY_ERROR",
        { isRetryable: false, details: { sequence: item.sequence } },
      );
    }
    sequenceNumbers.add(item.sequence);
  }

  // 2. Contiguous Sequence Check (1..N)
  const sortedSeq = Array.from(sequenceNumbers).sort((a, b) => a - b);
  for (let i = 0; i < sortedSeq.length; i++) {
    const expected = i + 1;
    if (sortedSeq[i] !== expected) {
      throw new AIGatewayError(
        `Editorial integrity error: Sequence is not contiguous. Expected position ${expected}, found ${sortedSeq[i]}.`,
        "EDITORIAL_INTEGRITY_ERROR",
        { isRetryable: false, details: { sequenceList: sortedSeq } },
      );
    }
  }

  // 3. Chapter Integrity
  const chapterIds = new Set<string>();
  const chapterOrders = new Set<number>();

  for (const chapter of plan.chapters) {
    if (chapterIds.has(chapter.id)) {
      throw new AIGatewayError(
        `Editorial integrity error: Duplicate chapter ID '${chapter.id}'.`,
        "EDITORIAL_INTEGRITY_ERROR",
        { isRetryable: false, details: { chapterId: chapter.id } },
      );
    }
    chapterIds.add(chapter.id);

    if (chapterOrders.has(chapter.order)) {
      throw new AIGatewayError(
        `Editorial integrity error: Duplicate chapter order '${chapter.order}'.`,
        "EDITORIAL_INTEGRITY_ERROR",
        { isRetryable: false, details: { order: chapter.order } },
      );
    }
    chapterOrders.add(chapter.order);

    if (!chapter.photoIds || chapter.photoIds.length === 0) {
      throw new AIGatewayError(
        `Editorial integrity error: Chapter '${chapter.id}' (${chapter.title}) is empty. Chapters must contain at least 1 photo.`,
        "EDITORIAL_INTEGRITY_ERROR",
        { isRetryable: false, details: { chapterId: chapter.id } },
      );
    }

    for (const pid of chapter.photoIds) {
      if (!authoritativePhotoIds.has(pid)) {
        throw new AIGatewayError(
          `Editorial integrity error: Chapter '${chapter.id}' contains unknown photoId '${pid}'.`,
          "EDITORIAL_INTEGRITY_ERROR",
          { isRetryable: false, details: { chapterId: chapter.id, photoId: pid } },
        );
      }

      if (!sequencePhotoIds.has(pid)) {
        throw new AIGatewayError(
          `Editorial integrity error: Chapter '${chapter.id}' photo '${pid}' is missing from photoSequence.`,
          "EDITORIAL_INTEGRITY_ERROR",
          { isRetryable: false, details: { chapterId: chapter.id, photoId: pid } },
        );
      }
    }
  }

  // 4. Hero and Anchor Photo IDs
  for (const coverId of plan.coverCandidateIds) {
    if (!authoritativePhotoIds.has(coverId)) {
      throw new AIGatewayError(
        `Editorial integrity error: Unknown photoId '${coverId}' in coverCandidateIds.`,
        "EDITORIAL_INTEGRITY_ERROR",
        { isRetryable: false, details: { coverCandidateId: coverId } },
      );
    }
  }

  if (plan.openingPhotoId && !authoritativePhotoIds.has(plan.openingPhotoId)) {
    throw new AIGatewayError(
      `Editorial integrity error: Unknown openingPhotoId '${plan.openingPhotoId}'.`,
      "EDITORIAL_INTEGRITY_ERROR",
      { isRetryable: false, details: { openingPhotoId: plan.openingPhotoId } },
    );
  }

  if (plan.closingPhotoId && !authoritativePhotoIds.has(plan.closingPhotoId)) {
    throw new AIGatewayError(
      `Editorial integrity error: Unknown closingPhotoId '${plan.closingPhotoId}'.`,
      "EDITORIAL_INTEGRITY_ERROR",
      { isRetryable: false, details: { closingPhotoId: plan.closingPhotoId } },
    );
  }

  // 5. Caption Integrity
  const captionPhotoIds = new Set<string>();
  const maxWordLimit = style
    ? (EDITORIAL_CONFIG.captionWordLimits[style] ?? 25) + 10 // Allow generous tolerance before throwing hard integrity error
    : 35;

  for (const caption of plan.captions) {
    if (!authoritativePhotoIds.has(caption.photoId)) {
      throw new AIGatewayError(
        `Editorial integrity error: Caption references unknown photoId '${caption.photoId}'.`,
        "EDITORIAL_INTEGRITY_ERROR",
        { isRetryable: false, details: { captionPhotoId: caption.photoId } },
      );
    }

    if (captionPhotoIds.has(caption.photoId)) {
      throw new AIGatewayError(
        `Editorial integrity error: Multiple captions generated for photoId '${caption.photoId}'.`,
        "EDITORIAL_INTEGRITY_ERROR",
        { isRetryable: false, details: { captionPhotoId: caption.photoId } },
      );
    }
    captionPhotoIds.add(caption.photoId);

    // Verify caption length isn't an unbounded hallucinated article
    const words = caption.text.trim().split(/\s+/).length;
    if (words > maxWordLimit) {
      console.warn(
        `[Editorial Integrity] Caption for '${caption.photoId}' exceeded recommended length (${words} words > ${maxWordLimit}).`,
      );
    }
  }
}
