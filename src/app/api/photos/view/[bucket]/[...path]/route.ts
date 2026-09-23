import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/photos/storage";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ bucket: string; path: string[] }> },
) {
  try {
    const { bucket, path } = await context.params;
    if (!bucket || !path || path.length === 0) {
      return new NextResponse("Invalid file path", { status: 400 });
    }

    const storagePath = path.join("/");
    const storage = getStorageProvider();
    const buffer = await storage.downloadFile(bucket, storagePath);

    const ext = storagePath.split(".").pop()?.toLowerCase();
    const contentType =
      ext === "webp"
        ? "image/webp"
        : ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch (err: unknown) {
    return new NextResponse(
      err instanceof Error ? err.message : "File not found",
      { status: 404 },
    );
  }
}
