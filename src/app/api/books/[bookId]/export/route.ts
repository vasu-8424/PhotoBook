import { NextRequest, NextResponse } from "next/server";
import {
  executePdfExport,
  getExportRepository,
  getBookRepository,
} from "@/lib/jobs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await context.params;
    let userId = "dev_user_1";

    try {
      const body = await request.json();
      if (body.userId) userId = body.userId;
    } catch {
      // Body may be empty
    }

    const exportId = `exp_${bookId}_${Date.now()}`;
    const result = await executePdfExport({
      exportId,
      bookId,
      userId,
    });

    const bookRepo = getBookRepository();
    await bookRepo.updateBookStatus(bookId, "COMPLETED");

    return NextResponse.json({
      success: true,
      export: result,
    });
  } catch (err: unknown) {
    console.error("POST /api/books/[bookId]/export error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to execute PDF export" },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await context.params;
    const exportRepo = getExportRepository();
    const latestExport = await exportRepo.getLatestExportByBookId(bookId);

    if (!latestExport) {
      return NextResponse.json(
        { error: "No export found for this book." },
        { status: 404 },
      );
    }

    return NextResponse.json({ export: latestExport });
  } catch (err: unknown) {
    console.error("GET /api/books/[bookId]/export error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
