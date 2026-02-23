"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import type { WhiteboardNode } from "@/types";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { NodeCard } from "./NodeCard";
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

function findNodeById(node: WhiteboardNode, id: string): WhiteboardNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

// Layout types
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

function buildTreeLayout({ rootNode, levelGap, nodeGap }: TreeLayoutProps): LayoutNode {
  const calculateHeights = (node: WhiteboardNode): number => {
    if (node.children.length === 0) return 1;
    return node.children.reduce((sum, child) => sum + calculateHeights(child), 0);
  };

  const layoutNode = (node: WhiteboardNode, level: number, startY: number): LayoutNode => {
    const childHeights = node.children.map(child => calculateHeights(child));
    
    let currentY = startY;
    const children: LayoutNode[] = [];
    
    if (node.children.length > 0) {
      for (let i = 0; i < node.children.length; i++) {
        const childHeight = childHeights[i] * nodeGap;
        children.push(layoutNode(node.children[i], level + 1, currentY));
        currentY += childHeight + nodeGap;
      }
      
      const firstChild = children[0];
      const lastChild = children[children.length - 1];
      const parentY = (firstChild.y + lastChild.y) / 2;
      
      return { node, x: level * levelGap, y: parentY, level, children };
    } else {
      return { node, x: level * levelGap, y: startY + nodeGap / 2, level, children: [] };
    }
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

export function Canvas() {
  const { 
    currentWhiteboard, 
    breadcrumbs, 
    zoom, 
    setZoom, 
    pan,
    setPan,
    selectNode,
    drillDown 
  } = useWhiteboard();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  const { bounds } = useMemo(() => {
    if (!currentWhiteboard) {
      return { bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 } };
    }

    const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
    const currentNode = findNodeById(currentWhiteboard.rootNode, currentBreadcrumb.id) || currentBreadcrumb;
    
    const layout = buildTreeLayout({ rootNode: currentNode, levelGap: 320, nodeGap: 100 });
    const layoutNodes = flattenLayout(layout);

    if (layoutNodes.length === 0) {
      return { bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 } };
    }
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    layoutNodes.forEach(ln => {
      minX = Math.min(minX, ln.x);
      maxX = Math.max(maxX, ln.x + 280);
      minY = Math.min(minY, ln.y - 40);
      maxY = Math.max(maxY, ln.y + 80);
    });
    
    const padding = 100;
    return { 
      bounds: { 
        minX: minX - padding, 
        maxX: maxX + padding, 
        minY: minY - padding, 
        maxY: maxY + padding 
      }
    };
  }, [currentWhiteboard, breadcrumbs]);

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
  }, [bounds, setZoom, setPan, currentWhiteboard]);

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.06, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.06, 0.1));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-content')) {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      setPan({ x: pan.x + deltaX, y: pan.y + deltaY });
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.94 : 1.06;
    const newZoom = Math.max(0.1, Math.min(3, zoom * zoomFactor));
    
    const canvasX = (mouseX - pan.x) / zoom;
    const canvasY = (mouseY - pan.y) / zoom;
    
    const newPanX = mouseX - canvasX * newZoom;
    const newPanY = mouseY - canvasY * newZoom;
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  useEffect(() => {
    if (currentWhiteboard && bounds) {
      const timer = setTimeout(handleFitToView, 100);
      return () => clearTimeout(timer);
    }
  }, [currentWhiteboard]);

  if (!currentWhiteboard) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 z-0">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-700">No Whiteboard Loaded</h2>
          <p className="text-slate-500 mt-2">Create a new whiteboard to get started</p>
        </div>
      </div>
    );
  }

  const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
  const currentNode = findNodeById(currentWhiteboard.rootNode, currentBreadcrumb.id) || currentBreadcrumb;

  const layout = useMemo(() => buildTreeLayout({ rootNode: currentNode, levelGap: 320, nodeGap: 100 }), [currentNode]);
  const layoutNodes = useMemo(() => flattenLayout(layout), [layout]);

  const handleNodeClick = (node: WhiteboardNode, e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node);
  };

  const handleNodeDoubleClick = (node: WhiteboardNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.children.length > 0) drillDown(node);
  };

  return (
    <div 
      ref={canvasRef}
      className="fixed inset-0 z-0 bg-slate-50"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onClick={() => selectNode(null)}
    >
      {/* Zoom Controls - fixed position, low z-index so header is above */}
      <div className="fixed top-20 right-4 z-30 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-md p-2">
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

      {/* Canvas content - transforms for pan/zoom */}
      <div 
        className="canvas-content absolute"
        style={{
          left: 0,
          top: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Connection lines */}
        <svg 
          className="absolute pointer-events-none" 
          style={{ 
            left: bounds.minX - 100, 
            top: bounds.minY - 100,
            width: bounds.maxX - bounds.minX + 200,
            height: bounds.maxY - bounds.minY + 200,
          }}
        >
          {layoutNodes.map(ln => {
            const nodeCenterX = ln.x + 140;
            const nodeCenterY = ln.y + 40;
            return ln.children.map(child => {
              const childCenterX = child.x + 140;
              const childCenterY = child.y + 40;
              return (
                <line
                  key={`${ln.node.id}-${child.node.id}`}
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

        {/* Nodes */}
        {layoutNodes.map(ln => (
          <div
            key={ln.node.id}
            className="absolute"
            style={{ left: ln.x, top: ln.y, width: '280px' }}
            onClick={(e) => handleNodeClick(ln.node, e)}
            onDoubleClick={(e) => handleNodeDoubleClick(ln.node, e)}
          >
            <NodeCard node={ln.node} />
          </div>
        ))}
      </div>
    </div>
  );
}