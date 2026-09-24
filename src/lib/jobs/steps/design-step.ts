import {
  generateDesign,
  getDesignRepository,
  type DesignPlanInput,
  type DesignGenerationResult,
} from "@/lib/ai/design";
import type { EditorialPlan } from "@/lib/ai/editorial";
import type { PhotoAnalysis } from "@/lib/ai/vision";
import type { BookDesign } from "@/types/design";
import { JobExecutionError } from "../errors";
import type { GenerationContext } from "../types";

export interface DesignStepResult {
  design: BookDesign;
  isCached: boolean;
}

/**
 * Step 4: Coordinates Design AI layout generation via Part 7.
 * Checks for existing cached design first, then calls generateDesign to produce
 * canonical Design JSON v1.0.0.
 */
export async function executeDesignStep(
  ctx: GenerationContext,
  editorialPlan: EditorialPlan,
  analyses: PhotoAnalysis[],
): Promise<DesignStepResult> {
  const { bookId, userId, size, style, occasion } = ctx;

  const repo = getDesignRepository();
  const existingRecord = await repo.getDesignByBookId(bookId);

  if (existingRecord && existingRecord.designJson) {
    return {
      design: existingRecord.designJson,
      isCached: true,
    };
  }

  const designInput: DesignPlanInput = {
    bookId,
    size,
    style,
    occasion,
    editorialPlan,
    photos: analyses,
  };

  try {
    const result: DesignGenerationResult = await generateDesign(designInput, {
      userId,
    });

    return {
      design: result.design,
      isCached: false,
    };
  } catch (err: unknown) {
    throw new JobExecutionError(
      `Design AI generation failed: ${err instanceof Error ? err.message : String(err)}`,
      "DESIGN_GENERATION_FAILED",
      true,
      err,
    );
  }
}
