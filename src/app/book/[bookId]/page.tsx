"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GenerationProgressState } from "@/lib/jobs/types";

interface PageProps {
  params: Promise<{ bookId: string }>;
}

export default function BookDetailPage({ params }: PageProps) {
  const { bookId } = use(params);
  const router = useRouter();

  const [state, setState] = useState<GenerationProgressState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Poll generation status
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let isMounted = true;

    async function checkStatus() {
      try {
        const res = await fetch(`/api/books/${bookId}/generation`);
        if (!res.ok) {
          throw new Error(`Failed to fetch generation state (${res.status})`);
        }
        const data: GenerationProgressState = await res.json();
        if (isMounted) {
          setState(data);
          setLoading(false);

          // If still running, poll again in 2.5s
          if (!data.isTerminal) {
            timer = setTimeout(checkStatus, 2500);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.error("Poll status error:", err);
          setLoading(false);
        }
      }
    }

    checkStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [bookId]);

  const handleRetry = async () => {
    setActionError(null);
    try {
      const res = await fetch(`/api/books/${bookId}/generate`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to trigger retry.");
      }
      // Re-trigger polling
      router.refresh();
      window.location.reload();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Retry failed");
    }
  };

  const handleCancel = async () => {
    setActionError(null);
    try {
      const res = await fetch(`/api/books/${bookId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to cancel generation.");
      }
      window.location.reload();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/books/${bookId}/export`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Export failed");
      }
      setExportUrl(data.export.downloadUrl);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading magazine status...</span>
        </div>
      </div>
    );
  }

  const isGenerating =
    state &&
    [
      "QUEUED",
      "PROCESSING_PHOTOS",
      "ANALYZING_PHOTOS",
      "CREATING_STORY",
      "DESIGNING",
    ].includes(state.status);

  const isReady = state && ["PREVIEW_READY", "EDITING"].includes(state.status);
  const isFailed = state?.status === "FAILED";
  const isCompleted = state?.status === "COMPLETED";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12 font-sans flex flex-col justify-between">
      <div className="max-w-3xl mx-auto w-full space-y-8">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1.5"
          >
            &larr; Back to Home
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
              Privacy Boundary Active
            </span>
          </div>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm">
            {actionError}
          </div>
        )}

        {/* 1. Generating State */}
        {isGenerating && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-2">
              <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Creating your magazine
              </h1>
              <p className="text-zinc-400 text-sm mt-2 max-w-md mx-auto">
                {state?.userDescription || "Understanding your memories with Vision AI..."}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 max-w-md mx-auto">
              <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden p-0.5 border border-zinc-700">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.max(5, state?.progress || 0)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-400 font-mono px-1">
                <span>{state?.currentStep}</span>
                <span>{state?.progress}%</span>
              </div>
            </div>

            {/* Stages Checklist */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-zinc-800 text-xs">
              <div className={`p-2.5 rounded-lg border ${state.progress >= 20 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-zinc-800/40 border-zinc-800 text-zinc-500"}`}>
                ✓ Photos
              </div>
              <div className={`p-2.5 rounded-lg border ${state.progress >= 40 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-zinc-800/40 border-zinc-800 text-zinc-500"}`}>
                {state.progress >= 40 ? "✓" : "•"} Vision AI
              </div>
              <div className={`p-2.5 rounded-lg border ${state.progress >= 60 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-zinc-800/40 border-zinc-800 text-zinc-500"}`}>
                {state.progress >= 60 ? "✓" : "•"} Editorial
              </div>
              <div className={`p-2.5 rounded-lg border ${state.progress >= 80 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-zinc-800/40 border-zinc-800 text-zinc-500"}`}>
                {state.progress >= 80 ? "✓" : "•"} Design
              </div>
            </div>

            {/* Reassurance Note */}
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-400 space-y-1">
              <p className="text-zinc-300 font-medium">You can safely leave this page.</p>
              <p>Your magazine will continue generating in the background. Return anytime to view your finished design.</p>
            </div>

            <div>
              <button
                onClick={handleCancel}
                className="text-xs text-zinc-500 hover:text-rose-400 transition"
              >
                Cancel generation
              </button>
            </div>
          </div>
        )}

        {/* 2. Preview Ready / Editing State */}
        {isReady && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Generation Succeeded
              </span>
            </div>

            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                Your Magazine is Ready
              </h1>
              <p className="text-zinc-400 text-sm mt-2">
                All photos have been sequenced, curated, and styled into an A4 personal magazine. You can now inspect every spread, fine-tune typography, and export to print.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Link
                href={`/book/${bookId}/edit`}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2"
              >
                <span>Open Visual Editor</span>
                <span>&rarr;</span>
              </Link>

              <button
                onClick={handleExportPdf}
                disabled={isExporting}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                    <span>Rendering Vector PDF...</span>
                  </>
                ) : (
                  <span>Export Print PDF (300 DPI)</span>
                )}
              </button>
            </div>

            {exportUrl && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <span className="text-xs text-emerald-300 font-medium">
                  ✓ PDF generated successfully!
                </span>
                <a
                  href={exportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                >
                  Download PDF &darr;
                </a>
              </div>
            )}
          </div>
        )}

        {/* 3. Failed State */}
        {isFailed && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white">
                Something went wrong
              </h1>
              <p className="text-zinc-400 text-sm mt-2 max-w-md mx-auto">
                {state?.userDescription || "Something went wrong while creating your magazine. Your uploaded photos are still safe."}
              </p>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={handleRetry}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg"
              >
                Retry Generation
              </button>
            </div>
          </div>
        )}

        {/* 4. Completed State */}
        {isCompleted && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <h1 className="text-2xl font-bold text-white">
              Magazine Completed
            </h1>
            <p className="text-zinc-400 text-sm">
              Your high-resolution vector PDF has been rendered and stored securely.
            </p>

            <div className="flex items-center gap-3">
              <Link
                href={`/book/${bookId}/edit`}
                className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-sm font-medium transition"
              >
                Open Visual Editor
              </Link>
              <button
                onClick={handleExportPdf}
                disabled={isExporting}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition"
              >
                {isExporting ? "Rendering..." : "Export New PDF"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
