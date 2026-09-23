import { AIGateway } from "@/lib/ai/gateway";
import { AIGatewayError } from "@/lib/ai/errors";
import {
  DESIGN_SCHEMA_VERSION,
  type BookDesign,
  type BookSize,
  type DesignElement,
  type LayoutType,
} from "@/types/design";
import { BOOK_SIZES, DEFAULT_PRINT_SETTINGS } from "@/config/book";
import { renderDocument, type RenderAsset } from "@/lib/pdf";
import { validateDesign as validatePrintEngineDesign } from "@/lib/pdf/validate-design";
import {
  generateDesign,
  validateDesignIntegrity,
  validateDesignGenerationResultSchema,
  repairDesignGeometry,
  DesignPlanCache,
  InMemoryDesignRepository,
} from "../index";
import type { PhotoAnalysis } from "../../vision/types";
import type { EditorialPlan } from "../../editorial/types";

// ============================================================================
// Synthetic Test Data Helpers
// ============================================================================

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
      focalPoint: { x: 0.35, y: 0.45 },
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
    const isPortrait = orientations[i % orientations.length] === "PORTRAIT";

    return createMockPhotoAnalysis(photoId, {
      orientation: orientations[i % orientations.length],
      scene: {
        category: categories[i % categories.length],
        description: `Scene ${i + 1} with thematic elements`,
        timeOfDay: i % 2 === 0 ? "AFTERNOON" : "EVENING",
      },
      composition: {
        subjectPosition: isPortrait ? "CENTER" : "LEFT",
        balance: "BALANCED",
        negativeSpace: "MEDIUM",
        depth: "DEEP",
        cropSafety: isPortrait ? "MODERATE" : "SAFE",
        focalPoint: isPortrait ? { x: 0.5, y: 0.5 } : { x: 0.3, y: 0.4 },
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

  const chapters = [
    {
      id: "chapter_01",
      title: "Alpine Awakening",
      summary: "Beginning the journey through initial landscapes and crisp morning views.",
      photoIds: photoIds.slice(0, mid),
      order: 1,
      mood: "Crisp",
    },
  ];

  if (photoIds.length > mid) {
    chapters.push({
      id: "chapter_02",
      title: "Golden Hour Ascent",
      summary: "Ascending towards higher trails and warm evening light.",
      photoIds: photoIds.slice(mid),
      order: 2,
      mood: "Warm",
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
  }));

  const captions = photoIds.slice(0, Math.min(5, photoIds.length)).map((pid) => ({
    photoId: pid,
    text: `Natural light across alpine terrain at ${pid}.`,
    style: "EDITORIAL" as const,
    confidence: 0.9,
  }));

  return {
    schemaVersion: "1.0.0",
    bookId,
    title: "Mountain Horizons",
    subtitle: "A Photographic Journey",
    narrativeSummary: "A progressive photographic expedition across mountain valleys.",
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
    editorialNotes: ["High contrast lighting pacing"],
    confidence: {
      overall: 0.94,
      narrative: 0.95,
      grouping: 0.92,
      pacing: 0.93,
      captions: 0.9,
    },
    ...overrides,
  };
}

/**
 * Creates a valid, print-safe synthetic BookDesign conforming strictly to Design JSON v1.0.0.
 */
function createSyntheticBookDesign(
  size: BookSize,
  photos: PhotoAnalysis[],
  editorialPlan: EditorialPlan,
  options?: {
    includeSpread?: boolean;
    spreadPhotoId?: string;
  },
): BookDesign {
  const sizeConfig = BOOK_SIZES[size] || BOOK_SIZES.A4;
  const printConfig = DEFAULT_PRINT_SETTINGS;
  const { width: widthMm, height: heightMm } = sizeConfig.dimensions;
  const safeAreaMm = printConfig.safeAreaMm;
  const bleedMm = printConfig.bleedMm;

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

  let currentPageNum = 2;
  const remainingPhotos = photos.filter((p) => p.photoId !== coverPhotoId);

  // If a spread is requested and we have a valid spread photo
  let spreadUsed = false;
  if (options?.includeSpread && remainingPhotos.length > 0) {
    const spreadPhoto =
      (options?.spreadPhotoId ? remainingPhotos.find((p) => p.photoId === options.spreadPhotoId) : undefined) ||
      remainingPhotos.find(
        (p) =>
          p.orientation === "LANDSCAPE" &&
          p.composition.cropSafety === "SAFE" &&
          (!p.composition.focalPoint || Math.abs(p.composition.focalPoint.x - 0.5) > 0.08),
      ) ||
      remainingPhotos[0];

    const leftPageId = `page_${currentPageNum}`;
    const rightPageId = `page_${currentPageNum + 1}`;

    pages.push({
      id: leftPageId,
      pageNumber: currentPageNum,
      layoutType: "SPREAD",
      elements: [
        {
          id: `el_p${currentPageNum}_spread_img`,
          type: "image",
          assetId: spreadPhoto.photoId,
          xMm: -bleedMm,
          yMm: -bleedMm,
          widthMm: widthMm + bleedMm,
          heightMm: heightMm + bleedMm * 2,
          fit: "COVER",
          focalPoint: spreadPhoto.composition.focalPoint,
        },
      ],
    });

    pages.push({
      id: rightPageId,
      pageNumber: currentPageNum + 1,
      layoutType: "SPREAD",
      elements: [
        {
          id: `el_p${currentPageNum + 1}_spread_img`,
          type: "image",
          assetId: spreadPhoto.photoId,
          xMm: 0,
          yMm: -bleedMm,
          widthMm: widthMm + bleedMm,
          heightMm: heightMm + bleedMm * 2,
          fit: "COVER",
          focalPoint: spreadPhoto.composition.focalPoint,
        },
      ],
    });

    spreads.push({
      id: `spread_${currentPageNum}_${currentPageNum + 1}`,
      leftPageId,
      rightPageId,
      assetId: spreadPhoto.photoId,
      fit: "COVER",
      focalPoint: spreadPhoto.composition.focalPoint,
    });

    currentPageNum += 2;
    spreadUsed = true;
  }

  // Layout distribution for content pages
  const layoutCycle: LayoutType[] = [
    "PHOTO_TEXT",
    "FULL_BLEED",
    "SPLIT",
    "EDITORIAL_GRID",
    "ASYMMETRIC",
    "HERO",
  ];

  let layoutIdx = 0;
  for (let i = 0; i < remainingPhotos.length; i++) {
    const photo = remainingPhotos[i];
    // Skip if already placed in spread
    if (spreadUsed && spreads.some((s) => s.assetId === photo.photoId)) {
      continue;
    }

    const layout = layoutCycle[layoutIdx % layoutCycle.length];
    layoutIdx++;

    const pageId = `page_${currentPageNum}`;

    if (layout === "FULL_BLEED") {
      pages.push({
        id: pageId,
        pageNumber: currentPageNum,
        layoutType: "FULL_BLEED",
        elements: [
          {
            id: `el_p${currentPageNum}_bleed`,
            type: "image",
            assetId: photo.photoId,
            xMm: -bleedMm,
            yMm: -bleedMm,
            widthMm: widthMm + bleedMm * 2,
            heightMm: heightMm + bleedMm * 2,
            fit: "COVER",
            focalPoint: photo.composition.focalPoint,
          },
        ],
      });
    } else if (layout === "PHOTO_TEXT") {
      pages.push({
        id: pageId,
        pageNumber: currentPageNum,
        layoutType: "PHOTO_TEXT",
        elements: [
          {
            id: `el_p${currentPageNum}_img`,
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
            id: `el_p${currentPageNum}_txt`,
            type: "text",
            text: `Vivid observation: ${photo.photoId} captured during alpine trek.`,
            xMm: safeBounds.minX,
            yMm: safeBounds.minY + Math.round(safeBounds.height * 0.78),
            widthMm: safeBounds.width,
            heightMm: 16,
            fontFamily: "Inter",
            fontWeight: 400,
            fontSizePt: 10,
            lineHeight: 1.3,
            letterSpacingPt: 0,
            color: "#334155",
            align: "left",
          },
        ],
      });
    } else {
      // General HERO or SPLIT
      pages.push({
        id: pageId,
        pageNumber: currentPageNum,
        layoutType: layout,
        elements: [
          {
            id: `el_p${currentPageNum}_main`,
            type: "image",
            assetId: photo.photoId,
            xMm: safeBounds.minX,
            yMm: safeBounds.minY,
            widthMm: safeBounds.width,
            heightMm: safeBounds.height,
            fit: "CONTAIN",
            focalPoint: photo.composition.focalPoint,
          },
        ],
      });
    }

    currentPageNum++;
  }

  // Ensure cover photo also appears in content if not spread
  if (!pages.some((p) => p.pageNumber > 1 && p.elements.some((el) => el.type === "image" && el.assetId === coverPhotoId))) {
    // cover photo is already on cover page
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

/**
 * Creates dummy RenderAssets for Print Engine PDF validation and rendering
 */
function createMockRenderAssets(photoIds: string[]): Map<string, RenderAsset> {
  const assets = new Map<string, RenderAsset>();

  // Minimal 1x1 PNG data
  const minimalPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );

  for (const id of photoIds) {
    assets.set(id, {
      id,
      mimeType: "image/png",
      bytes: new Uint8Array(minimalPng),
      width: 1200,
      height: 800,
    });
  }

  return assets;
}

// ============================================================================
// MAIN TEST SUITE
// ============================================================================

export async function runDesignTests(): Promise<void> {
  console.log("=== RUNNING PART 7 DESIGN AI TESTS ===");

  // --------------------------------------------------------------------------
  // Test 1: 10-Photo Travel Magazine (EDITORIAL + A4) Generation & Validation
  // --------------------------------------------------------------------------
  console.log("\n[Test 1] 10-Photo Travel Magazine (EDITORIAL + A4) generation & validation...");
  const travelPhotos10 = generateMockPhotoCollection(10, "travel_10");
  const validPlan10 = createValidEditorialPlan("bk_travel_10", travelPhotos10);
  const syntheticDesign10 = createSyntheticBookDesign("A4", travelPhotos10, validPlan10, {
    includeSpread: true,
    spreadPhotoId: "travel_10_04",
  });

  const directSchemaCheck = validateDesignGenerationResultSchema({
    schemaVersion: "1.0.0",
    design: syntheticDesign10,
    rationale: { overall: "Curated rhythm of full-bleed and structured editorial grids." },
  });
  if (!directSchemaCheck.valid || directSchemaCheck.data?.schemaVersion !== "1.0.0") {
    throw new Error(`Direct schema validation failed: ${directSchemaCheck.error}`);
  }

  const mockSuccessFetch10: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "gen_design_01",
        model: "google/gemma-4-26b-a4b-it:free",
        choices: [
          {
            message: {
              content: JSON.stringify({
                schemaVersion: "1.0.0",
                design: syntheticDesign10,
                rationale: { overall: "Editorial pacing with hero moments." },
              }),
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 1500,
          completion_tokens: 1100,
          total_tokens: 2600,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const testGateway = new AIGateway({ fetchFn: mockSuccessFetch10 });
  const testRepo = new InMemoryDesignRepository();
  const testCache = new DesignPlanCache();

  const result10 = await generateDesign(
    {
      bookId: "bk_travel_10",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      size: "A4",
      editorialPlan: validPlan10,
      photos: travelPhotos10,
      protectedPhotoIds: ["travel_10_03"],
    },
    { gateway: testGateway, repository: testRepo, cache: testCache },
  );

  if (!result10.design || result10.design.pages.length === 0) {
    throw new Error("Generated design is empty.");
  }

  // Verify contiguous page numbering 1..N
  const pageNumbers = result10.design.pages.map((p) => p.pageNumber);
  for (let i = 0; i < pageNumbers.length; i++) {
    if (pageNumbers[i] !== i + 1) {
      throw new Error(`Non-contiguous page number detected: expected ${i + 1}, got ${pageNumbers[i]}`);
    }
  }

  // Verify Page 1 is Cover
  const coverPage = result10.design.pages[0];
  if (coverPage.pageNumber !== 1 || !coverPage.elements.some((el) => el.type === "text" && el.text === validPlan10.title)) {
    throw new Error("Cover page does not properly feature the book title.");
  }

  console.log(`✓ 10-Photo Travel Magazine generated (${result10.design.pages.length} pages) and validated.`);

  // --------------------------------------------------------------------------
  // Test 2: 20-Photo Personal Memories Magazine (CINEMATIC + A4)
  // --------------------------------------------------------------------------
  console.log("\n[Test 2] 20-Photo Personal Memories Magazine (CINEMATIC + A4)...");
  const memoriesPhotos20 = generateMockPhotoCollection(20, "memories_20");
  const memoriesPlan20 = createValidEditorialPlan("bk_mem_20", memoriesPhotos20, {
    title: "Days of Wonder",
  });
  const syntheticDesign20 = createSyntheticBookDesign("A4", memoriesPhotos20, memoriesPlan20, {
    includeSpread: true,
  });

  const mockSuccessFetch20: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "gen_design_02",
        model: "google/gemma-4-26b-a4b-it:free",
        choices: [
          {
            message: {
              content: JSON.stringify({
                schemaVersion: "1.0.0",
                design: syntheticDesign20,
              }),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 2800, completion_tokens: 1900, total_tokens: 4700 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const gateway20 = new AIGateway({ fetchFn: mockSuccessFetch20 });
  const result20 = await generateDesign(
    {
      bookId: "bk_mem_20",
      occasion: "PERSONAL_MEMORIES",
      style: "CINEMATIC",
      size: "A4",
      editorialPlan: memoriesPlan20,
      photos: memoriesPhotos20,
    },
    { gateway: gateway20, repository: testRepo, cache: testCache },
  );

  if (result20.design.pages.length < 16) {
    throw new Error(`Expected at least 16 pages for 20 photos in cinematic style, got ${result20.design.pages.length}`);
  }
  console.log(`✓ 20-Photo Cinematic plan generated ${result20.design.pages.length} pages.`);

  // --------------------------------------------------------------------------
  // Test 3: Square 210×210mm Magazine Generation (EDITORIAL & CINEMATIC)
  // --------------------------------------------------------------------------
  console.log("\n[Test 3] Square 210×210mm magazine generation...");
  const squarePhotos10 = generateMockPhotoCollection(10, "sq_10");
  const squarePlan10 = createValidEditorialPlan("bk_sq_10", squarePhotos10);
  const syntheticSquareDesign = createSyntheticBookDesign("SQUARE_210", squarePhotos10, squarePlan10);

  const mockSquareFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "gen_design_sq",
        model: "google/gemma-4-26b-a4b-it:free",
        choices: [{ message: { content: JSON.stringify({ schemaVersion: "1.0.0", design: syntheticSquareDesign }) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1500, completion_tokens: 1000, total_tokens: 2500 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const gatewaySq = new AIGateway({ fetchFn: mockSquareFetch });
  const resultSq = await generateDesign(
    {
      bookId: "bk_sq_10",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      size: "SQUARE_210",
      editorialPlan: squarePlan10,
      photos: squarePhotos10,
    },
    { gateway: gatewaySq, repository: testRepo, cache: testCache },
  );

  if (resultSq.design.document.widthMm !== 210 || resultSq.design.document.heightMm !== 210) {
    throw new Error(`Expected 210x210mm square document, got ${resultSq.design.document.widthMm}x${resultSq.design.document.heightMm}`);
  }
  console.log("✓ Square 210×210mm magazine verified with correct physical millimeter geometry.");

  // --------------------------------------------------------------------------
  // Test 4: Spread Opportunity & Gutter Safety Test
  // --------------------------------------------------------------------------
  console.log("\n[Test 4] Two-page spread validation & gutter safety check...");
  // Verify synthetic design with spread has 1 spread connecting left and right pages
  if (syntheticDesign10.spreads.length === 0) {
    throw new Error("Synthetic design was expected to contain at least 1 spread.");
  }
  const testSpread = syntheticDesign10.spreads[0];
  if (!testSpread.assetId || testSpread.assetId !== "travel_10_04") {
    throw new Error("Spread assetId does not match expected wide landscape candidate.");
  }
  // Verify left page immediately precedes right page
  const leftPage = syntheticDesign10.pages.find((p) => p.id === testSpread.leftPageId);
  const rightPage = syntheticDesign10.pages.find((p) => p.id === testSpread.rightPageId);
  if (!leftPage || !rightPage || leftPage.pageNumber + 1 !== rightPage.pageNumber) {
    throw new Error("Spread left page does not immediately precede right page.");
  }

  // Verify that placing a face directly into the gutter center throws DESIGN_SPREAD_ERROR
  const unsafeSpreadDesign: BookDesign = JSON.parse(JSON.stringify(syntheticDesign10));
  unsafeSpreadDesign.spreads[0].focalPoint = { x: 0.5, y: 0.5 }; // Exactly in center gutter
  let gutterCaught = false;
  try {
    validateDesignIntegrity(
      unsafeSpreadDesign,
      new Set(travelPhotos10.map((p) => p.photoId)),
    );
  } catch (err) {
    if (err instanceof AIGatewayError && err.code === "DESIGN_SPREAD_ERROR") {
      gutterCaught = true;
    }
  }
  if (!gutterCaught) {
    throw new Error("Failed to reject spread with focal point centered directly in the gutter fold.");
  }
  console.log("✓ Spread candidate validated and gutter boundary safety enforced with DESIGN_SPREAD_ERROR.");

  // --------------------------------------------------------------------------
  // Test 5: Protected Photo Preservation Test
  // --------------------------------------------------------------------------
  console.log("\n[Test 5] Protected photo preservation verification...");
  const authIds10 = new Set(travelPhotos10.map((p) => p.photoId));
  // All photos in protected list must be present
  validateDesignIntegrity(syntheticDesign10, authIds10, ["travel_10_01", "travel_10_02"]);

  // If a protected photo is omitted, must throw DESIGN_PROTECTED_ASSET_ERROR
  let protectedCaught = false;
  try {
    validateDesignIntegrity(syntheticDesign10, authIds10, ["travel_10_99"]); // Does not exist in design
  } catch (err) {
    if (err instanceof AIGatewayError && err.code === "DESIGN_PROTECTED_ASSET_ERROR") {
      protectedCaught = true;
    }
  }
  if (!protectedCaught) {
    throw new Error("Failed to throw DESIGN_PROTECTED_ASSET_ERROR when protected photo was missing.");
  }
  console.log("✓ Protected photo enforcement verified with DESIGN_PROTECTED_ASSET_ERROR.");

  // --------------------------------------------------------------------------
  // Test 6: Unknown Asset Rejection (DESIGN_ASSET_ERROR)
  // --------------------------------------------------------------------------
  console.log("\n[Test 6] Unknown asset rejection (DESIGN_ASSET_ERROR)...");
  const badAssetDesign: BookDesign = JSON.parse(JSON.stringify(syntheticDesign10));
  badAssetDesign.pages[1].elements[0] = {
    ...badAssetDesign.pages[1].elements[0],
    type: "image",
    assetId: "photo_hallucinated_unknown_999",
  } as unknown as DesignElement;

  let assetCaught = false;
  try {
    validateDesignIntegrity(badAssetDesign, authIds10);
  } catch (err) {
    if (err instanceof AIGatewayError && err.code === "DESIGN_ASSET_ERROR") {
      assetCaught = true;
    }
  }
  if (!assetCaught) {
    throw new Error("Failed to reject unknown asset ID with DESIGN_ASSET_ERROR.");
  }
  console.log("✓ Hallucinated asset ID correctly rejected with DESIGN_ASSET_ERROR.");

  // --------------------------------------------------------------------------
  // Test 7: Invalid Geometry Rejection (DESIGN_GEOMETRY_ERROR)
  // --------------------------------------------------------------------------
  console.log("\n[Test 7] Invalid geometry rejection (DESIGN_GEOMETRY_ERROR)...");
  const badGeomDesign: BookDesign = JSON.parse(JSON.stringify(syntheticDesign10));
  badGeomDesign.pages[1].elements[0] = {
    ...badGeomDesign.pages[1].elements[0],
    widthMm: -20, // Negative width
  } as unknown as DesignElement;

  let geomCaught = false;
  try {
    validateDesignIntegrity(badGeomDesign, authIds10);
  } catch (err) {
    if (err instanceof AIGatewayError && err.code === "DESIGN_GEOMETRY_ERROR") {
      geomCaught = true;
    }
  }
  if (!geomCaught) {
    throw new Error("Failed to reject negative element width with DESIGN_GEOMETRY_ERROR.");
  }
  console.log("✓ Negative dimension correctly rejected with DESIGN_GEOMETRY_ERROR.");

  // --------------------------------------------------------------------------
  // Test 8: Unapproved Font Rejection (DESIGN_FONT_ERROR)
  // --------------------------------------------------------------------------
  console.log("\n[Test 8] Unapproved font rejection (DESIGN_FONT_ERROR)...");
  const badFontDesign: BookDesign = JSON.parse(JSON.stringify(syntheticDesign10));
  badFontDesign.pages[0].elements[1] = {
    ...badFontDesign.pages[0].elements[1],
    type: "text",
    fontFamily: "ComicSansMS", // Unsupported
  } as unknown as DesignElement;

  let fontCaught = false;
  try {
    validateDesignIntegrity(badFontDesign, authIds10);
  } catch (err) {
    if (err instanceof AIGatewayError && err.code === "DESIGN_FONT_ERROR") {
      fontCaught = true;
    }
  }
  if (!fontCaught) {
    throw new Error("Failed to reject unapproved font with DESIGN_FONT_ERROR.");
  }
  console.log("✓ Unapproved font family correctly rejected with DESIGN_FONT_ERROR.");

  // --------------------------------------------------------------------------
  // Test 9: Safe Area Violation Rejection (DESIGN_SAFE_AREA_ERROR)
  // --------------------------------------------------------------------------
  console.log("\n[Test 9] Safe area boundary violation (DESIGN_SAFE_AREA_ERROR)...");
  const badSafeAreaDesign: BookDesign = JSON.parse(JSON.stringify(syntheticDesign10));
  // Position title into the bleed area (x = 2mm when safe area is 8mm)
  badSafeAreaDesign.pages[0].elements[1] = {
    ...badSafeAreaDesign.pages[0].elements[1],
    type: "text",
    xMm: 2, // Violates 8mm safe margin
  } as unknown as DesignElement;

  let safeCaught = false;
  try {
    validateDesignIntegrity(badSafeAreaDesign, authIds10);
  } catch (err) {
    if (err instanceof AIGatewayError && err.code === "DESIGN_SAFE_AREA_ERROR") {
      safeCaught = true;
    }
  }
  if (!safeCaught) {
    throw new Error("Failed to reject text placed outside safe area boundary with DESIGN_SAFE_AREA_ERROR.");
  }
  console.log("✓ Safe area margin violation correctly rejected with DESIGN_SAFE_AREA_ERROR.");

  // --------------------------------------------------------------------------
  // Test 10: Deterministic Repair Check
  // --------------------------------------------------------------------------
  console.log("\n[Test 10] Deterministic geometric repair check...");
  const noisyDesign: BookDesign = JSON.parse(JSON.stringify(syntheticDesign10));
  noisyDesign.document.widthMm = 210.00000004;
  noisyDesign.pages[0].elements[0].xMm = 0.00000001;
  const repaired = repairDesignGeometry(noisyDesign);
  if (repaired.document.widthMm !== 210 || repaired.pages[0].elements[0].xMm !== 0) {
    throw new Error("Failed to round tiny floating point coordinates.");
  }
  console.log("✓ Microscopic floating-point noise safely repaired deterministically.");

  // --------------------------------------------------------------------------
  // Test 11: Photo Scaling: 10, 20, 30, and 50 Photos
  // --------------------------------------------------------------------------
  console.log("\n[Test 11] Photo scaling test (10, 20, 30, 50 photos)...");
  for (const count of [10, 20, 30, 50]) {
    const scalePhotos = generateMockPhotoCollection(count, `scale_${count}`);
    const scalePlan = createValidEditorialPlan(`bk_scale_${count}`, scalePhotos);
    const scaleDesign = createSyntheticBookDesign("A4", scalePhotos, scalePlan);

    validateDesignIntegrity(
      scaleDesign,
      new Set(scalePhotos.map((p) => p.photoId)),
    );
    console.log(`  ✓ ${count} photos scaled cleanly to ${scaleDesign.pages.length} pages.`);
  }

  // --------------------------------------------------------------------------
  // Test 12: Direct Print Engine Validation & PDF Generation Integration Test
  // --------------------------------------------------------------------------
  console.log("\n[Test 12] Direct Print Engine validation & PDF generation test...");
  const mockRenderAssets = createMockRenderAssets(travelPhotos10.map((p) => p.photoId));

  // 1. Pass generated BookDesign directly into Print Engine's validateDesign
  const printValidation = validatePrintEngineDesign(result10.design, mockRenderAssets);
  if (!printValidation.valid) {
    throw new Error(`Print engine validation failed on Design AI output: ${JSON.stringify(printValidation.errors)}`);
  }

  // 2. Pass generated BookDesign directly into Print Engine's renderDocument
  const renderResult = await renderDocument(result10.design, mockRenderAssets, {
    outputDpi: 300,
  });

  const pdfBytes = renderResult.pdfBytes;
  if (!pdfBytes || pdfBytes.length === 0) {
    throw new Error("Print engine rendered an empty PDF buffer from Design AI output.");
  }

  // Check PDF signature '%PDF-'
  const pdfHeader = Buffer.from(pdfBytes.slice(0, 5)).toString("ascii");
  if (pdfHeader !== "%PDF-") {
    throw new Error(`Invalid PDF header: ${pdfHeader}`);
  }
  console.log(`✓ Direct Print Engine integration passed: rendered valid PDF (${(pdfBytes.length / 1024).toFixed(1)} KB, ${renderResult.pageCount} pages) without modifications.`);

  // --------------------------------------------------------------------------
  // Test 13: Deterministic Cache Invalidation on Style Change
  // --------------------------------------------------------------------------
  console.log("\n[Test 13] Deterministic cache invalidation on style change...");
  const testCache2 = new DesignPlanCache();
  const testRepo2 = new InMemoryDesignRepository();

  let apiCallCount = 0;
  const getCallCount = (): number => apiCallCount;
  const countingFetch: typeof fetch = async () => {
    apiCallCount++;
    return new Response(
      JSON.stringify({
        id: `call_${apiCallCount}`,
        model: "google/gemma-4-26b-a4b-it:free",
        choices: [{ message: { content: JSON.stringify({ schemaVersion: "1.0.0", design: syntheticDesign10 }) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1500, completion_tokens: 1000, total_tokens: 2500 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const gatewayCounter = new AIGateway({ fetchFn: countingFetch });

  // Initial call with EDITORIAL style
  await generateDesign(
    {
      bookId: "bk_cache_test",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      size: "A4",
      editorialPlan: validPlan10,
      photos: travelPhotos10,
    },
    { gateway: gatewayCounter, repository: testRepo2, cache: testCache2 },
  );
  if (getCallCount() !== 1) throw new Error("Expected 1 API call for initial generation.");

  // Second call with same inputs should hit cache
  await generateDesign(
    {
      bookId: "bk_cache_test",
      occasion: "TRAVEL",
      style: "EDITORIAL",
      size: "A4",
      editorialPlan: validPlan10,
      photos: travelPhotos10,
    },
    { gateway: gatewayCounter, repository: testRepo2, cache: testCache2 },
  );
  if (getCallCount() !== 1) throw new Error("Expected cache hit on identical inputs.");

  // Third call with CINEMATIC style should invalidate cache and trigger API call
  await generateDesign(
    {
      bookId: "bk_cache_test",
      occasion: "TRAVEL",
      style: "CINEMATIC",
      size: "A4",
      editorialPlan: validPlan10,
      photos: travelPhotos10,
    },
    { gateway: gatewayCounter, repository: testRepo2, cache: testCache2 },
  );
  if (getCallCount() !== 2) throw new Error("Expected cache miss and regeneration on style change.");
  console.log("✓ Style change successfully invalidated cache and triggered fresh design generation.");

  console.log("\n=== ALL PART 7 DESIGN AI TESTS PASSED SUCCESSFULLY ===");
}

// Direct execution harness
if (require.main === module || process.argv[1]?.includes("run-design-test")) {
  runDesignTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ DESIGN AI TEST FAILED:", err);
      process.exit(1);
    });
}
