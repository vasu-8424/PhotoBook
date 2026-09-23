"use client";

import React from "react";
import type { TextElement } from "@/types/design";
import { APPROVED_FONTS, APPROVED_FONT_WEIGHTS } from "@/lib/editor/constants";
import type { TypographyUpdates } from "@/lib/editor/types";

interface TypographyInspectorProps {
  element: TextElement;
  onUpdate: (updates: TypographyUpdates) => void;
  onDelete?: () => void;
}

export const TypographyInspector: React.FC<TypographyInspectorProps> = ({
  element,
  onUpdate,
  onDelete,
}) => {
  return (
    <div className="space-y-4 text-xs text-slate-300">
      <div>
        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          Text Content
        </label>
        <textarea
          value={element.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={3}
          className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-slate-200 focus:outline-none focus:border-blue-500 font-sans text-xs resize-y"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Font Family
          </label>
          <select
            value={element.fontFamily}
            onChange={(e) => onUpdate({ fontFamily: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {APPROVED_FONTS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Font Weight
          </label>
          <select
            value={element.fontWeight}
            onChange={(e) => onUpdate({ fontWeight: parseInt(e.target.value, 10) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {APPROVED_FONT_WEIGHTS.map((weight) => (
              <option key={weight} value={weight}>
                {weight === 400 ? "400 Regular" : weight === 700 ? "700 Bold" : weight}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Size (pt)
          </label>
          <input
            type="number"
            min={6}
            max={72}
            step={1}
            value={element.fontSizePt}
            onChange={(e) => onUpdate({ fontSizePt: parseFloat(e.target.value) || element.fontSizePt })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Line Height
          </label>
          <input
            type="number"
            min={0.8}
            max={2.5}
            step={0.1}
            value={element.lineHeight}
            onChange={(e) => onUpdate({ lineHeight: parseFloat(e.target.value) || element.lineHeight })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 items-center">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Color
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={element.color.startsWith("#") ? element.color : "#0F172A"}
              onChange={(e) => onUpdate({ color: e.target.value.toUpperCase() })}
              className="w-7 h-7 rounded border border-slate-800 bg-transparent cursor-pointer"
            />
            <input
              type="text"
              value={element.color}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Alignment
          </label>
          <div className="flex bg-slate-950 border border-slate-800 rounded-md p-0.5">
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => onUpdate({ align })}
                className={`flex-1 py-1 rounded text-center capitalize transition-colors ${
                  element.align === align
                    ? "bg-blue-600 text-white font-medium"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {align}
              </button>
            ))}
          </div>
        </div>
      </div>

      {onDelete && (
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onDelete}
            className="w-full py-1.5 px-3 rounded-md bg-rose-950/40 text-rose-300 border border-rose-900/50 hover:bg-rose-900/40 transition-colors font-medium flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Text Element
          </button>
        </div>
      )}
    </div>
  );
};
