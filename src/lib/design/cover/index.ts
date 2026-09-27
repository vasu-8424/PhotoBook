import type { BookDocument, BookPage } from "@/types/design";
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

export type CoverTemplateId =
  | "COVER_EDITORIAL"
  | "COVER_MINIMAL"
  | "COVER_CINEMATIC"
  | "COVER_MAGAZINE"
  | "COVER_JOURNAL";

export interface CoverCompileContext {
  pageId: string;
  document: BookDocument;
  photo: PhotoLayoutProfile;
  title: string;
  subtitle?: string;
  theme: BookTheme;
  typography: TypographySystem;
  date?: string;
  location?: string;
  templateId?: CoverTemplateId;
}

export function compileCover(ctx: CoverCompileContext): BookPage {
  const bounds = getPageBounds(ctx.document);
  const templateId: CoverTemplateId = ctx.templateId || "COVER_EDITORIAL";
  const photo = ctx.photo;
  const assetId = photo.assetId;

  switch (templateId) {
    case "COVER_MINIMAL": {
      // Inset photo with delicate typography
      const imgW = roundMm(bounds.safeWidthMm * 0.72);
      const imgH = roundMm(bounds.safeHeightMm * 0.58);
      const imgX = bounds.minSafeX + (bounds.safeWidthMm - imgW) / 2;
      const imgY = bounds.minSafeY + 35;

      const elements = [
        createTextElement({
          id: `el_${ctx.pageId}_title`,
          text: ctx.title.toUpperCase(),
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 12,
          widthMm: bounds.safeWidthMm,
          heightMm: 16,
          role: "COVER_TITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
          bounds,
        }),
        createImageElement({
          id: `el_${ctx.pageId}_img_0`,
          assetId,
          xMm: imgX,
          yMm: imgY,
          widthMm: imgW,
          heightMm: imgH,
          fit: "COVER",
          focalPoint: photo.focalPoint,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_sub`,
          text: ctx.subtitle || [ctx.location, ctx.date].filter(Boolean).join(" · ") || "LIMITED EDITION",
          xMm: bounds.minSafeX,
          yMm: imgY + imgH + 16,
          widthMm: bounds.safeWidthMm,
          heightMm: 10,
          role: "COVER_SUBTITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
          bounds,
        }),
      ];

      return createBookPage({
        id: ctx.pageId,
        pageNumber: 1,
        layoutType: "HERO",
        elements,
      });
    }

    case "COVER_CINEMATIC": {
      // Full bleed visual with wide title
      const elements = [
        createImageElement({
          id: `el_${ctx.pageId}_img_0`,
          assetId,
          xMm: -bounds.bleedMm,
          yMm: -bounds.bleedMm,
          widthMm: bounds.widthMm + bounds.bleedMm * 2,
          heightMm: bounds.heightMm + bounds.bleedMm * 2,
          fit: "COVER",
          focalPoint: photo.focalPoint,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_meta_top`,
          text: ctx.location ? `A DOCUMENTARY CHRONICLE · ${ctx.location.toUpperCase()}` : "A VISUAL MEMOIR",
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 15,
          widthMm: bounds.safeWidthMm,
          heightMm: 8,
          role: "SMALL_LABEL",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
          overrideColor: "#FFFFFF",
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_title`,
          text: ctx.title.toUpperCase(),
          xMm: bounds.minSafeX,
          yMm: bounds.maxSafeY - 45,
          widthMm: bounds.safeWidthMm,
          heightMm: 22,
          role: "COVER_TITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
          overrideColor: "#FFFFFF",
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_sub`,
          text: ctx.subtitle || ctx.date || "ARCHIVAL MONOGRAPH",
          xMm: bounds.minSafeX,
          yMm: bounds.maxSafeY - 18,
          widthMm: bounds.safeWidthMm,
          heightMm: 10,
          role: "COVER_SUBTITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
          overrideColor: "#F3F4F6",
          bounds,
        }),
      ];

      return createBookPage({
        id: ctx.pageId,
        pageNumber: 1,
        layoutType: "FULL_BLEED",
        elements,
      });
    }

    case "COVER_MAGAZINE": {
      // Classic magazine format: bold top masthead + hero photo + teasers
      const imgH = roundMm(bounds.safeHeightMm * 0.72);
      const imgY = bounds.minSafeY + 28;

      const elements = [
        createTextElement({
          id: `el_${ctx.pageId}_masthead`,
          text: ctx.title.toUpperCase(),
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 4,
          widthMm: bounds.safeWidthMm,
          heightMm: 20,
          role: "COVER_TITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
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
          focalPoint: photo.focalPoint,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_footer_left`,
          text: ctx.subtitle || "SPECIAL PHOTO EDITION",
          xMm: bounds.minSafeX,
          yMm: imgY + imgH + 8,
          widthMm: roundMm(bounds.safeWidthMm * 0.6),
          heightMm: 8,
          role: "SMALL_LABEL",
          typography: ctx.typography,
          theme: ctx.theme,
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_footer_right`,
          text: ctx.date || "VOL. 01",
          xMm: bounds.minSafeX + roundMm(bounds.safeWidthMm * 0.6),
          yMm: imgY + imgH + 8,
          widthMm: roundMm(bounds.safeWidthMm * 0.4),
          heightMm: 8,
          role: "SMALL_LABEL",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "right",
          bounds,
        }),
      ];

      return createBookPage({
        id: ctx.pageId,
        pageNumber: 1,
        layoutType: "HERO",
        elements,
      });
    }

    case "COVER_JOURNAL": {
      // Explorer field notes cover
      const imgW = roundMm(bounds.safeWidthMm * 0.84);
      const imgH = roundMm(bounds.safeHeightMm * 0.58);
      const imgX = bounds.minSafeX + (bounds.safeWidthMm - imgW) / 2;
      const imgY = bounds.minSafeY + 45;

      const elements = [
        createTextElement({
          id: `el_${ctx.pageId}_journal_tag`,
          text: [ctx.location, ctx.date].filter(Boolean).join(" · ") || "EXPEDITION LOGBOOK",
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 10,
          widthMm: bounds.safeWidthMm,
          heightMm: 8,
          role: "SMALL_LABEL",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_title`,
          text: ctx.title,
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 22,
          widthMm: bounds.safeWidthMm,
          heightMm: 18,
          role: "COVER_TITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
          bounds,
        }),
        createImageElement({
          id: `el_${ctx.pageId}_img_0`,
          assetId,
          xMm: imgX,
          yMm: imgY,
          widthMm: imgW,
          heightMm: imgH,
          fit: "COVER",
          focalPoint: photo.focalPoint,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_sub`,
          text: ctx.subtitle || "A collection of personal observations, memories, and light.",
          xMm: bounds.minSafeX + 10,
          yMm: imgY + imgH + 12,
          widthMm: bounds.safeWidthMm - 20,
          heightMm: 12,
          role: "BODY",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
          bounds,
        }),
      ];

      return createBookPage({
        id: ctx.pageId,
        pageNumber: 1,
        layoutType: "HERO",
        elements,
      });
    }

    case "COVER_EDITORIAL":
    default: {
      // Classic Warm Editorial Cover
      const imgW = roundMm(bounds.safeWidthMm * 0.88);
      const imgH = roundMm(bounds.safeHeightMm * 0.62);
      const imgX = bounds.minSafeX + (bounds.safeWidthMm - imgW) / 2;
      const imgY = bounds.minSafeY + 38;

      const elements = [
        createTextElement({
          id: `el_${ctx.pageId}_kicker`,
          text: "MEMORY MAGAZINE",
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 8,
          widthMm: bounds.safeWidthMm,
          heightMm: 6,
          role: "SMALL_LABEL",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
          bounds,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_title`,
          text: ctx.title,
          xMm: bounds.minSafeX,
          yMm: bounds.minSafeY + 16,
          widthMm: bounds.safeWidthMm,
          heightMm: 18,
          role: "COVER_TITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
          bounds,
        }),
        createImageElement({
          id: `el_${ctx.pageId}_img_0`,
          assetId,
          xMm: imgX,
          yMm: imgY,
          widthMm: imgW,
          heightMm: imgH,
          fit: "COVER",
          focalPoint: photo.focalPoint,
        }),
        createTextElement({
          id: `el_${ctx.pageId}_subtitle`,
          text: ctx.subtitle || [ctx.location, ctx.date].filter(Boolean).join(" · ") || "COLLECTED MOMENTS",
          xMm: bounds.minSafeX,
          yMm: imgY + imgH + 12,
          widthMm: bounds.safeWidthMm,
          heightMm: 10,
          role: "COVER_SUBTITLE",
          typography: ctx.typography,
          theme: ctx.theme,
          align: "center",
          bounds,
        }),
      ];

      return createBookPage({
        id: ctx.pageId,
        pageNumber: 1,
        layoutType: "HERO",
        elements,
      });
    }
  }
}
