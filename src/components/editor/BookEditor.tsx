"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { BookDesign, BookPage, TextElement } from "@/types/design";
import {
  createHistory,
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
} from "@/lib/editor/history";
import {
  updateElementPosition,
  updateElementSize,
  updateTextElement,
  updateImageElement,
  deleteElement,
  findElementById,
} from "@/lib/editor/mutations";
import { AutosaveController } from "@/lib/editor/autosave";
import { DEFAULT_ZOOM } from "@/lib/editor/constants";
import type {
  EditorAsset,
  EditorAssetMap,
  EditorMode,
  EditorViewMode,
  ImageCropUpdates,
  SaveStatus,
  TypographyUpdates,
} from "@/lib/editor/types";
import type { PdfExportStatus, PdfExportStep } from "@/lib/export/types";
import { EditorToolbar } from "./EditorToolbar";
import { PageNavigator } from "./PageNavigator";
import { ElementInspector } from "./ElementInspector";
import { SpreadViewer } from "./SpreadViewer";
import { TemplateBrowserModal } from "./TemplateBrowserModal";
import {
  changePageLayout,
  recompileBookTheme,
  buildPhotoLayoutProfile,
  ALL_TEMPLATES,
} from "@/lib/design";

// Dynamic client-side import for Konva Canvas to ensure zero SSR canvas issues
const EditorCanvasDynamic = dynamic(
  () => import("./EditorCanvas").then((mod) => mod.EditorCanvas),
  { ssr: false },
);

// Export polling interval (ms)
const EXPORT_POLL_INTERVAL_MS = 2000;
const EXPORT_TERMINAL_STATUSES: PdfExportStatus[] = ["SUCCEEDED", "FAILED", "EXPIRED"];

export interface ExportState {
  exportId: string;
  jobId?: string;
  status: PdfExportStatus;
  progress: number;
  currentStep: PdfExportStep;
  designHash?: string;
  pageCount?: number;
  fileSizeBytes?: number;
  errorCode?: string;
}

export interface BookEditorProps {
  initialDesign: BookDesign;
  bookId: string;
  bookTitle?: string;
  protectedPhotoIds?: string[];
  initialAssets?: Record<string, { previewUrl: string; width?: number; height?: number }>;
  onSave?: (design: BookDesign) => Promise<boolean>;
  /** Legacy prop — kept for backward compat, export now goes through server */
  onExportPdf?: (design: BookDesign) => Promise<void>;
}

export const BookEditor: React.FC<BookEditorProps> = ({
  initialDesign,
  bookId,
  bookTitle = "Memory Magazine",
  protectedPhotoIds = [],
  initialAssets = {},
  onSave,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onExportPdf: _onExportPdf, // kept for backward compat; export now uses server API
}) => {
  const [historyState, setHistoryState] = useState(() => createHistory(initialDesign));
  const currentDesign = historyState.present;

  const [selectedPageId, setSelectedPageId] = useState<string>(
    initialDesign.pages[0]?.id || "",
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [mode, setMode] = useState<EditorMode>("EDIT");
  const [viewMode, setViewMode] = useState<EditorViewMode>("SINGLE");

  const [showSafeArea, setShowSafeArea] = useState<boolean>(true);
  const [showBleed, setShowBleed] = useState<boolean>(true);
  const [showGutter, setShowGutter] = useState<boolean>(true);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("SAVED");
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  // Part 10.5 Design System State
  const [isTemplateBrowserOpen, setIsTemplateBrowserOpen] = useState<boolean>(false);
  const [currentThemeId, setCurrentThemeId] = useState<string>("WARM_EDITORIAL");
  const [currentTypographyId, setCurrentTypographyId] = useState<string>("EDITORIAL_SERIF");

  // Part 10: Async export state
  const [exportState, setExportState] = useState<ExportState | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | undefined>(undefined);
  const exportPollTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Stable ref for the polling function to avoid useCallback circularity
  const pollFnRef = useRef<((exportId: string) => void) | null>(null);

  // Asset map mapping assetId -> EditorAsset
  const assetMap: EditorAssetMap = useMemo(() => {
    const map = new Map<string, EditorAsset>();
    for (const [id, meta] of Object.entries(initialAssets)) {
      map.set(id, { id, ...meta });
    }
    return map;
  }, [initialAssets]);

  // Autosave controller ref
  const autosaveControllerRef = useRef<AutosaveController | null>(null);

  useEffect(() => {
    const saveFn = onSave || (async () => true);
    autosaveControllerRef.current = new AutosaveController(
      saveFn,
      1000,
      (status, error) => {
        setSaveStatus(status);
        if (status === "SAVED") {
          setLastSavedAt(new Date().toISOString());
          setSaveError(undefined);
        } else if (status === "ERROR") {
          setSaveError(error);
        }
      },
    );

    return () => {
      autosaveControllerRef.current?.cancel();
    };
  }, [onSave]);

  // Current active page object
  const currentPage: BookPage = useMemo(() => {
    return (
      currentDesign.pages.find((p) => p.id === selectedPageId) ||
      currentDesign.pages[0]
    );
  }, [currentDesign, selectedPageId]);

  // Currently selected element object
  const selectedElement = useMemo(() => {
    if (!selectedElementId) return null;
    const found = findElementById(currentDesign, selectedElementId);
    return found ? found.element : null;
  }, [currentDesign, selectedElementId]);

  // Apply a validated design mutation
  const applyMutation = useCallback((newDesign: BookDesign) => {
    setHistoryState((prev) => pushHistory(prev, newDesign));
    autosaveControllerRef.current?.scheduleSave(newDesign);
  }, []);

  // Handlers for element mutations
  const handleUpdateElementPosition = useCallback(
    (xMm: number, yMm: number) => {
      if (!selectedElementId) return;
      const updated = updateElementPosition(
        currentDesign,
        currentPage.id,
        selectedElementId,
        xMm,
        yMm,
      );
      applyMutation(updated);
    },
    [currentDesign, currentPage.id, selectedElementId, applyMutation],
  );

  const handleUpdateElementSize = useCallback(
    (widthMm: number, heightMm: number) => {
      if (!selectedElementId) return;
      const updated = updateElementSize(
        currentDesign,
        currentPage.id,
        selectedElementId,
        widthMm,
        heightMm,
      );
      applyMutation(updated);
    },
    [currentDesign, currentPage.id, selectedElementId, applyMutation],
  );

  const handleUpdateTypography = useCallback(
    (updates: TypographyUpdates) => {
      if (!selectedElementId) return;
      const updated = updateTextElement(
        currentDesign,
        currentPage.id,
        selectedElementId,
        updates,
      );
      applyMutation(updated);
    },
    [currentDesign, currentPage.id, selectedElementId, applyMutation],
  );

  const handleUpdateImageCrop = useCallback(
    (updates: ImageCropUpdates) => {
      if (!selectedElementId) return;
      const updated = updateImageElement(
        currentDesign,
        currentPage.id,
        selectedElementId,
        updates,
      );
      applyMutation(updated);
    },
    [currentDesign, currentPage.id, selectedElementId, applyMutation],
  );

  const handleDeleteElement = useCallback(() => {
    if (!selectedElementId) return;
    const res = deleteElement(
      currentDesign,
      currentPage.id,
      selectedElementId,
      protectedPhotoIds,
    );

    if (res.success) {
      setSelectedElementId(null);
      applyMutation(res.design);
    } else if (res.error) {
      alert(res.error);
    }
  }, [currentDesign, currentPage.id, selectedElementId, protectedPhotoIds, applyMutation]);

  // Part 10.5 Design System Handlers
  const handleSelectTemplate = useCallback(
    (templateId: string) => {
      const profiles = Object.keys(initialAssets).map((aid) => {
        const a = initialAssets[aid];
        return buildPhotoLayoutProfile(aid, {
          asset: { width: a.width, height: a.height },
        });
      });

      const updated = changePageLayout(
        currentDesign,
        selectedPageId,
        templateId,
        profiles,
        currentThemeId,
        currentTypographyId,
      );

      applyMutation(updated);
    },
    [currentDesign, selectedPageId, initialAssets, currentThemeId, currentTypographyId, applyMutation],
  );

  const handleSelectTheme = useCallback(
    (themeId: string) => {
      setCurrentThemeId(themeId);
      const updated = recompileBookTheme(currentDesign, themeId, currentTypographyId);
      applyMutation(updated);
    },
    [currentDesign, currentTypographyId, applyMutation],
  );

  const handleSelectTypography = useCallback(
    (typoId: string) => {
      setCurrentTypographyId(typoId);
      const updated = recompileBookTheme(currentDesign, currentThemeId, typoId);
      applyMutation(updated);
    },
    [currentDesign, currentThemeId, applyMutation],
  );

  const handleRegeneratePage = useCallback(() => {
    const profiles = Object.keys(initialAssets).map((aid) => {
      const a = initialAssets[aid];
      return buildPhotoLayoutProfile(aid, {
        asset: { width: a.width, height: a.height },
      });
    });

    const pagePhotoCount = currentPage.elements.filter((e) => e.type === "image").length || 1;
    const compatible = ALL_TEMPLATES.filter(
      (t) => t.minPhotos <= pagePhotoCount && t.maxPhotos >= pagePhotoCount && t.id !== currentPage.layoutType,
    );
    const pool = compatible.length > 0 ? compatible : ALL_TEMPLATES;
    const nextTemplate = pool[Math.floor(Math.random() * pool.length)];

    if (nextTemplate) {
      const updated = changePageLayout(
        currentDesign,
        selectedPageId,
        nextTemplate.id,
        profiles,
        currentThemeId,
        currentTypographyId,
      );
      applyMutation(updated);
    }
  }, [currentDesign, selectedPageId, currentPage, initialAssets, currentThemeId, currentTypographyId, applyMutation]);

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (!canUndo(historyState)) return;
    const next = undo(historyState);
    setHistoryState(next);
    autosaveControllerRef.current?.scheduleSave(next.present);
  }, [historyState]);

  const handleRedo = useCallback(() => {
    if (!canRedo(historyState)) return;
    const next = redo(historyState);
    setHistoryState(next);
    autosaveControllerRef.current?.scheduleSave(next.present);
  }, [historyState]);

  // Part 10: Poll export status from server
  const pollExportStatus = useCallback(async (exportId: string) => {
    try {
      const res = await fetch(`/api/books/${bookId}/export`);
      if (!res.ok) return;
      const data: ExportState = await res.json();
      setExportState(data);

      if (!EXPORT_TERMINAL_STATUSES.includes(data.status)) {
        // Continue polling via stable ref to avoid hook circularity
        exportPollTimerRef.current = setTimeout(
          () => pollFnRef.current?.(exportId),
          EXPORT_POLL_INTERVAL_MS,
        );
      } else {
        // Terminal: stop polling and update UI
        setIsExportingPdf(false);
        if (data.status === "FAILED") {
          setExportError(data.errorCode || "Export failed. Please try again.");
        }
      }
    } catch {
      // Network error during poll — retry
      exportPollTimerRef.current = setTimeout(
        () => pollFnRef.current?.(exportId),
        EXPORT_POLL_INTERVAL_MS * 2,
      );
    }
  }, [bookId]);

  // Keep the stable ref up to date (MUST be in useLayoutEffect, not render)
  useLayoutEffect(() => {
    pollFnRef.current = pollExportStatus;
  });

  // Cleanup export poll on unmount
  useEffect(() => {
    return () => {
      if (exportPollTimerRef.current) {
        clearTimeout(exportPollTimerRef.current);
      }
    };
  }, []);

  // Part 10: Handle Download PDF
  const handleDownloadPdf = useCallback(async () => {
    try {
      const res = await fetch(`/api/books/${bookId}/export/download`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to get download link.");
      }
      const data: { signedUrl: string } = await res.json();
      // Open in new tab to trigger browser download
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Download failed.");
    }
  }, [bookId]);

  // Part 10: Async export handler — flushes save first, then delegates to server
  const handleExportPdf = useCallback(async () => {
    setExportError(undefined);
    setExportState(null);
    setIsExportingPdf(true);

    try {
      // 1. Flush any pending autosave — export must use persisted state
      await autosaveControllerRef.current?.flush();

      // 2. Trigger server-side async export
      const res = await fetch(`/api/books/${bookId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to trigger PDF export.");
      }

      const { exportId, status, designHash } = data as {
        exportId: string;
        status: PdfExportStatus;
        designHash: string;
        reused?: boolean;
      };

      setExportState({
        exportId,
        jobId: data.jobId,
        status,
        progress: status === "SUCCEEDED" ? 100 : 0,
        currentStep: status === "SUCCEEDED" ? "COMPLETE" : "LOADING",
        designHash,
      });

      // 3. If already SUCCEEDED (reused), stop; else start polling
      if (status === "SUCCEEDED") {
        setIsExportingPdf(false);
        return;
      }

      exportPollTimerRef.current = setTimeout(
        () => pollExportStatus(exportId),
        EXPORT_POLL_INTERVAL_MS,
      );
    } catch (err) {
      setIsExportingPdf(false);
      setExportError(err instanceof Error ? err.message : "Export failed.");
    }
  }, [bookId, pollExportStatus]);

  // Keyboard shortcuts (Undo, Redo, Deselect)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Escape") {
        setSelectedElementId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Find partner page for spread view
  const spreadPair = useMemo(() => {
    const curNum = currentPage.pageNumber;
    // If odd page, pair with previous; if even page, pair with next
    const isLeft = curNum % 2 === 0;
    const partnerNum = isLeft ? curNum + 1 : curNum - 1;
    const partner = currentDesign.pages.find((p) => p.pageNumber === partnerNum);

    const left = isLeft ? currentPage : partner || currentPage;
    const right = isLeft ? partner || currentPage : currentPage;
    const activeSpread = currentDesign.spreads.find(
      (s) => s.leftPageId === left.id && s.rightPageId === right.id,
    );

    return { left, right, spread: activeSpread };
  }, [currentDesign, currentPage]);

  const exportReady = exportState?.status === "SUCCEEDED";
  const exportFailed = exportState?.status === "FAILED";
  const exportRunning = isExportingPdf || (
    exportState && !["SUCCEEDED", "FAILED", "EXPIRED"].includes(exportState.status)
  );

  const exportStepLabel: Record<string, string> = {
    LOADING: "Loading design…",
    VALIDATING: "Validating…",
    RENDERING: "Rendering pages…",
    FINALIZING: "Finalizing PDF…",
    COMPLETE: "PDF Ready",
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Toolbar */}
      <EditorToolbar
        bookTitle={bookTitle}
        bookId={bookId}
        canUndo={canUndo(historyState)}
        canRedo={canRedo(historyState)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomChange={setZoom}
        onZoomReset={() => setZoom(1.0)}
        mode={mode}
        onToggleMode={setMode}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        showSafeArea={showSafeArea}
        onToggleSafeArea={() => setShowSafeArea((prev) => !prev)}
        showBleed={showBleed}
        onToggleBleed={() => setShowBleed((prev) => !prev)}
        showGutter={showGutter}
        onToggleGutter={() => setShowGutter((prev) => !prev)}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        errorMessage={saveError}
        onExportPdf={handleExportPdf}
        isExportingPdf={!!exportRunning}
        exportReady={exportReady}
        onDownloadPdf={handleDownloadPdf}
        onOpenTemplateBrowser={() => setIsTemplateBrowserOpen(true)}
      />

      {/* Export Status Strip */}
      {(exportState || exportError) && (
        <div className={`px-4 py-2 flex items-center gap-3 text-xs shrink-0 ${
          exportReady
            ? "bg-emerald-900/40 border-b border-emerald-700/50 text-emerald-300"
            : exportFailed || exportError
            ? "bg-rose-900/40 border-b border-rose-700/50 text-rose-300"
            : "bg-slate-800 border-b border-slate-700 text-slate-300"
        }`}>
          {exportRunning && (
            <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin shrink-0" />
          )}
          {exportReady && (
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {(exportFailed || exportError) && !exportReady && (
            <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}

          <span className="flex-1">
            {exportError
              ? exportError
              : exportState
              ? exportStepLabel[exportState.currentStep] || exportState.currentStep
              : ""}
          </span>

          {exportState && !exportFailed && !exportError && exportState.progress > 0 && !exportReady && (
            <div className="flex items-center gap-1.5">
              <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${exportState.progress}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-slate-400">{Math.round(exportState.progress)}%</span>
            </div>
          )}

          {exportReady && (
            <button
              type="button"
              id="download-pdf-btn"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
          )}
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Page Thumbnail Rail (hidden in preview mode) */}
        {mode === "EDIT" && (
          <PageNavigator
            design={currentDesign}
            selectedPageId={currentPage.id}
            onSelectPage={(pageId) => {
              setSelectedPageId(pageId);
              setSelectedElementId(null);
            }}
          />
        )}

        {/* Center Canvas */}
        {viewMode === "SPREAD" ? (
          <SpreadViewer
            design={currentDesign}
            leftPage={spreadPair.left}
            rightPage={spreadPair.right}
            spread={spreadPair.spread}
            assetMap={assetMap}
            zoom={zoom}
          />
        ) : (
          <EditorCanvasDynamic
            design={currentDesign}
            currentPage={currentPage}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
            onUpdateElementPosition={handleUpdateElementPosition}
            onUpdateElementSize={handleUpdateElementSize}
            onDoubleTapText={(textEl: TextElement) => {
              setSelectedElementId(textEl.id);
            }}
            zoom={zoom}
            mode={mode}
            viewMode={viewMode}
            showSafeArea={showSafeArea}
            showBleed={showBleed}
            showGutter={showGutter}
            assetMap={assetMap}
          />
        )}

        {/* Right Element Inspector Sidebar (hidden in preview mode) */}
        {mode === "EDIT" && (
          <ElementInspector
            design={currentDesign}
            currentPage={currentPage}
            selectedElement={selectedElement}
            protectedPhotoIds={protectedPhotoIds}
            onUpdateElementPosition={handleUpdateElementPosition}
            onUpdateElementSize={handleUpdateElementSize}
            onUpdateTypography={handleUpdateTypography}
            onUpdateImageCrop={handleUpdateImageCrop}
            onDeleteElement={handleDeleteElement}
          />
        )}
      </div>
      {/* Part 10.5 Design System & Template Browser Modal */}
      <TemplateBrowserModal
        isOpen={isTemplateBrowserOpen}
        onClose={() => setIsTemplateBrowserOpen(false)}
        currentPage={currentPage}
        currentDesign={currentDesign}
        onSelectTemplate={handleSelectTemplate}
        onSelectTheme={handleSelectTheme}
        onSelectTypography={handleSelectTypography}
        onRegeneratePage={handleRegeneratePage}
        currentThemeId={currentThemeId}
        currentTypographyId={currentTypographyId}
      />
    </div>
  );
};

