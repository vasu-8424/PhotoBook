import type { AIJobResult } from "@/types/ai";
import { getOperationConfig } from "@/config/ai";
import { DEFAULT_OUTPUT_SCHEMA_VERSION } from "./constants";
import { AIGatewayError } from "./errors";
import { computeInputHash } from "./hash";
import { aiLogger } from "./logger";
import { calculateEstimatedCost } from "./pricing";
import {
  OpenRouterTransportClient,
  type TransportClientOptions,
} from "./client";
import type { GatewayRequest, OpenRouterRequestPayload } from "./types";

export class AIGateway {
  private transportClient: OpenRouterTransportClient;

  constructor(transportOptions?: TransportClientOptions) {
    this.transportClient = new OpenRouterTransportClient(transportOptions);
  }

  /**
   * Dispatches ONE logical request with OpenRouter-owned model fallback chain.
   * Manages bounded transport retries, input hashing, schema validation,
   * actual model recording, cost accounting, and structured logging.
   */
  public async execute<TInput, TOutput>(
    request: GatewayRequest<TInput, TOutput>,
  ): Promise<AIJobResult<TOutput>> {
    const config = getOperationConfig(request.operation);
    const startTime = Date.now();

    // 1. Compute deterministic input hash for idempotency & execution identity
    const inputHash = computeInputHash({
      operation: request.operation,
      input: request.input,
      promptVersion: config.promptVersion,
    });

    // 2. Cost Guard check
    const costLimit = request.customCostLimitUsd ?? config.maxCostUsd;

    // 3. Construct ONE logical request payload with OpenRouter model fallback chain
    const payload: OpenRouterRequestPayload = {
      model: config.primaryModel,
      models: config.fallbackModels, // OpenRouter owns model fallback!
      messages: request.messages,
      response_format: { type: "json_object" },
      temperature: config.temperature,
      provider: config.providerRouting,
    };

    let attempt = 1;
    let actualModel = config.primaryModel;

    try {
      // 4. Send logical request with bounded transport retries
      const transportResult = await this.transportClient.execute(
        payload,
        config.timeoutMs,
      );

      attempt = transportResult.attempt;
      actualModel = transportResult.data.model || config.primaryModel;

      const choice = transportResult.data.choices?.[0];
      if (!choice || !choice.message?.content) {
        throw new AIGatewayError(
          "OpenRouter returned empty choices in response.",
          "CONTENT_REFUSAL",
          { isRetryable: false, details: transportResult.data },
        );
      }

      // 5. Parse JSON output
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(choice.message.content);
      } catch (parseErr) {
        throw new AIGatewayError(
          `Failed to parse model response as JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          "SCHEMA_VALIDATION_ERROR",
          { isRetryable: false, details: { rawContent: choice.message.content } },
        );
      }

      // 6. Validate output schema
      let validatedData = parsedJson as TOutput;
      if (request.schemaValidator) {
        const validation = request.schemaValidator(parsedJson);
        if (!validation.valid || validation.data === undefined) {
          throw new AIGatewayError(
            `Output schema validation failed: ${validation.error || "Unknown schema mismatch"}`,
            "SCHEMA_VALIDATION_ERROR",
            { isRetryable: false, details: { raw: parsedJson } },
          );
        }
        validatedData = validation.data;
      }

      // 7. Calculate estimated cost using the ACTUAL model that served the request
      const inputTokens = transportResult.data.usage?.prompt_tokens ?? 0;
      const outputTokens = transportResult.data.usage?.completion_tokens ?? 0;
      const estimatedCostUsd = calculateEstimatedCost(
        actualModel,
        inputTokens,
        outputTokens,
      );

      // Verify cost guard against actual expenditure
      if (costLimit !== undefined && estimatedCostUsd > costLimit) {
        // Log warning but proceed with parsed result
        console.warn(
          `[AI Gateway] Operation ${request.operation} exceeded cost limit ($${estimatedCostUsd} > $${costLimit}).`,
        );
      }

      const latencyMs = Date.now() - startTime;

      // 8. Structured execution logging
      aiLogger.log({
        operation: request.operation,
        requestedModel: config.primaryModel,
        actualModel,
        provider: "openrouter",
        promptVersion: config.promptVersion,
        inputHash,
        outputSchemaVersion: DEFAULT_OUTPUT_SCHEMA_VERSION,
        status: "SUCCESS",
        attempt,
        latencyMs,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
      });

      return {
        success: true,
        data: validatedData,
        context: {
          provider: "openrouter",
          model: actualModel,
          requestedModel: config.primaryModel,
          promptVersion: config.promptVersion,
          inputHash,
          outputSchemaVersion: DEFAULT_OUTPUT_SCHEMA_VERSION,
          attempt,
          latencyMs,
        },
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorCode =
        err instanceof AIGatewayError ? err.code : "AI_GATEWAY_ERROR";

      // Log failure event
      aiLogger.log({
        operation: request.operation,
        requestedModel: config.primaryModel,
        actualModel: actualModel !== config.primaryModel ? actualModel : undefined,
        provider: "openrouter",
        promptVersion: config.promptVersion,
        inputHash,
        outputSchemaVersion: DEFAULT_OUTPUT_SCHEMA_VERSION,
        status: "FAILED",
        attempt,
        latencyMs,
        errorCode,
      });

      if (err instanceof AIGatewayError) {
        throw err;
      }

      throw new AIGatewayError(
        `AI Gateway operation ${request.operation} failed: ${err instanceof Error ? err.message : String(err)}`,
        "AI_GATEWAY_ERROR",
        { isRetryable: false, details: err },
      );
    }
  }
}

// Default singleton instance
export const aiGateway = new AIGateway();
