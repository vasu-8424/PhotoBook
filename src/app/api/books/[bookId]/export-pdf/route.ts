import { NextRequest, NextResponse } from "next/server";
import { getDesignRepository } from "@/lib/ai/design/storage";
import { renderDocument, type RenderAsset } from "@/lib/pdf";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await context.params;
    if (!bookId) {
      return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
    }

    const repository = getDesignRepository();
    const record = await repository.getDesignByBookId(bookId);

    if (!record || !record.designJson) {
      return NextResponse.json(
        { error: "No design found to export for this book." },
        { status: 404 },
      );
    }

    const design = record.designJson;

    // Collect all asset IDs in design
    const assets = new Map<string, RenderAsset>();
    const minimalPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );

    for (const page of design.pages) {
      for (const el of page.elements) {
        if (el.type === "image" && el.assetId && !assets.has(el.assetId)) {
          assets.set(el.assetId, {
            id: el.assetId,
            mimeType: "image/png",
            bytes: new Uint8Array(minimalPng),
            width: 1200,
            height: 800,
          });
        }
      }
    }
    for (const spread of design.spreads || []) {
      if (spread.assetId && !assets.has(spread.assetId)) {
        assets.set(spread.assetId, {
          id: spread.assetId,
          mimeType: "image/png",
          bytes: new Uint8Array(minimalPng),
          width: 1200,
          height: 800,
        });
      }
    }

    // Pass canonical BookDesign directly into Print Engine
    const renderResult = await renderDocument(design, assets, {
      outputDpi: 300,
    });

    const pdfBuffer = Buffer.from(renderResult.pdfBytes);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="magazine-${bookId}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error("POST /api/books/[bookId]/export-pdf error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to export PDF" },
      { status: 500 },
    );
  }
}
