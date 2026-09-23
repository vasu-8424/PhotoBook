"use client";

import React from "react";

interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const UndoRedoControls: React.FC<UndoRedoControlsProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  return (
    <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-md border border-slate-800">
      <button
        type="button"
        disabled={!canUndo}
        onClick={onUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>

      <button
        type="button"
        disabled={!canRedo}
        onClick={onRedo}
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
        className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a5 5 0 00-5 5v2m15-7l-6 6m6-6l-6-6" />
        </svg>
      </button>
    </div>
  );
};
