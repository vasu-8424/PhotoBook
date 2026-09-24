import { PHOTO_STORAGE_BUCKETS } from "@/config/photos";
import { PhotoPipelineError } from "./errors";
import {
  getOriginalPath,
  getAIDerivativePath,
  getPreviewPath,
  getThumbnailPath,
} from "./paths";
import type { SignedUrlOptions } from "./types";

export interface StorageProvider {
  createSignedUploadUrl(
    bucket: string,
    path: string,
    expiresInSeconds?: number,
  ): Promise<{ uploadUrl: string; token: string }>;

  uploadFile(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void>;

  downloadFile(bucket: string, path: string): Promise<Buffer>;

  createSignedDownloadUrl(
    bucket: string,
    path: string,
    options?: SignedUrlOptions,
  ): Promise<string>;

  deleteFiles(bucket: string, paths: string[]): Promise<void>;
}

/**
 * In-memory storage provider for deterministic local testing & offline verification.
 */
export class InMemoryStorageProvider implements StorageProvider {
  private storage: Map<string, Map<string, { buffer: Buffer; contentType: string }>> =
    new Map();

  constructor() {
    this.storage.set(PHOTO_STORAGE_BUCKETS.ORIGINALS, new Map());
    this.storage.set(PHOTO_STORAGE_BUCKETS.DERIVATIVES, new Map());
    this.storage.set(PHOTO_STORAGE_BUCKETS.THUMBNAILS, new Map());
  }

  public async createSignedUploadUrl(
    bucket: string,
    path: string,
  ): Promise<{ uploadUrl: string; token: string }> {
    return {
      uploadUrl: `https://storage.memorymagazine.internal/${bucket}/upload/${path}?token=mock_upload_token`,
      token: "mock_upload_token",
    };
  }

  public async uploadFile(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    let bucketMap = this.storage.get(bucket);
    if (!bucketMap) {
      bucketMap = new Map();
      this.storage.set(bucket, bucketMap);
    }
    bucketMap.set(path, { buffer, contentType });
  }

  public async downloadFile(bucket: string, path: string): Promise<Buffer> {
    const bucketMap = this.storage.get(bucket);
    const item = bucketMap?.get(path);
    if (!item) {
      throw new PhotoPipelineError(
        `File not found in storage: ${bucket}/${path}`,
        "PHOTO_NOT_FOUND",
      );
    }
    return item.buffer;
  }

  public async createSignedDownloadUrl(
    bucket: string,
    path: string,
    options?: SignedUrlOptions,
  ): Promise<string> {
    const bucketMap = this.storage.get(bucket);
    if (!bucketMap?.has(path)) {
      throw new PhotoPipelineError(
        `Cannot create signed URL for non-existent file: ${bucket}/${path}`,
        "PHOTO_NOT_FOUND",
      );
    }
    const expires = options?.expiresInSeconds ?? 300;
    return `/api/photos/view/${bucket}/${path}?expires=${expires}&signature=mock_sig`;
  }

  public async deleteFiles(bucket: string, paths: string[]): Promise<void> {
    const bucketMap = this.storage.get(bucket);
    if (bucketMap) {
      for (const p of paths) {
        bucketMap.delete(p);
      }
    }
  }

  public hasFile(bucket: string, path: string): boolean {
    return Boolean(this.storage.get(bucket)?.has(path));
  }

  public clear(): void {
    this.storage.forEach((map) => map.clear());
  }
}

/**
 * Supabase Storage Provider using @supabase/ssr or client
 */
export class SupabaseStorageProvider implements StorageProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(supabaseClient: any) {
    this.client = supabaseClient;
  }

  public async createSignedUploadUrl(
    bucket: string,
    path: string,
  ): Promise<{ uploadUrl: string; token: string }> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      throw new PhotoPipelineError(
        `Supabase createSignedUploadUrl failed: ${error?.message || "Unknown error"}`,
        "PHOTO_STORAGE_FAILED",
        { error },
      );
    }

    return {
      uploadUrl: data.signedUrl,
      token: data.token,
    };
  }

  public async uploadFile(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new PhotoPipelineError(
        `Supabase upload failed: ${error.message}`,
        "PHOTO_STORAGE_FAILED",
        { error },
      );
    }
  }

  public async downloadFile(bucket: string, path: string): Promise<Buffer> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .download(path);

    if (error || !data) {
      throw new PhotoPipelineError(
        `Supabase download failed: ${error?.message || "Unknown error"}`,
        "PHOTO_STORAGE_FAILED",
        { error },
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  public async createSignedDownloadUrl(
    bucket: string,
    path: string,
    options?: SignedUrlOptions,
  ): Promise<string> {
    const expiresInSeconds = options?.expiresInSeconds ?? 300;
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data) {
      throw new PhotoPipelineError(
        `Supabase createSignedUrl failed: ${error?.message || "Unknown error"}`,
        "PHOTO_STORAGE_FAILED",
        { error },
      );
    }

    return data.signedUrl;
  }

  public async deleteFiles(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await this.client.storage.from(bucket).remove(paths);
    if (error) {
      throw new PhotoPipelineError(
        `Supabase delete failed: ${error.message}`,
        "PHOTO_STORAGE_FAILED",
        { error },
      );
    }
  }
}

const globalForPhotos = globalThis as unknown as {
  activeStorageProvider?: StorageProvider;
};

export function setStorageProvider(provider: StorageProvider): void {
  globalForPhotos.activeStorageProvider = provider;
}

export function getStorageProvider(): StorageProvider {
  if (!globalForPhotos.activeStorageProvider) {
    globalForPhotos.activeStorageProvider = new InMemoryStorageProvider();
  }
  return globalForPhotos.activeStorageProvider;
}

// High-level cleanup helpers
export async function deleteOriginal(
  userId: string,
  bookId: string,
  assetId: string,
  provider = getStorageProvider(),
): Promise<void> {
  const path = getOriginalPath(userId, bookId, assetId);
  await provider.deleteFiles(PHOTO_STORAGE_BUCKETS.ORIGINALS, [path]);
}

export async function deleteDerivatives(
  userId: string,
  bookId: string,
  assetId: string,
  provider = getStorageProvider(),
): Promise<void> {
  const aiPath = getAIDerivativePath(userId, bookId, assetId);
  const previewPath = getPreviewPath(userId, bookId, assetId);
  await provider.deleteFiles(PHOTO_STORAGE_BUCKETS.DERIVATIVES, [aiPath, previewPath]);

  const thumbPath = getThumbnailPath(userId, bookId, assetId);
  await provider.deleteFiles(PHOTO_STORAGE_BUCKETS.THUMBNAILS, [thumbPath]);
}

export async function deleteAllAssetFiles(
  userId: string,
  bookId: string,
  assetId: string,
  provider = getStorageProvider(),
): Promise<void> {
  await Promise.all([
    deleteOriginal(userId, bookId, assetId, provider),
    deleteDerivatives(userId, bookId, assetId, provider),
  ]);
}
