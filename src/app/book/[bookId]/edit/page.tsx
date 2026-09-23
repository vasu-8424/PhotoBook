"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { BookEditor } from "@/components/editor/BookEditor";
import type { BookDesign } from "@/types/design";

interface PageProps {
  params: Promise<{ bookId: string }>;
}

export default function BookEditorPage({ params }: PageProps) {
  const { bookId } = use(params);

  const [design, setDesign] = useState<BookDesign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDesign() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/books/${bookId}/design`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("No design found for this book. Please generate a design first.");
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to load design (${res.status})`);
        }

        const data = await res.json();
        if (isMounted) {
          setDesign(data.design);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDesign();

    return () => {
      isMounted = false;
    };
  }, [bookId]);

  const handleSave = async (updatedDesign: BookDesign): Promise<boolean> => {
    try {
      const res = await fetch(`/api/books/${bookId}/design`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design: updatedDesign }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Save design failed:", data.error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Save design network error:", err);
      return false;
    }
  };

  const handleExportPdf = async (): Promise<void> => {
    const res = await fetch(`/api/books/${bookId}/export-pdf`, {
      method: "POST",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to export PDF from server.");
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `memory-magazine-${bookId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 font-sans">
        <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <h2 className="text-base font-semibold text-slate-200">Loading Magazine Editor...</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">Book ID: {bookId}</p>
      </div>
    );
  }

  if (error || !design) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 font-sans p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-800 flex items-center justify-center text-rose-400 mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-100 mb-1.5">Design Not Available</h2>
        <p className="text-xs text-slate-400 max-w-md mb-6">{error || "The requested book does not have an active design yet."}</p>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <BookEditor
      initialDesign={design}
      bookId={bookId}
      bookTitle="Mountain Horizons"
      onSave={handleSave}
      onExportPdf={handleExportPdf}
    />
  );
}
