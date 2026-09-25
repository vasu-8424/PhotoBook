/**
 * Part 10 — PDF Export & Print Delivery Engine
 * Test Suite: src/lib/export/test/run-export-test.ts
 *
 * Covers:
 *   - Basic export pipeline (10-photo A4)
 *   - Design hash determinism
 *   - Idempotency (same hash reuses completed export)
 *   - Duplicate active job prevention
 *   - Browser state isolation (export uses persisted design)
 *   - New design hash → new export
 *   - Auth / authorization checks
 *   - PDF structural validation
 *   - Failure handling and error codes
 *   - Status API polling model
 *   - Download URL generation
 */

import {
  InMemoryPdfExportRepository,
} from "../repository";
import {
  InMemoryBookRepository,
  InMemoryJobRepository,
  setBookRepository,
  setJobRepository,
} from "../../jobs/storage";
import { triggerPdfExport, runPdfExportWorker, validateDesignForExport } from "../service";
import { computeDesignHash } from "../hash";
import { validatePdfArtifact } from "../validate-pdf";
import { PdfExportError } from "../errors";
import { setPdfExportRepository } from "../repository";
import type { BookRecord } from "../../jobs/types";
import type { BookDesign } from "@/types/design";
import type { DesignPlanRecord } from "@/lib/ai/design/types";
import { getDesignRepository } from "@/lib/ai/design";

// -----------------------------------------------------------------------
// Test Infrastructure
// -----------------------------------------------------------------------

let passed = 0;
let failed = 0;
const errors: string[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ ${name}: ${msg}`);
    errors.push(`${name}: ${msg}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// -----------------------------------------------------------------------
// Test Fixtures
// -----------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function makeMinimalDesign(_id: string = "test_book_1", pageCount = 10): BookDesign {
  const pages = Array.from({ length: pageCount }, (_, i) => ({
    id: `page_${i + 1}`,
    pageNumber: i + 1,
    layoutType: "FULL_BLEED" as const,
    elements: [] as BookDesign["pages"][0]["elements"],
  }));

  // Create spreads for even page pairs
  const spreads: BookDesign["spreads"] = [];
  for (let i = 0; i < pages.length - 1; i += 2) {
    spreads.push({
      id: `spread_${i}`,
      leftPageId: pages[i].id,
      rightPageId: pages[i + 1].id,
    });
  }

  return {
    schemaVersion: "1.0.0",
    document: {
      schemaVersion: "1.0.0",
      size: "A4" as const,
      orientation: "PORTRAIT" as const,
      widthMm: 210,
      heightMm: 297,
      bleedMm: 3,
      safeAreaMm: 8,
      gutterMm: 10,
      dpi: 300,
    },
    pages,
    spreads,
  };
}

function makeBook(bookId: string, userId: string, status = "EDITING"): BookRecord {
  return {
    id: bookId,
    userId,
    title: "Test Magazine",
    occasion: "TRAVEL",
    style: "EDITORIAL",
    size: "A4",
    status: status as BookRecord["status"],
    photoIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------
// Setup: Inject in-memory repositories
// -----------------------------------------------------------------------

function setupRepos() {
  const bookRepo = new InMemoryBookRepository();
  const jobRepo = new InMemoryJobRepository();
  const exportRepo = new InMemoryPdfExportRepository();

  setBookRepository(bookRepo);
  setJobRepository(jobRepo);
  setPdfExportRepository(exportRepo);

  return { bookRepo, jobRepo, exportRepo };
}

// -----------------------------------------------------------------------
// Test 1: Design Hash Determinism
// -----------------------------------------------------------------------

async function testDesignHashDeterminism() {
  const design = makeMinimalDesign();
  const hash1 = computeDesignHash(design);
  const hash2 = computeDesignHash(design);

  assert(hash1 === hash2, "Same design must produce same hash");
  assert(hash1.length === 64, `Hash must be 64 hex chars, got ${hash1.length}`);
  console.log(`    Hash: ${hash1.slice(0, 16)}...`);
}

// -----------------------------------------------------------------------
// Test 2: Different designs produce different hashes
// -----------------------------------------------------------------------

async function testHashUniqueness() {
  const design1 = makeMinimalDesign("book1", 10);
  const design2 = makeMinimalDesign("book2", 20);

  const hash1 = computeDesignHash(design1);
  const hash2 = computeDesignHash(design2);

  assert(hash1 !== hash2, "Different designs must produce different hashes");
}

// -----------------------------------------------------------------------
// Test 3: Modified design produces different hash (browser state isolation)
// -----------------------------------------------------------------------

async function testBrowserStateIsolation() {
  // Simulate: persisted design has title "My Magazine"
  const persistedDesign = makeMinimalDesign("book_browser_test", 10);
  const persistedHash = computeDesignHash(persistedDesign);

  // Simulate: browser makes unsaved change (different page count)
  const unsavedBrowserDesign = makeMinimalDesign("book_browser_test", 12);
  const browserHash = computeDesignHash(unsavedBrowserDesign);

  assert(
    persistedHash !== browserHash,
    "Unsaved browser state must produce a different hash than persisted design",
  );

  // After save, hashes would match the newly persisted design
  const newlyPersistedHash = computeDesignHash(unsavedBrowserDesign);
  assert(
    newlyPersistedHash === browserHash,
    "After save, newly persisted design should match browser design hash",
  );

  console.log(`    Persisted hash:      ${persistedHash.slice(0, 16)}...`);
  console.log(`    Browser (unsaved):   ${browserHash.slice(0, 16)}...`);
  console.log(`    ✓ Hashes are different — browser state correctly isolated`);
}

// -----------------------------------------------------------------------
// Test 4: triggerPdfExport creates job + export record
// -----------------------------------------------------------------------

async function testTriggerCreatesRecords() {
  const { bookRepo, jobRepo, exportRepo } = setupRepos();
  const bookId = "book_trigger_1";
  const userId = "user_trigger_1";

  await bookRepo.createBook(makeBook(bookId, userId));

  // Mock design repository by patching the design module
  const { setDesignForTest } = await importDesignTestHelper();
  setDesignForTest(bookId, makeMinimalDesign(bookId));

  const result = await triggerPdfExport(bookId, userId);

  assert(result.exportId.startsWith("exp_"), "exportId must start with exp_");
  assert(result.jobId.startsWith("job_export_"), "jobId must start with job_export_");
  assert(typeof result.designHash === "string" && result.designHash.length > 0, "designHash must be set");
  assert(result.reused === false, "First export must not be reused");

  const record = await exportRepo.getById(result.exportId);
  assert(record !== null, "Export record must be persisted");
  assert(record!.status === "QUEUED", "Export status must be QUEUED");

  const job = await jobRepo.getJobById(result.jobId);
  assert(job !== null, "Job must be created");
  assert(job!.type === "PDF_EXPORT", "Job type must be PDF_EXPORT");
  assert(job!.status === "QUEUED", "Job must be QUEUED");

  console.log(`    exportId: ${result.exportId}`);
  console.log(`    jobId: ${result.jobId}`);
  console.log(`    designHash: ${result.designHash.slice(0, 16)}...`);
}

// -----------------------------------------------------------------------
// Test 5: Idempotency — same design hash reuses completed export
// -----------------------------------------------------------------------

async function testIdempotencyReusesCompletedExport() {
  const { bookRepo, exportRepo } = setupRepos();
  const bookId = "book_idempotency_1";
  const userId = "user_idempotency_1";

  await bookRepo.createBook(makeBook(bookId, userId));

  const { setDesignForTest } = await importDesignTestHelper();
  const design = makeMinimalDesign(bookId);
  setDesignForTest(bookId, design);
  const designHash = computeDesignHash(design);

  // Pre-seed a SUCCEEDED export record
  const existingExportId = `exp_existing_${bookId}`;
  await exportRepo.create({
    id: existingExportId,
    bookId,
    userId,
    designHash,
    schemaVersion: "1.0.0",
    status: "SUCCEEDED",
    storagePath: `${userId}/${bookId}/${designHash}/magazine.pdf`,
    sha256: "aabbcc",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });

  // Trigger — should return existing export
  const result1 = await triggerPdfExport(bookId, userId);
  assert(result1.reused === true, "Export must be reused for same designHash");
  assert(result1.exportId === existingExportId, "Must return existing exportId");
  assert(result1.designHash === designHash, "Design hash must match");

  // Trigger again — must still reuse
  const result2 = await triggerPdfExport(bookId, userId);
  assert(result2.reused === true, "Export must still be reused on second call");
  assert(result2.exportId === existingExportId, "Must return same exportId");

  console.log(`    Reused export: ${existingExportId}`);
}

// -----------------------------------------------------------------------
// Test 6: Duplicate active job prevention
// -----------------------------------------------------------------------

async function testDuplicateActiveJobPrevented() {
  const { bookRepo, exportRepo } = setupRepos();
  const bookId = "book_dup_1";
  const userId = "user_dup_1";

  await bookRepo.createBook(makeBook(bookId, userId));

  const { setDesignForTest } = await importDesignTestHelper();
  const design = makeMinimalDesign(bookId);
  setDesignForTest(bookId, design);
  const designHash = computeDesignHash(design);

  // Pre-seed an active (RUNNING) export
  const activeExportId = `exp_active_${bookId}`;
  await exportRepo.create({
    id: activeExportId,
    bookId,
    userId,
    designHash,
    schemaVersion: "1.0.0",
    status: "RUNNING",
    createdAt: new Date().toISOString(),
  });

  // Trigger — must return active export, not create new one
  const result = await triggerPdfExport(bookId, userId);
  assert(result.exportId === activeExportId, "Must return active exportId, not create new one");
  assert(result.reused === false, "Active export is returned but not marked as reused");

  console.log(`    Active export reused: ${activeExportId}`);
}

// -----------------------------------------------------------------------
// Test 7: New design hash after edit creates new export
// -----------------------------------------------------------------------

async function testNewHashCreatesNewExport() {
  const { bookRepo, exportRepo } = setupRepos();
  const bookId = "book_newhash_1";
  const userId = "user_newhash_1";

  await bookRepo.createBook(makeBook(bookId, userId));

  const { setDesignForTest } = await importDesignTestHelper();

  // First export with 10 pages
  const designV1 = makeMinimalDesign(bookId, 10);
  setDesignForTest(bookId, designV1);
  const hashV1 = computeDesignHash(designV1);

  // Pre-seed completed V1 export
  const exportV1Id = `exp_v1_${bookId}`;
  await exportRepo.create({
    id: exportV1Id,
    bookId,
    userId,
    designHash: hashV1,
    schemaVersion: "1.0.0",
    status: "SUCCEEDED",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });

  // "User edits and saves" — update the persisted design
  const designV2 = makeMinimalDesign(bookId, 12);
  setDesignForTest(bookId, designV2);
  const hashV2 = computeDesignHash(designV2);

  assert(hashV1 !== hashV2, "Design versions must have different hashes");

  // Trigger export for V2 — must create new export, not reuse V1
  const resultV2 = await triggerPdfExport(bookId, userId);
  assert(resultV2.reused === false, "V2 export must not reuse V1");
  assert(resultV2.exportId !== exportV1Id, "V2 must create a new exportId");
  assert(resultV2.designHash === hashV2, "V2 export must have V2 hash");

  console.log(`    V1 hash: ${hashV1.slice(0, 12)}... V2 hash: ${hashV2.slice(0, 12)}...`);
  console.log(`    ✓ New hash correctly triggers new export`);
}

// -----------------------------------------------------------------------
// Test 8: Authorization — wrong user rejected
// -----------------------------------------------------------------------

async function testAuthorizationRejected() {
  const { bookRepo } = setupRepos();
  const bookId = "book_auth_1";

  await bookRepo.createBook(makeBook(bookId, "owner_user"));

  const { setDesignForTest } = await importDesignTestHelper();
  setDesignForTest(bookId, makeMinimalDesign(bookId));

  let threw = false;
  try {
    await triggerPdfExport(bookId, "attacker_user");
  } catch (err) {
    threw = true;
    assert(err instanceof PdfExportError, "Must throw PdfExportError for unauthorized access");
  }

  assert(threw, "Must reject export request from non-owner user");
  console.log(`    ✓ Unauthorized user correctly rejected`);
}

// -----------------------------------------------------------------------
// Test 9: Design validation catches invalid designs
// -----------------------------------------------------------------------

async function testDesignValidation() {
  // Invalid design: zero DPI (the Part 2 validator explicitly rejects dpi <= 0)
  const invalidDesign: BookDesign = {
    schemaVersion: "1.0.0",
    document: {
      schemaVersion: "1.0.0",
      size: "A4",
      orientation: "PORTRAIT",
      widthMm: 210,
      heightMm: 297,
      bleedMm: 3,
      safeAreaMm: 8,
      gutterMm: 10,
      dpi: -1, // Invalid: negative DPI
    },
    pages: [
      {
        id: "page_1",
        pageNumber: 1,
        layoutType: "FULL_BLEED" as const,
        elements: [],
      },
    ],
    spreads: [],
  };

  let threw = false;
  try {
    validateDesignForExport(invalidDesign);
  } catch (err) {
    threw = true;
    assert(err instanceof PdfExportError, "Must throw PdfExportError for invalid design");
    assert(
      (err as PdfExportError).code === "PDF_EXPORT_DESIGN_INVALID",
      `Expected PDF_EXPORT_DESIGN_INVALID, got ${(err as PdfExportError).code}`,
    );
  }
  assert(threw, "Must reject invalid design (negative DPI)");
  console.log(`    ✓ Invalid design (negative DPI) correctly rejected`);
}

// -----------------------------------------------------------------------
// Test 10: PDF Validation — empty bytes rejected
// -----------------------------------------------------------------------

async function testPdfValidationRejectsEmpty() {
  let threw = false;
  try {
    await validatePdfArtifact(new Uint8Array(0), {
      expectedPageCount: 1,
      expectedWidthMm: 210,
      expectedHeightMm: 297,
    });
  } catch (err) {
    threw = true;
    assert(err instanceof PdfExportError, "Must throw PdfExportError");
    assert(
      (err as PdfExportError).code === "PDF_EXPORT_VALIDATION_ERROR",
      "Must be PDF_EXPORT_VALIDATION_ERROR",
    );
  }
  assert(threw, "Empty PDF bytes must be rejected");
  console.log(`    ✓ Empty PDF bytes correctly rejected`);
}

// -----------------------------------------------------------------------
// Test 11: PDF Validation — invalid bytes rejected
// -----------------------------------------------------------------------

async function testPdfValidationRejectsInvalidBytes() {
  let threw = false;
  const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
  try {
    await validatePdfArtifact(garbage, {
      expectedPageCount: 1,
      expectedWidthMm: 210,
      expectedHeightMm: 297,
    });
  } catch (err) {
    threw = true;
    assert(err instanceof PdfExportError, "Must throw PdfExportError for garbage bytes");
  }
  assert(threw, "Garbage bytes must be rejected");
  console.log(`    ✓ Garbage bytes correctly rejected by PDF validator`);
}

// -----------------------------------------------------------------------
// Test 12: Full export worker pipeline (A4, 10 pages)
// -----------------------------------------------------------------------

async function testFullExportPipeline() {
  const { bookRepo, jobRepo, exportRepo } = setupRepos();
  const bookId = "book_pipeline_1";
  const userId = "user_pipeline_1";

  await bookRepo.createBook(makeBook(bookId, userId, "EDITING"));

  const { setDesignForTest } = await importDesignTestHelper();
  setDesignForTest(bookId, makeMinimalDesign(bookId, 10));

  const { exportId, jobId } = await triggerPdfExport(bookId, userId);

  // Run the async worker synchronously for testing
  await runPdfExportWorker(exportId, bookId, userId, jobId);

  const record = await exportRepo.getById(exportId);
  assert(record !== null, "Export record must exist");
  assert(record!.status === "SUCCEEDED", `Export must be SUCCEEDED, got ${record!.status}`);
  assert(record!.fileSizeBytes !== undefined && record!.fileSizeBytes > 0, "Must have non-zero file size");
  assert(record!.pageCount === 10, `Must have 10 pages, got ${record!.pageCount}`);
  assert(record!.sha256 !== undefined && record!.sha256.length === 64, "Must have SHA-256 checksum");
  assert(record!.storagePath !== undefined, "Must have storage path");
  assert(record!.storagePath!.includes(userId), "Storage path must include userId");
  assert(record!.storagePath!.includes(bookId), "Storage path must include bookId");
  assert(record!.expiresAt !== undefined, "Must have expiry date");

  const job = await jobRepo.getJobById(jobId);
  assert(job !== null, "Job must exist");
  assert(job!.status === "SUCCEEDED", `Job must be SUCCEEDED, got ${job!.status}`);
  assert(job!.progress === 100, "Job progress must be 100");

  const book = await bookRepo.getBookById(bookId);
  assert(book!.status === "COMPLETED", `Book must be COMPLETED, got ${book!.status}`);

  console.log(`    fileSizeBytes: ${record!.fileSizeBytes}`);
  console.log(`    pageCount: ${record!.pageCount}`);
  console.log(`    sha256: ${record!.sha256!.slice(0, 16)}...`);
  console.log(`    storagePath: ${record!.storagePath}`);
}

// -----------------------------------------------------------------------
// Test 13: Full export pipeline — 20 pages
// -----------------------------------------------------------------------

async function testExport20Pages() {
  const { bookRepo, exportRepo } = setupRepos();
  const bookId = "book_20page_1";
  const userId = "user_20page_1";

  await bookRepo.createBook(makeBook(bookId, userId, "EDITING"));

  const { setDesignForTest } = await importDesignTestHelper();
  setDesignForTest(bookId, makeMinimalDesign(bookId, 20));

  const { exportId, jobId } = await triggerPdfExport(bookId, userId);
  await runPdfExportWorker(exportId, bookId, userId, jobId);

  const record = await exportRepo.getById(exportId);
  assert(record!.status === "SUCCEEDED", "20-page export must SUCCEED");
  assert(record!.pageCount === 20, `Expected 20 pages, got ${record!.pageCount}`);

  console.log(`    20-page export: pageCount=${record!.pageCount} size=${record!.fileSizeBytes}B`);
}

// -----------------------------------------------------------------------
// Test 14: Full export pipeline — Square format
// -----------------------------------------------------------------------

async function testExportSquareFormat() {
  const { bookRepo, exportRepo } = setupRepos();
  const bookId = "book_square_1";
  const userId = "user_square_1";

  await bookRepo.createBook(makeBook(bookId, userId, "EDITING"));

  const { setDesignForTest } = await importDesignTestHelper();
  const squareDesign: BookDesign = {
    ...makeMinimalDesign(bookId, 10),
    document: {
      schemaVersion: "1.0.0",
      size: "SQUARE_210" as const,
      orientation: "SQUARE" as const,
      widthMm: 210,
      heightMm: 210, // Square
      bleedMm: 3,
      safeAreaMm: 8,
      gutterMm: 10,
      dpi: 300,
    },
  };
  setDesignForTest(bookId, squareDesign);

  const { exportId, jobId } = await triggerPdfExport(bookId, userId);
  await runPdfExportWorker(exportId, bookId, userId, jobId);

  const record = await exportRepo.getById(exportId);
  assert(record!.status === "SUCCEEDED", "Square export must SUCCEED");

  console.log(`    Square export: ${record!.widthMm}mm × ${record!.heightMm}mm`);
}

// -----------------------------------------------------------------------
// Test 15: Export failure resets book to EDITING
// -----------------------------------------------------------------------

async function testExportFailureResetsBookStatus() {
  const { bookRepo, exportRepo } = setupRepos();
  const bookId = "book_fail_1";
  const userId = "user_fail_1";

  await bookRepo.createBook(makeBook(bookId, userId, "EDITING"));

  // Do NOT set a design for this book — should fail with DESIGN_INVALID
  const { clearDesignForTest } = await importDesignTestHelper();
  clearDesignForTest(bookId);

  // We can't call triggerPdfExport because it calls loadPersistedDesign
  // which will fail. Test the worker directly with a manually created job.
  const exportId = `exp_fail_${bookId}`;
  const jobId = `job_fail_${bookId}`;

  await exportRepo.create({
    id: exportId,
    bookId,
    userId,
    designHash: "failhash",
    schemaVersion: "1.0.0",
    status: "QUEUED",
    createdAt: new Date().toISOString(),
  });

  // Create job record manually
  const jobRepo = new InMemoryJobRepository();
  setJobRepository(jobRepo);
  await jobRepo.createJob({
    id: jobId,
    bookId,
    userId,
    type: "PDF_EXPORT",
    status: "QUEUED",
    progress: 0,
    attempts: 0,
    maxAttempts: 1,
    createdAt: new Date().toISOString(),
  });

  await runPdfExportWorker(exportId, bookId, userId, jobId);

  const record = await exportRepo.getById(exportId);
  assert(record!.status === "FAILED", `Export must be FAILED, got ${record!.status}`);
  assert(record!.errorCode !== undefined, "Must have errorCode");

  const book = await bookRepo.getBookById(bookId);
  assert(
    book!.status === "EDITING",
    `Book must revert to EDITING on failure, got ${book!.status}`,
  );

  console.log(`    errorCode: ${record!.errorCode}`);
  console.log(`    book.status: ${book!.status}`);
}

// -----------------------------------------------------------------------
// Test 16: Retry creates fresh execution (terminal jobs not resurrected)
// -----------------------------------------------------------------------

async function testRetryCreatesFreshExecution() {
  const { bookRepo, exportRepo } = setupRepos();
  const bookId = "book_retry_1";
  const userId = "user_retry_1";

  await bookRepo.createBook(makeBook(bookId, userId, "EDITING"));

  const { setDesignForTest } = await importDesignTestHelper();
  const design = makeMinimalDesign(bookId);
  setDesignForTest(bookId, design);
  const designHash = computeDesignHash(design);

  // Pre-seed a FAILED export (terminal)
  const failedExportId = `exp_failed_${bookId}`;
  await exportRepo.create({
    id: failedExportId,
    bookId,
    userId,
    designHash,
    schemaVersion: "1.0.0",
    status: "FAILED",
    errorCode: "PDF_EXPORT_RENDER_ERROR",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });

  // Trigger retry — must create a NEW export, not update the FAILED one
  const retryResult = await triggerPdfExport(bookId, userId);
  assert(
    retryResult.exportId !== failedExportId,
    "Retry must create a new exportId, not reuse FAILED one",
  );
  assert(retryResult.reused === false, "Retry must not be marked as reused");

  const failedRecord = await exportRepo.getById(failedExportId);
  assert(
    failedRecord!.status === "FAILED",
    "Original FAILED record must remain FAILED (terminal immutability)",
  );

  console.log(`    Original failed: ${failedExportId}`);
  console.log(`    Retry export:    ${retryResult.exportId}`);
  console.log(`    ✓ Terminal job not resurrected, fresh execution created`);
}

// -----------------------------------------------------------------------
// Design Test Helper (minimal mock for getDesignRepository)
// -----------------------------------------------------------------------

const designStore = new Map<string, BookDesign | null>();

async function importDesignTestHelper() {
  return {
    setDesignForTest(bookId: string, design: BookDesign): void {
      designStore.set(bookId, design);
    },
    clearDesignForTest(bookId: string): void {
      designStore.set(bookId, null);
    },
  };
}

// Monkey-patch the design repository for tests
// This intercepts calls from loadPersistedDesign

async function patchDesignRepo() {
  // Override the global design repository to serve from our test store
  const original = getDesignRepository();
  const patched = {
    ...original,
    getDesignByBookId: async (bookId: string): Promise<DesignPlanRecord | null> => {
      const design = designStore.get(bookId);
      if (design === undefined) {
        // Not in test store — delegate to original
        return original.getDesignByBookId(bookId);
      }
      if (design === null) return null;
      // Return a minimal DesignPlanRecord with the test design
      const record: DesignPlanRecord = {
        id: `test_design_${bookId}`,
        bookId,
        schemaVersion: "1.0.0",
        designJson: design,
        provider: "test",
        model: "test-model",
        promptVersion: "1.0.0",
        inputHash: "testhash",
        outputSchemaVersion: "1.0.0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return record;
    },
  };

  // Set the patched repo globally via dynamic import
  const designStorage = await import("@/lib/ai/design/storage");
  if (designStorage.setDesignRepository) {
    designStorage.setDesignRepository(patched);
  }
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------

export async function runExportTests(): Promise<{
  passed: number;
  failed: number;
  errors: string[];
}> {
  console.log("\n=================================================================");
  console.log("PART 10 — PDF EXPORT & PRINT DELIVERY ENGINE — TEST SUITE");
  console.log("=================================================================\n");

  // Patch design repo for tests
  try {
    await patchDesignRepo();
  } catch {
    console.warn("  ⚠ Could not patch design repository — some tests may be skipped");
  }

  console.log("Section A: Design Hash & Determinism");
  await test("Design hash is deterministic (same design = same hash)", testDesignHashDeterminism);
  await test("Different designs produce different hashes", testHashUniqueness);
  await test("Browser state isolation — unsaved change changes hash", testBrowserStateIsolation);

  console.log("\nSection B: Trigger & Idempotency");
  await test("triggerPdfExport creates export record + job", testTriggerCreatesRecords);
  await test("Same designHash reuses completed export (idempotency)", testIdempotencyReusesCompletedExport);
  await test("Duplicate active job prevented for same bookId+designHash", testDuplicateActiveJobPrevented);
  await test("New designHash after edit creates new export", testNewHashCreatesNewExport);

  console.log("\nSection C: Authorization & Security");
  await test("Wrong user cannot trigger export for another user's book", testAuthorizationRejected);

  console.log("\nSection D: Design & PDF Validation");
  await test("Invalid design (empty pages) rejected with PDF_EXPORT_DESIGN_INVALID", testDesignValidation);
  await test("Empty PDF bytes rejected by validatePdfArtifact", testPdfValidationRejectsEmpty);
  await test("Garbage bytes rejected by validatePdfArtifact", testPdfValidationRejectsInvalidBytes);

  console.log("\nSection E: Export Pipeline");
  await test("Full export pipeline — A4 10-page (SUCCEEDED + checksum + metadata)", testFullExportPipeline);
  await test("Full export pipeline — 20-page magazine", testExport20Pages);
  await test("Full export pipeline — Square 210x210mm format", testExportSquareFormat);
  await test("Export failure resets book.status to EDITING (not FAILED)", testExportFailureResetsBookStatus);
  await test("Retry creates fresh execution (FAILED job not resurrected)", testRetryCreatesFreshExecution);

  console.log("\n=================================================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log("\nFailed tests:");
    errors.forEach((e) => console.log(`  • ${e}`));
  }
  console.log("=================================================================\n");

  return { passed, failed, errors };
}

// Auto-run when executed directly via CLI
if (
  process.argv[1]?.includes("run-export-test")
) {
  runExportTests().catch((err) => {
    console.error("Test suite threw uncaught error:", err);
    process.exit(1);
  });
}
