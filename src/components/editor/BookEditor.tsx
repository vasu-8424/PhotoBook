"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { EditorToolbar } from "./EditorToolbar";
import { PageNavigator } from "./PageNavigator";
import { ElementInspector } from "./ElementInspector";
import { SpreadViewer } from "./SpreadViewer";

// Dynamic client-side import for Konva Canvas to ensure zero SSR canvas issues
const EditorCanvasDynamic = dynamic(
  () => import("./EditorCanvas").then((mod) => mod.EditorCanvas),
  { ssr: false },
);

export interface BookEditorProps {
  initialDesign: BookDesign;
  bookId: string;
  bookTitle?: string;
  protectedPhotoIds?: string[];
  initialAssets?: Record<string, { previewUrl: string; width?: number; height?: number }>;
  onSave?: (design: BookDesign) => Promise<boolean>;
  onExportPdf?: (design: BookDesign) => Promise<void>;
}

export const BookEditor: React.FC<BookEditorProps> = ({
  initialDesign,
  bookId,
  bookTitle = "Memory Magazine",
  protectedPhotoIds = [],
  initialAssets = {},
  onSave,
  onExportPdf,
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
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

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

  // Export PDF handler
  const handleExportPdf = async () => {
    if (!onExportPdf) return;
    setIsExportingPdf(true);
    try {
      // Flush any pending autosave first
      await autosaveControllerRef.current?.flush();
      await onExportPdf(currentDesign);
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

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
        isExportingPdf={isExportingPdf}
      />

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
    </div>
  );
};
