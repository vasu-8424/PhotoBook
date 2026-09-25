/**
 * Part 10 — PDF Export & Print Delivery Engine
 * lib/export/repository.ts
 *
 * Repository interface and implementations for the pdf_exports table.
 * The Supabase implementation uses the extended Part 10 schema columns.
 */

import { createClient } from "@supabase/supabase-js";
import type { PdfExportRecord, PdfExportStatus } from "./types";

// -----------------------------------------------------------------------
// Repository Interface
// -----------------------------------------------------------------------

export interface PdfExportRepository {
  create(record: PdfExportRecord): Promise<PdfExportRecord>;
  getById(exportId: string): Promise<PdfExportRecord | null>;
  getLatestByBookId(bookId: string): Promise<PdfExportRecord | null>;
  getByDesignHash(bookId: string, designHash: string): Promise<PdfExportRecord | null>;
  getActiveByBookId(
    bookId: string,
    designHash?: string,
  ): Promise<PdfExportRecord | null>;
  update(exportId: string, updates: Partial<PdfExportRecord>): Promise<PdfExportRecord>;
  clear?(): void;
}

// -----------------------------------------------------------------------
// In-Memory Implementation (dev / tests)
// -----------------------------------------------------------------------

export class InMemoryPdfExportRepository implements PdfExportRepository {
  private records = new Map<string, PdfExportRecord>();

  async create(record: PdfExportRecord): Promise<PdfExportRecord> {
    const copy = { ...record };
    this.records.set(record.id, copy);
    return copy;
  }

  async getById(exportId: string): Promise<PdfExportRecord | null> {
    const r = this.records.get(exportId);
    return r ? { ...r } : null;
  }

  async getLatestByBookId(bookId: string): Promise<PdfExportRecord | null> {
    const matching = Array.from(this.records.values())
      .filter((r) => r.bookId === bookId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return matching.length > 0 ? { ...matching[0] } : null;
  }

  async getByDesignHash(bookId: string, designHash: string): Promise<PdfExportRecord | null> {
    for (const r of this.records.values()) {
      if (r.bookId === bookId && r.designHash === designHash && r.status === "SUCCEEDED") {
        return { ...r };
      }
    }
    return null;
  }

  async getActiveByBookId(
    bookId: string,
    designHash?: string,
  ): Promise<PdfExportRecord | null> {
    const active: PdfExportStatus[] = ["QUEUED", "RUNNING"];
    for (const r of this.records.values()) {
      if (
        r.bookId === bookId &&
        active.includes(r.status) &&
        (!designHash || r.designHash === designHash)
      ) {
        return { ...r };
      }
    }
    return null;
  }

  async update(exportId: string, updates: Partial<PdfExportRecord>): Promise<PdfExportRecord> {
    const existing = this.records.get(exportId);
    if (!existing) {
      throw new Error(`PdfExportRecord ${exportId} not found.`);
    }
    const updated = { ...existing, ...updates };
    this.records.set(exportId, updated);
    return { ...updated };
  }

  clear(): void {
    this.records.clear();
  }
}

// -----------------------------------------------------------------------
// Supabase Implementation
// -----------------------------------------------------------------------

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "anon-key";
  return createClient(url, key);
}

export class SupabasePdfExportRepository implements PdfExportRepository {
  private db = createDbClient();

  async create(record: PdfExportRecord): Promise<PdfExportRecord> {
    const { data, error } = await this.db
      .from("book_exports")
      .insert({
        id: record.id,
        book_id: record.bookId,
        job_id: record.jobId,
        user_id: record.userId,
        design_id: record.designId,
        design_hash: record.designHash,
        schema_version: record.schemaVersion,
        status: record.status,
        storage_path: record.storagePath,
        file_size_bytes: record.fileSizeBytes,
        page_count: record.pageCount,
        width_mm: record.widthMm,
        height_mm: record.heightMm,
        sha256: record.sha256,
        error_code: record.errorCode,
        error_message: record.errorMessage,
        created_at: record.createdAt,
        completed_at: record.completedAt,
        expires_at: record.expiresAt,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create pdf_export record: ${error?.message}`);
    }
    return record;
  }

  async getById(exportId: string): Promise<PdfExportRecord | null> {
    const { data, error } = await this.db
      .from("book_exports")
      .select()
      .eq("id", exportId)
      .maybeSingle();

    if (error || !data) return null;
    return this.map(data);
  }

  async getLatestByBookId(bookId: string): Promise<PdfExportRecord | null> {
    const { data, error } = await this.db
      .from("book_exports")
      .select()
      .eq("book_id", bookId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return this.map(data);
  }

  async getByDesignHash(bookId: string, designHash: string): Promise<PdfExportRecord | null> {
    const { data, error } = await this.db
      .from("book_exports")
      .select()
      .eq("book_id", bookId)
      .eq("design_hash", designHash)
      .eq("status", "SUCCEEDED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return this.map(data);
  }

  async getActiveByBookId(
    bookId: string,
    designHash?: string,
  ): Promise<PdfExportRecord | null> {
    let query = this.db
      .from("book_exports")
      .select()
      .eq("book_id", bookId)
      .in("status", ["QUEUED", "RUNNING"]);

    if (designHash) {
      query = query.eq("design_hash", designHash);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return this.map(data);
  }

  async update(exportId: string, updates: Partial<PdfExportRecord>): Promise<PdfExportRecord> {
    const payload: Record<string, unknown> = {};

    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.jobId !== undefined) payload.job_id = updates.jobId;
    if (updates.storagePath !== undefined) payload.storage_path = updates.storagePath;
    if (updates.fileSizeBytes !== undefined) payload.file_size_bytes = updates.fileSizeBytes;
    if (updates.pageCount !== undefined) payload.page_count = updates.pageCount;
    if (updates.widthMm !== undefined) payload.width_mm = updates.widthMm;
    if (updates.heightMm !== undefined) payload.height_mm = updates.heightMm;
    if (updates.sha256 !== undefined) payload.sha256 = updates.sha256;
    if (updates.errorCode !== undefined) payload.error_code = updates.errorCode;
    if (updates.errorMessage !== undefined) payload.error_message = updates.errorMessage;
    if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt;
    if (updates.expiresAt !== undefined) payload.expires_at = updates.expiresAt;

    const { data, error } = await this.db
      .from("book_exports")
      .update(payload)
      .eq("id", exportId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update pdf_export record: ${error?.message}`);
    }
    return this.map(data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private map(d: any): PdfExportRecord {
    // Normalise legacy COMPLETED status from Part 9 schema to SUCCEEDED
    let status = d.status as PdfExportStatus;
    if ((status as string) === "COMPLETED") status = "SUCCEEDED";

    return {
      id: d.id,
      bookId: d.book_id,
      jobId: d.job_id ?? undefined,
      userId: d.user_id,
      designId: d.design_id ?? undefined,
      designHash: d.design_hash,
      schemaVersion: d.schema_version ?? "1.0.0",
      status,
      storagePath: d.storage_path ?? undefined,
      fileSizeBytes: d.file_size_bytes ? Number(d.file_size_bytes) : undefined,
      pageCount: d.page_count ? Number(d.page_count) : undefined,
      widthMm: d.width_mm ? Number(d.width_mm) : undefined,
      heightMm: d.height_mm ? Number(d.height_mm) : undefined,
      sha256: d.sha256 ?? undefined,
      errorCode: d.error_code ?? undefined,
      errorMessage: d.error_message ?? undefined,
      createdAt: d.created_at,
      completedAt: d.completed_at ?? undefined,
      expiresAt: d.expires_at ?? undefined,
    };
  }
}

// -----------------------------------------------------------------------
// Singleton Accessor (mirrors the pattern in lib/jobs/storage.ts)
// -----------------------------------------------------------------------

const globalForExport = globalThis as unknown as {
  activePdfExportRepository?: PdfExportRepository;
};

export function getPdfExportRepository(): PdfExportRepository {
  if (!globalForExport.activePdfExportRepository) {
    globalForExport.activePdfExportRepository = new InMemoryPdfExportRepository();
  }
  return globalForExport.activePdfExportRepository;
}

export function setPdfExportRepository(repo: PdfExportRepository): void {
  globalForExport.activePdfExportRepository = repo;
}
