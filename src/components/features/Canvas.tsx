"use client";

import { useMemo, useState, useRef, useEffect } from "react";
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
  // Calculate the height needed for each subtree
  const calculateHeights = (node: WhiteboardNode): number => {
    if (node.children.length === 0) {
      return 1; // Each leaf node takes 1 unit
    }
    return node.children.reduce((sum, child) => sum + calculateHeights(child), 0);
  };

  // Layout the tree recursively
  const layoutNode = (node: WhiteboardNode, level: number, startY: number): LayoutNode => {
    const childHeights = node.children.map(child => calculateHeights(child));
    const totalHeight = childHeights.reduce((sum, h) => sum + h, 0);
    
    // Position this node at the center of its children's vertical space
    let currentY = startY;
    const children: LayoutNode[] = [];
    
    if (node.children.length > 0) {
      // Position children first, then center parent
      for (let i = 0; i < node.children.length; i++) {
        const childHeight = childHeights[i] * nodeGap;
        const childY = currentY + childHeight / 2;
        children.push(layoutNode(node.children[i], level + 1, currentY));
        currentY += childHeight + nodeGap;
      }
      
      // Parent is centered over children
      const firstChild = children[0];
      const lastChild = children[children.length - 1];
      const parentY = (firstChild.y + lastChild.y) / 2;
      
      return {
        node,
        x: level * levelGap,
        y: parentY,
        level,
        children,
      };
    } else {
      // Leaf node - position at startY + half its height (which is nodeGap)
      return {
        node,
        x: level * levelGap,
        y: startY + nodeGap / 2,
        level,
        children: [],
      };
    }
  };

  return layoutNode(rootNode, 0, 0);
}

// Flatten tree for rendering
function flattenLayout(layout: LayoutNode): LayoutNode[] {
  const result: LayoutNode[] = [layout];
  for (const child of layout.children) {
    result.push(...flattenLayout(child));
  }
  return result;
}

// Find all descendants
function findAllDescendants(node: WhiteboardNode): WhiteboardNode[] {
  const result: WhiteboardNode[] = [];
  const traverse = (n: WhiteboardNode) => {
    result.push(n);
    n.children.forEach(traverse);
  };
  node.children.forEach(traverse);
  return result;
}

export function Canvas() {
  const { 
    currentWhiteboard, 
    breadcrumbs, 
    zoom, 
    setZoom, 
    setPan,
    selectNode,
    drillDown 
  } = useWhiteboard();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current) {
        setContainerSize({
          width: canvasRef.current.clientWidth,
          height: canvasRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  if (!currentWhiteboard) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-700">No Whiteboard Loaded</h2>
          <p className="text-slate-500 mt-2">Create a new whiteboard to get started</p>
        </div>
      </div>
    );
  }

  const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
  const currentNode = findNodeById(currentWhiteboard.rootNode, currentBreadcrumb.id) || currentBreadcrumb;

  // Build hierarchical layout
  const layout = useMemo(() => {
    return buildTreeLayout({ 
      rootNode: currentNode, 
      levelGap: 320, 
      nodeGap: 100 
    });
  }, [currentNode]);

  const layoutNodes = useMemo(() => {
    return flattenLayout(layout);
  }, [layout]);

  // Calculate canvas bounds
  const bounds = useMemo(() => {
    if (layoutNodes.length === 0) return { minX: 0, maxX: 800, minY: 0, maxY: 600 };
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    layoutNodes.forEach(ln => {
      minX = Math.min(minX, ln.x);
      maxX = Math.max(maxX, ln.x + 280); // Node width
      minY = Math.min(minY, ln.y - 40);
      maxY = Math.max(maxY, ln.y + 80); // Node height
    });
    return { minX: minX - 50, maxX: maxX + 50, minY: minY - 50, maxY: maxY + 50 };
  }, [layoutNodes]);

  // Auto-fit function
  const handleFitToView = () => {
    const canvasWidth = containerSize.width - 100;
    const canvasHeight = containerSize.height - 100;
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    
    const scaleX = canvasWidth / contentWidth;
    const scaleY = canvasHeight / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 1);
    
    setZoom(newZoom);
    setPan({ x: 50, y: 50 });
  };

  const handleZoomIn = () => setZoom(zoom + 0.1);
  const handleZoomOut = () => setZoom(zoom - 0.1);
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-content')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - zoom * 50, y: e.clientY - zoom * 50 });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: (e.clientX - dragStart.x) / zoom,
        y: (e.clientY - dragStart.y) / zoom
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleNodeClick = (node: WhiteboardNode, e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node);
  };

  const handleNodeDoubleClick = (node: WhiteboardNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.children.length > 0) {
      drillDown(node);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-md p-2">
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

      {/* Canvas Area */}
      <div 
        ref={canvasRef}
        className="flex-1 overflow-hidden cursor-grab"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onClick={() => selectNode(null)}
      >
        <div 
          className="canvas-content relative"
          style={{
            width: '5000px',
            height: '3000px',
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Draw connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '5000px', minHeight: '3000px' }}>
            {layoutNodes.map(ln => (
              ln.children.map(child => (
                <line
                  key={`${ln.node.id}-${child.node.id}`}
                  x1={ln.x + 280}
                  y1={ln.y + 40}
                  x2={child.x}
                  y2={child.y + 40}
                  stroke="#cbd5e1"
                  strokeWidth="2"
                />
              ))
            ))}
          </svg>

          {/* Draw nodes */}
          {layoutNodes.map(ln => (
            <div
              key={ln.node.id}
              className="absolute"
              style={{
                left: ln.x,
                top: ln.y,
                width: '280px',
              }}
              onClick={(e) => handleNodeClick(ln.node, e)}
              onDoubleClick={(e) => handleNodeDoubleClick(ln.node, e)}
            >
              <NodeCard node={ln.node} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
