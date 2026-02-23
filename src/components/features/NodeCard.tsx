"use client";

import { 
  Building2, 
  Users, 
  User, 
  GitBranch, 
  Cpu, 
  Bot, 
  Zap,
  ChevronRight,
  UserCircle,
  Workflow
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
  role: <User className="w-5 h-5" />,
  workflow: <Workflow className="w-5 h-5" />,
  process: <GitBranch className="w-5 h-5" />,
  agent: <Bot className="w-5 h-5" />,
  automation: <Zap className="w-5 h-5" />,
};

const nodeColors: Record<NodeType, string> = {
  organisation: "bg-blue-50 border-blue-200 hover:bg-blue-100",
  department: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100",
  team: "bg-purple-50 border-purple-200 hover:bg-purple-100",
  role: "bg-pink-50 border-pink-200 hover:bg-pink-100",
  workflow: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
  process: "bg-orange-50 border-orange-200 hover:bg-orange-100",
  agent: "bg-cyan-50 border-cyan-200 hover:bg-cyan-100",
  automation: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
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
      title={`Type: ${nodeTypeLabel}${node.departmentHead ? ` | Head: ${node.departmentHead}` : ''}${node.workflowType ? ` | Workflow: ${node.workflowType}` : ''}`}
      className={cn(
        "relative flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 min-w-[240px]",
        nodeColors[node.type],
        isSelected && "ring-2 ring-slate-400 ring-offset-2",
        node.workflowType && workflowColors[node.workflowType]
      )}
    >
      <div className={cn(
        "flex-shrink-0 p-2 rounded-lg",
        node.type === "organisation" && "bg-blue-100 text-blue-600",
        node.type === "department" && "bg-indigo-100 text-indigo-600",
        node.type === "team" && "bg-purple-100 text-purple-600",
        node.type === "role" && "bg-pink-100 text-pink-600",
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
