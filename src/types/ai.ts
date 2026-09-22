export const AI_OUTPUT_SCHEMA_VERSION = "1.0.0";

export interface AIExecutionContext {
  provider: string;

  model: string;

  promptVersion: string;

  inputHash: string;

  outputSchemaVersion: string;
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
