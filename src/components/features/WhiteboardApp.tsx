"use client";

import { useState } from "react";
import {
  PanelRight,
  PanelRightClose,
  RotateCcw,
  Focus,
  Minimize2,
} from "lucide-react";
import { WhiteboardProvider, useWhiteboard } from "@/contexts/WhiteboardContext";
import { Breadcrumbs } from "./Breadcrumbs";
import { Canvas } from "./Canvas";
import { NodePanel } from "./NodePanel";
import { CreateWhiteboardDialog } from "./CreateWhiteboardDialog";
import { ChatWidget } from "./ChatWidget";
import { Button } from "@/components/ui/Button";

function WhiteboardContent() {
  const { currentWhiteboard, selectedNode, resetWhiteboard } = useWhiteboard();
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isCanvasOnlyMode, setIsCanvasOnlyMode] = useState(false);

  const handleReset = () => {
    if (
      confirm(
        "Are you sure you want to start over? This will clear the current whiteboard."
      )
    ) {
      resetWhiteboard();
    }
  };

  if (!currentWhiteboard) {
    return <CreateWhiteboardDialog />;
  }

  const isPanelVisible = isCanvasOnlyMode
    ? Boolean(selectedNode)
    : !isPanelCollapsed || Boolean(selectedNode);

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <Canvas
        isCanvasOnlyMode={isCanvasOnlyMode}
        onToggleCanvasOnlyMode={() => setIsCanvasOnlyMode((current) => !current)}
      />

      {!isCanvasOnlyMode && (
        <>
          <header className="fixed top-0 left-0 right-0 h-14 bg-black/20 backdrop-blur-md border-b border-white/20 flex items-center px-4 z-50">
            <h1 className="font-roundo lowercase tracking-wide text-cardzzz-cream">
              org whiteboard
            </h1>
            <span className="mx-2 text-cardzzz-cream/50">/</span>
            <span className="text-cardzzz-cream/85 font-satoshi">{currentWhiteboard.name}</span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCanvasOnlyMode(true)}
                title="Canvas-only mode"
              >
                <Focus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                title="Start over"
                className="text-cardzzz-cream hover:text-cardzzz-cream"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPanelCollapsed((current) => !current)}
                title={isPanelCollapsed ? "Expand panel" : "Collapse panel"}
              >
                {isPanelCollapsed ? (
                  <PanelRight className="w-4 h-4" />
                ) : (
                  <PanelRightClose className="w-4 h-4" />
                )}
              </Button>
            </div>
          </header>

          <div className="fixed top-14 left-0 right-0 z-40">
            <Breadcrumbs />
          </div>
        </>
      )}

      {isPanelVisible && (
        <div
          className={`fixed right-0 bottom-0 z-40 ${
            isCanvasOnlyMode ? "top-0" : "top-14"
          }`}
        >
          <NodePanel />
        </div>
      )}

      {!isCanvasOnlyMode && <ChatWidget />}

      {isCanvasOnlyMode && (
        <div className="fixed top-4 left-4 z-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCanvasOnlyMode(false)}
            title="Exit canvas-only mode"
          >
            <Minimize2 className="w-4 h-4 mr-2" />
            Exit Canvas Mode
          </Button>
        </div>
      )}
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
