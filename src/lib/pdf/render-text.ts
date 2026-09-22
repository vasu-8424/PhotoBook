import { rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { TextElement } from "@/types/design";
import { mmToPt } from "./units";
import { mmRectToPdfRect } from "./geometry";
import { parseHexColor } from "./render-shape";

export interface TextMetrics {
  lines: string[];
  lineWidths: number[];
  lineHeightPt: number;
  totalHeightPt: number;
  maxWidthPt: number;
  overflowsWidth: boolean;
  overflowsHeight: boolean;
}

export function measureText(
  font: PDFFont,
  element: TextElement,
): TextMetrics {
  const targetWidthPt = mmToPt(element.widthMm);
  const targetHeightPt = mmToPt(element.heightMm);

  const fontSize = element.fontSizePt > 0 ? element.fontSizePt : 12;
  const lineHeightRatio = element.lineHeight > 0 ? element.lineHeight : 1.2;
  const lineHeightPt = fontSize * lineHeightRatio;
  const letterSpacing = element.letterSpacingPt || 0;

  // Split lines by explicit line breaks first
  const rawLines = element.text.split("\n");
  const wrappedLines: string[] = [];

  for (const rawLine of rawLines) {
    if (!rawLine) {
      wrappedLines.push("");
      continue;
    }

    const words = rawLine.split(" ");
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
      let testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (letterSpacing && testLine.length > 1) {
        testWidth += (testLine.length - 1) * letterSpacing;
      }

      if (testWidth <= targetWidthPt || currentLine === "") {
        currentLine = testLine;
      } else {
        wrappedLines.push(currentLine);
        currentLine = words[i];
      }
    }
    if (currentLine) {
      wrappedLines.push(currentLine);
    }
  }

  const lines = wrappedLines.length > 0 ? wrappedLines : [""];
  const lineWidths = lines.map((line) => {
    let w = font.widthOfTextAtSize(line, fontSize);
    if (letterSpacing && line.length > 1) {
      w += (line.length - 1) * letterSpacing;
    }
    return w;
  });

  const maxWidthPt = Math.max(...lineWidths, 0);
  const totalHeightPt = lines.length * lineHeightPt;

  return {
    lines,
    lineWidths,
    lineHeightPt,
    totalHeightPt,
    maxWidthPt,
    overflowsWidth: maxWidthPt > targetWidthPt + 1.0, // small epsilon
    overflowsHeight: totalHeightPt > targetHeightPt + 1.0,
  };
}

export function renderText(
  page: PDFPage,
  font: PDFFont,
  element: TextElement,
  pageHeightPt: number,
): void {
  const rect = mmRectToPdfRect(
    element.xMm,
    element.yMm,
    element.widthMm,
    element.heightMm,
    pageHeightPt,
  );

  const metrics = measureText(font, element);
  const color = parseHexColor(element.color) || { r: 0, g: 0, b: 0 };
  const pdfColor = rgb(color.r, color.g, color.b);

  const fontSize = element.fontSizePt > 0 ? element.fontSizePt : 12;

  // Position first line baseline inside bounding box top
  // In PDF coordinate system, box top is (rect.y + rect.height)
  let baselineY = rect.y + rect.height - fontSize;

  for (let i = 0; i < metrics.lines.length; i++) {
    const line = metrics.lines[i];
    const lineWidth = metrics.lineWidths[i];

    let lineX = rect.x;
    if (element.align === "center") {
      lineX = rect.x + (rect.width - lineWidth) / 2;
    } else if (element.align === "right") {
      lineX = rect.x + (rect.width - lineWidth);
    }

    page.drawText(line, {
      x: lineX,
      y: baselineY,
      size: fontSize,
      font,
      color: pdfColor,
      rotate: element.rotation ? undefined : undefined,
    });

    baselineY -= metrics.lineHeightPt;
  }
}
