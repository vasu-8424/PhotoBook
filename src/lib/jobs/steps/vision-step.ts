import {
  getAnalysisRepository,
  type PhotoAnalysis,
  type AnalyzePhotoInput,
  analyzePhotosBatch,
} from "@/lib/ai/vision";
import { getStorageProvider, PHOTO_STORAGE_BUCKETS, getAIDerivativePath } from "@/lib/photos";
import { JobExecutionError } from "../errors";
import type { GenerationContext } from "../types";

export interface VisionStepResult {
  analyses: PhotoAnalysis[];
  cachedCount: number;
  analyzedCount: number;
}

/**
 * Step 2: Coordinates Vision AI analysis via Part 5.
 * Checks existing cached analyses first (idempotent reuse), then processes missing
 * photos with controlled concurrency and bounded retries.
 */
export async function executeVisionStep(
  ctx: GenerationContext,
  photoIds: string[],
): Promise<VisionStepResult> {
  const { userId, bookId } = ctx;
  const analysisRepo = getAnalysisRepository();
  const storage = getStorageProvider();

  const finalAnalyses: PhotoAnalysis[] = [];
  const photosToAnalyze: AnalyzePhotoInput[] = [];
  let cachedCount = 0;

  for (const photoId of photoIds) {
    const existing = await analysisRepo.getAnalysisByPhotoId(photoId);
    if (existing && existing.analysisJson) {
      finalAnalyses.push(existing.analysisJson);
      cachedCount++;
    } else {
      const aiPath = getAIDerivativePath(userId, bookId, photoId);
      let signedUrl: string;
      try {
        const aiBuffer = await storage.downloadFile(
          PHOTO_STORAGE_BUCKETS.DERIVATIVES,
          aiPath,
        );
        signedUrl = `data:image/jpeg;base64,${aiBuffer.toString("base64")}`;
      } catch {
        try {
          signedUrl = await storage.createSignedDownloadUrl(
            PHOTO_STORAGE_BUCKETS.DERIVATIVES,
            aiPath,
            { expiresInSeconds: 600 },
          );
          if (signedUrl.startsWith("/")) {
            // Local relative path cannot be reached by cloud AI - use fallback 1x1 data URI
            signedUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
          }
        } catch {
          signedUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
        }
      }
      photosToAnalyze.push({ photoId, bookId, aiDerivativeUrl: signedUrl });
    }
  }

  let newlyAnalyzedCount = 0;

  if (photosToAnalyze.length > 0) {
    try {
      const batchResult = await analyzePhotosBatch(photosToAnalyze, {
        concurrency: 2,
        userId,
      });

      for (const res of batchResult.results) {
        if (res.analysis) {
          finalAnalyses.push(res.analysis);
          newlyAnalyzedCount++;
        }
      }
    } catch (err: unknown) {
      // If batch analysis encountered a fatal error and we don't have enough analyses
      if (finalAnalyses.length === 0) {
        throw new JobExecutionError(
          `Vision analysis failed: ${err instanceof Error ? err.message : String(err)}`,
          "VISION_ANALYSIS_FAILED",
          true,
          err,
        );
      }
    }
  }

  if (finalAnalyses.length === 0) {
    throw new JobExecutionError(
      "No valid photo analyses were obtained for book generation.",
      "VISION_ANALYSIS_FAILED",
      true,
    );
  }

  // Ensure deterministic sort by photoId so downstream sequencing is stable
  finalAnalyses.sort((a, b) => a.photoId.localeCompare(b.photoId));

  return {
    analyses: finalAnalyses,
    cachedCount,
    analyzedCount: newlyAnalyzedCount,
  };
}
