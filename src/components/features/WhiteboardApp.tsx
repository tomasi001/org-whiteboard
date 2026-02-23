"use client";

import { useState } from "react";
import { PanelRight, PanelRightClose } from "lucide-react";
import { WhiteboardProvider, useWhiteboard } from "@/contexts/WhiteboardContext";
import { Breadcrumbs } from "./Breadcrumbs";
import { Canvas } from "./Canvas";
import { NodePanel } from "./NodePanel";
import { CreateWhiteboardDialog } from "./CreateWhiteboardDialog";
import { Button } from "@/components/ui/Button";

function WhiteboardContent() {
  const { currentWhiteboard } = useWhiteboard();
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  if (!currentWhiteboard) {
    return <CreateWhiteboardDialog />;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 shrink-0">
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

      {/* Breadcrumbs */}
      <Breadcrumbs />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Canvas />
        {!isPanelCollapsed && <NodePanel />}
      </div>
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
