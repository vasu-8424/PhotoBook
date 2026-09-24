import { createClient } from "@supabase/supabase-js";
import type { BookExportRecord, BookJob, BookRecord } from "./types";
import type { BookStatus } from "@/types/book";
import type { JobType } from "@/config/jobs";
import {
  canTransitionJob,
  isTerminalStatus,
  InvalidJobTransitionError,
  transitionJob,
} from "./state-machine";

// ============================================================================
// Repository Interfaces
// ============================================================================

export interface BookRepository {
  createBook(book: BookRecord): Promise<BookRecord>;
  getBookById(bookId: string): Promise<BookRecord | null>;
  updateBookStatus(bookId: string, status: BookStatus): Promise<void>;
  updateBook(book: Partial<BookRecord> & { id: string }): Promise<BookRecord>;
  listBooksByUserId(userId: string): Promise<BookRecord[]>;
  deleteBook(bookId: string): Promise<void>;
  clear?(): void;
}

export interface JobRepository {
  createJob(job: BookJob): Promise<BookJob>;
  getJobById(jobId: string): Promise<BookJob | null>;
  getActiveJobByBookId(bookId: string, type: JobType): Promise<BookJob | null>;
  getJobByIdempotencyKey(key: string): Promise<BookJob | null>;
  updateJob(jobId: string, updates: Partial<BookJob>): Promise<BookJob>;
  listJobsByBookId(bookId: string): Promise<BookJob[]>;
  clear?(): void;
}

export interface ExportRepository {
  createExport(record: BookExportRecord): Promise<BookExportRecord>;
  getExportById(exportId: string): Promise<BookExportRecord | null>;
  getLatestExportByBookId(bookId: string): Promise<BookExportRecord | null>;
  getExportByDesignHash(bookId: string, designHash: string): Promise<BookExportRecord | null>;
  updateExport(exportId: string, updates: Partial<BookExportRecord>): Promise<BookExportRecord>;
  clear?(): void;
}

// ============================================================================
// In-Memory Implementations (Deterministic Testing & Local Mocking)
// ============================================================================

export class InMemoryBookRepository implements BookRepository {
  private books = new Map<string, BookRecord>();

  async createBook(book: BookRecord): Promise<BookRecord> {
    const copy = { ...book };
    this.books.set(book.id, copy);
    return copy;
  }

  async getBookById(bookId: string): Promise<BookRecord | null> {
    const b = this.books.get(bookId);
    return b ? { ...b } : null;
  }

  async updateBookStatus(bookId: string, status: BookStatus): Promise<void> {
    const b = this.books.get(bookId);
    if (b) {
      b.status = status;
      b.updatedAt = new Date().toISOString();
    }
  }

  async updateBook(book: Partial<BookRecord> & { id: string }): Promise<BookRecord> {
    const existing = this.books.get(book.id);
    if (!existing) {
      throw new Error(`Book ${book.id} not found.`);
    }
    const updated: BookRecord = {
      ...existing,
      ...book,
      updatedAt: new Date().toISOString(),
    };
    this.books.set(book.id, updated);
    return { ...updated };
  }

  async listBooksByUserId(userId: string): Promise<BookRecord[]> {
    return Array.from(this.books.values())
      .filter((b) => b.userId === userId)
      .map((b) => ({ ...b }));
  }

  async deleteBook(bookId: string): Promise<void> {
    this.books.delete(bookId);
  }

  clear(): void {
    this.books.clear();
  }
}

export class InMemoryJobRepository implements JobRepository {
  private jobs = new Map<string, BookJob>();

  async createJob(job: BookJob): Promise<BookJob> {
    const copy = { ...job };
    this.jobs.set(job.id, copy);
    return copy;
  }

  async getJobById(jobId: string): Promise<BookJob | null> {
    const j = this.jobs.get(jobId);
    return j ? { ...j } : null;
  }

  async getActiveJobByBookId(bookId: string, type: JobType): Promise<BookJob | null> {
    for (const job of this.jobs.values()) {
      if (
        job.bookId === bookId &&
        job.type === type &&
        (job.status === "QUEUED" || job.status === "RUNNING")
      ) {
        return { ...job };
      }
    }
    return null;
  }

  async getJobByIdempotencyKey(key: string): Promise<BookJob | null> {
    for (const job of this.jobs.values()) {
      if (job.idempotencyKey === key) {
        return { ...job };
      }
    }
    return null;
  }

  async updateJob(jobId: string, updates: Partial<BookJob>): Promise<BookJob> {
    const existing = this.jobs.get(jobId);
    if (!existing) {
      throw new Error(`Job ${jobId} not found.`);
    }

    // Terminal Immutability (Section 9 & 79)
    if (isTerminalStatus(existing.status)) {
      if (updates.status && updates.status !== existing.status) {
        throw new InvalidJobTransitionError(
          `Cannot mutate terminal job ${jobId} from ${existing.status} to ${updates.status}. Terminal states are immutable.`,
          existing.status,
          updates.status,
          jobId,
        );
      }
      throw new InvalidJobTransitionError(
        `Cannot mutate terminal job ${jobId} in status ${existing.status}. Terminal states are immutable.`,
        existing.status,
        undefined,
        jobId,
      );
    }

    if (updates.status && updates.status !== existing.status) {
      const transitioned = transitionJob(existing, updates.status, updates);
      this.jobs.set(jobId, transitioned);
      return { ...transitioned };
    }

    const updated: BookJob = {
      ...existing,
      ...updates,
      lastHeartbeatAt: new Date().toISOString(),
    };
    this.jobs.set(jobId, updated);
    return { ...updated };
  }

  async listJobsByBookId(bookId: string): Promise<BookJob[]> {
    return Array.from(this.jobs.values())
      .filter((j) => j.bookId === bookId)
      .map((j) => ({ ...j }));
  }

  clear(): void {
    this.jobs.clear();
  }
}

export class InMemoryExportRepository implements ExportRepository {
  private exports = new Map<string, BookExportRecord>();

  async createExport(record: BookExportRecord): Promise<BookExportRecord> {
    const copy = { ...record };
    this.exports.set(record.id, copy);
    return copy;
  }

  async getExportById(exportId: string): Promise<BookExportRecord | null> {
    const exp = this.exports.get(exportId);
    return exp ? { ...exp } : null;
  }

  async getLatestExportByBookId(bookId: string): Promise<BookExportRecord | null> {
    const matching = Array.from(this.exports.values())
      .filter((e) => e.bookId === bookId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return matching.length > 0 ? { ...matching[0] } : null;
  }

  async getExportByDesignHash(bookId: string, designHash: string): Promise<BookExportRecord | null> {
    for (const exp of this.exports.values()) {
      if (exp.bookId === bookId && exp.designHash === designHash && exp.status === "COMPLETED") {
        return { ...exp };
      }
    }
    return null;
  }

  async updateExport(exportId: string, updates: Partial<BookExportRecord>): Promise<BookExportRecord> {
    const existing = this.exports.get(exportId);
    if (!existing) {
      throw new Error(`Export ${exportId} not found.`);
    }
    const updated: BookExportRecord = {
      ...existing,
      ...updates,
    };
    this.exports.set(exportId, updated);
    return { ...updated };
  }

  clear(): void {
    this.exports.clear();
  }
}

// ============================================================================
// Supabase Implementations
// ============================================================================

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "anon-key";
  return createClient(url, key);
}

export class SupabaseBookRepository implements BookRepository {
  private db = createDbClient();

  async createBook(book: BookRecord): Promise<BookRecord> {
    const { data, error } = await this.db
      .from("books")
      .insert({
        id: book.id,
        user_id: book.userId,
        title: book.title,
        occasion: book.occasion,
        style: book.style,
        size: book.size,
        status: book.status,
        photo_ids: book.photoIds,
        created_at: book.createdAt,
        updated_at: book.updatedAt,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create book: ${error?.message}`);
    }
    return book;
  }

  async getBookById(bookId: string): Promise<BookRecord | null> {
    const { data, error } = await this.db
      .from("books")
      .select()
      .eq("id", bookId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      occasion: data.occasion,
      style: data.style,
      size: data.size,
      status: data.status,
      photoIds: data.photo_ids || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateBookStatus(bookId: string, status: BookStatus): Promise<void> {
    const { error } = await this.db
      .from("books")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", bookId);

    if (error) {
      throw new Error(`Failed to update book status: ${error.message}`);
    }
  }

  async updateBook(book: Partial<BookRecord> & { id: string }): Promise<BookRecord> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (book.title !== undefined) updates.title = book.title;
    if (book.occasion !== undefined) updates.occasion = book.occasion;
    if (book.style !== undefined) updates.style = book.style;
    if (book.size !== undefined) updates.size = book.size;
    if (book.status !== undefined) updates.status = book.status;
    if (book.photoIds !== undefined) updates.photo_ids = book.photoIds;

    const { data, error } = await this.db
      .from("books")
      .update(updates)
      .eq("id", book.id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update book: ${error?.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      occasion: data.occasion,
      style: data.style,
      size: data.size,
      status: data.status,
      photoIds: data.photo_ids || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listBooksByUserId(userId: string): Promise<BookRecord[]> {
    const { data, error } = await this.db
      .from("books")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((d) => ({
      id: d.id,
      userId: d.user_id,
      title: d.title,
      occasion: d.occasion,
      style: d.style,
      size: d.size,
      status: d.status,
      photoIds: d.photo_ids || [],
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  async deleteBook(bookId: string): Promise<void> {
    const { error } = await this.db.from("books").delete().eq("id", bookId);
    if (error) {
      throw new Error(`Failed to delete book: ${error.message}`);
    }
  }
}

export class SupabaseJobRepository implements JobRepository {
  private db = createDbClient();

  async createJob(job: BookJob): Promise<BookJob> {
    const { data, error } = await this.db
      .from("jobs")
      .insert({
        id: job.id,
        book_id: job.bookId,
        user_id: job.userId,
        type: job.type,
        status: job.status,
        progress: job.progress,
        current_step: job.currentStep,
        step_details: job.stepDetails,
        attempts: job.attempts,
        max_attempts: job.maxAttempts,
        error_code: job.errorCode,
        error_message: job.errorMessage,
        error_retryable: job.errorRetryable,
        idempotency_key: job.idempotencyKey,
        created_at: job.createdAt,
        started_at: job.startedAt,
        completed_at: job.completedAt,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create job: ${error?.message}`);
    }
    return job;
  }

  async getJobById(jobId: string): Promise<BookJob | null> {
    const { data, error } = await this.db
      .from("jobs")
      .select()
      .eq("id", jobId)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapJob(data);
  }

  async getActiveJobByBookId(bookId: string, type: JobType): Promise<BookJob | null> {
    const { data, error } = await this.db
      .from("jobs")
      .select()
      .eq("book_id", bookId)
      .eq("type", type)
      .in("status", ["QUEUED", "RUNNING"])
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error || !data) return null;
    return this.mapJob(data);
  }

  async getJobByIdempotencyKey(key: string): Promise<BookJob | null> {
    const { data, error } = await this.db
      .from("jobs")
      .select()
      .eq("idempotency_key", key)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapJob(data);
  }

  async updateJob(jobId: string, updates: Partial<BookJob>): Promise<BookJob> {
    const existing = await this.getJobById(jobId);
    if (!existing) {
      throw new Error(`Job ${jobId} not found.`);
    }

    if (isTerminalStatus(existing.status)) {
      if (updates.status && updates.status !== existing.status) {
        throw new InvalidJobTransitionError(
          `Cannot mutate terminal job ${jobId} from ${existing.status} to ${updates.status}. Terminal states are immutable.`,
          existing.status,
          updates.status,
          jobId,
        );
      }
      throw new InvalidJobTransitionError(
        `Cannot mutate terminal job ${jobId} in status ${existing.status}. Terminal states are immutable.`,
        existing.status,
        undefined,
        jobId,
      );
    }

    if (updates.status && updates.status !== existing.status) {
      if (!canTransitionJob(existing.status, updates.status)) {
        throw new InvalidJobTransitionError(
          `Invalid transition for job ${jobId}: cannot transition from ${existing.status} to ${updates.status}.`,
          existing.status,
          updates.status,
          jobId,
        );
      }
    }

    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.progress !== undefined) payload.progress = updates.progress;
    if (updates.currentStep !== undefined) payload.current_step = updates.currentStep;
    if (updates.stepDetails !== undefined) payload.step_details = updates.stepDetails;
    if (updates.attempts !== undefined) payload.attempts = updates.attempts;
    if (updates.errorCode !== undefined) payload.error_code = updates.errorCode;
    if (updates.errorMessage !== undefined) payload.error_message = updates.errorMessage;
    if (updates.errorRetryable !== undefined) payload.error_retryable = updates.errorRetryable;
    if (updates.startedAt !== undefined) payload.started_at = updates.startedAt;
    if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt;

    const { data, error } = await this.db
      .from("jobs")
      .update(payload)
      .eq("id", jobId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update job: ${error?.message}`);
    }
    return this.mapJob(data);
  }

  async listJobsByBookId(bookId: string): Promise<BookJob[]> {
    const { data, error } = await this.db
      .from("jobs")
      .select()
      .eq("book_id", bookId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map((d) => this.mapJob(d));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapJob(d: any): BookJob {
    return {
      id: d.id,
      bookId: d.book_id,
      userId: d.user_id,
      type: d.type,
      status: d.status,
      progress: Number(d.progress),
      currentStep: d.current_step,
      stepDetails: d.step_details,
      attempts: d.attempts,
      maxAttempts: d.max_attempts,
      errorCode: d.error_code,
      errorMessage: d.error_message,
      errorRetryable: d.error_retryable,
      idempotencyKey: d.idempotency_key,
      createdAt: d.created_at,
      startedAt: d.started_at,
      completedAt: d.completed_at,
    };
  }
}

export class SupabaseExportRepository implements ExportRepository {
  private db = createDbClient();

  async createExport(record: BookExportRecord): Promise<BookExportRecord> {
    const { data, error } = await this.db
      .from("book_exports")
      .insert({
        id: record.id,
        book_id: record.bookId,
        user_id: record.userId,
        design_hash: record.designHash,
        status: record.status,
        storage_path: record.storagePath,
        file_size_bytes: record.fileSizeBytes,
        page_count: record.pageCount,
        download_url: record.downloadUrl,
        error_message: record.errorMessage,
        created_at: record.createdAt,
        completed_at: record.completedAt,
        expires_at: record.expiresAt,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create export record: ${error?.message}`);
    }
    return record;
  }

  async getExportById(exportId: string): Promise<BookExportRecord | null> {
    const { data, error } = await this.db
      .from("book_exports")
      .select()
      .eq("id", exportId)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapExport(data);
  }

  async getLatestExportByBookId(bookId: string): Promise<BookExportRecord | null> {
    const { data, error } = await this.db
      .from("book_exports")
      .select()
      .eq("book_id", bookId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapExport(data);
  }

  async getExportByDesignHash(bookId: string, designHash: string): Promise<BookExportRecord | null> {
    const { data, error } = await this.db
      .from("book_exports")
      .select()
      .eq("book_id", bookId)
      .eq("design_hash", designHash)
      .eq("status", "COMPLETED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapExport(data);
  }

  async updateExport(exportId: string, updates: Partial<BookExportRecord>): Promise<BookExportRecord> {
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.storagePath !== undefined) payload.storage_path = updates.storagePath;
    if (updates.fileSizeBytes !== undefined) payload.file_size_bytes = updates.fileSizeBytes;
    if (updates.pageCount !== undefined) payload.page_count = updates.pageCount;
    if (updates.downloadUrl !== undefined) payload.download_url = updates.downloadUrl;
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
      throw new Error(`Failed to update export record: ${error?.message}`);
    }
    return this.mapExport(data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapExport(d: any): BookExportRecord {
    return {
      id: d.id,
      bookId: d.book_id,
      userId: d.user_id,
      designHash: d.design_hash,
      status: d.status,
      storagePath: d.storage_path,
      fileSizeBytes: d.file_size_bytes ? Number(d.file_size_bytes) : undefined,
      pageCount: d.page_count,
      downloadUrl: d.download_url,
      errorMessage: d.error_message,
      createdAt: d.created_at,
      completedAt: d.completed_at,
      expiresAt: d.expires_at,
    };
  }
}

// ============================================================================
// Singleton Accessors & Dependency Injection
// ============================================================================

const globalForJobs = globalThis as unknown as {
  activeBookRepository?: BookRepository;
  activeJobRepository?: JobRepository;
  activeExportRepository?: ExportRepository;
};

export function getBookRepository(): BookRepository {
  if (!globalForJobs.activeBookRepository) {
    globalForJobs.activeBookRepository = new InMemoryBookRepository();
  }
  return globalForJobs.activeBookRepository;
}

export function setBookRepository(repo: BookRepository): void {
  globalForJobs.activeBookRepository = repo;
}

export function getJobRepository(): JobRepository {
  if (!globalForJobs.activeJobRepository) {
    globalForJobs.activeJobRepository = new InMemoryJobRepository();
  }
  return globalForJobs.activeJobRepository;
}

export function setJobRepository(repo: JobRepository): void {
  globalForJobs.activeJobRepository = repo;
}

export function getExportRepository(): ExportRepository {
  if (!globalForJobs.activeExportRepository) {
    globalForJobs.activeExportRepository = new InMemoryExportRepository();
  }
  return globalForJobs.activeExportRepository;
}

export function setExportRepository(repo: ExportRepository): void {
  globalForJobs.activeExportRepository = repo;
}
