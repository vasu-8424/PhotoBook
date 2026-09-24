import type {
  BookDesign,
  BookSize,
} from "./design";

export type { BookSize };

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
  | "CREATED"
  | "QUEUED"
  | "UPLOADING"
  | "PROCESSING_PHOTOS"
  | "ANALYZING_PHOTOS"
  | "CREATING_STORY"
  | "DESIGNING"
  | "PREVIEW_READY"
  | "EDITING"
  | "EXPORTING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

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
