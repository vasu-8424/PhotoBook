import {
  DESIGN_SCHEMA_VERSION,
  type BookDesign,
  type BookDocument,
  type BookPage,
  type BookSize,
  type BookSpread,
  type DesignElement,
  type ImageElement,
  type TextElement,
} from "@/types/design";
import { BOOK_SIZES, DEFAULT_PRINT_SETTINGS } from "@/config/book";
import type { EditorialPlan } from "@/lib/ai/editorial";
import type {
  BookTheme,
  PhotoLayoutProfile,
  TemplateCompileContext,
  TypographySystem,
  VisualDensity,
} from "../types";
import { getThemeById } from "../themes";
import { getTypographyById, resolveRoleStyle } from "../typography";
import {
  ALL_TEMPLATES,
  getCompatibleTemplates,
  getTemplateById,
} from "../templates";
import {
  createBookPage,
  createImageElement,
  createTextElement,
  getPageBounds,
  roundMm,
} from "../templates/helpers";
import { compileCover, type CoverTemplateId } from "../cover";
import { compileChapterOpener, type ChapterTemplateId } from "../chapter";
import { selectBestTemplate } from "../scoring";

export interface BookCompilationInput {
  bookId: string;
  size?: BookSize;
  title: string;
  subtitle?: string;
  themeId?: string;
  typographyId?: string;
  coverTemplateId?: CoverTemplateId;
  chapterTemplateId?: ChapterTemplateId;
  photos: PhotoLayoutProfile[];
  editorialPlan?: EditorialPlan;
  spreadPhotoIds?: string[];
}

/**
 * Creates the base canonical BookDocument for compilation.
 */
export function createDocument(size: BookSize = "A4"): BookDocument {
  const config = BOOK_SIZES[size] || BOOK_SIZES["A4"];

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    size,
    widthMm: config.dimensions.width,
    heightMm: config.dimensions.height,
    bleedMm: DEFAULT_PRINT_SETTINGS.bleedMm,
    safeAreaMm: DEFAULT_PRINT_SETTINGS.safeAreaMm,
    gutterMm: DEFAULT_PRINT_SETTINGS.gutterMm,
    dpi: DEFAULT_PRINT_SETTINGS.dpi,
    orientation: config.orientation,
  };
}

/**
 * Compiles a closing colophon page so the book terminates with an intentional editorial signature.
 */
function compileClosingPage(options: {
  pageId: string;
  pageNumber: number;
  document: BookDocument;
  theme: BookTheme;
  typography: TypographySystem;
  title: string;
  date?: string;
  location?: string;
  lastPhoto?: PhotoLayoutProfile;
}): BookPage {
  const bounds = getPageBounds(options.document);

  const imgW = roundMm(bounds.safeWidthMm * 0.7);
  const imgH = roundMm(bounds.safeHeightMm * 0.45);
  const imgX = bounds.minSafeX + (bounds.safeWidthMm - imgW) / 2;
  const imgY = bounds.minSafeY + 25;

  const elements: DesignElement[] = [];

  if (options.lastPhoto) {
    elements.push(
      createImageElement({
        id: `el_${options.pageId}_img_0`,
        assetId: options.lastPhoto.assetId,
        xMm: imgX,
        yMm: imgY,
        widthMm: imgW,
        heightMm: imgH,
        fit: "COVER",
        focalPoint: options.lastPhoto.focalPoint,
      }),
    );
  }

  const textY = options.lastPhoto ? imgY + imgH + 18 : bounds.minSafeY + 60;

  elements.push(
    createTextElement({
      id: `el_${options.pageId}_colophon_tag`,
      text: "COLOPHON & MEMORY ARCHIVE",
      xMm: bounds.minSafeX,
      yMm: textY,
      widthMm: bounds.safeWidthMm,
      heightMm: 8,
      role: "SMALL_LABEL",
      typography: options.typography,
      theme: options.theme,
      align: "center",
      bounds,
    }),
    createTextElement({
      id: `el_${options.pageId}_title`,
      text: options.title,
      xMm: bounds.minSafeX,
      yMm: textY + 10,
      widthMm: bounds.safeWidthMm,
      heightMm: 14,
      role: "EDITORIAL_HEADLINE",
      typography: options.typography,
      theme: options.theme,
      align: "center",
      bounds,
    }),
    createTextElement({
      id: `el_${options.pageId}_text`,
      text: "Designed with intentional craft, enduring typography, and timeless light. Published as a permanent keepsake.",
      xMm: bounds.minSafeX + roundMm(bounds.safeWidthMm * 0.1),
      yMm: textY + 28,
      widthMm: roundMm(bounds.safeWidthMm * 0.8),
      heightMm: 18,
      role: "BODY",
      typography: options.typography,
      theme: options.theme,
      align: "center",
      bounds,
    }),
    createTextElement({
      id: `el_${options.pageId}_date`,
      text: [options.location, options.date].filter(Boolean).join(" · ") || "ALL RIGHTS RESERVED",
      xMm: bounds.minSafeX,
      yMm: bounds.maxSafeY - 14,
      widthMm: bounds.safeWidthMm,
      heightMm: 8,
      role: "SMALL_LABEL",
      typography: options.typography,
      theme: options.theme,
      align: "center",
      bounds,
    }),
  );

  return createBookPage({
    id: options.pageId,
    pageNumber: options.pageNumber,
    layoutType: "HERO",
    elements,
  });
}

/**
 * Deterministically compiles a complete, publication-grade BookDesign v1.0.0
 * from PhotoLayoutProfiles, editorial plan, theme, and typography system.
 */
export function compileBookDesign(input: BookCompilationInput): BookDesign {
  const document = createDocument(input.size || "A4");
  const theme = getThemeById(input.themeId);
  const typography = getTypographyById(input.typographyId);

  const pages: BookPage[] = [];
  const spreads: BookSpread[] = [];

  const recentTemplateIds: string[] = [];
  const recentDensities: VisualDensity[] = [];

  const availablePhotos = [...input.photos];
  if (availablePhotos.length === 0) {
    // Return empty fallback document if no photos
    return {
      schemaVersion: DESIGN_SCHEMA_VERSION,
      document,
      pages: [],
      spreads: [],
    };
  }

  // 1. Compile Page 1: Cover
  const coverPhoto = availablePhotos[0];
  const coverPage = compileCover({
    pageId: `pg_${input.bookId}_1`,
    document,
    photo: coverPhoto,
    title: input.title || input.editorialPlan?.title || "Memory Magazine",
    subtitle: input.subtitle || input.editorialPlan?.subtitle,
    theme,
    typography,
    templateId: input.coverTemplateId,
  });
  pages.push(coverPage);
  recentTemplateIds.push(input.coverTemplateId || "COVER_EDITORIAL");
  recentDensities.push("LOW");

  // 2. Compile Page 2: Chapter Opener
  const chapterPhoto = availablePhotos.length > 1 ? availablePhotos[1] : coverPhoto;
  const chapterTitle =
    input.editorialPlan?.chapters?.[0]?.title || "The Road Begins";
  const chapterPage = compileChapterOpener({
    pageId: `pg_${input.bookId}_2`,
    pageNumber: 2,
    document,
    photo: chapterPhoto,
    chapterNumber: 1,
    chapterTitle,
    introduction:
      input.editorialPlan?.chapters?.[0]?.summary ||
      input.editorialPlan?.narrativeSummary ||
      "Every chapter begins with quiet observation.",
    theme,
    typography,
    templateId: input.chapterTemplateId,
  });
  pages.push(chapterPage);
  recentTemplateIds.push(input.chapterTemplateId || "CHAPTER_EDITORIAL");
  recentDensities.push("MEDIUM");

  // Photos for story pages: start from photo index 2 if available, else cycle
  let photoIndex = availablePhotos.length > 2 ? 2 : 0;
  let currentPageNumber = 3;

  // Compile middle story pages until photos exhausted or comfortable pagination
  while (photoIndex < availablePhotos.length) {
    const pageId = `pg_${input.bookId}_${currentPageNumber}`;
    const remainingPhotos = availablePhotos.length - photoIndex;

    // Check if this photo is a spread candidate (spreads must start on an even left page)
    const currentPhoto = availablePhotos[photoIndex];
    const isSpreadRequested =
      input.spreadPhotoIds?.includes(currentPhoto.assetId) ||
      (currentPhoto.preferredTreatments.includes("SPREAD") &&
        currentPhoto.qualityScore >= 0.85);

    // Left page must be even (2, 4, 6, 8, etc.) to start a spread across facing pages
    const isEvenPage = currentPageNumber % 2 === 0;

    if (isSpreadRequested && isEvenPage && remainingPhotos >= 1) {
      // Compile Spread
      const leftPageId = pageId;
      const rightPageId = `pg_${input.bookId}_${currentPageNumber + 1}`;

      const spreadTpl = getTemplateById("FULL_SPREAD") || ALL_TEMPLATES[0];
      const spreadRes = spreadTpl.compile({
        pageNumber: currentPageNumber,
        pageId: leftPageId,
        document,
        photos: [currentPhoto],
        theme,
        typography,
        spreadContext: { leftPageId, rightPageId },
        editorial: {
          caption: input.editorialPlan?.narrativeSummary,
        },
      });

      pages.push(...spreadRes.pages);
      if (spreadRes.spreads) {
        spreads.push(...spreadRes.spreads);
      }

      recentTemplateIds.push(spreadTpl.id, spreadTpl.id);
      recentDensities.push("LOW", "LOW");

      photoIndex += 1;
      currentPageNumber += 2;
      continue;
    }

    // Determine batch size (1, 2, 3, or 4 photos) based on density rhythm
    let batchSize = 1;
    const lastDensity = recentDensities[recentDensities.length - 1];

    if (lastDensity === "LOW" && remainingPhotos >= 2) {
      // Alternate from LOW to MEDIUM or HIGH
      batchSize = remainingPhotos >= 3 ? 3 : 2;
    } else if (lastDensity === "HIGH") {
      // Alternate from HIGH to LOW or MEDIUM
      batchSize = 1;
    } else {
      batchSize = remainingPhotos >= 2 ? 2 : 1;
    }

    // Slice photos for this page
    const pagePhotos = availablePhotos.slice(photoIndex, photoIndex + batchSize);

    // Filter compatible templates for this batch
    const compatible = getCompatibleTemplates(
      pagePhotos.length,
      pagePhotos.map((p) => p.orientation),
    );

    const pool = compatible.length > 0 ? compatible : ALL_TEMPLATES;

    const chosenTemplate = selectBestTemplate(pool, {
      photos: pagePhotos,
      editorial: {
        headline: input.editorialPlan?.chapters?.[0]?.title,
        bodyText: input.editorialPlan?.chapters?.[0]?.summary,
        caption: input.editorialPlan?.narrativeSummary,
      },
      history: {
        recentTemplateIds,
        recentDensities,
      },
    });

    const context: TemplateCompileContext = {
      pageNumber: currentPageNumber,
      pageId,
      document,
      photos: pagePhotos,
      theme,
      typography,
      editorial: {
        headline: input.editorialPlan?.chapters?.[0]?.title,
        bodyText: input.editorialPlan?.chapters?.[0]?.summary,
        caption: input.editorialPlan?.narrativeSummary,
      },
    };

    const compiled = chosenTemplate.compile(context);
    pages.push(...compiled.pages);
    if (compiled.spreads) {
      spreads.push(...compiled.spreads);
    }

    recentTemplateIds.push(chosenTemplate.id);
    recentDensities.push(chosenTemplate.visualDensity);

    photoIndex += pagePhotos.length;
    currentPageNumber += compiled.pages.length;
  }

  // 4. Compile Closing Page
  const closingPageId = `pg_${input.bookId}_${currentPageNumber}`;
  const closingPage = compileClosingPage({
    pageId: closingPageId,
    pageNumber: currentPageNumber,
    document,
    theme,
    typography,
    title: input.title || "Memory Magazine",
    lastPhoto: availablePhotos[availablePhotos.length - 1],
  });
  pages.push(closingPage);

  // Re-number pages 1..N contiguously to guarantee 100% integrity
  pages.forEach((p, idx) => {
    p.pageNumber = idx + 1;
  });

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    document,
    pages,
    spreads,
  };
}

/**
 * Recompiles a design with a new Color Theme and/or Typography System.
 * Deterministic: Does NOT call Vision AI or Editorial AI.
 * Preserves user-customized text and elements.
 */
export function recompileBookTheme(
  design: BookDesign,
  newThemeId: string,
  newTypographyId?: string,
): BookDesign {
  const theme = getThemeById(newThemeId);
  const typography = getTypographyById(newTypographyId || theme.typographySystem);

  const updatedPages = design.pages.map((page) => ({
    ...page,
    elements: page.elements.map((el) => {
      if (el.type === "text") {
        // If element is text, update font family/weight if Inter-based, and update colors
        const role = el.fontSizePt > 24 ? "COVER_TITLE" : el.fontSizePt > 16 ? "EDITORIAL_HEADLINE" : "BODY";
        const style = resolveRoleStyle(role, typography, theme);

        return {
          ...el,
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          color: style.color,
        };
      }
      return el;
    }),
  }));

  return {
    ...design,
    pages: updatedPages,
  };
}

/**
 * Changes the layout of a single page or spread to a new template.
 * Retains existing photos and text where compatible.
 */
export function changePageLayout(
  design: BookDesign,
  pageId: string,
  newTemplateId: string,
  photos: PhotoLayoutProfile[],
  themeId?: string,
  typographyId?: string,
): BookDesign {
  const targetPage = design.pages.find((p) => p.id === pageId);
  if (!targetPage) return design;

  const template = getTemplateById(newTemplateId);
  if (!template) return design;

  const theme = getThemeById(themeId);
  const typography = getTypographyById(typographyId);

  // Extract photos currently on this page
  const pageImageAssets = targetPage.elements
    .filter((el): el is ImageElement => el.type === "image")
    .map((el) => el.assetId);

  const matchedPhotos = pageImageAssets
    .map((aid) => photos.find((p) => p.assetId === aid))
    .filter(Boolean) as PhotoLayoutProfile[];

  const finalPhotos =
    matchedPhotos.length > 0 ? matchedPhotos : photos.slice(0, template.maxPhotos);

  // Extract existing text content
  const existingHeadline = targetPage.elements.find(
    (el): el is TextElement => el.type === "text" && el.fontSizePt > 18,
  );
  const existingBody = targetPage.elements.find(
    (el): el is TextElement => el.type === "text" && el.fontSizePt <= 18,
  );

  const compileCtx: TemplateCompileContext = {
    pageNumber: targetPage.pageNumber,
    pageId: targetPage.id,
    document: design.document,
    photos: finalPhotos,
    theme,
    typography,
    editorial: {
      headline: existingHeadline?.text,
      bodyText: existingBody?.text,
    },
  };

  const compiled = template.compile(compileCtx);
  const replacementPage = compiled.pages[0];

  return {
    ...design,
    pages: design.pages.map((p) => (p.id === pageId ? replacementPage : p)),
  };
}
