import { AIGateway } from "@/lib/ai/gateway";
import { AIGatewayError } from "@/lib/ai/errors";
import {
  analyzePhoto,
  validateAIDerivativeBoundary,
} from "../index";
import { analyzePhotosBatch } from "../batch";
import {
  assessAnalysisConfidence,
  getPrintAdvisory,
  isCropRisky,
} from "../confidence";
import { PhotoAnalysisCache } from "../cache";
import { InMemoryPhotoAnalysisRepository } from "../storage";
import type { PhotoAnalysis } from "../types";
import type { OpenRouterRequestPayload } from "@/lib/ai/types";

function createValidPhotoAnalysis(
  photoId: string,
  overrides?: Partial<PhotoAnalysis>,
): PhotoAnalysis {
  return {
    schemaVersion: "1.0.0",
    photoId,
    orientation: "LANDSCAPE",
    visualDescription:
      "A scenic mountain lake reflecting blue skies and evergreen trees under bright afternoon sunlight.",
    scene: {
      category: "NATURE",
      description: "Mountain lake landscape with clear reflections.",
      environment: "Alpine outdoors",
      timeOfDay: "AFTERNOON",
    },
    subjects: [
      {
        type: "LANDSCAPE",
        count: 1,
        prominence: "PRIMARY",
        description: "Serene alpine lake surrounded by pine forests.",
      },
      {
        type: "BUILDING",
        count: 1,
        prominence: "BACKGROUND",
        description: "Small wooden boathouse at far shoreline.",
      },
    ],
    peopleCount: 0,
    composition: {
      subjectPosition: "CENTER",
      balance: "BALANCED",
      negativeSpace: "MEDIUM",
      depth: "DEEP",
      cropSafety: "SAFE",
      focalPoint: {
        x: 0.5,
        y: 0.58,
      },
    },
    visualQuality: {
      overall: "EXCELLENT",
      sharpness: "SHARP",
      exposure: "GOOD",
      composition: "STRONG",
      usableForPrint: "YES",
      confidence: 0.95,
    },
    colors: {
      dominant: ["#2B4C6F", "#4A7C59", "#D8E2DC"],
      mood: "COOL",
    },
    textDetected: false,
    locationClues: [
      {
        clue: "Alpine glacial lake and conifer vegetation",
        type: "ENVIRONMENT",
        confidence: 0.85,
      },
    ],
    occasionClues: [
      {
        occasion: "TRAVEL",
        evidence: "Mountain hiking and wilderness exploration vista",
        confidence: 0.9,
      },
    ],
    tags: [
      "mountains",
      "lake",
      "reflections",
      "nature",
      "forest",
      "blue sky",
      "alpine",
      "serene",
    ],
    confidence: {
      overall: 0.93,
      scene: 0.95,
      subjects: 0.92,
      composition: 0.9,
      location: 0.8,
      occasion: 0.88,
    },
    ...overrides,
  };
}

export async function runVisionTests(): Promise<void> {
  console.log("=== RUNNING PART 5 VISION AI PHOTO UNDERSTANDING TESTS ===");

  // --------------------------------------------------------------------------
  // Test 1: Security Boundary Enforcement (Reject original user uploads)
  // --------------------------------------------------------------------------
  console.log("\n[Test 1] Critical Input Boundary: Rejection of original storage paths...");

  const originalPaths = [
    "usr_123/bk_456/photo_001/original",
    "https://storage.memorymagazine.internal/photo-originals/usr_1/bk_1/photo_1/original?token=xyz",
    "photo-originals/photo_001/original",
    "/storage/v1/object/photo-originals/photo_01",
  ];

  for (const path of originalPaths) {
    let errorCaught = false;
    try {
      validateAIDerivativeBoundary(path);
    } catch (err) {
      errorCaught = true;
      if (err instanceof AIGatewayError) {
        if (err.code !== "SECURITY_BOUNDARY_VIOLATION") {
          throw new Error(`Expected SECURITY_BOUNDARY_VIOLATION, got ${err.code}`);
        }
      }
    }

    if (!errorCaught) {
      throw new Error(`Failed to reject original storage path: ${path}`);
    }
  }

  // Valid AI derivative paths must pass boundary validation
  const validDerivativeUrls = [
    "usr_123/bk_456/photo_001/ai.jpg",
    "https://storage.memorymagazine.internal/photo-derivatives/signed/usr_123/bk_456/photo_001/ai.jpg?expires=300&token=abc",
  ];

  for (const url of validDerivativeUrls) {
    validateAIDerivativeBoundary(url); // Should not throw
  }

  console.log("✓ Security boundary verified: Original uploads strictly rejected; AI derivatives accepted.");

  // --------------------------------------------------------------------------
  // Test 2: Single Photo Analysis & Zod Schema v1.0.0 Validation
  // --------------------------------------------------------------------------
  console.log("\n[Test 2] Single photo analysis with structured output & Zod validation...");

  const testAnalysis = createValidPhotoAnalysis("photo_alpine_01");

  const mockSuccessFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "gen_vision_01",
        model: "openrouter/free",
        choices: [
          {
            message: {
              content: JSON.stringify(testAnalysis),
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 850,
          completion_tokens: 320,
          total_tokens: 1170,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const testGateway = new AIGateway({ fetchFn: mockSuccessFetch });
  const testRepo = new InMemoryPhotoAnalysisRepository();
  const testCache = new PhotoAnalysisCache();

  const analysisResult = await analyzePhoto(
    {
      photoId: "photo_alpine_01",
      bookId: "bk_alps",
      aiDerivativeUrl:
        "https://storage.memorymagazine.internal/photo-derivatives/signed/usr_1/bk_alps/photo_alpine_01/ai.jpg?token=xyz",
    },
    {
      gateway: testGateway,
      repository: testRepo,
      cache: testCache,
      userId: "usr_alice",
    },
  );

  if (analysisResult.schemaVersion !== "1.0.0") {
    throw new Error(`Schema version mismatch: ${analysisResult.schemaVersion}`);
  }
  if (analysisResult.photoId !== "photo_alpine_01") {
    throw new Error(`Photo ID mismatch: ${analysisResult.photoId}`);
  }
  if (analysisResult.orientation !== "LANDSCAPE") {
    throw new Error(`Orientation mismatch: ${analysisResult.orientation}`);
  }
  if (!analysisResult.composition.focalPoint) {
    throw new Error("Focal point missing in composition");
  }

  const savedRecord = await testRepo.getAnalysisByPhotoId("photo_alpine_01");
  if (!savedRecord || savedRecord.analysisJson.photoId !== "photo_alpine_01") {
    throw new Error("Analysis failed to persist to repository");
  }
  const savedStatus = await testRepo.getStatus("photo_alpine_01");
  if (savedStatus !== "ANALYZED") {
    throw new Error(`Expected status ANALYZED, got ${savedStatus}`);
  }

  console.log("✓ Single photo analysis with PhotoAnalysis v1.0.0 validated and persisted.");

  // --------------------------------------------------------------------------
  // Test 3: Invalid Model Output & Schema Mismatch Rejection
  // --------------------------------------------------------------------------
  console.log("\n[Test 3] Invalid model output and schema mismatch rejection...");

  const mockBadOutputFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "gen_vision_bad",
        model: "openrouter/free",
        choices: [
          {
            message: {
              content: JSON.stringify({
                schemaVersion: "2.0.0", // Invalid schema version
                description: "Malformed output",
              }),
            },
            finish_reason: "stop",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const badGateway = new AIGateway({ fetchFn: mockBadOutputFetch });
  const badRepo = new InMemoryPhotoAnalysisRepository();
  let schemaErrorCaught = false;

  try {
    await analyzePhoto(
      {
        photoId: "photo_bad_01",
        bookId: "bk_test",
        aiDerivativeUrl:
          "https://storage.memorymagazine.internal/photo-derivatives/signed/usr_1/bk_test/photo_bad_01/ai.jpg",
      },
      {
        gateway: badGateway,
        repository: badRepo,
        cache: new PhotoAnalysisCache(),
      },
    );
  } catch (err) {
    schemaErrorCaught = true;
    if (err instanceof AIGatewayError) {
      if (err.code !== "SCHEMA_VALIDATION_ERROR") {
        throw new Error(`Expected SCHEMA_VALIDATION_ERROR, got ${err.code}`);
      }
    }
  }

  if (!schemaErrorCaught) {
    throw new Error("Malformed schema output was unexpectedly accepted");
  }

  // Verify status is FAILED and record is NOT stored
  const badStatus = await badRepo.getStatus("photo_bad_01");
  if (badStatus !== "FAILED") {
    throw new Error(`Expected status FAILED on schema error, got ${badStatus}`);
  }
  const nonExistentRecord = await badRepo.getAnalysisByPhotoId("photo_bad_01");
  if (nonExistentRecord !== null) {
    throw new Error("Invalid analysis was incorrectly stored in repository");
  }

  console.log("✓ Malformed AI output correctly rejected with SCHEMA_VALIDATION_ERROR, status marked FAILED.");

  // --------------------------------------------------------------------------
  // Test 4: Model Fallback Ownership & Actual Model Recording
  // --------------------------------------------------------------------------
  console.log("\n[Test 4] OpenRouter model fallback recording...");

  let capturedRequest: OpenRouterRequestPayload | undefined;
  const mockFallbackFetch: typeof fetch = async (url, init) => {
    capturedRequest = JSON.parse(init?.body as string) as OpenRouterRequestPayload;

    // Simulate OpenRouter internally falling back to google/gemma-4-31b-it:free
    return new Response(
      JSON.stringify({
        id: "gen_fallback_01",
        model: "google/gemma-4-31b-it:free",
        choices: [
          {
            message: {
              content: JSON.stringify(createValidPhotoAnalysis("photo_fb_01")),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 700, completion_tokens: 300, total_tokens: 1000 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const fallbackGateway = new AIGateway({ fetchFn: mockFallbackFetch });
  const fallbackRepo = new InMemoryPhotoAnalysisRepository();

  await analyzePhoto(
    {
      photoId: "photo_fb_01",
      bookId: "bk_fb",
      aiDerivativeUrl:
        "https://storage.memorymagazine.internal/photo-derivatives/signed/usr_1/bk_fb/photo_fb_01/ai.jpg",
    },
    {
      gateway: fallbackGateway,
      repository: fallbackRepo,
      cache: new PhotoAnalysisCache(),
    },
  );

  const fbRecord = await fallbackRepo.getAnalysisByPhotoId("photo_fb_01");
  if (!fbRecord) {
    throw new Error("Fallback record not saved");
  }
  console.log("Captured fallback models in request:", capturedRequest?.models);
  console.log("Actual model saved in record:", fbRecord.model);

  if (fbRecord.model !== "google/gemma-4-31b-it:free") {
    throw new Error(
      `Expected actual model google/gemma-4-31b-it:free, got ${fbRecord.model}`,
    );
  }
  console.log("✓ Actual model accurately captured from OpenRouter fallback.");

  // --------------------------------------------------------------------------
  // Test 5: Deterministic Analysis Cache
  // --------------------------------------------------------------------------
  console.log("\n[Test 5] Deterministic analysis cache and idempotency...");

  const callTracker = { count: 0 };
  const getCallCount = (): number => callTracker.count;

  const mockCountingFetch: typeof fetch = async () => {
    callTracker.count++;
    return new Response(
      JSON.stringify({
        id: "gen_count",
        model: "openrouter/free",
        choices: [
          {
            message: {
              content: JSON.stringify(createValidPhotoAnalysis("photo_cached_01")),
            },
            finish_reason: "stop",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const cacheGateway = new AIGateway({ fetchFn: mockCountingFetch });
  const sharedCache = new PhotoAnalysisCache();
  const sharedRepo = new InMemoryPhotoAnalysisRepository();

  const inputParam = {
    photoId: "photo_cached_01",
    bookId: "bk_cache",
    aiDerivativeUrl:
      "https://storage.memorymagazine.internal/photo-derivatives/signed/usr_1/bk_cache/photo_cached_01/ai.jpg?expires=300&token=sig1",
  };

  // Call 1: Miss -> Network call
  await analyzePhoto(inputParam, {
    gateway: cacheGateway,
    cache: sharedCache,
    repository: sharedRepo,
  });
  if (getCallCount() !== 1) {
    throw new Error(`Expected 1 network call, got ${getCallCount()}`);
  }

  // Call 2: Different signed URL query params (?token=sig2) -> Still Cache HIT because of normalized derivative path!
  const inputParamNewToken = {
    photoId: "photo_cached_01",
    bookId: "bk_cache",
    aiDerivativeUrl:
      "https://storage.memorymagazine.internal/photo-derivatives/signed/usr_1/bk_cache/photo_cached_01/ai.jpg?expires=600&token=sig2",
  };

  await analyzePhoto(inputParamNewToken, {
    gateway: cacheGateway,
    cache: sharedCache,
    repository: sharedRepo,
  });
  if (getCallCount() !== 1) {
    throw new Error(
      `Cache hit failed: Network calls increased to ${getCallCount()}`,
    );
  }

  // Call 3: bypassCache: true -> Forced fresh network call
  await analyzePhoto(inputParam, {
    gateway: cacheGateway,
    cache: sharedCache,
    repository: sharedRepo,
    bypassCache: true,
  });
  if (getCallCount() !== 2) {
    throw new Error(`bypassCache failed: expected 2 calls, got ${getCallCount()}`);
  }

  console.log("✓ Deterministic cache hit verified across signed URL token refreshes.");

  // --------------------------------------------------------------------------
  // Test 6: Rate Limiting & Gateway Retries (429 Handling)
  // --------------------------------------------------------------------------
  console.log("\n[Test 6] Rate limit 429 error handling...");

  let rateLimitAttempts = 0;
  const mock429Fetch: typeof fetch = async () => {
    rateLimitAttempts++;
    return new Response(
      JSON.stringify({ error: { message: "Rate limit exceeded. Try again later." } }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  };

  const rlGateway = new AIGateway({ fetchFn: mock429Fetch });
  let rlErrorCaught = false;

  try {
    await analyzePhoto(
      {
        photoId: "photo_rl_01",
        bookId: "bk_rl",
        aiDerivativeUrl:
          "https://storage.memorymagazine.internal/photo-derivatives/signed/usr_1/bk_rl/photo_rl_01/ai.jpg",
      },
      {
        gateway: rlGateway,
        cache: new PhotoAnalysisCache(),
        repository: new InMemoryPhotoAnalysisRepository(),
      },
    );
  } catch (err) {
    rlErrorCaught = true;
    if (err instanceof AIGatewayError) {
      if (err.statusCode !== 429 && err.code !== "GATEWAY_TEMPORARY_FAILURE") {
        throw new Error(
          `Expected 429 GATEWAY_TEMPORARY_FAILURE, got status ${err.statusCode} code ${err.code}`,
        );
      }
    }
  }

  if (!rlErrorCaught || rateLimitAttempts < 1) {
    throw new Error("Failed to catch rate limit error or no attempts recorded");
  }
  console.log("✓ Rate limiting handled correctly via AI Gateway.");

  // --------------------------------------------------------------------------
  // Test 7: Batch Analysis (10, 20, 50 photos) with Concurrency & Isolation
  // --------------------------------------------------------------------------
  console.log("\n[Test 7] Batch analysis with controlled concurrency & error isolation...");

  let activeRequests = 0;
  let maxObservedConcurrency = 0;

  const mockBatchFetch: typeof fetch = async (url, init) => {
    activeRequests++;
    if (activeRequests > maxObservedConcurrency) {
      maxObservedConcurrency = activeRequests;
    }

    // Small delay to test concurrency overlap
    await new Promise((resolve) => setTimeout(resolve, 5));

    const payload = JSON.parse(init?.body as string) as OpenRouterRequestPayload;
    activeRequests--;

    // Intentionally fail photo_03 to test error isolation
    const isPhoto3 = payload.messages[1]?.content &&
      typeof payload.messages[1].content !== "string" &&
      JSON.stringify(payload.messages[1].content).includes("photo_batch_03");

    if (isPhoto3) {
      return new Response(
        JSON.stringify({
          id: "gen_fail",
          model: "openrouter/free",
          choices: [{ message: { content: "INVALID_JSON_STREAM" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        id: "gen_batch_ok",
        model: "openrouter/free",
        choices: [
          {
            message: {
              content: JSON.stringify(createValidPhotoAnalysis("batch_photo")),
            },
            finish_reason: "stop",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const batchGateway = new AIGateway({ fetchFn: mockBatchFetch });

  // Test 50 photos batch
  const fiftyPhotos = Array.from({ length: 50 }, (_, i) => {
    const padded = String(i + 1).padStart(2, "0");
    return {
      photoId: `photo_batch_${padded}`,
      bookId: "bk_batch_50",
      aiDerivativeUrl: `https://storage.memorymagazine.internal/photo-derivatives/signed/usr_1/bk_batch_50/photo_batch_${padded}/ai.jpg`,
    };
  });

  const concurrencyLimit = 2;
  const batchResult = await analyzePhotosBatch(fiftyPhotos, {
    gateway: batchGateway,
    concurrency: concurrencyLimit,
    cache: new PhotoAnalysisCache(),
    repository: new InMemoryPhotoAnalysisRepository(),
  });

  console.log(`50-Photo Batch total: ${batchResult.total}`);
  console.log(`Succeeded: ${batchResult.succeeded}, Failed: ${batchResult.failed}`);
  console.log(`Max observed in-flight concurrency: ${maxObservedConcurrency}`);

  if (batchResult.total !== 50) {
    throw new Error(`Expected 50 total results, got ${batchResult.total}`);
  }
  if (batchResult.succeeded !== 49) {
    throw new Error(`Expected 49 successes, got ${batchResult.succeeded}`);
  }
  if (batchResult.failed !== 1) {
    throw new Error(`Expected 1 isolated failure, got ${batchResult.failed}`);
  }
  if (maxObservedConcurrency > concurrencyLimit) {
    throw new Error(
      `Concurrency exceeded limit (${maxObservedConcurrency} > ${concurrencyLimit})`,
    );
  }

  const failedItem = batchResult.results.find((r) => r.photoId === "photo_batch_03");
  if (!failedItem || failedItem.status !== "FAILED") {
    throw new Error("photo_batch_03 was not marked as FAILED");
  }

  const successItem = batchResult.results.find((r) => r.photoId === "photo_batch_01");
  if (!successItem || successItem.status !== "ANALYZED" || !successItem.analysis) {
    throw new Error("photo_batch_01 failed or missing analysis");
  }

  console.log("✓ 50-photo batch analysis verified: concurrency throttled, per-photo error isolated.");

  // --------------------------------------------------------------------------
  // Test 8: Confidence Assessment and Advisory Print Guidance
  // --------------------------------------------------------------------------
  console.log("\n[Test 8] Confidence evaluation & advisory print quality check...");

  const lowConfidenceAssessment = assessAnalysisConfidence({
    overall: 0.55,
    scene: 0.45,
    subjects: 0.8,
    composition: 0.4,
    location: 0.3,
    occasion: 0.5,
  });

  if (!lowConfidenceAssessment.isLowConfidence) {
    throw new Error("Failed to detect low confidence analysis");
  }
  if (lowConfidenceAssessment.flaggedAreas.length < 3) {
    throw new Error("Flagged areas undercounted");
  }

  const poorQualityAdvisory = getPrintAdvisory({
    overall: "POOR",
    sharpness: "BLURRY",
    exposure: "DARK",
    composition: "WEAK",
    usableForPrint: "NO",
    confidence: 0.8,
  });

  if (!poorQualityAdvisory.isAdvisoryOnly) {
    throw new Error("Print advisory must be advisory only (isAdvisoryOnly: true)");
  }
  if (poorQualityAdvisory.usableForPrint !== "NO") {
    throw new Error("Expected advisory usableForPrint to be NO");
  }

  const riskyCrop = isCropRisky({
    subjectPosition: "MULTIPLE",
    balance: "ASYMMETRIC",
    negativeSpace: "NONE",
    depth: "FLAT",
    cropSafety: "RISKY",
  });
  if (!riskyCrop) {
    throw new Error("Expected isCropRisky to return true");
  }

  console.log("✓ Confidence evaluation and non-destructive print advisories verified.");

  console.log("\n=== ALL PART 5 VISION AI TESTS PASSED SUCCESSFULLY ===");
}

if (require.main === module) {
  runVisionTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}
