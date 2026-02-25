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

function mergeMappedStates(states: OrgIntakeState[]): OrgIntakeState {
  const goals = [...new Set(states.flatMap((state) => state.goals ?? []))];
  const departments = dedupeDepartments(states.flatMap((state) => state.departments ?? []));
  const workflows = dedupeWorkflows(states.flatMap((state) => state.workflows ?? []));

  return {
    name: states.map((state) => state.name).find(Boolean),
    description: states.map((state) => state.description).find(Boolean),
    goals,
    departments,
    workflows,
  };
}

function extractRootCandidates(root: JsonRecord): JsonRecord[] {
  const candidates: JsonRecord[] = [root];
  const wrapperKeys = [
    "organisation",
    "organization",
    "org",
    "company",
    "data",
    "payload",
    "template",
    "structure",
    "whiteboard",
  ];

  for (const key of wrapperKeys) {
    const nested = getRecord(root, key);
    if (!nested) continue;
    candidates.push(nested);
  }

  return candidates;
}

function ensureDepartment(
  byName: Map<string, OrgTemplateDepartment>,
  name: string,
  description?: string
): OrgTemplateDepartment {
  const key = name.toLowerCase();
  const existing = byName.get(key);

  if (existing) {
    if (description && !existing.description) {
      existing.description = description;
    }
    return existing;
  }

  const department: OrgTemplateDepartment = {
    name,
    description,
    teams: [],
  };

  byName.set(key, department);
  return department;
}

function ensureTeam(department: OrgTemplateDepartment, teamName: string, description?: string): void {
  const teams = department.teams ?? [];
  const existing = teams.find((team) => team.name.toLowerCase() === teamName.toLowerCase());

  if (existing) {
    if (description && !existing.description) {
      existing.description = description;
    }
    return;
  }

  teams.push({ name: teamName, description });
  department.teams = teams;
}

function ensureWorkflow(
  byName: Map<string, OrgTemplateWorkflow>,
  workflowName: string,
  typeHint?: string,
  description?: string
): void {
  const key = workflowName.toLowerCase();
  const existing = byName.get(key);

  if (existing) {
    if (description && !existing.description) {
      existing.description = description;
    }
    return;
  }

  byName.set(key, {
    name: workflowName,
    type: typeHint === "linear" || typeHint === "agentic"
      ? typeHint
      : inferWorkflowType(`${workflowName} ${description ?? ""}`),
    description,
  });
}

function extractTreeState(root: JsonRecord): OrgIntakeState {
  const directRootNode = getRecord(root, "rootNode");
  const nestedWhiteboard = getRecord(root, "whiteboard");
  const nestedRootNode = nestedWhiteboard ? getRecord(nestedWhiteboard, "rootNode") : undefined;
  const treeRoot = directRootNode ?? nestedRootNode;

  if (!treeRoot) return {};

  const departments = new Map<string, OrgTemplateDepartment>();
  const workflows = new Map<string, OrgTemplateWorkflow>();

  const visit = (node: JsonRecord, currentDepartment?: OrgTemplateDepartment) => {
    const nodeName = getTextByKeys(node, ["name", "title", "label"]);
    const nodeType = (getTextByKeys(node, ["type", "nodeType", "kind"]) ?? "").toLowerCase();
    const description = getTextByKeys(node, ["description", "summary"]);

    let nextDepartment = currentDepartment;

    if (nodeName && nodeType === "department") {
      nextDepartment = ensureDepartment(departments, nodeName, description);
    } else if (nodeName && nodeType === "team" && currentDepartment) {
      ensureTeam(currentDepartment, nodeName, description);
    } else if (
      nodeName &&
      (nodeType === "workflow" ||
        nodeType === "process" ||
        nodeType === "automation" ||
        nodeType === "agentswarm")
    ) {
      ensureWorkflow(workflows, nodeName, nodeType, description);
    }

    const children = getValue(node, "children");
    if (!Array.isArray(children)) return;

    for (const child of children) {
      if (!isRecord(child)) continue;
      visit(child, nextDepartment);
    }
  };

  visit(treeRoot);

  return {
    name: extractCompanyName(root) ?? getTextByKeys(treeRoot, ["name"]),
    description: extractCompanyDescription(root) ?? getTextByKeys(treeRoot, ["description"]),
    departments: [...departments.values()],
    workflows: [...workflows.values()],
  };
}

function mapArrayInput(input: unknown[]): OrgIntakeState {
  const fromStrings = input
    .filter((item): item is string => typeof item === "string")
    .map((item) => normaliseText(item))
    .filter(Boolean)
    .map((name) => ({ name }));

  const fromRecords = input
    .filter((item): item is JsonRecord => isRecord(item))
    .map((item) => intakeStateFromLooseJson(item));

  const merged = mergeMappedStates(fromRecords);
  return {
    ...merged,
    departments: dedupeDepartments([...(merged.departments ?? []), ...fromStrings]),
  };
}

export function intakeStateFromLooseJson(input: unknown): OrgIntakeState {
  if (Array.isArray(input)) {
    return mapArrayInput(input);
  }

  if (!isRecord(input)) return {};

  const roots = extractRootCandidates(input);

  const structuralStates = roots.map((root) => ({
    name: extractCompanyName(root),
    description: extractCompanyDescription(root),
    goals: extractGoals(root),
    departments: dedupeDepartments([
      ...extractPillarDepartments(root),
      ...extractGenericDepartments(root),
      ...extractExecutiveDepartment(root),
    ]),
    workflows: extractWorkflows(root),
  }));

  const treeStates = roots.map(extractTreeState);
  const merged = mergeMappedStates([...structuralStates, ...treeStates]);

  return {
    ...merged,
    goals: [...new Set([...structuralStates.flatMap((state) => state.goals ?? []), ...(merged.goals ?? [])])],
  };
}
