"use client";

import React, { useState } from "react";

interface ProcessedAssetData {
  asset: {
    assetId: string;
    originalFilename: string;
    mimeType: string;
    width: number;
    height: number;
    aspectRatio: number;
    orientation: string;
    fileSizeBytes: number;
    contentHash: string;
    status: string;
    processingVersion: string;
    createdAt: string;
    expiresAt: string;
  };
  urls: {
    thumbnailUrl: string;
    previewUrl: string;
    aiDerivativeUrl: string;
  };
}

export default function PhotoPipelineDevPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessedAssetData | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUploadAndProcess = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", "dev_admin_user");
      formData.append("bookId", "dev_magazine_01");

      const res = await fetch("/api/photos/process", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Processing failed");
      }

      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30">
              Part 4 Dev Test
            </span>
            <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
              Privacy Boundary Active
            </span>
          </div>
          <h1 className="text-3xl font-extrabold mt-3 tracking-tight text-white">
            Photo Pipeline & Privacy Processing Harness
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Validates image formats, normalizes orientation, strips all EXIF/GPS metadata, and produces controlled AI & preview derivatives. User originals are kept quarantined in private storage.
          </p>
        </header>

        {/* Upload Card */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 shadow-xl space-y-5">
          <label className="block text-sm font-medium text-slate-300">
            Select Photo (JPEG, PNG, WebP up to 25MB):
          </label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer bg-slate-900/60 rounded-lg border border-slate-700 p-2"
            />
            <button
              onClick={handleUploadAndProcess}
              disabled={!file || loading}
              className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-white shadow-lg transition-colors whitespace-nowrap"
            >
              {loading ? "Processing..." : "Process Photo"}
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 text-sm">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}
        </div>

        {/* Results View */}
        {result && (
          <div className="space-y-6">
            {/* Metadata Summary Card */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 shadow-xl space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center justify-between">
                Extracted Asset Intelligence
                <span className="px-2 py-0.5 text-xs font-mono bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                  Status: {result.asset.status}
                </span>
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-xs">Asset ID</span>
                  <span className="font-mono text-slate-200 text-xs truncate block">
                    {result.asset.assetId}
                  </span>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-xs">Dimensions</span>
                  <span className="font-semibold text-slate-200">
                    {result.asset.width} × {result.asset.height} px
                  </span>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-xs">Orientation</span>
                  <span className="font-semibold text-slate-200">
                    {result.asset.orientation} ({result.asset.aspectRatio})
                  </span>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-xs">Original Size</span>
                  <span className="font-semibold text-slate-200">
                    {(result.asset.fileSizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-xs">SHA-256 Content Hash (Duplicate Detection)</span>
                <span className="font-mono text-slate-300 text-xs break-all">
                  {result.asset.contentHash}
                </span>
              </div>
            </div>

            {/* Privacy & Derivative Showcase */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Thumbnail Card */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shadow-xl space-y-3">
                <h3 className="font-bold text-sm text-slate-200 flex items-center justify-between">
                  UI Thumbnail
                  <span className="text-xs text-slate-400">max 400px</span>
                </h3>
                <div className="aspect-square bg-slate-900 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.urls.thumbnailUrl}
                    alt="Thumbnail preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Optimized for grid rendering & upload selection.
                </p>
              </div>

              {/* AI Derivative Card */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shadow-xl space-y-3">
                <h3 className="font-bold text-sm text-slate-200 flex items-center justify-between">
                  AI Derivative
                  <span className="text-xs text-indigo-400 font-mono">max 2048px (EXIF Stripped)</span>
                </h3>
                <div className="aspect-square bg-slate-900 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.urls.aiDerivativeUrl}
                    alt="AI derivative"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Fed to Vision AI via short-lived signed URL. Zero EXIF/GPS leakage.
                </p>
              </div>

              {/* Preview Derivative Card */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shadow-xl space-y-3">
                <h3 className="font-bold text-sm text-slate-200 flex items-center justify-between">
                  Browser Preview
                  <span className="text-xs text-slate-400">max 2560px</span>
                </h3>
                <div className="aspect-square bg-slate-900 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.urls.previewUrl}
                    alt="Browser preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  High-fidelity rendering for editor canvas & preview.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
