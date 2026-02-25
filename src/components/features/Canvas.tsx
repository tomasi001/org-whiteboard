"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import type { WhiteboardNode } from "@/types";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { findNodeById } from "@/lib/whiteboardTree";
import { getNodeLayerColor } from "@/lib/hierarchy";
import { NodeCard } from "./NodeCard";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Focus,
  Minimize2,
  LayoutGrid,
  Move,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface LayoutNode {
  node: WhiteboardNode;
  x: number;
  y: number;
  level: number;
  children: LayoutNode[];
}

interface PositionedNode {
  node: WhiteboardNode;
  x: number;
  y: number;
  children: string[];
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

function flattenLayout(layout: LayoutNode): PositionedNode[] {
  const visit = (entry: LayoutNode): PositionedNode[] => [
    {
      node: entry.node,
      x: entry.x,
      y: entry.y,
      children: entry.children.map((child) => child.node.id),
    },
    ...entry.children.flatMap((child) => visit(child)),
  ];

  return visit(layout);
}

function flattenFromStoredPositions(rootNode: WhiteboardNode): PositionedNode[] {
  const visit = (node: WhiteboardNode): PositionedNode[] => [
    {
      node,
      x: node.position.x,
      y: node.position.y,
      children: node.children.map((child) => child.id),
    },
    ...node.children.flatMap((child) => visit(child)),
  ];

  return visit(rootNode);
}

export function Canvas({ isCanvasOnlyMode = false, onToggleCanvasOnlyMode }: CanvasProps) {
  const {
    currentWhiteboard,
    selectedNode,
    breadcrumbs,
    zoom,
    setZoom,
    pan,
    setPan,
    selectNode,
    drillDown,
    openAutomationBoard,
    setNodePositions,
    setLayoutMode,
  } = useWhiteboard();

  const canvasRef = useRef<HTMLDivElement>(null);
  const setZoomRef = useRef(setZoom);
  const setPanRef = useRef(setPan);
  const autoFitKeyRef = useRef<string>("");
  const [dragStart, setDragStart] = useState<{
    mouseX: number;
    mouseY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [dragPreviewPositions, setDragPreviewPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});

  useEffect(() => {
    setZoomRef.current = setZoom;
    setPanRef.current = setPan;
  }, [setPan, setZoom]);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return undefined;

    const handleCtrlWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      if (canvasElement.contains(event.target as Node)) {
        event.preventDefault();
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      if (canvasElement.contains(event.target as Node)) {
        event.preventDefault();
      }
    };

    const preventGesture = (event: Event) => event.preventDefault();

    window.addEventListener("wheel", handleCtrlWheel, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvasElement.addEventListener("gesturestart", preventGesture, { passive: false });
    canvasElement.addEventListener("gesturechange", preventGesture, { passive: false });
    canvasElement.addEventListener("gestureend", preventGesture, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleCtrlWheel);
      window.removeEventListener("touchmove", handleTouchMove);
      canvasElement.removeEventListener("gesturestart", preventGesture);
      canvasElement.removeEventListener("gesturechange", preventGesture);
      canvasElement.removeEventListener("gestureend", preventGesture);
    };
  }, []);

  const currentNode = useMemo(() => {
    if (!currentWhiteboard) return null;
    const breadcrumbNode = breadcrumbs[breadcrumbs.length - 1];
    if (!breadcrumbNode) return currentWhiteboard.rootNode;
    return (
      findNodeById(currentWhiteboard.rootNode, breadcrumbNode.id) ?? currentWhiteboard.rootNode
    );
  }, [currentWhiteboard, breadcrumbs]);

  const autoLayout = useMemo(
    () =>
      currentNode
        ? buildTreeLayout({ rootNode: currentNode, levelGap: 320, nodeGap: 110 })
        : null,
    [currentNode]
  );

  const layoutMode = currentWhiteboard?.layoutMode ?? "auto";

  const baseNodes = useMemo(() => {
    if (!currentNode) return [];
    if (layoutMode === "freeform") {
      return flattenFromStoredPositions(currentNode);
    }
    return autoLayout ? flattenLayout(autoLayout) : [];
  }, [autoLayout, currentNode, layoutMode]);

  const layoutNodes = useMemo(
    () =>
      baseNodes.map((entry) => ({
        ...entry,
        x: dragPreviewPositions[entry.node.id]?.x ?? entry.x,
        y: dragPreviewPositions[entry.node.id]?.y ?? entry.y,
      })),
    [baseNodes, dragPreviewPositions]
  );

  const nodeMap = useMemo(
    () => new Map(layoutNodes.map((entry) => [entry.node.id, entry])),
    [layoutNodes]
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

    const padding = 120;
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
    const newZoom = Math.min(scaleX, scaleY, 1.4);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const panX = canvasWidth / 2 - centerX * newZoom;
    const panY = canvasHeight / 2 - centerY * newZoom;

    setZoomRef.current(newZoom);
    setPanRef.current({ x: panX, y: panY });
  }, [bounds, currentWhiteboard]);

  const currentNodeId = currentNode?.id;
  const currentWhiteboardId = currentWhiteboard?.id;

  useEffect(() => {
    if (!currentNodeId || !currentWhiteboardId) return;

    const nextAutoFitKey = `${currentWhiteboardId}:${currentNodeId}`;
    if (autoFitKeyRef.current === nextAutoFitKey) return;

    autoFitKeyRef.current = nextAutoFitKey;
    const timer = window.setTimeout(() => handleFitToView(), 60);
    return () => window.clearTimeout(timer);
  }, [currentNodeId, currentWhiteboardId, handleFitToView]);

  const persistDisplayedPositions = useCallback(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    layoutNodes.forEach((entry) => {
      positions[entry.node.id] = { x: entry.x, y: entry.y };
    });
    setNodePositions(positions);
  }, [layoutNodes, setNodePositions]);

  const handleEnableFreeform = useCallback(() => {
    persistDisplayedPositions();
    setLayoutMode("freeform");
  }, [persistDisplayedPositions, setLayoutMode]);

  const handleAutoLayout = useCallback(() => {
    if (!autoLayout) return;

    const positions: Record<string, { x: number; y: number }> = {};
    flattenLayout(autoLayout).forEach((entry) => {
      positions[entry.node.id] = { x: entry.x, y: entry.y };
    });

    setNodePositions(positions);
    setLayoutMode("auto");

    window.setTimeout(() => {
      handleFitToView();
    }, 30);
  }, [autoLayout, handleFitToView, setLayoutMode, setNodePositions]);

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.08, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.08, 0.1));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (draggingNode) return;

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

  const handleNodeMouseDown = (nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    const entry = nodeMap.get(nodeId);
    if (!entry) return;

    if (layoutMode !== "freeform") return;

    setDraggingNode({
      id: nodeId,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startX: entry.x,
      startY: entry.y,
    });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (draggingNode) {
      const deltaX = (event.clientX - draggingNode.startMouseX) / zoom;
      const deltaY = (event.clientY - draggingNode.startMouseY) / zoom;
      setDragPreviewPositions((current) => ({
        ...current,
        [draggingNode.id]: {
          x: Math.round(draggingNode.startX + deltaX),
          y: Math.round(draggingNode.startY + deltaY),
        },
      }));
      return;
    }

    if (!dragStart) return;
    const deltaX = event.clientX - dragStart.mouseX;
    const deltaY = event.clientY - dragStart.mouseY;
    setPan({ x: dragStart.panX + deltaX, y: dragStart.panY + deltaY });
  };

  const handleMouseUp = () => {
    if (draggingNode) {
      const nodePosition = dragPreviewPositions[draggingNode.id];
      if (nodePosition) {
        setNodePositions({ [draggingNode.id]: nodePosition });
      }
      setDraggingNode(null);
      setDragPreviewPositions({});
    }

    setDragStart(null);
  };

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
      <div className="fixed inset-0 flex items-center justify-center bg-black/20 z-0">
        <div className="text-center">
          <h2 className="text-xl font-roundo lowercase tracking-wide text-cardzzz-cream">
            no whiteboard loaded
          </h2>
          <p className="text-cardzzz-cream/80 mt-2 font-satoshi">
            create a new whiteboard to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_20%_20%,rgba(86,0,0,0.55)_0%,rgba(34,0,32,0.95)_60%,rgba(8,8,14,1)_100%)]"
      style={{
        cursor: draggingNode ? "grabbing" : dragStart ? "grabbing" : "grab",
        touchAction: "none",
        overscrollBehavior: "contain",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onClick={() => selectNode(null)}
    >
      <div
        className={`fixed right-4 z-30 flex items-center gap-2 bg-black/30 backdrop-blur-md border border-white/20 rounded-[16.168px] shadow-[0_8px_30px_rgba(0,0,0,0.25)] p-2 ${
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
            {isCanvasOnlyMode ? <Minimize2 className="w-4 h-4" /> : <Focus className="w-4 h-4" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={layoutMode === "freeform" ? handleAutoLayout : handleEnableFreeform}
          title={layoutMode === "freeform" ? "Auto layout" : "Freeform layout"}
        >
          {layoutMode === "freeform" ? <LayoutGrid className="w-4 h-4" /> : <Move className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleFitToView} title="Fit to view">
          <Maximize2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-sm font-satoshi text-cardzzz-cream w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
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
          {layoutNodes.flatMap((entry) => {
            const nodeCenterX = entry.x + 140;
            const nodeCenterY = entry.y + 40;

            return entry.children
              .map((childId) => {
                const child = nodeMap.get(childId);
                if (!child) return null;

                const childCenterX = child.x + 140;
                const childCenterY = child.y + 40;

                return (
                  <line
                    key={`${entry.node.id}-${child.node.id}`}
                    x1={nodeCenterX - bounds.minX + 100}
                    y1={nodeCenterY - bounds.minY + 100}
                    x2={childCenterX - bounds.minX + 100}
                    y2={childCenterY - bounds.minY + 100}
                    stroke="#fffadc"
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.25"
                  />
                );
              })
              .filter(Boolean);
          })}
        </svg>

        {layoutNodes.map((entry) => (
          <div
            key={entry.node.id}
            className="absolute"
            style={{ left: entry.x, top: entry.y, width: "280px" }}
            onMouseDown={(event) => handleNodeMouseDown(entry.node.id, event)}
            onClick={(event) => {
              event.stopPropagation();
              selectNode(entry.node);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (entry.node.type === "automation") {
                openAutomationBoard(entry.node.id);
                return;
              }
              if (entry.node.children.length > 0) {
                drillDown(entry.node);
              }
            }}
          >
            <NodeCard
              node={entry.node}
              isSelected={selectedNode?.id === entry.node.id}
              layerColor={getNodeLayerColor(entry.node.type, currentWhiteboard.layerColors)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
