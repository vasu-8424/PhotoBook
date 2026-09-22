import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { BookDesign, BookPage } from "@/types/design";
import { mmToPt } from "./units";
import { PrintEngineError } from "./errors";
import { validateDesign } from "./validate-design";
import { createPdfPage, renderPageElements } from "./render-page";
import { renderSpread } from "./render-spread";
import type {
  PdfRenderOptions,
  PdfRenderResult,
  RenderAsset,
} from "./types";

export async function renderDocument(
  design: BookDesign,
  assets: Map<string, RenderAsset> = new Map(),
  options?: PdfRenderOptions,
): Promise<PdfRenderResult> {
  // Step 1: Validate design
  const validation = validateDesign(design, assets, options);

  if (options?.validate !== false && !validation.valid) {
    const firstError = validation.errors[0];
    throw new PrintEngineError(
      `Print validation failed: ${firstError.message}`,
      firstError.code,
      { errors: validation.errors, warnings: validation.warnings },
    );
  }

  // Step 2: Initialize PDFDocument and register fontkit
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Set standard PDF document metadata
  pdfDoc.setProducer("Memory Magazine Deterministic Print Engine");
  pdfDoc.setCreator("Memory Magazine");

  const pageHeightPt = mmToPt(design.document.heightMm);

  // Step 3: Sort pages deterministically
  const sortedPages = [...design.pages].sort(
    (a, b) => a.pageNumber - b.pageNumber,
  );

  // Step 4: Create PDF pages and map them by id
  const pageMap = new Map<string, { page: ReturnType<typeof pdfDoc.addPage>; data: BookPage }>();

  for (const pageData of sortedPages) {
    const page = createPdfPage(pdfDoc, design);
    pageMap.set(pageData.id, { page, data: pageData });
  }

  // Step 5: Render two-page spreads (background layer)
  for (const spread of design.spreads) {
    const left = pageMap.get(spread.leftPageId);
    const right = pageMap.get(spread.rightPageId);

    if (left && right) {
      await renderSpread(
        pdfDoc,
        left.page,
        right.page,
        spread,
        design.document.widthMm,
        design.document.heightMm,
        design.document.gutterMm,
        assets,
      );
    }
  }

  // Step 6: Render page elements in defined order
  for (const pageData of sortedPages) {
    const pageObj = pageMap.get(pageData.id);
    if (pageObj) {
      await renderPageElements(
        pdfDoc,
        pageObj.page,
        pageObj.data,
        pageHeightPt,
        assets,
      );
    }
  }

  // Step 7: Save PDF deterministically
  const pdfBytes = await pdfDoc.save();

  return {
    pdfBytes,
    pageCount: pdfDoc.getPageCount(),
    warnings: validation.warnings.map((w) => `${w.code}: ${w.message}`),
    validationErrors: validation.errors.map((e) => `${e.code}: ${e.message}`),
  };
}
