"use client";

import React from "react";
import type { SaveStatus } from "@/lib/editor/types";

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSavedAt?: string;
  errorMessage?: string;
}

export const SaveIndicator: React.FC<SaveIndicatorProps> = ({
  status,
  lastSavedAt,
  errorMessage,
}) => {
  return (
    <div className="flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-md bg-slate-900/60 border border-slate-800">
      {status === "SAVING" && (
        <>
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span className="text-blue-400">Saving...</span>
        </>
      )}

      {status === "SAVED" && (
        <>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-300">
            Saved {lastSavedAt ? `at ${new Date(lastSavedAt).toLocaleTimeString()}` : ""}
          </span>
        </>
      )}

      {status === "UNSAVED" && (
        <>
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-amber-300">Unsaved changes</span>
        </>
      )}

      {status === "ERROR" && (
        <>
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="text-rose-400" title={errorMessage || "Failed to save"}>
            Save failed (retrying)
          </span>
        </>
      )}
    </div>
  );
};
