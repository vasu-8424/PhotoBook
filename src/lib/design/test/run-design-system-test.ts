/**
 * MEMORY MAGAZINE — PART 10.5
 * Premium Magazine Design System & Layout Intelligence Test Suite
 *
 * Verifies:
 * Section A: Orientation Detection & Aspect Ratio Classification
 * Section B: Photo Layout Profiler & Intelligence
 * Section C: Book Color Themes & Typography Systems
 * Section D: 38 Composition Templates Compilation & Geometry Integrity
 * Section E: Template Compatibility Scoring & Repetition Penalties
 * Section F: Cover & Chapter Opener Systems
 * Section G: Deterministic Geometry Compiler & Schema v1.0.0 Integrity
 * Section H: Book-Wide Theme Switching & Page-Level Layout Change
 * Section I: Visual Regression on 10, 20, 30 Photos Across All 4 Styles
 * Section J: Part 2 Print Engine & PDF Export End-to-End Regression
 */

import { DESIGN_SCHEMA_VERSION, type TextElement } from "@/types/design";
import { validateDesignIntegrity } from "@/lib/ai/design/validate";
import { validateDesign as validatePrintEngineDesign } from "@/lib/pdf/validate-design";
import { renderDocument, type RenderAsset } from "@/lib/pdf";
import {
  determineOrientation,
  determineAspectRatio,
  buildPhotoLayoutProfile,
  buildPhotoLayoutProfiles,
} from "../photo-profile";
import {
  BOOK_THEMES,
  listThemes,
  WARM_EDITORIAL,
  MIDNIGHT_CINEMATIC,
} from "../themes";
import {
  TYPOGRAPHY_SYSTEMS,
  listTypographySystems,
  resolveRoleStyle,
  EDITORIAL_SERIF,
} from "../typography";
import {
  ALL_TEMPLATES,
  getTemplateById,
  listTemplatesByFamily,
} from "../templates";
import { getPageBounds } from "../templates/helpers";
import { scoreTemplate } from "../scoring";
import { compileCover } from "../cover";
import { compileChapterOpener } from "../chapter";
import {
  compileBookDesign,
  createDocument,
  recompileBookTheme,
  changePageLayout,
} from "../compiler";
import type { PhotoLayoutProfile, TypographicRole } from "../types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ ${msg}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

// 1x1 valid transparent PNG for asset rendering
const TINY_PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function createMockAsset(id: string): RenderAsset {
  return {
    id,
    bytes: new Uint8Array(TINY_PNG_BYTES),
    mimeType: "image/png",
    width: 2400,
    height: 1600,
  };
}

function generateMockProfiles(
  count: number,
  orientationType: "PORTRAIT" | "LANDSCAPE" | "MIXED" = "MIXED",
): PhotoLayoutProfile[] {
  return Array.from({ length: count }, (_, i) => {
    const assetId = `test_photo_${i + 1}`;
    let width = 2400;
    let height = 1600;

    if (orientationType === "PORTRAIT") {
      width = 1600;
      height = 2400;
    } else if (orientationType === "MIXED") {
      if (i % 3 === 0) {
        width = 1600;
        height = 2400; // Portrait
      } else if (i % 3 === 1) {
        width = 2400;
        height = 1600; // Landscape
      } else {
        width = 2000;
        height = 2000; // Square
      }
    }

    return buildPhotoLayoutProfile(assetId, {
      defaultWidth: width,
      defaultHeight: height,
      analysis: {
        visualQuality: {
          overall: i % 2 === 0 ? "EXCELLENT" : "GOOD",
          sharpness: "SHARP",
          exposure: "GOOD",
          composition: "STRONG",
          usableForPrint: "YES",
          confidence: 0.95,
        },
        composition: {
          cropSafety: "SAFE",
          balance: "BALANCED",
          subjectPosition: "CENTER",
          negativeSpace: "MEDIUM",
          depth: "DEEP",
          focalPoint: { x: 0.4, y: 0.4 },
        },
        peopleCount: i % 4 === 0 ? 2 : 0,
      },
    });
  });
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("MEMORY MAGAZINE — PART 10.5 PREMIUM DESIGN SYSTEM VERIFICATION SUITE");
  console.log("================================================================================\n");

  // ============================================================================
  // SECTION A: Orientation Detection & Aspect Ratio Classification
  // ============================================================================
  console.log("Section A: Orientation Detection & Aspect Ratio");
  {
    assert(determineOrientation(2400, 1600) === "LANDSCAPE", "width > height * 1.05 classifies as LANDSCAPE");
    assert(determineOrientation(1600, 2400) === "PORTRAIT", "height > width * 1.05 classifies as PORTRAIT");
    assert(determineOrientation(2000, 2000) === "SQUARE", "1:1 ratio classifies as SQUARE");
    assert(determineOrientation(2000, 2020) === "SQUARE", "Near 1:1 ratio (within 5%) classifies as SQUARE");
    assert(determineOrientation(0, 0) === "LANDSCAPE", "Zero dimensions safely defaults to LANDSCAPE");

    assert(determineAspectRatio(2400, 1600) === 1.5, "Aspect ratio 2400x1600 is exactly 1.5");
    assert(determineAspectRatio(1600, 2400) === 0.67, "Aspect ratio 1600x2400 is rounded to 0.67");
    assert(determineAspectRatio(2000, 2000) === 1.0, "Aspect ratio 2000x2000 is 1.0");
  }

  // ============================================================================
  // SECTION B: Photo Layout Profiler
  // ============================================================================
  console.log("\nSection B: Photo Layout Profiler");
  {
    const profileLandscape = buildPhotoLayoutProfile("ast_01", {
      defaultWidth: 3000,
      defaultHeight: 2000,
      analysis: {
        visualQuality: {
          overall: "EXCELLENT",
          sharpness: "SHARP",
          exposure: "GOOD",
          composition: "STRONG",
          usableForPrint: "YES",
          confidence: 0.95,
        },
        composition: {
          cropSafety: "SAFE",
          balance: "BALANCED",
          subjectPosition: "CENTER",
          negativeSpace: "HIGH",
          depth: "DEEP",
          focalPoint: { x: 0.35, y: 0.45 },
        },
        peopleCount: 1,
      },
    });

    assert(profileLandscape.orientation === "LANDSCAPE", "Profile correctly identifies landscape orientation");
    assert(profileLandscape.aspectRatio === 1.5, "Profile records aspect ratio 1.5");
    assert(profileLandscape.qualityScore >= 0.85, "High visual quality translates to qualityScore >= 0.85");
    assert(profileLandscape.preferredTreatments.includes("SPREAD"), "High-quality landscape suggests SPREAD");
    assert(profileLandscape.preferredTreatments.includes("FULL_BLEED"), "High-quality landscape suggests FULL_BLEED");
    assert(profileLandscape.preferredTreatments.includes("HERO"), "High-quality landscape suggests HERO");
    assert(profileLandscape.visualWeight > 0.7, "Subject & quality contribute to substantial visualWeight");

    const batch = buildPhotoLayoutProfiles([
      { assetId: "p1", asset: { width: 1000, height: 1500 } },
      { assetId: "p2", asset: { width: 1500, height: 1000 } },
    ]);
    assert(batch.get("p1")?.orientation === "PORTRAIT", "Batch profiler classifies p1 as portrait");
    assert(batch.get("p2")?.orientation === "LANDSCAPE", "Batch profiler classifies p2 as landscape");
  }

  // ============================================================================
  // SECTION C: Book Color Themes & Typography Systems
  // ============================================================================
  console.log("\nSection C: Color Themes & Approved Typography Systems");
  {
    const themes = listThemes();
    assert(themes.length >= 6, `At least 6 color themes implemented (found ${themes.length})`);

    const expectedThemeIds = [
      "WARM_EDITORIAL",
      "SOFT_SAND",
      "MONOCHROME",
      "FOREST",
      "DUSTY_ROSE",
      "MIDNIGHT_CINEMATIC",
    ];

    for (const tid of expectedThemeIds) {
      const thm = BOOK_THEMES[tid];
      assert(thm !== undefined, `Theme ${tid} exists in registry`);
      assert(thm.background.startsWith("#"), `${tid} background has valid hex`);
      assert(thm.primaryText.startsWith("#"), `${tid} primaryText has valid hex`);
      assert(thm.secondaryText.startsWith("#"), `${tid} secondaryText has valid hex`);
      assert(thm.accent.startsWith("#"), `${tid} accent has valid hex`);
    }

    const typographySystems = listTypographySystems();
    assert(typographySystems.length >= 6, `At least 6 typography systems implemented (found ${typographySystems.length})`);

    const expectedTypoIds = [
      "EDITORIAL_SERIF",
      "MODERN_SANS",
      "LUXURY_SERIF",
      "CINEMATIC",
      "ROMANTIC",
      "JOURNAL",
    ];

    for (const tyId of expectedTypoIds) {
      const typo = TYPOGRAPHY_SYSTEMS[tyId];
      assert(typo !== undefined, `Typography system ${tyId} exists`);
      // Verify all font families are "Inter" and weights are 400 or 700 (strict registry compliance)
      assert(typo.display.fontFamily === "Inter", `${tyId} display uses approved Inter font`);
      assert([400, 700].includes(typo.display.fontWeight), `${tyId} display uses approved weight 400 or 700`);
      assert(typo.headline.fontFamily === "Inter", `${tyId} headline uses approved Inter font`);
      assert(typo.body.fontFamily === "Inter", `${tyId} body uses approved Inter font`);
      assert([400, 700].includes(typo.body.fontWeight), `${tyId} body uses approved weight 400 or 700`);
    }

    // Typographic roles test
    const roles: TypographicRole[] = [
      "COVER_TITLE",
      "COVER_SUBTITLE",
      "CHAPTER_NUMBER",
      "CHAPTER_TITLE",
      "SECTION_TITLE",
      "EDITORIAL_HEADLINE",
      "SUBHEAD",
      "BODY",
      "CAPTION",
      "LOCATION",
      "DATE",
      "QUOTE",
      "PAGE_NUMBER",
      "SMALL_LABEL",
    ];

    for (const r of roles) {
      const style = resolveRoleStyle(r, EDITORIAL_SERIF, WARM_EDITORIAL);
      assert(style.fontFamily === "Inter", `Role ${r} resolves to Inter`);
      assert(style.fontSizePt > 0, `Role ${r} has positive fontSizePt`);
      assert(style.color.startsWith("#"), `Role ${r} resolves to valid color`);
    }
  }

  // ============================================================================
  // SECTION D: 38 Composition Templates & Geometry Integrity
  // ============================================================================
  console.log("\nSection D: 38 Composition Templates Compilation & Geometry");
  {
    assert(ALL_TEMPLATES.length >= 30, `At least 30 templates implemented (total: ${ALL_TEMPLATES.length})`);

    const families = [
      "HERO",
      "PORTRAIT",
      "LANDSCAPE",
      "GRID",
      "MAGAZINE",
      "MINIMAL",
      "JOURNAL",
      "SPREAD",
    ] as const;

    for (const fam of families) {
      const list = listTemplatesByFamily(fam);
      assert(list.length >= 3, `Template family ${fam} has at least 3 templates (found ${list.length})`);
    }

    const doc = createDocument("A4");
    const bounds = getPageBounds(doc);
    const mockPhotos = generateMockProfiles(4, "MIXED");

    // Test compiling every single template individually
    for (const tpl of ALL_TEMPLATES) {
      const neededCount = Math.max(tpl.minPhotos, 1);
      const testPhotos = mockPhotos.slice(0, neededCount);

      const compiled = tpl.compile({
        pageNumber: 3,
        pageId: `test_${tpl.id}`,
        document: doc,
        photos: testPhotos,
        theme: WARM_EDITORIAL,
        typography: EDITORIAL_SERIF,
        editorial: {
          headline: "Test Headline",
          bodyText: "Test body text with narrative description.",
          quote: "A timeless memory.",
          caption: "Plate 01 photograph.",
        },
      });

      assert(compiled.pages.length >= 1, `Template ${tpl.id} compiled at least 1 page`);

      for (const p of compiled.pages) {
        assert(p.elements.length > 0, `Page in ${tpl.id} has elements`);

        for (const el of p.elements) {
          assert(el.widthMm > 0 && el.heightMm > 0, `Element in ${tpl.id} has positive dimensions: ${el.widthMm}x${el.heightMm}`);
          assert(Number.isFinite(el.xMm) && Number.isFinite(el.yMm), `Element in ${tpl.id} has finite coordinates`);

          if (el.type === "text") {
            // Strict safe area check (with 0.1mm float tolerance)
            const fitsSafeX = el.xMm >= bounds.minSafeX - 0.1 && el.xMm + el.widthMm <= bounds.maxSafeX + 0.1;
            const fitsSafeY = el.yMm >= bounds.minSafeY - 0.1 && el.yMm + el.heightMm <= bounds.maxSafeY + 0.1;
            assert(fitsSafeX && fitsSafeY, `Text in ${tpl.id} stays strictly inside safe area bounds`);
            assert(el.fontFamily === "Inter", `Text in ${tpl.id} uses approved Inter font`);
          }
        }
      }
    }
  }

  // ============================================================================
  // SECTION E: Template Compatibility Scoring & Repetition Penalties
  // ============================================================================
  console.log("\nSection E: Template Compatibility Scoring & Repetition Penalties");
  {
    const portraitPhotos = generateMockProfiles(2, "PORTRAIT");
    const landscapePhotos = generateMockProfiles(1, "LANDSCAPE");

    const twoPortraitsTpl = getTemplateById("TWO_PORTRAITS")!;
    const heroLandscapeTpl = getTemplateById("HERO_LANDSCAPE")!;

    // 2 portraits should score high on TWO_PORTRAITS
    const scorePortraitMatch = scoreTemplate({
      template: twoPortraitsTpl,
      photos: portraitPhotos,
    });
    assert(scorePortraitMatch.score > 50, `TWO_PORTRAITS scores high for 2 portrait photos (${scorePortraitMatch.score})`);

    // 1 landscape should score high on HERO_LANDSCAPE
    const scoreLandscapeMatch = scoreTemplate({
      template: heroLandscapeTpl,
      photos: landscapePhotos,
    });
    assert(scoreLandscapeMatch.score > 50, `HERO_LANDSCAPE scores high for landscape photo (${scoreLandscapeMatch.score})`);

    // Repetition penalty test: using the same template recently
    const scoreWithRepetition = scoreTemplate({
      template: heroLandscapeTpl,
      photos: landscapePhotos,
      history: {
        recentTemplateIds: ["HERO_LANDSCAPE"],
      },
    });

    assert(
      scoreWithRepetition.reasons.repetitionPenalty > 0,
      `Repetition penalty applied when template used in previous page (${scoreWithRepetition.reasons.repetitionPenalty})`,
    );
    assert(
      scoreWithRepetition.score < scoreLandscapeMatch.score,
      "Repetition reduces the final template score",
    );

    // Consecutive repetition rejection test (used twice in a row)
    const scoreConsecutive = scoreTemplate({
      template: heroLandscapeTpl,
      photos: landscapePhotos,
      history: {
        recentTemplateIds: ["HERO_LANDSCAPE", "HERO_LANDSCAPE"],
      },
    });
    assert(scoreConsecutive.reasons.repetitionPenalty >= 80, "Heavy rejection penalty for 3 consecutive uses of same template");
  }

  // ============================================================================
  // SECTION F: Cover & Chapter Opener Systems
  // ============================================================================
  console.log("\nSection F: Cover & Chapter Opener Systems");
  {
    const doc = createDocument("A4");
    const photo = generateMockProfiles(1, "LANDSCAPE")[0];

    const coverIds = [
      "COVER_EDITORIAL",
      "COVER_MINIMAL",
      "COVER_CINEMATIC",
      "COVER_MAGAZINE",
      "COVER_JOURNAL",
    ] as const;

    for (const cid of coverIds) {
      const cover = compileCover({
        pageId: `cov_${cid}`,
        document: doc,
        photo,
        title: "The Solitary Traveler",
        subtitle: "Autumn in the Highlands",
        theme: WARM_EDITORIAL,
        typography: EDITORIAL_SERIF,
        templateId: cid,
      });

      assert(cover.pageNumber === 1, `Cover ${cid} has pageNumber 1`);
      assert(cover.elements.length >= 3, `Cover ${cid} has intentional photo + title + subtitle hierarchy`);
      assert(cover.elements.some((el) => el.type === "image"), `Cover ${cid} contains photo element`);
      assert(cover.elements.some((el) => el.type === "text"), `Cover ${cid} contains typographic title`);
    }

    const chapterIds = [
      "CHAPTER_HERO",
      "CHAPTER_MINIMAL",
      "CHAPTER_SPLIT",
      "CHAPTER_CINEMATIC",
      "CHAPTER_EDITORIAL",
    ] as const;

    for (const chId of chapterIds) {
      const chPage = compileChapterOpener({
        pageId: `ch_${chId}`,
        pageNumber: 2,
        document: doc,
        photo,
        chapterNumber: 1,
        chapterTitle: "First Footsteps",
        introduction: "We began before the morning sun broke the ridge.",
        theme: WARM_EDITORIAL,
        typography: EDITORIAL_SERIF,
        templateId: chId,
      });

      assert(chPage.pageNumber === 2, `Chapter ${chId} has pageNumber 2`);
      assert(chPage.elements.some((el) => el.type === "text" && (el as TextElement).text.includes("01")), `Chapter ${chId} has chapter numeral 01`);
      assert(chPage.elements.some((el) => el.type === "text" && (el as TextElement).text.toLowerCase().includes("first footsteps")), `Chapter ${chId} has chapter title`);
    }
  }

  // ============================================================================
  // SECTION G: Deterministic Geometry Compiler & Schema v1.0.0 Integrity
  // ============================================================================
  console.log("\nSection G: Deterministic Geometry Compiler & Schema Integrity");
  {
    const photos = generateMockProfiles(10, "MIXED");
    const authoritativePhotoIds = new Set(photos.map((p) => p.assetId));

    const design = compileBookDesign({
      bookId: "bk_test_compile",
      size: "A4",
      title: "Passage of Light",
      themeId: "WARM_EDITORIAL",
      typographyId: "EDITORIAL_SERIF",
      photos,
      editorialPlan: {
        schemaVersion: "1.0.0",
        bookId: "bk_test_compile",
        title: "Passage of Light",
        subtitle: "A Himalayan Journey",
        narrativeSummary: "A chronicle of remote Himalayan valleys and mountain passes.",
        chapters: [
          {
            id: "ch_1",
            title: "The High Pass",
            summary: "Crossing the ridge as early snow began to fall.",
            photoIds: photos.slice(0, 5).map((p) => p.assetId),
            order: 1,
          },
        ],
        photoSequence: photos.map((p, i) => ({
          photoId: p.assetId,
          sequence: i + 1,
          chapterId: "ch_1",
          role: "MOMENT",
          importance: 8,
        })),
        coverCandidateIds: [photos[0].assetId],
        pacing: {
          opening: "SLOW",
          middle: "MODERATE",
          ending: "QUIET",
          rhythm: "BALANCED",
        },
        captions: [],
        editorialNotes: [],
        confidence: {
          overall: 0.9,
          narrative: 0.9,
          grouping: 0.9,
          pacing: 0.9,
          captions: 0.9,
        },
      },
    });

    assert(design.schemaVersion === DESIGN_SCHEMA_VERSION, `Schema version is strictly ${DESIGN_SCHEMA_VERSION}`);
    assert(design.pages.length >= 6, `Compiler generated ${design.pages.length} pages`);

    // Verify contiguous 1..N page numbering
    for (let i = 0; i < design.pages.length; i++) {
      assert(design.pages[i].pageNumber === i + 1, `Page index ${i} has contiguous pageNumber ${i + 1}`);
    }

    // Verify strict Part 7 validateDesignIntegrity
    let integrityPassed = false;
    try {
      validateDesignIntegrity(design, authoritativePhotoIds);
      integrityPassed = true;
    } catch (err) {
      console.error("Design integrity error:", err);
    }
    assert(integrityPassed, "Compiled BookDesign passes Part 7 validateDesignIntegrity 100%");

    // Verify strict Part 2 validatePrintEngineDesign
    const printValidation = validatePrintEngineDesign(design);
    assert(printValidation.valid && printValidation.errors.length === 0, `Compiled BookDesign passes Part 2 Print Engine validation (errors: ${printValidation.errors.length})`);
  }

  // ============================================================================
  // SECTION H: Book-Wide Theme Switching & Page-Level Layout Change
  // ============================================================================
  console.log("\nSection H: Theme Switching & Page-Level Layout Change");
  {
    const photos = generateMockProfiles(6, "MIXED");
    const authoritativePhotoIds = new Set(photos.map((p) => p.assetId));

    const initialDesign = compileBookDesign({
      bookId: "bk_theme_test",
      title: "Alpine Trails",
      themeId: "WARM_EDITORIAL",
      typographyId: "EDITORIAL_SERIF",
      photos,
    });

    // 1. Switch to MIDNIGHT_CINEMATIC theme
    const darkDesign = recompileBookTheme(initialDesign, "MIDNIGHT_CINEMATIC", "CINEMATIC");
    assert(darkDesign.pages.length === initialDesign.pages.length, "Theme switch preserves page count");

    // Verify that primary text colors were updated to the cinematic palette
    const pageText = darkDesign.pages[0].elements.find((e): e is TextElement => e.type === "text");
    assert(pageText !== undefined, "Text element exists on page 1");
    assert(pageText?.color === MIDNIGHT_CINEMATIC.primaryText || pageText?.color === "#FFFFFF", "Theme switch updated text color to theme palette");

    // 2. Page-Level Layout Change (Change page 3 to MAGAZINE_FEATURE)
    const targetPageId = initialDesign.pages[2].id;
    const modifiedDesign = changePageLayout(
      initialDesign,
      targetPageId,
      "MAGAZINE_FEATURE",
      photos,
    );

    const changedPage = modifiedDesign.pages.find((p) => p.id === targetPageId);
    assert(changedPage !== undefined, "Changed page exists in design");
    assert(Boolean(changedPage?.elements.some((e) => e.type === "image")), "Photo assets retained on changed page");

    let changeIntegrity = false;
    try {
      validateDesignIntegrity(modifiedDesign, authoritativePhotoIds);
      changeIntegrity = true;
    } catch (err) {
      console.error("Change layout integrity error:", err);
    }
    assert(changeIntegrity, "Design with changed page layout passes validateDesignIntegrity");
  }

  // ============================================================================
  // SECTION I: Visual Regression on 10, 20, 30 Photos Across 4 Styles
  // ============================================================================
  console.log("\nSection I: Visual Regression Across Photos & Styles");
  {
    const styles = [
      { style: "EDITORIAL", theme: "WARM_EDITORIAL", typo: "EDITORIAL_SERIF", cover: "COVER_EDITORIAL", chapter: "CHAPTER_EDITORIAL" },
      { style: "CINEMATIC", theme: "MIDNIGHT_CINEMATIC", typo: "CINEMATIC", cover: "COVER_CINEMATIC", chapter: "CHAPTER_CINEMATIC" },
      { style: "MINIMAL", theme: "MONOCHROME", typo: "MODERN_SANS", cover: "COVER_MINIMAL", chapter: "CHAPTER_MINIMAL" },
      { style: "JOURNAL", theme: "FOREST", typo: "JOURNAL", cover: "COVER_JOURNAL", chapter: "CHAPTER_HERO" },
    ] as const;

    const photoCounts = [10, 20, 30];

    for (const pc of photoCounts) {
      for (const st of styles) {
        const photos = generateMockProfiles(pc, "MIXED");
        const authIds = new Set(photos.map((p) => p.assetId));

        const book = compileBookDesign({
          bookId: `bk_vr_${st.style.toLowerCase()}_${pc}`,
          title: `Monograph ${st.style} ${pc}`,
          themeId: st.theme,
          typographyId: st.typo,
          coverTemplateId: st.cover,
          chapterTemplateId: st.chapter,
          photos,
        });

        assert(book.pages.length > 4, `${st.style} with ${pc} photos generated ${book.pages.length} pages`);

        // Check cover on page 1
        assert(book.pages[0].elements.length >= 3, `${st.style} has intentional cover on page 1`);
        // Check chapter on page 2
        assert(book.pages[1].elements.some((e) => e.type === "text" && (e as TextElement).text.includes("01")), `${st.style} has chapter opener on page 2`);
        // Check closing page on last page
        const lastPage = book.pages[book.pages.length - 1];
        assert(lastPage.elements.some((e) => e.type === "text" && (e as TextElement).text.includes("COLOPHON")), `${st.style} has colophon closing page`);

        // Verify Print Engine validation
        const printRes = validatePrintEngineDesign(book);
        assert(printRes.valid && printRes.errors.length === 0, `${st.style} with ${pc} photos passes Print Engine validation cleanly`);
        assert(typeof validateDesignIntegrity(book, authIds) === "undefined", `${st.style} with ${pc} photos passes validateDesignIntegrity`);
      }
    }
  }

  // ============================================================================
  // SECTION J: Part 2 Print Engine & PDF Export End-to-End Regression
  // ============================================================================
  console.log("\nSection J: Part 2 Print Engine & PDF Export Regression");
  {
    const photos = generateMockProfiles(6, "MIXED");
    const assetsMap = new Map<string, RenderAsset>();
    for (const p of photos) {
      assetsMap.set(p.assetId, createMockAsset(p.assetId));
    }

    const testBook = compileBookDesign({
      bookId: "bk_pdf_regression",
      title: "Print Engine Kept Intact",
      themeId: "WARM_EDITORIAL",
      typographyId: "EDITORIAL_SERIF",
      coverTemplateId: "COVER_EDITORIAL",
      chapterTemplateId: "CHAPTER_EDITORIAL",
      photos,
    });

    // Render using Part 2 production PDF renderDocument
    const renderRes = await renderDocument(testBook, assetsMap);
    const pdfBytes = renderRes.pdfBytes;
    assert(pdfBytes instanceof Uint8Array, "Part 2 renderDocument returns Uint8Array");
    assert(pdfBytes.length > 5000, `Generated PDF has substantial byte size: ${pdfBytes.length} bytes`);

    // Verify PDF header magic bytes %PDF-
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("utf8");
    assert(header.startsWith("%PDF"), `PDF magic bytes valid (%PDF): ${header}`);
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n================================================================================");
  console.log(`TOTAL DESIGN SYSTEM TESTS: ${passedCount + failedCount}`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${failedCount}`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed with fatal error:", err);
  process.exit(1);
});
