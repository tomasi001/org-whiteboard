"use client";

import { ChevronRight, Home } from "lucide-react";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { cn } from "@/lib/utils";

export function Breadcrumbs() {
  const { breadcrumbs, navigateToBreadcrumb, drillUp } = useWhiteboard();

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200">
      <button
        onClick={drillUp}
        disabled={breadcrumbs.length <= 1}
        className={cn(
          "p-1 rounded hover:bg-slate-100 transition-colors",
          breadcrumbs.length <= 1 && "opacity-50 cursor-not-allowed"
        )}
        title="Go back"
      >
        <Home className="w-4 h-4" />
      </button>
      
      <ChevronRight className="w-4 h-4 text-slate-400" />
      
      {breadcrumbs.map((node, index) => (
        <div key={node.id} className="flex items-center">
          <button
            onClick={() => navigateToBreadcrumb(index)}
            className={cn(
              "px-2 py-1 text-sm rounded hover:bg-slate-100 transition-colors",
              index === breadcrumbs.length - 1 && "font-medium text-slate-900",
              index < breadcrumbs.length - 1 && "text-slate-500"
            )}
          >
            {node.name}
          </button>
          {index < breadcrumbs.length - 1 && (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      ))}
    </div>
  );
}
