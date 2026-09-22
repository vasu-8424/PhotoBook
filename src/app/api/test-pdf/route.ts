import { NextResponse } from "next/server";
import { runAllTests, buildMockAssets } from "@/lib/pdf/test/run-test";
import { renderDocument } from "@/lib/pdf";
import type { BookDesign } from "@/types/design";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "run-all";

  const assets = buildMockAssets();

  if (type === "a4") {
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
        {
          id: "page_1",
          pageNumber: 1,
          layoutType: "FULL_BLEED",
          elements: [
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
          ],
        },
        {
          id: "page_2",
          pageNumber: 2,
          layoutType: "EDITORIAL_GRID",
          elements: [
            {
              id: "elem_p2_portrait",
              type: "image",
              assetId: "asset_portrait",
              xMm: 20,
              yMm: 20,
              widthMm: 170,
              heightMm: 100,
              fit: "COVER",
              focalPoint: { x: 0.75, y: 0.45 },
            },
            {
              id: "elem_p2_landscape",
              type: "image",
              assetId: "asset_landscape",
              xMm: 20,
              yMm: 130,
              widthMm: 170,
              heightMm: 100,
              fit: "CONTAIN",
            },
          ],
        },
        {
          id: "page_3",
          pageNumber: 3,
          layoutType: "SPREAD",
          elements: [
            {
              id: "elem_p3_text",
              type: "text",
              text: "Panoramic Spread — Left",
              xMm: 20,
              yMm: 260,
              widthMm: 150,
              heightMm: 15,
              fontFamily: "Inter",
              fontWeight: 700,
              fontSizePt: 14,
              lineHeight: 1.2,
              letterSpacingPt: 0,
              color: "#FFFFFF",
              align: "left",
            },
          ],
        },
        {
          id: "page_4",
          pageNumber: 4,
          layoutType: "SPREAD",
          elements: [
            {
              id: "elem_p4_text",
              type: "text",
              text: "Across 10mm Gutter — Right",
              xMm: 30,
              yMm: 260,
              widthMm: 150,
              heightMm: 15,
              fontFamily: "Inter",
              fontWeight: 400,
              fontSizePt: 14,
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
          id: "sp_1",
          leftPageId: "page_3",
          rightPageId: "page_4",
          assetId: "asset_spread",
          fit: "COVER",
          focalPoint: { x: 0.5, y: 0.5 },
        },
      ],
    };

    const result = await renderDocument(a4Design, assets);
    return new Response(Buffer.from(result.pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="part2-test-a4.pdf"',
      },
    });
  }

  if (type === "square") {
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
          id: "sq_p1",
          pageNumber: 1,
          layoutType: "HERO",
          elements: [
            {
              id: "sq_img",
              type: "image",
              assetId: "asset_landscape",
              xMm: 20,
              yMm: 20,
              widthMm: 170,
              heightMm: 110,
              fit: "COVER",
            },
            {
              id: "sq_txt",
              type: "text",
              text: "Memory Magazine (Square 210×210)",
              xMm: 20,
              yMm: 140,
              widthMm: 170,
              heightMm: 20,
              fontFamily: "Inter",
              fontWeight: 700,
              fontSizePt: 18,
              lineHeight: 1.2,
              letterSpacingPt: 0,
              color: "#0F172A",
              align: "left",
            },
            {
              id: "sq_rect",
              type: "shape",
              shape: "rectangle",
              xMm: 20,
              yMm: 165,
              widthMm: 170,
              heightMm: 25,
              fill: "#E2E8F0",
            },
          ],
        },
      ],
      spreads: [],
    };

    const result = await renderDocument(squareDesign, assets);
    return new Response(Buffer.from(result.pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="part2-test-square.pdf"',
      },
    });
  }

  // Default: run all test verifications
  await runAllTests();
  return NextResponse.json({
    status: "ok",
    message: "All Part 2 print engine tests executed and verified successfully.",
    exportedFiles: ["part2-test-a4.pdf", "part2-test-square.pdf"],
  });
}
