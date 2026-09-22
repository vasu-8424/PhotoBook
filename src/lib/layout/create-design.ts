import {
  DESIGN_SCHEMA_VERSION,
  type BookDesign,
  type BookSize,
} from "@/types/design";

import {
  BOOK_SIZES,
  DEFAULT_PRINT_SETTINGS,
} from "@/config/book";

export function createEmptyDesign(
  size: BookSize = "A4",
): BookDesign {
  const config = BOOK_SIZES[size];

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,

    document: {
      schemaVersion: DESIGN_SCHEMA_VERSION,

      size,

      widthMm: config.dimensions.width,
      heightMm: config.dimensions.height,

      bleedMm: DEFAULT_PRINT_SETTINGS.bleedMm,
      safeAreaMm: DEFAULT_PRINT_SETTINGS.safeAreaMm,
      gutterMm: DEFAULT_PRINT_SETTINGS.gutterMm,

      dpi: DEFAULT_PRINT_SETTINGS.dpi,

      orientation: config.orientation,
    },

    pages: [],

    spreads: [],
  };
}
