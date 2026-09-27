import type { BookTheme, FontSpec, TypographicRole, TypographySystem } from "../types";

export const EDITORIAL_SERIF: TypographySystem = {
  id: "EDITORIAL_SERIF",
  name: "Editorial Serif",
  description: "Classic literary photojournalism with authoritative bold titles and clean legible body.",
  display: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 36,
    lineHeight: 1.1,
    letterSpacingPt: -0.5,
  },
  headline: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 22,
    lineHeight: 1.2,
    letterSpacingPt: -0.2,
  },
  subheadline: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 14,
    lineHeight: 1.3,
    letterSpacingPt: 0.2,
  },
  body: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 10,
    lineHeight: 1.5,
    letterSpacingPt: 0.1,
  },
  caption: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 8,
    lineHeight: 1.4,
    letterSpacingPt: 0.3,
  },
  label: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 7,
    lineHeight: 1.2,
    letterSpacingPt: 1.2,
    textTransform: "uppercase",
  },
  quote: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 15,
    lineHeight: 1.35,
    letterSpacingPt: 0,
  },
};

export const MODERN_SANS: TypographySystem = {
  id: "MODERN_SANS",
  name: "Modern Sans",
  description: "Swiss architectural minimalism with crisp proportions and generous white space.",
  display: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 34,
    lineHeight: 1.05,
    letterSpacingPt: -0.8,
  },
  headline: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 20,
    lineHeight: 1.15,
    letterSpacingPt: -0.4,
  },
  subheadline: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 13,
    lineHeight: 1.25,
    letterSpacingPt: 0.1,
  },
  body: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 9.5,
    lineHeight: 1.45,
    letterSpacingPt: 0.05,
  },
  caption: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 7.5,
    lineHeight: 1.35,
    letterSpacingPt: 0.2,
  },
  label: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 6.5,
    lineHeight: 1.2,
    letterSpacingPt: 1.5,
    textTransform: "uppercase",
  },
  quote: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 14,
    lineHeight: 1.4,
    letterSpacingPt: 0.2,
  },
};

export const LUXURY_SERIF: TypographySystem = {
  id: "LUXURY_SERIF",
  name: "Luxury Serif",
  description: "High-fashion haute couture editorial with airy tracking and refined hierarchy.",
  display: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 38,
    lineHeight: 1.08,
    letterSpacingPt: 0.8,
    textTransform: "uppercase",
  },
  headline: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 24,
    lineHeight: 1.15,
    letterSpacingPt: 0.5,
  },
  subheadline: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 13.5,
    lineHeight: 1.3,
    letterSpacingPt: 1.0,
    textTransform: "uppercase",
  },
  body: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 9,
    lineHeight: 1.55,
    letterSpacingPt: 0.15,
  },
  caption: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 7.5,
    lineHeight: 1.4,
    letterSpacingPt: 0.6,
  },
  label: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 7,
    lineHeight: 1.2,
    letterSpacingPt: 2.0,
    textTransform: "uppercase",
  },
  quote: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 16,
    lineHeight: 1.3,
    letterSpacingPt: 0.3,
  },
};

export const CINEMATIC: TypographySystem = {
  id: "CINEMATIC",
  name: "Cinematic",
  description: "Widescreen film title aesthetics with bold focal headers and atmospheric tracking.",
  display: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 40,
    lineHeight: 1.02,
    letterSpacingPt: 1.5,
    textTransform: "uppercase",
  },
  headline: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 22,
    lineHeight: 1.12,
    letterSpacingPt: 1.0,
    textTransform: "uppercase",
  },
  subheadline: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 12,
    lineHeight: 1.25,
    letterSpacingPt: 0.8,
  },
  body: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 9,
    lineHeight: 1.4,
    letterSpacingPt: 0.2,
  },
  caption: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 7,
    lineHeight: 1.3,
    letterSpacingPt: 0.5,
  },
  label: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 6.5,
    lineHeight: 1.1,
    letterSpacingPt: 2.2,
    textTransform: "uppercase",
  },
  quote: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 14,
    lineHeight: 1.35,
    letterSpacingPt: 0.8,
  },
};

export const ROMANTIC: TypographySystem = {
  id: "ROMANTIC",
  name: "Romantic",
  description: "Intimate poetry and tender memories with graceful letterforms and lyrical pacing.",
  display: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 32,
    lineHeight: 1.15,
    letterSpacingPt: 0.3,
  },
  headline: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 20,
    lineHeight: 1.25,
    letterSpacingPt: 0.1,
  },
  subheadline: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 13,
    lineHeight: 1.35,
    letterSpacingPt: 0.3,
  },
  body: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 9.5,
    lineHeight: 1.6,
    letterSpacingPt: 0.15,
  },
  caption: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 8,
    lineHeight: 1.4,
    letterSpacingPt: 0.2,
  },
  label: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 7,
    lineHeight: 1.2,
    letterSpacingPt: 1.2,
    textTransform: "uppercase",
  },
  quote: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 15,
    lineHeight: 1.45,
    letterSpacingPt: 0.4,
  },
};

export const JOURNAL: TypographySystem = {
  id: "JOURNAL",
  name: "Journal",
  description: "Personal travel notebook and explorer field journal with informal charm and tactile warmth.",
  display: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 30,
    lineHeight: 1.15,
    letterSpacingPt: -0.2,
  },
  headline: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 18,
    lineHeight: 1.25,
    letterSpacingPt: 0,
  },
  subheadline: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 12.5,
    lineHeight: 1.35,
    letterSpacingPt: 0.1,
  },
  body: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 9,
    lineHeight: 1.5,
    letterSpacingPt: 0.05,
  },
  caption: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSizePt: 7.5,
    lineHeight: 1.35,
    letterSpacingPt: 0.2,
  },
  label: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 6.5,
    lineHeight: 1.1,
    letterSpacingPt: 1.0,
    textTransform: "uppercase",
  },
  quote: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSizePt: 13.5,
    lineHeight: 1.4,
    letterSpacingPt: 0.1,
  },
};

export const TYPOGRAPHY_SYSTEMS: Record<string, TypographySystem> = {
  EDITORIAL_SERIF,
  MODERN_SANS,
  LUXURY_SERIF,
  CINEMATIC,
  ROMANTIC,
  JOURNAL,
};

export const DEFAULT_TYPOGRAPHY_ID = "EDITORIAL_SERIF";
export const DEFAULT_TYPOGRAPHY = EDITORIAL_SERIF;

export function getTypographyById(typographyId?: string): TypographySystem {
  if (!typographyId) return DEFAULT_TYPOGRAPHY;
  const normalized = typographyId.toUpperCase().trim();
  return TYPOGRAPHY_SYSTEMS[normalized] || DEFAULT_TYPOGRAPHY;
}

export function listTypographySystems(): TypographySystem[] {
  return Object.values(TYPOGRAPHY_SYSTEMS);
}

/**
 * Resolves typographic role to a FontSpec.
 */
export function resolveTypographicRole(
  role: TypographicRole,
  typography: TypographySystem,
): FontSpec {
  switch (role) {
    case "COVER_TITLE":
      return typography.display;
    case "COVER_SUBTITLE":
      return typography.subheadline;
    case "CHAPTER_NUMBER":
      return {
        ...typography.display,
        fontSizePt: Math.round(typography.display.fontSizePt * 1.2),
      };
    case "CHAPTER_TITLE":
      return typography.display;
    case "SECTION_TITLE":
      return typography.headline;
    case "EDITORIAL_HEADLINE":
      return typography.headline;
    case "SUBHEAD":
      return typography.subheadline;
    case "BODY":
      return typography.body;
    case "CAPTION":
      return typography.caption;
    case "LOCATION":
    case "DATE":
    case "PAGE_NUMBER":
    case "SMALL_LABEL":
      return typography.label;
    case "QUOTE":
      return typography.quote;
    default:
      return typography.body;
  }
}

/**
 * Resolves typographic styling including color and text formatting for a role.
 */
export function resolveRoleStyle(
  role: TypographicRole,
  typography: TypographySystem,
  theme: BookTheme,
): {
  fontFamily: string;
  fontWeight: number;
  fontSizePt: number;
  lineHeight: number;
  letterSpacingPt: number;
  color: string;
  align?: "left" | "center" | "right";
} {
  const spec = resolveTypographicRole(role, typography);

  let color = theme.primaryText;
  if (role === "CAPTION" || role === "DATE" || role === "PAGE_NUMBER" || role === "SMALL_LABEL") {
    color = theme.secondaryText;
  } else if (role === "QUOTE" || role === "CHAPTER_NUMBER") {
    color = theme.accent;
  } else if (role === "SUBHEAD" || role === "COVER_SUBTITLE") {
    color = theme.secondaryText;
  }

  let align: "left" | "center" | "right" = "left";
  if (role === "COVER_TITLE" || role === "COVER_SUBTITLE") {
    align = "center";
  } else if (role === "CHAPTER_NUMBER" || role === "CHAPTER_TITLE") {
    align = "left";
  }

  return {
    fontFamily: spec.fontFamily,
    fontWeight: spec.fontWeight,
    fontSizePt: spec.fontSizePt,
    lineHeight: spec.lineHeight,
    letterSpacingPt: spec.letterSpacingPt,
    color,
    align,
  };
}
