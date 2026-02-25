"use client";

import type { ReactNode } from "react";
import {
  Bot,
  Building2,
  ChevronRight,
  UserCircle,
  UserCog,
  Users,
  UsersRound,
  WandSparkles,
  Wrench,
  Zap,
} from "lucide-react";
import type { NodeType, WhiteboardNode, WorkflowType } from "@/types";
import { cn } from "@/lib/utils";
import { nodeTypeLabels } from "@/lib/hierarchy";

interface NodeCardProps {
  node: WhiteboardNode;
  isSelected?: boolean;
  layerColor?: string;
}

const nodeIcons: Record<NodeType, ReactNode> = {
  organisation: <Building2 className="w-5 h-5" />,
  department: <Building2 className="w-5 h-5" />,
  team: <Users className="w-5 h-5" />,
  agentSwarm: <WandSparkles className="w-5 h-5" />,
  teamLead: <UserCog className="w-5 h-5" />,
  teamMember: <UsersRound className="w-5 h-5" />,
  agentLead: <UserCog className="w-5 h-5" />,
  agentMember: <UsersRound className="w-5 h-5" />,
  role: <UserCog className="w-5 h-5" />,
  subRole: <UserCircle className="w-5 h-5" />,
  tool: <Wrench className="w-5 h-5" />,
  workflow: <WandSparkles className="w-5 h-5" />,
  process: <Users className="w-5 h-5" />,
  agent: <Bot className="w-5 h-5" />,
  automation: <Zap className="w-5 h-5" />,
};

const workflowColors: Record<WorkflowType, string> = {
  agentic: "bg-black/20 border-white/20",
  linear: "bg-white/10 border-white/20",
};

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (value.length !== 6) {
    return `rgba(255,250,220,${alpha})`;
  }

  const intValue = Number.parseInt(value, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function NodeCard({ node, isSelected = false, layerColor = "#fffadc" }: NodeCardProps) {
  const hasChildren = node.children.length > 0;
  const nodeTypeLabel = nodeTypeLabels[node.type] ?? node.type;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 p-4 rounded-[16.168px] border cursor-pointer transition-all duration-300 min-w-[240px] group",
        "backdrop-blur-md",
        "shadow-[0_8px_30px_rgba(0,0,0,0.25)]",
        "hover:-translate-y-0.5",
        isSelected && "ring-2 ring-cardzzz-cream/50 ring-offset-2 ring-offset-transparent",
        node.workflowType && workflowColors[node.workflowType]
      )}
      style={{
        borderColor: hexToRgba(layerColor, 0.52),
        backgroundColor: isSelected ? hexToRgba(layerColor, 0.16) : "rgb(255 255 255 / 0.1)",
      }}
    >
      <div className="absolute -top-8 left-0 px-2 py-1 bg-black/80 text-cardzzz-cream text-xs rounded-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-0 pointer-events-none whitespace-nowrap z-10 font-satoshi">
        {nodeTypeLabel}
      </div>

      <div
        className="flex-shrink-0 p-2 rounded-[12px]"
        style={{
          backgroundColor: hexToRgba(layerColor, 0.24),
          color: layerColor,
        }}
      >
        {nodeIcons[node.type]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-roundo lowercase font-bold text-cardzzz-cream truncate">
            {node.name}
          </h3>
          {node.workflowType && (
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full font-satoshi border border-white/20",
                node.workflowType === "agentic" && "bg-cardzzz-accent/30 text-cardzzz-cream",
                node.workflowType === "linear" && "bg-black/20 text-cardzzz-cream"
              )}
            >
              {node.workflowType}
            </span>
          )}
        </div>

        {node.description && (
          <p className="text-sm text-cardzzz-cream/90 mt-1 line-clamp-2 font-satoshi">
            {node.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2">
          {node.departmentHead && (
            <span className="flex items-center gap-1 text-xs text-cardzzz-cream/80 font-satoshi">
              <UserCircle className="w-3 h-3" />
              {node.departmentHead}
            </span>
          )}
          {(hasChildren || Boolean(node.automationBoardId)) && (
            <span className="flex items-center gap-1 text-xs text-cardzzz-cream/80 font-satoshi">
              <Users className="w-3 h-3" />
              {hasChildren ? `${node.children.length} ${node.children.length === 1 ? "item" : "items"}` : "has flow"}
            </span>
          )}
        </div>
      </div>

      {(hasChildren || node.type === "automation") && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <ChevronRight className="w-5 h-5 text-cardzzz-cream/60" />
        </div>
      )}
    </div>
  );
}
