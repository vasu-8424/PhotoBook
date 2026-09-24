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
                Parts 1 – 9 Complete
              </span>
            </div>
          </div>
        </header>

        {/* Part 9 Production Hero Banner */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-950/60 via-indigo-950/40 to-zinc-900 border border-violet-800/40 p-6 md:p-8">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              Part 9 — Production Workflow &amp; Orchestration
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Create an AI-Generated Magazine in Minutes
            </h2>
            <p className="text-zinc-300 text-sm leading-relaxed">
              Upload personal photos and orchestrate the full end-to-end pipeline: secure processing, visual AI understanding, narrative editorial planning, dynamic print layout, interactive Konva editing, and vector print-ready PDF export.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/book/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition shadow-lg shadow-violet-600/30"
              >
                Create New Magazine &rarr;
              </Link>
              <Link
                href="/book/demo-magazine"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-sm font-medium transition"
              >
                View Generation Status &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* Feature Navigation Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-violet-500/20 text-violet-300 rounded border border-violet-500/30">
                  Part 8
                </span>
              </div>
              <h2 className="text-lg font-semibold text-white mt-2">
                Book Preview &amp; Konva Editor
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Interactive browser canvas editor. Move, resize, edit typography, inspect spreads, and export print-ready vector PDF.
              </p>
            </div>
            <div className="mt-4">
              <Link
                href="/book/demo-magazine/edit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition shadow-lg shadow-violet-600/20"
              >
                Open Book Editor &rarr;
              </Link>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                  Part 4
                </span>
              </div>
              <h2 className="text-lg font-semibold text-white mt-2">
                Photo Asset Pipeline
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Upload photos, strip EXIF metadata, normalize orientation, and generate controlled derivatives.
              </p>
            </div>
            <div className="mt-4">
              <Link
                href="/dev/photos"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
              >
                Open Photo Uploader &rarr;
              </Link>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-500/20 text-zinc-300 rounded border border-zinc-500/30">
                  Part 2
                </span>
              </div>
              <h2 className="text-lg font-semibold text-white mt-2">
                Deterministic Print Engine
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Server-side PDF generation from physical millimeter coordinates, Inter fonts, and vectors.
              </p>
            </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
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
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Part 7</div>
              <div className="text-white font-medium mt-0.5">Design AI &amp; Layout</div>
              <div className="text-emerald-400 text-xs mt-1">✓ Design JSON v1.0.0</div>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Part 8</div>
              <div className="text-white font-medium mt-0.5">Preview &amp; Konva Editor</div>
              <div className="text-emerald-400 text-xs mt-1">✓ Canvas &amp; Vector Export</div>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Part 9</div>
              <div className="text-white font-medium mt-0.5">Production Orchestration</div>
              <div className="text-emerald-400 text-xs mt-1">✓ Workflows &amp; Inngest</div>
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
