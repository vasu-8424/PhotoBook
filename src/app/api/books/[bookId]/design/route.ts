import { NextRequest, NextResponse } from "next/server";
import { getDesignRepository } from "@/lib/ai/design/storage";
import { validateEditorDesign } from "@/lib/editor/validation";
import type { BookDesign } from "@/types/design";

export async function GET(
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
        { error: "Design not found for this book." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      design: record.designJson,
      model: record.model,
      promptVersion: record.promptVersion,
      updatedAt: record.updatedAt,
    });
  } catch (err) {
    console.error("GET /api/books/[bookId]/design error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await context.params;
    if (!bookId) {
      return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
    }

    const body = await request.json();
    const incomingDesign = body.design as BookDesign;
    const protectedPhotoIds = (body.protectedPhotoIds as string[]) || [];

    if (!incomingDesign || !incomingDesign.document || !incomingDesign.pages) {
      return NextResponse.json(
        { error: "Invalid Design JSON payload." },
        { status: 400 },
      );
    }

    // Verify all asset IDs in design
    const assetIdSet = new Set<string>();
    for (const page of incomingDesign.pages) {
      for (const el of page.elements) {
        if (el.type === "image" && el.assetId) {
          assetIdSet.add(el.assetId);
        }
      }
    }
    for (const spread of incomingDesign.spreads || []) {
      if (spread.assetId) {
        assetIdSet.add(spread.assetId);
      }
    }

    // Server-side strict validation
    const validation = validateEditorDesign(
      incomingDesign,
      assetIdSet,
      protectedPhotoIds,
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, code: validation.code },
        { status: 422 },
      );
    }

    // Persist to repository
    const repository = getDesignRepository();
    const existing = await repository.getDesignByBookId(bookId);

    await repository.saveDesign({
      id: existing?.id || crypto.randomUUID(),
      bookId,
      userId: existing?.userId,
      schemaVersion: "1.0.0",
      designJson: incomingDesign,
      provider: existing?.provider || "USER_EDITOR",
      model: existing?.model || "manual-edit",
      promptVersion: existing?.promptVersion || "v1.0.0",
      inputHash: existing?.inputHash || "user-edited",
      outputSchemaVersion: "1.0.0",
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      design: incomingDesign,
    });
  } catch (err) {
    console.error("PUT /api/books/[bookId]/design error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
