import { DESIGN_SCHEMA_VERSION, type BookDesign } from "@/types/design";
import { DEFAULT_DPI } from "./constants";
import { hasFont } from "./fonts";
import { calculateEffectiveDpi, isSupportedImageMimeType } from "./images";
import { getSafeAreaMm } from "./geometry";
import type {
  PdfRenderOptions,
  PrintValidationIssue,
  PrintValidationResult,
  RenderAsset,
} from "./types";

const VALID_LAYOUT_TYPES = new Set([
  "FULL_BLEED",
  "HERO",
  "SPLIT",
  "ASYMMETRIC",
  "MASONRY",
  "EDITORIAL_GRID",
  "PHOTO_STRIP",
  "PHOTO_TEXT",
  "COLLAGE",
  "SPREAD",
]);

const VALID_FIT_MODES = new Set(["COVER", "CONTAIN", "FILL"]);
const VALID_SHAPES = new Set(["rectangle", "line", "circle"]);

export function validateDesign(
  design: BookDesign,
  assets?: Map<string, RenderAsset>,
  options?: PdfRenderOptions,
): PrintValidationResult {
  const errors: PrintValidationIssue[] = [];
  const warnings: PrintValidationIssue[] = [];

  const targetDpi = options?.outputDpi ?? design.document.dpi ?? DEFAULT_DPI;

  // 1. Document validation
  if (design.schemaVersion !== DESIGN_SCHEMA_VERSION) {
    errors.push({
      code: "INVALID_DESIGN",
      message: `Invalid schema version '${design.schemaVersion}'. Expected '${DESIGN_SCHEMA_VERSION}'.`,
    });
  }

  const { widthMm, heightMm, bleedMm, safeAreaMm, gutterMm, dpi } = design.document;

  if (!widthMm || widthMm <= 0 || !heightMm || heightMm <= 0) {
    errors.push({
      code: "INVALID_PAGE_SIZE",
      message: `Invalid document dimensions: ${widthMm}x${heightMm} mm. Dimensions must be positive numbers.`,
    });
  }

  if (bleedMm === undefined || bleedMm < 0) {
    errors.push({
      code: "INVALID_DESIGN",
      message: `Invalid bleed value: ${bleedMm} mm. Bleed must be non-negative.`,
    });
  }

  if (safeAreaMm === undefined || safeAreaMm < 0) {
    errors.push({
      code: "INVALID_DESIGN",
      message: `Invalid safe area: ${safeAreaMm} mm. Safe area must be non-negative.`,
    });
  }

  if (gutterMm === undefined || gutterMm < 0) {
    errors.push({
      code: "INVALID_DESIGN",
      message: `Invalid gutter: ${gutterMm} mm. Gutter must be non-negative.`,
    });
  }

  if (dpi !== undefined && dpi < 72) {
    warnings.push({
      code: "IMAGE_RESOLUTION_TOO_LOW",
      message: `Document configured DPI is unusually low: ${dpi} DPI.`,
    });
  }

  const safeArea = getSafeAreaMm(widthMm || 0, heightMm || 0, safeAreaMm || 0);

  // 2. Page validations
  const pageIdSet = new Set<string>();

  for (const page of design.pages) {
    if (!page.id) {
      errors.push({
        code: "INVALID_DESIGN",
        message: "Page is missing an ID.",
      });
      continue;
    }

    if (pageIdSet.has(page.id)) {
      errors.push({
        code: "INVALID_DESIGN",
        message: `Duplicate page ID '${page.id}'.`,
        pageId: page.id,
      });
    }
    pageIdSet.add(page.id);

    if (page.pageNumber === undefined || page.pageNumber < 0) {
      errors.push({
        code: "INVALID_DESIGN",
        message: `Invalid page number: ${page.pageNumber}.`,
        pageId: page.id,
      });
    }

    if (!VALID_LAYOUT_TYPES.has(page.layoutType)) {
      errors.push({
        code: "INVALID_DESIGN",
        message: `Invalid layout type: '${page.layoutType}'.`,
        pageId: page.id,
      });
    }

    // Elements validation
    for (const element of page.elements) {
      if (!element.id) {
        errors.push({
          code: "INVALID_ELEMENT",
          message: "Element is missing an ID.",
          pageId: page.id,
        });
        continue;
      }

      if (element.widthMm <= 0 || element.heightMm <= 0) {
        errors.push({
          code: "INVALID_GEOMETRY",
          message: `Element '${element.id}' has non-positive dimensions: ${element.widthMm}x${element.heightMm} mm.`,
          pageId: page.id,
          elementId: element.id,
        });
      }

      switch (element.type) {
        case "image": {
          if (!element.assetId) {
            errors.push({
              code: "MISSING_ASSET",
              message: `Image element '${element.id}' is missing assetId.`,
              pageId: page.id,
              elementId: element.id,
            });
          } else if (assets) {
            const asset = assets.get(element.assetId);
            if (!asset) {
              errors.push({
                code: "MISSING_ASSET",
                message: `Referenced asset '${element.assetId}' not found.`,
                pageId: page.id,
                elementId: element.id,
                assetId: element.assetId,
              });
            } else {
              if (!isSupportedImageMimeType(asset.mimeType)) {
                errors.push({
                  code: "UNSUPPORTED_ASSET",
                  message: `Asset '${asset.id}' has unsupported format '${asset.mimeType}'.`,
                  pageId: page.id,
                  elementId: element.id,
                  assetId: asset.id,
                });
              }

              const effDpi = calculateEffectiveDpi(
                asset.width,
                asset.height,
                element.widthMm,
                element.heightMm,
              );
              if (effDpi > 0 && effDpi < targetDpi) {
                warnings.push({
                  code: "IMAGE_RESOLUTION_TOO_LOW",
                  message: `Image '${asset.id}' effective resolution (${effDpi} DPI) is below target ${targetDpi} DPI.`,
                  pageId: page.id,
                  elementId: element.id,
                  assetId: asset.id,
                });
              }
            }
          }

          if (element.fit && !VALID_FIT_MODES.has(element.fit)) {
            errors.push({
              code: "INVALID_ELEMENT",
              message: `Invalid fit mode '${element.fit}' on image element '${element.id}'.`,
              pageId: page.id,
              elementId: element.id,
            });
          }

          if (element.focalPoint) {
            const { x, y } = element.focalPoint;
            if (x < 0 || x > 1 || y < 0 || y > 1) {
              errors.push({
                code: "INVALID_GEOMETRY",
                message: `Focal point coordinates must be in [0.0, 1.0]. Got (${x}, ${y}).`,
                pageId: page.id,
                elementId: element.id,
              });
            }
          }
          break;
        }

        case "text": {
          if (element.text === undefined) {
            errors.push({
              code: "INVALID_ELEMENT",
              message: `Text element '${element.id}' has undefined text.`,
              pageId: page.id,
              elementId: element.id,
            });
          }

          if (!element.fontFamily || !hasFont(element.fontFamily, element.fontWeight)) {
            errors.push({
              code: "MISSING_FONT",
              message: `Font '${element.fontFamily}' with weight ${element.fontWeight} is not registered in the font registry.`,
              pageId: page.id,
              elementId: element.id,
            });
          }

          if (!element.fontSizePt || element.fontSizePt <= 0) {
            errors.push({
              code: "INVALID_ELEMENT",
              message: `Text element '${element.id}' has invalid font size: ${element.fontSizePt} pt.`,
              pageId: page.id,
              elementId: element.id,
            });
          }

          // Safe area check for text
          if (
            element.xMm < safeArea.minX ||
            element.xMm + element.widthMm > safeArea.maxX ||
            element.yMm < safeArea.minY ||
            element.yMm + element.heightMm > safeArea.maxY
          ) {
            warnings.push({
              code: "SAFE_AREA_VIOLATION",
              message: `Text element '${element.id}' extends outside the ${safeAreaMm}mm safe area boundary.`,
              pageId: page.id,
              elementId: element.id,
            });
          }

          // Basic text overflow check:
          // Character count heuristic vs bounding box area
          const approxCharWidthPt = (element.fontSizePt || 12) * 0.55;
          const approxCharHeightPt = (element.fontSizePt || 12) * (element.lineHeight || 1.2);
          const boxWidthPt = (element.widthMm * 72) / 25.4;
          const boxHeightPt = (element.heightMm * 72) / 25.4;
          const charsPerLine = Math.max(1, Math.floor(boxWidthPt / approxCharWidthPt));
          const maxLines = Math.max(1, Math.floor(boxHeightPt / approxCharHeightPt));
          const maxCharsPossible = charsPerLine * maxLines;

          if (element.text && element.text.length > maxCharsPossible * 1.5) {
            errors.push({
              code: "TEXT_OVERFLOW",
              message: `Text content in element '${element.id}' significantly overflows the defined ${element.widthMm}x${element.heightMm}mm box.`,
              pageId: page.id,
              elementId: element.id,
            });
          }
          break;
        }

        case "shape": {
          if (!VALID_SHAPES.has(element.shape)) {
            errors.push({
              code: "INVALID_ELEMENT",
              message: `Unsupported shape '${element.shape}' on element '${element.id}'.`,
              pageId: page.id,
              elementId: element.id,
            });
          }
          break;
        }

        default:
          errors.push({
            code: "INVALID_ELEMENT",
            message: `Unknown element type: ${(element as unknown as { type: string }).type}`,
            pageId: page.id,
            elementId: (element as unknown as { id: string }).id,
          });
      }
    }
  }

  // 3. Spread validations
  for (const spread of design.spreads) {
    if (!spread.leftPageId || !pageIdSet.has(spread.leftPageId)) {
      errors.push({
        code: "INVALID_SPREAD",
        message: `Spread '${spread.id}' references non-existent left page '${spread.leftPageId}'.`,
      });
    }

    if (!spread.rightPageId || !pageIdSet.has(spread.rightPageId)) {
      errors.push({
        code: "INVALID_SPREAD",
        message: `Spread '${spread.id}' references non-existent right page '${spread.rightPageId}'.`,
      });
    }

    if (spread.leftPageId && spread.rightPageId && spread.leftPageId === spread.rightPageId) {
      errors.push({
        code: "INVALID_SPREAD",
        message: `Spread '${spread.id}' has identical left and right page ID '${spread.leftPageId}'.`,
      });
    }

    if (spread.assetId && assets) {
      const asset = assets.get(spread.assetId);
      if (!asset) {
        errors.push({
          code: "MISSING_ASSET",
          message: `Spread '${spread.id}' references missing asset '${spread.assetId}'.`,
          assetId: spread.assetId,
        });
      }
    }

    if (spread.focalPoint) {
      const { x, y } = spread.focalPoint;
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        errors.push({
          code: "INVALID_GEOMETRY",
          message: `Spread '${spread.id}' focal point coordinates must be in [0.0, 1.0]. Got (${x}, ${y}).`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
