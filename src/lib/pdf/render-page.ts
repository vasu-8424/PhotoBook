import { type PDFDocument, type PDFPage } from "pdf-lib";
import type { BookDesign, BookPage } from "@/types/design";
import { mmToPt } from "./units";
import { renderImage } from "./render-image";
import { renderShape } from "./render-shape";
import { renderText } from "./render-text";
import { getOrEmbedFont } from "./fonts";
import { PrintEngineError } from "./errors";
import type { RenderAsset } from "./types";

export function createPdfPage(
  pdfDoc: PDFDocument,
  design: BookDesign,
): PDFPage {
  const widthPt = mmToPt(design.document.widthMm);
  const heightPt = mmToPt(design.document.heightMm);

  if (widthPt <= 0 || heightPt <= 0) {
    throw new PrintEngineError(
      `Invalid page dimensions: ${design.document.widthMm}x${design.document.heightMm} mm`,
      "INVALID_PAGE_SIZE",
    );
  }

  return pdfDoc.addPage([widthPt, heightPt]);
}

export async function renderPageElements(
  pdfDoc: PDFDocument,
  page: PDFPage,
  pageData: BookPage,
  pageHeightPt: number,
  assets: Map<string, RenderAsset>,
): Promise<void> {
  for (const element of pageData.elements) {
    switch (element.type) {
      case "image":
        await renderImage(pdfDoc, page, element, pageHeightPt, assets);
        break;

      case "shape":
        renderShape(page, element, pageHeightPt);
        break;

      case "text": {
        const font = await getOrEmbedFont(
          pdfDoc,
          element.fontFamily,
          element.fontWeight,
        );
        renderText(page, font, element, pageHeightPt);
        break;
      }

      default:
        throw new PrintEngineError(
          `Unknown element type: ${(element as unknown as { type: string }).type}`,
          "INVALID_ELEMENT",
          { elementId: (element as unknown as { id: string }).id },
        );
    }
  }
}
