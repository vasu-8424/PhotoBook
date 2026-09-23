"use client";

import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Image as KonvaImage, Text as KonvaText, Line, Transformer, Group } from "react-konva";
import type Konva from "konva";
import type { BookDesign, BookPage, ImageElement, TextElement, ShapeElement } from "@/types/design";
import { mmToPx, pxToMm, ptToPx } from "@/lib/editor/coordinates";
import { calculateKonvaImageCrop } from "@/lib/editor/renderer";
import {
  BLEED_GUIDE_COLOR,
  CANVAS_WORKSPACE_BG,
  DEFAULT_PAGE_BG_COLOR,
  GUTTER_GUIDE_COLOR,
  SAFE_AREA_COLOR,
  SELECTION_BOX_COLOR,
} from "@/lib/editor/constants";
import type { EditorAssetMap, EditorMode, EditorViewMode } from "@/lib/editor/types";

interface EditorCanvasProps {
  design: BookDesign;
  currentPage: BookPage;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElementPosition: (xMm: number, yMm: number) => void;
  onUpdateElementSize: (widthMm: number, heightMm: number) => void;
  onDoubleTapText?: (element: TextElement) => void;
  zoom: number;
  mode: EditorMode;
  viewMode: EditorViewMode;
  showSafeArea: boolean;
  showBleed: boolean;
  showGutter: boolean;
  assetMap: EditorAssetMap;
}

/**
 * Custom hook to load an image URL into an HTMLImageElement for react-konva
 */
function useImageLoader(url: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!url) return;
    let active = true;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      if (active) {
        setImage(img);
        setLoadedUrl(url);
      }
    };
    img.onerror = () => {
      if (active) {
        setImage(null);
        setLoadedUrl(url);
      }
    };

    return () => {
      active = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return loadedUrl === url ? image : null;
}

/**
 * Image node renderer with COVER / CONTAIN crop calculation
 */
const RenderKonvaImage: React.FC<{
  element: ImageElement;
  scale: number;
  assetMap: EditorAssetMap;
  isSelected: boolean;
  isDraggable: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}> = ({ element, scale, assetMap, isDraggable, onSelect, onDragEnd }) => {
  const asset = assetMap.get(element.assetId);
  const imgElement = useImageLoader(asset?.previewUrl);

  const xPx = mmToPx(element.xMm, scale);
  const yPx = mmToPx(element.yMm, scale);
  const wPx = mmToPx(element.widthMm, scale);
  const hPx = mmToPx(element.heightMm, scale);

  const crop = imgElement
    ? calculateKonvaImageCrop(
        imgElement.naturalWidth || 1000,
        imgElement.naturalHeight || 1000,
        wPx,
        hPx,
        element.fit,
        element.focalPoint,
      )
    : undefined;

  return (
    <Group
      id={element.id}
      x={xPx}
      y={yPx}
      width={wPx}
      height={hPx}
      rotation={element.rotation || 0}
      opacity={element.opacity !== undefined ? element.opacity : 1}
      draggable={isDraggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
    >
      {imgElement ? (
        <KonvaImage
          image={imgElement}
          width={wPx}
          height={hPx}
          crop={crop}
        />
      ) : (
        <Rect
          width={wPx}
          height={hPx}
          fill="#334155"
          stroke="#475569"
          strokeWidth={1}
        />
      )}
    </Group>
  );
};

/**
 * Text node renderer with font styling
 */
const RenderKonvaText: React.FC<{
  element: TextElement;
  scale: number;
  isSelected: boolean;
  isDraggable: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onDblClick?: () => void;
}> = ({ element, scale, isDraggable, onSelect, onDragEnd, onDblClick }) => {
  const xPx = mmToPx(element.xMm, scale);
  const yPx = mmToPx(element.yMm, scale);
  const wPx = mmToPx(element.widthMm, scale);
  const hPx = mmToPx(element.heightMm, scale);
  const fontSizePx = ptToPx(element.fontSizePt, scale);

  return (
    <KonvaText
      id={element.id}
      x={xPx}
      y={yPx}
      width={wPx}
      height={hPx}
      text={element.text}
      fontSize={fontSizePx}
      fontFamily={element.fontFamily || "Inter"}
      fontStyle={element.fontWeight >= 700 ? "bold" : "normal"}
      fill={element.color || "#0F172A"}
      align={element.align || "left"}
      lineHeight={element.lineHeight || 1.2}
      letterSpacing={element.letterSpacingPt || 0}
      rotation={element.rotation || 0}
      draggable={isDraggable}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
    />
  );
};

/**
 * Shape node renderer (Rectangle, Line, Circle)
 */
const RenderKonvaShape: React.FC<{
  element: ShapeElement;
  scale: number;
  isSelected: boolean;
  isDraggable: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}> = ({ element, scale, isDraggable, onSelect, onDragEnd }) => {
  const xPx = mmToPx(element.xMm, scale);
  const yPx = mmToPx(element.yMm, scale);
  const wPx = mmToPx(element.widthMm, scale);
  const hPx = mmToPx(element.heightMm, scale);
  const strokeWidthPx = element.strokeWidthMm ? mmToPx(element.strokeWidthMm, scale) : 1;

  if (element.shape === "circle") {
    return (
      <Group
        id={element.id}
        x={xPx}
        y={yPx}
        draggable={isDraggable}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      >
        <Rect
          width={wPx}
          height={hPx}
          cornerRadius={wPx / 2}
          fill={element.fill}
          stroke={element.stroke}
          strokeWidth={strokeWidthPx}
        />
      </Group>
    );
  }

  return (
    <Rect
      id={element.id}
      x={xPx}
      y={yPx}
      width={wPx}
      height={hPx}
      fill={element.fill}
      stroke={element.stroke}
      strokeWidth={strokeWidthPx}
      draggable={isDraggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
    />
  );
};

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  design,
  currentPage,
  selectedElementId,
  onSelectElement,
  onUpdateElementPosition,
  onUpdateElementSize,
  onDoubleTapText,
  zoom,
  mode,
  showSafeArea,
  showBleed,
  showGutter,
  assetMap,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const [containerDimensions, setContainerDimensions] = useState({ width: 900, height: 800 });

  // Update container size on resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Compute effective scale based on container dimensions and zoom
  const doc = design.document;
  const paddingPx = 80;
  const baseScaleW = (containerDimensions.width - paddingPx) / doc.widthMm;
  const baseScaleH = (containerDimensions.height - paddingPx) / doc.heightMm;
  const baseScale = Math.min(baseScaleW, baseScaleH, 3.0);
  const effectiveScale = Math.max(0.5, baseScale) * zoom;

  const pageWPx = mmToPx(doc.widthMm, effectiveScale);
  const pageHPx = mmToPx(doc.heightMm, effectiveScale);

  // Position page in the center of the canvas viewport
  const pageOffsetX = Math.max(40, (containerDimensions.width - pageWPx) / 2);
  const pageOffsetY = Math.max(40, (containerDimensions.height - pageHPx) / 2);

  // Guides dimensions
  const bleedPx = mmToPx(doc.bleedMm, effectiveScale);
  const safePx = mmToPx(doc.safeAreaMm, effectiveScale);
  const gutterPx = mmToPx(doc.gutterMm, effectiveScale);

  // Attach Konva Transformer when selection changes
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;

    if (selectedElementId && mode === "EDIT") {
      const selectedNode = stageRef.current.findOne(`#${selectedElementId}`);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer()?.batchDraw();
        return;
      }
    }

    transformerRef.current.nodes([]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedElementId, mode, currentPage]);

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // If clicked directly on the stage or page background, deselect
    if (e.target === stageRef.current || e.target.hasName("page-background")) {
      onSelectElement(null);
    }
  };

  const handleDragEnd = (newXPx: number, newYPx: number) => {
    const newXMm = pxToMm(newXPx, effectiveScale);
    const newYMm = pxToMm(newYPx, effectiveScale);
    onUpdateElementPosition(newXMm, newYMm);
  };

  const handleTransformEnd = () => {
    if (!transformerRef.current) return;
    const node = transformerRef.current.nodes()[0];
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scales on the node to prevent scale compounding
    node.scaleX(1);
    node.scaleY(1);

    const newWidthPx = Math.max(10, node.width() * scaleX);
    const newHeightPx = Math.max(10, node.height() * scaleY);

    const newWidthMm = pxToMm(newWidthPx, effectiveScale);
    const newHeightMm = pxToMm(newHeightPx, effectiveScale);
    const newXMm = pxToMm(node.x(), effectiveScale);
    const newYMm = pxToMm(node.y(), effectiveScale);

    onUpdateElementPosition(newXMm, newYMm);
    onUpdateElementSize(newWidthMm, newHeightMm);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 h-full w-full relative overflow-auto select-none"
      style={{ backgroundColor: CANVAS_WORKSPACE_BG }}
    >
      <Stage
        ref={stageRef}
        width={Math.max(containerDimensions.width, pageWPx + pageOffsetX * 2)}
        height={Math.max(containerDimensions.height, pageHPx + pageOffsetY * 2)}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer>
          {/* Main Page Canvas Container */}
          <Group x={pageOffsetX} y={pageOffsetY}>
            {/* Physical Paper Background with Subtle Drop Shadow */}
            <Rect
              name="page-background"
              width={pageWPx}
              height={pageHPx}
              fill={DEFAULT_PAGE_BG_COLOR}
              shadowColor="rgba(0, 0, 0, 0.45)"
              shadowBlur={30}
              shadowOffset={{ x: 0, y: 12 }}
              shadowOpacity={0.6}
            />

            {/* Elements Layer */}
            {currentPage.elements.map((el) => {
              const isSelected = el.id === selectedElementId;
              const isDraggable = mode === "EDIT";

              if (el.type === "image") {
                return (
                  <RenderKonvaImage
                    key={el.id}
                    element={el}
                    scale={effectiveScale}
                    assetMap={assetMap}
                    isSelected={isSelected}
                    isDraggable={isDraggable}
                    onSelect={() => onSelectElement(el.id)}
                    onDragEnd={handleDragEnd}
                  />
                );
              }

              if (el.type === "text") {
                return (
                  <RenderKonvaText
                    key={el.id}
                    element={el}
                    scale={effectiveScale}
                    isSelected={isSelected}
                    isDraggable={isDraggable}
                    onSelect={() => onSelectElement(el.id)}
                    onDragEnd={handleDragEnd}
                    onDblClick={() => onDoubleTapText && onDoubleTapText(el)}
                  />
                );
              }

              if (el.type === "shape") {
                return (
                  <RenderKonvaShape
                    key={el.id}
                    element={el}
                    scale={effectiveScale}
                    isSelected={isSelected}
                    isDraggable={isDraggable}
                    onSelect={() => onSelectElement(el.id)}
                    onDragEnd={handleDragEnd}
                  />
                );
              }

              return null;
            })}

            {/* Bleed Boundary Guide (Red Dashed) */}
            {showBleed && (
              <Rect
                x={-bleedPx}
                y={-bleedPx}
                width={pageWPx + bleedPx * 2}
                height={pageHPx + bleedPx * 2}
                stroke={BLEED_GUIDE_COLOR}
                dash={[6, 6]}
                strokeWidth={1.5}
                listening={false}
              />
            )}

            {/* Safe Area Boundary Guide (Blue Dashed) */}
            {showSafeArea && mode === "EDIT" && (
              <Rect
                x={safePx}
                y={safePx}
                width={pageWPx - safePx * 2}
                height={pageHPx - safePx * 2}
                stroke={SAFE_AREA_COLOR}
                dash={[6, 6]}
                strokeWidth={1.5}
                listening={false}
              />
            )}

            {/* Gutter Margin Guide (Amber Dashed) */}
            {showGutter && mode === "EDIT" && (
              <Line
                points={[gutterPx, 0, gutterPx, pageHPx]}
                stroke={GUTTER_GUIDE_COLOR}
                dash={[4, 4]}
                strokeWidth={1.5}
                listening={false}
              />
            )}

            {/* Konva Transformer for Interactive Selection & Resizing */}
            {mode === "EDIT" && (
              <Transformer
                ref={transformerRef}
                borderStroke={SELECTION_BOX_COLOR}
                borderStrokeWidth={1.5}
                anchorFill="#FFFFFF"
                anchorStroke={SELECTION_BOX_COLOR}
                anchorSize={8}
                anchorCornerRadius={2}
                rotateEnabled={true}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 15 || newBox.height < 15) {
                    return oldBox;
                  }
                  return newBox;
                }}
                onTransformEnd={handleTransformEnd}
              />
            )}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
};
