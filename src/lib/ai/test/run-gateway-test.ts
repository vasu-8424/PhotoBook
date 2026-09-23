import { AIGateway } from "../gateway";
import { aiLogger } from "../logger";
import { computeInputHash } from "../hash";
import { calculateEstimatedCost } from "../pricing";
import { AIGatewayError } from "../errors";
import { getOperationConfig } from "@/config/ai";
import type { OpenRouterRequestPayload } from "../types";

export async function runGatewayTests(): Promise<void> {
  console.log("=== RUNNING PART 3 AI GATEWAY ARCHITECTURE TESTS ===");

  // 1. Input Hashing Determinism Test
  console.log("\n[Test 1] Deterministic input hashing...");
  const inputA = { prompt: "Analyze photos", count: 5, tags: ["travel", "beach"] };
  const inputB = { tags: ["travel", "beach"], count: 5, prompt: "Analyze photos" };
  const hashA = computeInputHash(inputA);
  const hashB = computeInputHash(inputB);

  console.log(`Hash A: ${hashA.slice(0, 16)}...`);
  console.log(`Hash B: ${hashB.slice(0, 16)}...`);
  if (hashA !== hashB) {
    throw new Error("Canonical input hashing failed: key order affected hash");
  }
  console.log("✓ Deterministic canonical hashing verified.");

  // 2. Pricing Calculation Test
  console.log("\n[Test 2] Actual model pricing calculation...");
  const costGpt4o = calculateEstimatedCost("openai/gpt-4o", 1000, 500);
  // gpt-4o: $2.50/M input, $10.00/M output -> (1000/1M * 2.5) + (500/1M * 10) = 0.0025 + 0.005 = 0.0075
  console.log(`GPT-4o 1k input + 500 output cost: $${costGpt4o}`);
  if (Math.abs(costGpt4o - 0.0075) > 0.0001) {
    throw new Error(`Unexpected cost calculation for GPT-4o: ${costGpt4o}`);
  }
  console.log("✓ Cost calculation verified.");

  // 3. Single Request & Model Fallback Ownership Test
  console.log("\n[Test 3] Single request with OpenRouter model fallback capturing...");
  let capturedPayload: OpenRouterRequestPayload | undefined;
  let requestCount = 0;

  const mockFallbackFetch: typeof fetch = async (url, init) => {
    requestCount++;
    capturedPayload = JSON.parse(init?.body as string) as OpenRouterRequestPayload;

    // Simulate OpenRouter falling back internally to openai/gpt-4o
    return new Response(
      JSON.stringify({
        id: "gen-123",
        model: "openai/gpt-4o", // actualModel is a fallback model!
        choices: [
          {
            message: {
              content: JSON.stringify({
                qualityScore: 92,
                orientation: "PORTRAIT",
                scene: "Beach sunset",
              }),
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 1200,
          completion_tokens: 250,
          total_tokens: 1450,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const gateway = new AIGateway({ fetchFn: mockFallbackFetch });
  aiLogger.clearEvents();

  const result = await gateway.execute<{ photoId: string }, { qualityScore: number; scene: string }>({
    operation: "PHOTO_ANALYSIS",
    input: { photoId: "photo_100" },
    messages: [{ role: "user", content: "Analyze photo_100" }],
    schemaValidator: (raw) => {
      const obj = raw as { qualityScore?: number; scene?: string };
      if (typeof obj.qualityScore === "number" && typeof obj.scene === "string") {
        return { valid: true, data: { qualityScore: obj.qualityScore, scene: obj.scene } };
      }
      return { valid: false, error: "Missing qualityScore or scene" };
    },
  });

  // Verify only ONE logical request was sent
  console.log(`Dispatched request count: ${requestCount} (expected 1)`);
  if (requestCount !== 1) {
    throw new Error(`Expected 1 logical request, got ${requestCount}`);
  }

  // Verify models array was passed to OpenRouter
  console.log("Captured OpenRouter model:", capturedPayload?.model);
  console.log("Captured OpenRouter fallback models[]:", capturedPayload?.models);
  if (!capturedPayload?.models || capturedPayload.models.length < 2) {
    throw new Error("OpenRouter request missing fallback models array");
  }

  // Verify actualModel vs requestedModel
  console.log("Result requestedModel:", result.context.requestedModel);
  console.log("Result actualModel:", result.context.model);
  const expectedPrimaryModel = getOperationConfig("PHOTO_ANALYSIS").primaryModel;
  if (result.context.requestedModel !== expectedPrimaryModel) {
    throw new Error(`Expected requestedModel ${expectedPrimaryModel}, got ${result.context.requestedModel}`);
  }
  if (result.context.model !== "openai/gpt-4o") {
    throw new Error(`Expected actualModel openai/gpt-4o, got ${result.context.model}`);
  }

  // Verify structured log event
  const events = aiLogger.getEvents();
  const successEvent = events[events.length - 1];
  console.log("Logged event actualModel:", successEvent.actualModel);
  console.log("Logged event estimatedCostUsd:", successEvent.estimatedCostUsd);
  if (successEvent.actualModel !== "openai/gpt-4o") {
    throw new Error("Log event failed to record actualModel");
  }
  if (!successEvent.estimatedCostUsd || successEvent.estimatedCostUsd <= 0) {
    throw new Error("Log event missing estimated cost calculation");
  }
  console.log("✓ Single logical request with OpenRouter fallback verified.");

  // 4. Bounded Transport Retries Test (Transient 503 Server Error)
  console.log("\n[Test 4] Bounded transport retries on transient 503...");
  let transientAttempts = 0;
  const mockRetryFetch: typeof fetch = async () => {
    transientAttempts++;
    if (transientAttempts <= 2) {
      // Fail twice with 503
      return new Response(JSON.stringify({ error: "Temporary overload" }), { status: 503 });
    }
    // Succeed on 3rd attempt
    return new Response(
      JSON.stringify({
        id: "gen-retry",
        model: "anthropic/claude-3.5-sonnet",
        choices: [{ message: { content: JSON.stringify({ story: "A beautiful journey." }) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 500, completion_tokens: 100, total_tokens: 600 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const retryGateway = new AIGateway({ fetchFn: mockRetryFetch });
  const retryResult = await retryGateway.execute<{ prompt: string }, { story: string }>({
    operation: "EDITORIAL_PLANNING",
    input: { prompt: "Write editorial" },
    messages: [{ role: "user", content: "Write editorial" }],
  });

  console.log(`Transient retry total attempts: ${transientAttempts} (expected 3: 1 initial + 2 retries)`);
  console.log(`Result attempt recorded: ${retryResult.context.attempt}`);
  if (transientAttempts !== 3 || retryResult.context.attempt !== 3) {
    throw new Error("Bounded transport retry count mismatch");
  }
  console.log("✓ Bounded transport retry (max 2 retries) verified.");

  // 5. Non-Retryable Error Handling Test (401 Authentication Error)
  console.log("\n[Test 5] Non-retryable 401 client error handling...");
  let authAttempts = 0;
  const mockAuthFetch: typeof fetch = async () => {
    authAttempts++;
    return new Response(JSON.stringify({ error: "Invalid API Key" }), { status: 401 });
  };

  const authGateway = new AIGateway({ fetchFn: mockAuthFetch });
  let authErrorCaught = false;

  try {
    await authGateway.execute({
      operation: "DESIGN_PLANNING",
      input: { pages: 10 },
      messages: [{ role: "user", content: "Plan layout" }],
    });
  } catch (err: unknown) {
    authErrorCaught = true;
    if (err instanceof AIGatewayError) {
      console.log(`Caught expected error: ${err.code} (isRetryable: ${err.isRetryable})`);
      if (err.code !== "AUTHENTICATION_ERROR" || err.isRetryable) {
        throw new Error("401 error was not marked as non-retryable AUTHENTICATION_ERROR");
      }
    }
  }

  console.log(`Auth attempt count: ${authAttempts} (expected 1, never retried)`);
  if (!authErrorCaught || authAttempts !== 1) {
    throw new Error("Non-retryable 401 was unexpectedly retried");
  }
  console.log("✓ Non-retryable error aborted immediately without retry.");

  // 6. Schema Validation Error Test
  console.log("\n[Test 6] Schema validation failure...");
  const mockBadSchemaFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "gen-bad-schema",
        model: "anthropic/claude-3.5-sonnet",
        choices: [{ message: { content: JSON.stringify({ unexpectedKey: 123 }) }, finish_reason: "stop" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const schemaGateway = new AIGateway({ fetchFn: mockBadSchemaFetch });
  let schemaErrorCaught = false;

  try {
    await schemaGateway.execute({
      operation: "DESIGN_PLANNING",
      input: { pages: 5 },
      messages: [{ role: "user", content: "Plan design" }],
      schemaValidator: () => ({ valid: false, error: "Expected valid design layout" }),
    });
  } catch (err: unknown) {
    schemaErrorCaught = true;
    if (err instanceof AIGatewayError) {
      console.log(`Caught schema error: ${err.code}`);
      if (err.code !== "SCHEMA_VALIDATION_ERROR") {
        throw new Error(`Expected SCHEMA_VALIDATION_ERROR, got ${err.code}`);
      }
    }
  }

  if (!schemaErrorCaught) {
    throw new Error("Failed to catch SCHEMA_VALIDATION_ERROR");
  }
  console.log("✓ Schema validation rejection verified.");

  console.log("\n=== ALL PART 3 ARCHITECTURE TESTS PASSED SUCCESSFULLY ===");
}

if (require.main === module) {
  runGatewayTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}
