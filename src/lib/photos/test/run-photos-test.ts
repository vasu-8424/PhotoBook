import sharp from "sharp";
import {
  processUploadedPhoto,
  validateImageBuffer,
  deleteAllAssetFiles,
  InMemoryStorageProvider,
  setStorageProvider,
  PhotoPipelineError,
  PHOTO_STORAGE_BUCKETS,
  getOriginalPath,
  getAIDerivativePath,
  getPreviewPath,
  getThumbnailPath,
} from "../index";

export async function runPhotosTests(): Promise<void> {
  console.log("=== RUNNING PART 4 SECURE PHOTO ASSET PIPELINE TESTS ===");

  const testStorage = new InMemoryStorageProvider();
  setStorageProvider(testStorage);

  // Helper to create test image buffers using Sharp
  async function makeTestImage(
    width: number,
    height: number,
    format: "jpeg" | "png" | "webp",
    orientation?: number,
  ): Promise<Buffer> {
    let pipeline = sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 120, g: 180, b: 240 },
      },
    });

    if (orientation) {
      pipeline = pipeline.withMetadata({ orientation });
    }

    if (format === "jpeg") {
      return pipeline.jpeg().toBuffer();
    } else if (format === "png") {
      return pipeline.png().toBuffer();
    } else {
      return pipeline.webp().toBuffer();
    }
  }

  // 1. Valid JPEG Pipeline Test
  console.log("\n[Test 1] Valid JPEG upload, validation, and derivative generation...");
  const jpegBuffer = await makeTestImage(3000, 2000, "jpeg");
  const jpegResult = await processUploadedPhoto({
    originalBuffer: jpegBuffer,
    userId: "usr_alice",
    bookId: "bk_paris",
    assetId: "ast_jpeg_01",
    originalFilename: "eiffel_tower.jpg",
    reportedMimeType: "image/jpeg",
    storageProvider: testStorage,
  });

  console.log(`Status: ${jpegResult.status}`);
  console.log(`Dimensions: ${jpegResult.width}x${jpegResult.height} (${jpegResult.orientation})`);
  console.log(`AI Derivative size: ${jpegResult.aiDerivative.fileSizeBytes} bytes (dims: ${jpegResult.aiDerivative.width}x${jpegResult.aiDerivative.height})`);
  console.log(`Thumbnail size: ${jpegResult.thumbnail.fileSizeBytes} bytes (dims: ${jpegResult.thumbnail.width}x${jpegResult.thumbnail.height})`);

  if (jpegResult.status !== "READY") throw new Error("Expected READY status");
  if (jpegResult.aiDerivative.width > 2048 || jpegResult.aiDerivative.height > 2048) {
    throw new Error("AI derivative exceeds max 2048px limit");
  }
  if (jpegResult.thumbnail.width > 400 || jpegResult.thumbnail.height > 400) {
    throw new Error("Thumbnail exceeds max 400px limit");
  }
  if (!testStorage.hasFile(PHOTO_STORAGE_BUCKETS.ORIGINALS, jpegResult.originalStoragePath)) {
    throw new Error("Original file missing from storage");
  }
  if (!testStorage.hasFile(PHOTO_STORAGE_BUCKETS.DERIVATIVES, jpegResult.aiDerivative.storagePath)) {
    throw new Error("AI derivative missing from storage");
  }
  console.log("✓ Valid JPEG processing verified.");

  // 2. Valid PNG Pipeline Test
  console.log("\n[Test 2] Valid PNG pipeline...");
  const pngBuffer = await makeTestImage(1800, 2400, "png");
  const pngResult = await processUploadedPhoto({
    originalBuffer: pngBuffer,
    userId: "usr_alice",
    bookId: "bk_paris",
    assetId: "ast_png_01",
    originalFilename: "artwork.png",
    storageProvider: testStorage,
  });

  if (pngResult.orientation !== "PORTRAIT") throw new Error("Expected PORTRAIT orientation for 1800x2400");
  if (pngResult.status !== "READY") throw new Error("Expected READY status for PNG");
  console.log("✓ Valid PNG processing verified.");

  // 3. Valid WebP Pipeline Test
  console.log("\n[Test 3] Valid WebP pipeline...");
  const webpBuffer = await makeTestImage(1500, 1500, "webp");
  const webpResult = await processUploadedPhoto({
    originalBuffer: webpBuffer,
    userId: "usr_alice",
    bookId: "bk_paris",
    assetId: "ast_webp_01",
    originalFilename: "avatar.webp",
    storageProvider: testStorage,
  });

  if (webpResult.orientation !== "SQUARE") throw new Error("Expected SQUARE orientation for 1500x1500");
  if (webpResult.status !== "READY") throw new Error("Expected READY status for WebP");
  console.log("✓ Valid WebP processing verified.");

  // 4. Corrupted / Fake Image Test
  console.log("\n[Test 4] Corrupted / fake file rejection...");
  const fakeBuffer = Buffer.from("THIS_IS_NOT_AN_IMAGE_FILE_JUST_PLAIN_TEXT");
  let fakeRejected = false;
  try {
    await validateImageBuffer(fakeBuffer);
  } catch (err: unknown) {
    fakeRejected = true;
    if (err instanceof PhotoPipelineError) {
      console.log(`Rejected fake image with code: ${err.code}`);
      if (err.code !== "PHOTO_CORRUPTED" && err.code !== "PHOTO_UNSUPPORTED_FORMAT") {
        throw new Error(`Unexpected error code for corrupted file: ${err.code}`);
      }
    }
  }
  if (!fakeRejected) throw new Error("Corrupted file was not rejected");
  console.log("✓ Corrupted file properly rejected.");

  // 5. Oversized File Test (> 25MB)
  console.log("\n[Test 5] Oversized file rejection (> 25MB)...");
  const hugeFakeBuffer = Buffer.alloc(26 * 1024 * 1024); // 26 MB
  let oversizedRejected = false;
  try {
    await validateImageBuffer(hugeFakeBuffer);
  } catch (err: unknown) {
    oversizedRejected = true;
    if (err instanceof PhotoPipelineError) {
      console.log(`Rejected oversized file with code: ${err.code}`);
      if (err.code !== "PHOTO_FILE_TOO_LARGE") {
        throw new Error(`Expected PHOTO_FILE_TOO_LARGE, got: ${err.code}`);
      }
    }
  }
  if (!oversizedRejected) throw new Error("Oversized file was not rejected");
  console.log("✓ Oversized file properly rejected.");

  // 6. Excessive Dimension Test (> 12000px)
  console.log("\n[Test 6] Excessive dimension rejection...");
  let excessiveRejected = false;
  try {
    // Sharp rejects creating 13000px directly if pixel limit exceeded, or validation catches it
    const excessiveBuffer = await sharp({
      create: {
        width: 12500,
        height: 100,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    await validateImageBuffer(excessiveBuffer);
  } catch (err: unknown) {
    excessiveRejected = true;
    if (err instanceof PhotoPipelineError) {
      console.log(`Rejected excessive dimension with code: ${err.code}`);
      if (err.code !== "PHOTO_DIMENSIONS_TOO_LARGE") {
        throw new Error(`Expected PHOTO_DIMENSIONS_TOO_LARGE, got ${err.code}`);
      }
    }
  }
  if (!excessiveRejected) throw new Error("Excessive dimension was not rejected");
  console.log("✓ Excessive dimension safety guard verified.");

  // 7. EXIF Stripping Verification Test
  console.log("\n[Test 7] EXIF metadata stripping test...");
  // Create an image with EXIF metadata (orientation = 6 and simulated EXIF)
  const exifOriginal = await makeTestImage(2000, 1000, "jpeg", 6);
  const exifOrigMeta = await sharp(exifOriginal).metadata();
  console.log("Original has EXIF orientation:", exifOrigMeta.orientation);
  if (!exifOrigMeta.orientation && !exifOrigMeta.exif) {
    throw new Error("Failed to construct test image with EXIF metadata");
  }

  const exifProcessResult = await processUploadedPhoto({
    originalBuffer: exifOriginal,
    userId: "usr_alice",
    bookId: "bk_paris",
    assetId: "ast_exif_test",
    originalFilename: "exif_photo.jpg",
    storageProvider: testStorage,
  });

  // Verify the AI derivative buffer has NO EXIF metadata
  const aiDerivativeMeta = await sharp(exifProcessResult.aiDerivative.buffer).metadata();
  console.log("AI derivative has EXIF:", Boolean(aiDerivativeMeta.exif));
  console.log("AI derivative orientation:", aiDerivativeMeta.orientation);

  if (aiDerivativeMeta.exif !== undefined) {
    throw new Error("EXIF metadata was NOT stripped from AI derivative!");
  }
  // Orientation should be 1 (normalized default) or undefined in stripped JPEG
  if (aiDerivativeMeta.orientation && aiDerivativeMeta.orientation !== 1) {
    throw new Error("EXIF orientation was not normalized to standard 1!");
  }
  console.log("✓ EXIF removal from derivatives verified.");

  // 8. Orientation Normalization Test
  console.log("\n[Test 8] Orientation normalization test...");
  // An original that is 2000x1000 with orientation 6 (rotate 90 deg clockwise)
  // After .rotate(), physical pixels become 1000x2000 (PORTRAIT)
  console.log(`Original dimensions reported: ${exifOrigMeta.width}x${exifOrigMeta.height}`);
  console.log(`Processed dimensions: ${exifProcessResult.width}x${exifProcessResult.height}`);
  console.log(`Detected orientation: ${exifProcessResult.orientation}`);
  if (exifProcessResult.orientation !== "PORTRAIT") {
    throw new Error("Orientation normalization failed to orient rotated EXIF photo");
  }
  console.log("✓ Orientation normalization verified.");

  // 9. User Isolation & Path Scoping Test
  console.log("\n[Test 9] User isolation and storage path scoping...");
  const userAPath = getOriginalPath("user_A", "book_1", "asset_1");
  const userBPath = getOriginalPath("user_B", "book_1", "asset_1");
  console.log("User A path:", userAPath);
  console.log("User B path:", userBPath);
  if (!userAPath.startsWith("userA/") && !userAPath.startsWith("user_A/")) {
    throw new Error("Path missing user scoping prefix");
  }
  if (userAPath === userBPath) {
    throw new Error("User paths collude");
  }
  console.log("✓ User-scoped paths verified.");

  // 10. Deletion and Cleanup Test
  console.log("\n[Test 10] Deletion & cleanup test...");
  const deleteAssetId = "ast_to_delete";
  await processUploadedPhoto({
    originalBuffer: jpegBuffer,
    userId: "usr_alice",
    bookId: "bk_paris",
    assetId: deleteAssetId,
    originalFilename: "temp.jpg",
    storageProvider: testStorage,
  });

  const origP = getOriginalPath("usr_alice", "bk_paris", deleteAssetId);
  const aiP = getAIDerivativePath("usr_alice", "bk_paris", deleteAssetId);
  const prevP = getPreviewPath("usr_alice", "bk_paris", deleteAssetId);
  const thumbP = getThumbnailPath("usr_alice", "bk_paris", deleteAssetId);

  if (!testStorage.hasFile(PHOTO_STORAGE_BUCKETS.ORIGINALS, origP)) {
    throw new Error("Asset not stored before delete");
  }

  await deleteAllAssetFiles("usr_alice", "bk_paris", deleteAssetId, testStorage);

  if (testStorage.hasFile(PHOTO_STORAGE_BUCKETS.ORIGINALS, origP)) {
    throw new Error("Original file not deleted");
  }
  if (testStorage.hasFile(PHOTO_STORAGE_BUCKETS.DERIVATIVES, aiP)) {
    throw new Error("AI derivative file not deleted");
  }
  if (testStorage.hasFile(PHOTO_STORAGE_BUCKETS.DERIVATIVES, prevP)) {
    throw new Error("Preview derivative file not deleted");
  }
  if (testStorage.hasFile(PHOTO_STORAGE_BUCKETS.THUMBNAILS, thumbP)) {
    throw new Error("Thumbnail file not deleted");
  }
  console.log("✓ Cleanup functions completely purged all asset files.");

  console.log("\n=== ALL PART 4 TESTS PASSED SUCCESSFULLY ===");
}

if (require.main === module) {
  runPhotosTests().catch((err) => {
    console.error("Photos test execution failed:", err);
    process.exit(1);
  });
}
