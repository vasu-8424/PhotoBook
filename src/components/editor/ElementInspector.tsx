"use client";

import React from "react";
import type { BookDesign, BookPage, DesignElement, ImageElement, TextElement } from "@/types/design";
import { isProtectedPhoto } from "@/lib/editor/constraints";
import { ImageInspector } from "./ImageInspector";
import { TypographyInspector } from "./TypographyInspector";
import type { ImageCropUpdates, TypographyUpdates } from "@/lib/editor/types";

interface ElementInspectorProps {
  design: BookDesign;
  currentPage: BookPage;
  selectedElement: DesignElement | null;
  protectedPhotoIds: string[];
  onUpdateElementPosition: (xMm: number, yMm: number) => void;
  onUpdateElementSize: (widthMm: number, heightMm: number) => void;
  onUpdateTypography: (updates: TypographyUpdates) => void;
  onUpdateImageCrop: (updates: ImageCropUpdates) => void;
  onDeleteElement: () => void;
}

export const ElementInspector: React.FC<ElementInspectorProps> = ({
  design,
  currentPage,
  selectedElement,
  protectedPhotoIds,
  onUpdateElementPosition,
  onUpdateElementSize,
  onUpdateTypography,
  onUpdateImageCrop,
  onDeleteElement,
}) => {
  return (
    <aside className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0 select-none overflow-y-auto">
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-200 tracking-wider uppercase">
          {selectedElement ? "Element Inspector" : "Page Properties"}
        </h3>
        {selectedElement && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
            {selectedElement.type}
          </span>
        )}
      </div>

      <div className="p-4 flex-1">
        {!selectedElement ? (
          <div className="space-y-4 text-xs text-slate-300">
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Active Page
              </span>
              <div className="text-sm font-semibold text-slate-100">
                Page {currentPage.pageNumber}{" "}
                {currentPage.pageNumber === 1 ? "(Cover)" : ""}
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Layout Archetype
              </span>
              <div className="inline-block px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700 font-mono text-[11px] text-blue-400 font-medium">
                {currentPage.layoutType}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Dimensions:</span>
                <span className="font-mono text-slate-200">
                  {design.document.widthMm} × {design.document.heightMm} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span>Bleed Trim:</span>
                <span className="font-mono text-slate-200">{design.document.bleedMm} mm</span>
              </div>
              <div className="flex justify-between">
                <span>Safe Margin:</span>
                <span className="font-mono text-slate-200">{design.document.safeAreaMm} mm</span>
              </div>
              <div className="flex justify-between">
                <span>Gutter:</span>
                <span className="font-mono text-slate-200">{design.document.gutterMm} mm</span>
              </div>
              <div className="flex justify-between">
                <span>Elements on Page:</span>
                <span className="font-mono text-slate-200">{currentPage.elements.length}</span>
              </div>
            </div>

            <div className="mt-6 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
              💡 Select any photograph or text box on the canvas to inspect dimensions, adjust typography, or reposition content.
            </div>
          </div>
        ) : selectedElement.type === "image" ? (
          <ImageInspector
            element={selectedElement as ImageElement}
            isProtected={isProtectedPhoto(
              (selectedElement as ImageElement).assetId,
              protectedPhotoIds,
            )}
            onUpdateCrop={onUpdateImageCrop}
            onUpdateGeometry={(geom) => {
              if (geom.xMm !== undefined || geom.yMm !== undefined) {
                onUpdateElementPosition(
                  geom.xMm ?? selectedElement.xMm,
                  geom.yMm ?? selectedElement.yMm,
                );
              }
              if (geom.widthMm !== undefined || geom.heightMm !== undefined) {
                onUpdateElementSize(
                  geom.widthMm ?? selectedElement.widthMm,
                  geom.heightMm ?? selectedElement.heightMm,
                );
              }
            }}
            onDelete={onDeleteElement}
          />
        ) : selectedElement.type === "text" ? (
          <TypographyInspector
            element={selectedElement as TextElement}
            onUpdate={onUpdateTypography}
            onDelete={onDeleteElement}
          />
        ) : (
          <div className="text-xs text-slate-400 space-y-2">
            <div className="font-medium text-slate-200">Shape Element</div>
            <div>Type: {selectedElement.shape}</div>
            <div>
              Dimensions: {selectedElement.widthMm} × {selectedElement.heightMm} mm
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
