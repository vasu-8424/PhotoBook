import { NextRequest, NextResponse } from "next/server";
import {
  getBookRepository,
  createBookGenerationJob,
  runBookGeneration,
  type BookRecord,
} from "@/lib/jobs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      occasion = "TRAVEL",
      style = "EDITORIAL",
      size = "A4",
      photoIds = [],
      userId = "dev_user_1",
    } = body;

    const bookId = id || `bk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const bookRepo = getBookRepository();

    const bookRecord: BookRecord = {
      id: bookId,
      userId,
      title: title || "My Memory Magazine",
      occasion,
      style,
      size,
      status: "DRAFT",
      photoIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const book = await bookRepo.createBook(bookRecord);
    const job = await createBookGenerationJob(book.id, userId);

    // Asynchronously kick off background processing without blocking response
    void runBookGeneration(job.id).catch((err) => {
      console.error(`Background job ${job.id} failed:`, err);
    });

    return NextResponse.json({
      success: true,
      book,
      job,
    });
  } catch (err: unknown) {
    console.error("POST /api/books error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create book" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "dev_user_1";

    const bookRepo = getBookRepository();
    const books = await bookRepo.listBooksByUserId(userId);

    return NextResponse.json({ books });
  } catch (err: unknown) {
    console.error("GET /api/books error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list books" },
      { status: 500 },
    );
  }
}
