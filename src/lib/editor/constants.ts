export const DEFAULT_ZOOM = 1.0;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;
export const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;

/**
 * Default screen density conversion: 2.8 pixels per millimeter.
 * A4 (210 x 297 mm) displays at ~588 x 831 px at 100% zoom,
 * perfectly fitting modern desktop screens (1080p / 1440p).
 */
export const DEFAULT_PIXELS_PER_MM = 2.8;

export const AUTOSAVE_DEBOUNCE_MS = 1000;
export const MAX_HISTORY_STATES = 50;

export const MIN_ELEMENT_DIMENSION_MM = 5;

export const APPROVED_FONTS = ["Inter"] as const;
export const APPROVED_FONT_WEIGHTS = [400, 700] as const;

export const DEFAULT_PAGE_BG_COLOR = "#FFFFFF";
export const CANVAS_WORKSPACE_BG = "#0B0F17";
export const SAFE_AREA_COLOR = "rgba(59, 130, 246, 0.45)"; // Blue dashed guide
export const BLEED_GUIDE_COLOR = "rgba(239, 68, 68, 0.45)"; // Red dashed guide
export const GUTTER_GUIDE_COLOR = "rgba(245, 158, 11, 0.45)"; // Amber dashed guide
export const SELECTION_BOX_COLOR = "#3B82F6";
