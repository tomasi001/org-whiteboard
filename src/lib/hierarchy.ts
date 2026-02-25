import type { LayerColorConfig, NodeType, WhiteboardKind } from "@/types";

export const defaultHierarchyRules: Record<NodeType, NodeType[]> = {
  organisation: ["department"],
  department: ["team", "agentSwarm"],
  team: ["teamLead", "teamMember", "tool", "agent"],
  agentSwarm: ["agentLead", "agentMember", "tool", "agent"],
  teamLead: ["subRole", "tool", "agent"],
  teamMember: ["subRole", "tool", "agent"],
  agentLead: ["agent", "tool", "automation"],
  agentMember: ["agent", "tool", "automation"],
  role: ["subRole", "tool", "agent"],
  subRole: ["tool", "agent"],
  tool: ["automation"],
  workflow: ["agent", "automation"],
  process: ["agent"],
  agent: ["agent", "tool", "automation"],
  automation: [],
};

export const automationHierarchyRules: Partial<Record<NodeType, NodeType[]>> = {
  automation: ["agent", "tool", "automation"],
};

export function getAllowedChildTypes(
  parentType: NodeType,
  boardKind: WhiteboardKind = "organisation"
): NodeType[] {
  if (boardKind === "automation") {
    return automationHierarchyRules[parentType] ?? defaultHierarchyRules[parentType] ?? [];
  }

  return defaultHierarchyRules[parentType] ?? [];
}

export const hierarchyRules = defaultHierarchyRules;

export const nodeTypeLabels: Record<NodeType, string> = {
  organisation: "Organisation",
  department: "Department",
  team: "Team",
  agentSwarm: "Agent Swarm",
  teamLead: "Team Lead",
  teamMember: "Team Member",
  agentLead: "Agent Lead",
  agentMember: "Agent Member",
  role: "Role",
  subRole: "Sub Role",
  tool: "Tool",
  workflow: "Legacy Workflow",
  process: "Legacy Process",
  agent: "Agent",
  automation: "Automation",
};

export const defaultNodeLayerColors: Record<NodeType, string> = {
  organisation: "#f4d35e",
  department: "#3da5d9",
  team: "#5dd39e",
  agentSwarm: "#7b6d8d",
  teamLead: "#84dcc6",
  teamMember: "#95a3b3",
  agentLead: "#4f7cac",
  agentMember: "#6ea8a1",
  role: "#95a3b3",
  subRole: "#a9b8c6",
  tool: "#d8b4a0",
  workflow: "#8a9a5b",
  process: "#6b7280",
  agent: "#f2c14e",
  automation: "#ef8354",
};

export function getNodeLayerColor(
  nodeType: NodeType,
  layerColors?: LayerColorConfig
): string {
  return layerColors?.[nodeType] ?? defaultNodeLayerColors[nodeType];
}
