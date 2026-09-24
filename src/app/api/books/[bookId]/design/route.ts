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

    if (bookId.startsWith("demo")) {
      const { getDemoDesign } = await import("@/lib/editor/demo");
      const demoDesign = getDemoDesign();
      return NextResponse.json({
        design: demoDesign,
        assets: {
          demo_asset_cover: { previewUrl: "/file.svg" },
          demo_asset_01: { previewUrl: "/file.svg" },
          demo_asset_02: { previewUrl: "/file.svg" },
          demo_asset_03: { previewUrl: "/file.svg" },
          demo_asset_04: { previewUrl: "/file.svg" },
          demo_asset_spread: { previewUrl: "/file.svg" },
          demo_asset_closing: { previewUrl: "/file.svg" },
        },
        model: "demo-preset",
        promptVersion: "v1.0.0",
        updatedAt: new Date().toISOString(),
      });
    }

    const repository = getDesignRepository();
    const record = await repository.getDesignByBookId(bookId);

    if (!record || !record.designJson) {
      return NextResponse.json(
        { error: "Design not found for this book." },
        { status: 404 },
      );
    }

    // Resolve authorized preview URLs for all image assets in the design
    const { getStorageProvider, PHOTO_STORAGE_BUCKETS, getPreviewPath } = await import("@/lib/photos");
    const storage = getStorageProvider();
    const assets: Record<string, { previewUrl: string }> = {};

    for (const page of record.designJson.pages) {
      for (const el of page.elements) {
        if (el.type === "image" && el.assetId && !assets[el.assetId]) {
          try {
            const previewPath = getPreviewPath(record.userId || "dev_user_1", bookId, el.assetId);
            const previewUrl = await storage.createSignedDownloadUrl(
              PHOTO_STORAGE_BUCKETS.DERIVATIVES,
              previewPath,
              { expiresInSeconds: 3600 },
            );
            assets[el.assetId] = { previewUrl };
          } catch {
            assets[el.assetId] = {
              previewUrl: `/api/photos/view/${PHOTO_STORAGE_BUCKETS.DERIVATIVES}/${record.userId || "dev_user_1"}/${bookId}/${el.assetId}/preview.jpg`,
            };
          }
        }
      }
    }

    return NextResponse.json({
      design: record.designJson,
      assets,
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
