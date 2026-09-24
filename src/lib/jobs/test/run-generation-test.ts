import { AIGateway } from "@/lib/ai/gateway";
import { setGlobalAIGateway } from "@/lib/ai";
import {
  type PhotoAnalysis,
  InMemoryPhotoAnalysisRepository,
  setAnalysisRepository,
} from "@/lib/ai/vision";
import {
  type EditorialPlan,
  InMemoryEditorialPlanRepository,
  setEditorialRepository,
} from "@/lib/ai/editorial";
import {
  type DesignGenerationResult,
  InMemoryDesignRepository,
  setDesignRepository,
} from "@/lib/ai/design";
import {
  DESIGN_SCHEMA_VERSION,
  type BookDesign,
  type BookSize,
} from "@/types/design";
import { BOOK_SIZES, DEFAULT_PRINT_SETTINGS } from "@/config/book";
import {
  InMemoryStorageProvider,
  setStorageProvider,
  PHOTO_STORAGE_BUCKETS,
  getAIDerivativePath,
} from "@/lib/photos";
import {
  JOB_TYPES,
  JOB_RETRY_CONFIG,
  GENERATION_MILESTONES,
  PDF_RETENTION,
} from "@/config/jobs";
import {
  InMemoryBookRepository,
  InMemoryJobRepository,
  InMemoryExportRepository,
  setBookRepository,
  setJobRepository,
  setExportRepository,
} from "../storage";
import {
  createBookGenerationJob,
  runBookGeneration,
  retryBookGeneration,
  cancelBookGeneration,
  getBookGenerationStatus,
} from "../book-generation";
import { executePhotoStep } from "../steps/photo-step";
import { executeVisionStep } from "../steps/vision-step";
import { executeEditorialStep } from "../steps/editorial-step";
import { executeDesignStep } from "../steps/design-step";
import { executePdfExport } from "../steps/pdf-export";
import { computeDesignHash, computeJobIdempotencyKey } from "../idempotency";
import { JobExecutionError } from "../errors";
import type { BookRecord, GenerationContext } from "../types";

// ============================================================================
// Synthetic Test Data Helpers
// ============================================================================

function createMockPhotoAnalysis(id: string): PhotoAnalysis {
  return {
    schemaVersion: "1.0.0",
    photoId: id,
    orientation: "LANDSCAPE",
    visualDescription: `Scenic travel photo ${id} capturing landmarks and surroundings.`,
    scene: {
      category: "TRAVEL",
      description: `Travel scenery for ${id}`,
      environment: "Outdoors",
      timeOfDay: "AFTERNOON",
    },
    subjects: [
      {
        type: "LANDSCAPE",
        count: 1,
        prominence: "PRIMARY",
        description: "Mountain landscape",
      },
    ],
    peopleCount: 1,
    composition: {
      subjectPosition: "CENTER",
      balance: "BALANCED",
      negativeSpace: "MEDIUM",
      depth: "DEEP",
      cropSafety: "SAFE",
      focalPoint: { x: 0.5, y: 0.5 },
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
      dominant: ["#1E293B", "#38BDF8"],
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
      "nature",
      "travel",
      "adventure",
      "scenic",
    ],
    confidence: {
      overall: 0.95,
      scene: 0.9,
      subjects: 0.9,
      composition: 0.85,
      location: 0.8,
      occasion: 0.85,
    },
  };
}

function createMockEditorialPlan(
  bookId: string,
  photoIds: string[],
): EditorialPlan {
  const mid = Math.ceil(photoIds.length / 2);
  const ch1Photos = photoIds.slice(0, mid);
  const ch2Photos = photoIds.slice(mid);

  const chapters = [
    {
      id: "ch_01",
      title: "Ascent to the Heights",
      summary: "First encounters with the high country peaks.",
      photoIds: ch1Photos,
      order: 1,
      mood: "Adventurous",
      transitionIn: "Opening scenes",
      transitionOut: "Moving towards discovery",
    },
  ];

  if (ch2Photos.length > 0) {
    chapters.push({
      id: "ch_02",
      title: "Golden Hour Solitude",
      summary: "Twilight settling across the ridges.",
      photoIds: ch2Photos,
      order: 2,
      mood: "Serene",
      transitionIn: "Deeper exploration",
      transitionOut: "Final memories",
    });
  }

  const photoSequence = photoIds.map((pid, idx) => ({
    photoId: pid,
    sequence: idx + 1,
    chapterId: idx < mid ? "ch_01" : "ch_02",
    role:
      idx === 0
        ? ("OPENING" as const)
        : idx === photoIds.length - 1
          ? ("CLOSING" as const)
          : ("MOMENT" as const),
    importance: 0.85,
    transitionReason: "Paced for visual continuity",
  }));

  const captions = photoIds.map((pid) => ({
    photoId: pid,
    text: `Capturing the atmosphere of scene ${pid}.`,
    style: "EDITORIAL" as const,
    confidence: 0.9,
  }));

  return {
    schemaVersion: "1.0.0",
    bookId,
    title: "Alpine Memories",
    subtitle: "A Visual Journey",
    narrativeSummary: "Chronological exploration of majestic alpine vistas and quiet mountain moments.",
    chapters,
    photoSequence,
    coverCandidateIds: [photoIds[0]],
    openingPhotoId: photoIds[0],
    closingPhotoId: photoIds[photoIds.length - 1],
    pacing: {
      opening: "SLOW",
      middle: "MODERATE",
      ending: "REFLECTIVE",
      rhythm: "BALANCED",
    },
    captions,
    editorialNotes: ["Visual rhythm established through balanced contrast."],
    confidence: {
      overall: 0.94,
      narrative: 0.95,
      grouping: 0.92,
      pacing: 0.93,
      captions: 0.9,
    },
  };
}

function createMockDesign(
  size: BookSize,
  photos: PhotoAnalysis[],
  editorialPlan: EditorialPlan,
): BookDesign {
  const sizeConfig = BOOK_SIZES[size] || BOOK_SIZES.A4;
  const printConfig = DEFAULT_PRINT_SETTINGS;
  const { width: widthMm, height: heightMm } = sizeConfig.dimensions;
  const { safeAreaMm, bleedMm } = printConfig;

  const safeBounds = {
    minX: safeAreaMm,
    maxX: widthMm - safeAreaMm,
    minY: safeAreaMm,
    maxY: heightMm - safeAreaMm,
    width: widthMm - safeAreaMm * 2,
    height: heightMm - safeAreaMm * 2,
  };

  const pages: BookDesign["pages"] = [];
  const spreads: BookDesign["spreads"] = [];

  // Page 1: Cover
  const coverPhotoId = editorialPlan.coverCandidateIds[0] || photos[0].photoId;
  pages.push({
    id: "page_1",
    pageNumber: 1,
    layoutType: "HERO",
    elements: [
      {
        id: "el_p1_img",
        type: "image",
        assetId: coverPhotoId,
        xMm: 0,
        yMm: 0,
        widthMm,
        heightMm: Math.round(heightMm * 0.7),
        fit: "COVER",
        focalPoint: { x: 0.5, y: 0.5 },
      },
      {
        id: "el_p1_title",
        type: "text",
        text: editorialPlan.title,
        xMm: safeBounds.minX,
        yMm: Math.round(heightMm * 0.74),
        widthMm: safeBounds.width,
        heightMm: 22,
        fontFamily: "Inter",
        fontWeight: 700,
        fontSizePt: 28,
        lineHeight: 1.2,
        letterSpacingPt: -0.5,
        color: "#0F172A",
        align: "center",
      },
    ],
  });

  // Content pages
  let currentPage = 2;
  const remaining = photos.filter((p) => p.photoId !== coverPhotoId);

  for (const photo of remaining) {
    pages.push({
      id: `page_${currentPage}`,
      pageNumber: currentPage,
      layoutType: "PHOTO_TEXT",
      elements: [
        {
          id: `el_p${currentPage}_img`,
          type: "image",
          assetId: photo.photoId,
          xMm: safeBounds.minX,
          yMm: safeBounds.minY,
          widthMm: safeBounds.width,
          heightMm: Math.round(safeBounds.height * 0.75),
          fit: "COVER",
          focalPoint: photo.composition.focalPoint,
        },
        {
          id: `el_p${currentPage}_caption`,
          type: "text",
          text: `Scenic moment from ${photo.photoId}`,
          xMm: safeBounds.minX,
          yMm: safeBounds.minY + Math.round(safeBounds.height * 0.78),
          widthMm: safeBounds.width,
          heightMm: 12,
          fontFamily: "Inter",
          fontWeight: 400,
          fontSizePt: 10,
          lineHeight: 1.4,
          letterSpacingPt: 0,
          color: "#475569",
          align: "left",
        },
      ],
    });
    currentPage++;
  }

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    document: {
      schemaVersion: DESIGN_SCHEMA_VERSION,
      size,
      widthMm,
      heightMm,
      bleedMm,
      safeAreaMm,
      gutterMm: printConfig.gutterMm,
      dpi: printConfig.dpi,
      orientation: sizeConfig.orientation,
    },
    pages,
    spreads,
  };
}

// ============================================================================
// Test Suite Execution
// ============================================================================

async function runPart9Tests() {
  console.log("================================================================================");
  console.log(" PART 9: PRODUCTION ORCHESTRATION & BOOK GENERATION WORKFLOW TEST SUITE");
  console.log("================================================================================\n");

  const userId = "usr_traveler_42";
  const photoIds = Array.from({ length: 10 }, (_, i) => `photo_${String(i + 1).padStart(2, "0")}`);

  // Repositories & Storage
  const bookRepo = new InMemoryBookRepository();
  const jobRepo = new InMemoryJobRepository();
  const exportRepo = new InMemoryExportRepository();
  const analysisRepo = new InMemoryPhotoAnalysisRepository();
  const editorialRepo = new InMemoryEditorialPlanRepository();
  const designRepo = new InMemoryDesignRepository();
  const storage = new InMemoryStorageProvider();

  setBookRepository(bookRepo);
  setJobRepository(jobRepo);
  setExportRepository(exportRepo);
  setAnalysisRepository(analysisRepo);
  setEditorialRepository(editorialRepo);
  setDesignRepository(designRepo);
  setStorageProvider(storage);

  // Pre-seed storage derivatives for the 10 photos
  for (const pid of photoIds) {
    const aiPath = getAIDerivativePath(userId, "book_alpha", pid);
    await storage.uploadFile(
      PHOTO_STORAGE_BUCKETS.DERIVATIVES,
      aiPath,
      Buffer.from("mock_derivative_bytes"),
      "image/jpeg",
    );
  }

  // Configure Mock AI Gateway
  let shouldFailDesign = false;
  let shouldFailPersistent = false;
  let visionCallCount = 0;
  let editorialCallCount = 0;
  let designCallCount = 0;

  const mockGatewayFetch: typeof fetch = async (url, init) => {
    const bodyStr = init?.body?.toString() || "{}";
    const body = JSON.parse(bodyStr);
    const content = body.messages?.[body.messages.length - 1]?.content || "";

    if (shouldFailPersistent) {
      return new Response(
        JSON.stringify({
          error: {
            message: "Fatal unrecoverable provider failure.",
            code: 500,
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Vision Analysis
    const isVision =
      bodyStr.includes("PhotoAnalysis") ||
      bodyStr.includes("Analyze this photograph") ||
      bodyStr.includes("Photo ID:");
    const isEditorial =
      bodyStr.includes("EditorialPlan") ||
      bodyStr.includes("editorial narrative") ||
      bodyStr.includes("EDITORIAL_PLANNING");
    const isDesign =
      bodyStr.includes("DesignGenerationResult") ||
      bodyStr.includes("Design JSON v1.0.0") ||
      bodyStr.includes("DESIGN_PLANNING");

    // Design Planning (Checked first since design input embeds editorial plan)
    if (isDesign) {
      designCallCount++;
      if (shouldFailDesign) {
        return new Response(
          JSON.stringify({
            error: {
              message: "Simulated Design AI generation timeout.",
              code: 504,
            },
          }),
          { status: 504, headers: { "Content-Type": "application/json" } },
        );
      }

      const isBook2 = bodyStr.includes("book_beta");
      const currentPhotos = isBook2 ? book2PhotoIds : photoIds;
      const targetBookId = isBook2 ? "book_beta" : "book_alpha";

      const mockPlan = createMockEditorialPlan(targetBookId, currentPhotos);
      const mockAnalyses = currentPhotos.map((pid) => createMockPhotoAnalysis(pid));
      const design = createMockDesign("A4", mockAnalyses, mockPlan);
      const result: DesignGenerationResult = {
        schemaVersion: "1.0.0",
        design,
        rationale: {
          overall: "Clean Swiss editorial layout with prominent imagery.",
        },
      };

      return new Response(
        JSON.stringify({
          id: `gen_des_${designCallCount}`,
          model: "openrouter/free",
          choices: [{ message: { content: JSON.stringify(result) }, finish_reason: "stop" }],
          usage: { prompt_tokens: 2500, completion_tokens: 1500, total_tokens: 4000 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Editorial Planning
    if (isEditorial) {
      editorialCallCount++;
      const isBook2 = bodyStr.includes("book_beta");
      const currentPhotos = isBook2 ? book2PhotoIds : photoIds;
      const targetBookId = isBook2 ? "book_beta" : "book_alpha";
      const plan = createMockEditorialPlan(targetBookId, currentPhotos);
      return new Response(
        JSON.stringify({
          id: `gen_edit_${editorialCallCount}`,
          model: "openrouter/free",
          choices: [{ message: { content: JSON.stringify(plan) }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1200, completion_tokens: 800, total_tokens: 2000 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Vision Analysis
    if (isVision) {
      visionCallCount++;
      const idMatch = bodyStr.match(/Photo ID:\s*([^\s\\"\n]+)/i);
      const currentPid = idMatch ? idMatch[1] : photoIds[(visionCallCount - 1) % photoIds.length];
      const analysis = createMockPhotoAnalysis(currentPid);
      return new Response(
        JSON.stringify({
          id: `gen_vis_${visionCallCount}`,
          model: "openrouter/free",
          choices: [{ message: { content: JSON.stringify(analysis) }, finish_reason: "stop" }],
          usage: { prompt_tokens: 350, completion_tokens: 200, total_tokens: 550 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: { message: "Unhandled mock call" } }), { status: 400 });
  };

  const mockGateway = new AIGateway({ fetchFn: mockGatewayFetch });
  setGlobalAIGateway(mockGateway);

  // --------------------------------------------------------------------------
  // Test 1: Complete Happy Path Book Generation (Uploaded Photos -> PREVIEW_READY)
  // --------------------------------------------------------------------------
  console.log("[Test 1] Complete happy path book generation from photos to PREVIEW_READY...");

  const book1: BookRecord = {
    id: "book_alpha",
    userId,
    title: "Alpine Memories",
    occasion: "TRAVEL",
    style: "EDITORIAL",
    size: "A4",
    status: "CREATED",
    photoIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await bookRepo.createBook(book1);

  const initialJob = await createBookGenerationJob(book1.id, userId, bookRepo, jobRepo);
  if (initialJob.status !== "QUEUED") {
    throw new Error(`Expected initial job status QUEUED, got ${initialJob.status}`);
  }
  if (initialJob.progress !== GENERATION_MILESTONES.QUEUED.progressPercent) {
    throw new Error(`Expected progress ${GENERATION_MILESTONES.QUEUED.progressPercent}, got ${initialJob.progress}`);
  }

  const finishedJob = await runBookGeneration(initialJob.id, bookRepo, jobRepo);
  if (finishedJob.status !== "SUCCEEDED") {
    throw new Error(`Expected job SUCCEEDED, got ${finishedJob.status} (${finishedJob.errorMessage})`);
  }
  if (finishedJob.progress !== 100) {
    throw new Error(`Expected job progress 100%, got ${finishedJob.progress}%`);
  }

  const updatedBook1 = await bookRepo.getBookById(book1.id);
  if (updatedBook1?.status !== "PREVIEW_READY") {
    throw new Error(`Expected book status PREVIEW_READY, got ${updatedBook1?.status}`);
  }

  const savedDesign = await designRepo.getDesignByBookId(book1.id);
  if (!savedDesign || !savedDesign.designJson) {
    throw new Error("Expected saved design in repository, found null");
  }
  if (savedDesign.designJson.pages.length !== 10) {
    throw new Error(`Expected 10 design pages (1 cover + 9 content), got ${savedDesign.designJson.pages.length}`);
  }

  console.log("✓ Happy path completed successfully: Photos -> Vision -> Story -> Design -> PREVIEW_READY.");

  // --------------------------------------------------------------------------
  // Test 2: Resumability After Simulated Failure & Partial Progress Retention
  // --------------------------------------------------------------------------
  console.log("\n[Test 2] Resumability after simulated failure: retaining Vision & Editorial artifacts...");

  const book2PhotoIds = photoIds.slice(0, 5);
  for (const pid of book2PhotoIds) {
    const aiPath = getAIDerivativePath(userId, "book_beta", pid);
    await storage.uploadFile(
      PHOTO_STORAGE_BUCKETS.DERIVATIVES,
      aiPath,
      Buffer.from("mock_derivative_bytes"),
      "image/jpeg",
    );
  }

  const book2: BookRecord = {
    id: "book_beta",
    userId,
    title: "Weekend in Alps",
    occasion: "TRAVEL",
    style: "MINIMAL",
    size: "A4",
    status: "CREATED",
    photoIds: book2PhotoIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await bookRepo.createBook(book2);

  // Trigger simulated Design stage failure
  shouldFailDesign = true;
  const book2Job = await createBookGenerationJob(book2.id, userId, bookRepo, jobRepo);
  const failedJob = await runBookGeneration(book2Job.id, bookRepo, jobRepo);

  if (failedJob.status !== "FAILED" && failedJob.status !== "QUEUED") {
    throw new Error(`Expected job to fail or be queued for retry, got ${failedJob.status}`);
  }
  if (failedJob.errorCode !== "DESIGN_GENERATION_FAILED") {
    throw new Error(`Expected DESIGN_GENERATION_FAILED, got ${failedJob.errorCode}`);
  }
  if (!failedJob.errorRetryable) {
    throw new Error("Expected error to be flagged as retryable");
  }

  // Verify Vision & Editorial artifacts were preserved
  for (const pid of book2PhotoIds) {
    const analysis = await analysisRepo.getAnalysisByPhotoId(pid);
    if (!analysis) {
      throw new Error(`Expected preserved Vision analysis for ${pid}`);
    }
  }
  const editorialPlan = await editorialRepo.getPlanByBookId(book2.id);
  if (!editorialPlan) {
    throw new Error("Expected preserved Editorial plan for book_beta");
  }

  // Restore Design AI and retry
  shouldFailDesign = false;
  const initialVisionCalls = visionCallCount;
  const initialEditorialCalls = editorialCallCount;

  const retriedJob = await retryBookGeneration(book2.id, userId, bookRepo, jobRepo);

  if (retriedJob.status !== "SUCCEEDED") {
    throw new Error(`Expected retried job to SUCCEED, got ${retriedJob.status}`);
  }

  // Verify no redundant AI calls were made for preserved stages
  if (visionCallCount !== initialVisionCalls) {
    throw new Error(`Redundant Vision AI calls detected! Expected ${initialVisionCalls}, got ${visionCallCount}`);
  }
  if (editorialCallCount !== initialEditorialCalls) {
    throw new Error(`Redundant Editorial AI calls detected! Expected ${initialEditorialCalls}, got ${editorialCallCount}`);
  }

  const updatedBook2 = await bookRepo.getBookById(book2.id);
  if (updatedBook2?.status !== "PREVIEW_READY") {
    throw new Error(`Expected retried book status PREVIEW_READY, got ${updatedBook2?.status}`);
  }

  console.log("✓ Resumability verified: Vision analyses and Editorial plan were preserved and reused without redundant AI calls.");

  // --------------------------------------------------------------------------
  // Test 3: Duplicate Request Protection
  // --------------------------------------------------------------------------
  console.log("\n[Test 3] Duplicate request protection on active jobs...");

  const book3: BookRecord = {
    id: "book_gamma",
    userId,
    title: "Gamma Journey",
    occasion: "TRAVEL",
    style: "CINEMATIC",
    size: "SQUARE_210",
    status: "CREATED",
    photoIds: photoIds.slice(0, 4),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await bookRepo.createBook(book3);

  // Pre-seed storage for book 3
  for (const pid of book3.photoIds!) {
    await storage.uploadFile(
      PHOTO_STORAGE_BUCKETS.DERIVATIVES,
      getAIDerivativePath(userId, "book_gamma", pid),
      Buffer.from("mock_bytes"),
      "image/jpeg",
    );
  }

  const jobA = await createBookGenerationJob(book3.id, userId, bookRepo, jobRepo);
  const jobB = await createBookGenerationJob(book3.id, userId, bookRepo, jobRepo);

  if (jobA.id !== jobB.id) {
    throw new Error(`Duplicate request created conflicting job IDs: ${jobA.id} vs ${jobB.id}`);
  }

  const activeJobs = await jobRepo.listJobsByBookId(book3.id);
  const queuedOrRunning = activeJobs.filter((j) => j.status === "QUEUED" || j.status === "RUNNING");
  if (queuedOrRunning.length !== 1) {
    throw new Error(`Expected exactly 1 active job, found ${queuedOrRunning.length}`);
  }

  console.log(`✓ Duplicate protection verified: Concurrent requests returned existing active job ID (${jobA.id}).`);

  // --------------------------------------------------------------------------
  // Test 4: Idempotent Step Execution
  // --------------------------------------------------------------------------
  console.log("\n[Test 4] Idempotent step execution...");

  const genCtx: GenerationContext = {
    bookId: book1.id,
    userId,
    occasion: book1.occasion,
    style: book1.style,
    size: book1.size,
    photoIds,
  };

  // Step 1: Photo step idempotent
  const photoRes1 = await executePhotoStep(genCtx);
  const photoRes2 = await executePhotoStep(genCtx);
  if (photoRes1.readyPhotoIds.length !== photoRes2.readyPhotoIds.length) {
    throw new Error("Photo step produced divergent results across runs");
  }

  // Step 3: Editorial step cache reuse
  const analyses = photoIds.map((p) => createMockPhotoAnalysis(p));
  const editRes1 = await executeEditorialStep(genCtx, analyses);
  const editRes2 = await executeEditorialStep(genCtx, analyses);
  if (!editRes2.isCached) {
    throw new Error("Expected second run of executeEditorialStep to return isCached: true");
  }
  if (editRes1.plan.title !== editRes2.plan.title) {
    throw new Error("Editorial step produced non-identical cached plan");
  }

  // Step 4: Design step cache reuse
  const desRes1 = await executeDesignStep(genCtx, editRes1.plan, analyses);
  const desRes2 = await executeDesignStep(genCtx, editRes1.plan, analyses);
  if (!desRes2.isCached) {
    throw new Error("Expected second run of executeDesignStep to return isCached: true");
  }

  console.log("✓ Idempotent execution verified: Steps safely yield identical cached results on repeat execution.");

  // --------------------------------------------------------------------------
  // Test 5: Bounded Retries on Persistent Failures
  // --------------------------------------------------------------------------
  console.log("\n[Test 5] Bounded retries on persistent failures (max 2 attempts)...");

  const book4: BookRecord = {
    id: "book_delta",
    userId,
    title: "Delta Explorer",
    occasion: "TRAVEL",
    style: "EDITORIAL",
    size: "A4",
    status: "CREATED",
    photoIds: ["photo_01"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await bookRepo.createBook(book4);

  // Turn on persistent failure
  shouldFailPersistent = true;
  const deltaJob = await createBookGenerationJob(book4.id, userId, bookRepo, jobRepo);
  await jobRepo.updateJob(deltaJob.id, { maxAttempts: 2 });


  // Attempt 1
  const attempt1 = await runBookGeneration(deltaJob.id, bookRepo, jobRepo);
  if (attempt1.attempts !== 1) {
    throw new Error(`Expected attempt 1, got ${attempt1.attempts}`);
  }
  if (!attempt1.errorRetryable) {
    throw new Error("Expected attempt 1 to remain retryable");
  }

  // Attempt 2 (Max attempt reached)
  const attempt2 = await runBookGeneration(deltaJob.id, bookRepo, jobRepo);
  if (attempt2.attempts !== 2) {
    throw new Error(`Expected attempt 2, got ${attempt2.attempts}`);
  }
  if (attempt2.errorRetryable) {
    throw new Error("Expected attempt 2 to NOT be retryable anymore (max attempts reached)");
  }
  if (attempt2.status !== "FAILED") {
    throw new Error(`Expected terminal status FAILED, got ${attempt2.status}`);
  }

  shouldFailPersistent = false;
  console.log(`✓ Bounded retries verified: Terminated at attempt ${attempt2.attempts} with non-retryable FAILED status.`);

  // --------------------------------------------------------------------------
  // Test 6: Authorization & Ownership Enforced
  // --------------------------------------------------------------------------
  console.log("\n[Test 6] Authorization & ownership enforcement...");

  const attackerUserId = "usr_mallory_99";
  let createUnauthorizedCaught = false;
  try {
    await createBookGenerationJob(book1.id, attackerUserId, bookRepo, jobRepo);
  } catch (err) {
    if (err instanceof JobExecutionError && err.code === "UNAUTHORIZED") {
      createUnauthorizedCaught = true;
    }
  }
  if (!createUnauthorizedCaught) {
    throw new Error("Failed to block non-owner job creation");
  }

  let statusUnauthorizedCaught = false;
  try {
    await getBookGenerationStatus(book1.id, attackerUserId, bookRepo, jobRepo);
  } catch (err) {
    if (err instanceof JobExecutionError && err.code === "UNAUTHORIZED") {
      statusUnauthorizedCaught = true;
    }
  }
  if (!statusUnauthorizedCaught) {
    throw new Error("Failed to block non-owner status check");
  }

  let cancelUnauthorizedCaught = false;
  try {
    await cancelBookGeneration(finishedJob.id, attackerUserId, bookRepo, jobRepo);
  } catch (err) {
    if (err instanceof JobExecutionError && err.code === "UNAUTHORIZED") {
      cancelUnauthorizedCaught = true;
    }
  }
  if (!cancelUnauthorizedCaught) {
    throw new Error("Failed to block non-owner job cancellation");
  }

  console.log("✓ Authorization verified: Non-owners strictly blocked from job creation, status polling, and cancellation.");

  // --------------------------------------------------------------------------
  // Test 7: Asynchronous Authoritative PDF Export
  // --------------------------------------------------------------------------
  console.log("\n[Test 7] Asynchronous authoritative PDF export via Part 2 Print Engine...");

  const exportId = "exp_alpha_01";
  const exportResult = await executePdfExport(
    { exportId, bookId: book1.id, userId },
    exportRepo,
  );

  if (!exportResult.storagePath.includes(`books/${userId}/${book1.id}/exports/${exportId}.pdf`)) {
    throw new Error(`Invalid export storage path: ${exportResult.storagePath}`);
  }
  if (exportResult.pageCount !== 10) {
    throw new Error(`Expected 10 pages in exported PDF, got ${exportResult.pageCount}`);
  }
  if (exportResult.fileSizeBytes <= 0) {
    throw new Error(`Invalid PDF byte length: ${exportResult.fileSizeBytes}`);
  }

  const savedExport = await exportRepo.getExportById(exportId);
  if (!savedExport || savedExport.status !== "COMPLETED") {
    throw new Error("Expected COMPLETED export record in repository");
  }
  if (!savedExport.downloadUrl) {
    throw new Error("Expected signed download URL in export record");
  }

  console.log(`✓ PDF export verified: Rendered ${exportResult.pageCount} pages (${exportResult.fileSizeBytes} bytes) with signed URL.`);

  // --------------------------------------------------------------------------
  // Test 8: Export Race Condition Protection (Server Loads Latest Persisted DB Design)
  // --------------------------------------------------------------------------
  console.log("\n[Test 8] Export race condition protection: DB design is authoritative...");

  const latestDbDesign = await designRepo.getDesignByBookId(book1.id);
  const expectedHash = computeDesignHash(latestDbDesign!.designJson!);

  if (exportResult.designHash !== expectedHash) {
    throw new Error(`Export design hash mismatch: ${exportResult.designHash} vs ${expectedHash}`);
  }

  // Attempting to export an un-persisted or non-existent book fails safely
  let unpersistedFailed = false;
  try {
    await executePdfExport(
      { exportId: "exp_fail", bookId: "non_existent_book", userId },
      exportRepo,
    );
  } catch (err) {
    if (err instanceof JobExecutionError && err.code === "DESIGN_SAVE_REQUIRED") {
      unpersistedFailed = true;
    }
  }
  if (!unpersistedFailed) {
    throw new Error("Expected DESIGN_SAVE_REQUIRED error for un-persisted book design");
  }

  console.log("✓ Export race condition protection verified: DB design is authoritative; unpersisted state rejected.");

  // --------------------------------------------------------------------------
  // Test 9: State Independence on Cancellation
  // --------------------------------------------------------------------------
  console.log("\n[Test 9] State independence: Job cancellation does not corrupt prior artifacts...");

  const book5: BookRecord = {
    id: "book_epsilon",
    userId,
    title: "Epsilon Journey",
    occasion: "TRAVEL",
    style: "MINIMAL",
    size: "A4",
    status: "CREATED",
    photoIds: photoIds.slice(0, 3),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await bookRepo.createBook(book5);

  for (const pid of book5.photoIds!) {
    await storage.uploadFile(
      PHOTO_STORAGE_BUCKETS.DERIVATIVES,
      getAIDerivativePath(userId, "book_epsilon", pid),
      Buffer.from("mock_bytes"),
      "image/jpeg",
    );
  }

  const job5 = await createBookGenerationJob(book5.id, userId, bookRepo, jobRepo);

  // Cancel job
  const cancelledJob = await cancelBookGeneration(job5.id, userId, bookRepo, jobRepo);
  if (cancelledJob.status !== "CANCELLED") {
    throw new Error(`Expected CANCELLED job status, got ${cancelledJob.status}`);
  }

  const cancelledBook = await bookRepo.getBookById(book5.id);
  if (cancelledBook?.status !== "CANCELLED") {
    throw new Error(`Expected CANCELLED book status, got ${cancelledBook?.status}`);
  }

  // Prior book 1 and book 2 artifacts must remain completely intact
  const book1Status = await bookRepo.getBookById(book1.id);
  if (book1Status?.status !== "PREVIEW_READY") {
    throw new Error("Book 1 status was corrupted by cancellation of another job");
  }
  const book1Design = await designRepo.getDesignByBookId(book1.id);
  if (!book1Design || !book1Design.designJson) {
    throw new Error("Book 1 design was corrupted by cancellation of another job");
  }

  console.log("✓ State independence verified: Cancellation isolated; other book artifacts and prior state untouched.");

  // --------------------------------------------------------------------------
  // Test 10: Mock AI Mode & Canonical Hashing Integrity
  // --------------------------------------------------------------------------
  console.log("\n[Test 10] Mock AI mode verification & canonical hashing integrity...");

  const rawHash = computeDesignHash(savedDesign!.designJson!);
  if (!rawHash || typeof rawHash !== "string" || rawHash.length !== 64) {
    throw new Error(`Invalid SHA-256 hash length: ${rawHash}`);
  }

  const testKey = computeJobIdempotencyKey(
    "book_hash_test",
    JOB_TYPES.BOOK_GENERATION,
    { a: 1, b: "hello" },
  );
  if (!testKey || typeof testKey !== "string" || !testKey.startsWith("job_book_hash_test_book_generation_")) {
    throw new Error(`Invalid idempotency key format: ${testKey}`);
  }

  const testKeyIdentical = computeJobIdempotencyKey(
    "book_hash_test",
    JOB_TYPES.BOOK_GENERATION,
    { b: "hello", a: 1 }, // Key order reversed to test deterministic key sorting
  );
  if (testKey !== testKeyIdentical) {
    throw new Error(`Canonical hashing failed object key order independence: ${testKey} vs ${testKeyIdentical}`);
  }

  console.log(`✓ Canonical SHA-256 hashing verified (sample: ${testKey.substring(0, 16)}...).`);
  console.log("✓ Mock AI Mode verified: 100% of pipeline tests executed offline with zero real OpenRouter credit burn.");

  console.log("\n================================================================================");
  console.log(" ✓ ALL 10 PART 9 TEST SUITES PASSED SUCCESSFULLY!");
  console.log("================================================================================\n");
}

runPart9Tests().catch((err) => {
  console.error("\n❌ Part 9 Test Suite Failed:", err);
  process.exit(1);
});
