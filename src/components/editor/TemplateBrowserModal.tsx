"use client";

import React, { useState } from "react";
import type { BookDesign, BookPage } from "@/types/design";
import type { LayoutFamily } from "@/lib/design/types";
import { ALL_TEMPLATES, listTemplatesByFamily } from "@/lib/design/templates";
import { listThemes } from "@/lib/design/themes";
import { listTypographySystems } from "@/lib/design/typography";

export interface TemplateBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: BookPage;
  currentDesign: BookDesign;
  onSelectTemplate: (templateId: string) => void;
  onSelectTheme: (themeId: string) => void;
  onSelectTypography: (typographyId: string) => void;
  onRegeneratePage: () => void;
  currentThemeId?: string;
  currentTypographyId?: string;
}

export const TemplateBrowserModal: React.FC<TemplateBrowserModalProps> = ({
  isOpen,
  onClose,
  currentPage,
  onSelectTemplate,
  onSelectTheme,
  onSelectTypography,
  onRegeneratePage,
  currentThemeId = "WARM_EDITORIAL",
  currentTypographyId = "EDITORIAL_SERIF",
}) => {
  const [activeTab, setActiveTab] = useState<"TEMPLATES" | "THEMES" | "TYPOGRAPHY">("TEMPLATES");
  const [selectedFamily, setSelectedFamily] = useState<LayoutFamily | "ALL">("ALL");

  if (!isOpen) return null;

  const currentPhotoCount = currentPage.elements.filter((el) => el.type === "image").length || 1;

  const families: Array<LayoutFamily | "ALL"> = [
    "ALL",
    "HERO",
    "PORTRAIT",
    "LANDSCAPE",
    "GRID",
    "MAGAZINE",
    "MINIMAL",
    "JOURNAL",
    "SPREAD",
  ];

  const filteredTemplates =
    selectedFamily === "ALL"
      ? ALL_TEMPLATES
      : listTemplatesByFamily(selectedFamily);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 font-semibold text-xs border border-indigo-500/20">
              Page {currentPage.pageNumber}
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Editorial Design System
              </h2>
              <p className="text-xs text-slate-400">
                Curated layout intelligence, color themes, and typography
              </p>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveTab("TEMPLATES")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "TEMPLATES"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Templates ({ALL_TEMPLATES.length})
            </button>
            <button
              onClick={() => setActiveTab("THEMES")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "THEMES"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Color Themes
            </button>
            <button
              onClick={() => setActiveTab("TYPOGRAPHY")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "TYPOGRAPHY"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Typography
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "TEMPLATES" && (
            <div className="space-y-6">
              {/* Top controls: Family filters & Regenerate button */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {families.map((f) => (
                    <button
                      key={f}
                      onClick={() => setSelectedFamily(f)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        selectedFamily === f
                          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    onRegeneratePage();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/25 transition-all shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate Page
                </button>
              </div>

              {/* Template grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((tpl) => {
                  const isPhotoCountMatch =
                    currentPhotoCount >= tpl.minPhotos &&
                    currentPhotoCount <= tpl.maxPhotos;

                  return (
                    <div
                      key={tpl.id}
                      className={`group relative p-4 rounded-xl border bg-slate-900/60 hover:bg-slate-800/80 transition-all flex flex-col justify-between ${
                        isPhotoCountMatch
                          ? "border-slate-700 hover:border-indigo-500/50"
                          : "border-slate-800/60 opacity-75"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {tpl.family}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {tpl.minPhotos === tpl.maxPhotos
                              ? `${tpl.minPhotos} photo`
                              : `${tpl.minPhotos}–${tpl.maxPhotos} photos`}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          {tpl.name}
                        </h3>

                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                          {tpl.description}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-mono">
                          Density: {tpl.visualDensity}
                        </span>

                        <button
                          onClick={() => {
                            onSelectTemplate(tpl.id);
                            onClose();
                          }}
                          className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "THEMES" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Book-wide color palette. Changing theme updates all pages deterministically while preserving manual customizations.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listThemes().map((thm) => {
                  const isActive = currentThemeId === thm.id;

                  return (
                    <div
                      key={thm.id}
                      onClick={() => onSelectTheme(thm.id)}
                      className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                        isActive
                          ? "border-indigo-500 bg-indigo-500/10 shadow-lg"
                          : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white">
                            {thm.name}
                          </h4>
                          {isActive && (
                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {thm.description}
                        </p>
                      </div>

                      {/* Swatch palette */}
                      <div className="flex items-center gap-1.5 pt-2">
                        <div
                          className="w-6 h-6 rounded-full border border-slate-700 shadow-sm"
                          style={{ backgroundColor: thm.background }}
                          title="Background"
                        />
                        <div
                          className="w-6 h-6 rounded-full border border-slate-700 shadow-sm"
                          style={{ backgroundColor: thm.surface }}
                          title="Surface"
                        />
                        <div
                          className="w-6 h-6 rounded-full border border-slate-700 shadow-sm"
                          style={{ backgroundColor: thm.primaryText }}
                          title="Primary Text"
                        />
                        <div
                          className="w-6 h-6 rounded-full border border-slate-700 shadow-sm"
                          style={{ backgroundColor: thm.secondaryText }}
                          title="Secondary Text"
                        />
                        <div
                          className="w-6 h-6 rounded-full border border-slate-700 shadow-sm"
                          style={{ backgroundColor: thm.accent }}
                          title="Accent"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "TYPOGRAPHY" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Curated typography systems based on approved embedded font families with tailored sizing, line rhythm, and tracking.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listTypographySystems().map((typo) => {
                  const isActive = currentTypographyId === typo.id;

                  return (
                    <div
                      key={typo.id}
                      onClick={() => onSelectTypography(typo.id)}
                      className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                        isActive
                          ? "border-indigo-500 bg-indigo-500/10 shadow-lg"
                          : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white">
                            {typo.name}
                          </h4>
                          {isActive && (
                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {typo.description}
                        </p>
                      </div>

                      {/* Typographic hierarchy preview */}
                      <div className="p-3 bg-slate-950/60 rounded-lg space-y-1 border border-slate-800">
                        <div className="text-sm font-bold text-slate-200">
                          Display {typo.display.fontSizePt}pt
                        </div>
                        <div className="text-xs font-semibold text-slate-400">
                          Headline {typo.headline.fontSizePt}pt
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Body text with {typo.body.lineHeight}x line height
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>
            {activeTab === "TEMPLATES"
              ? "All templates strictly compile to canonical BookDesign v1.0.0."
              : "Theme and typography updates recompile deterministically without calling AI."}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
