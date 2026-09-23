"use client";

import React from "react";
import type { BookDesign } from "@/types/design";

interface PageNavigatorProps {
  design: BookDesign;
  selectedPageId: string;
  onSelectPage: (pageId: string) => void;
}

export const PageNavigator: React.FC<PageNavigatorProps> = ({
  design,
  selectedPageId,
  onSelectPage,
}) => {
  const sortedPages = [...design.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const docAspect = design.document.widthMm / design.document.heightMm;

  return (
    <nav className="w-48 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 select-none">
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-200 tracking-wider uppercase">
          Pages ({sortedPages.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {sortedPages.map((page) => {
          const isSelected = page.id === selectedPageId;
          const isCover = page.pageNumber === 1;

          return (
            <button
              key={page.id}
              type="button"
              onClick={() => onSelectPage(page.id)}
              className={`w-full text-left p-2 rounded-lg transition-all border ${
                isSelected
                  ? "bg-blue-600/10 border-blue-500 shadow-sm"
                  : "bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/80"
              }`}
            >
              {/* Thumbnail Representation */}
              <div
                className="w-full bg-slate-100 rounded shadow-xs relative overflow-hidden mb-1.5 flex flex-col justify-between p-1"
                style={{ aspectRatio: `${docAspect}` }}
              >
                {/* Visual miniature representation of elements */}
                <div className="w-full h-full relative">
                  {page.elements.map((el) => {
                    const leftPct = (el.xMm / design.document.widthMm) * 100;
                    const topPct = (el.yMm / design.document.heightMm) * 100;
                    const widthPct = (el.widthMm / design.document.widthMm) * 100;
                    const heightPct = (el.heightMm / design.document.heightMm) * 100;

                    if (el.type === "image") {
                      return (
                        <div
                          key={el.id}
                          className="absolute bg-slate-400/80 rounded-xs"
                          style={{
                            left: `${Math.max(0, leftPct)}%`,
                            top: `${Math.max(0, topPct)}%`,
                            width: `${Math.min(100, widthPct)}%`,
                            height: `${Math.min(100, heightPct)}%`,
                          }}
                        />
                      );
                    } else if (el.type === "text") {
                      return (
                        <div
                          key={el.id}
                          className="absolute bg-slate-800 rounded-xs"
                          style={{
                            left: `${Math.max(0, leftPct)}%`,
                            top: `${Math.max(0, topPct)}%`,
                            width: `${Math.min(100, widthPct)}%`,
                            height: `${Math.min(100, heightPct)}%`,
                          }}
                        />
                      );
                    }
                    return null;
                  })}
                </div>
              </div>

              {/* Page Number & Layout Tag */}
              <div className="flex items-center justify-between text-[11px]">
                <span className={`font-semibold ${isSelected ? "text-blue-400" : "text-slate-300"}`}>
                  {isCover ? "Cover (P. 1)" : `Page ${page.pageNumber}`}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {page.layoutType.replace(/_/g, " ")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
