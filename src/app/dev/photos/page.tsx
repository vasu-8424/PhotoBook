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
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessedAssetData[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setError(null);
      setResults([]);
    }
  };

  const handleUploadAndProcess = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const processedList: ProcessedAssetData[] = [];
      for (const f of files) {
        const formData = new FormData();
        formData.append("file", f);
        formData.append("userId", "dev_admin_user");
        formData.append("bookId", "dev_magazine_01");

        const res = await fetch("/api/photos/process", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || `Processing failed for ${f.name}`);
        }
        processedList.push(data);
      }

      setResults(processedList);
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
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-300">
              Select Photos (JPEG, PNG, WebP up to 25MB each):
            </label>
            <span className="text-xs px-2.5 py-1 bg-slate-900 rounded-full text-slate-400">
              {files.length} selected
            </span>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer bg-slate-900/60 rounded-lg border border-slate-700 p-2"
            />
            <button
              onClick={handleUploadAndProcess}
              disabled={files.length === 0 || loading}
              className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-white shadow-lg transition-colors whitespace-nowrap"
            >
              {loading ? "Processing..." : `Process ${files.length > 0 ? `${files.length} Photos` : "Photo"}`}
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 text-sm">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}
        </div>

        {/* Results View */}
        {results.length > 0 && (
          <div className="space-y-8">
            <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-2">
              Processed Assets ({results.length})
            </h2>
            {results.map((res, idx) => (
              <div key={res.asset.assetId || idx} className="space-y-4 bg-slate-800/40 border border-slate-800 p-4 rounded-xl">
                {/* Metadata Summary Card */}
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shadow-xl space-y-4">
                  <h3 className="text-base font-bold text-white flex items-center justify-between">
                    <span>{res.asset.originalFilename}</span>
                    <span className="px-2 py-0.5 text-xs font-mono bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                      Status: {res.asset.status}
                    </span>
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-xs">Asset ID</span>
                      <span className="font-mono text-slate-200 text-xs truncate block">
                        {res.asset.assetId}
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-xs">Dimensions</span>
                      <span className="font-semibold text-slate-200">
                        {res.asset.width} × {res.asset.height} px
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-xs">Orientation</span>
                      <span className="font-semibold text-slate-200">
                        {res.asset.orientation} ({res.asset.aspectRatio})
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-xs">Original Size</span>
                      <span className="font-semibold text-slate-200">
                        {(res.asset.fileSizeBytes / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                </div>

                {/* Privacy & Derivative Showcase */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Thumbnail Card */}
                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 shadow-xl space-y-2">
                    <h4 className="font-bold text-xs text-slate-300">UI Thumbnail</h4>
                    <div className="aspect-square bg-slate-900 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={res.urls.thumbnailUrl}
                        alt="Thumbnail preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </div>

                  {/* AI Derivative Card */}
                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 shadow-xl space-y-2">
                    <h4 className="font-bold text-xs text-indigo-400">AI Derivative (EXIF Stripped)</h4>
                    <div className="aspect-square bg-slate-900 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={res.urls.aiDerivativeUrl}
                        alt="AI derivative"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Preview Derivative Card */}
                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 shadow-xl space-y-2">
                    <h4 className="font-bold text-xs text-slate-300">Browser Preview</h4>
                    <div className="aspect-square bg-slate-900 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={res.urls.previewUrl}
                        alt="Browser preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
