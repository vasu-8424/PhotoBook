import { DESIGN_SCHEMA_VERSION, type BookDesign, type TextElement, type ImageElement } from "@/types/design";
import { BOOK_SIZES, DEFAULT_PRINT_SETTINGS } from "@/config/book";
import { renderDocument, type RenderAsset } from "@/lib/pdf";
import { validateDesign as validatePrintEngineDesign } from "@/lib/pdf/validate-design";
import {
  mmToPx,
  ptToPx,
  pxToPt,
  calculateDisplayScale,
} from "../coordinates";
import {
  constrainTextPosition,
  isGutterSafe,
} from "../constraints";
import {
  updateElementPosition,
  updateElementSize,
  updateTextElement,
  deleteElement,
  findElementById,
} from "../mutations";
import {
  createHistory,
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
} from "../history";
import { validateEditorDesign, validateElementGeometry } from "../validation";
import { AutosaveController } from "../autosave";
import { calculateKonvaImageCrop } from "../renderer";
import { InMemoryDesignRepository } from "@/lib/ai/design/storage";

// ============================================================================
// Fixture Generators
// ============================================================================

function createFixtureDesign(size: "A4" | "SQUARE_210" = "A4"): BookDesign {
  const sizeConfig = BOOK_SIZES[size];
  const printConfig = DEFAULT_PRINT_SETTINGS;
  const widthMm = sizeConfig.dimensions.width;
  const heightMm = sizeConfig.dimensions.height;

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    document: {
      schemaVersion: DESIGN_SCHEMA_VERSION,
      size,
      widthMm,
      heightMm,
      bleedMm: printConfig.bleedMm,
      safeAreaMm: printConfig.safeAreaMm,
      gutterMm: printConfig.gutterMm,
      dpi: printConfig.dpi,
      orientation: sizeConfig.orientation,
    },
    pages: [
      {
        id: "page_1",
        pageNumber: 1,
        layoutType: "HERO",
        elements: [
          {
            id: "el_img_cover",
            type: "image",
            assetId: "photo_cover_01",
            xMm: 0,
            yMm: 0,
            widthMm,
            heightMm: Math.round(heightMm * 0.7),
            fit: "COVER",
            focalPoint: { x: 0.5, y: 0.5 },
          },
          {
            id: "el_txt_title",
            type: "text",
            text: "Mountain Horizons",
            xMm: printConfig.safeAreaMm,
            yMm: Math.round(heightMm * 0.75),
            widthMm: widthMm - printConfig.safeAreaMm * 2,
            heightMm: 24,
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
        layoutType: "SPREAD",
        elements: [
          {
            id: "el_p2_spread",
            type: "image",
            assetId: "photo_spread_02",
            xMm: -printConfig.bleedMm,
            yMm: -printConfig.bleedMm,
            widthMm: widthMm + printConfig.bleedMm,
            heightMm: heightMm + printConfig.bleedMm * 2,
            fit: "COVER",
            focalPoint: { x: 0.3, y: 0.4 },
          },
        ],
      },
      {
        id: "page_3",
        pageNumber: 3,
        layoutType: "SPREAD",
        elements: [
          {
            id: "el_p3_spread",
            type: "image",
            assetId: "photo_spread_02",
            xMm: 0,
            yMm: -printConfig.bleedMm,
            widthMm: widthMm + printConfig.bleedMm,
            heightMm: heightMm + printConfig.bleedMm * 2,
            fit: "COVER",
            focalPoint: { x: 0.3, y: 0.4 },
          },
        ],
      },
      {
        id: "page_4",
        pageNumber: 4,
        layoutType: "PHOTO_TEXT",
        elements: [
          {
            id: "el_p4_img",
            type: "image",
            assetId: "photo_protected_03",
            xMm: printConfig.safeAreaMm,
            yMm: printConfig.safeAreaMm,
            widthMm: widthMm - printConfig.safeAreaMm * 2,
            heightMm: Math.round(heightMm * 0.6),
            fit: "CONTAIN",
            focalPoint: { x: 0.5, y: 0.5 },
          },
          {
            id: "el_p4_caption",
            type: "text",
            text: "Sunlight striking granite ridgelines at dawn.",
            xMm: printConfig.safeAreaMm,
            yMm: Math.round(heightMm * 0.68),
            widthMm: widthMm - printConfig.safeAreaMm * 2,
            heightMm: 16,
            fontFamily: "Inter",
            fontWeight: 400,
            fontSizePt: 10,
            lineHeight: 1.3,
            letterSpacingPt: 0,
            color: "#334155",
            align: "left",
          },
          {
            id: "el_p4_divider",
            type: "shape",
            shape: "line",
            xMm: printConfig.safeAreaMm,
            yMm: Math.round(heightMm * 0.65),
            widthMm: 40,
            heightMm: 1,
            fill: "#CBD5E1",
            stroke: "#94A3B8",
            strokeWidthMm: 0.5,
          },
        ],
      },
    ],
    spreads: [
      {
        id: "spread_2_3",
        leftPageId: "page_2",
        rightPageId: "page_3",
        assetId: "photo_spread_02",
        fit: "COVER",
        focalPoint: { x: 0.3, y: 0.4 },
      },
    ],
  };
}

function createMockAssets(): Map<string, RenderAsset> {
  const minimalPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );

  const assets = new Map<string, RenderAsset>();
  for (const id of ["photo_cover_01", "photo_spread_02", "photo_protected_03"]) {
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
// MAIN EDITOR TEST SUITE
// ============================================================================

export async function runEditorTests(): Promise<void> {
  console.log("=== RUNNING PART 8 BOOK PREVIEW & KONVA EDITOR TESTS ===");

  const authoritativeAssets = new Set(["photo_cover_01", "photo_spread_02", "photo_protected_03"]);
  const protectedPhotoIds = ["photo_protected_03"];

  // --------------------------------------------------------------------------
  // Test 1: Design JSON Loads
  // --------------------------------------------------------------------------
  console.log("\n[Test 1] Design JSON loads and verifies schema...");
  const a4Design = createFixtureDesign("A4");
  if (a4Design.schemaVersion !== "1.0.0" || a4Design.pages.length !== 4) {
    throw new Error("Failed to load initial Design JSON.");
  }
  console.log("✓ Design JSON v1.0.0 loaded successfully.");

  // --------------------------------------------------------------------------
  // Test 2: A4 Renders (accurate screen conversion)
  // --------------------------------------------------------------------------
  console.log("\n[Test 2] A4 page screen coordinate conversion...");
  const scaleA4 = calculateDisplayScale(210, 297, 1200, 900, 1.0);
  const a4WidthPx = mmToPx(210, scaleA4.effectiveScale);
  const a4HeightPx = mmToPx(297, scaleA4.effectiveScale);
  if (a4WidthPx <= 0 || a4HeightPx <= 0 || Math.abs(a4WidthPx / a4HeightPx - 210 / 297) > 0.01) {
    throw new Error("A4 dimensions did not convert accurately.");
  }
  console.log(`✓ A4 rendered: 210x297mm -> ${Math.round(a4WidthPx)}x${Math.round(a4HeightPx)}px (ratio preserved).`);

  // --------------------------------------------------------------------------
  // Test 3: Square Renders (accurate screen conversion)
  // --------------------------------------------------------------------------
  console.log("\n[Test 3] Square (210x210mm) screen coordinate conversion...");
  const sqDesign = createFixtureDesign("SQUARE_210");
  if (!sqDesign || sqDesign.document.size !== "SQUARE_210") {
    throw new Error("Square fixture generation failed.");
  }
  const scaleSq = calculateDisplayScale(210, 210, 1000, 800, 1.0);
  const sqWidthPx = mmToPx(210, scaleSq.effectiveScale);
  const sqHeightPx = mmToPx(210, scaleSq.effectiveScale);
  if (sqWidthPx !== sqHeightPx) {
    throw new Error("Square dimensions are not 1:1.");
  }
  console.log(`✓ Square rendered: 210x210mm -> ${Math.round(sqWidthPx)}x${Math.round(sqHeightPx)}px (perfect 1:1).`);

  // --------------------------------------------------------------------------
  // Test 4: Image Renders (geometry and crop)
  // --------------------------------------------------------------------------
  console.log("\n[Test 4] Image crop geometry calculation...");
  const cropResult = calculateKonvaImageCrop(1600, 1200, 400, 400, "COVER", { x: 0.5, y: 0.5 });
  if (!cropResult || cropResult.width !== cropResult.height) {
    throw new Error("Image crop did not produce expected square crop for 1:1 target.");
  }
  console.log(`✓ Cover crop calculated: source (1600x1200) -> crop (${cropResult.width}x${cropResult.height} at x=${cropResult.x}, y=${cropResult.y}).`);

  // --------------------------------------------------------------------------
  // Test 5: Text Renders (typography and points)
  // --------------------------------------------------------------------------
  console.log("\n[Test 5] Text typography and pt to px conversion...");
  const ptVal = 28;
  const pxVal = ptToPx(ptVal, 2.5);
  const roundtripPt = pxToPt(pxVal, 2.5);
  if (Math.abs(roundtripPt - ptVal) > 0.1) {
    throw new Error(`Roundtrip typography conversion failed: expected ${ptVal}pt, got ${roundtripPt}pt.`);
  }
  console.log(`✓ Typography points roundtrip verified: ${ptVal}pt -> ${pxVal.toFixed(1)}px -> ${roundtripPt}pt.`);

  // --------------------------------------------------------------------------
  // Test 6: Shape Renders
  // --------------------------------------------------------------------------
  console.log("\n[Test 6] Shape element geometry rendering...");
  const dividerEl = a4Design.pages[3].elements.find((el) => el.id === "el_p4_divider");
  if (!dividerEl || dividerEl.type !== "shape" || dividerEl.shape !== "line") {
    throw new Error("Shape element fixture missing.");
  }
  const shapeWPx = mmToPx(dividerEl.widthMm, 2.0);
  if (shapeWPx !== 80) {
    throw new Error("Shape width conversion mismatch.");
  }
  console.log("✓ Shape element (divider line) converted accurately.");

  // --------------------------------------------------------------------------
  // Test 7: Page Navigation Works
  // --------------------------------------------------------------------------
  console.log("\n[Test 7] Page navigation integrity...");
  let activePageId = a4Design.pages[0].id;
  activePageId = a4Design.pages[2].id;
  const selectedPage = a4Design.pages.find((p) => p.id === activePageId);
  if (!selectedPage || selectedPage.pageNumber !== 3) {
    throw new Error("Navigation failed to select page 3.");
  }
  console.log(`✓ Navigated to Page ${selectedPage.pageNumber} (${selectedPage.layoutType}).`);

  // --------------------------------------------------------------------------
  // Test 8: Element Selection Works
  // --------------------------------------------------------------------------
  console.log("\n[Test 8] Element selection lookup...");
  const found = findElementById(a4Design, "el_txt_title");
  if (!found || found.pageId !== "page_1" || found.element.type !== "text") {
    throw new Error("Element lookup failed.");
  }
  console.log(`✓ Element '${found.element.id}' selected on page '${found.pageId}'.`);

  // --------------------------------------------------------------------------
  // Test 9: Image Move Works (position mutation, clean rounding)
  // --------------------------------------------------------------------------
  console.log("\n[Test 9] Image position mutation & clean rounding...");
  const moved = updateElementPosition(a4Design, "page_1", "el_img_cover", 15.00000004, 25.00000001);
  const movedEl = findElementById(moved, "el_img_cover")?.element;
  if (!movedEl || movedEl.xMm !== 15 || movedEl.yMm !== 25) {
    throw new Error("Position mutation failed or did not round coordinates.");
  }
  console.log(`✓ Image position updated to clean coordinates: [${movedEl.xMm}, ${movedEl.yMm}] mm.`);

  // --------------------------------------------------------------------------
  // Test 10: Image Resize Works (positive dimensions enforced)
  // --------------------------------------------------------------------------
  console.log("\n[Test 10] Image resize mutation...");
  const resized = updateElementSize(moved, "page_1", "el_img_cover", 180, 140);
  const resizedEl = findElementById(resized, "el_img_cover")?.element;
  if (!resizedEl || resizedEl.widthMm !== 180 || resizedEl.heightMm !== 140) {
    throw new Error("Image resize failed.");
  }
  console.log(`✓ Image resized to: ${resizedEl.widthMm}x${resizedEl.heightMm} mm.`);

  // --------------------------------------------------------------------------
  // Test 11: Text Editing Works (content mutation)
  // --------------------------------------------------------------------------
  console.log("\n[Test 11] Text content mutation...");
  const newText = "Alpine Solitude & High Passes";
  const textEdited = updateTextElement(resized, "page_1", "el_txt_title", { text: newText });
  const editedTextEl = findElementById(textEdited, "el_txt_title")?.element as TextElement;
  if (!editedTextEl || editedTextEl.text !== newText) {
    throw new Error("Text content edit failed.");
  }
  console.log(`✓ Text content updated to: "${editedTextEl.text}".`);

  // --------------------------------------------------------------------------
  // Test 12: Typography Mutation Works (approved fonts only)
  // --------------------------------------------------------------------------
  console.log("\n[Test 12] Typography mutation & approved font enforcement...");
  const typoEdited = updateTextElement(textEdited, "page_1", "el_txt_title", {
    fontWeight: 700,
    fontSizePt: 32,
    color: "#1E293B",
  });
  const typoEl = findElementById(typoEdited, "el_txt_title")?.element as TextElement;
  if (!typoEl || typoEl.fontSizePt !== 32 || typoEl.color !== "#1E293B") {
    throw new Error("Typography update failed.");
  }

  // Attempting unsupported font should be rejected/ignored
  const rejectedFont = updateTextElement(typoEdited, "page_1", "el_txt_title", {
    fontFamily: "ComicSansMS",
  });
  const rejectedEl = findElementById(rejectedFont, "el_txt_title")?.element as TextElement;
  if (rejectedEl.fontFamily === "ComicSansMS") {
    throw new Error("Failed to block unapproved font family in mutation.");
  }
  console.log("✓ Typography updated (32pt, #1E293B) and unsupported font rejected.");

  // --------------------------------------------------------------------------
  // Test 13: Protected Image Restrictions Work
  // --------------------------------------------------------------------------
  console.log("\n[Test 13] Protected photo deletion guard...");
  const delProtectedRes = deleteElement(typoEdited, "page_4", "el_p4_img", protectedPhotoIds);
  if (delProtectedRes.success) {
    throw new Error("Protected photo was deleted, expected deletion to be blocked.");
  }
  console.log(`✓ Protected photo deletion blocked with message: "${delProtectedRes.error}".`);

  // Non-protected element deletion should succeed
  const delNormalRes = deleteElement(typoEdited, "page_4", "el_p4_divider", protectedPhotoIds);
  if (!delNormalRes.success || findElementById(delNormalRes.design, "el_p4_divider") !== null) {
    throw new Error("Failed to delete normal divider element.");
  }
  console.log("✓ Normal non-protected element deleted cleanly.");

  // --------------------------------------------------------------------------
  // Test 14: Safe-Area Constraints Work
  // --------------------------------------------------------------------------
  console.log("\n[Test 14] Safe-area constraint enforcement for text...");
  // Attempt to position text at x = 0 (bleed area, safe is 8mm)
  const safeConstrained = constrainTextPosition(0, 0, 100, 20, a4Design.document);
  if (safeConstrained.xMm < a4Design.document.safeAreaMm || safeConstrained.yMm < a4Design.document.safeAreaMm) {
    throw new Error("Text position violated safe area boundary.");
  }
  console.log(`✓ Safe area constraint clamped text from [0, 0] to [${safeConstrained.xMm}, ${safeConstrained.yMm}] mm.`);

  // --------------------------------------------------------------------------
  // Test 15: Gutter Constraints Work
  // --------------------------------------------------------------------------
  console.log("\n[Test 15] Gutter safety clearance check...");
  if (isGutterSafe(0.5)) {
    throw new Error("Center fold focal point (x=0.5) should be flagged unsafe.");
  }
  if (!isGutterSafe(0.3)) {
    throw new Error("Off-center focal point (x=0.3) should be safe.");
  }
  console.log("✓ Gutter clearance correctly identified safe vs hazardous focal points.");

  // --------------------------------------------------------------------------
  // Test 16: Spread Rendering Works (one asset across two pages)
  // --------------------------------------------------------------------------
  console.log("\n[Test 16] Spread integrity check...");
  const spread = a4Design.spreads[0];
  const p2El = a4Design.pages[1].elements[0] as ImageElement;
  const p3El = a4Design.pages[2].elements[0] as ImageElement;
  if (p2El.assetId !== p3El.assetId || p2El.assetId !== spread.assetId) {
    throw new Error("Spread left and right pages do not share the exact same assetId.");
  }
  console.log(`✓ Spread '${spread.id}' spans pages 2 & 3 sharing identical asset '${spread.assetId}'.`);

  // --------------------------------------------------------------------------
  // Test 17: Undo Works
  // --------------------------------------------------------------------------
  console.log("\n[Test 17] History undo check...");
  let history = createHistory(a4Design);
  const designStep1 = updateElementPosition(a4Design, "page_1", "el_img_cover", 10, 10);
  history = pushHistory(history, designStep1);

  const designStep2 = updateTextElement(designStep1, "page_1", "el_txt_title", { text: "Step 2 Title" });
  history = pushHistory(history, designStep2);

  if (!canUndo(history)) throw new Error("Expected canUndo to be true.");
  history = undo(history); // Back to step 1
  const undoEl1 = findElementById(history.present, "el_txt_title")?.element as TextElement;
  if (undoEl1.text !== "Mountain Horizons") {
    throw new Error("Undo did not restore step 1 state.");
  }

  history = undo(history); // Back to initial
  const undoEl0 = findElementById(history.present, "el_img_cover")?.element as ImageElement;
  if (undoEl0.xMm !== 0 || undoEl0.yMm !== 0) {
    throw new Error("Undo did not restore initial design state.");
  }
  console.log("✓ Undo stack successfully restored multiple historical steps.");

  // --------------------------------------------------------------------------
  // Test 18: Redo Works
  // --------------------------------------------------------------------------
  console.log("\n[Test 18] History redo check...");
  if (!canRedo(history)) throw new Error("Expected canRedo to be true.");
  history = redo(history); // Redo to step 1
  history = redo(history); // Redo to step 2
  const redoEl2 = findElementById(history.present, "el_txt_title")?.element as TextElement;
  if (redoEl2.text !== "Step 2 Title") {
    throw new Error("Redo failed to restore future state.");
  }
  console.log("✓ Redo stack successfully restored forward states.");

  // --------------------------------------------------------------------------
  // Test 19: Autosave Mutation Produces Valid Design JSON
  // --------------------------------------------------------------------------
  console.log("\n[Test 19] Autosave controller & debounce verification...");
  let savedDesignPayload: BookDesign | null = null;
  const mockSaveFn = async (d: BookDesign) => {
    savedDesignPayload = d;
    return true;
  };

  const autosave = new AutosaveController(mockSaveFn, 50); // 50ms for test speed
  autosave.scheduleSave(designStep1);
  autosave.scheduleSave(designStep2);

  // Flush to force debounce execution
  await autosave.flush();

  if (!savedDesignPayload || (findElementById(savedDesignPayload, "el_txt_title")?.element as TextElement)?.text !== "Step 2 Title") {
    throw new Error("Autosave did not debounce and commit the latest mutated design.");
  }
  console.log("✓ Debounced autosave flushed valid mutated Design JSON.");

  // --------------------------------------------------------------------------
  // Test 20: Invalid Mutation is Rejected
  // --------------------------------------------------------------------------
  console.log("\n[Test 20] Invalid geometry rejection...");
  const invalidGeomCheck = validateElementGeometry(
    {
      id: "el_bad",
      type: "image",
      assetId: "photo_cover_01",
      xMm: 0,
      yMm: 0,
      widthMm: -10, // Invalid
      heightMm: 50,
      fit: "COVER",
    },
    a4Design.document,
  );
  if (invalidGeomCheck.valid) {
    throw new Error("Failed to reject negative element width.");
  }
  console.log(`✓ Negative dimension rejected: "${invalidGeomCheck.error}".`);

  // --------------------------------------------------------------------------
  // Test 21: Unknown Asset is Rejected (DESIGN_ASSET_ERROR)
  // --------------------------------------------------------------------------
  console.log("\n[Test 21] Unknown asset rejection in editor validation...");
  const badAssetDesign: BookDesign = JSON.parse(JSON.stringify(a4Design));
  const el0 = badAssetDesign.pages[0].elements[0] as ImageElement;
  badAssetDesign.pages[0].elements[0] = {
    ...el0,
    assetId: "photo_fake_unauthorized_999",
  };
  const assetValResult = validateEditorDesign(badAssetDesign, authoritativeAssets);
  if (assetValResult.valid || assetValResult.code !== "DESIGN_ASSET_ERROR") {
    throw new Error("Failed to reject unauthorized asset with DESIGN_ASSET_ERROR.");
  }
  console.log("✓ Unknown asset correctly rejected with DESIGN_ASSET_ERROR.");

  // --------------------------------------------------------------------------
  // Test 22: Unsupported Font is Rejected (DESIGN_FONT_ERROR)
  // --------------------------------------------------------------------------
  console.log("\n[Test 22] Unsupported font rejection in editor validation...");
  const badFontDesign: BookDesign = JSON.parse(JSON.stringify(a4Design));
  const el1 = badFontDesign.pages[0].elements[1] as TextElement;
  badFontDesign.pages[0].elements[1] = {
    ...el1,
    fontFamily: "Papyrus",
  };
  const fontValResult = validateEditorDesign(badFontDesign, authoritativeAssets);
  if (fontValResult.valid || fontValResult.code !== "DESIGN_FONT_ERROR") {
    throw new Error("Failed to reject unsupported font with DESIGN_FONT_ERROR.");
  }
  console.log("✓ Unsupported font correctly rejected with DESIGN_FONT_ERROR.");

  // --------------------------------------------------------------------------
  // Test 23: Design JSON Strictly Maintains Schema v1.0.0
  // --------------------------------------------------------------------------
  console.log("\n[Test 23] Schema version v1.0.0 invariant...");
  if (a4Design.schemaVersion !== "1.0.0" || a4Design.document.schemaVersion !== "1.0.0") {
    throw new Error("Design schema version modified.");
  }
  console.log("✓ Canonical Design JSON v1.0.0 invariant preserved.");

  // --------------------------------------------------------------------------
  // Test 24: Server Persistence Works
  // --------------------------------------------------------------------------
  console.log("\n[Test 24] Server persistence via DesignRepository...");
  const repo = new InMemoryDesignRepository();
  const testRecord = {
    id: "rec_editor_01",
    bookId: "bk_editor_test",
    schemaVersion: "1.0.0",
    designJson: textEdited,
    provider: "USER_EDITOR",
    model: "manual-edit",
    promptVersion: "v1.0.0",
    inputHash: "hash_user_01",
    outputSchemaVersion: "1.0.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await repo.saveDesign(testRecord);
  const loadedRecord = await repo.getDesignByBookId("bk_editor_test");
  const loadedText = (loadedRecord?.designJson.pages[0].elements[1] as TextElement)?.text;
  if (!loadedRecord || loadedText !== newText) {
    throw new Error("Persistence or retrieval failed.");
  }
  console.log("✓ Edited design successfully persisted and loaded from repository.");

  // --------------------------------------------------------------------------
  // Test 25: Reload Restores Saved Design & Passes Print Engine Integration
  // --------------------------------------------------------------------------
  console.log("\n[Test 25] Reload restore & Print Engine PDF generation integration...");
  const reloadedDesign = loadedRecord.designJson;

  // 1. Authoritative Print Engine validation pass
  const mockAssets = createMockAssets();
  const printValidation = validatePrintEngineDesign(reloadedDesign, mockAssets);
  if (!printValidation.valid) {
    throw new Error(`Print engine rejected reloaded design: ${JSON.stringify(printValidation.errors)}`);
  }

  // 2. Authoritative Print Engine PDF rendering pass
  const renderResult = await renderDocument(reloadedDesign, mockAssets, { outputDpi: 300 });
  if (!renderResult.pdfBytes || renderResult.pdfBytes.length === 0) {
    throw new Error("Print engine rendered an empty PDF buffer.");
  }

  const pdfHeader = Buffer.from(renderResult.pdfBytes.slice(0, 5)).toString("ascii");
  if (pdfHeader !== "%PDF-") {
    throw new Error(`Invalid PDF header: ${pdfHeader}`);
  }
  console.log(`✓ Full cycle verified: Edit -> Save -> Reload -> Print Engine -> PDF (${(renderResult.pdfBytes.length / 1024).toFixed(1)} KB, ${renderResult.pageCount} pages).`);

  console.log("\n=== ALL PART 8 BOOK PREVIEW & KONVA EDITOR TESTS PASSED SUCCESSFULLY ===");
}

// Direct execution harness
if (require.main === module || process.argv[1]?.includes("run-editor-test")) {
  runEditorTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ EDITOR TEST FAILED:", err);
      process.exit(1);
    });
}
