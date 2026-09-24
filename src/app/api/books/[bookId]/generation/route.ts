import { NextRequest, NextResponse } from "next/server";
import { getBookGenerationStatus } from "@/lib/jobs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await context.params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "dev_user_1";

    // Handle demo book status fallback
    if (bookId.startsWith("demo")) {
      const { getBookRepository } = await import("@/lib/jobs");
      const bookRepo = getBookRepository();
      const existing = await bookRepo.getBookById(bookId);
      if (!existing) {
        return NextResponse.json({
          bookId,
          status: "PREVIEW_READY",
          progress: 100,
          currentStep: "PREVIEW_READY",
          userDescription: "Your personal photo magazine is ready to inspect and edit.",
          isTerminal: true,
        });
      }
    }

    const status = await getBookGenerationStatus(bookId, userId);
    return NextResponse.json(status);
  } catch (err: unknown) {
    console.error("GET /api/books/[bookId]/generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get status" },
      { status: 500 },
    );
  }
}
