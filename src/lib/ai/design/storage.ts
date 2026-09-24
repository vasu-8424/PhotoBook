import { createClient } from "@supabase/supabase-js";
import type { DesignPlanRecord } from "./types";

export interface DesignRepository {
  saveDesign(record: DesignPlanRecord): Promise<void>;
  getDesignByBookId(bookId: string): Promise<DesignPlanRecord | null>;
  deleteDesignByBookId(bookId: string): Promise<void>;
}

export class InMemoryDesignRepository implements DesignRepository {
  private records: Map<string, DesignPlanRecord> = new Map();

  async saveDesign(record: DesignPlanRecord): Promise<void> {
    this.records.set(record.bookId, { ...record });
  }

  async getDesignByBookId(bookId: string): Promise<DesignPlanRecord | null> {
    const rec = this.records.get(bookId);
    return rec ? { ...rec } : null;
  }

  async deleteDesignByBookId(bookId: string): Promise<void> {
    this.records.delete(bookId);
  }

  clear(): void {
    this.records.clear();
  }
}

export class SupabaseDesignRepository implements DesignRepository {
  private supabase;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "anon-key";
    this.supabase = createClient(url, key);
  }

  async saveDesign(record: DesignPlanRecord): Promise<void> {
    const { error } = await this.supabase.from("designs").upsert(
      {
        id: record.id,
        book_id: record.bookId,
        user_id: record.userId,
        schema_version: record.schemaVersion,
        design_json: record.designJson,
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
      throw new Error(`Failed to save design record: ${error.message}`);
    }
  }

  async getDesignByBookId(bookId: string): Promise<DesignPlanRecord | null> {
    const { data, error } = await this.supabase
      .from("designs")
      .select("*")
      .eq("book_id", bookId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to retrieve design for book '${bookId}': ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      bookId: data.book_id,
      userId: data.user_id,
      schemaVersion: data.schema_version,
      designJson: data.design_json,
      provider: data.provider,
      model: data.model,
      promptVersion: data.prompt_version,
      inputHash: data.input_hash,
      outputSchemaVersion: data.output_schema_version,
      inputTokens: data.input_tokens,
      outputTokens: data.output_tokens,
      estimatedCostUsd: data.estimated_cost_usd
        ? parseFloat(data.estimated_cost_usd)
        : undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async deleteDesignByBookId(bookId: string): Promise<void> {
    const { error } = await this.supabase
      .from("designs")
      .delete()
      .eq("book_id", bookId);

    if (error) {
      throw new Error(`Failed to delete design for book '${bookId}': ${error.message}`);
    }
  }
}

const globalForDesign = globalThis as unknown as {
  defaultDesignRepository?: DesignRepository;
};

export function getDesignRepository(): DesignRepository {
  if (!globalForDesign.defaultDesignRepository) {
    globalForDesign.defaultDesignRepository = new InMemoryDesignRepository();
  }
  return globalForDesign.defaultDesignRepository;
}

export function setDesignRepository(repo: DesignRepository): void {
  globalForDesign.defaultDesignRepository = repo;
}
