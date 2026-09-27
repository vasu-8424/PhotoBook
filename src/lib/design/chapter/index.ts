import type { BookDocument, BookPage, DesignElement } from "@/types/design";
import type {
  BookTheme,
  PhotoLayoutProfile,
  TypographySystem,
} from "../types";
import {
  createBookPage,
  createImageElement,
  createTextElement,
  getPageBounds,
  roundMm,
} from "../templates/helpers";

export type ChapterTemplateId =
  | "CHAPTER_HERO"
  | "CHAPTER_MINIMAL"
  | "CHAPTER_SPLIT"
  | "CHAPTER_CINEMATIC"
  | "CHAPTER_EDITORIAL";

export interface ChapterCompileContext {
  pageId: string;
  pageNumber: number;
  document: BookDocument;
  photo?: PhotoLayoutProfile;
  chapterNumber: number;
  chapterTitle: string;
  location?: string;
  date?: string;
  introduction?: string;
  theme: BookTheme;
  typography: TypographySystem;
  templateId?: ChapterTemplateId;
}

export function compileChapterOpener(ctx: ChapterCompileContext): BookPage {
  const bounds = getPageBounds(ctx.document);
  const templateId: ChapterTemplateId = ctx.templateId || "CHAPTER_EDITORIAL";
  const numStr = ctx.chapterNumber < 10 ? `0${ctx.chapterNumber}` : `${ctx.chapterNumber}`;
  const assetId = ctx.photo?.assetId || "chapter_fallback_photo";

  switch (templateId) {
    case "CHAPTER_MINIMAL": {
      // Large bold numeral, minimal title, generous negative space
      const photoW = roundMm(bounds.safeWidthMm * 0.45);
      const photoH = roundMm(bounds.safeHeightMm * 0.45);
      const photoX = bounds.maxSafeX - photoW;
      const photoY = bounds.maxSafeY - photoH;

      const elements: DesignElement[] = [
        createTextElement({
          id: `el_${ctx.pageId}_num`,
          text: numStr,
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 15,
          widthMm: 40,
          heightMm: 24,
          role: "CHAPTER_NUMBER",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_title`,
          text: ctx.chapterTitle.toUpperCase(),
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 45,
          widthMm: bounds.safeWidthMm,
          heightMm: 20,
          role: "CHAPTER_TITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_intro`,
          text:
            ctx.introduction ||
            "Every journey finds its quiet rhythm in the spaces between arrival and departure.",
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 70,
          widthMm: roundMm(bounds.safeWidthMm * 0.48),
          heightMm: 45,
          role: "BODY",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
      ];

      if (ctx.photo) {
        elements.push(
          createImageElement({
            id: `el_${ctx.pageId}_img_0`,
            assetId,
            xMm: photoX,
            yMm: photoY,
            widthMm: photoW,
            heightMm: photoH,
            fit: "COVER",
            focalPoint: ctx.photo.focalPoint,
          }),
        );
      }

      return createBookPage({
        id: ctx.pageId,
        pageNumber: ctx.pageNumber,
        layoutType: "PHOTO_TEXT",
        elements,
      });
    }

    case "CHAPTER_SPLIT": {
      // Split layout: vertical portrait left, narrative right
      const gutter = 10;
      const photoW = roundMm(bounds.safeWidthMm * 0.48);
      const textW = roundMm(bounds.safeWidthMm - photoW - gutter);
      const photoH = roundMm(bounds.safeHeightMm * 0.82);
      const startY = bounds.minSafeY + 10;

      const elements = [
        createImageElement({
          id: `el_${ctx.pageId}_img_0`,
          assetId,
          xMm: bounds.minSafeX,
          yMm: startY,
          widthMm: photoW,
          heightMm: photoH,
          fit: "COVER",
          focalPoint: ctx.photo?.focalPoint,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_num`,
          text: numStr,
          xMm: bounds.minSafeX + photoW + gutter,
          yMm: startY + 5,
          widthMm: textW,
          heightMm: 20,
          role: "CHAPTER_NUMBER",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_title`,
          text: ctx.chapterTitle.toUpperCase(),
          xMm: bounds.minSafeX + photoW + gutter,
          yMm: startY + 30,
          widthMm: textW,
          heightMm: 22,
          role: "CHAPTER_TITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_meta`,
          text: [ctx.location, ctx.date].filter(Boolean).join(" · ") || "FIELD OBSERVATIONS",
          xMm: bounds.minSafeX + photoW + gutter,
          yMm: startY + 56,
          widthMm: textW,
          heightMm: 8,
          role: "SMALL_LABEL",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_intro`,
          text:
            ctx.introduction ||
            "The morning began with stillness. We set out before the rest of the world was awake, following trails carved long before memory.",
          xMm: bounds.minSafeX + photoW + gutter,
          yMm: startY + 70,
          widthMm: textW,
          heightMm: 50,
          role: "BODY",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
      ];

      return createBookPage({
        id: ctx.pageId,
        pageNumber: ctx.pageNumber,
        layoutType: "PHOTO_TEXT",
        elements,
      });
    }

    case "CHAPTER_CINEMATIC": {
      // Widescreen panoramic visual across top, bold title band below
      const imgH = roundMm(bounds.safeHeightMm * 0.55);
      const imgY = bounds.minSafeY + 5;

      const elements = [
        createImageElement({
          id: `el_${ctx.pageId}_img_0`,
          assetId,
          xMm: bounds.minSafeX,
          yMm: imgY,
          widthMm: bounds.safeWidthMm,
          heightMm: imgH,
          fit: "COVER",
          focalPoint: ctx.photo?.focalPoint,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_num`,
          text: `CHAPTER ${numStr}`,
          xMm: bounds.minSafeX,
          yMm: imgY + imgH + 12,
          widthMm: bounds.safeWidthMm,
          heightMm: 8,
          role: "SMALL_LABEL",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_title`,
          text: ctx.chapterTitle.toUpperCase(),
          xMm: bounds.minSafeX,
          yMm: imgY + imgH + 22,
          widthMm: bounds.safeWidthMm,
          heightMm: 16,
          role: "CHAPTER_TITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_intro`,
          text:
            ctx.introduction ||
            "Cinematic moments unfold when light touches the earth at just the right angle.",
          xMm: bounds.minSafeX,
          yMm: imgY + imgH + 42,
          widthMm: roundMm(bounds.safeWidthMm * 0.85),
          heightMm: 22,
          role: "BODY",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
      ];

      return createBookPage({
        id: ctx.pageId,
        pageNumber: ctx.pageNumber,
        layoutType: "HERO",
        elements,
      });
    }

    case "CHAPTER_HERO": {
      // Upper focal photo plate with chapter block below
      const imgH = roundMm(bounds.safeHeightMm * 0.52);
      const imgY = bounds.minSafeY + 5;

      const elements = [
        createImageElement({
          id: `el_${ctx.pageId}_img_0`,
          assetId,
          xMm: bounds.minSafeX,
          yMm: imgY,
          widthMm: bounds.safeWidthMm,
          heightMm: imgH,
          fit: "COVER",
          focalPoint: ctx.photo?.focalPoint,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_num`,
          text: numStr,
          xMm: bounds.minSafeX,
          yMm: imgY + imgH + 10,
          widthMm: 35,
          heightMm: 18,
          role: "CHAPTER_NUMBER",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_title`,
          text: ctx.chapterTitle,
          xMm: bounds.minSafeX + 40,
          yMm: imgY + imgH + 10,
          widthMm: roundMm(bounds.safeWidthMm - 40),
          heightMm: 18,
          role: "CHAPTER_TITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_intro`,
          text:
            ctx.introduction ||
            "Every turn in the trail brings a shift in perspective. Here the journey deepens.",
          xMm: bounds.minSafeX + 40,
          yMm: imgY + imgH + 32,
          widthMm: roundMm(bounds.safeWidthMm - 40),
          heightMm: 25,
          role: "BODY",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
      ];

      return createBookPage({
        id: ctx.pageId,
        pageNumber: ctx.pageNumber,
        layoutType: "HERO",
        elements,
      });
    }

    case "CHAPTER_EDITORIAL":
    default: {
      // Classic Warm Editorial Chapter Opener: numeral, title, location, introductory paragraph, bottom photo
      const textH = 75;
      const imgY = bounds.minSafeY + textH + 10;
      const imgH = roundMm(bounds.safeHeightMm - textH - 20);

      const elements = [
        createTextElement({
          id: `el_${ctx.pageId}_num`,
          text: numStr,
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 5,
          widthMm: 35,
          heightMm: 18,
          role: "CHAPTER_NUMBER",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_title`,
          text: ctx.chapterTitle.toUpperCase(),
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 26,
          widthMm: bounds.safeWidthMm,
          heightMm: 16,
          role: "CHAPTER_TITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_meta`,
          text: [ctx.location, ctx.date].filter(Boolean).join(" · ") || "JOURNAL EXCERPT",
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 45,
          widthMm: bounds.safeWidthMm,
          heightMm: 6,
          role: "SMALL_LABEL",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_intro`,
          text:
            ctx.introduction ||
            "The journey began in earnest here. Notes taken on the move, moments etched before the shadows lengthened.",
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 54,
          widthMm: roundMm(bounds.safeWidthMm * 0.9),
          heightMm: 20,
          role: "BODY",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createImageElement({
          id: `el_${ctx.pageId}_img_0`,
          assetId,
          xMm: bounds.minSafeX,
          yMm: imgY,
          widthMm: bounds.safeWidthMm,
          heightMm: imgH,
          fit: "COVER",
          focalPoint: ctx.photo?.focalPoint,
        }),
      ];

      return createBookPage({
        id: ctx.pageId,
        pageNumber: ctx.pageNumber,
        layoutType: "HERO",
        elements,
      });
    }
  }
}
