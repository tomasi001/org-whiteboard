"use client";

import { useMemo } from "react";
import type { WhiteboardNode } from "@/types";
import { ZoomIn, ZoomOut, Maximize2, X, Expand } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

interface LayoutNode {
  node: WhiteboardNode;
  x: number;
  y: number;
  level: number;
  children: LayoutNode[];
}

interface MiniCanvasPreviewProps {
  rootNode: WhiteboardNode;
  onNodeClick?: (node: WhiteboardNode) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

function buildTreeLayout(rootNode: WhiteboardNode, levelGap: number, nodeGap: number): LayoutNode {
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

export function MiniCanvasPreview({ rootNode, onNodeClick, onConfirm, onCancel }: MiniCanvasPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const layout = useMemo(() => buildTreeLayout(rootNode, 280, 80), [rootNode]);
  const layoutNodes = useMemo(() => flattenLayout(layout), [layout]);

  // Calculate bounds
  const bounds = useMemo(() => {
    if (layoutNodes.length === 0) {
      return { minX: 0, maxX: 600, minY: 0, maxY: 400 };
    }
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    layoutNodes.forEach(ln => {
      minX = Math.min(minX, ln.x);
      maxX = Math.max(maxX, ln.x + 240);
      minY = Math.min(minY, ln.y - 30);
      maxY = Math.max(maxY, ln.y + 60);
    });
    
    const padding = 60;
    return { 
      minX: minX - padding, 
      maxX: maxX + padding, 
      minY: minY - padding, 
      maxY: maxY + padding 
    };
  }, [layoutNodes]);

  // Auto-fit on mount
  useEffect(() => {
    if (!containerRef.current) return;
    
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 0.8) * 0.9;
    
    setZoom(Math.max(0.2, newZoom));
    
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const panX = containerWidth / 2 - centerX * newZoom;
    const panY = containerHeight / 2 - centerY * newZoom;
    
    setPan({ x: panX, y: panY });
  }, [bounds]);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(z => Math.min(z + 0.1, 1.5));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(z => Math.max(z - 0.1, 0.1));
  };

  const handleFitToView = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!containerRef.current) return;
    
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 0.8) * 0.9;
    
    setZoom(Math.max(0.2, newZoom));
    
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const panX = containerWidth / 2 - centerX * newZoom;
    const panY = containerHeight / 2 - centerY * newZoom;
    
    setPan({ x: panX, y: panY });
  }, [bounds]);

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
    e.stopPropagation();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.1, Math.min(1.5, z * zoomFactor)));
  };

  const handleNodeClick = (node: WhiteboardNode, e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeClick?.(node);
  };

  return (
    <div className={`flex flex-col border border-white/20 rounded-[16.168px] overflow-hidden bg-black/20 backdrop-blur-md ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
      {/* Header with zoom controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/20 border-b border-white/20">
        <span className="text-xs font-roundo lowercase text-cardzzz-cream">preview</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1 hover:bg-white/10 rounded-[10px] transition-colors text-cardzzz-cream"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-cardzzz-cream w-10 text-center font-satoshi">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-1 hover:bg-white/10 rounded-[10px] transition-colors text-cardzzz-cream"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleFitToView()}
            className="p-1 hover:bg-white/10 rounded-[10px] transition-colors text-cardzzz-cream"
            title="Fit to view"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 hover:bg-white/10 rounded-[10px] transition-colors text-cardzzz-cream"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <X className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div 
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ 
          cursor: isDragging ? 'grabbing' : 'grab',
          height: isFullscreen ? 'calc(100vh - 100px)' : '256px'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
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
              left: bounds.minX - 50, 
              top: bounds.minY - 50,
              width: bounds.maxX - bounds.minX + 100,
              height: bounds.maxY - bounds.minY + 100,
              overflow: 'visible',
            }}
          >
            {layoutNodes.map(ln => {
              const nodeCenterX = ln.x + 120;
              const nodeCenterY = ln.y + 30;
              return ln.children.map(child => {
                const childCenterX = child.x + 120;
                const childCenterY = child.y + 30;
                return (
                  <line
                    key={`${ln.node.id}-${child.node.id}`}
                    x1={nodeCenterX - bounds.minX + 50}
                    y1={nodeCenterY - bounds.minY + 50}
                    x2={childCenterX - bounds.minX + 50}
                    y2={childCenterY - bounds.minY + 50}
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                );
              });
            })}
          </svg>

          {/* Nodes - smaller cards for preview */}
          {layoutNodes.map(ln => (
            <div
              key={ln.node.id}
              className="absolute"
              style={{ left: ln.x, top: ln.y }}
              onClick={(e) => handleNodeClick(ln.node, e)}
            >
              <div className="bg-white/10 backdrop-blur-md rounded-[12px] border border-white/20 p-2 min-w-[180px] max-w-[200px]">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded flex items-center justify-center ${
                    ln.node.type === 'organisation' ? 'bg-cardzzz-cream/20 text-cardzzz-cream' :
                    ln.node.type === 'department' ? 'bg-cardzzz-cream/20 text-cardzzz-cream' :
                    ln.node.type === 'team' ? 'bg-cardzzz-cream/20 text-cardzzz-cream' :
                    'bg-cardzzz-cream/20 text-cardzzz-cream'
                  }`}>
                    {ln.node.type === 'organisation' && '🏢'}
                    {ln.node.type === 'department' && '🏢'}
                    {ln.node.type === 'team' && '👥'}
                    {ln.node.type === 'teamLead' && '👤'}
                    {ln.node.type === 'teamMember' && '👤'}
                    {ln.node.type === 'tool' && '🔧'}
                    {ln.node.type === 'workflow' && '⚡'}
                    {ln.node.type === 'process' && '⟳'}
                    {ln.node.type === 'agent' && '🤖'}
                    {ln.node.type === 'automation' && '⚡'}
                    {![
                      'organisation', 'department', 'team', 'teamLead', 
                      'teamMember', 'tool', 'workflow', 'process', 
                      'agent', 'automation'
                    ].includes(ln.node.type) && '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-roundo lowercase text-cardzzz-cream truncate">{ln.node.name}</p>
                    {ln.node.children.length > 0 && (
                      <p className="text-[10px] text-cardzzz-cream/75 font-satoshi">{ln.node.children.length} items</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      {(onConfirm || onCancel) && (
        <div className="flex items-center justify-end gap-2 px-3 py-2 bg-black/20 border-t border-white/20">
          {onCancel && (
            <button
              onClick={onCancel}
              className="h-[44px] px-[10px] rounded-[16.168px] border border-cardzzz-cream bg-transparent text-cardzzz-cream cursor-pointer text-xs font-roundo lowercase transition-all hover:bg-white/10"
            >
              Cancel
            </button>
          )}
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="h-[44px] px-[10px] rounded-[16.168px] border border-cardzzz-cream/50 bg-cardzzz-cream text-cardzzz-accent shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:opacity-90 text-xs font-roundo lowercase transition-all"
            >
              Confirm & Continue
            </button>
          )}
        </div>
      )}
    </div>
  );
}
