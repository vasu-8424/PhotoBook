import { NextRequest, NextResponse } from "next/server";
import { getBookRepository, getExportRepository } from "@/lib/jobs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await context.params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "dev_user_1";

    const bookRepo = getBookRepository();
    const book = await bookRepo.getBookById(bookId);

    if (!book) {
      // Support demo books for zero-config testing
      if (bookId.startsWith("demo")) {
        return NextResponse.json({
          book: {
            id: bookId,
            userId,
            title: "Alpine Solitude & High Passes",
            occasion: "TRAVEL",
            style: "EDITORIAL",
            size: "A4",
            status: "PREVIEW_READY",
            photoIds: ["demo_asset_cover", "demo_asset_spread", "demo_asset_detail"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      }
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const exportRepo = getExportRepository();
    const latestExport = await exportRepo.getLatestExportByBookId(bookId);

    return NextResponse.json({
      book,
      export: latestExport,
    });
  } catch (err: unknown) {
    console.error("GET /api/books/[bookId] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
