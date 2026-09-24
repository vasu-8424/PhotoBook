import type { EditorialPlanRecord } from "./types";

interface EditorialPlanDbRow {
  id: string;
  book_id: string;
  user_id?: string;
  schema_version: "1.0.0";
  plan_json: EditorialPlanRecord["planJson"];
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

export interface EditorialPlanRepository {
  savePlan(record: EditorialPlanRecord): Promise<void>;
  getPlanByBookId(bookId: string): Promise<EditorialPlanRecord | null>;
  deletePlan(bookId: string): Promise<void>;
}

/**
 * In-memory repository implementation for unit testing and local development.
 */
export class InMemoryEditorialPlanRepository implements EditorialPlanRepository {
  private records: Map<string, EditorialPlanRecord> = new Map();

  public async savePlan(record: EditorialPlanRecord): Promise<void> {
    this.records.set(record.bookId, { ...record });
  }

  public async getPlanByBookId(
    bookId: string,
  ): Promise<EditorialPlanRecord | null> {
    const record = this.records.get(bookId);
    return record ? { ...record } : null;
  }

  public async deletePlan(bookId: string): Promise<void> {
    this.records.delete(bookId);
  }

  public clear(): void {
    this.records.clear();
  }
}

/**
 * Supabase-backed repository for production with Row Level Security.
 */
export class SupabaseEditorialPlanRepository implements EditorialPlanRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(supabaseClient: any) {
    this.client = supabaseClient;
  }

  public async savePlan(record: EditorialPlanRecord): Promise<void> {
    const { error } = await this.client.from("editorial_plans").upsert(
      {
        id: record.id,
        book_id: record.bookId,
        user_id: record.userId,
        schema_version: record.schemaVersion,
        plan_json: record.planJson,
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
      { onConflict: "book_id" },
    );

    if (error) {
      throw new Error(`Failed to save editorial plan to database: ${error.message}`);
    }
  }

  public async getPlanByBookId(
    bookId: string,
  ): Promise<EditorialPlanRecord | null> {
    const { data, error } = await this.client
      .from("editorial_plans")
      .select("*")
      .eq("book_id", bookId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch editorial plan: ${error.message}`);
    }

    if (!data) return null;

    const row = data as EditorialPlanDbRow;
    return {
      id: row.id,
      bookId: row.book_id,
      userId: row.user_id,
      schemaVersion: row.schema_version,
      planJson: row.plan_json,
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
    };
  }

  public async deletePlan(bookId: string): Promise<void> {
    const { error } = await this.client
      .from("editorial_plans")
      .delete()
      .eq("book_id", bookId);

    if (error) {
      throw new Error(`Failed to delete editorial plan: ${error.message}`);
    }
  }
}

const globalForEditorial = globalThis as unknown as {
  activeEditorialRepository?: EditorialPlanRepository;
};

export function setEditorialRepository(repo: EditorialPlanRepository): void {
  globalForEditorial.activeEditorialRepository = repo;
}

export function getEditorialRepository(): EditorialPlanRepository {
  if (!globalForEditorial.activeEditorialRepository) {
    globalForEditorial.activeEditorialRepository = new InMemoryEditorialPlanRepository();
  }
  return globalForEditorial.activeEditorialRepository;
}
