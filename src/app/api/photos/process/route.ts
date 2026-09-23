import { NextResponse } from "next/server";
import { PHOTO_STORAGE_BUCKETS } from "@/config/photos";
import {
  processUploadedPhoto,
  getStorageProvider,
  getUserFriendlyErrorMessage,
  PhotoPipelineError,
  generateAssetId,
} from "@/lib/photos";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // Case 1: Direct multipart upload (convenient for development test page)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const userId = (formData.get("userId") as string) || "dev_user_1";
      const bookId = (formData.get("bookId") as string) || "dev_book_1";
      const assetId = (formData.get("assetId") as string) || generateAssetId();

      if (!file) {
        return NextResponse.json(
          { error: "No photo file provided in request." },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await processUploadedPhoto({
        originalBuffer: buffer,
        userId,
        bookId,
        assetId,
        originalFilename: file.name,
        reportedMimeType: file.type,
      });

      const storage = getStorageProvider();
      const [thumbUrl, previewUrl, aiUrl] = await Promise.all([
        storage.createSignedDownloadUrl(
          PHOTO_STORAGE_BUCKETS.THUMBNAILS,
          result.thumbnail.storagePath,
          { expiresInSeconds: 900 },
        ),
        storage.createSignedDownloadUrl(
          PHOTO_STORAGE_BUCKETS.DERIVATIVES,
          result.previewDerivative.storagePath,
          { expiresInSeconds: 900 },
        ),
        storage.createSignedDownloadUrl(
          PHOTO_STORAGE_BUCKETS.DERIVATIVES,
          result.aiDerivative.storagePath,
          { expiresInSeconds: 300 },
        ),
      ]);

      return NextResponse.json({
        success: true,
        asset: {
          assetId: result.assetId,
          userId: result.userId,
          bookId: result.bookId,
          originalFilename: result.originalFilename,
          mimeType: result.mimeType,
          width: result.width,
          height: result.height,
          aspectRatio: result.aspectRatio,
          orientation: result.orientation,
          fileSizeBytes: result.fileSizeBytes,
          contentHash: result.contentHash,
          status: result.status,
          processingVersion: result.processingVersion,
          createdAt: result.createdAt,
          expiresAt: result.expiresAt,
        },
        urls: {
          thumbnailUrl: thumbUrl,
          previewUrl: previewUrl,
          aiDerivativeUrl: aiUrl,
        },
      });
    }

    // Case 2: Post-upload processing using already uploaded original
    const body = await request.json();
    const { userId, bookId, assetId, originalFilename, reportedMimeType } = body;

    if (!userId || !bookId || !assetId) {
      return NextResponse.json(
        { error: "Missing required fields: userId, bookId, and assetId are required." },
        { status: 400 },
      );
    }

    const storage = getStorageProvider();
    const originalPath = `${userId}/${bookId}/${assetId}/original`;
    const originalBuffer = await storage.downloadFile(
      PHOTO_STORAGE_BUCKETS.ORIGINALS,
      originalPath,
    );

    const result = await processUploadedPhoto({
      originalBuffer,
      userId,
      bookId,
      assetId,
      originalFilename: originalFilename || "photo.jpg",
      reportedMimeType,
      saveOriginal: false, // already in storage
    });

    const [thumbUrl, previewUrl, aiUrl] = await Promise.all([
      storage.createSignedDownloadUrl(
        PHOTO_STORAGE_BUCKETS.THUMBNAILS,
        result.thumbnail.storagePath,
        { expiresInSeconds: 900 },
      ),
      storage.createSignedDownloadUrl(
        PHOTO_STORAGE_BUCKETS.DERIVATIVES,
        result.previewDerivative.storagePath,
        { expiresInSeconds: 900 },
      ),
      storage.createSignedDownloadUrl(
        PHOTO_STORAGE_BUCKETS.DERIVATIVES,
        result.aiDerivative.storagePath,
        { expiresInSeconds: 300 },
      ),
    ]);

    return NextResponse.json({
      success: true,
      asset: {
        assetId: result.assetId,
        userId: result.userId,
        bookId: result.bookId,
        originalFilename: result.originalFilename,
        mimeType: result.mimeType,
        width: result.width,
        height: result.height,
        aspectRatio: result.aspectRatio,
        orientation: result.orientation,
        fileSizeBytes: result.fileSizeBytes,
        contentHash: result.contentHash,
        status: result.status,
        processingVersion: result.processingVersion,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
      },
      urls: {
        thumbnailUrl: thumbUrl,
        previewUrl: previewUrl,
        aiDerivativeUrl: aiUrl,
      },
    });
  } catch (err: unknown) {
    if (err instanceof PhotoPipelineError) {
      return NextResponse.json(
        { error: getUserFriendlyErrorMessage(err), code: err.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Photo processing failed.", details: String(err) },
      { status: 500 },
    );
  }
}
