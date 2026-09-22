import type {
  BookDesign,
  BookSize,
} from "./design";

export type BookOccasion =
  | "TRAVEL"
  | "PERSONAL_MEMORIES";

export type BookStyle =
  | "EDITORIAL"
  | "CINEMATIC"
  | "MINIMAL"
  | "JOURNAL";

export type BookStatus =
  | "DRAFT"
  | "UPLOADING"
  | "ANALYZING"
  | "DESIGNING"
  | "PREVIEW_READY"
  | "EXPORTING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

export interface Book {
  id: string;

  userId: string;

  title?: string;

  occasion: BookOccasion;

  style: BookStyle;

  size: BookSize;

  status: BookStatus;

  design?: BookDesign;

  createdAt: string;

  updatedAt: string;

  expiresAt?: string;
}
