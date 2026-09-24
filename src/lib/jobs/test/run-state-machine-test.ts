/**
 * PART 9A: EXACT JOB STATE MACHINE TEST SUITE
 *
 * Exhaustively tests Specifications 73–81:
 * - Valid & invalid job transitions (rejection of all illegal mutations)
 * - Strict terminal state immutability (SUCCEEDED, FAILED, CANCELLED)
 * - Linear forward-only step advancement (PHOTOS -> VISION -> EDITORIAL -> DESIGN -> FINALIZING)
 * - Exact UX milestone progress percentages (20%, 45%, 65%, 85%, 95%, 100%)
 * - Book status product UX mapping
 * - Stage failure isolation (completed artifacts preserved)
 * - Retry step isolation (retries failed stage without repeating upstream work)
 * - Smart resume detection (determineEarliestInvalidStage)
 * - Cooperative cancellation at safe boundaries
 * - Single active job uniqueness for BOOK_GENERATION and PDF_EXPORT
 * - PDF export failure isolation (restores book to EDITING, never FAILED)
 */

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
} from "@/types/design";
import { BOOK_SIZES, DEFAULT_PRINT_SETTINGS } from "@/config/book";
import {
  InMemoryStorageProvider,
  setStorageProvider,
  PHOTO_STORAGE_BUCKETS,
  getAIDerivativePath,
} from "@/lib/photos";
import {
  JOB_STATUSES,
  BOOK_GENERATION_STEPS,
  STEP_PROGRESS_PERCENTAGES,
  type JobStatus,
  type BookGenerationStep,
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
} from "../book-generation";
import {
  canTransitionJob,
  transitionJob,
  canAdvanceStep,
  advanceBookGenerationStep,
  getBookStatusForJobStep,
  determineEarliestInvalidStage,
  isTerminalStatus,
  InvalidJobTransitionError,
} from "../state-machine";
import { createPdfExportJob, runPdfExportJob } from "../steps/pdf-export";
import type { BookJob, BookRecord } from "../types";

// ============================================================================
// Synthetic Test Data Helpers
// ============================================================================

function createMockPhotoAnalysis(id: string): PhotoAnalysis {
  return {
    schemaVersion: "1.0.0",
    photoId: id,
    orientation: "LANDSCAPE",
    visualDescription: `Scenic landscape photograph ${id}.`,
    scene: {
      category: "TRAVEL",
      description: `Travel scene for ${id}`,
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
      { clue: "Alpine wilderness vista", type: "ENVIRONMENT", confidence: 0.85 },
    ],
    occasionClues: [
      { occasion: "TRAVEL", evidence: "Mountain trail panorama", confidence: 0.9 },
    ],
    tags: ["mountains", "nature", "travel", "scenic"],
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

function createMockEditorialPlan(bookId: string, photoIds: string[]): EditorialPlan {
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
    text: `Capturing scene ${pid}`,
    style: "EDITORIAL" as const,
    confidence: 0.9,
  }));

  return {
    schemaVersion: "1.0.0",
    bookId,
    title: "Alpine Memories",
    subtitle: "A Visual Journey",
    narrativeSummary: "Chronological exploration of majestic alpine vistas.",
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
    editorialNotes: ["Visual rhythm established."],
    confidence: {
      overall: 0.94,
      narrative: 0.95,
      grouping: 0.92,
      pacing: 0.93,
      captions: 0.9,
    },
  };
}

function createMockDesign(bookId: string, photoIds: string[]): BookDesign {
  const sizeConfig = BOOK_SIZES.A4;
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

  const pages: BookDesign["pages"] = [
    {
      id: "page_1",
      pageNumber: 1,
      layoutType: "HERO",
      elements: [
        {
          id: "el_p1_img",
          type: "image",
          assetId: photoIds[0],
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
          text: "Alpine Solitude",
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
    },
    {
      id: "page_2",
      pageNumber: 2,
      layoutType: "PHOTO_TEXT",
      elements: [
        {
          id: "el_p2_img",
          type: "image",
          assetId: photoIds[1] || photoIds[0],
          xMm: safeBounds.minX,
          yMm: safeBounds.minY,
          widthMm: safeBounds.width,
          heightMm: Math.round(safeBounds.height * 0.75),
          fit: "COVER",
          focalPoint: { x: 0.5, y: 0.5 },
        },
      ],
    },
  ];

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    document: {
      schemaVersion: DESIGN_SCHEMA_VERSION,
      size: "A4",
      widthMm,
      heightMm,
      bleedMm,
      safeAreaMm,
      gutterMm: printConfig.gutterMm,
      dpi: printConfig.dpi,
      orientation: sizeConfig.orientation,
    },
    pages,
    spreads: [],
  };
}

function makeJob(status: JobStatus, currentStep?: BookGenerationStep): BookJob {
  return {
    id: `job_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    bookId: "book_test_1",
    userId: "user_test_1",
    type: "BOOK_GENERATION",
    status,
    currentStep,
    progress: 0,
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// Test Suite Execution
// ============================================================================

async function runAllStateMachineTests() {
  console.log("================================================================================");
  console.log(" PART 9A: EXACT JOB STATE MACHINE EXHAUSTIVE TEST SUITE");
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, msg: string) {
    totalTests++;
    if (!condition) {
      console.error(`❌ ASSERTION FAILED: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // --------------------------------------------------------------------------
  // Test 1: Section 4 - Valid Job Transitions
  // --------------------------------------------------------------------------
  console.log("[Test 1] Valid Job Transitions (Section 4 & 36)...");
  {
    // QUEUED -> RUNNING
    assert(canTransitionJob("QUEUED", "RUNNING") === true, "QUEUED -> RUNNING must be valid");
    // RUNNING -> SUCCEEDED
    assert(canTransitionJob("RUNNING", "SUCCEEDED") === true, "RUNNING -> SUCCEEDED must be valid");
    // RUNNING -> FAILED
    assert(canTransitionJob("RUNNING", "FAILED") === true, "RUNNING -> FAILED must be valid");
    // RUNNING -> CANCELLED
    assert(canTransitionJob("RUNNING", "CANCELLED") === true, "RUNNING -> CANCELLED must be valid");
    // QUEUED -> CANCELLED (Section 36)
    assert(canTransitionJob("QUEUED", "CANCELLED") === true, "QUEUED -> CANCELLED must be valid");

    const queuedJob = makeJob("QUEUED");
    const runningJob = transitionJob(queuedJob, "RUNNING");
    assert(runningJob.status === "RUNNING", "Job status should transition to RUNNING");
    assert(Boolean(runningJob.startedAt), "startedAt should be set on transition to RUNNING");

    const succeededJob = transitionJob(runningJob, "SUCCEEDED");
    assert(succeededJob.status === "SUCCEEDED", "Job status should transition to SUCCEEDED");
    assert(Boolean(succeededJob.completedAt), "completedAt should be set on transition to SUCCEEDED");

    console.log("✓ All 5 valid job transitions verified.\n");
    passedTests++;
  }

  // --------------------------------------------------------------------------
  // Test 2: Section 5 - Invalid Job Transitions Strictly Rejected
  // --------------------------------------------------------------------------
  console.log("[Test 2] Invalid Job Transitions Rejection (Section 5)...");
  {
    const invalidPairs: Array<[JobStatus, JobStatus]> = [
      ["SUCCEEDED", "RUNNING"],
      ["SUCCEEDED", "FAILED"],
      ["SUCCEEDED", "CANCELLED"],
      ["FAILED", "RUNNING"],
      ["FAILED", "SUCCEEDED"],
      ["FAILED", "CANCELLED"],
      ["CANCELLED", "RUNNING"],
      ["CANCELLED", "SUCCEEDED"],
      ["CANCELLED", "FAILED"],
      ["QUEUED", "SUCCEEDED"],
      ["QUEUED", "FAILED"],
      ["QUEUED", "QUEUED"],
      ["RUNNING", "RUNNING"],
    ];

    for (const [from, to] of invalidPairs) {
      assert(canTransitionJob(from, to) === false, `${from} -> ${to} must be invalid`);
      const testJob = makeJob(from);
      let threw = false;
      try {
        transitionJob(testJob, to);
      } catch (err) {
        if (err instanceof InvalidJobTransitionError) {
          threw = true;
        }
      }
      assert(threw, `transitionJob(${from} -> ${to}) must throw InvalidJobTransitionError`);
    }

    console.log(`✓ All ${invalidPairs.length} invalid transitions strictly rejected with InvalidJobTransitionError.\n`);
    passedTests++;
  }

  // --------------------------------------------------------------------------
  // Test 3: Section 9 & 79 - Terminal State Immutability
  // --------------------------------------------------------------------------
  console.log("[Test 3] Terminal State Immutability (Section 9 & 79)...");
  {
    const repo = new InMemoryJobRepository();

    const terminalStatuses: JobStatus[] = ["SUCCEEDED", "FAILED", "CANCELLED"];
    for (const term of terminalStatuses) {
      assert(isTerminalStatus(term) === true, `${term} must be recognized as terminal`);

      const termJob: BookJob = {
        ...makeJob(term),
        completedAt: new Date().toISOString(),
      };
      await repo.createJob(termJob);

      // Attempt status modification
      for (const target of JOB_STATUSES) {
        let threw = false;
        try {
          await repo.updateJob(termJob.id, { status: target });
        } catch (err) {
          if (err instanceof InvalidJobTransitionError) {
            threw = true;
          }
        }
        assert(threw, `Mutating terminal status ${term} to ${target} must be rejected`);
      }

      // Attempt progress modification on terminal job
      let threwProgress = false;
      try {
        await repo.updateJob(termJob.id, { progress: 50 });
      } catch (err) {
        if (err instanceof InvalidJobTransitionError) {
          threwProgress = true;
        }
      }
      assert(threwProgress, `Modifying fields on terminal job ${term} must be rejected`);
    }

    console.log("✓ Terminal immutability verified across SUCCEEDED, FAILED, and CANCELLED.\n");
    passedTests++;
  }

  // --------------------------------------------------------------------------
  // Test 4: Section 12, 14, 71 - Linear Forward-Only Step Advancement
  // --------------------------------------------------------------------------
  console.log("[Test 4] Forward-Only Step Advancement (Section 12, 14, 71)...");
  {
    // Valid linear flow: PHOTOS -> VISION -> EDITORIAL -> DESIGN -> FINALIZING
    assert(canAdvanceStep("QUEUED", "PHOTOS") === true, "QUEUED -> PHOTOS must be valid");
    assert(canAdvanceStep("PHOTOS", "VISION") === true, "PHOTOS -> VISION must be valid");
    assert(canAdvanceStep("VISION", "EDITORIAL") === true, "VISION -> EDITORIAL must be valid");
    assert(canAdvanceStep("EDITORIAL", "DESIGN") === true, "EDITORIAL -> DESIGN must be valid");
    assert(canAdvanceStep("DESIGN", "FINALIZING") === true, "DESIGN -> FINALIZING must be valid");

    // Invalid step skips
    assert(canAdvanceStep("PHOTOS", "EDITORIAL") === false, "PHOTOS -> EDITORIAL (skip VISION) must be rejected");
    assert(canAdvanceStep("PHOTOS", "DESIGN") === false, "PHOTOS -> DESIGN (skip 2) must be rejected");
    assert(canAdvanceStep("VISION", "FINALIZING") === false, "VISION -> FINALIZING (skip 2) must be rejected");

    // Invalid backwards steps
    assert(canAdvanceStep("EDITORIAL", "PHOTOS") === false, "EDITORIAL -> PHOTOS (backward) must be rejected");
    assert(canAdvanceStep("DESIGN", "VISION") === false, "DESIGN -> VISION (backward) must be rejected");
    assert(canAdvanceStep("FINALIZING", "DESIGN") === false, "FINALIZING -> DESIGN (backward) must be rejected");

    let activeJob = makeJob("RUNNING");
    activeJob = advanceBookGenerationStep(activeJob, "PHOTOS");
    assert(activeJob.currentStep === "PHOTOS", "Step should be PHOTOS");
    assert(activeJob.progress === 20, "Progress at PHOTOS should be 20%");

    activeJob = advanceBookGenerationStep(activeJob, "VISION");
    assert(activeJob.currentStep === "VISION", "Step should be VISION");
    assert(activeJob.progress === 45, "Progress at VISION should be 45%");

    activeJob = advanceBookGenerationStep(activeJob, "EDITORIAL");
    assert(activeJob.currentStep === "EDITORIAL", "Step should be EDITORIAL");
    assert(activeJob.progress === 65, "Progress at EDITORIAL should be 65%");

    activeJob = advanceBookGenerationStep(activeJob, "DESIGN");
    assert(activeJob.currentStep === "DESIGN", "Step should be DESIGN");
    assert(activeJob.progress === 85, "Progress at DESIGN should be 85%");

    activeJob = advanceBookGenerationStep(activeJob, "FINALIZING");
    assert(activeJob.currentStep === "FINALIZING", "Step should be FINALIZING");
    assert(activeJob.progress === 95, "Progress at FINALIZING should be 95%");

    // Verify calling advance on a non-running job throws
    const queuedJob = makeJob("QUEUED");
    let threwNonRunning = false;
    try {
      advanceBookGenerationStep(queuedJob, "PHOTOS");
    } catch (err) {
      if (err instanceof InvalidJobTransitionError) threwNonRunning = true;
    }
    assert(threwNonRunning, "Advancing step on non-running job must throw");

    console.log("✓ Forward-only step advancement and milestone progress (20 -> 45 -> 65 -> 85 -> 95) verified.\n");
    passedTests++;
  }

  // --------------------------------------------------------------------------
  // Test 5: Section 56 - Book Status UX Mapping
  // --------------------------------------------------------------------------
  console.log("[Test 5] Book Status Product UX Mapping (Section 56)...");
  {
    assert(getBookStatusForJobStep("QUEUED", "DRAFT") === "DRAFT", "QUEUED -> DRAFT");
    assert(getBookStatusForJobStep("PHOTOS") === "PROCESSING_PHOTOS", "PHOTOS -> PROCESSING_PHOTOS");
    assert(getBookStatusForJobStep("VISION") === "ANALYZING_PHOTOS", "VISION -> ANALYZING_PHOTOS");
    assert(getBookStatusForJobStep("EDITORIAL") === "CREATING_STORY", "EDITORIAL -> CREATING_STORY");
    assert(getBookStatusForJobStep("DESIGN") === "DESIGNING", "DESIGN -> DESIGNING");
    assert(getBookStatusForJobStep("FINALIZING") === "DESIGNING", "FINALIZING -> DESIGNING");
    assert(getBookStatusForJobStep("SUCCEEDED") === "PREVIEW_READY", "SUCCEEDED -> PREVIEW_READY");
    assert(getBookStatusForJobStep("FAILED") === "FAILED", "FAILED -> FAILED");

    console.log("✓ Exact Book Status UX mapping verified.\n");
    passedTests++;
  }

  // --------------------------------------------------------------------------
  // Setup Global Offline Mocks for End-to-End Orchestrator Tests
  // --------------------------------------------------------------------------
  const mockStorage = new InMemoryStorageProvider();
  setStorageProvider(mockStorage);

  const mockAnalysisRepo = new InMemoryPhotoAnalysisRepository();
  setAnalysisRepository(mockAnalysisRepo);

  const mockEditorialRepo = new InMemoryEditorialPlanRepository();
  setEditorialRepository(mockEditorialRepo);

  const mockDesignRepo = new InMemoryDesignRepository();
  setDesignRepository(mockDesignRepo);

  const mockBookRepo = new InMemoryBookRepository();
  setBookRepository(mockBookRepo);

  const mockJobRepo = new InMemoryJobRepository();
  setJobRepository(mockJobRepo);

  const mockExportRepo = new InMemoryExportRepository();
  setExportRepository(mockExportRepo);

  // Setup deterministic AIGateway mock
  let shouldFailDesign = false;

  const mockGatewayFetch: typeof fetch = async (url, init) => {
    const bodyStr = init?.body?.toString() || "{}";

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

    if (isDesign) {
      if (shouldFailDesign) {
        return new Response(
          JSON.stringify({ error: { message: "Simulated Design AI timeout.", code: 504 } }),
          { status: 504, headers: { "Content-Type": "application/json" } },
        );
      }
      const design = createMockDesign("book_test", photoIds);
      const result: DesignGenerationResult = {
        schemaVersion: "1.0.0",
        design,
        rationale: { overall: "Clean alpine editorial layout." },
      };
      return new Response(
        JSON.stringify({
          id: "gen_des",
          model: "openrouter/free",
          choices: [{ message: { content: JSON.stringify(result) }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1500, completion_tokens: 800, total_tokens: 2300 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (isEditorial) {
      const plan = createMockEditorialPlan("book_test", photoIds);
      return new Response(
        JSON.stringify({
          id: "gen_edit",
          model: "openrouter/free",
          choices: [{ message: { content: JSON.stringify(plan) }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1200, completion_tokens: 600, total_tokens: 1800 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (isVision) {
      const idMatch = bodyStr.match(/Photo ID:\s*([^\s\\"\n]+)/i);
      const currentPid = idMatch ? idMatch[1] : photoIds[0];
      const analysis = createMockPhotoAnalysis(currentPid);
      return new Response(
        JSON.stringify({
          id: "gen_vis",
          model: "openrouter/free",
          choices: [{ message: { content: JSON.stringify(analysis) }, finish_reason: "stop" }],
          usage: { prompt_tokens: 350, completion_tokens: 200, total_tokens: 550 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: { message: "Unhandled mock call" } }), { status: 400 });
  };

  const gateway = new AIGateway({ fetchFn: mockGatewayFetch });
  setGlobalAIGateway(gateway);

  // Seed storage with mock photos
  const photoIds = ["photo_alpha", "photo_beta"];
  const dummyBuffer = Buffer.from("dummy-photo-content");
  const testBookIds = [
    "book_e2e_1",
    "book_fail_test",
    "book_cancel_test",
    "book_dup_test",
    "book_export_fail_test",
  ];
  for (const bId of testBookIds) {
    for (const pid of photoIds) {
      await mockStorage.uploadFile(
        PHOTO_STORAGE_BUCKETS.DERIVATIVES,
        getAIDerivativePath("user_e2e_1", bId, pid),
        dummyBuffer,
        "image/jpeg",
      );
    }
  }
  for (const pid of photoIds) {
    const analysis = createMockPhotoAnalysis(pid);
    await mockAnalysisRepo.saveAnalysis({
      id: `analysis_${pid}`,
      photoId: pid,
      bookId: "book_e2e_1",
      userId: "user_e2e_1",
      schemaVersion: "1.0.0",
      analysisJson: analysis,
      provider: "openrouter",
      model: "mock-vision",
      promptVersion: "1.0.0",
      inputHash: `hash_${pid}`,
      outputSchemaVersion: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // --------------------------------------------------------------------------
  // Test 6: Section 74 - Full Workflow Test
  // --------------------------------------------------------------------------
  console.log("[Test 6] Full Generation Workflow Execution (Section 74)...");
  {
    const book: BookRecord = {
      id: "book_e2e_1",
      userId: "user_e2e_1",
      title: "Alpine Adventure",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      size: "A4",
      status: "DRAFT",
      photoIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await mockBookRepo.createBook(book);

    const job = await createBookGenerationJob(book.id, book.userId, mockBookRepo, mockJobRepo);
    assert(job.status === "QUEUED", "Newly created job must be in QUEUED status");
    assert(job.attempts === 0, "Initial attempts must be 0");
    assert(job.maxAttempts === 3, "Default maxAttempts must be 3");

    const completedJob = await runBookGeneration(job.id, mockBookRepo, mockJobRepo);
    assert(completedJob.status === "SUCCEEDED", "Completed job must be SUCCEEDED");
    assert(completedJob.progress === 100, "Final progress must be 100%");
    assert(completedJob.attempts === 1, "Completed in exactly 1 attempt");

    const updatedBook = await mockBookRepo.getBookById(book.id);
    assert(updatedBook?.status === "PREVIEW_READY", "Final book status must be PREVIEW_READY");

    console.log("✓ Full workflow executed through all steps to SUCCEEDED and PREVIEW_READY.\n");
    passedTests++;
  }

  // --------------------------------------------------------------------------
  // Test 7: Section 75 - Stage Failure Isolation
  // --------------------------------------------------------------------------
  console.log("[Test 7] Stage Failure Isolation (Section 75)...");
  {
    const failBook: BookRecord = {
      id: "book_fail_test",
      userId: "user_e2e_1",
      title: "Failure Isolation Test",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      size: "A4",
      status: "DRAFT",
      photoIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await mockBookRepo.createBook(failBook);

    // Trigger failure at Design stage
    shouldFailDesign = true;

    const failJob = await createBookGenerationJob(failBook.id, failBook.userId, mockBookRepo, mockJobRepo);
    await mockJobRepo.updateJob(failJob.id, { maxAttempts: 1 });
    const resultJob = await runBookGeneration(failJob.id, mockBookRepo, mockJobRepo);

    assert(resultJob.status === "FAILED", "Failed job must be in FAILED status");
    assert(resultJob.error !== undefined, "Job must have structured error recorded");
    assert(resultJob.error?.stage === "DESIGN", "Error stage must record DESIGN");

    const failBookRecord = await mockBookRepo.getBookById(failBook.id);
    assert(failBookRecord?.status === "FAILED", "Book status must be FAILED on generation failure");

    // Prior artifacts must remain intact
    const editorialPlan = await mockEditorialRepo.getPlanByBookId(failBook.id);
    assert(editorialPlan !== null, "Editorial Plan artifact must remain intact after Design failure");
    const photoAnalyses = await Promise.all(photoIds.map((id) => mockAnalysisRepo.getAnalysisByPhotoId(id)));
    assert(photoAnalyses.every(Boolean), "PhotoAnalysis records must remain intact");

    console.log("✓ Failure at DESIGN stage isolated; prior PhotoAnalysis and EditorialPlan intact.\n");
    passedTests++;
  }

  // --------------------------------------------------------------------------
  // Test 8: Section 77 & 60-65 - Smart Resume (Earliest Invalid Stage)
  // --------------------------------------------------------------------------
  console.log("[Test 8] Smart Resume & Earliest Invalid Stage Detection (Section 77 & 60-65)...");
  {
    // For book_fail_test: Photos exist, Vision exists, Editorial exists, Design is missing
    const earliestStage = await determineEarliestInvalidStage(
      "book_fail_test",
      "user_e2e_1",
      photoIds,
    );
    assert(earliestStage === "DESIGN", "Earliest invalid stage should be DESIGN");

    // Restore working gateway
    shouldFailDesign = false;

    // Call retryBookGeneration
    const retryJob = await retryBookGeneration(
      "book_fail_test",
      "user_e2e_1",
      mockBookRepo,
      mockJobRepo,
    );
    assert(retryJob.status === "SUCCEEDED", "Retry job must complete with SUCCEEDED");

    const recoveredBook = await mockBookRepo.getBookById("book_fail_test");
    assert(recoveredBook?.status === "PREVIEW_READY", "Recovered book status must be PREVIEW_READY");

    console.log("✓ Smart resume accurately identified DESIGN stage and recovered successfully.\n");
    passedTests++;
  }

  // --------------------------------------------------------------------------
  // Test 9: Section 78 - Cooperative Cancellation
  // --------------------------------------------------------------------------
  console.log("[Test 9] Cooperative Cancellation (Section 78)...");
  {
    const cancelBook: BookRecord = {
      id: "book_cancel_test",
      userId: "user_e2e_1",
      title: "Cancellation Test",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      size: "A4",
      status: "DRAFT",
      photoIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await mockBookRepo.createBook(cancelBook);

    const job = await createBookGenerationJob(cancelBook.id, cancelBook.userId, mockBookRepo, mockJobRepo);
    assert(job.status === "QUEUED", "Job must be QUEUED");

    // Cancel while QUEUED
    const cancelledJob = await cancelBookGeneration(job.id, cancelBook.userId, mockBookRepo, mockJobRepo);
    assert(cancelledJob.status === "CANCELLED", "Job must be CANCELLED");

    const cancelledBook = await mockBookRepo.getBookById(cancelBook.id);
    assert(cancelledBook?.status === "CANCELLED", "Book status must be CANCELLED");

    // If worker attempts to run a cancelled job, it must throw and not proceed
    let threw = false;
    try {
      await runBookGeneration(job.id, mockBookRepo, mockJobRepo);
    } catch {
      threw = true;
    }
    // Storage will reject modifying a terminal CANCELLED job
    assert(threw, "Worker must not run an already CANCELLED job");

    console.log("✓ Cancellation verified at safe boundaries without corrupting state.\n");
    passedTests++;
  }

  // --------------------------------------------------------------------------
  // Test 10: Section 80 & 81 - Duplicate Active Job Protection
  // --------------------------------------------------------------------------
  console.log("[Test 10] Duplicate Active Job Protection (Section 80 & 81)...");
  {
    const dupBook: BookRecord = {
      id: "book_dup_test",
      userId: "user_e2e_1",
      title: "Duplicate Job Test",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      size: "A4",
      status: "DRAFT",
      photoIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await mockBookRepo.createBook(dupBook);

    // Call 1
    const jobA = await createBookGenerationJob(dupBook.id, dupBook.userId, mockBookRepo, mockJobRepo);
    // Call 2
    const jobB = await createBookGenerationJob(dupBook.id, dupBook.userId, mockBookRepo, mockJobRepo);

    assert(jobA.id === jobB.id, "Concurrent generation requests must return the exact same active job ID");

    // Now test PDF export duplicate protection (Section 81)
    await mockBookRepo.updateBookStatus(dupBook.id, "PREVIEW_READY");
    const mockDesign = createMockDesign(dupBook.id, photoIds);
    await mockDesignRepo.saveDesign({
      id: `design_${dupBook.id}`,
      bookId: dupBook.id,
      userId: dupBook.userId,
      schemaVersion: "1.0.0",
      designJson: mockDesign,
      provider: "openrouter",
      model: "mock-design",
      promptVersion: "1.0.0",
      inputHash: "hash_design",
      outputSchemaVersion: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const exportJobA = await createPdfExportJob(dupBook.id, dupBook.userId, mockBookRepo, mockJobRepo);
    const exportJobB = await createPdfExportJob(dupBook.id, dupBook.userId, mockBookRepo, mockJobRepo);

    assert(exportJobA.id === exportJobB.id, "Concurrent PDF export requests with same designHash must return same active job ID");

    console.log("✓ Active job uniqueness confirmed for BOOK_GENERATION and PDF_EXPORT.\n");
    passedTests++;
  }

  // --------------------------------------------------------------------------
  // Test 11: Section 57 & 58 - PDF Export Failure Mapping (Never sets book to FAILED)
  // --------------------------------------------------------------------------
  console.log("[Test 11] PDF Export Failure Mapping (Section 57 & 58)...");
  {
    const exportBook: BookRecord = {
      id: "book_export_fail_test",
      userId: "user_e2e_1",
      title: "Export Failure Test",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      size: "A4",
      status: "EDITING",
      photoIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await mockBookRepo.createBook(exportBook);

    // Save design
    const design = createMockDesign(exportBook.id, photoIds);
    await mockDesignRepo.saveDesign({
      id: `design_${exportBook.id}`,
      bookId: exportBook.id,
      userId: exportBook.userId,
      schemaVersion: "1.0.0",
      designJson: design,
      provider: "openrouter",
      model: "mock-design",
      promptVersion: "1.0.0",
      inputHash: "hash_design",
      outputSchemaVersion: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create export job
    const exportJob = await createPdfExportJob(exportBook.id, exportBook.userId, mockBookRepo, mockJobRepo);
    assert(exportJob.status === "QUEUED", "Export job should start in QUEUED");

    // Simulate export failure with broken export repo
    const failingExportRepo = {
      createExport: async () => {
        throw new Error("Simulated storage failure during PDF export.");
      },
      getExportById: async () => null,
      getLatestExportByBookId: async () => null,
      getExportByDesignHash: async () => null,
      updateExport: async () => {
        throw new Error("Cannot update");
      },
    };

    const { job: finishedJob } = await runPdfExportJob(
      exportJob.id,
      mockBookRepo,
      mockJobRepo,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      failingExportRepo as any,
    );

    assert(finishedJob.status === "FAILED", "PDF export job must be FAILED");

    // CRITICAL (Section 57 & 58): Book status must return to EDITING, NOT FAILED!
    const bookAfterFailedExport = await mockBookRepo.getBookById(exportBook.id);
    assert(
      bookAfterFailedExport?.status === "EDITING",
      `Book status must return to EDITING on export failure, but was ${bookAfterFailedExport?.status}`,
    );

    console.log("✓ PDF export failure returns book to EDITING; book is never set permanently to FAILED.\n");
    passedTests++;
  }

  console.log("================================================================================");
  console.log(` ✓ ALL ${passedTests} / 11 PART 9A STATE MACHINE TESTS PASSED SUCCESSFULLY!`);
  console.log("================================================================================\n");
}

runAllStateMachineTests().catch((err) => {
  console.error("\n❌ STATE MACHINE TEST SUITE FAILED:", err);
  process.exit(1);
});
