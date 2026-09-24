import { serve } from "inngest/next";
import { inngest, bookGenerationFunction, pdfExportFunction } from "@/lib/jobs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [bookGenerationFunction, pdfExportFunction],
});
