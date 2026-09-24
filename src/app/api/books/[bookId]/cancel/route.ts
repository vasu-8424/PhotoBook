import { NextRequest, NextResponse } from "next/server";
import { cancelBookGeneration, getJobRepository } from "@/lib/jobs";
import { JOB_TYPES } from "@/config/jobs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await context.params;
    let userId = "dev_user_1";
    let jobId: string | undefined;

    try {
      const body = await request.json();
      if (body.userId) userId = body.userId;
      if (body.jobId) jobId = body.jobId;
    } catch {
      // Body may be empty
    }

    if (!jobId) {
      const jobRepo = getJobRepository();
      const activeJob = await jobRepo.getActiveJobByBookId(
        bookId,
        JOB_TYPES.BOOK_GENERATION,
      );
      if (!activeJob) {
        return NextResponse.json(
          { error: "No active generation job to cancel." },
          { status: 400 },
        );
      }
      jobId = activeJob.id;
    }

    const cancelledJob = await cancelBookGeneration(jobId, userId);

    return NextResponse.json({
      success: true,
      job: cancelledJob,
    });
  } catch (err: unknown) {
    console.error("POST /api/books/[bookId]/cancel error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to cancel job" },
      { status: 500 },
    );
  }
}
