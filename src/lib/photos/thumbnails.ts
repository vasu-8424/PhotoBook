import sharp from "sharp";
import { DERIVATIVE_SPECS } from "@/config/photos";
import { PhotoPipelineError } from "./errors";
import { getThumbnailPath } from "./paths";
import type { GeneratedDerivative } from "./types";

export async function generateThumbnail(
  inputBuffer: Buffer,
  userId: string,
  bookId: string,
  assetId: string,
): Promise<GeneratedDerivative> {
  try {
    const spec = DERIVATIVE_SPECS.THUMBNAIL;

    const pipeline = sharp(inputBuffer)
      .rotate()
      .resize({
        width: spec.maxDimension,
        height: spec.maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: spec.quality,
        mozjpeg: true,
      });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      width: info.width,
      height: info.height,
      format: "jpeg",
      fileSizeBytes: data.length,
      storagePath: getThumbnailPath(userId, bookId, assetId),
    };
  } catch (err: unknown) {
    throw new PhotoPipelineError(
      `Failed to generate thumbnail: ${err instanceof Error ? err.message : String(err)}`,
      "PHOTO_PROCESSING_FAILED",
      { assetId, error: err },
    );
  }
}
