export const AI_OUTPUT_SCHEMA_VERSION = "1.0.0";

export type AIOperation =
  | "PHOTO_ANALYSIS"
  | "EDITORIAL_PLANNING"
  | "DESIGN_PLANNING";

export interface AIExecutionContext {
  provider: string;
  model: string;
  promptVersion: string;
  inputHash: string;
  outputSchemaVersion: string;
  requestedModel?: string;
  attempt?: number;
  latencyMs?: number;
}

export interface AIJobResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  context: AIExecutionContext;
}

export interface AILogEvent {
  operation: AIOperation;
  requestedModel: string;
  actualModel?: string;
  provider?: string;
  promptVersion: string;
  inputHash: string;
  outputSchemaVersion: string;
  status: "SUCCESS" | "FAILED";
  attempt: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  errorCode?: string;
}
