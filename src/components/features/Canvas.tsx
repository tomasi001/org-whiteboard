"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import type { WhiteboardNode } from "@/types";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { findNodeById } from "@/lib/whiteboardTree";
import { NodeCard } from "./NodeCard";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Focus,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface LayoutNode {
  node: WhiteboardNode;
  x: number;
  y: number;
  level: number;
  children: LayoutNode[];
}

interface TreeLayoutProps {
  rootNode: WhiteboardNode;
  levelGap: number;
  nodeGap: number;
}

interface CanvasProps {
  isCanvasOnlyMode?: boolean;
  onToggleCanvasOnlyMode?: () => void;
}

function buildTreeLayout({ rootNode, levelGap, nodeGap }: TreeLayoutProps): LayoutNode {
  const calculateHeights = (node: WhiteboardNode): number => {
    if (node.children.length === 0) return 1;
    return node.children.reduce((sum, child) => sum + calculateHeights(child), 0);
  };

  const layoutNode = (node: WhiteboardNode, level: number, startY: number): LayoutNode => {
    const childHeights = node.children.map((child) => calculateHeights(child));

    let currentY = startY;
    const children: LayoutNode[] = [];

    if (node.children.length > 0) {
      for (let i = 0; i < node.children.length; i += 1) {
        const childHeight = childHeights[i] * nodeGap;
        children.push(layoutNode(node.children[i], level + 1, currentY));
        currentY += childHeight + nodeGap;
      }

      const firstChild = children[0];
      const lastChild = children[children.length - 1];
      const parentY = (firstChild.y + lastChild.y) / 2;

      return { node, x: level * levelGap, y: parentY, level, children };
    }

    return { node, x: level * levelGap, y: startY + nodeGap / 2, level, children: [] };
  };

  return layoutNode(rootNode, 0, 0);
}

function flattenLayout(layout: LayoutNode): LayoutNode[] {
  const result: LayoutNode[] = [layout];
  for (const child of layout.children) {
    result.push(...flattenLayout(child));
  }
  return result;
}

export function Canvas({ isCanvasOnlyMode = false, onToggleCanvasOnlyMode }: CanvasProps) {
  const {
    currentWhiteboard,
    breadcrumbs,
    zoom,
    setZoom,
    pan,
    setPan,
    selectNode,
    drillDown,
  } = useWhiteboard();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{
    mouseX: number;
    mouseY: number;
    panX: number;
    panY: number;
  } | null>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return undefined;

    const handleCtrlWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      if (canvasElement.contains(event.target as Node)) {
        event.preventDefault();
      }
    };

    const preventGesture = (event: Event) => event.preventDefault();

    window.addEventListener("wheel", handleCtrlWheel, { passive: false });
    canvasElement.addEventListener("gesturestart", preventGesture, { passive: false });
    canvasElement.addEventListener("gesturechange", preventGesture, { passive: false });
    canvasElement.addEventListener("gestureend", preventGesture, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleCtrlWheel);
      canvasElement.removeEventListener("gesturestart", preventGesture);
      canvasElement.removeEventListener("gesturechange", preventGesture);
      canvasElement.removeEventListener("gestureend", preventGesture);
    };
  }, []);

  const currentNode = useMemo(() => {
    if (!currentWhiteboard) return null;
    const breadcrumbNode = breadcrumbs[breadcrumbs.length - 1];
    if (!breadcrumbNode) return currentWhiteboard.rootNode;
    return findNodeById(currentWhiteboard.rootNode, breadcrumbNode.id) ?? currentWhiteboard.rootNode;
  }, [currentWhiteboard, breadcrumbs]);

  const layout = useMemo(
    () =>
      currentNode
        ? buildTreeLayout({ rootNode: currentNode, levelGap: 320, nodeGap: 100 })
        : null,
    [currentNode]
  );

  const layoutNodes = useMemo(
    () => (layout ? flattenLayout(layout) : []),
    [layout]
  );

  const bounds = useMemo(() => {
    if (layoutNodes.length === 0) {
      return { minX: 0, maxX: 800, minY: 0, maxY: 600 };
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    layoutNodes.forEach((layoutNode) => {
      minX = Math.min(minX, layoutNode.x);
      maxX = Math.max(maxX, layoutNode.x + 280);
      minY = Math.min(minY, layoutNode.y - 40);
      maxY = Math.max(maxY, layoutNode.y + 80);
    });

    const padding = 100;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
    };
  }, [layoutNodes]);

  const handleFitToView = useCallback(() => {
    if (!canvasRef.current || !currentWhiteboard) return;

    const canvasWidth = canvasRef.current.clientWidth;
    const canvasHeight = canvasRef.current.clientHeight;
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;

    const scaleX = canvasWidth / contentWidth;
    const scaleY = canvasHeight / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 1.5);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const panX = canvasWidth / 2 - centerX * newZoom;
    const panY = canvasHeight / 2 - centerY * newZoom;

    setZoom(newZoom);
    setPan({ x: panX, y: panY });
  }, [bounds, currentWhiteboard, setPan, setZoom]);

  useEffect(() => {
    if (!currentNode) return;
    const timer = window.setTimeout(() => handleFitToView(), 60);
    return () => window.clearTimeout(timer);
  }, [currentNode, handleFitToView]);

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.06, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.06, 0.1));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (event.target === event.currentTarget || target.classList.contains("canvas-content")) {
      setDragStart({
        mouseX: event.clientX,
        mouseY: event.clientY,
        panX: pan.x,
        panY: pan.y,
      });
      event.preventDefault();
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!dragStart) return;
    const deltaX = event.clientX - dragStart.mouseX;
    const deltaY = event.clientY - dragStart.mouseY;
    setPan({ x: dragStart.panX + deltaX, y: dragStart.panY + deltaY });
  };

  const handleMouseUp = () => setDragStart(null);

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const zoomFactor = event.deltaY > 0 ? 0.94 : 1.06;
    const newZoom = Math.max(0.1, Math.min(3, zoom * zoomFactor));

    const canvasX = (mouseX - pan.x) / zoom;
    const canvasY = (mouseY - pan.y) / zoom;

    const newPanX = mouseX - canvasX * newZoom;
    const newPanY = mouseY - canvasY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  if (!currentWhiteboard || !currentNode) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 z-0">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-700">No Whiteboard Loaded</h2>
          <p className="text-slate-500 mt-2">Create a new whiteboard to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className="fixed inset-0 z-0 bg-slate-50"
      style={{
        cursor: dragStart ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onClick={() => selectNode(null)}
    >
      <div
        className={`fixed right-4 z-30 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-md p-2 ${
          isCanvasOnlyMode ? "top-4" : "top-20"
        }`}
      >
        {onToggleCanvasOnlyMode && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCanvasOnlyMode}
            title={isCanvasOnlyMode ? "Exit canvas-only mode" : "Canvas-only mode"}
          >
            {isCanvasOnlyMode ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Focus className="w-4 h-4" />
            )}
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={handleFitToView} title="Fit to view">
          <Maximize2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleResetZoom} title="Reset view">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <div
        className="canvas-content absolute"
        style={{
          left: 0,
          top: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <svg
          className="absolute pointer-events-none"
          style={{
            left: bounds.minX - 100,
            top: bounds.minY - 100,
            width: bounds.maxX - bounds.minX + 200,
            height: bounds.maxY - bounds.minY + 200,
          }}
        >
          {layoutNodes.map((layoutNode) => {
            const nodeCenterX = layoutNode.x + 140;
            const nodeCenterY = layoutNode.y + 40;
            return layoutNode.children.map((child) => {
              const childCenterX = child.x + 140;
              const childCenterY = child.y + 40;
              return (
                <line
                  key={`${layoutNode.node.id}-${child.node.id}`}
                  x1={nodeCenterX - bounds.minX + 100}
                  y1={nodeCenterY - bounds.minY + 100}
                  x2={childCenterX - bounds.minX + 100}
                  y2={childCenterY - bounds.minY + 100}
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.7"
                />
              );
            });
          })}
        </svg>

        {layoutNodes.map((layoutNode) => (
          <div
            key={layoutNode.node.id}
            className="absolute"
            style={{ left: layoutNode.x, top: layoutNode.y, width: "280px" }}
            onClick={(event) => {
              event.stopPropagation();
              selectNode(layoutNode.node);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (layoutNode.node.children.length > 0) drillDown(layoutNode.node);
            }}
          >
            <NodeCard node={layoutNode.node} />
          </div>
        ))}
      </div>
    </div>
  );
}

