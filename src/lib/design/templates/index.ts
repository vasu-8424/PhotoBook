import type { LayoutFamily, LayoutTemplate } from "../types";
import { HERO_TEMPLATES } from "./hero";
import { PORTRAIT_TEMPLATES } from "./portrait";
import { LANDSCAPE_TEMPLATES } from "./landscape";
import { GRID_TEMPLATES } from "./grid";
import { MAGAZINE_TEMPLATES } from "./magazine";
import { MINIMAL_TEMPLATES } from "./minimal";
import { JOURNAL_TEMPLATES } from "./journal";
import { SPREAD_TEMPLATES } from "./spread";

export * from "./helpers";
export * from "./hero";
export * from "./portrait";
export * from "./landscape";
export * from "./grid";
export * from "./magazine";
export * from "./minimal";
export * from "./journal";
export * from "./spread";

export const ALL_TEMPLATES: LayoutTemplate[] = [
  ...HERO_TEMPLATES,
  ...PORTRAIT_TEMPLATES,
  ...LANDSCAPE_TEMPLATES,
  ...GRID_TEMPLATES,
  ...MAGAZINE_TEMPLATES,
  ...MINIMAL_TEMPLATES,
  ...JOURNAL_TEMPLATES,
  ...SPREAD_TEMPLATES,
];

export const TEMPLATES_BY_ID: Record<string, LayoutTemplate> = Object.fromEntries(
  ALL_TEMPLATES.map((t) => [t.id, t]),
);

export function getTemplateById(id?: string): LayoutTemplate | undefined {
  if (!id) return undefined;
  return TEMPLATES_BY_ID[id.toUpperCase().trim()];
}

export function listTemplatesByFamily(family: LayoutFamily): LayoutTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.family === family);
}

export function getCompatibleTemplates(
  photoCount: number,
  orientations: Array<"PORTRAIT" | "LANDSCAPE" | "SQUARE">,
): LayoutTemplate[] {
  return ALL_TEMPLATES.filter((tpl) => {
    if (tpl.minPhotos > photoCount || tpl.maxPhotos < photoCount) {
      return false;
    }
    if (orientations.length > 0) {
      const matchesAny = orientations.some((o) =>
        tpl.preferredOrientations.includes(o),
      );
      if (!matchesAny) return false;
    }
    return true;
  });
}
