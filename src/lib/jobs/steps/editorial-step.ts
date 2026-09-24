import {
  generateEditorialPlan,
  getEditorialRepository,
  type EditorialPlan,
  type EditorialInput,
} from "@/lib/ai/editorial";
import type { PhotoAnalysis } from "@/lib/ai/vision";
import { JobExecutionError } from "../errors";
import type { GenerationContext } from "../types";

export interface EditorialStepResult {
  plan: EditorialPlan;
  isCached: boolean;
}

/**
 * Step 3: Coordinates Editorial AI narrative generation via Part 6.
 * Checks for existing cached plan first, then calls generateEditorialPlan.
 */
export async function executeEditorialStep(
  ctx: GenerationContext,
  analyses: PhotoAnalysis[],
): Promise<EditorialStepResult> {
  const { bookId, userId, occasion, style } = ctx;

  const repo = getEditorialRepository();
  const existingRecord = await repo.getPlanByBookId(bookId);

  // If a plan already exists and has not been invalidated
  if (existingRecord && existingRecord.planJson) {
    return {
      plan: existingRecord.planJson,
      isCached: true,
    };
  }

  const editorialInput: EditorialInput = {
    bookId,
    occasion,
    style,
    photos: analyses,
  };

  try {
    const plan = await generateEditorialPlan(editorialInput, {
      userId,
    });

    return {
      plan,
      isCached: false,
    };
  } catch (err: unknown) {
    throw new JobExecutionError(
      `Editorial AI generation failed: ${err instanceof Error ? err.message : String(err)}`,
      "EDITORIAL_GENERATION_FAILED",
      true,
      err,
    );
  }
}
