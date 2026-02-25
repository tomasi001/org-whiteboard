import type { LayerColorConfig, NodeType } from "@/types";

export const allNodeTypes: NodeType[] = [
  "organisation",
  "department",
  "team",
  "agentSwarm",
  "teamLead",
  "teamMember",
  "agentLead",
  "agentMember",
  "role",
  "subRole",
  "tool",
  "workflow",
  "process",
  "agent",
  "automation",
];

export const defaultHierarchyRules: Record<NodeType, NodeType[]> = {
  organisation: allNodeTypes,
  department: allNodeTypes,
  team: allNodeTypes,
  agentSwarm: allNodeTypes,
  teamLead: allNodeTypes,
  teamMember: allNodeTypes,
  agentLead: allNodeTypes,
  agentMember: allNodeTypes,
  role: allNodeTypes,
  subRole: allNodeTypes,
  tool: allNodeTypes,
  workflow: allNodeTypes,
  process: allNodeTypes,
  agent: allNodeTypes,
  automation: allNodeTypes,
};

export const automationHierarchyRules: Partial<Record<NodeType, NodeType[]>> = {};

export function getAllowedChildTypes(parentType: NodeType): NodeType[] {
  void parentType;
  return allNodeTypes;
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
