import type { BookDesign, DesignElement, ImageElement, TextElement } from "@/types/design";
import {
  constrainDimensions,
  isApprovedFont,
  isProtectedPhoto,
} from "./constraints";
import { roundMm } from "./coordinates";
import type { ImageCropUpdates, MutationResult, TypographyUpdates } from "./types";

/**
 * Immutably updates the position of an element on a page, respecting constraints.
 */
export function updateElementPosition(
  design: BookDesign,
  pageId: string,
  elementId: string,
  xMm: number,
  yMm: number,
): BookDesign {
  return {
    ...design,
    pages: design.pages.map((page) => {
      if (page.id !== pageId) return page;

      return {
        ...page,
        elements: page.elements.map((el) => {
          if (el.id !== elementId) return el;
          return {
            ...el,
            xMm: roundMm(xMm),
            yMm: roundMm(yMm),
          };
        }),
      };
    }),
  };
}

/**
 * Immutably updates the dimensions of an element on a page, enforcing positive sizes.
 */
export function updateElementSize(
  design: BookDesign,
  pageId: string,
  elementId: string,
  widthMm: number,
  heightMm: number,
): BookDesign {
  const maxW = design.document.widthMm + design.document.bleedMm * 2;
  const maxH = design.document.heightMm + design.document.bleedMm * 2;

  const constrained = constrainDimensions(widthMm, heightMm, maxW, maxH);

  return {
    ...design,
    pages: design.pages.map((page) => {
      if (page.id !== pageId) return page;

      return {
        ...page,
        elements: page.elements.map((el) => {
          if (el.id !== elementId) return el;
          return {
            ...el,
            widthMm: constrained.widthMm,
            heightMm: constrained.heightMm,
          };
        }),
      };
    }),
  };
}

/**
 * Immutably updates text element content and approved typography properties.
 */
export function updateTextElement(
  design: BookDesign,
  pageId: string,
  elementId: string,
  updates: TypographyUpdates,
): BookDesign {
  return {
    ...design,
    pages: design.pages.map((page) => {
      if (page.id !== pageId) return page;

      return {
        ...page,
        elements: page.elements.map((el) => {
          if (el.id !== elementId || el.type !== "text") return el;

          const textEl = el as TextElement;

          // Validate typography constraints if changed
          const targetFamily = updates.fontFamily ?? textEl.fontFamily;
          const targetWeight = updates.fontWeight ?? textEl.fontWeight;

          if (!isApprovedFont(targetFamily, targetWeight)) {
            // Keep existing approved font if proposed font is unsupported
            return el;
          }

          return {
            ...textEl,
            text: updates.text !== undefined ? updates.text : textEl.text,
            fontFamily: targetFamily,
            fontWeight: targetWeight,
            fontSizePt: updates.fontSizePt ? roundMm(updates.fontSizePt, 1) : textEl.fontSizePt,
            lineHeight: updates.lineHeight ?? textEl.lineHeight,
            letterSpacingPt:
              updates.letterSpacingPt !== undefined
                ? roundMm(updates.letterSpacingPt, 2)
                : textEl.letterSpacingPt,
            color: updates.color ?? textEl.color,
            align: updates.align ?? textEl.align,
          };
        }),
      };
    }),
  };
}

/**
 * Immutably updates image element fit mode or focal point.
 */
export function updateImageElement(
  design: BookDesign,
  pageId: string,
  elementId: string,
  updates: ImageCropUpdates,
): BookDesign {
  return {
    ...design,
    pages: design.pages.map((page) => {
      if (page.id !== pageId) return page;

      return {
        ...page,
        elements: page.elements.map((el) => {
          if (el.id !== elementId || el.type !== "image") return el;

          const imgEl = el as ImageElement;
          let newFocalPoint = imgEl.focalPoint;

          if (updates.focalPoint) {
            newFocalPoint = {
              x: Math.max(0, Math.min(1, roundMm(updates.focalPoint.x, 2))),
              y: Math.max(0, Math.min(1, roundMm(updates.focalPoint.y, 2))),
            };
          }

          return {
            ...imgEl,
            fit: updates.fit ?? imgEl.fit,
            focalPoint: newFocalPoint,
          };
        }),
      };
    }),
  };
}

/**
 * Deletes an element from a page, protecting protected photo assets.
 */
export function deleteElement(
  design: BookDesign,
  pageId: string,
  elementId: string,
  protectedPhotoIds?: string[],
): MutationResult {
  const targetPage = design.pages.find((p) => p.id === pageId);
  if (!targetPage) {
    return { success: false, design, error: `Page '${pageId}' not found.` };
  }

  const targetEl = targetPage.elements.find((el) => el.id === elementId);
  if (!targetEl) {
    return { success: false, design, error: `Element '${elementId}' not found.` };
  }

  // Enforce protected photo rules
  if (targetEl.type === "image") {
    if (isProtectedPhoto(targetEl.assetId, protectedPhotoIds)) {
      return {
        success: false,
        design,
        error: "This photo is protected and cannot be deleted from the magazine.",
      };
    }
  }

  const newDesign: BookDesign = {
    ...design,
    pages: design.pages.map((page) => {
      if (page.id !== pageId) return page;
      return {
        ...page,
        elements: page.elements.filter((el) => el.id !== elementId),
      };
    }),
  };

  return { success: true, design: newDesign };
}

/**
 * Finds an element across the design by its ID.
 */
export function findElementById(
  design: BookDesign,
  elementId: string,
): { pageId: string; element: DesignElement } | null {
  for (const page of design.pages) {
    for (const el of page.elements) {
      if (el.id === elementId) {
        return { pageId: page.id, element: el };
      }
    }
  }
  return null;
}
