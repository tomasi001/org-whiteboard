"use client";

import { WhiteboardProvider, useWhiteboard } from "@/contexts/WhiteboardContext";
import { Breadcrumbs } from "./Breadcrumbs";
import { Canvas } from "./Canvas";
import { NodePanel } from "./NodePanel";
import { CreateWhiteboardDialog } from "./CreateWhiteboardDialog";

function WhiteboardContent() {
  const { currentWhiteboard } = useWhiteboard();

  if (!currentWhiteboard) {
    return <CreateWhiteboardDialog />;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4">
        <h1 className="font-semibold text-slate-800">Org Whiteboard</h1>
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-slate-600">{currentWhiteboard.name}</span>
      </header>

      {/* Breadcrumbs */}
      <Breadcrumbs />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Canvas />
        <NodePanel />
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
