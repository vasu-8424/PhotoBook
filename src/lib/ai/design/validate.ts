import { DESIGN_SCHEMA_VERSION, type BookDesign } from "@/types/design";
import { AIGatewayError } from "@/lib/ai/errors";
import { hasFont } from "@/lib/pdf/fonts";
import { getSafeAreaMm } from "@/lib/pdf/geometry";
import { validateDesign as validatePrintEngineDesign } from "@/lib/pdf/validate-design";
import { APPROVED_FONTS, APPROVED_FONT_WEIGHTS } from "./types";

/**
 * Deterministically rounds floating-point numbers to 2 decimal places to clean up
 * microscopic AI coordinate artifacts (e.g. 210.00000002 -> 210.00).
 * Does NOT auto-repair structural errors (unknown assets, bad fonts, text outside safe area).
 */
export function repairDesignGeometry(design: BookDesign): BookDesign {
  const round = (val: number): number => Math.round(val * 100) / 100;

  return {
    ...design,
    document: {
      ...design.document,
      widthMm: round(design.document.widthMm),
      heightMm: round(design.document.heightMm),
      bleedMm: round(design.document.bleedMm),
      safeAreaMm: round(design.document.safeAreaMm),
      gutterMm: round(design.document.gutterMm),
    },
    pages: design.pages.map((page) => ({
      ...page,
      elements: page.elements.map((el) => {
        if (el.type === "image") {
          return {
            ...el,
            xMm: round(el.xMm),
            yMm: round(el.yMm),
            widthMm: round(el.widthMm),
            heightMm: round(el.heightMm),
          };
        } else if (el.type === "text") {
          return {
            ...el,
            xMm: round(el.xMm),
            yMm: round(el.yMm),
            widthMm: round(el.widthMm),
            heightMm: round(el.heightMm),
            fontSizePt: round(el.fontSizePt),
            lineHeight: round(el.lineHeight),
            letterSpacingPt: round(el.letterSpacingPt),
          };
        } else if (el.type === "shape") {
          return {
            ...el,
            xMm: round(el.xMm),
            yMm: round(el.yMm),
            widthMm: round(el.widthMm),
            heightMm: round(el.heightMm),
            strokeWidthMm:
              el.strokeWidthMm !== undefined ? round(el.strokeWidthMm) : undefined,
          };
        }
        return el;
      }),
    })),
  };
}

/**
 * Validates deterministic design integrity rules on an AI-generated BookDesign.
 * Ensures:
 * 1. Asset existence against authoritative photo IDs (DESIGN_ASSET_ERROR).
 * 2. Protected photos are all included in design (DESIGN_PROTECTED_ASSET_ERROR).
 * 3. Approved fonts and font weights only (DESIGN_FONT_ERROR).
 * 4. Text bounding box is strictly within safe area bounds (DESIGN_SAFE_AREA_ERROR).
 * 5. Millimeter geometry is finite, positive, and printable (DESIGN_GEOMETRY_ERROR).
 * 6. Two-page spreads are valid, use same asset, and respect gutter (DESIGN_SPREAD_ERROR).
 * 7. Page numbers are contiguous 1..N with unique IDs.
 */
export function validateDesignIntegrity(
  design: BookDesign,
  authoritativePhotoIds: Set<string>,
  protectedPhotoIds?: string[],
): void {
  if (!design || !design.document) {
    throw new AIGatewayError(
      "Design document root is missing.",
      "DESIGN_GEOMETRY_ERROR",
      { isRetryable: false },
    );
  }

  if (design.schemaVersion !== DESIGN_SCHEMA_VERSION) {
    throw new AIGatewayError(
      `Invalid schema version '${design.schemaVersion}'. Expected '${DESIGN_SCHEMA_VERSION}'.`,
      "SCHEMA_VALIDATION_ERROR",
      { isRetryable: false },
    );
  }

  const { widthMm, heightMm, bleedMm, safeAreaMm } = design.document;

  // 1. Document Geometry Checks
  if (
    !Number.isFinite(widthMm) ||
    widthMm <= 0 ||
    !Number.isFinite(heightMm) ||
    heightMm <= 0
  ) {
    throw new AIGatewayError(
      `Invalid document dimensions: ${widthMm}x${heightMm} mm. Dimensions must be positive finite numbers.`,
      "DESIGN_GEOMETRY_ERROR",
      { isRetryable: false, details: { widthMm, heightMm } },
    );
  }

  const safeArea = getSafeAreaMm(widthMm, heightMm, safeAreaMm);
  const maxBleedBounds = {
    minX: -bleedMm - 0.01,
    maxX: widthMm + bleedMm + 0.01,
    minY: -bleedMm - 0.01,
    maxY: heightMm + bleedMm + 0.01,
  };

  const usedAssetIds = new Set<string>();
  const pageIdSet = new Set<string>();
  const elementIdSet = new Set<string>();
  const pageNumbers: number[] = [];
  const pageOrderMap = new Map<string, number>();

  // 2. Page & Element Iteration
  for (const page of design.pages) {
    if (!page.id) {
      throw new AIGatewayError("Page is missing an ID.", "DESIGN_GEOMETRY_ERROR", {
        isRetryable: false,
      });
    }

    if (pageIdSet.has(page.id)) {
      throw new AIGatewayError(
        `Duplicate page ID '${page.id}' found in design.`,
        "DESIGN_GEOMETRY_ERROR",
        { isRetryable: false, details: { pageId: page.id } },
      );
    }
    pageIdSet.add(page.id);

    if (
      page.pageNumber === undefined ||
      !Number.isInteger(page.pageNumber) ||
      page.pageNumber < 1
    ) {
      throw new AIGatewayError(
        `Invalid page number ${page.pageNumber} on page '${page.id}'. Must be a positive integer.`,
        "DESIGN_GEOMETRY_ERROR",
        { isRetryable: false, details: { pageId: page.id, pageNumber: page.pageNumber } },
      );
    }

    pageNumbers.push(page.pageNumber);
    pageOrderMap.set(page.id, page.pageNumber);

    for (const el of page.elements) {
      if (!el.id) {
        throw new AIGatewayError(
          `Element on page '${page.id}' is missing an ID.`,
          "DESIGN_GEOMETRY_ERROR",
          { isRetryable: false, details: { pageId: page.id } },
        );
      }

      if (elementIdSet.has(el.id)) {
        throw new AIGatewayError(
          `Duplicate element ID '${el.id}' found in design.`,
          "DESIGN_GEOMETRY_ERROR",
          { isRetryable: false, details: { pageId: page.id, elementId: el.id } },
        );
      }
      elementIdSet.add(el.id);

      // Validate finite numbers & positive dimensions
      if (
        !Number.isFinite(el.xMm) ||
        !Number.isFinite(el.yMm) ||
        !Number.isFinite(el.widthMm) ||
        !Number.isFinite(el.heightMm) ||
        el.widthMm <= 0 ||
        el.heightMm <= 0
      ) {
        throw new AIGatewayError(
          `Element '${el.id}' has invalid geometry: x=${el.xMm}, y=${el.yMm}, w=${el.widthMm}, h=${el.heightMm}. Dimensions must be positive finite numbers.`,
          "DESIGN_GEOMETRY_ERROR",
          { isRetryable: false, details: { elementId: el.id, pageId: page.id } },
        );
      }

      // Check bounds within bleed container
      if (
        el.xMm < maxBleedBounds.minX ||
        el.xMm + el.widthMm > maxBleedBounds.maxX ||
        el.yMm < maxBleedBounds.minY ||
        el.yMm + el.heightMm > maxBleedBounds.maxY
      ) {
        throw new AIGatewayError(
          `Element '${el.id}' extends outside allowable document bleed boundaries: [${el.xMm}, ${el.yMm}, ${el.widthMm}, ${el.heightMm}].`,
          "DESIGN_GEOMETRY_ERROR",
          { isRetryable: false, details: { elementId: el.id, pageId: page.id } },
        );
      }

      // Element-specific validations
      if (el.type === "image") {
        if (!el.assetId || !authoritativePhotoIds.has(el.assetId)) {
          throw new AIGatewayError(
            `Image element '${el.id}' references unknown assetId '${el.assetId}'.`,
            "DESIGN_ASSET_ERROR",
            { isRetryable: false, details: { elementId: el.id, assetId: el.assetId } },
          );
        }
        usedAssetIds.add(el.assetId);

        if (el.focalPoint) {
          if (
            el.focalPoint.x < 0 ||
            el.focalPoint.x > 1 ||
            el.focalPoint.y < 0 ||
            el.focalPoint.y > 1
          ) {
            throw new AIGatewayError(
              `Focal point on element '${el.id}' is out of normalized bounds [0, 1]: (${el.focalPoint.x}, ${el.focalPoint.y}).`,
              "DESIGN_GEOMETRY_ERROR",
              { isRetryable: false, details: { elementId: el.id } },
            );
          }
        }
      } else if (el.type === "text") {
        if (!el.text || el.text.trim().length === 0) {
          throw new AIGatewayError(
            `Text element '${el.id}' on page '${page.id}' cannot be empty.`,
            "DESIGN_GEOMETRY_ERROR",
            { isRetryable: false, details: { elementId: el.id } },
          );
        }

        // Font validation
        const isApprovedFamily = APPROVED_FONTS.includes(el.fontFamily);
        const isApprovedWeight = (APPROVED_FONT_WEIGHTS as readonly number[]).includes(
          el.fontWeight,
        );
        const isRegistered = hasFont(el.fontFamily, el.fontWeight);

        if (!isApprovedFamily || !isApprovedWeight || !isRegistered) {
          throw new AIGatewayError(
            `Font '${el.fontFamily}' (weight: ${el.fontWeight}) on text element '${el.id}' is not in the approved font registry.`,
            "DESIGN_FONT_ERROR",
            {
              isRetryable: false,
              details: {
                elementId: el.id,
                fontFamily: el.fontFamily,
                fontWeight: el.fontWeight,
                approvedFonts: APPROVED_FONTS,
              },
            },
          );
        }

        // Safe Area Validation for text
        // Allow a tiny 0.05mm tolerance for floating-point rounding
        const tolerance = 0.05;
        if (
          el.xMm < safeArea.minX - tolerance ||
          el.xMm + el.widthMm > safeArea.maxX + tolerance ||
          el.yMm < safeArea.minY - tolerance ||
          el.yMm + el.heightMm > safeArea.maxY + tolerance
        ) {
          throw new AIGatewayError(
            `Text element '${el.id}' on page '${page.id}' violates safe area boundary (${safeAreaMm}mm margin). Box: [${el.xMm}, ${el.yMm}, ${el.widthMm}, ${el.heightMm}], Safe Area: [${safeArea.minX}, ${safeArea.minY}, ${safeArea.maxX}, ${safeArea.maxY}].`,
            "DESIGN_SAFE_AREA_ERROR",
            {
              isRetryable: false,
              details: {
                elementId: el.id,
                pageId: page.id,
                xMm: el.xMm,
                yMm: el.yMm,
                widthMm: el.widthMm,
                heightMm: el.heightMm,
                safeArea,
              },
            },
          );
        }
      }
    }
  }

  // 3. Contiguous Page Numbering Check (1..N)
  pageNumbers.sort((a, b) => a - b);
  for (let i = 0; i < pageNumbers.length; i++) {
    const expected = i + 1;
    if (pageNumbers[i] !== expected) {
      throw new AIGatewayError(
        `Page numbering is not contiguous. Expected page ${expected}, found ${pageNumbers[i]}.`,
        "DESIGN_GEOMETRY_ERROR",
        { isRetryable: false, details: { pageNumbers } },
      );
    }
  }

  // 4. Spread Validations
  const spreadPages = new Set<string>();
  for (const spread of design.spreads) {
    if (!spread.leftPageId || !pageIdSet.has(spread.leftPageId)) {
      throw new AIGatewayError(
        `Spread '${spread.id}' references non-existent leftPageId '${spread.leftPageId}'.`,
        "DESIGN_SPREAD_ERROR",
        { isRetryable: false, details: { spreadId: spread.id } },
      );
    }

    if (!spread.rightPageId || !pageIdSet.has(spread.rightPageId)) {
      throw new AIGatewayError(
        `Spread '${spread.id}' references non-existent rightPageId '${spread.rightPageId}'.`,
        "DESIGN_SPREAD_ERROR",
        { isRetryable: false, details: { spreadId: spread.id } },
      );
    }

    if (spread.leftPageId === spread.rightPageId) {
      throw new AIGatewayError(
        `Spread '${spread.id}' has identical left and right page IDs '${spread.leftPageId}'.`,
        "DESIGN_SPREAD_ERROR",
        { isRetryable: false, details: { spreadId: spread.id } },
      );
    }

    if (spreadPages.has(spread.leftPageId) || spreadPages.has(spread.rightPageId)) {
      throw new AIGatewayError(
        `Page in spread '${spread.id}' already participates in another spread.`,
        "DESIGN_SPREAD_ERROR",
        { isRetryable: false, details: { spreadId: spread.id } },
      );
    }
    spreadPages.add(spread.leftPageId);
    spreadPages.add(spread.rightPageId);

    const leftNum = pageOrderMap.get(spread.leftPageId)!;
    const rightNum = pageOrderMap.get(spread.rightPageId)!;

    if (leftNum + 1 !== rightNum) {
      throw new AIGatewayError(
        `Spread '${spread.id}' left page (${leftNum}) must immediately precede right page (${rightNum}).`,
        "DESIGN_SPREAD_ERROR",
        { isRetryable: false, details: { spreadId: spread.id, leftNum, rightNum } },
      );
    }

    if (spread.assetId) {
      if (!authoritativePhotoIds.has(spread.assetId)) {
        throw new AIGatewayError(
          `Spread '${spread.id}' references unknown assetId '${spread.assetId}'.`,
          "DESIGN_ASSET_ERROR",
          { isRetryable: false, details: { spreadId: spread.id, assetId: spread.assetId } },
        );
      }
      usedAssetIds.add(spread.assetId);

      // Gutter safety check: If focal point is centered near gutter boundary (x = 0.48 - 0.52), reject/warn
      if (spread.focalPoint) {
        if (spread.focalPoint.x > 0.46 && spread.focalPoint.x < 0.54) {
          throw new AIGatewayError(
            `Spread '${spread.id}' places focal point (${spread.focalPoint.x}) directly into the binding gutter fold.`,
            "DESIGN_SPREAD_ERROR",
            { isRetryable: false, details: { spreadId: spread.id, focalPoint: spread.focalPoint } },
          );
        }
      }
    }
  }

  // 5. Protected Photos Verification
  if (protectedPhotoIds && protectedPhotoIds.length > 0) {
    for (const pid of protectedPhotoIds) {
      if (!usedAssetIds.has(pid)) {
        throw new AIGatewayError(
          `Protected photo '${pid}' must appear in the design but was omitted.`,
          "DESIGN_PROTECTED_ASSET_ERROR",
          { isRetryable: false, details: { missingProtectedPhotoId: pid } },
        );
      }
    }
  }

  // 6. Print Engine Deterministic Validation Pass
  // Run Print Engine's validateDesign to ensure total compatibility
  const printValidation = validatePrintEngineDesign(design);
  if (!printValidation.valid) {
    const firstErr = printValidation.errors[0];
    throw new AIGatewayError(
      `Print engine validation failed: ${firstErr.message} (${firstErr.code})`,
      "DESIGN_GEOMETRY_ERROR",
      { isRetryable: false, details: printValidation.errors },
    );
  }
}
