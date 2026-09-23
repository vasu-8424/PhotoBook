import type { AIOperation } from "@/types/ai";

export interface OpenRouterTextContent {
  type: "text";
  text: string;
}

export interface OpenRouterImageContent {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export type OpenRouterContentPart = OpenRouterTextContent | OpenRouterImageContent;

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenRouterContentPart[];
}

export interface OpenRouterProviderRouting {
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
  data_collection?: "allow" | "deny";
  zdr?: boolean;
}

export interface OpenRouterRequestPayload {
  model: string;
  models?: string[];
  messages: OpenRouterMessage[];
  response_format?: { type: "json_object" };
  temperature?: number;
  max_tokens?: number;
  provider?: OpenRouterProviderRouting;
}

export interface OpenRouterResponsePayload {
  id: string;
  model: string; // The actual model that served the response
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OperationConfig {
  operation: AIOperation;
  primaryModel: string;
  fallbackModels: string[]; // Ordered fallback chain sent in models[]
  promptVersion: string;
  timeoutMs: number;
  maxCostUsd?: number;
  temperature?: number;
  providerRouting?: OpenRouterProviderRouting;
}

export interface SchemaValidator<T> {
  (data: unknown): { valid: boolean; data?: T; error?: string };
}

export interface GatewayRequest<TInput, TOutput> {
  operation: AIOperation;
  input: TInput;
  messages: OpenRouterMessage[];
  schemaValidator?: SchemaValidator<TOutput>;
  customCostLimitUsd?: number;
}
