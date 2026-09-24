import { Inngest } from "inngest";
import { runBookGeneration } from "./book-generation";
import { executePdfExport } from "./steps/pdf-export";

export const inngest = new Inngest({
  id: "memory-magazine",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

/**
 * Background Inngest function for asynchronous book generation.
 * Executes the generation workflow step-by-step with resumability.
 */
export const bookGenerationFunction = inngest.createFunction(
  {
    id: "generate-book-magazine",
    name: "Generate Book Magazine Pipeline",
    retries: 2,
    triggers: [{ event: "book/generate.requested" }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const { jobId } = event.data;

    return await step.run("execute-generation-pipeline", async () => {
      return await runBookGeneration(jobId);
    });
  },
);

/**
 * Background Inngest function for asynchronous vector PDF export.
 */
export const pdfExportFunction = inngest.createFunction(
  {
    id: "export-book-pdf",
    name: "Render and Export Book PDF",
    retries: 1,
    triggers: [{ event: "book/export.requested" }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const { exportId, bookId, userId } = event.data;

    return await step.run("render-vector-pdf", async () => {
      return await executePdfExport({ exportId, bookId, userId });
    });
  },
);
