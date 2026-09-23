"use client";

import React from "react";
import type { FitMode, ImageElement, Point } from "@/types/design";

interface ImageInspectorProps {
  element: ImageElement;
  isProtected: boolean;
  onUpdateCrop: (updates: { fit?: FitMode; focalPoint?: Point }) => void;
  onUpdateGeometry: (updates: { xMm?: number; yMm?: number; widthMm?: number; heightMm?: number }) => void;
  onDelete?: () => void;
}

export const ImageInspector: React.FC<ImageInspectorProps> = ({
  element,
  isProtected,
  onUpdateCrop,
  onUpdateGeometry,
  onDelete,
}) => {
  const focalPoint = element.focalPoint || { x: 0.5, y: 0.5 };

  return (
    <div className="space-y-4 text-xs text-slate-300">
      {/* Protected Photo Badge */}
      {isProtected && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-950/40 border border-amber-800/60 text-amber-300">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <div className="font-semibold text-amber-200">Protected Photo</div>
            <div className="text-[11px] text-amber-300/80 leading-tight">
              Preserved memory: cannot be deleted or replaced.
            </div>
          </div>
        </div>
      )}

      {/* Asset Metadata */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Asset ID
        </label>
        <div className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 font-mono text-[11px] text-slate-400 truncate">
          {element.assetId}
        </div>
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            X (mm)
          </label>
          <input
            type="number"
            value={element.xMm}
            onChange={(e) => onUpdateGeometry({ xMm: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Y (mm)
          </label>
          <input
            type="number"
            value={element.yMm}
            onChange={(e) => onUpdateGeometry({ yMm: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Width (mm)
          </label>
          <input
            type="number"
            min={5}
            value={element.widthMm}
            onChange={(e) => onUpdateGeometry({ widthMm: Math.max(5, parseFloat(e.target.value) || 5) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Height (mm)
          </label>
          <input
            type="number"
            min={5}
            value={element.heightMm}
            onChange={(e) => onUpdateGeometry({ heightMm: Math.max(5, parseFloat(e.target.value) || 5) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      {/* Fit Mode */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Fit Mode
        </label>
        <div className="flex bg-slate-950 border border-slate-800 rounded-md p-0.5">
          {(["COVER", "CONTAIN", "FILL"] as const).map((fit) => (
            <button
              key={fit}
              type="button"
              onClick={() => onUpdateCrop({ fit })}
              className={`flex-1 py-1 rounded text-center font-medium capitalize text-[11px] transition-colors ${
                element.fit === fit
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {fit.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Focal Point Alignment */}
      {element.fit === "COVER" && (
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Focal Center: ({Math.round(focalPoint.x * 100)}%, {Math.round(focalPoint.y * 100)}%)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-400">Horizontal</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={focalPoint.x}
                onChange={(e) =>
                  onUpdateCrop({ focalPoint: { ...focalPoint, x: parseFloat(e.target.value) } })
                }
                className="w-full accent-blue-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400">Vertical</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={focalPoint.y}
                onChange={(e) =>
                  onUpdateCrop({ focalPoint: { ...focalPoint, y: parseFloat(e.target.value) } })
                }
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Deletion (blocked if protected) */}
      {onDelete && (
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            disabled={isProtected}
            onClick={onDelete}
            title={isProtected ? "Protected photos cannot be deleted" : "Delete image from page"}
            className="w-full py-1.5 px-3 rounded-md bg-rose-950/40 text-rose-300 border border-rose-900/50 hover:bg-rose-900/40 disabled:opacity-30 disabled:pointer-events-none transition-colors font-medium flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {isProtected ? "Protected (Cannot Delete)" : "Delete Image"}
          </button>
        </div>
      )}
    </div>
  );
};
