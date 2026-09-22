import { rgb, type PDFPage } from "pdf-lib";
import type { ShapeElement } from "@/types/design";
import { mmToPt } from "./units";
import { mmRectToPdfRect } from "./geometry";
import { PrintEngineError } from "./errors";

export function parseHexColor(
  hex?: string,
): { r: number; g: number; b: number } | undefined {
  if (!hex) {
    return undefined;
  }
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (clean.length !== 6) {
    return undefined;
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) {
    return undefined;
  }
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

export function renderShape(
  page: PDFPage,
  element: ShapeElement,
  pageHeightPt: number,
): void {
  const rect = mmRectToPdfRect(
    element.xMm,
    element.yMm,
    element.widthMm,
    element.heightMm,
    pageHeightPt,
  );

  const fillColor = parseHexColor(element.fill);
  const strokeColor = parseHexColor(element.stroke);
  const strokeWidth = element.strokeWidthMm ? mmToPt(element.strokeWidthMm) : 1;

  const pdfFill = fillColor ? rgb(fillColor.r, fillColor.g, fillColor.b) : undefined;
  const pdfStroke = strokeColor ? rgb(strokeColor.r, strokeColor.g, strokeColor.b) : undefined;

  switch (element.shape) {
    case "rectangle": {
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: pdfFill,
        borderColor: pdfStroke,
        borderWidth: pdfStroke ? strokeWidth : 0,
      });
      break;
    }

    case "circle": {
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      const radiusX = rect.width / 2;
      const radiusY = rect.height / 2;

      page.drawEllipse({
        x: centerX,
        y: centerY,
        xScale: radiusX,
        yScale: radiusY,
        color: pdfFill,
        borderColor: pdfStroke,
        borderWidth: pdfStroke ? strokeWidth : 0,
      });
      break;
    }

    case "line": {
      // Draw horizontal or diagonal line across bounding box
      page.drawLine({
        start: { x: rect.x, y: rect.y + rect.height },
        end: { x: rect.x + rect.width, y: rect.y },
        color: pdfStroke || pdfFill || rgb(0, 0, 0),
        thickness: strokeWidth,
      });
      break;
    }

    default:
      throw new PrintEngineError(
        `Unsupported shape type: ${(element as unknown as { shape: string }).shape}`,
        "INVALID_ELEMENT",
        { elementId: element.id },
      );
  }
}
