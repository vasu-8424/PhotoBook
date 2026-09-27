import type { BookTheme } from "../types";

export const WARM_EDITORIAL: BookTheme = {
  id: "WARM_EDITORIAL",
  name: "Warm Editorial",
  description: "Sophisticated editorial warmth with toasted beige paper and earthy terracotta accents.",
  background: "#F5F1EA",
  surface: "#FFFFFF",
  primaryText: "#1D1D1B",
  secondaryText: "#746F67",
  accent: "#B76E4C",
  mutedAccent: "#D9BBAE",
  border: "#E2DBD1",
  typographySystem: "EDITORIAL_SERIF",
  spacingSystem: "EDITORIAL",
};

export const SOFT_SAND: BookTheme = {
  id: "SOFT_SAND",
  name: "Soft Sand",
  description: "Gentle natural tones inspired by coastal dunes and minimalist galleries.",
  background: "#F2EEE7",
  surface: "#FAF8F5",
  primaryText: "#25231F",
  secondaryText: "#81786C",
  accent: "#C6A77B",
  mutedAccent: "#E0D3C1",
  border: "#E5DDD1",
  typographySystem: "MODERN_SANS",
  spacingSystem: "BALANCED",
};

export const MONOCHROME: BookTheme = {
  id: "MONOCHROME",
  name: "Monochrome",
  description: "High-contrast architectural black & white with pristine gallery whites.",
  background: "#F7F7F5",
  surface: "#FFFFFF",
  primaryText: "#111111",
  secondaryText: "#6D6D6D",
  accent: "#222222",
  mutedAccent: "#9E9E9E",
  border: "#E0E0DC",
  typographySystem: "LUXURY_SERIF",
  spacingSystem: "AIRY",
};

export const FOREST: BookTheme = {
  id: "FOREST",
  name: "Forest",
  description: "Deep organic olive greens and muted sage evoking nature and mountain retreats.",
  background: "#EEF1EA",
  surface: "#F5F8F2",
  primaryText: "#1E2B24",
  secondaryText: "#647065",
  accent: "#879B7D",
  mutedAccent: "#B8C5B2",
  border: "#D5DDD1",
  typographySystem: "JOURNAL",
  spacingSystem: "BALANCED",
};

export const DUSTY_ROSE: BookTheme = {
  id: "DUSTY_ROSE",
  name: "Dusty Rose",
  description: "Muted romantic warmth with blush undertones and vintage mauve accents.",
  background: "#F5ECEB",
  surface: "#FAF4F4",
  primaryText: "#302426",
  secondaryText: "#78686A",
  accent: "#B68C91",
  mutedAccent: "#D8BFC2",
  border: "#E6D7D6",
  typographySystem: "ROMANTIC",
  spacingSystem: "EDITORIAL",
};

export const MIDNIGHT_CINEMATIC: BookTheme = {
  id: "MIDNIGHT_CINEMATIC",
  name: "Midnight Cinematic",
  description: "Dramatic cinematic deep charcoal darkroom theme with champagne gold accents.",
  background: "#151515",
  surface: "#222222",
  primaryText: "#F4F1EA",
  secondaryText: "#B8B3AA",
  accent: "#B28B5E",
  mutedAccent: "#7E6343",
  border: "#2C2C2C",
  typographySystem: "CINEMATIC",
  spacingSystem: "AIRY",
};

export const BOOK_THEMES: Record<string, BookTheme> = {
  WARM_EDITORIAL,
  SOFT_SAND,
  MONOCHROME,
  FOREST,
  DUSTY_ROSE,
  MIDNIGHT_CINEMATIC,
};

export const DEFAULT_THEME_ID = "WARM_EDITORIAL";
export const DEFAULT_THEME = WARM_EDITORIAL;

export function getThemeById(themeId?: string): BookTheme {
  if (!themeId) return DEFAULT_THEME;
  const normalized = themeId.toUpperCase().trim();
  return BOOK_THEMES[normalized] || DEFAULT_THEME;
}

export function listThemes(): BookTheme[] {
  return Object.values(BOOK_THEMES);
}
