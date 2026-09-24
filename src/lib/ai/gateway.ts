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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = choice?.message as any;
      const rawContent = msg?.content || msg?.reasoning || msg?.text;

      if (!choice || !rawContent || (typeof rawContent === "string" && rawContent.trim().length === 0)) {
        throw new AIGatewayError(
          "OpenRouter returned empty choices in response.",
          "GATEWAY_TEMPORARY_FAILURE",
          { isRetryable: true, details: transportResult.data },
        );
      }

      // 5. Parse JSON output (with robust preamble / markdown fence cleanup)
      let parsedJson: unknown;
      if (typeof rawContent !== "string") {
        parsedJson = rawContent;
      } else {
        const text = rawContent.trim();
        // Try direct parse first
        try {
          parsedJson = JSON.parse(text);
        } catch {
          // 1. Try all markdown code fences: ```(?:json)? ... ```
          const fenceMatches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
          // Often reasoning models put notes in early fences and the final JSON in the last fence
          for (let i = fenceMatches.length - 1; i >= 0; i--) {
            const fenceContent = fenceMatches[i][1].trim();
            try {
              parsedJson = JSON.parse(fenceContent);
              if (parsedJson && typeof parsedJson === "object") break;
            } catch {
              try {
                // Try removing trailing commas
                const cleaned = fenceContent.replace(/,(\s*[}\]])/g, "$1");
                parsedJson = JSON.parse(cleaned);
                if (parsedJson && typeof parsedJson === "object") break;
              } catch {
                // continue
              }
            }
          }

          // 2. If still not parsed, scan for balanced JSON substring candidates
          if (parsedJson === undefined) {
            let pos = 0;
            while ((pos = text.indexOf("{", pos)) !== -1) {
              let endPos = text.lastIndexOf("}");
              while (endPos > pos) {
                const candidate = text.slice(pos, endPos + 1).trim();
                if (
                  candidate.includes('"schemaVersion"') ||
                  candidate.includes('"design"') ||
                  candidate.includes('"title"') ||
                  candidate.includes('"visualDescription"') ||
                  candidate.includes('"document"')
                ) {
                  try {
                    const parsed = JSON.parse(candidate);
                    if (parsed && typeof parsed === "object") {
                      parsedJson = parsed;
                      break;
                    }
                  } catch {
                    try {
                      const cleaned = candidate.replace(/,(\s*[}\]])/g, "$1");
                      const parsed = JSON.parse(cleaned);
                      if (parsed && typeof parsed === "object") {
                        parsedJson = parsed;
                        break;
                      }
                    } catch {
                      // continue with next closing brace
                    }
                  }
                }
                endPos = text.lastIndexOf("}", endPos - 1);
              }
              if (parsedJson !== undefined) break;
              pos++;
            }
          }

          if (parsedJson === undefined) {
            throw new AIGatewayError(
              `Failed to parse model response as JSON: Model returned non-JSON text starting with "${text.slice(0, 50)}..."`,
              "SCHEMA_VALIDATION_ERROR",
              { isRetryable: true, details: { rawContent } },
            );
          }
        }
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

class DefaultAIGateway extends AIGateway {
  private customGateway: AIGateway | null = null;

  public setDelegate(gateway: AIGateway | null): void {
    this.customGateway = gateway;
  }

  public override async execute<TInput, TOutput>(
    request: GatewayRequest<TInput, TOutput>,
  ): Promise<AIJobResult<TOutput>> {
    if (this.customGateway) {
      return this.customGateway.execute(request);
    }
    return super.execute(request);
  }
}

// Default singleton instance
export const aiGateway = new DefaultAIGateway();

export function setGlobalAIGateway(gateway: AIGateway | null): void {
  aiGateway.setDelegate(gateway);
}
