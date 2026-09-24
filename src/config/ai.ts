import type { AIOperation } from "@/types/ai";
import type { OperationConfig } from "@/lib/ai/types";

export const PHOTO_ANALYSIS_PROMPT_VERSION = "photo-analysis-v1";

// Active free multimodal & reasoning models verified on OpenRouter
export const DEFAULT_FIXED_FREE_VISION_MODEL = "openrouter/free";
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
    primaryModel:
      process.env.PHOTO_ANALYSIS_TEST_MODEL ||
      process.env.PHOTO_ANALYSIS_MODEL ||
      DEFAULT_FIXED_FREE_VISION_MODEL,
    // Active free multimodal / vision models
    fallbackModels: [
      "nex-agi/nex-n2.5-mini:free",
      "nex-agi/nex-n2.5-pro:free",
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
    // Active free reasoning & narrative models
    fallbackModels: [
      "nex-agi/nex-n2.5-mini:free",
      "nex-agi/nex-n2.5-pro:free",
      OPENROUTER_FREE_ROUTER,
    ],
    promptVersion: EDITORIAL_PROMPT_VERSION,
    timeoutMs: 60000,
    maxCostUsd: 0.10,
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
    // Active free structured JSON layout models
    fallbackModels: [
      "nex-agi/nex-n2.5-mini:free",
      "nex-agi/nex-n2.5-pro:free",
      OPENROUTER_FREE_ROUTER,
    ],
    promptVersion: DESIGN_PROMPT_VERSION,
    timeoutMs: 60000,
    maxCostUsd: 0.10,
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
