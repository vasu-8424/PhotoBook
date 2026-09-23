import crypto from "crypto";
import { EDITORIAL_CONFIG } from "@/config/ai";
import type { EditorialPlan } from "./types";
import type { PhotoAnalysis } from "../vision/types";

export interface EditorialCacheKeyParams {
  bookId: string;
  occasion: string;
  style: string;
  title?: string;
  photos: PhotoAnalysis[];
  promptVersion: string;
  schemaVersion: string;
  model: string;
}

export interface CachedEditorialEntry {
  plan: EditorialPlan;
  actualModel: string;
  cachedAt: number;
}

/**
 * Computes deterministic cache key for an editorial planning request.
 * Incorporates bookId, occasion, style, user title, sorted photo analyses, prompt version, schema version, and model.
 */
export function computeEditorialCacheKey(params: EditorialCacheKeyParams): string {
  // Sort photos by photoId to ensure order independence
  const sortedPhotoSignatures = [...params.photos]
    .sort((a, b) => a.photoId.localeCompare(b.photoId))
    .map((p) => `${p.photoId}:${p.schemaVersion}:${p.visualDescription}:${p.scene.category}:${p.confidence.overall}`)
    .join(";");

  const rawKey = [
    params.bookId,
    params.occasion,
    params.style,
    params.title || "",
    sortedPhotoSignatures,
    params.promptVersion,
    params.schemaVersion,
    params.model,
  ].join("|");

  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export class EditorialPlanCache {
  private cache: Map<string, CachedEditorialEntry> = new Map();
  private ttlMs: number;

  constructor(ttlSeconds: number = EDITORIAL_CONFIG.cacheTtlSeconds) {
    this.ttlMs = ttlSeconds * 1000;
  }

  public get(key: string): CachedEditorialEntry | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return entry;
  }

  public set(key: string, plan: EditorialPlan, actualModel: string): void {
    this.cache.set(key, {
      plan,
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

// Global singleton cache instance
export const globalEditorialCache = new EditorialPlanCache();
