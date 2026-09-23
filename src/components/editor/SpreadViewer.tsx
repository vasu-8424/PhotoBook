"use client";

import React from "react";
import type { BookDesign, BookPage, BookSpread } from "@/types/design";
import { mmToPx } from "@/lib/editor/coordinates";
import { CANVAS_WORKSPACE_BG, DEFAULT_PAGE_BG_COLOR, GUTTER_GUIDE_COLOR } from "@/lib/editor/constants";
import type { EditorAssetMap } from "@/lib/editor/types";

interface SpreadViewerProps {
  design: BookDesign;
  leftPage: BookPage;
  rightPage: BookPage;
  spread?: BookSpread;
  assetMap: EditorAssetMap;
  zoom: number;
}

export const SpreadViewer: React.FC<SpreadViewerProps> = ({
  design,
  leftPage,
  rightPage,
  spread,
  assetMap,
  zoom,
}) => {
  const doc = design.document;
  const effectiveScale = 1.8 * zoom;

  const pageWPx = mmToPx(doc.widthMm, effectiveScale);
  const pageHPx = mmToPx(doc.heightMm, effectiveScale);
  const spreadWPx = pageWPx * 2;
  const gutterPx = mmToPx(doc.gutterMm, effectiveScale);

  const spreadAsset = spread?.assetId ? assetMap.get(spread.assetId) : undefined;

  return (
    <div
      className="flex-1 h-full w-full flex items-center justify-center p-8 overflow-auto select-none"
      style={{ backgroundColor: CANVAS_WORKSPACE_BG }}
    >
      <div
        className="relative flex shadow-2xl rounded-xs overflow-hidden"
        style={{
          width: `${spreadWPx}px`,
          height: `${pageHPx}px`,
          backgroundColor: DEFAULT_PAGE_BG_COLOR,
        }}
      >
        {/* Background Spread Image (if two-page panoramic spread exists) */}
        {spreadAsset && (
          <div
            className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none opacity-90"
            style={{
              backgroundImage: `url(${spreadAsset.previewUrl})`,
              backgroundPosition: `${(spread?.focalPoint?.x ?? 0.5) * 100}% ${(spread?.focalPoint?.y ?? 0.5) * 100}%`,
            }}
          />
        )}

        {/* Left Page Half */}
        <div
          className="relative h-full border-r border-slate-300/80 z-10 flex flex-col justify-between p-4"
          style={{ width: `${pageWPx}px` }}
        >
          <div className="text-[10px] text-slate-500 font-mono">
            Page {leftPage.pageNumber} ({leftPage.layoutType})
          </div>

          <div className="space-y-2">
            {leftPage.elements.map((el) => (
              <div key={el.id} className="text-xs text-slate-800 bg-white/70 backdrop-blur-xs p-1 rounded">
                {el.type === "text" ? el.text : `[${el.type}: ${el.id}]`}
              </div>
            ))}
          </div>

          <div className="text-[9px] text-slate-400 font-mono text-left">
            Left Folio
          </div>
        </div>

        {/* Central Binding Gutter Guide Indicator */}
        <div
          className="absolute top-0 bottom-0 z-20 pointer-events-none flex items-center justify-center"
          style={{
            left: `calc(50% - ${gutterPx / 2}px)`,
            width: `${gutterPx}px`,
            backgroundColor: "rgba(245, 158, 11, 0.08)",
            borderLeft: `1px dashed ${GUTTER_GUIDE_COLOR}`,
            borderRight: `1px dashed ${GUTTER_GUIDE_COLOR}`,
          }}
        >
          <span className="text-[9px] font-mono text-amber-500/80 rotate-90 select-none">
            Gutter ({doc.gutterMm}mm)
          </span>
        </div>

        {/* Right Page Half */}
        <div
          className="relative h-full z-10 flex flex-col justify-between p-4"
          style={{ width: `${pageWPx}px` }}
        >
          <div className="text-[10px] text-slate-500 font-mono text-right">
            Page {rightPage.pageNumber} ({rightPage.layoutType})
          </div>

          <div className="space-y-2 text-right">
            {rightPage.elements.map((el) => (
              <div key={el.id} className="text-xs text-slate-800 bg-white/70 backdrop-blur-xs p-1 rounded inline-block">
                {el.type === "text" ? el.text : `[${el.type}: ${el.id}]`}
              </div>
            ))}
          </div>

          <div className="text-[9px] text-slate-400 font-mono text-right">
            Right Folio
          </div>
        </div>
      </div>
    </div>
  );
};
