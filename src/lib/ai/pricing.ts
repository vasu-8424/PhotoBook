export interface ModelPricing {
  promptCostPerM: number;
  completionCostPerM: number;
}

export const MODEL_PRICING_TABLE: Record<string, ModelPricing> = {
  "google/gemini-2.5-flash": { promptCostPerM: 0.1, completionCostPerM: 0.4 },
  "google/gemini-2.5-pro": { promptCostPerM: 1.25, completionCostPerM: 5.0 },
  "anthropic/claude-3.5-sonnet": { promptCostPerM: 3.0, completionCostPerM: 15.0 },
  "openai/gpt-4o": { promptCostPerM: 2.5, completionCostPerM: 10.0 },
  "openai/gpt-4o-mini": { promptCostPerM: 0.15, completionCostPerM: 0.6 },
};

const DEFAULT_MODEL_PRICING: ModelPricing = {
  promptCostPerM: 2.0,
  completionCostPerM: 8.0,
};

export function calculateEstimatedCost(
  actualModel: string,
  inputTokens = 0,
  outputTokens = 0,
): number {
  // Normalize model key (strip provider prefixes if needed or match exact)
  const pricing =
    MODEL_PRICING_TABLE[actualModel] ||
    Object.entries(MODEL_PRICING_TABLE).find(([key]) =>
      actualModel.toLowerCase().includes(key.toLowerCase()),
    )?.[1] ||
    DEFAULT_MODEL_PRICING;

  const promptCost = (inputTokens / 1_000_000) * pricing.promptCostPerM;
  const completionCost = (outputTokens / 1_000_000) * pricing.completionCostPerM;

  return Number((promptCost + completionCost).toFixed(6));
}
