/**
 * Part 10 — PDF Export Test Runner API
 * GET /api/test-export — runs the Part 10 export test suite
 */
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { runExportTests } = await import("@/lib/export/test/run-export-test");
    const result = await runExportTests();

    return NextResponse.json({
      suite: "Part 10 PDF Export & Print Delivery Engine",
      passed: result.passed,
      failed: result.failed,
      total: result.passed + result.failed,
      success: result.failed === 0,
      errors: result.errors,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Test runner failed",
        suite: "Part 10 PDF Export & Print Delivery Engine",
      },
      { status: 500 },
    );
  }
}
