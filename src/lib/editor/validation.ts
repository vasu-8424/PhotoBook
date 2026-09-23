import type { BookDesign, BookDocument, DesignElement } from "@/types/design";
import { validateDesignIntegrity } from "@/lib/ai/design/validate";
import { isApprovedFont } from "./constraints";

export interface EditorValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

/**
 * Validates a complete BookDesign on commit or before server persistence.
 * Uses authoritative Part 7 integrity rules (geometry, safe area, gutter, fonts, assets, spreads).
 */
export function validateEditorDesign(
  design: BookDesign,
  authoritativePhotoIds: Set<string>,
  protectedPhotoIds?: string[],
): EditorValidationResult {
  try {
    validateDesignIntegrity(design, authoritativePhotoIds, protectedPhotoIds);
    return { valid: true };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && "message" in err) {
      const customErr = err as { code: string; message: string };
      return {
        valid: false,
        code: customErr.code,
        error: customErr.message,
      };
    }
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Lightweight per-element check for immediate UI interaction / transformer constraints.
 */
export function validateElementGeometry(
  element: DesignElement,
  doc: BookDocument,
): EditorValidationResult {
  if (element.widthMm <= 0 || element.heightMm <= 0) {
    return {
      valid: false,
      code: "DESIGN_GEOMETRY_ERROR",
      error: `Dimensions must be positive. Got ${element.widthMm}x${element.heightMm} mm.`,
    };
  }

  if (element.type === "text") {
    // Check safe area
    const safe = doc.safeAreaMm;
    const maxX = doc.widthMm - safe;
    const maxY = doc.heightMm - safe;

    if (
      element.xMm < safe - 0.05 ||
      element.xMm + element.widthMm > maxX + 0.05 ||
      element.yMm < safe - 0.05 ||
      element.yMm + element.heightMm > maxY + 0.05
    ) {
      return {
        valid: false,
        code: "DESIGN_SAFE_AREA_ERROR",
        error: "Text box must remain within the 8mm safe area margin.",
      };
    }

    if (!isApprovedFont(element.fontFamily, element.fontWeight)) {
      return {
        valid: false,
        code: "DESIGN_FONT_ERROR",
        error: `Font '${element.fontFamily}' (${element.fontWeight}) is not registered in the approved font registry.`,
      };
    }
  }

  return { valid: true };
}
