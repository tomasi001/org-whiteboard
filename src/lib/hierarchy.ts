import type { NodeType } from "@/types";

export const hierarchyRules: Record<NodeType, NodeType[]> = {
  organisation: ["department", "workflow"],
  department: ["team", "workflow"],
  team: ["teamLead", "teamMember", "tool", "workflow"],
  teamLead: ["subRole", "tool", "workflow"],
  teamMember: ["subRole", "tool", "workflow"],
  role: ["subRole", "tool", "workflow"],
  subRole: ["tool", "workflow"],
  tool: ["workflow"],
  workflow: ["process"],
  process: ["agent"],
  agent: ["automation"],
  automation: [],
};

export const nodeTypeLabels: Record<NodeType, string> = {
  organisation: "Organisation",
  department: "Department",
  team: "Team",
  teamLead: "Team Lead",
  teamMember: "Team Member",
  role: "Role",
  subRole: "Sub Role",
  tool: "Tool",
  workflow: "Workflow",
  process: "Process",
  agent: "Agent",
  automation: "Automation",
};

