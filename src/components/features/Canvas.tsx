"use client";

import type { WhiteboardNode } from "@/types";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { NodeCard } from "./NodeCard";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

function findNodeById(node: WhiteboardNode, id: string): WhiteboardNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function Canvas() {
  const { 
    currentWhiteboard, 
    breadcrumbs, 
    zoom, 
    pan, 
    setZoom, 
    setPan,
    selectNode 
  } = useWhiteboard();

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

  // Get current node from whiteboard's rootNode to ensure we have the latest data
  const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
  const currentNode = findNodeById(currentWhiteboard.rootNode, currentBreadcrumb.id) || currentBreadcrumb;

  const handleZoomIn = () => setZoom(zoom + 0.1);
  const handleZoomOut = () => setZoom(zoom - 0.1);
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleCanvasClick = () => {
    selectNode(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-md p-2">
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
        className="flex-1 overflow-auto p-8"
        onClick={handleCanvasClick}
      >
        <div 
          className="min-h-full flex flex-wrap gap-4 content-start items-start"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        >
          <div className="w-full mb-4">
            <h1 className="text-2xl font-bold text-slate-800">{currentNode.name}</h1>
            {currentNode.description && (
              <p className="text-slate-600 mt-1">{currentNode.description}</p>
            )}
          </div>

          {currentNode.children.length > 0 ? (
            currentNode.children.map((child) => (
              <NodeCard key={child.id} node={child} />
            ))
          ) : (
            <div className="w-full py-12 text-center text-slate-400">
              <p>No items yet. Add a department, team, or workflow to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
