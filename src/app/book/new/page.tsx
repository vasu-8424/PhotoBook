"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BookOccasion, BookSize, BookStyle } from "@/types/book";

interface SelectedPhoto {
  file: File;
  previewUrl: string;
  assetId?: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  error?: string;
}

export default function NewBookPage() {
  const router = useRouter();

  const [title, setTitle] = useState("Autumn Mountain Journey");
  const [occasion, setOccasion] = useState<BookOccasion>("TRAVEL");
  const [style, setStyle] = useState<BookStyle>("EDITORIAL");
  const [themeId, setThemeId] = useState<string>("WARM_EDITORIAL");
  const [typographyId, setTypographyId] = useState<string>("EDITORIAL_SERIF");
  const [size, setSize] = useState<BookSize>("A4");
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    const newItems: SelectedPhoto[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      status: "PENDING",
    }));

    setSelectedPhotos((prev) => {
      // Prevent duplicates by name and size
      const existingNames = new Set(prev.map((p) => `${p.file.name}_${p.file.size}`));
      const uniqueNew = newItems.filter(
        (p) => !existingNames.has(`${p.file.name}_${p.file.size}`),
      );
      return [...prev, ...uniqueNew];
    });

    setError(null);
  };

  const removePhoto = (index: number) => {
    setSelectedPhotos((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const targetUserId = "dev_user_1";
      const targetBookId = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const processedAssetIds: string[] = [];

      if (selectedPhotos.length > 0) {
        // Upload and process each selected photo through Part 4 pipeline
        for (let i = 0; i < selectedPhotos.length; i++) {
          const item = selectedPhotos[i];
          setUploadProgressText(
            `Processing photo ${i + 1} of ${selectedPhotos.length}: ${item.file.name}...`,
          );

          // Update item state to PROCESSING
          setSelectedPhotos((curr) => {
            const next = [...curr];
            next[i].status = "PROCESSING";
            return next;
          });

          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("userId", targetUserId);
          formData.append("bookId", targetBookId);

          const res = await fetch("/api/photos/process", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            setSelectedPhotos((curr) => {
              const next = [...curr];
              next[i].status = "FAILED";
              next[i].error = data.error || "Upload failed";
              return next;
            });
            throw new Error(
              `Failed to process photo ${item.file.name}: ${data.error || "Unknown error"}`,
            );
          }

          processedAssetIds.push(data.asset.assetId);

          setSelectedPhotos((curr) => {
            const next = [...curr];
            next[i].status = "READY";
            next[i].assetId = data.asset.assetId;
            return next;
          });
        }
      }

      setUploadProgressText("Creating magazine and launching AI orchestration...");

      // Final photo ID list (uploaded real photos or fallback starter fixtures)
      const photoIds =
        processedAssetIds.length > 0
          ? processedAssetIds
          : [
              "ast_travel_01",
              "ast_travel_02",
              "ast_travel_03",
              "ast_travel_04",
              "ast_travel_05",
              "ast_travel_06",
              "ast_travel_07",
              "ast_travel_08",
              "ast_travel_09",
              "ast_travel_10",
            ];

      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetBookId,
          title,
          occasion,
          style,
          size,
          photoIds,
          userId: targetUserId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create book");
      }

      router.push(`/book/${data.book.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Creation failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12 font-sans flex items-center justify-center">
      <div className="max-w-2xl mx-auto w-full space-y-8">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            &larr; Back to Home
          </Link>
          <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-violet-500/10 text-violet-300 rounded-full border border-violet-500/20">
            Part 9 Studio
          </span>
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Create New Magazine
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Choose your occasion, editorial aesthetic, and format. AI will sequence your photos and compose your book.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Magazine Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          {/* Occasion */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Occasion
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { id: "TRAVEL", label: "Vacation / Travel", desc: "Scenic landscapes & journey chapters" },
                  { id: "PERSONAL_MEMORIES", label: "Personal Memories", desc: "Warm moments & nostalgic rhythm" },
                ] as const
              ).map((occ) => (
                <button
                  type="button"
                  key={occ.id}
                  onClick={() => setOccasion(occ.id as BookOccasion)}
                  className={`p-3 rounded-xl border text-sm font-medium transition text-left ${
                    occasion === occ.id
                      ? "bg-violet-600/15 border-violet-500 text-white"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="font-semibold text-xs">{occ.label}</div>
                  <div className="text-[11px] text-zinc-400 mt-1">{occ.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Editorial Style
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  { id: "EDITORIAL", label: "Editorial", desc: "Classic magazine storytelling", thm: "WARM_EDITORIAL", typo: "EDITORIAL_SERIF" },
                  { id: "CINEMATIC", label: "Cinematic", desc: "Dramatic widescreen moments", thm: "MIDNIGHT_CINEMATIC", typo: "CINEMATIC" },
                  { id: "MINIMAL", label: "Minimal", desc: "Pure gallery negative space", thm: "MONOCHROME", typo: "MODERN_SANS" },
                  { id: "JOURNAL", label: "Journal", desc: "Explorer notebook & field notes", thm: "FOREST", typo: "JOURNAL" },
                ] as const
              ).map((st) => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => {
                    setStyle(st.id as BookStyle);
                    setThemeId(st.thm);
                    setTypographyId(st.typo);
                  }}
                  className={`p-3 rounded-xl border text-left transition ${
                    style === st.id
                      ? "bg-indigo-600/20 border-indigo-500 text-white shadow-sm"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="font-semibold text-xs">{st.label}</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">{st.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Visual Theme Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Visual Theme & Palette
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: "WARM_EDITORIAL", label: "Warm Editorial", bg: "#F5F1EA", accent: "#B76E4C" },
                { id: "SOFT_SAND", label: "Soft Sand", bg: "#F2EEE7", accent: "#C6A77B" },
                { id: "MONOCHROME", label: "Monochrome", bg: "#F7F7F5", accent: "#222222" },
                { id: "FOREST", label: "Forest", bg: "#EEF1EA", accent: "#879B7D" },
                { id: "DUSTY_ROSE", label: "Dusty Rose", bg: "#F5ECEB", accent: "#B68C91" },
                { id: "MIDNIGHT_CINEMATIC", label: "Midnight", bg: "#151515", accent: "#B28B5E" },
              ].map((thm) => (
                <button
                  type="button"
                  key={thm.id}
                  onClick={() => setThemeId(thm.id)}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                    themeId === thm.id
                      ? "bg-zinc-800 border-indigo-500 text-white shadow-sm"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center -space-x-1 shrink-0">
                    <span className="w-3.5 h-3.5 rounded-full border border-black/40" style={{ backgroundColor: thm.bg }} />
                    <span className="w-3.5 h-3.5 rounded-full border border-black/40" style={{ backgroundColor: thm.accent }} />
                  </div>
                  <span className="text-[11px] font-medium truncate">{thm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Typography Mood */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Typography Mood
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: "EDITORIAL_SERIF", label: "Editorial Serif", sample: "Serif Classic" },
                { id: "MODERN_SANS", label: "Modern Sans", sample: "Clean Swiss" },
                { id: "LUXURY_SERIF", label: "Luxury", sample: "Haute Couture" },
                { id: "CINEMATIC", label: "Cinematic", sample: "Wide Title" },
                { id: "ROMANTIC", label: "Romantic", sample: "Lyrical Flow" },
                { id: "JOURNAL", label: "Journal", sample: "Notebook Stamp" },
              ].map((tp) => (
                <button
                  type="button"
                  key={tp.id}
                  onClick={() => setTypographyId(tp.id)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    typographyId === tp.id
                      ? "bg-zinc-800 border-indigo-500 text-white shadow-sm"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="text-[11px] font-semibold">{tp.label}</div>
                  <div className="text-[10px] text-zinc-500">{tp.sample}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSize("A4")}
                className={`p-3 rounded-xl border text-xs font-medium transition text-left ${
                  size === "A4"
                    ? "bg-violet-600/15 border-violet-500 text-white"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400"
                }`}
              >
                <div className="font-semibold">A4 Portrait (210×297mm)</div>
                <div className="text-zinc-400 text-[10px] mt-0.5">Classic editorial magazine size</div>
              </button>

              <button
                type="button"
                onClick={() => setSize("SQUARE_210")}
                className={`p-3 rounded-xl border text-xs font-medium transition text-left ${
                  size === "SQUARE_210"
                    ? "bg-violet-600/15 border-violet-500 text-white"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400"
                }`}
              >
                <div className="font-semibold">Square (210×210mm)</div>
                <div className="text-zinc-400 text-[10px] mt-0.5">Contemporary art monograph</div>
              </button>
            </div>
          </div>

          {/* Photo Upload Section */}
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Select Photographs
                </label>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Select 10 photos (JPEG, PNG, WebP) for full story generation
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 font-mono">
                {selectedPhotos.length} selected
              </span>
            </div>

            <div className="p-4 rounded-xl border-2 border-dashed border-zinc-800 hover:border-violet-500/50 bg-zinc-950/60 transition flex flex-col items-center justify-center gap-3">
              <input
                id="photo-upload-input"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                disabled={loading}
                className="block w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-500 cursor-pointer"
              />
              <span className="text-[11px] text-zinc-500">
                You can select multiple photos at once (10 recommended)
              </span>
            </div>

            {/* Selected Photos Grid Preview */}
            {selectedPhotos.length > 0 && (
              <div className="grid grid-cols-5 gap-2.5 pt-2 max-h-56 overflow-y-auto p-1">
                {selectedPhotos.map((photo, idx) => (
                  <div
                    key={`${photo.file.name}_${idx}`}
                    className="relative group rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 aspect-square"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt={photo.file.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        disabled={loading}
                        className="p-1 rounded-full bg-rose-600 text-white text-[10px] hover:bg-rose-500"
                        title="Remove photo"
                      >
                        ✕
                      </button>
                    </div>
                    {photo.status === "PROCESSING" && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {photo.status === "READY" && (
                      <div className="absolute bottom-1 right-1 bg-emerald-600/90 text-white text-[9px] px-1 rounded">
                        ✓
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-sm transition shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{uploadProgressText || "Launching Generation Workflow..."}</span>
                </>
              ) : (
                <span>
                  Create &amp; Generate Magazine ({selectedPhotos.length > 0 ? `${selectedPhotos.length} Photos` : "Default Sample"}) &rarr;
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
