import {
  OPENROUTER_API_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
} from "./constants";
import { AIGatewayError } from "./errors";
import type {
  OpenRouterRequestPayload,
  OpenRouterResponsePayload,
} from "./types";

export interface TransportClientOptions {
  apiKey?: string;
  apiUrl?: string;
  maxRetries?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface TransportResult {
  data: OpenRouterResponsePayload;
  attempt: number;
  latencyMs: number;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenRouterTransportClient {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly maxRetries: number;
  private readonly defaultTimeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options?: TransportClientOptions) {
    this.apiKey =
      options?.apiKey ||
      process.env.OPENROUTER_API_KEY ||
      "";
    this.apiUrl = options?.apiUrl || OPENROUTER_API_URL;
    this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.defaultTimeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options?.fetchFn || globalThis.fetch;
  }

  /**
   * Executes ONE logical OpenRouter request with bounded transport retries.
   */
  public async execute(
    payload: OpenRouterRequestPayload,
    overrideTimeoutMs?: number,
  ): Promise<TransportResult> {
    const timeoutMs = overrideTimeoutMs ?? this.defaultTimeoutMs;
    const startTime = Date.now();

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      attempt++;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        let res: Response;
        try {
          res = await this.fetchFn(this.apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`,
              "HTTP-Referer": "https://memorymagazine.ai",
              "X-Title": "Memory Magazine AI Gateway",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const latencyMs = Date.now() - startTime;

        // Successful HTTP response
        if (res.ok) {
          const data = (await res.json()) as OpenRouterResponsePayload;
          return { data, attempt, latencyMs };
        }

        // Handle HTTP error responses
        const errorText = await res.text();
        let parsedError: unknown;
        try {
          parsedError = JSON.parse(errorText);
        } catch {
          parsedError = errorText;
        }

        // Non-retryable client errors
        if (res.status === 401) {
          throw new AIGatewayError(
            "OpenRouter authentication failure. Invalid or missing API key.",
            "AUTHENTICATION_ERROR",
            { isRetryable: false, statusCode: 401, details: parsedError },
          );
        }

        if (res.status === 403) {
          throw new AIGatewayError(
            "OpenRouter forbidden. Access not permitted.",
            "FORBIDDEN",
            { isRetryable: false, statusCode: 403, details: parsedError },
          );
        }

        if (res.status === 400 || res.status === 422) {
          throw new AIGatewayError(
            `OpenRouter rejected request (${res.status}): ${typeof parsedError === "string" ? parsedError : JSON.stringify(parsedError)}`,
            "INVALID_REQUEST",
            { isRetryable: false, statusCode: res.status, details: parsedError },
          );
        }

        // Retryable server errors (502, 503, 504, etc.)
        const isTemporary5xx =
          res.status === 502 || res.status === 503 || res.status === 504 || res.status === 500;

        if (isTemporary5xx && attempt <= this.maxRetries) {
          lastError = new AIGatewayError(
            `OpenRouter transient server error (${res.status}). Retrying...`,
            "GATEWAY_TEMPORARY_FAILURE",
            { isRetryable: true, statusCode: res.status, details: parsedError },
          );
          const backoff = Math.min(
            RETRY_MAX_DELAY_MS,
            RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
          );
          await wait(backoff);
          continue;
        }

        throw new AIGatewayError(
          `OpenRouter failed with HTTP ${res.status}: ${JSON.stringify(parsedError)}`,
          "GATEWAY_TEMPORARY_FAILURE",
          { isRetryable: false, statusCode: res.status, details: parsedError },
        );
      } catch (err: unknown) {
        lastError = err;

        // If error is explicitly marked non-retryable, fail immediately
        if (err instanceof AIGatewayError && !err.isRetryable) {
          throw err;
        }

        const isTimeout =
          (err instanceof Error && err.name === "AbortError") ||
          (err instanceof AIGatewayError && err.code === "TIMEOUT");

        if (attempt <= this.maxRetries) {
          const backoff = Math.min(
            RETRY_MAX_DELAY_MS,
            RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
          );
          await wait(backoff);
          continue;
        }

        if (isTimeout) {
          throw new AIGatewayError(
            `OpenRouter request timed out after ${timeoutMs}ms (attempt ${attempt}).`,
            "TIMEOUT",
            { isRetryable: true, details: err },
          );
        }

        if (err instanceof AIGatewayError) {
          throw err;
        }

        throw new AIGatewayError(
          `OpenRouter transport network failure: ${err instanceof Error ? err.message : String(err)}`,
          "NETWORK_ERROR",
          { isRetryable: true, details: err },
        );
      }
    }

    throw lastError;
  }
}
