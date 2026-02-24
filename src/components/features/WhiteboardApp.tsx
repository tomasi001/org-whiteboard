"use client";

import { useState, useEffect } from "react";
import { PanelRight, PanelRightClose } from "lucide-react";
import { WhiteboardProvider, useWhiteboard } from "@/contexts/WhiteboardContext";
import { Breadcrumbs } from "./Breadcrumbs";
import { Canvas } from "./Canvas";
import { NodePanel } from "./NodePanel";
import { CreateWhiteboardDialog } from "./CreateWhiteboardDialog";
import { ChatWidget } from "./ChatWidget";
import { Button } from "@/components/ui/Button";

function WhiteboardContent() {
  const { currentWhiteboard, selectedNode } = useWhiteboard();
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Auto-expand panel when a node is selected
  useEffect(() => {
    if (selectedNode && isPanelCollapsed) {
      setIsPanelCollapsed(false);
    }
  }, [selectedNode, isPanelCollapsed]);

  if (!currentWhiteboard) {
    return <CreateWhiteboardDialog />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Canvas - fills entire background, behind everything */}
      <Canvas />

      {/* Header - fixed at top, high z-index */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-sm border-b border-slate-200 flex items-center px-4 z-50">
        <h1 className="font-semibold text-slate-800">Org Whiteboard</h1>
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-slate-600">{currentWhiteboard.name}</span>
        <div className="ml-auto">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            title={isPanelCollapsed ? "Expand panel" : "Collapse panel"}
          >
            {isPanelCollapsed ? <PanelRight className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Breadcrumbs - fixed below header */}
      <div className="fixed top-14 left-0 right-0 z-40">
        <Breadcrumbs />
      </div>

      {/* Details Panel - fixed on right, high z-index */}
      {!isPanelCollapsed && (
        <div className="fixed top-14 right-0 bottom-0 z-40">
          <NodePanel />
        </div>
      )}

      {/* AI Chat Widget - bottom right */}
      <ChatWidget />
    </div>
  );
}

export function WhiteboardApp() {
  return (
    <WhiteboardProvider>
      <WhiteboardContent />
    </WhiteboardProvider>
  );
}