import fs from "fs";
import zlib from "zlib";
import { PDFDocument } from "pdf-lib";
import type { BookDesign } from "@/types/design";
import {
  renderDocument,
  validateDesign,
  mmToPt,
  ptToMm,
  type RenderAsset,
} from "../index";

// Helper to create pure uncompressed PNG buffers
export function createPng(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  pattern: "flat" | "gradient" | "cross" = "gradient",
): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function createChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    let c = 0xffffffff;
    const table: number[] = [];
    for (let n = 0; n < 256; n++) {
      let v = n;
      for (let k = 0; k < 8; k++) {
        v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
      }
      table[n] = v;
    }
    for (let i = 0; i < body.length; i++) {
      c = table[(c ^ body[i]) & 0xff] ^ (c >>> 8);
    }
    crc.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = createChunk("IHDR", ihdr);

  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    rawData[offset] = 0;
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3;
      if (pattern === "flat") {
        rawData[px] = r;
        rawData[px + 1] = g;
        rawData[px + 2] = b;
      } else if (pattern === "cross") {
        const isCross =
          Math.abs(x - width / 2) < 4 || Math.abs(y - height / 2) < 4;
        rawData[px] = isCross ? 255 : r;
        rawData[px + 1] = isCross ? 255 : g;
        rawData[px + 2] = isCross ? 255 : b;
      } else {
        // Gradient
        rawData[px] = Math.floor((r + (x / width) * 100) % 256);
        rawData[px + 1] = Math.floor((g + (y / height) * 100) % 256);
        rawData[px + 2] = b;
      }
    }
  }

  const idatData = zlib.deflateSync(rawData);
  const idatChunk = createChunk("IDAT", idatData);
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

export function buildMockAssets(): Map<string, RenderAsset> {
  const assets = new Map<string, RenderAsset>();

  // Full bleed cover (high res)
  const coverPng = createPng(2480, 3508, 40, 60, 90, "gradient");
  assets.set("asset_cover", {
    id: "asset_cover",
    mimeType: "image/png",
    bytes: new Uint8Array(coverPng),
    width: 2480,
    height: 3508,
  });

  // Portrait photo
  const portraitPng = createPng(1500, 2200, 180, 100, 70, "cross");
  assets.set("asset_portrait", {
    id: "asset_portrait",
    mimeType: "image/png",
    bytes: new Uint8Array(portraitPng),
    width: 1500,
    height: 2200,
  });

  // Landscape photo
  const landscapePng = createPng(3000, 2000, 50, 140, 110, "gradient");
  assets.set("asset_landscape", {
    id: "asset_landscape",
    mimeType: "image/png",
    bytes: new Uint8Array(landscapePng),
    width: 3000,
    height: 2000,
  });

  // Panoramic spread photo
  const spreadPng = createPng(4800, 2400, 70, 90, 150, "cross");
  assets.set("asset_spread", {
    id: "asset_spread",
    mimeType: "image/png",
    bytes: new Uint8Array(spreadPng),
    width: 4800,
    height: 2400,
  });

  return assets;
}

export async function runAllTests(): Promise<void> {
  console.log("=== RUNNING PART 2 PRINT ENGINE TESTS ===");

  const assets = buildMockAssets();

  // 1. Unit conversions test
  console.log("\n[Test] Unit conversions...");
  const a4WidthPt = mmToPt(210);
  const a4HeightPt = mmToPt(297);
  console.log(`210mm -> ${a4WidthPt.toFixed(4)} pt (expected ~595.2756)`);
  console.log(`297mm -> ${a4HeightPt.toFixed(4)} pt (expected ~841.8898)`);
  console.log(`Roundtrip: ${ptToMm(a4WidthPt).toFixed(2)} mm`);
  if (Math.abs(a4WidthPt - 595.27559) > 0.01) {
    throw new Error("Unit conversion mismatch on width");
  }

  // 2. Empty A4 (0 pages)
  console.log("\n[Test 1] Empty A4 (0 pages)...");
  const emptyA4Design: BookDesign = {
    schemaVersion: "1.0.0",
    document: {
      schemaVersion: "1.0.0",
      size: "A4",
      widthMm: 210,
      heightMm: 297,
      bleedMm: 3,
      safeAreaMm: 8,
      gutterMm: 10,
      dpi: 300,
      orientation: "PORTRAIT",
    },
    pages: [],
    spreads: [],
  };
  const emptyA4Result = await renderDocument(emptyA4Design, assets);
  console.log(`Empty A4 produced: ${emptyA4Result.pdfBytes.length} bytes, pages: ${emptyA4Result.pageCount}`);

  // 3. Empty Square (0 pages)
  console.log("\n[Test 2] Empty Square (0 pages)...");
  const emptySquareDesign: BookDesign = {
    schemaVersion: "1.0.0",
    document: {
      schemaVersion: "1.0.0",
      size: "SQUARE_210",
      widthMm: 210,
      heightMm: 210,
      bleedMm: 3,
      safeAreaMm: 8,
      gutterMm: 10,
      dpi: 300,
      orientation: "SQUARE",
    },
    pages: [],
    spreads: [],
  };
  const emptySquareResult = await renderDocument(emptySquareDesign, assets);
  console.log(`Empty Square produced: ${emptySquareResult.pdfBytes.length} bytes, pages: ${emptySquareResult.pageCount}`);

  // 4. Comprehensive A4 document test (part2-test-a4.pdf)
  console.log("\n[Test 3-8] Generating comprehensive A4 test document...");
  const a4Design: BookDesign = {
    schemaVersion: "1.0.0",
    document: {
      schemaVersion: "1.0.0",
      size: "A4",
      widthMm: 210,
      heightMm: 297,
      bleedMm: 3,
      safeAreaMm: 8,
      gutterMm: 10,
      dpi: 300,
      orientation: "PORTRAIT",
    },
    pages: [
      // Page 1: Cover page with full bleed image, vector text, vector shapes
      {
        id: "page_1",
        pageNumber: 1,
        layoutType: "FULL_BLEED",
        elements: [
          // Full bleed background
          {
            id: "elem_cover_img",
            type: "image",
            assetId: "asset_cover",
            xMm: 0,
            yMm: 0,
            widthMm: 210,
            heightMm: 297,
            fit: "COVER",
            focalPoint: { x: 0.5, y: 0.5 },
          },
          // Vector dark overlay shape
          {
            id: "elem_cover_shape",
            type: "shape",
            shape: "rectangle",
            xMm: 20,
            yMm: 40,
            widthMm: 170,
            heightMm: 60,
            fill: "#000000",
            stroke: "#FFFFFF",
            strokeWidthMm: 1,
          },
          // Vector text title
          {
            id: "elem_cover_text",
            type: "text",
            text: "Memory Magazine",
            xMm: 25,
            yMm: 50,
            widthMm: 160,
            heightMm: 25,
            fontFamily: "Inter",
            fontWeight: 700,
            fontSizePt: 32,
            lineHeight: 1.2,
            letterSpacingPt: 1,
            color: "#FFFFFF",
            align: "center",
          },
          // Vector subtitle
          {
            id: "elem_cover_sub",
            type: "text",
            text: "Part 2 Print Engine Verification Edition",
            xMm: 25,
            yMm: 78,
            widthMm: 160,
            heightMm: 15,
            fontFamily: "Inter",
            fontWeight: 400,
            fontSizePt: 14,
            lineHeight: 1.2,
            letterSpacingPt: 0,
            color: "#E2E8F0",
            align: "center",
          },
        ],
      },
      // Page 2: Editorial grid with portrait on landscape container (COVER + focal point), landscape photo, shapes, vector text
      {
        id: "page_2",
        pageNumber: 2,
        layoutType: "EDITORIAL_GRID",
        elements: [
          // Heading
          {
            id: "elem_p2_heading",
            type: "text",
            text: "Curated Moments & Editorial Geometry",
            xMm: 20,
            yMm: 20,
            widthMm: 170,
            heightMm: 15,
            fontFamily: "Inter",
            fontWeight: 700,
            fontSizePt: 20,
            lineHeight: 1.2,
            letterSpacingPt: 0,
            color: "#1E293B",
            align: "left",
          },
          // Portrait photo placed into a landscape rectangle with COVER and focal point { x: 0.75, y: 0.45 }
          {
            id: "elem_p2_portrait_crop",
            type: "image",
            assetId: "asset_portrait",
            xMm: 20,
            yMm: 45,
            widthMm: 170,
            heightMm: 95,
            fit: "COVER",
            focalPoint: { x: 0.75, y: 0.45 },
          },
          // Vector decorative circle
          {
            id: "elem_p2_circle",
            type: "shape",
            shape: "circle",
            xMm: 20,
            yMm: 150,
            widthMm: 30,
            heightMm: 30,
            fill: "#3B82F6",
            stroke: "#1D4ED8",
            strokeWidthMm: 0.5,
          },
          // Landscape photo placed with CONTAIN
          {
            id: "elem_p2_landscape_contain",
            type: "image",
            assetId: "asset_landscape",
            xMm: 60,
            yMm: 150,
            widthMm: 130,
            heightMm: 80,
            fit: "CONTAIN",
          },
          // Vector divider line
          {
            id: "elem_p2_line",
            type: "shape",
            shape: "line",
            xMm: 20,
            yMm: 240,
            widthMm: 170,
            heightMm: 1,
            stroke: "#94A3B8",
            strokeWidthMm: 0.5,
          },
          // Body text
          {
            id: "elem_p2_body",
            type: "text",
            text:
              "The Print Engine deterministically renders vector typography and shapes alongside high-resolution raster photography. Millimeters are converted to PDF points with zero browser rendering involvement.",
            xMm: 20,
            yMm: 248,
            widthMm: 170,
            heightMm: 30,
            fontFamily: "Inter",
            fontWeight: 400,
            fontSizePt: 10,
            lineHeight: 1.4,
            letterSpacingPt: 0,
            color: "#475569",
            align: "left",
          },
        ],
      },
      // Page 3: Left page of panoramic spread
      {
        id: "page_3",
        pageNumber: 3,
        layoutType: "SPREAD",
        elements: [
          {
            id: "elem_p3_caption",
            type: "text",
            text: "Panoramic Vista — Left Section",
            xMm: 20,
            yMm: 260,
            widthMm: 120,
            heightMm: 15,
            fontFamily: "Inter",
            fontWeight: 700,
            fontSizePt: 12,
            lineHeight: 1.2,
            letterSpacingPt: 0,
            color: "#FFFFFF",
            align: "left",
          },
        ],
      },
      // Page 4: Right page of panoramic spread
      {
        id: "page_4",
        pageNumber: 4,
        layoutType: "SPREAD",
        elements: [
          {
            id: "elem_p4_caption",
            type: "text",
            text: "Continuous Across 10mm Gutter — Right Section",
            xMm: 30,
            yMm: 260,
            widthMm: 150,
            heightMm: 15,
            fontFamily: "Inter",
            fontWeight: 400,
            fontSizePt: 12,
            lineHeight: 1.2,
            letterSpacingPt: 0,
            color: "#FFFFFF",
            align: "right",
          },
        ],
      },
    ],
    spreads: [
      {
        id: "spread_3_4",
        leftPageId: "page_3",
        rightPageId: "page_4",
        assetId: "asset_spread",
        fit: "COVER",
        focalPoint: { x: 0.5, y: 0.5 },
      },
    ],
  };

  const a4Result = await renderDocument(a4Design, assets);
  fs.writeFileSync("part2-test-a4.pdf", a4Result.pdfBytes);
  console.log(`Generated part2-test-a4.pdf (${a4Result.pdfBytes.length} bytes, ${a4Result.pageCount} pages)`);

  // Verify A4 PDF dimensions with pdf-lib
  const loadedA4 = await PDFDocument.load(a4Result.pdfBytes);
  const p1 = loadedA4.getPage(0);
  const p1Size = p1.getSize();
  console.log(`A4 Page 1 size: ${p1Size.width.toFixed(2)} x ${p1Size.height.toFixed(2)} pt`);
  if (Math.abs(p1Size.width - 595.28) > 0.5 || Math.abs(p1Size.height - 841.89) > 0.5) {
    throw new Error(`Unexpected A4 dimensions: ${p1Size.width} x ${p1Size.height}`);
  }

  // 5. Square document test (part2-test-square.pdf)
  console.log("\n[Test Square] Generating 210x210mm square test document...");
  const squareDesign: BookDesign = {
    schemaVersion: "1.0.0",
    document: {
      schemaVersion: "1.0.0",
      size: "SQUARE_210",
      widthMm: 210,
      heightMm: 210,
      bleedMm: 3,
      safeAreaMm: 8,
      gutterMm: 10,
      dpi: 300,
      orientation: "SQUARE",
    },
    pages: [
      {
        id: "sq_page_1",
        pageNumber: 1,
        layoutType: "HERO",
        elements: [
          {
            id: "elem_sq_img",
            type: "image",
            assetId: "asset_landscape",
            xMm: 15,
            yMm: 15,
            widthMm: 180,
            heightMm: 120,
            fit: "COVER",
            focalPoint: { x: 0.5, y: 0.5 },
          },
          {
            id: "elem_sq_title",
            type: "text",
            text: "Square 210×210 Format",
            xMm: 15,
            yMm: 145,
            widthMm: 180,
            heightMm: 15,
            fontFamily: "Inter",
            fontWeight: 700,
            fontSizePt: 22,
            lineHeight: 1.2,
            letterSpacingPt: 0,
            color: "#0F172A",
            align: "left",
          },
          {
            id: "elem_sq_rect",
            type: "shape",
            shape: "rectangle",
            xMm: 15,
            yMm: 168,
            widthMm: 180,
            heightMm: 25,
            fill: "#F1F5F9",
            stroke: "#CBD5E1",
            strokeWidthMm: 0.5,
          },
          {
            id: "elem_sq_desc",
            type: "text",
            text: "Size-agnostic rendering engine supporting arbitrary physical aspect ratios.",
            xMm: 20,
            yMm: 173,
            widthMm: 170,
            heightMm: 15,
            fontFamily: "Inter",
            fontWeight: 400,
            fontSizePt: 11,
            lineHeight: 1.2,
            letterSpacingPt: 0,
            color: "#334155",
            align: "left",
          },
        ],
      },
    ],
    spreads: [],
  };

  const squareResult = await renderDocument(squareDesign, assets);
  fs.writeFileSync("part2-test-square.pdf", squareResult.pdfBytes);
  console.log(`Generated part2-test-square.pdf (${squareResult.pdfBytes.length} bytes, ${squareResult.pageCount} pages)`);

  const loadedSq = await PDFDocument.load(squareResult.pdfBytes);
  const sqP1 = loadedSq.getPage(0);
  const sqSize = sqP1.getSize();
  console.log(`Square Page 1 size: ${sqSize.width.toFixed(2)} x ${sqSize.height.toFixed(2)} pt`);
  if (Math.abs(sqSize.width - 595.28) > 0.5 || Math.abs(sqSize.height - 595.28) > 0.5) {
    throw new Error(`Unexpected Square dimensions: ${sqSize.width} x ${sqSize.height}`);
  }

  // 6. Validation Error Detection Tests
  console.log("\n[Validation Tests] Verifying structured error detection...");

  // Missing asset test
  const missingAssetDesign: BookDesign = {
    ...emptyA4Design,
    pages: [
      {
        id: "p_err",
        pageNumber: 1,
        layoutType: "HERO",
        elements: [
          {
            id: "img_err",
            type: "image",
            assetId: "non_existent_asset",
            xMm: 10,
            yMm: 10,
            widthMm: 100,
            heightMm: 100,
            fit: "COVER",
          },
        ],
      },
    ],
  };
  const missingAssetVal = validateDesign(missingAssetDesign, assets);
  console.log("Missing asset check:", missingAssetVal.errors.map((e) => e.code));
  if (!missingAssetVal.errors.some((e) => e.code === "MISSING_ASSET")) {
    throw new Error("Failed to detect MISSING_ASSET");
  }

  // Missing font test
  const missingFontDesign: BookDesign = {
    ...emptyA4Design,
    pages: [
      {
        id: "p_font_err",
        pageNumber: 1,
        layoutType: "HERO",
        elements: [
          {
            id: "txt_err",
            type: "text",
            text: "Hello",
            xMm: 10,
            yMm: 10,
            widthMm: 100,
            heightMm: 20,
            fontFamily: "ComicSans",
            fontWeight: 400,
            fontSizePt: 12,
            lineHeight: 1.2,
            letterSpacingPt: 0,
            color: "#000000",
            align: "left",
          },
        ],
      },
    ],
  };
  const missingFontVal = validateDesign(missingFontDesign, assets);
  console.log("Missing font check:", missingFontVal.errors.map((e) => e.code));
  if (!missingFontVal.errors.some((e) => e.code === "MISSING_FONT")) {
    throw new Error("Failed to detect MISSING_FONT");
  }

  // Invalid geometry test (negative dimension)
  const invalidGeomDesign: BookDesign = {
    ...emptyA4Design,
    pages: [
      {
        id: "p_geom_err",
        pageNumber: 1,
        layoutType: "HERO",
        elements: [
          {
            id: "shape_err",
            type: "shape",
            shape: "rectangle",
            xMm: 10,
            yMm: 10,
            widthMm: -50,
            heightMm: 50,
          },
        ],
      },
    ],
  };
  const invalidGeomVal = validateDesign(invalidGeomDesign, assets);
  console.log("Invalid geometry check:", invalidGeomVal.errors.map((e) => e.code));
  if (!invalidGeomVal.errors.some((e) => e.code === "INVALID_GEOMETRY")) {
    throw new Error("Failed to detect INVALID_GEOMETRY");
  }

  // Text overflow test
  const overflowDesign: BookDesign = {
    ...emptyA4Design,
    pages: [
      {
        id: "p_ovf",
        pageNumber: 1,
        layoutType: "HERO",
        elements: [
          {
            id: "txt_ovf",
            type: "text",
            text: "This is an extremely long paragraph designed to overflow the tiny 10x5mm text box completely. ".repeat(10),
            xMm: 20,
            yMm: 20,
            widthMm: 15,
            heightMm: 5,
            fontFamily: "Inter",
            fontWeight: 400,
            fontSizePt: 16,
            lineHeight: 1.2,
            letterSpacingPt: 0,
            color: "#000000",
            align: "left",
          },
        ],
      },
    ],
  };
  const overflowVal = validateDesign(overflowDesign, assets);
  console.log("Text overflow check:", overflowVal.errors.map((e) => e.code));
  if (!overflowVal.errors.some((e) => e.code === "TEXT_OVERFLOW")) {
    throw new Error("Failed to detect TEXT_OVERFLOW");
  }

  // Invalid focal point test
  const invalidFocalDesign: BookDesign = {
    ...emptyA4Design,
    pages: [
      {
        id: "p_focal_err",
        pageNumber: 1,
        layoutType: "HERO",
        elements: [
          {
            id: "img_focal_err",
            type: "image",
            assetId: "asset_cover",
            xMm: 10,
            yMm: 10,
            widthMm: 100,
            heightMm: 100,
            fit: "COVER",
            focalPoint: { x: 1.5, y: -0.2 },
          },
        ],
      },
    ],
  };
  const invalidFocalVal = validateDesign(invalidFocalDesign, assets);
  console.log("Invalid focal point check:", invalidFocalVal.errors.map((e) => e.code));
  if (!invalidFocalVal.errors.some((e) => e.code === "INVALID_GEOMETRY")) {
    throw new Error("Failed to detect invalid focal point");
  }

  // Invalid spread test (non-existent page)
  const invalidSpreadDesign: BookDesign = {
    ...emptyA4Design,
    pages: [
      {
        id: "p_only_one",
        pageNumber: 1,
        layoutType: "HERO",
        elements: [],
      },
    ],
    spreads: [
      {
        id: "sp_bad",
        leftPageId: "p_only_one",
        rightPageId: "non_existent_page",
      },
    ],
  };
  const invalidSpreadVal = validateDesign(invalidSpreadDesign, assets);
  console.log("Invalid spread check:", invalidSpreadVal.errors.map((e) => e.code));
  if (!invalidSpreadVal.errors.some((e) => e.code === "INVALID_SPREAD")) {
    throw new Error("Failed to detect INVALID_SPREAD");
  }

  console.log("\n=== ALL PART 2 TESTS PASSED SUCCESSFULLY ===");
}

if (require.main === module) {
  runAllTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}
