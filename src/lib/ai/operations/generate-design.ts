import crypto from "crypto";
import { aiGateway, AIGateway } from "@/lib/ai/gateway";
import { AIGatewayError } from "@/lib/ai/errors";
import { getOperationConfig } from "@/config/ai";
import { DESIGN_SCHEMA_VERSION } from "@/types/design";
import type {
  DesignGenerationResult,
  DesignPlanInput,
  DesignPlanRecord,
} from "../design/types";
import { validateDesignGenerationResultSchema } from "../design/schemas";
import { buildDesignMessages } from "../design/prompts";
import {
  repairDesignGeometry,
  validateDesignIntegrity,
} from "../design/validate";
import {
  computeDesignCacheKey,
  globalDesignCache,
  DesignPlanCache,
} from "../design/cache";
import {
  getDesignRepository,
  DesignRepository,
} from "../design/storage";

export interface ExtendedDesignOptions {
  bypassCache?: boolean;
  gateway?: AIGateway;
  repository?: DesignRepository;
  cache?: DesignPlanCache;
  userId?: string;
}

/**
 * Transforms an EditorialPlan and PhotoAnalysis[] into a canonical Design JSON v1.0.0 (BookDesign).
 * Validates Zod schema, applies safe geometric repair, validates deterministic integrity,
 * enforces caching, and records execution context.
 */
export async function generateDesign(
  input: DesignPlanInput,
  options?: ExtendedDesignOptions,
): Promise<DesignGenerationResult> {
  // 1. Input Validation
  if (!input.bookId) {
    throw new AIGatewayError("bookId is required for design generation.", "INVALID_REQUEST", {
      isRetryable: false,
    });
  }

  if (!input.editorialPlan || !input.editorialPlan.title) {
    throw new AIGatewayError(
      "A validated editorialPlan is required for design generation.",
      "INVALID_REQUEST",
      { isRetryable: false },
    );
  }

  if (!input.photos || input.photos.length === 0) {
    throw new AIGatewayError(
      "At least one analyzed photo is required for design generation.",
      "INVALID_REQUEST",
      { isRetryable: false },
    );
  }

  const authoritativePhotoIds = new Set(input.photos.map((p) => p.photoId));
  const gateway = options?.gateway ?? aiGateway;
  const repository = options?.repository ?? getDesignRepository();
  const cache = options?.cache ?? globalDesignCache;
  const config = getOperationConfig("DESIGN_PLANNING");

  // 2. Deterministic Cache Check
  const cacheKey = computeDesignCacheKey({
    bookId: input.bookId,
    occasion: input.occasion,
    style: input.style,
    size: input.size,
    orientation: input.orientation,
    editorialPlan: input.editorialPlan,
    photos: input.photos,
    protectedPhotoIds: input.protectedPhotoIds,
    promptVersion: config.promptVersion,
    schemaVersion: DESIGN_SCHEMA_VERSION,
    model: config.primaryModel,
  });

  if (!options?.bypassCache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return {
        schemaVersion: "1.0.0",
        design: cached.design,
        rationale: cached.rationale,
      };
    }

    const stored = await repository.getDesignByBookId(input.bookId);
    if (
      stored &&
      stored.promptVersion === config.promptVersion &&
      stored.schemaVersion === DESIGN_SCHEMA_VERSION &&
      stored.inputHash === cacheKey
    ) {
      cache.set(cacheKey, stored.designJson, stored.model);
      return {
        schemaVersion: "1.0.0",
        design: stored.designJson,
      };
    }
  }

  // 3. Build Messages
  const messages = buildDesignMessages(input);

  // 4. Dispatch Request via AI Gateway
  const result = await gateway.execute<DesignPlanInput, DesignGenerationResult>({
    operation: "DESIGN_PLANNING",
    input,
    messages,
    schemaValidator: validateDesignGenerationResultSchema,
  });

  if (!result.data || !result.data.design) {
    throw new AIGatewayError(
      "AI Gateway returned empty data for design planning.",
      "SCHEMA_VALIDATION_ERROR",
      { isRetryable: false },
    );
  }

  // 5. Deterministic Repair & Strict Validation
  const rawDesign = result.data.design;
  const repairedDesign = repairDesignGeometry(rawDesign);

  // Strict design integrity verification:
  // Rejects unknown asset IDs, missing protected photos, invalid fonts, safe-area violations, bad geometry, or gutter violations
  validateDesignIntegrity(
    repairedDesign,
    authoritativePhotoIds,
    input.protectedPhotoIds,
  );

  const finalResult: DesignGenerationResult = {
    schemaVersion: "1.0.0",
    design: repairedDesign,
    rationale: result.data.rationale,
  };

  // 6. Update Cache
  const actualModel = result.context.model;
  cache.set(cacheKey, repairedDesign, actualModel, result.data.rationale);

  // 7. Persist to Repository
  const record: DesignPlanRecord = {
    id: crypto.randomUUID(),
    bookId: input.bookId,
    userId: options?.userId,
    schemaVersion: DESIGN_SCHEMA_VERSION,
    designJson: repairedDesign,
    provider: result.context.provider,
    model: actualModel,
    promptVersion: config.promptVersion,
    inputHash: cacheKey,
    outputSchemaVersion: result.context.outputSchemaVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await repository.saveDesign(record);
  } catch (err) {
    console.error("Failed to persist design record to repository:", err);
  }

  return finalResult;
}
