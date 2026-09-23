import type {
  PhotoAnalysisRecord,
  PhotoAnalysisStatus,
} from "./types";

interface PhotoAnalysisDbRow {
  id: string;
  photo_id: string;
  book_id: string;
  user_id?: string;
  schema_version: "1.0.0";
  analysis_json: PhotoAnalysisRecord["analysisJson"];
  provider: string;
  model: string;
  prompt_version: string;
  input_hash: string;
  output_schema_version: string;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost_usd?: number;
  created_at: string;
  updated_at: string;
}

export interface PhotoAnalysisRepository {
  saveAnalysis(record: PhotoAnalysisRecord): Promise<void>;
  getAnalysisByPhotoId(photoId: string): Promise<PhotoAnalysisRecord | null>;
  getAnalysesByBookId(bookId: string): Promise<PhotoAnalysisRecord[]>;
  getStatus(photoId: string): Promise<PhotoAnalysisStatus>;
  setStatus(
    photoId: string,
    status: PhotoAnalysisStatus,
    error?: string,
  ): Promise<void>;
  deleteAnalysis(photoId: string): Promise<void>;
}

/**
 * In-memory repository implementation for deterministic local testing & offline development.
 */
export class InMemoryPhotoAnalysisRepository implements PhotoAnalysisRepository {
  private records: Map<string, PhotoAnalysisRecord> = new Map();
  private statuses: Map<string, { status: PhotoAnalysisStatus; error?: string }> =
    new Map();

  public async saveAnalysis(record: PhotoAnalysisRecord): Promise<void> {
    this.records.set(record.photoId, { ...record });
    this.statuses.set(record.photoId, { status: "ANALYZED" });
  }

  public async getAnalysisByPhotoId(
    photoId: string,
  ): Promise<PhotoAnalysisRecord | null> {
    const record = this.records.get(photoId);
    return record ? { ...record } : null;
  }

  public async getAnalysesByBookId(
    bookId: string,
  ): Promise<PhotoAnalysisRecord[]> {
    return Array.from(this.records.values())
      .filter((r) => r.bookId === bookId)
      .map((r) => ({ ...r }));
  }

  public async getStatus(photoId: string): Promise<PhotoAnalysisStatus> {
    return this.statuses.get(photoId)?.status || "NOT_ANALYZED";
  }

  public async setStatus(
    photoId: string,
    status: PhotoAnalysisStatus,
    error?: string,
  ): Promise<void> {
    this.statuses.set(photoId, { status, error });
  }

  public async deleteAnalysis(photoId: string): Promise<void> {
    this.records.delete(photoId);
    this.statuses.delete(photoId);
  }

  public clear(): void {
    this.records.clear();
    this.statuses.clear();
  }
}

/**
 * Supabase-backed repository implementation for production with RLS.
 */
export class SupabasePhotoAnalysisRepository implements PhotoAnalysisRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(supabaseClient: any) {
    this.client = supabaseClient;
  }

  public async saveAnalysis(record: PhotoAnalysisRecord): Promise<void> {
    const { error } = await this.client.from("photo_analysis").upsert(
      {
        id: record.id,
        photo_id: record.photoId,
        book_id: record.bookId,
        user_id: record.userId,
        schema_version: record.schemaVersion,
        analysis_json: record.analysisJson,
        provider: record.provider,
        model: record.model,
        prompt_version: record.promptVersion,
        input_hash: record.inputHash,
        output_schema_version: record.outputSchemaVersion,
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        estimated_cost_usd: record.estimatedCostUsd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "photo_id" },
    );

    if (error) {
      throw new Error(`Failed to save photo analysis to database: ${error.message}`);
    }
  }

  public async getAnalysisByPhotoId(
    photoId: string,
  ): Promise<PhotoAnalysisRecord | null> {
    const { data, error } = await this.client
      .from("photo_analysis")
      .select("*")
      .eq("photo_id", photoId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch photo analysis: ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      photoId: data.photo_id,
      bookId: data.book_id,
      userId: data.user_id,
      schemaVersion: data.schema_version,
      analysisJson: data.analysis_json,
      provider: data.provider,
      model: data.model,
      promptVersion: data.prompt_version,
      inputHash: data.input_hash,
      outputSchemaVersion: data.output_schema_version,
      inputTokens: data.input_tokens,
      outputTokens: data.output_tokens,
      estimatedCostUsd: data.estimated_cost_usd,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public async getAnalysesByBookId(
    bookId: string,
  ): Promise<PhotoAnalysisRecord[]> {
    const { data, error } = await this.client
      .from("photo_analysis")
      .select("*")
      .eq("book_id", bookId);

    if (error) {
      throw new Error(`Failed to fetch analyses for book: ${error.message}`);
    }

    return (data || []).map((row: PhotoAnalysisDbRow) => ({
      id: row.id,
      photoId: row.photo_id,
      bookId: row.book_id,
      userId: row.user_id,
      schemaVersion: row.schema_version,
      analysisJson: row.analysis_json,
      provider: row.provider,
      model: row.model,
      promptVersion: row.prompt_version,
      inputHash: row.input_hash,
      outputSchemaVersion: row.output_schema_version,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      estimatedCostUsd: row.estimated_cost_usd,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  public async getStatus(photoId: string): Promise<PhotoAnalysisStatus> {
    const { data, error } = await this.client
      .from("photo_analysis_status")
      .select("status")
      .eq("photo_id", photoId)
      .maybeSingle();

    if (error || !data) return "NOT_ANALYZED";
    return data.status as PhotoAnalysisStatus;
  }

  public async setStatus(
    photoId: string,
    status: PhotoAnalysisStatus,
    errorMsg?: string,
  ): Promise<void> {
    const { error } = await this.client.from("photo_analysis_status").upsert(
      {
        photo_id: photoId,
        status,
        error_message: errorMsg || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "photo_id" },
    );

    if (error) {
      console.warn(`Failed to update analysis status in database: ${error.message}`);
    }
  }

  public async deleteAnalysis(photoId: string): Promise<void> {
    await Promise.all([
      this.client.from("photo_analysis").delete().eq("photo_id", photoId),
      this.client.from("photo_analysis_status").delete().eq("photo_id", photoId),
    ]);
  }
}

// Active repository instance (defaults to InMemory for local dev / testing)
let activeRepository: PhotoAnalysisRepository =
  new InMemoryPhotoAnalysisRepository();

export function setAnalysisRepository(repo: PhotoAnalysisRepository): void {
  activeRepository = repo;
}

export function getAnalysisRepository(): PhotoAnalysisRepository {
  return activeRepository;
}
