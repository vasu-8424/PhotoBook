import crypto from "crypto";
import { aiGateway, AIGateway } from "@/lib/ai/gateway";
import { AIGatewayError } from "@/lib/ai/errors";
import { getOperationConfig } from "@/config/ai";
import { PHOTO_STORAGE_BUCKETS } from "@/config/photos";
import type {
  AnalyzePhotoInput,
  AnalyzePhotoOptions,
  PhotoAnalysis,
  PhotoAnalysisRecord,
} from "../vision/types";
import { validatePhotoAnalysis } from "../vision/schemas";
import { buildPhotoAnalysisMessages } from "../vision/prompts";
import {
  computeAnalysisCacheKey,
  globalAnalysisCache,
  PhotoAnalysisCache,
} from "../vision/cache";
import {
  getAnalysisRepository,
  PhotoAnalysisRepository,
} from "../vision/storage";

export interface ExtendedAnalyzeOptions extends AnalyzePhotoOptions {
  gateway?: AIGateway;
  repository?: PhotoAnalysisRepository;
  cache?: PhotoAnalysisCache;
  userId?: string;
}

/**
 * Validates that the provided image URL or path points to a controlled Part 4 AI derivative.
 * Rejects any arbitrary original-storage paths or references to the originals bucket.
 */
export function validateAIDerivativeBoundary(urlOrPath: string): void {
  if (!urlOrPath || typeof urlOrPath !== "string") {
    throw new AIGatewayError(
      "Invalid photo derivative URL: URL must be a non-empty string.",
      "SECURITY_BOUNDARY_VIOLATION",
      { isRetryable: false },
    );
  }

  const lower = urlOrPath.toLowerCase();

  // Reject explicit original paths or references to photo-originals
  if (
    lower.includes("/original") ||
    lower.includes(PHOTO_STORAGE_BUCKETS.ORIGINALS.toLowerCase()) ||
    lower.endsWith("/original")
  ) {
    throw new AIGatewayError(
      "Security boundary violation: Original uploads cannot be sent directly to Vision AI. Use Part 4 AI derivative (ai.jpg).",
      "SECURITY_BOUNDARY_VIOLATION",
      { isRetryable: false },
    );
  }

  // Must contain ai.jpg, be an approved derivative bucket path, or be an encoded data URI
  const isAiDerivative =
    lower.startsWith("data:image/") ||
    lower.includes("ai.jpg") ||
    lower.includes("/ai.") ||
    lower.includes(PHOTO_STORAGE_BUCKETS.DERIVATIVES.toLowerCase());

  if (!isAiDerivative) {
    throw new AIGatewayError(
      "Security boundary violation: Input URL does not appear to be an approved AI derivative (ai.jpg).",
      "SECURITY_BOUNDARY_VIOLATION",
      { isRetryable: false },
    );
  }
}

/**
 * Analyzes a single photograph using Part 4 AI derivative and Vision AI.
 * Returns structured PhotoAnalysis v1.0.0.
 */
export async function analyzePhoto(
  input: AnalyzePhotoInput,
  options?: ExtendedAnalyzeOptions,
): Promise<PhotoAnalysis> {
  // 1. Critical Input Boundary Validation
  validateAIDerivativeBoundary(input.aiDerivativeUrl);

  if (!input.photoId || !input.bookId) {
    throw new AIGatewayError(
      "photoId and bookId are required for photo analysis.",
      "INVALID_REQUEST",
      { isRetryable: false },
    );
  }

  const gateway = options?.gateway ?? aiGateway;
  const repository = options?.repository ?? getAnalysisRepository();
  const cache = options?.cache ?? globalAnalysisCache;
  const config = getOperationConfig("PHOTO_ANALYSIS");

  // 2. Deterministic Cache Check
  const cacheKey = computeAnalysisCacheKey({
    photoId: input.photoId,
    derivativeIdentifier: input.aiDerivativeUrl,
    promptVersion: config.promptVersion,
    model: config.primaryModel,
    schemaVersion: "1.0.0",
  });

  if (!options?.bypassCache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached.analysis;
    }

    // Also check persistent repository
    const storedRecord = await repository.getAnalysisByPhotoId(input.photoId);
    if (
      storedRecord &&
      storedRecord.promptVersion === config.promptVersion &&
      storedRecord.schemaVersion === "1.0.0"
    ) {
      cache.set(cacheKey, storedRecord.analysisJson, storedRecord.model);
      return storedRecord.analysisJson;
    }
  }

  // 3. Mark Analysis Status as ANALYZING
  await repository.setStatus(input.photoId, "ANALYZING");

  try {
    // 4. Build multimodal messages (attaching AI derivative signed URL)
    const messages = buildPhotoAnalysisMessages(
      input.photoId,
      input.aiDerivativeUrl,
    );

    // 5. Dispatch request via AI Gateway
    const result = await gateway.execute<AnalyzePhotoInput, PhotoAnalysis>({
      operation: "PHOTO_ANALYSIS",
      input,
      messages,
      schemaValidator: validatePhotoAnalysis,
    });

    if (!result.data) {
      throw new AIGatewayError(
        "AI Gateway returned empty data for photo analysis.",
        "SCHEMA_VALIDATION_ERROR",
        { isRetryable: false },
      );
    }

    const validatedAnalysis = result.data;
    const actualModel = result.context.model;

    // 6. Update Cache
    cache.set(cacheKey, validatedAnalysis, actualModel);

    // 7. Persist to Repository
    const record: PhotoAnalysisRecord = {
      id: `analysis_${crypto.randomUUID().replace(/-/g, "")}`,
      photoId: input.photoId,
      bookId: input.bookId,
      userId: options?.userId,
      schemaVersion: "1.0.0",
      analysisJson: validatedAnalysis,
      provider: result.context.provider,
      model: actualModel,
      promptVersion: config.promptVersion,
      inputHash: result.context.inputHash,
      outputSchemaVersion: result.context.outputSchemaVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repository.saveAnalysis(record);
    await repository.setStatus(input.photoId, "ANALYZED");

    return validatedAnalysis;
  } catch (err: unknown) {
    // 8. Mark Analysis Status as FAILED without corrupting photo asset
    const errorMessage = err instanceof Error ? err.message : String(err);
    await repository.setStatus(input.photoId, "FAILED", errorMessage);

    throw err;
  }
}
