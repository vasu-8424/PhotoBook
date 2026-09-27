import type {
  BookDocument,
  BookPage,
  BookSpread,
  LayoutType,
} from "@/types/design";

export type PhotoOrientation = "PORTRAIT" | "LANDSCAPE" | "SQUARE";

export type PreferredTreatment =
  | "FULL_BLEED"
  | "HERO"
  | "PORTRAIT_FRAME"
  | "LANDSCAPE_FRAME"
  | "CROPPED"
  | "SPREAD";

export interface PhotoLayoutProfile {
  assetId: string;
  orientation: PhotoOrientation;
  aspectRatio: number; // width / height
  widthPx: number;
  heightPx: number;
  qualityScore: number; // 0 - 1
  visualWeight: number; // 0 - 1
  focalPoint?: {
    x: number;
    y: number;
  };
  peopleCount?: number;
  subjectPosition?: "LEFT" | "CENTER" | "RIGHT" | "TOP" | "BOTTOM";
  cropSafety: number; // 0 - 1
  preferredTreatments: PreferredTreatment[];
}

export interface BookTheme {
  id: string;
  name: string;
  description: string;
  background: string;
  surface: string;
  primaryText: string;
  secondaryText: string;
  accent: string;
  mutedAccent: string;
  border?: string;
  typographySystem: string;
  spacingSystem: string;
}

export interface FontSpec {
  fontFamily: string; // Only approved fonts (Inter)
  fontWeight: number; // 400 | 700
  fontSizePt: number;
  lineHeight: number;
  letterSpacingPt: number;
  textTransform?: "uppercase" | "lowercase" | "capitalize" | "none";
}

export interface TypographySystem {
  id: string;
  name: string;
  description: string;
  display: FontSpec;
  headline: FontSpec;
  subheadline: FontSpec;
  body: FontSpec;
  caption: FontSpec;
  label: FontSpec;
  quote: FontSpec;
}

export type TypographicRole =
  | "COVER_TITLE"
  | "COVER_SUBTITLE"
  | "CHAPTER_NUMBER"
  | "CHAPTER_TITLE"
  | "SECTION_TITLE"
  | "EDITORIAL_HEADLINE"
  | "SUBHEAD"
  | "BODY"
  | "CAPTION"
  | "LOCATION"
  | "DATE"
  | "QUOTE"
  | "PAGE_NUMBER"
  | "SMALL_LABEL";

export type LayoutFamily =
  | "HERO"
  | "PORTRAIT"
  | "LANDSCAPE"
  | "GRID"
  | "MAGAZINE"
  | "MINIMAL"
  | "JOURNAL"
  | "SPREAD";

export type VisualDensity = "LOW" | "MEDIUM" | "HIGH";

export interface TemplateCompileContext {
  pageNumber: number;
  pageId: string;
  document: BookDocument;
  photos: PhotoLayoutProfile[];
  theme: BookTheme;
  typography: TypographySystem;
  editorial?: {
    headline?: string;
    subheadline?: string;
    bodyText?: string;
    quote?: string;
    caption?: string;
    location?: string;
    date?: string;
    chapterNumber?: number;
    chapterTitle?: string;
  };
  isSpread?: boolean;
  spreadContext?: {
    leftPageId: string;
    rightPageId: string;
  };
}

export interface CompiledTemplateResult {
  pages: BookPage[];
  spreads?: BookSpread[];
}

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  family: LayoutFamily;
  minPhotos: number;
  maxPhotos: number;
  preferredOrientations: PhotoOrientation[];
  supportsText: boolean;
  supportsQuote: boolean;
  supportsSpread: boolean;
  visualDensity: VisualDensity;
  canonicalLayoutType: LayoutType;
  compile(context: TemplateCompileContext): CompiledTemplateResult;
}

export interface TemplateScore {
  templateId: string;
  score: number;
  reasons: {
    orientationFit: number;
    aspectRatioFit: number;
    qualityFit: number;
    focalPointFit: number;
    visualBalance: number;
    storyFit: number;
    cropSafety: number;
    textSpace: number;
    spreadOpportunity: number;
    repetitionPenalty: number;
  };
}
