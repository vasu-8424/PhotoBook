import type {
  BookSize,
  DimensionsMm,
  PageOrientation,
} from "@/types/design";

export interface BookSizeConfig {
  size: BookSize;
  dimensions: DimensionsMm;
  orientation: PageOrientation;
}

export const BOOK_SIZES: Record<BookSize, BookSizeConfig> = {
  A4: {
    size: "A4",
    dimensions: {
      width: 210,
      height: 297,
    },
    orientation: "PORTRAIT",
  },

  SQUARE_210: {
    size: "SQUARE_210",
    dimensions: {
      width: 210,
      height: 210,
    },
    orientation: "SQUARE",
  },

  A5: {
    size: "A5",
    dimensions: {
      width: 148,
      height: 210,
    },
    orientation: "PORTRAIT",
  },

  LETTER: {
    size: "LETTER",
    dimensions: {
      width: 215.9,
      height: 279.4,
    },
    orientation: "PORTRAIT",
  },

  CUSTOM: {
    size: "CUSTOM",
    dimensions: {
      width: 210,
      height: 297,
    },
    orientation: "PORTRAIT",
  },
};

export const DEFAULT_PRINT_SETTINGS = {
  bleedMm: 3,
  safeAreaMm: 8,
  gutterMm: 10,
  dpi: 300,
};
