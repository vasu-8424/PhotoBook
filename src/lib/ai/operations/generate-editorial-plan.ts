import crypto from "crypto";
import { aiGateway, AIGateway } from "@/lib/ai/gateway";
import { AIGatewayError } from "@/lib/ai/errors";
import { getOperationConfig } from "@/config/ai";
import type {
  EditorialInput,
  EditorialPlan,
  EditorialPlanRecord,
} from "../editorial/types";
import { validateEditorialPlanSchema } from "../editorial/schemas";
import { buildEditorialMessages } from "../editorial/prompts";
import { validateEditorialPlanIntegrity } from "../editorial/validate";
import {
  computeEditorialCacheKey,
  globalEditorialCache,
  EditorialPlanCache,
} from "../editorial/cache";
import {
  getEditorialRepository,
  EditorialPlanRepository,
} from "../editorial/storage";

export interface ExtendedEditorialOptions {
  bypassCache?: boolean;
  gateway?: AIGateway;
  repository?: EditorialPlanRepository;
  cache?: EditorialPlanCache;
  userId?: string;
}

/**
 * Transforms analyzed photos into a coherent EditorialPlan using Editorial AI.
 * Validates Zod schema, validates photo ID and sequence integrity, enforces deterministic caching,
 * and records execution context.
 */
export async function generateEditorialPlan(
  input: EditorialInput,
  options?: ExtendedEditorialOptions,
): Promise<EditorialPlan> {
  // 1. Input Validation
  if (!input.bookId) {
    throw new AIGatewayError(
      "bookId is required for editorial planning.",
      "INVALID_REQUEST",
      { isRetryable: false },
    );
  }

  if (!input.photos || input.photos.length === 0) {
    throw new AIGatewayError(
      "At least one analyzed photo is required to generate an editorial plan.",
      "INVALID_REQUEST",
      { isRetryable: false },
    );
  }

  const authoritativePhotoIds = new Set(input.photos.map((p) => p.photoId));
  const gateway = options?.gateway ?? aiGateway;
  const repository = options?.repository ?? getEditorialRepository();
  const cache = options?.cache ?? globalEditorialCache;
  const config = getOperationConfig("EDITORIAL_PLANNING");

  // 2. Deterministic Cache Check
  const cacheKey = computeEditorialCacheKey({
    bookId: input.bookId,
    occasion: input.occasion,
    style: input.style,
    title: input.title,
    photos: input.photos,
    promptVersion: config.promptVersion,
    schemaVersion: "1.0.0",
    model: config.primaryModel,
  });

  if (!options?.bypassCache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached.plan;
    }

    const stored = await repository.getPlanByBookId(input.bookId);
    if (
      stored &&
      stored.promptVersion === config.promptVersion &&
      stored.schemaVersion === "1.0.0" &&
      stored.inputHash === cacheKey
    ) {
      cache.set(cacheKey, stored.planJson, stored.model);
      return stored.planJson;
    }
  }

  // 3. Build Messages (uses compressed PhotoAnalysis data)
  const messages = buildEditorialMessages(input);

  // 4. Dispatch Request via AI Gateway
  const result = await gateway.execute<EditorialInput, EditorialPlan>({
    operation: "EDITORIAL_PLANNING",
    input,
    messages,
    schemaValidator: validateEditorialPlanSchema,
  });

  if (!result.data) {
    throw new AIGatewayError(
      "AI Gateway returned empty data for editorial planning.",
      "SCHEMA_VALIDATION_ERROR",
      { isRetryable: false },
    );
  }

  const rawPlan = result.data;

  // 5. Strict Editorial Integrity Validation
  // Rejects hallucinated IDs, non-contiguous sequences, empty chapters, or invalid caption references
  validateEditorialPlanIntegrity(rawPlan, authoritativePhotoIds, input.style);

  // 6. Update In-Memory Cache
  const actualModel = result.context.model;
  cache.set(cacheKey, rawPlan, actualModel);

  // 7. Persist Validated Plan
  const record: EditorialPlanRecord = {
    id: `plan_${crypto.randomUUID().replace(/-/g, "")}`,
    bookId: input.bookId,
    userId: options?.userId,
    schemaVersion: "1.0.0",
    planJson: rawPlan,
    provider: result.context.provider,
    model: actualModel,
    promptVersion: config.promptVersion,
    inputHash: cacheKey,
    outputSchemaVersion: result.context.outputSchemaVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await repository.savePlan(record);

  return rawPlan;
}
