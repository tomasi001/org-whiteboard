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
    <div className="flex items-center gap-1 px-4 py-2 bg-black/20 backdrop-blur-md border-b border-white/20">
      <button
        onClick={drillUp}
        disabled={breadcrumbs.length <= 1}
        className={cn(
          "p-1 rounded-[12px] text-cardzzz-cream hover:bg-white/10 transition-colors",
          breadcrumbs.length <= 1 && "opacity-50 cursor-not-allowed"
        )}
        title="Go back"
      >
        <Home className="w-4 h-4" />
      </button>
      
      <ChevronRight className="w-4 h-4 text-cardzzz-cream/50" />
      
      {breadcrumbs.map((node, index) => (
        <div key={node.id} className="flex items-center">
          <button
            onClick={() => navigateToBreadcrumb(index)}
            className={cn(
              "px-2 py-1 text-sm rounded-[12px] font-satoshi hover:bg-white/10 transition-colors",
              index === breadcrumbs.length - 1 && "font-semibold text-cardzzz-cream",
              index < breadcrumbs.length - 1 && "text-cardzzz-cream/80"
            )}
          >
            {node.name}
          </button>
          {index < breadcrumbs.length - 1 && (
            <ChevronRight className="w-4 h-4 text-cardzzz-cream/50" />
          )}
        </div>
      ))}
    </div>
  );
}
