import {
  type PDFDocument,
  type PDFPage,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
} from "pdf-lib";
import type { BookSpread } from "@/types/design";
import { calculateSpreadBounds } from "./geometry";
import { getOrEmbedImage } from "./images";
import { PrintEngineError } from "./errors";
import type { RenderAsset } from "./types";

export async function renderSpread(
  pdfDoc: PDFDocument,
  leftPage: PDFPage,
  rightPage: PDFPage,
  spread: BookSpread,
  pageWidthMm: number,
  pageHeightMm: number,
  gutterMm: number,
  assets: Map<string, RenderAsset>,
): Promise<void> {
  if (!spread.assetId) {
    return;
  }

  const asset = assets.get(spread.assetId);
  if (!asset) {
    throw new PrintEngineError(
      `Spread asset '${spread.assetId}' not found in provided assets map.`,
      "MISSING_ASSET",
      { spreadId: spread.id, assetId: spread.assetId },
    );
  }

  const pdfImage = await getOrEmbedImage(pdfDoc, asset);

  const { leftSlice, rightSlice } = calculateSpreadBounds(
    asset.width,
    asset.height,
    pageWidthMm,
    pageHeightMm,
    gutterMm,
    spread.fit ?? "COVER",
    spread.focalPoint,
  );

  // Render left slice on left page
  leftPage.pushOperators(
    pushGraphicsState(),
    rectangle(
      leftSlice.clipRect.x,
      leftSlice.clipRect.y,
      leftSlice.clipRect.width,
      leftSlice.clipRect.height,
    ),
    clip(),
    endPath(),
  );

  leftPage.drawImage(pdfImage, {
    x: leftSlice.imageRect.x,
    y: leftSlice.imageRect.y,
    width: leftSlice.imageRect.width,
    height: leftSlice.imageRect.height,
  });

  leftPage.pushOperators(popGraphicsState());

  // Render right slice on right page
  rightPage.pushOperators(
    pushGraphicsState(),
    rectangle(
      rightSlice.clipRect.x,
      rightSlice.clipRect.y,
      rightSlice.clipRect.width,
      rightSlice.clipRect.height,
    ),
    clip(),
    endPath(),
  );

  rightPage.drawImage(pdfImage, {
    x: rightSlice.imageRect.x,
    y: rightSlice.imageRect.y,
    width: rightSlice.imageRect.width,
    height: rightSlice.imageRect.height,
  });

  rightPage.pushOperators(popGraphicsState());
}
