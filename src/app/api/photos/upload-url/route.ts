import { NextResponse } from "next/server";
import {
  PHOTO_UPLOAD_CONFIG,
  SUPPORTED_PHOTO_MIME_TYPES,
  PHOTO_STORAGE_BUCKETS,
} from "@/config/photos";
import {
  generateAssetId,
  getOriginalPath,
  getStorageProvider,
  getUserFriendlyErrorMessage,
  PhotoPipelineError,
} from "@/lib/photos";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, bookId, filename, fileSizeBytes, mimeType } = body;

    if (!userId || !bookId || !filename) {
      return NextResponse.json(
        { error: "Missing required fields: userId, bookId, and filename are required." },
        { status: 400 },
      );
    }

    if (fileSizeBytes > PHOTO_UPLOAD_CONFIG.maxFileSizeBytes) {
      return NextResponse.json(
        {
          error: getUserFriendlyErrorMessage("PHOTO_FILE_TOO_LARGE"),
          code: "PHOTO_FILE_TOO_LARGE",
        },
        { status: 400 },
      );
    }

    if (
      mimeType &&
      !SUPPORTED_PHOTO_MIME_TYPES.includes(
        mimeType.toLowerCase() as (typeof SUPPORTED_PHOTO_MIME_TYPES)[number],
      )
    ) {
      return NextResponse.json(
        {
          error: getUserFriendlyErrorMessage("PHOTO_UNSUPPORTED_FORMAT"),
          code: "PHOTO_UNSUPPORTED_FORMAT",
        },
        { status: 400 },
      );
    }

    const assetId = generateAssetId();
    const storagePath = getOriginalPath(userId, bookId, assetId);
    const storage = getStorageProvider();

    const signedData = await storage.createSignedUploadUrl(
      PHOTO_STORAGE_BUCKETS.ORIGINALS,
      storagePath,
      600,
    );

    return NextResponse.json({
      assetId,
      uploadUrl: signedData.uploadUrl,
      storagePath,
      bucket: PHOTO_STORAGE_BUCKETS.ORIGINALS,
      expiresInSeconds: 600,
    });
  } catch (err: unknown) {
    if (err instanceof PhotoPipelineError) {
      return NextResponse.json(
        { error: getUserFriendlyErrorMessage(err), code: err.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to generate signed upload URL." },
      { status: 500 },
    );
  }
}
