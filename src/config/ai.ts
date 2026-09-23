import type { AIOperation } from "@/types/ai";
import type { OperationConfig } from "@/lib/ai/types";

export const PHOTO_ANALYSIS_PROMPT_VERSION = "photo-analysis-v1";

// Explicit fixed free multimodal model for reproducible debugging & consistent prompt/schema testing
export const DEFAULT_FIXED_FREE_VISION_MODEL = "google/gemma-4-26b-a4b-it:free";
export const OPENROUTER_FREE_ROUTER = "openrouter/free";

export const VISION_CONFIG = {
  maxConcurrentRequests: parseInt(process.env.VISION_MAX_CONCURRENCY || "1", 10),
  defaultBatchSize: parseInt(process.env.VISION_BATCH_SIZE || "5", 10),
  cacheTtlSeconds: 86400 * 7, // 7 days
};

export const EDITORIAL_PROMPT_VERSION = "editorial-planning-v1";

export const EDITORIAL_CONFIG = {
  cacheTtlSeconds: 86400 * 7,
  captionWordLimits: {
    MINIMAL: 10,
    EDITORIAL: 18,
    CINEMATIC: 20,
    JOURNAL: 25,
  },
};

export const DESIGN_PROMPT_VERSION = "design-planning-v1";
export const DESIGN_AI_OUTPUT_VERSION = "1.0.0";

export const DESIGN_CONFIG = {
  cacheTtlSeconds: 86400 * 7,
};

export const AI_OPERATION_CONFIGS: Record<AIOperation, OperationConfig> = {
  PHOTO_ANALYSIS: {
    operation: "PHOTO_ANALYSIS",
    // Uses explicit fixed free vision model first for consistent debugging & schema validation.
    // Can be switched to OPENROUTER_FREE_ROUTER via PHOTO_ANALYSIS_MODEL="openrouter/free"
    primaryModel:
      process.env.PHOTO_ANALYSIS_TEST_MODEL ||
      process.env.PHOTO_ANALYSIS_MODEL ||
      DEFAULT_FIXED_FREE_VISION_MODEL,
    // Compatible free multimodal / vision models
    fallbackModels: [
      "google/gemma-4-31b-it:free",
      "inclusionai/ling-3.0-flash-vl:free",
      OPENROUTER_FREE_ROUTER,
    ],
    promptVersion: PHOTO_ANALYSIS_PROMPT_VERSION,
    timeoutMs: 45000,
    maxCostUsd: 0.05, // Guard threshold
    temperature: 0.1,
    providerRouting: {
      allow_fallbacks: true,
      data_collection: "deny",
      require_parameters: true,
    },
  },

  EDITORIAL_PLANNING: {
    operation: "EDITORIAL_PLANNING",
    primaryModel:
      process.env.EDITORIAL_PLANNING_TEST_MODEL ||
      process.env.EDITORIAL_PLANNING_MODEL ||
      DEFAULT_FIXED_FREE_VISION_MODEL,
    // Compatible free reasoning & structured JSON narrative models
    fallbackModels: [
      "google/gemma-4-31b-it:free",
      "inclusionai/ling-3.0-flash-vl:free",
      OPENROUTER_FREE_ROUTER,
    ],
    promptVersion: EDITORIAL_PROMPT_VERSION,
    timeoutMs: 60000,
    maxCostUsd: 0.05,
    temperature: 0.2,
    providerRouting: {
      allow_fallbacks: true,
      data_collection: "deny",
      require_parameters: true,
    },
  },

  DESIGN_PLANNING: {
    operation: "DESIGN_PLANNING",
    primaryModel:
      process.env.DESIGN_PLANNING_TEST_MODEL ||
      process.env.DESIGN_PLANNING_MODEL ||
      DEFAULT_FIXED_FREE_VISION_MODEL,
    // Compatible free structured JSON layout models
    fallbackModels: [
      "google/gemma-4-31b-it:free",
      "inclusionai/ling-3.0-flash-vl:free",
      OPENROUTER_FREE_ROUTER,
    ],
    promptVersion: DESIGN_PROMPT_VERSION,
    timeoutMs: 60000,
    maxCostUsd: 0.05,
    temperature: 0.2,
    providerRouting: {
      allow_fallbacks: true,
      data_collection: "deny",
      require_parameters: true,
    },
  },
};

export function getOperationConfig(operation: AIOperation): OperationConfig {
  const config = AI_OPERATION_CONFIGS[operation];
  if (!config) {
    throw new Error(`No AI configuration registered for operation: ${operation}`);
  }
  return config;
}
