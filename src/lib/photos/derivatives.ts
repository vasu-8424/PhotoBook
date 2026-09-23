import sharp from "sharp";
import { DERIVATIVE_SPECS } from "@/config/photos";
import { PhotoPipelineError } from "./errors";
import { getAIDerivativePath, getPreviewPath } from "./paths";
import type { GeneratedDerivative } from "./types";

export async function generateAIDerivative(
  inputBuffer: Buffer,
  userId: string,
  bookId: string,
  assetId: string,
): Promise<GeneratedDerivative> {
  try {
    const spec = DERIVATIVE_SPECS.AI;

    // .rotate() normalizes orientation according to EXIF
    // Without .withMetadata(), Sharp strips all EXIF, GPS, and camera metadata completely
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
      storagePath: getAIDerivativePath(userId, bookId, assetId),
    };
  } catch (err: unknown) {
    throw new PhotoPipelineError(
      `Failed to generate AI derivative: ${err instanceof Error ? err.message : String(err)}`,
      "PHOTO_PROCESSING_FAILED",
      { assetId, error: err },
    );
  }
}

export async function generatePreviewDerivative(
  inputBuffer: Buffer,
  userId: string,
  bookId: string,
  assetId: string,
): Promise<GeneratedDerivative> {
  try {
    const spec = DERIVATIVE_SPECS.PREVIEW;

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
      storagePath: getPreviewPath(userId, bookId, assetId),
    };
  } catch (err: unknown) {
    throw new PhotoPipelineError(
      `Failed to generate preview derivative: ${err instanceof Error ? err.message : String(err)}`,
      "PHOTO_PROCESSING_FAILED",
      { assetId, error: err },
    );
  }
}
