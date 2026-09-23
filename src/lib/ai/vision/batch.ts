import { VISION_CONFIG } from "@/config/ai";
import {
  analyzePhoto,
  type ExtendedAnalyzeOptions,
} from "../operations/analyze-photo";
import type {
  AnalyzePhotoInput,
  BatchAnalysisResult,
  SinglePhotoAnalysisResult,
} from "./types";

export interface BatchAnalysisOptions extends ExtendedAnalyzeOptions {
  concurrency?: number;
  onProgress?: (progress: {
    completed: number;
    total: number;
    currentPhotoId: string;
    success: boolean;
  }) => void;
}

/**
 * Executes an array of async tasks with a strict concurrency limit.
 */
async function asyncPool<T, R>(
  poolLimit: number,
  items: T[],
  iteratorFn: (item: T) => Promise<R>,
): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  const executing: Set<Promise<void>> = new Set();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const p = Promise.resolve().then(() => iteratorFn(item));

    // Store result at correct index to maintain original order
    const pWithIdx = p.then((res) => {
      ret[i] = res;
    });

    const cleanup = pWithIdx.finally(() => executing.delete(cleanup));
    executing.add(cleanup);

    if (executing.size >= poolLimit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return ret;
}

/**
 * Analyzes multiple photos in controlled batches with configurable concurrency and per-photo failure isolation.
 * If one photo fails, subsequent or parallel photos continue processing.
 */
export async function analyzePhotosBatch(
  photos: AnalyzePhotoInput[],
  options?: BatchAnalysisOptions,
): Promise<BatchAnalysisResult> {
  const concurrency =
    options?.concurrency ?? VISION_CONFIG.maxConcurrentRequests ?? 1;
  const total = photos.length;
  let completed = 0;

  const results = await asyncPool<AnalyzePhotoInput, SinglePhotoAnalysisResult>(
    concurrency,
    photos,
    async (photoInput) => {
      try {
        const analysis = await analyzePhoto(photoInput, options);
        completed++;

        if (options?.onProgress) {
          options.onProgress({
            completed,
            total,
            currentPhotoId: photoInput.photoId,
            success: true,
          });
        }

        return {
          photoId: photoInput.photoId,
          status: "ANALYZED",
          analysis,
        };
      } catch (err: unknown) {
        completed++;
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (options?.onProgress) {
          options.onProgress({
            completed,
            total,
            currentPhotoId: photoInput.photoId,
            success: false,
          });
        }

        return {
          photoId: photoInput.photoId,
          status: "FAILED",
          error: errorMessage,
        };
      }
    },
  );

  const succeeded = results.filter((r) => r.status === "ANALYZED").length;
  const failed = results.filter((r) => r.status === "FAILED").length;

  return {
    total,
    succeeded,
    failed,
    results,
  };
}
