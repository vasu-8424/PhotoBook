import crypto from "crypto";
import { VISION_CONFIG } from "@/config/ai";
import type { PhotoAnalysis } from "./types";

export interface AnalysisCacheKeyParams {
  photoId: string;
  derivativeIdentifier: string;
  promptVersion: string;
  model: string;
  schemaVersion: string;
}

export interface CachedAnalysisEntry {
  analysis: PhotoAnalysis;
  actualModel: string;
  cachedAt: number;
}

/**
 * Normalizes derivative URL/path by stripping ephemeral query parameters (such as signatures and expiration timestamps),
 * ensuring the cache key remains stable across different signed URL generations.
 */
export function normalizeDerivativeIdentifier(urlOrPath: string): string {
  try {
    const parsed = new URL(urlOrPath);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    // If not a full URL, strip query string manually
    return urlOrPath.split("?")[0];
  }
}

/**
 * Computes deterministic cache key for photo analysis based on Section 37:
 * photoId + AI derivative version/path + prompt version + model + schema version
 */
export function computeAnalysisCacheKey(params: AnalysisCacheKeyParams): string {
  const normalizedDerivative = normalizeDerivativeIdentifier(
    params.derivativeIdentifier,
  );

  const rawKey = [
    params.photoId,
    normalizedDerivative,
    params.promptVersion,
    params.model,
    params.schemaVersion,
  ].join("|");

  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export class PhotoAnalysisCache {
  private cache: Map<string, CachedAnalysisEntry> = new Map();
  private ttlMs: number;

  constructor(ttlSeconds: number = VISION_CONFIG.cacheTtlSeconds) {
    this.ttlMs = ttlSeconds * 1000;
  }

  public get(key: string): CachedAnalysisEntry | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return entry;
  }

  public set(
    key: string,
    analysis: PhotoAnalysis,
    actualModel: string,
  ): void {
    this.cache.set(key, {
      analysis,
      actualModel,
      cachedAt: Date.now(),
    });
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

// Global active cache instance
export const globalAnalysisCache = new PhotoAnalysisCache();
