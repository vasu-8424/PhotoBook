import {
  type PDFDocument,
  type PDFPage,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
} from "pdf-lib";
import type { ImageElement } from "@/types/design";
import { calculateImageBounds } from "./geometry";
import { getOrEmbedImage } from "./images";
import { PrintEngineError } from "./errors";
import type { RenderAsset } from "./types";

export async function renderImage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  element: ImageElement,
  pageHeightPt: number,
  assets: Map<string, RenderAsset>,
): Promise<void> {
  const asset = assets.get(element.assetId);
  if (!asset) {
    throw new PrintEngineError(
      `Image asset '${element.assetId}' not found in provided assets map.`,
      "MISSING_ASSET",
      { assetId: element.assetId, elementId: element.id },
    );
  }

  const pdfImage = await getOrEmbedImage(pdfDoc, asset);

  const { clipRect, imageRect } = calculateImageBounds(
    asset.width,
    asset.height,
    {
      xMm: element.xMm,
      yMm: element.yMm,
      widthMm: element.widthMm,
      heightMm: element.heightMm,
    },
    pageHeightPt,
    element.fit,
    element.focalPoint,
  );

  // Apply PDF vector clipping path to preserve target boundary
  page.pushOperators(
    pushGraphicsState(),
    rectangle(clipRect.x, clipRect.y, clipRect.width, clipRect.height),
    clip(),
    endPath(),
  );

  page.drawImage(pdfImage, {
    x: imageRect.x,
    y: imageRect.y,
    width: imageRect.width,
    height: imageRect.height,
    opacity: element.opacity ?? 1,
  });

  page.pushOperators(popGraphicsState());
}
