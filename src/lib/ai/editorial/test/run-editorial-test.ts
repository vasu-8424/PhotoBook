import { AIGateway } from "@/lib/ai/gateway";
import { AIGatewayError } from "@/lib/ai/errors";
import {
  generateEditorialPlan,
  validateEditorialPlanIntegrity,
  validateEditorialPlanSchema,
  EditorialPlanCache,
  InMemoryEditorialPlanRepository,
} from "../index";
import type {
  EditorialInput,
  EditorialPlan,
} from "../types";
import type { PhotoAnalysis } from "../../vision/types";
import type { OpenRouterRequestPayload } from "@/lib/ai/types";

// Helper to create synthetic PhotoAnalysis test objects with varied characteristics
function createMockPhotoAnalysis(
  id: string,
  overrides?: Partial<PhotoAnalysis>,
): PhotoAnalysis {
  return {
    schemaVersion: "1.0.0",
    photoId: id,
    orientation: "LANDSCAPE",
    visualDescription: `Photograph ${id} showing visual scenery and subjects.`,
    scene: {
      category: "TRAVEL",
      description: "Arrival at mountain vista",
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
      dominant: ["#2B4C6F", "#D8E2DC"],
      mood: "COOL",
    },
    textDetected: false,
    locationClues: [
      {
        clue: "Alpine landmark visible in background",
        type: "LANDMARK",
        confidence: 0.8,
      },
    ],
    occasionClues: [
      {
        occasion: "TRAVEL",
        evidence: "Travel bags and viewpoint railing",
        confidence: 0.85,
      },
    ],
    tags: ["travel", "mountains", "scenic", "adventure"],
    confidence: {
      overall: 0.9,
      scene: 0.9,
      subjects: 0.9,
      composition: 0.85,
      location: 0.8,
      occasion: 0.85,
    },
    ...overrides,
  };
}

function generateMockPhotoCollection(
  count: number,
  prefix: string = "photo",
): PhotoAnalysis[] {
  const categories: PhotoAnalysis["scene"]["category"][] = [
    "TRAVEL",
    "NATURE",
    "CITY",
    "FOOD",
    "PORTRAIT",
  ];
  const orientations: PhotoAnalysis["orientation"][] = [
    "LANDSCAPE",
    "PORTRAIT",
    "SQUARE",
  ];

  return Array.from({ length: count }, (_, i) => {
    const padded = String(i + 1).padStart(2, "0");
    const photoId = `${prefix}_${padded}`;
    return createMockPhotoAnalysis(photoId, {
      orientation: orientations[i % orientations.length],
      scene: {
        category: categories[i % categories.length],
        description: `Scene ${i + 1} with thematic elements`,
        timeOfDay: i % 2 === 0 ? "AFTERNOON" : "EVENING",
      },
      visualDescription: `Visual description for ${photoId} depicting moment ${i + 1}.`,
    });
  });
}

function createValidEditorialPlan(
  bookId: string,
  photos: PhotoAnalysis[],
  overrides?: Partial<EditorialPlan>,
): EditorialPlan {
  const photoIds = photos.map((p) => p.photoId);
  const mid = Math.ceil(photoIds.length / 2);

  const ch1Photos = photoIds.slice(0, mid);
  const ch2Photos = photoIds.slice(mid);

  const chapters = [
    {
      id: "chapter_01",
      title: "Arrival & First Light",
      summary: "Beginning the journey through initial landscapes and moments.",
      photoIds: ch1Photos,
      order: 1,
      mood: "Atmospheric",
      transitionIn: "Opening scenes",
      transitionOut: "Moving towards discovery",
    },
  ];

  if (ch2Photos.length > 0) {
    chapters.push({
      id: "chapter_02",
      title: "Shared Discoveries",
      summary: "Exploration, deeper details, and quiet reflection.",
      photoIds: ch2Photos,
      order: 2,
      mood: "Warm",
      transitionIn: "Deeper exploration",
      transitionOut: "Final memories",
    });
  }

  const photoSequence = photoIds.map((pid, idx) => ({
    photoId: pid,
    sequence: idx + 1,
    chapterId: idx < mid ? "chapter_01" : "chapter_02",
    role:
      idx === 0
        ? ("OPENING" as const)
        : idx === photoIds.length - 1
          ? ("CLOSING" as const)
          : ("MOMENT" as const),
    importance: 0.85,
    transitionReason: "Paced for visual continuity",
  }));

  const captions = photoIds.slice(0, Math.min(5, photoIds.length)).map((pid) => ({
    photoId: pid,
    text: `Scenic moment captured in natural light at ${pid}.`,
    style: "EDITORIAL" as const,
    confidence: 0.9,
  }));

  return {
    schemaVersion: "1.0.0",
    bookId,
    title: "Mountain Horizons",
    subtitle: "A Journey Through Alpine Valleys",
    narrativeSummary:
      "A scenic visual progression beginning with crisp arrival vistas, advancing through intimate discoveries, and concluding at twilight.",
    chapters,
    photoSequence,
    coverCandidateIds: [photoIds[0], photoIds[Math.min(1, photoIds.length - 1)]],
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
    titleCandidates: [
      "Mountain Horizons",
      "Alpine Light & Valleys",
      "Wanderings in the High Peaks",
    ],
    ...overrides,
  };
}

export async function runEditorialTests(): Promise<void> {
  console.log("=== RUNNING PART 6 EDITORIAL AI TESTS ===");

  // --------------------------------------------------------------------------
  // Test 1: 10-Photo Travel Editorial Plan Generation & Zod Schema Validation
  // --------------------------------------------------------------------------
  console.log("\n[Test 1] 10-Photo Travel Editorial Plan generation & validation...");
  const travelPhotos10 = generateMockPhotoCollection(10, "travel_10");
  const validPlan10 = createValidEditorialPlan("bk_travel_10", travelPhotos10);

  const directSchemaCheck = validateEditorialPlanSchema(validPlan10);
  if (!directSchemaCheck.valid) {
    throw new Error(`Direct schema check failed: ${directSchemaCheck.error}`);
  }

  const mockSuccessFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "gen_edit_01",
        model: "google/gemma-4-26b-a4b-it:free",
        choices: [
          {
            message: {
              content: JSON.stringify(validPlan10),
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 1200,
          completion_tokens: 650,
          total_tokens: 1850,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const testGateway = new AIGateway({ fetchFn: mockSuccessFetch });
  const testRepo = new InMemoryEditorialPlanRepository();
  const testCache = new EditorialPlanCache();

  const planResult = await generateEditorialPlan(
    {
      bookId: "bk_travel_10",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      photos: travelPhotos10,
    },
    {
      gateway: testGateway,
      repository: testRepo,
      cache: testCache,
      userId: "usr_alice",
    },
  );

  if (planResult.schemaVersion !== "1.0.0") {
    throw new Error(`Invalid schemaVersion: ${planResult.schemaVersion}`);
  }
  if (!planResult.title || planResult.title.length === 0) {
    throw new Error("Missing editorial title");
  }
  if (planResult.chapters.length < 2) {
    throw new Error("Expected at least 2 chapters for 10 travel photos");
  }
  if (planResult.photoSequence.length !== 10) {
    throw new Error(`Expected 10 sequenced photos, got ${planResult.photoSequence.length}`);
  }
  if (!planResult.coverCandidateIds || planResult.coverCandidateIds.length < 2) {
    throw new Error("Expected at least 2 cover candidates");
  }

  const savedRecord = await testRepo.getPlanByBookId("bk_travel_10");
  if (!savedRecord || savedRecord.planJson.bookId !== "bk_travel_10") {
    throw new Error("Plan failed to persist in repository");
  }

  console.log("✓ 10-Photo Travel Editorial Plan validated and persisted.");

  // --------------------------------------------------------------------------
  // Test 2: 20-Photo Personal Memories Editorial Plan
  // --------------------------------------------------------------------------
  console.log("\n[Test 2] 20-Photo Personal Memories Editorial Plan...");
  const memoriesPhotos20 = generateMockPhotoCollection(20, "memories_20");
  const memoriesPlan20 = createValidEditorialPlan("bk_mem_20", memoriesPhotos20, {
    title: "Quiet Days, Shared Times",
    narrativeSummary: "An intimate family narrative progressing through daily gatherings and evening reflections.",
  });

  const mockMemoriesFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "gen_edit_mem",
        model: "google/gemma-4-26b-a4b-it:free",
        choices: [
          {
            message: { content: JSON.stringify(memoriesPlan20) },
            finish_reason: "stop",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const memGateway = new AIGateway({ fetchFn: mockMemoriesFetch });
  const memResult = await generateEditorialPlan(
    {
      bookId: "bk_mem_20",
      occasion: "PERSONAL_MEMORIES",
      style: "JOURNAL",
      photos: memoriesPhotos20,
    },
    {
      gateway: memGateway,
      repository: new InMemoryEditorialPlanRepository(),
      cache: new EditorialPlanCache(),
    },
  );

  if (memResult.photoSequence.length !== 20) {
    throw new Error(`Expected 20 sequenced photos, got ${memResult.photoSequence.length}`);
  }
  console.log("✓ 20-Photo Personal Memories plan validated.");

  // --------------------------------------------------------------------------
  // Test 3: Photo ID Integrity Rejection (Hallucinated ID photo_fake_999)
  // --------------------------------------------------------------------------
  console.log("\n[Test 3] Photo ID integrity check: Reject hallucinated photo IDs...");
  const fakeIdPlan = createValidEditorialPlan("bk_fake_id", travelPhotos10);
  // Inject hallucinated photoId in sequence
  fakeIdPlan.photoSequence[0].photoId = "photo_fake_999";

  const mockFakeIdFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "gen_fake",
        model: "google/gemma-4-26b-a4b-it:free",
        choices: [{ message: { content: JSON.stringify(fakeIdPlan) } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const fakeIdGateway = new AIGateway({ fetchFn: mockFakeIdFetch });
  const fakeIdRepo = new InMemoryEditorialPlanRepository();
  let fakeIdErrorCaught = false;

  try {
    await generateEditorialPlan(
      {
        bookId: "bk_fake_id",
        occasion: "TRAVEL",
        style: "EDITORIAL",
        photos: travelPhotos10,
      },
      {
        gateway: fakeIdGateway,
        repository: fakeIdRepo,
        cache: new EditorialPlanCache(),
      },
    );
  } catch (err) {
    fakeIdErrorCaught = true;
    if (err instanceof AIGatewayError) {
      if (err.code !== "EDITORIAL_INTEGRITY_ERROR") {
        throw new Error(`Expected EDITORIAL_INTEGRITY_ERROR, got ${err.code}`);
      }
    }
  }

  if (!fakeIdErrorCaught) {
    throw new Error("Hallucinated photo ID was unexpectedly accepted");
  }

  const shouldBeNull = await fakeIdRepo.getPlanByBookId("bk_fake_id");
  if (shouldBeNull !== null) {
    throw new Error("Invalid plan with hallucinated ID was incorrectly persisted");
  }

  console.log("✓ Hallucinated photo ID correctly rejected with EDITORIAL_INTEGRITY_ERROR.");

  // --------------------------------------------------------------------------
  // Test 4: Duplicate Sequence Number Rejection
  // --------------------------------------------------------------------------
  console.log("\n[Test 4] Sequence integrity check: Reject duplicate sequence numbers...");
  const duplicateSeqPlan = createValidEditorialPlan("bk_dup_seq", travelPhotos10);
  // Set duplicate sequence: photo 1 and photo 2 both have sequence: 1
  duplicateSeqPlan.photoSequence[1].sequence = 1;

  const mockDupSeqFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "gen_dup_seq",
        model: "google/gemma-4-26b-a4b-it:free",
        choices: [{ message: { content: JSON.stringify(duplicateSeqPlan) } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const dupSeqGateway = new AIGateway({ fetchFn: mockDupSeqFetch });
  let dupSeqCaught = false;

  try {
    await generateEditorialPlan(
      {
        bookId: "bk_dup_seq",
        occasion: "TRAVEL",
        style: "EDITORIAL",
        photos: travelPhotos10,
      },
      {
        gateway: dupSeqGateway,
        repository: new InMemoryEditorialPlanRepository(),
        cache: new EditorialPlanCache(),
      },
    );
  } catch (err) {
    dupSeqCaught = true;
    if (err instanceof AIGatewayError && err.code !== "EDITORIAL_INTEGRITY_ERROR") {
      throw new Error(`Expected EDITORIAL_INTEGRITY_ERROR, got ${err.code}`);
    }
  }

  if (!dupSeqCaught) {
    throw new Error("Duplicate sequence was unexpectedly accepted");
  }
  console.log("✓ Duplicate sequence numbers correctly rejected with EDITORIAL_INTEGRITY_ERROR.");

  // --------------------------------------------------------------------------
  // Test 5: Empty Chapter Rejection
  // --------------------------------------------------------------------------
  console.log("\n[Test 5] Chapter integrity check: Reject empty chapters...");
  const emptyChapterPlan = createValidEditorialPlan("bk_empty_ch", travelPhotos10);
  emptyChapterPlan.chapters.push({
    id: "chapter_empty",
    title: "Empty Chapter",
    summary: "No photos here",
    photoIds: [],
    order: 3,
  });

  const authoritativeIds = new Set(travelPhotos10.map((p) => p.photoId));
  let emptyChapterCaught = false;

  try {
    validateEditorialPlanIntegrity(emptyChapterPlan, authoritativeIds);
  } catch (err) {
    emptyChapterCaught = true;
    if (err instanceof AIGatewayError && err.code !== "EDITORIAL_INTEGRITY_ERROR") {
      throw new Error(`Expected EDITORIAL_INTEGRITY_ERROR, got ${err.code}`);
    }
  }

  if (!emptyChapterCaught) {
    throw new Error("Empty chapter was unexpectedly accepted");
  }
  console.log("✓ Empty chapters correctly rejected.");

  // --------------------------------------------------------------------------
  // Test 6: Caption Association & Validation
  // --------------------------------------------------------------------------
  console.log("\n[Test 6] Caption association & integrity checks...");
  const badCaptionPlan = createValidEditorialPlan("bk_bad_caption", travelPhotos10);
  badCaptionPlan.captions.push({
    photoId: "photo_unknown_999",
    text: "Caption for missing photo",
    style: "EDITORIAL",
    confidence: 0.8,
  });

  let badCaptionCaught = false;
  try {
    validateEditorialPlanIntegrity(badCaptionPlan, authoritativeIds);
  } catch (err) {
    badCaptionCaught = true;
    if (err instanceof AIGatewayError && err.code !== "EDITORIAL_INTEGRITY_ERROR") {
      throw new Error(`Expected EDITORIAL_INTEGRITY_ERROR, got ${err.code}`);
    }
  }

  if (!badCaptionCaught) {
    throw new Error("Caption for unknown photo was unexpectedly accepted");
  }
  console.log("✓ Caption referencing unknown photo rejected.");

  // --------------------------------------------------------------------------
  // Test 7: Regeneration on Style Change
  // --------------------------------------------------------------------------
  console.log("\n[Test 7] Deterministic cache invalidation on style change...");
  const callTracker = { count: 0 };
  const getCallCount = (): number => callTracker.count;

  const mockCountingFetch: typeof fetch = async () => {
    callTracker.count++;
    return new Response(
      JSON.stringify({
        id: `gen_cache_${callTracker.count}`,
        model: "google/gemma-4-26b-a4b-it:free",
        choices: [{ message: { content: JSON.stringify(validPlan10) } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const sharedGateway = new AIGateway({ fetchFn: mockCountingFetch });
  const sharedCache = new EditorialPlanCache();
  const sharedRepo = new InMemoryEditorialPlanRepository();

  const editorialInput: EditorialInput = {
    bookId: "bk_cache_test",
    occasion: "TRAVEL",
    style: "EDITORIAL",
    photos: travelPhotos10,
  };

  // Call 1: EDITORIAL style -> Network call
  await generateEditorialPlan(editorialInput, {
    gateway: sharedGateway,
    cache: sharedCache,
    repository: sharedRepo,
  });
  if (getCallCount() !== 1) {
    throw new Error(`Expected 1 network call, got ${getCallCount()}`);
  }

  // Call 2: Identical request -> Cache HIT (0 additional network calls)
  await generateEditorialPlan(editorialInput, {
    gateway: sharedGateway,
    cache: sharedCache,
    repository: sharedRepo,
  });
  if (getCallCount() !== 1) {
    throw new Error(`Expected cache hit (1 call), got ${getCallCount()}`);
  }

  // Call 3: Changed style to CINEMATIC -> Cache MISS (triggers network call)
  await generateEditorialPlan(
    { ...editorialInput, style: "CINEMATIC" },
    {
      gateway: sharedGateway,
      cache: sharedCache,
      repository: sharedRepo,
    },
  );
  if (getCallCount() !== 2) {
    throw new Error(`Expected style change to trigger fresh call (2 calls), got ${getCallCount()}`);
  }
  console.log("✓ Style change successfully invalidated cache and triggered plan regeneration.");

  // --------------------------------------------------------------------------
  // Test 8: Photo Addition Invalidation
  // --------------------------------------------------------------------------
  console.log("\n[Test 8] Photo addition invalidates cache & updates input...");
  const photos11 = [
    ...travelPhotos10,
    createMockPhotoAnalysis("travel_10_11", { visualDescription: "Newly added vista" }),
  ];

  await generateEditorialPlan(
    { ...editorialInput, photos: photos11 },
    {
      gateway: sharedGateway,
      cache: sharedCache,
      repository: sharedRepo,
    },
  );
  if (getCallCount() !== 3) {
    throw new Error(`Expected photo addition to trigger fresh call (3 calls), got ${getCallCount()}`);
  }
  console.log("✓ Photo addition successfully triggered fresh narrative planning.");

  // --------------------------------------------------------------------------
  // Test 9: Photo Removal Integrity
  // --------------------------------------------------------------------------
  console.log("\n[Test 9] Photo removal guarantees absence from narrative...");
  // Remove photo #5
  const photosWithout5 = travelPhotos10.filter((p) => p.photoId !== "travel_10_05");
  const planWithout5 = createValidEditorialPlan("bk_no_5", photosWithout5);

  const mockRemovalFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "gen_no_5",
        model: "google/gemma-4-26b-a4b-it:free",
        choices: [{ message: { content: JSON.stringify(planWithout5) } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const removalGateway = new AIGateway({ fetchFn: mockRemovalFetch });
  const resultWithout5 = await generateEditorialPlan(
    {
      bookId: "bk_no_5",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      photos: photosWithout5,
    },
    {
      gateway: removalGateway,
      cache: new EditorialPlanCache(),
      repository: new InMemoryEditorialPlanRepository(),
    },
  );

  const foundInSeq = resultWithout5.photoSequence.some((p) => p.photoId === "travel_10_05");
  const foundInCh = resultWithout5.chapters.some((c) => c.photoIds.includes("travel_10_05"));
  const foundInCovers = resultWithout5.coverCandidateIds.includes("travel_10_05");

  if (foundInSeq || foundInCh || foundInCovers) {
    throw new Error("Removed photo was still found in editorial plan");
  }
  console.log("✓ Removed photo completely absent from sequence, chapters, and covers.");

  // --------------------------------------------------------------------------
  // Test 10: OpenRouter Model Fallback Capture
  // --------------------------------------------------------------------------
  console.log("\n[Test 10] OpenRouter model fallback recording...");
  let capturedPayload: OpenRouterRequestPayload | undefined;

  const mockFallbackFetch: typeof fetch = async (url, init) => {
    capturedPayload = JSON.parse(init?.body as string) as OpenRouterRequestPayload;

    // Simulate OpenRouter falling back internally to google/gemma-4-31b-it:free
    return new Response(
      JSON.stringify({
        id: "gen_edit_fallback",
        model: "google/gemma-4-31b-it:free", // Actual model that answered
        choices: [{ message: { content: JSON.stringify(validPlan10) } }],
        usage: { prompt_tokens: 1500, completion_tokens: 700, total_tokens: 2200 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const fbGateway = new AIGateway({ fetchFn: mockFallbackFetch });
  const fbRepo = new InMemoryEditorialPlanRepository();

  await generateEditorialPlan(
    {
      bookId: "bk_fb_edit",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      photos: travelPhotos10,
    },
    {
      gateway: fbGateway,
      repository: fbRepo,
      cache: new EditorialPlanCache(),
    },
  );

  const fbRecord = await fbRepo.getPlanByBookId("bk_fb_edit");
  if (!fbRecord) {
    throw new Error("Fallback editorial record failed to persist");
  }
  console.log("Captured fallback models array:", capturedPayload?.models);
  console.log("Actual model saved in editorial record:", fbRecord.model);

  if (fbRecord.model !== "google/gemma-4-31b-it:free") {
    throw new Error(`Expected actual model google/gemma-4-31b-it:free, got ${fbRecord.model}`);
  }
  console.log("✓ Actual fallback model accurately recorded in database record and context.");

  // --------------------------------------------------------------------------
  // Test 11: 50-Photo Collection Handling
  // --------------------------------------------------------------------------
  console.log("\n[Test 11] 50-Photo large collection handling...");
  const photos50 = generateMockPhotoCollection(50, "big_trip");
  const plan50 = createValidEditorialPlan("bk_50", photos50, {
    title: "The Grand Expedition",
    chapters: [
      {
        id: "ch_1",
        title: "Departure & Horizons",
        summary: "Setting out",
        photoIds: photos50.slice(0, 15).map((p) => p.photoId),
        order: 1,
      },
      {
        id: "ch_2",
        title: "The Heart of the Valley",
        summary: "Midway discoveries",
        photoIds: photos50.slice(15, 35).map((p) => p.photoId),
        order: 2,
      },
      {
        id: "ch_3",
        title: "Dusk & Reflections",
        summary: "Parting moments",
        photoIds: photos50.slice(35).map((p) => p.photoId),
        order: 3,
      },
    ],
  });

  const mock50Fetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "gen_50",
        model: "google/gemma-4-26b-a4b-it:free",
        choices: [{ message: { content: JSON.stringify(plan50) } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const gateway50 = new AIGateway({ fetchFn: mock50Fetch });
  const result50 = await generateEditorialPlan(
    {
      bookId: "bk_50",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      photos: photos50,
    },
    {
      gateway: gateway50,
      cache: new EditorialPlanCache(),
      repository: new InMemoryEditorialPlanRepository(),
    },
  );

  if (result50.photoSequence.length !== 50) {
    throw new Error(`Expected 50 photos in sequence, got ${result50.photoSequence.length}`);
  }
  console.log("✓ 50-Photo collection handled successfully without token overflow.");

  console.log("\n=== ALL PART 6 EDITORIAL AI TESTS PASSED SUCCESSFULLY ===");
}

if (require.main === module) {
  runEditorialTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}
