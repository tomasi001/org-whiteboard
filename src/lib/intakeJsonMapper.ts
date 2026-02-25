import type { OrgIntakeState } from "@/lib/orgIntake";
import type {
  OrgTemplateDepartment,
  OrgTemplateTeam,
  OrgTemplateWorkflow,
} from "@/types/orgTemplate";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normaliseText(value: string): string {
  return value.trim().replace(/^[-*\d.)\s]+/, "").replace(/[\s.]+$/, "");
}

function toText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const next = normaliseText(value);
    return next.length > 0 ? next : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function getValue(record: JsonRecord, key: string): unknown {
  if (key in record) return record[key];

  const lowerKey = key.toLowerCase();
  const foundKey = Object.keys(record).find((entry) => entry.toLowerCase() === lowerKey);
  return foundKey ? record[foundKey] : undefined;
}

function getRecord(record: JsonRecord, key: string): JsonRecord | undefined {
  const value = getValue(record, key);
  return isRecord(value) ? value : undefined;
}

function getTextByKeys(record: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = toText(getValue(record, key));
    if (value) return value;
  }

  return undefined;
}

function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.map((item) => toText(item)).filter((item): item is string => Boolean(item)))];
}

function inferWorkflowType(text: string): "agentic" | "linear" {
  return /\bagent|ai|automation|orchestrat/i.test(text) ? "agentic" : "linear";
}

function dedupeDepartments(departments: OrgTemplateDepartment[]): OrgTemplateDepartment[] {
  const byName = new Map<string, OrgTemplateDepartment>();

  for (const department of departments) {
    const key = department.name.toLowerCase();
    const current = byName.get(key);

    if (!current) {
      byName.set(key, {
        ...department,
        teams: department.teams ? [...department.teams] : undefined,
      });
      continue;
    }

    const mergedTeams = [...(current.teams ?? []), ...(department.teams ?? [])];
    const teamByName = new Map<string, OrgTemplateTeam>();

    for (const team of mergedTeams) {
      const teamKey = team.name.toLowerCase();
      const existing = teamByName.get(teamKey);
      if (!existing) {
        teamByName.set(teamKey, { ...team });
        continue;
      }

      teamByName.set(teamKey, {
        name: existing.name,
        description: team.description ?? existing.description,
        teamLead: team.teamLead ?? existing.teamLead,
        teamMembers: [...new Set([...(existing.teamMembers ?? []), ...(team.teamMembers ?? [])])],
        tools: [...new Set([...(existing.tools ?? []), ...(team.tools ?? [])])],
        workflows: [...(existing.workflows ?? []), ...(team.workflows ?? [])],
      });
    }

    byName.set(key, {
      name: current.name,
      description: department.description ?? current.description,
      head: department.head ?? current.head,
      teams: [...teamByName.values()],
      workflows: [...(current.workflows ?? []), ...(department.workflows ?? [])],
    });
  }

  return [...byName.values()];
}

function dedupeWorkflows(workflows: OrgTemplateWorkflow[]): OrgTemplateWorkflow[] {
  const byName = new Map<string, OrgTemplateWorkflow>();

  for (const workflow of workflows) {
    const key = workflow.name.toLowerCase();
    const current = byName.get(key);

    if (!current) {
      byName.set(key, { ...workflow });
      continue;
    }

    byName.set(key, {
      name: current.name,
      type: workflow.type ?? current.type,
      description: workflow.description ?? current.description,
      processes: [...(current.processes ?? []), ...(workflow.processes ?? [])],
    });
  }

  return [...byName.values()];
}

function mapTeam(item: unknown, fallbackName: string): OrgTemplateTeam | null {
  if (typeof item === "string") {
    return { name: normaliseText(item) };
  }

  if (!isRecord(item)) return null;

  const name = getTextByKeys(item, ["name", "title", "team_name"]) ?? fallbackName;
  const teamLead = getTextByKeys(item, ["teamLead", "team_lead", "lead", "manager", "head"]);
  const members = [
    ...toTextList(getValue(item, "teamMembers")),
    ...toTextList(getValue(item, "team_members")),
    ...toTextList(getValue(item, "members")),
    ...toTextList(getValue(item, "sub_functional_roles")),
    ...toTextList(getValue(item, "roles")),
  ];

  return {
    name,
    teamLead,
    teamMembers: members.length > 0 ? [...new Set(members)] : undefined,
    description: getTextByKeys(item, ["description", "summary", "function"]),
  };
}

function mapDepartmentFromRecord(record: JsonRecord): OrgTemplateDepartment | null {
  const name = getTextByKeys(record, [
    "name",
    "title",
    "department_name",
    "pillar_name",
    "pillar",
  ]);

  if (!name) return null;

  const head = getTextByKeys(record, ["head", "head_ai_agent", "owner", "lead", "manager"]);
  const explicitTeamsRaw = getValue(record, "teams");
  const explicitTeams = Array.isArray(explicitTeamsRaw)
    ? explicitTeamsRaw
        .map((team) => mapTeam(team, `${name} Team`))
        .filter((team): team is OrgTemplateTeam => team !== null)
    : [];

  const inferredMembers = [
    ...toTextList(getValue(record, "sub_functional_roles")),
    ...toTextList(getValue(record, "roles")),
    ...toTextList(getValue(record, "team_members")),
  ];

  const fallbackTeam: OrgTemplateTeam[] =
    explicitTeams.length === 0 && (head || inferredMembers.length > 0)
      ? [
          {
            name: `${name} Team`,
            teamLead: head,
            teamMembers: inferredMembers.length > 0 ? inferredMembers : undefined,
          },
        ]
      : [];

  return {
    name,
    description: getTextByKeys(record, ["description", "function", "summary"]),
    head,
    teams: [...explicitTeams, ...fallbackTeam],
  };
}

function extractPillarDepartments(root: JsonRecord): OrgTemplateDepartment[] {
  const businessModel = getRecord(root, "business_reference_model");
  const pillars = businessModel ? getValue(businessModel, "pillars") : undefined;

  if (!Array.isArray(pillars)) return [];

  return pillars
    .map((pillar) => (isRecord(pillar) ? mapDepartmentFromRecord(pillar) : null))
    .filter((department): department is OrgTemplateDepartment => department !== null);
}

function extractGenericDepartments(root: JsonRecord): OrgTemplateDepartment[] {
  const values = [
    getValue(root, "departments"),
    getValue(root, "divisions"),
    getValue(root, "functions"),
    getValue(root, "pillars"),
  ];

  const departments: OrgTemplateDepartment[] = [];

  for (const value of values) {
    if (!Array.isArray(value)) continue;

    for (const item of value) {
      if (typeof item === "string") {
        const name = normaliseText(item);
        if (name) departments.push({ name });
        continue;
      }

      if (!isRecord(item)) continue;
      const mapped = mapDepartmentFromRecord(item);
      if (mapped) departments.push(mapped);
    }
  }

  return departments;
}

function extractExecutiveDepartment(root: JsonRecord): OrgTemplateDepartment[] {
  const layer = getRecord(root, "executive_layer");
  if (!layer) return [];

  const nodesRaw =
    getValue(layer, "human_sovereign_nodes") ?? getValue(layer, "executives") ?? getValue(layer, "nodes");

  if (!Array.isArray(nodesRaw) || nodesRaw.length === 0) return [];

  const members: string[] = [];
  let lead: string | undefined;

  for (const node of nodesRaw) {
    if (!isRecord(node)) continue;

    const title = getTextByKeys(node, ["title", "role", "name"]);
    const incumbent = getTextByKeys(node, ["incumbent", "owner", "person"]);

    if (!lead && incumbent) {
      lead = incumbent;
    }

    const label = incumbent && title ? `${incumbent} (${title})` : incumbent ?? title;
    if (label) members.push(label);
  }

  if (members.length === 0 && !lead) return [];

  return [
    {
      name: "Executive Leadership",
      description: "Leadership and strategic governance",
      teams: [
        {
          name: "Executive Office",
          teamLead: lead,
          teamMembers: [...new Set(members)],
        },
      ],
    },
  ];
}

function extractWorkflows(root: JsonRecord): OrgTemplateWorkflow[] {
  const workflows: OrgTemplateWorkflow[] = [];

  const orchestrationLayer = getRecord(root, "orchestration_layer");
  if (orchestrationLayer) {
    const workflowName = getTextByKeys(orchestrationLayer, ["title", "name", "id"]);
    const description = getTextByKeys(orchestrationLayer, ["function", "description"]);

    if (workflowName || description) {
      const name = workflowName ?? "AI Orchestration";
      workflows.push({
        name,
        type: inferWorkflowType(`${name} ${description ?? ""}`),
        description,
      });
    }
  }

  const knownContainers = [
    getValue(root, "workflows"),
    getValue(root, "workflow"),
    getValue(root, "processes"),
    getValue(root, "automations"),
    getValue(root, "pipelines"),
  ];

  for (const container of knownContainers) {
    if (!Array.isArray(container)) continue;

    for (const item of container) {
      if (typeof item === "string") {
        const name = normaliseText(item);
        if (!name) continue;
        workflows.push({ name, type: inferWorkflowType(name) });
        continue;
      }

      if (!isRecord(item)) continue;
      const name = getTextByKeys(item, ["name", "title", "workflow_name", "process_name", "id"]);
      if (!name) continue;

      const description = getTextByKeys(item, ["description", "function", "summary"]);
      const explicitType = getTextByKeys(item, ["type", "workflowType", "workflow_type"]);
      const type = explicitType === "linear" || explicitType === "agentic"
        ? explicitType
        : inferWorkflowType(`${name} ${description ?? ""}`);

      workflows.push({ name, type, description });
    }
  }

  return dedupeWorkflows(workflows);
}

function extractGoals(root: JsonRecord): string[] {
  const goals = [
    ...toTextList(getValue(root, "goals")),
    ...toTextList(getValue(root, "objectives")),
    ...toTextList(getValue(root, "core_focus")),
  ];

  const executiveLayer = getRecord(root, "executive_layer");
  const nodes = executiveLayer ? getValue(executiveLayer, "human_sovereign_nodes") : undefined;

  if (Array.isArray(nodes)) {
    for (const node of nodes) {
      if (!isRecord(node)) continue;
      goals.push(...toTextList(getValue(node, "core_focus")));
    }
  }

  return [...new Set(goals.map((goal) => normaliseText(goal)).filter(Boolean))];
}

function extractCompanyDescription(root: JsonRecord): string | undefined {
  return getTextByKeys(root, [
    "description",
    "company_description",
    "about",
    "summary",
    "mission",
    "function",
  ]);
}

function extractCompanyName(root: JsonRecord): string | undefined {
  return getTextByKeys(root, [
    "company_name",
    "companyName",
    "organisation_name",
    "organization_name",
    "org_name",
    "name",
  ]);
}

export function intakeStateFromLooseJson(input: unknown): OrgIntakeState {
  if (!isRecord(input)) return {};

  const departments = dedupeDepartments([
    ...extractPillarDepartments(input),
    ...extractGenericDepartments(input),
    ...extractExecutiveDepartment(input),
  ]);

  return {
    name: extractCompanyName(input),
    description: extractCompanyDescription(input),
    goals: extractGoals(input),
    departments,
    workflows: extractWorkflows(input),
  };
}
