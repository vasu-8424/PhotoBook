import Link from "next/link";
import { createEmptyDesign } from "@/lib/layout/create-design";

export default function Home() {
  const a4 = createEmptyDesign("A4");
  const square = createEmptyDesign("SQUARE_210");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b border-zinc-800 pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Memory Magazine
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                AI-Powered Personal Photo Magazine Platform
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                Parts 1 – 6 Complete
              </span>
            </div>
          </div>
        </header>

        {/* Feature Navigation Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition">
            <h2 className="text-lg font-semibold text-white">
              Part 4 — Photo Asset Pipeline
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Upload photos, strip EXIF metadata, normalize orientation, and generate controlled derivatives.
            </p>
            <div className="mt-4">
              <Link
                href="/dev/photos"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
              >
                Open Photo Uploader &rarr;
              </Link>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition">
            <h2 className="text-lg font-semibold text-white">
              Part 2 — Deterministic Print Engine
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Server-side PDF generation from physical millimeter coordinates, Inter fonts, and vectors.
            </p>
            <div className="mt-4">
              <a
                href="/api/test-pdf"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-sm font-medium transition"
              >
                Render Test PDF &rarr;
              </a>
            </div>
          </div>
        </section>

        {/* Architecture Status */}
        <section className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
          <h2 className="text-lg font-semibold text-white mb-4">
            System Modules &amp; Architecture Status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Part 1</div>
              <div className="text-white font-medium mt-0.5">Canonical Design JSON</div>
              <div className="text-emerald-400 text-xs mt-1">✓ Frozen v1.0.0</div>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Part 2</div>
              <div className="text-white font-medium mt-0.5">Print Engine &amp; PDF</div>
              <div className="text-emerald-400 text-xs mt-1">✓ Frozen Deterministic</div>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Part 3</div>
              <div className="text-white font-medium mt-0.5">AI Gateway &amp; OpenRouter</div>
              <div className="text-emerald-400 text-xs mt-1">✓ Frozen Transport Layer</div>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Part 4</div>
              <div className="text-white font-medium mt-0.5">Secure Asset Pipeline</div>
              <div className="text-emerald-400 text-xs mt-1">✓ Privacy Protected</div>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Part 5</div>
              <div className="text-white font-medium mt-0.5">Vision AI Understanding</div>
              <div className="text-emerald-400 text-xs mt-1">✓ PhotoAnalysis v1.0.0</div>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Part 6</div>
              <div className="text-white font-medium mt-0.5">Editorial AI &amp; Sequencing</div>
              <div className="text-emerald-400 text-xs mt-1">✓ EditorialPlan v1.0.0</div>
            </div>
          </div>
        </section>

        {/* Canonical Design JSON Sample */}
        <section className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">
              Canonical Design Factory Sample
            </h2>
            <span className="text-xs text-zinc-400">Design JSON v1.0.0</span>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-zinc-950 border border-zinc-800 p-4 text-xs font-mono text-zinc-300 leading-relaxed max-h-96">
            {JSON.stringify(
              {
                a4,
                square,
              },
              null,
              2,
            )}
          </pre>
        </section>
      </div>
    </main>
  );
}
