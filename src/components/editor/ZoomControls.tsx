"use client";

import React from "react";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_PRESETS } from "@/lib/editor/constants";

interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomReset?: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomChange,
  onZoomReset,
}) => {
  const handleZoomIn = () => {
    const next = Math.min(MAX_ZOOM, Math.round((zoom + 0.15) * 100) / 100);
    onZoomChange(next);
  };

  const handleZoomOut = () => {
    const prev = Math.max(MIN_ZOOM, Math.round((zoom - 0.15) * 100) / 100);
    onZoomChange(prev);
  };

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      onZoomChange(val);
    }
  };

  return (
    <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-md border border-slate-800 text-xs">
      <button
        type="button"
        onClick={handleZoomOut}
        disabled={zoom <= MIN_ZOOM}
        title="Zoom Out"
        aria-label="Zoom Out"
        className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      <select
        value={zoom}
        onChange={handleSelectPreset}
        className="bg-slate-950 text-slate-200 border border-slate-800 rounded px-1.5 py-0.5 text-xs font-mono focus:outline-none focus:border-blue-500"
      >
        {ZOOM_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {Math.round(preset * 100)}%
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleZoomIn}
        disabled={zoom >= MAX_ZOOM}
        title="Zoom In"
        aria-label="Zoom In"
        className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {onZoomReset && (
        <button
          type="button"
          onClick={onZoomReset}
          title="Reset Zoom to 100%"
          className="px-2 py-0.5 ml-1 rounded bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors font-medium"
        >
          Fit
        </button>
      )}
    </div>
  );
};
