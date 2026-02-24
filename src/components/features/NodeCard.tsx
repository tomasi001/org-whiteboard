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
  agentic: "bg-black/20 border-white/20",
  linear: "bg-white/10 border-white/20",
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
        "relative flex items-start gap-3 p-4 rounded-[16.168px] border cursor-pointer transition-all duration-300 min-w-[240px] group",
        "bg-white/10 backdrop-blur-md",
        "border-white/20",
        "shadow-[0_8px_30px_rgba(0,0,0,0.25)]",
        "hover:bg-white/15 hover:-translate-y-0.5",
        isSelected && "ring-2 ring-cardzzz-cream/50 ring-offset-2 ring-offset-transparent bg-black/20",
        node.workflowType && workflowColors[node.workflowType]
      )}
    >
      {/* Immediate hover label - shows type instantly on hover */}
      <div className="absolute -top-8 left-0 px-2 py-1 bg-black/80 text-cardzzz-cream text-xs rounded-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-0 pointer-events-none whitespace-nowrap z-10 font-satoshi">
        {nodeTypeLabel}
      </div>
      <div className={cn(
        "flex-shrink-0 p-2 rounded-[12px]",
        node.type === "organisation" && "bg-cardzzz-cream/20 text-cardzzz-cream",
        node.type === "department" && "bg-cardzzz-cream/20 text-cardzzz-cream",
        node.type === "team" && "bg-cardzzz-cream/20 text-cardzzz-cream",
        node.type === "teamLead" && "bg-cardzzz-cream/20 text-cardzzz-cream",
        node.type === "teamMember" && "bg-cardzzz-cream/20 text-cardzzz-cream",
        node.type === "role" && "bg-cardzzz-cream/20 text-cardzzz-cream",
        node.type === "subRole" && "bg-cardzzz-cream/20 text-cardzzz-cream",
        node.type === "tool" && "bg-cardzzz-cream/20 text-cardzzz-cream",
        node.type === "workflow" && "bg-cardzzz-cream/20 text-cardzzz-cream",
        node.type === "process" && "bg-cardzzz-cream/20 text-cardzzz-cream",
        node.type === "agent" && "bg-cardzzz-cream/20 text-cardzzz-cream",
        node.type === "automation" && "bg-cardzzz-cream/20 text-cardzzz-cream"
      )}>
        {nodeIcons[node.type]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-roundo lowercase font-bold text-cardzzz-cream truncate">
            {node.name}
          </h3>
          {node.workflowType && (
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full font-satoshi border border-white/20",
              node.workflowType === "agentic" && "bg-cardzzz-accent/30 text-cardzzz-cream",
              node.workflowType === "linear" && "bg-black/20 text-cardzzz-cream"
            )}>
              {node.workflowType}
            </span>
          )}
        </div>
        
        {node.description && (
          <p className="text-sm text-cardzzz-cream/85 mt-1 line-clamp-2 font-satoshi">
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
          {hasChildren && (
            <span className="flex items-center gap-1 text-xs text-cardzzz-cream/80 font-satoshi">
              <Users className="w-3 h-3" />
              {node.children.length} {node.children.length === 1 ? "item" : "items"}
            </span>
          )}
        </div>
      </div>

      {hasChildren && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <ChevronRight className="w-5 h-5 text-cardzzz-cream/60" />
        </div>
      )}
    </div>
  );
}
