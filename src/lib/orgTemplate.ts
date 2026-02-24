import type { Whiteboard, WhiteboardNode } from "@/types";
import type {
  OrgTemplate,
  OrgTemplateAgent,
  OrgTemplateDepartment,
  OrgTemplateProcess,
  OrgTemplateTeam,
  OrgTemplateWorkflow,
} from "@/types/orgTemplate";
import { generateId } from "@/lib/utils";

interface BuildNodeOptions {
  description?: string;
  children?: WhiteboardNode[];
  departmentHead?: string;
  workflowType?: "agentic" | "linear";
}

function buildNode(
  type: WhiteboardNode["type"],
  name: string,
  options: BuildNodeOptions = {}
): WhiteboardNode {
  const now = new Date();

  return {
    id: generateId(),
    type,
    name,
    description: options.description,
    children: options.children ?? [],
    position: { x: 0, y: 0 },
    departmentHead: options.departmentHead,
    workflowType: options.workflowType,
    createdAt: now,
    updatedAt: now,
  };
}

function mapAgent(agent: OrgTemplateAgent): WhiteboardNode {
  const automations = (agent.automations ?? []).map((automation) =>
    buildNode("automation", automation)
  );

  return buildNode("agent", agent.name, {
    description: agent.description,
    children: automations,
  });
}

function mapProcess(process: OrgTemplateProcess): WhiteboardNode {
  return buildNode("process", process.name, {
    description: process.description,
    children: (process.agents ?? []).map(mapAgent),
  });
}

function mapWorkflow(workflow: OrgTemplateWorkflow): WhiteboardNode {
  return buildNode("workflow", workflow.name, {
    description: workflow.description,
    workflowType: workflow.type,
    children: (workflow.processes ?? []).map(mapProcess),
  });
}

function mapTeam(team: OrgTemplateTeam): WhiteboardNode {
  const children: WhiteboardNode[] = [];

  if (team.teamLead) {
    children.push(buildNode("teamLead", team.teamLead));
  }

  children.push(
    ...(team.teamMembers ?? []).map((member) => buildNode("teamMember", member))
  );
  children.push(...(team.tools ?? []).map((tool) => buildNode("tool", tool)));
  children.push(...(team.workflows ?? []).map(mapWorkflow));

  return buildNode("team", team.name, {
    description: team.description,
    children,
  });
}

function mapDepartment(department: OrgTemplateDepartment): WhiteboardNode {
  const children: WhiteboardNode[] = [];
  children.push(...(department.teams ?? []).map(mapTeam));
  children.push(...(department.workflows ?? []).map(mapWorkflow));

  return buildNode("department", department.name, {
    description: department.description,
    departmentHead: department.head,
    children,
  });
}

export function buildRootNodeFromTemplate(template: OrgTemplate): WhiteboardNode {
  const children: WhiteboardNode[] = [];
  children.push(...(template.departments ?? []).map(mapDepartment));
  children.push(...(template.workflows ?? []).map(mapWorkflow));

  return buildNode("organisation", template.name, {
    description: template.description,
    children,
  });
}

export function buildWhiteboardFromTemplate(
  template: OrgTemplate,
  createdBy = "user"
): Whiteboard {
  const now = new Date();

  return {
    id: generateId(),
    name: template.name,
    description: template.description,
    rootNode: buildRootNodeFromTemplate(template),
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
}

