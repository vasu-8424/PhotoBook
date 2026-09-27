"use client";

import React from "react";
import Link from "next/link";
import type { EditorMode, EditorViewMode, SaveStatus } from "@/lib/editor/types";
import { SaveIndicator } from "./SaveIndicator";
import { UndoRedoControls } from "./UndoRedoControls";
import { ZoomControls } from "./ZoomControls";

interface EditorToolbarProps {
  bookTitle: string;
  bookId: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomReset?: () => void;
  mode: EditorMode;
  onToggleMode: (mode: EditorMode) => void;
  viewMode: EditorViewMode;
  onToggleViewMode: (viewMode: EditorViewMode) => void;
  showSafeArea: boolean;
  onToggleSafeArea: () => void;
  showBleed: boolean;
  onToggleBleed: () => void;
  showGutter: boolean;
  onToggleGutter: () => void;
  saveStatus: SaveStatus;
  lastSavedAt?: string;
  errorMessage?: string;
  onExportPdf: () => void;
  isExportingPdf: boolean;
  /** True when a SUCCEEDED export exists — enables Download button */
  exportReady?: boolean;
  onDownloadPdf?: () => void;
  onOpenTemplateBrowser?: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  bookTitle,
  bookId,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomChange,
  onZoomReset,
  mode,
  onToggleMode,
  viewMode,
  onToggleViewMode,
  showSafeArea,
  onToggleSafeArea,
  showBleed,
  onToggleBleed,
  showGutter,
  onToggleGutter,
  saveStatus,
  lastSavedAt,
  errorMessage,
  onExportPdf,
  isExportingPdf,
  exportReady = false,
  onDownloadPdf,
  onOpenTemplateBrowser,
}) => {
  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 select-none text-xs">
      {/* Left section: Back navigation + Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Link>

        <div className="h-4 w-px bg-slate-800" />

        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100 max-w-xs truncate" title={bookTitle}>
            {bookTitle || "Memory Magazine"}
          </span>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded">
            {bookId}
          </span>
        </div>
      </div>

      {/* Center section: Undo/Redo + Zoom + View Modes + Guides */}
      <div className="flex items-center gap-2.5">
        <UndoRedoControls
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
        />

        <ZoomControls
          zoom={zoom}
          onZoomChange={onZoomChange}
          onZoomReset={onZoomReset}
        />

        {/* View Mode Toggle: Single vs Spread */}
        <div className="flex bg-slate-900/60 p-0.5 rounded-md border border-slate-800">
          <button
            type="button"
            onClick={() => onToggleViewMode("SINGLE")}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              viewMode === "SINGLE" ? "bg-slate-800 text-white font-medium" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Page
          </button>
          <button
            type="button"
            onClick={() => onToggleViewMode("SPREAD")}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              viewMode === "SPREAD" ? "bg-slate-800 text-white font-medium" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Spread
          </button>
        </div>

        {/* Guides Toggles (visible in edit mode) */}
        {mode === "EDIT" && (
          <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-md border border-slate-800">
            <button
              type="button"
              onClick={onToggleSafeArea}
              title="Toggle 8mm Safe Area Margin Guide"
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                showSafeArea ? "bg-blue-600/30 text-blue-300 border border-blue-500/50" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Safe Area
            </button>
            <button
              type="button"
              onClick={onToggleBleed}
              title="Toggle 3mm Bleed Boundary Guide"
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                showBleed ? "bg-rose-600/30 text-rose-300 border border-rose-500/50" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Bleed
            </button>
            <button
              type="button"
              onClick={onToggleGutter}
              title="Toggle 10mm Gutter Fold Guide"
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                showGutter ? "bg-amber-600/30 text-amber-300 border border-amber-500/50" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Gutter
            </button>
          </div>
        )}

        {/* Design System & Templates Modal Button */}
        {onOpenTemplateBrowser && (
          <button
            type="button"
            onClick={onOpenTemplateBrowser}
            title="Open Editorial Design System (Templates, Themes, Typography)"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border border-indigo-500/30 transition-all font-medium text-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <span>Design</span>
          </button>
        )}
      </div>

      {/* Right section: Mode Switcher + Save Indicator + Export PDF */}
      <div className="flex items-center gap-3">
        {/* Edit vs Preview Mode */}
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => onToggleMode("EDIT")}
            className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
              mode === "EDIT" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onToggleMode("PREVIEW")}
            className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
              mode === "PREVIEW" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Preview
          </button>
        </div>

        <SaveIndicator
          status={saveStatus}
          lastSavedAt={lastSavedAt}
          errorMessage={errorMessage}
        />

        {/* Export PDF Button */}
        <button
          type="button"
          id="export-pdf-btn"
          disabled={isExportingPdf}
          onClick={onExportPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors shadow-sm disabled:opacity-50"
        >
          {isExportingPdf ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Generating…</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export PDF</span>
            </>
          )}
        </button>

        {/* Download PDF Button — visible only after successful export */}
        {exportReady && onDownloadPdf && (
          <button
            type="button"
            id="download-pdf-toolbar-btn"
            onClick={onDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download PDF</span>
          </button>
        )}
      </div>
    </header>
  );
};
