export type AIGatewayErrorCode =
  | "INVALID_REQUEST"
  | "AUTHENTICATION_ERROR"
  | "FORBIDDEN"
  | "CONTENT_REFUSAL"
  | "COST_LIMIT_EXCEEDED"
  | "SCHEMA_VALIDATION_ERROR"
  | "UNSUPPORTED_CAPABILITY"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "GATEWAY_TEMPORARY_FAILURE"
  | "SECURITY_BOUNDARY_VIOLATION"
  | "EDITORIAL_INTEGRITY_ERROR"
  | "DESIGN_ASSET_ERROR"
  | "DESIGN_GEOMETRY_ERROR"
  | "DESIGN_FONT_ERROR"
  | "DESIGN_SAFE_AREA_ERROR"
  | "DESIGN_PROTECTED_ASSET_ERROR"
  | "DESIGN_SPREAD_ERROR"
  | "AI_GATEWAY_ERROR";

export class AIGatewayError extends Error {
  public readonly code: AIGatewayErrorCode;
  public readonly isRetryable: boolean;
  public readonly statusCode?: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: AIGatewayErrorCode,
    options?: {
      isRetryable?: boolean;
      statusCode?: number;
      details?: unknown;
    },
  ) {
    super(message);
    this.name = "AIGatewayError";
    this.code = code;
    this.isRetryable = options?.isRetryable ?? false;
    this.statusCode = options?.statusCode;
    this.details = options?.details;
    Object.setPrototypeOf(this, AIGatewayError.prototype);
  }
}
