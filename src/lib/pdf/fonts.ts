import fs from "fs";
import path from "path";
import { type PDFDocument, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { PrintEngineError } from "./errors";

export interface FontDefinition {
  family: string;
  weight: number;
  path: string;
}

const fontRegistry: Map<string, FontDefinition> = new Map();

function fontKey(family: string, weight: number): string {
  return `${family.toLowerCase().trim()}:${weight}`;
}

// Controlled font registry default entries
export const DEFAULT_FONTS: FontDefinition[] = [
  {
    family: "Inter",
    weight: 400,
    path: "assets/fonts/Inter-Regular.otf",
  },
  {
    family: "Inter",
    weight: 700,
    path: "assets/fonts/Inter-Bold.otf",
  },
];

// Initialize default fonts
for (const font of DEFAULT_FONTS) {
  registerFont(font);
}

export function registerFont(def: FontDefinition): void {
  fontRegistry.set(fontKey(def.family, def.weight), def);
}

export function getFontDefinition(
  family: string,
  weight: number,
): FontDefinition | undefined {
  return fontRegistry.get(fontKey(family, weight));
}

export function hasFont(family: string, weight: number): boolean {
  return fontRegistry.has(fontKey(family, weight));
}

export function listRegisteredFonts(): FontDefinition[] {
  return Array.from(fontRegistry.values());
}

// In-memory cache of font file buffers
const fontBufferCache = new Map<string, Buffer>();

export function getFontBytes(def: FontDefinition): Buffer {
  const cached = fontBufferCache.get(def.path);
  if (cached) {
    return cached;
  }

  const resolvedPath = path.isAbsolute(def.path)
    ? def.path
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), def.path);

  if (!fs.existsSync(resolvedPath)) {
    throw new PrintEngineError(
      `Font asset file not found on disk at: ${resolvedPath}`,
      "MISSING_FONT",
      { family: def.family, weight: def.weight, path: def.path },
    );
  }

  const buffer = fs.readFileSync(resolvedPath);
  fontBufferCache.set(def.path, buffer);
  return buffer;
}

// Cache of embedded PDFFont per PDFDocument
const docFontCache = new WeakMap<PDFDocument, Map<string, PDFFont>>();

export async function getOrEmbedFont(
  pdfDoc: PDFDocument,
  family: string,
  weight: number,
): Promise<PDFFont> {
  const def = getFontDefinition(family, weight);
  if (!def) {
    throw new PrintEngineError(
      `Font not found in controlled registry: ${family} (weight: ${weight})`,
      "MISSING_FONT",
      { family, weight },
    );
  }

  let docCache = docFontCache.get(pdfDoc);
  if (!docCache) {
    docCache = new Map();
    docFontCache.set(pdfDoc, docCache);
  }

  const key = fontKey(family, weight);
  const existing = docCache.get(key);
  if (existing) {
    return existing;
  }

  // Register fontkit if not already registered
  try {
    pdfDoc.registerFontkit(fontkit);
  } catch {
    // Already registered on this document
  }

  const fontBytes = getFontBytes(def);
  const embeddedFont = await pdfDoc.embedFont(fontBytes);
  docCache.set(key, embeddedFont);
  return embeddedFont;
}
