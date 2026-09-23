import crypto from "crypto";
import type { BookDesign } from "@/types/design";
import { DESIGN_CONFIG } from "@/config/ai";
import type { EditorialPlan } from "../editorial/types";
import type { PhotoAnalysis } from "../vision/types";
import type { DesignRationale } from "./types";

export interface ComputeDesignCacheKeyParams {
  bookId: string;
  occasion: string;
  style: string;
  size: string;
  orientation?: string;
  editorialPlan: EditorialPlan;
  photos: PhotoAnalysis[];
  protectedPhotoIds?: string[];
  promptVersion: string;
  schemaVersion: string;
  model: string;
}

export function computeDesignCacheKey(params: ComputeDesignCacheKeyParams): string {
  // Sort photo metadata deterministically
  const sortedPhotos = [...params.photos]
    .sort((a, b) => a.photoId.localeCompare(b.photoId))
    .map((p) => ({
      photoId: p.photoId,
      orientation: p.orientation,
      category: p.scene.category,
      cropSafety: p.composition.cropSafety,
      focalPoint: p.composition.focalPoint,
    }));

  const sortedProtectedIds = [...(params.protectedPhotoIds || [])].sort();

  // Create compact representation of the editorial plan
  const editorialSummary = {
    title: params.editorialPlan.title,
    sequence: params.editorialPlan.photoSequence.map((s) => ({
      id: s.photoId,
      seq: s.sequence,
      role: s.role,
    })),
    chapters: params.editorialPlan.chapters.map((c) => ({
      id: c.id,
      photos: c.photoIds,
    })),
  };

  const payload = {
    bookId: params.bookId,
    occasion: params.occasion,
    style: params.style,
    size: params.size,
    orientation: params.orientation || "PORTRAIT",
    editorialSummary,
    photos: sortedPhotos,
    protectedPhotoIds: sortedProtectedIds,
    promptVersion: params.promptVersion,
    schemaVersion: params.schemaVersion,
    model: params.model,
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export interface CachedDesignEntry {
  design: BookDesign;
  model: string;
  rationale?: DesignRationale;
  cachedAt: number;
}

export class DesignPlanCache {
  private cache: Map<string, CachedDesignEntry> = new Map();
  private ttlMs: number;

  constructor(ttlSeconds: number = DESIGN_CONFIG.cacheTtlSeconds) {
    this.ttlMs = ttlSeconds * 1000;
  }

  public get(key: string): CachedDesignEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  public set(
    key: string,
    design: BookDesign,
    model: string,
    rationale?: DesignRationale,
  ): void {
    this.cache.set(key, {
      design,
      model,
      rationale,
      cachedAt: Date.now(),
    });
  }

  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

export const globalDesignCache = new DesignPlanCache();
