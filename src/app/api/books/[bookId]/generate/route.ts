import { NextRequest, NextResponse } from "next/server";
import {
  createBookGenerationJob,
  runBookGeneration,
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
      // Body may be empty on simple trigger
    }

    const bookRepo = getBookRepository();
    const book = await bookRepo.getBookById(bookId);
    if (!book && bookId.startsWith("demo")) {
      // Auto-provision demo book if not created yet
      await bookRepo.createBook({
        id: bookId,
        userId,
        title: "Alpine Solitude & High Passes",
        occasion: "TRAVEL",
        style: "EDITORIAL",
        size: "A4",
        status: "DRAFT",
        photoIds: ["demo_asset_cover", "demo_asset_spread", "demo_asset_detail"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const { getJobRepository } = await import("@/lib/jobs");
    const jobRepo = getJobRepository();
    const activeJob = await jobRepo.getActiveJobByBookId(bookId, "BOOK_GENERATION");
    if (activeJob && (activeJob.error || activeJob.attempts >= activeJob.maxAttempts)) {
      const targetStatus = activeJob.status === "QUEUED" ? "CANCELLED" : "FAILED";
      await jobRepo.updateJob(activeJob.id, {
        status: targetStatus,
        completedAt: new Date().toISOString(),
      });
    }

    const job = await createBookGenerationJob(bookId, userId);

    // Asynchronously kick off background processing without blocking response
    void runBookGeneration(job.id).catch((err) => {
      console.error(`Background job ${job.id} execution failed:`, err);
    });

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (err: unknown) {
    console.error("POST /api/books/[bookId]/generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to trigger generation" },
      { status: 500 },
    );
  }
}
