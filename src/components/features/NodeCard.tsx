"use client";

import { 
  Building2, 
  Users, 
  User, 
  GitBranch, 
  Bot, 
  Zap,
  ChevronRight,
  UserCircle,
  Workflow,
  UserCog,
  UsersRound,
  Wrench
} from "lucide-react";
import type { WhiteboardNode, NodeType, WorkflowType } from "@/types";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { cn } from "@/lib/utils";

interface NodeCardProps {
  node: WhiteboardNode;
  onSelect?: (node: WhiteboardNode) => void;
}

const nodeIcons: Record<NodeType, React.ReactNode> = {
  organisation: <Building2 className="w-5 h-5" />,
  department: <Building2 className="w-5 h-5" />,
  team: <Users className="w-5 h-5" />,
  teamLead: <UserCog className="w-5 h-5" />,
  teamMember: <UsersRound className="w-5 h-5" />,
  role: <User className="w-5 h-5" />,
  subRole: <UserCircle className="w-5 h-5" />,
  tool: <Wrench className="w-5 h-5" />,
  workflow: <Workflow className="w-5 h-5" />,
  process: <GitBranch className="w-5 h-5" />,
  agent: <Bot className="w-5 h-5" />,
  automation: <Zap className="w-5 h-5" />,
};

const workflowColors: Record<WorkflowType, string> = {
  agentic: "bg-violet-100 border-violet-300",
  linear: "bg-slate-100 border-slate-300",
};

export function NodeCard({ node }: NodeCardProps) {
  const { selectNode, drillDown, selectedNode } = useWhiteboard();
  const isSelected = selectedNode?.id === node.id;
  const hasChildren = node.children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      drillDown(node);
    }
  };

  // Format node type for display
  const nodeTypeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1);

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "relative flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all duration-300 min-w-[240px] group",
        "bg-white/70 backdrop-blur-xl",
        "border-white/50",
        "shadow-lg shadow-slate-200/50",
        "hover:bg-white/80 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-0.5",
        isSelected && "ring-2 ring-slate-400/50 ring-offset-2 ring-offset-transparent bg-white/90",
        node.workflowType && workflowColors[node.workflowType]
      )}
      style={{
        boxShadow: '0 4px 24px -1px rgba(0, 0, 0, 0.06), 0 2px 8px -1px rgba(0, 0, 0, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 0.6)',
      }}
    >
      {/* Immediate hover label - shows type instantly on hover */}
      <div className="absolute -top-8 left-0 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-0 pointer-events-none whitespace-nowrap z-10">
        {nodeTypeLabel}
      </div>
      <div className={cn(
        "flex-shrink-0 p-2 rounded-lg",
        node.type === "organisation" && "bg-blue-100 text-blue-600",
        node.type === "department" && "bg-indigo-100 text-indigo-600",
        node.type === "team" && "bg-purple-100 text-purple-600",
        node.type === "teamLead" && "bg-violet-100 text-violet-600",
        node.type === "teamMember" && "bg-fuchsia-100 text-fuchsia-600",
        node.type === "role" && "bg-pink-100 text-pink-600",
        node.type === "subRole" && "bg-rose-100 text-rose-600",
        node.type === "tool" && "bg-amber-100 text-amber-600",
        node.type === "workflow" && "bg-emerald-100 text-emerald-600",
        node.type === "process" && "bg-orange-100 text-orange-600",
        node.type === "agent" && "bg-cyan-100 text-cyan-600",
        node.type === "automation" && "bg-yellow-100 text-yellow-600"
      )}>
        {nodeIcons[node.type]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900 truncate">{node.name}</h3>
          {node.workflowType && (
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              node.workflowType === "agentic" && "bg-violet-200 text-violet-700",
              node.workflowType === "linear" && "bg-slate-200 text-slate-700"
            )}>
              {node.workflowType}
            </span>
          )}
        </div>
        
        {node.description && (
          <p className="text-sm text-slate-600 mt-1 line-clamp-2">{node.description}</p>
        )}

        <div className="flex items-center gap-2 mt-2">
          {node.departmentHead && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <UserCircle className="w-3 h-3" />
              {node.departmentHead}
            </span>
          )}
          {hasChildren && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Users className="w-3 h-3" />
              {node.children.length} {node.children.length === 1 ? "item" : "items"}
            </span>
          )}
        </div>
      </div>

      {hasChildren && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </div>
      )}
    </div>
  );
}
