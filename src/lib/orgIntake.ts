import type {
  OrgTemplate,
  OrgTemplateAgent,
  OrgTemplateDepartment,
  OrgTemplateProcess,
  OrgTemplateTeam,
  OrgTemplateWorkflow,
} from "@/types/orgTemplate";

export interface OrgDataSummary {
  name: string;
  description: string;
  departments: string[];
  teams: string[];
  roles: string[];
  tools: string[];
  workflows: string[];
}

export interface OrgIntakeState {
  name?: string;
  description?: string;
  industry?: string;
  goals?: string[];
  constraints?: string[];
  departments?: OrgTemplateDepartment[];
  workflows?: OrgTemplateWorkflow[];
}

const emptySummary: OrgDataSummary = {
  name: "",
  description: "",
  departments: [],
  teams: [],
  roles: [],
  tools: [],
  workflows: [],
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function cleanString(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

function uniqueStrings(values: string[] = []): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function mergeAgents(base: OrgTemplateAgent[] = [], next: OrgTemplateAgent[] = []) {
  const byName = new Map<string, OrgTemplateAgent>();

  for (const agent of [...base, ...next]) {
    const key = normalizeName(agent.name);
    const current = byName.get(key);

    if (!current) {
      byName.set(key, {
        name: agent.name.trim(),
        description: cleanString(agent.description),
        automations: uniqueStrings(agent.automations),
      });
      continue;
    }

    byName.set(key, {
      name: current.name,
      description: cleanString(agent.description) ?? current.description,
      automations: uniqueStrings([...(current.automations ?? []), ...(agent.automations ?? [])]),
    });
  }

  return [...byName.values()];
}

function mergeProcesses(base: OrgTemplateProcess[] = [], next: OrgTemplateProcess[] = []) {
  const byName = new Map<string, OrgTemplateProcess>();

  for (const process of [...base, ...next]) {
    const key = normalizeName(process.name);
    const current = byName.get(key);

    if (!current) {
      byName.set(key, {
        name: process.name.trim(),
        description: cleanString(process.description),
        agents: mergeAgents([], process.agents),
      });
      continue;
    }

    byName.set(key, {
      name: current.name,
      description: cleanString(process.description) ?? current.description,
      agents: mergeAgents(current.agents, process.agents),
    });
  }

  return [...byName.values()];
}

function mergeWorkflows(base: OrgTemplateWorkflow[] = [], next: OrgTemplateWorkflow[] = []) {
  const byName = new Map<string, OrgTemplateWorkflow>();

  for (const workflow of [...base, ...next]) {
    const key = normalizeName(workflow.name);
    const current = byName.get(key);

    if (!current) {
      byName.set(key, {
        name: workflow.name.trim(),
        type: workflow.type,
        description: cleanString(workflow.description),
        processes: mergeProcesses([], workflow.processes),
      });
      continue;
    }

    byName.set(key, {
      name: current.name,
      type: workflow.type ?? current.type,
      description: cleanString(workflow.description) ?? current.description,
      processes: mergeProcesses(current.processes, workflow.processes),
    });
  }

  return [...byName.values()];
}

function mergeTeams(base: OrgTemplateTeam[] = [], next: OrgTemplateTeam[] = []) {
  const byName = new Map<string, OrgTemplateTeam>();

  for (const team of [...base, ...next]) {
    const key = normalizeName(team.name);
    const current = byName.get(key);

    if (!current) {
      byName.set(key, {
        name: team.name.trim(),
        description: cleanString(team.description),
        teamLead: cleanString(team.teamLead),
        teamMembers: uniqueStrings(team.teamMembers),
        tools: uniqueStrings(team.tools),
        workflows: mergeWorkflows([], team.workflows),
      });
      continue;
    }

    byName.set(key, {
      name: current.name,
      description: cleanString(team.description) ?? current.description,
      teamLead: cleanString(team.teamLead) ?? current.teamLead,
      teamMembers: uniqueStrings([...(current.teamMembers ?? []), ...(team.teamMembers ?? [])]),
      tools: uniqueStrings([...(current.tools ?? []), ...(team.tools ?? [])]),
      workflows: mergeWorkflows(current.workflows, team.workflows),
    });
  }

  return [...byName.values()];
}

function mergeDepartments(
  base: OrgTemplateDepartment[] = [],
  next: OrgTemplateDepartment[] = []
) {
  const byName = new Map<string, OrgTemplateDepartment>();

  for (const department of [...base, ...next]) {
    const key = normalizeName(department.name);
    const current = byName.get(key);

    if (!current) {
      byName.set(key, {
        name: department.name.trim(),
        description: cleanString(department.description),
        head: cleanString(department.head),
        teams: mergeTeams([], department.teams),
        workflows: mergeWorkflows([], department.workflows),
      });
      continue;
    }

    byName.set(key, {
      name: current.name,
      description: cleanString(department.description) ?? current.description,
      head: cleanString(department.head) ?? current.head,
      teams: mergeTeams(current.teams, department.teams),
      workflows: mergeWorkflows(current.workflows, department.workflows),
    });
  }

  return [...byName.values()];
}

export function mergeTemplates(
  base: OrgTemplate | null | undefined,
  next: OrgTemplate | null | undefined
): OrgTemplate | null {
  if (!base && !next) return null;

  if (!base && next) {
    return {
      ...next,
      name: next.name.trim(),
      description: cleanString(next.description),
      departments: mergeDepartments([], next.departments),
      workflows: mergeWorkflows([], next.workflows),
    };
  }

  if (base && !next) {
    return {
      ...base,
      name: base.name.trim(),
      description: cleanString(base.description),
      departments: mergeDepartments(base.departments, []),
      workflows: mergeWorkflows(base.workflows, []),
    };
  }

  const safeBase = base as OrgTemplate;
  const safeNext = next as OrgTemplate;

  return {
    name: cleanString(safeNext.name) ?? safeBase.name,
    description: cleanString(safeNext.description) ?? safeBase.description,
    departments: mergeDepartments(safeBase.departments, safeNext.departments),
    workflows: mergeWorkflows(safeBase.workflows, safeNext.workflows),
  };
}

export function intakeStateToTemplate(state: OrgIntakeState): OrgTemplate | null {
  const departments = mergeDepartments([], state.departments);
  const workflows = mergeWorkflows([], state.workflows);
  const name = cleanString(state.name);

  if (!name && departments.length === 0 && workflows.length === 0) {
    return null;
  }

  return {
    name: name ?? "Organisation",
    description: cleanString(state.description),
    departments,
    workflows,
  };
}

export function templateToIntakeState(template: OrgTemplate): OrgIntakeState {
  return {
    name: cleanString(template.name),
    description: cleanString(template.description),
    departments: mergeDepartments([], template.departments),
    workflows: mergeWorkflows([], template.workflows),
  };
}

export function mergeIntakeStates(base: OrgIntakeState, next: OrgIntakeState): OrgIntakeState {
  return {
    name: cleanString(next.name) ?? cleanString(base.name),
    description: cleanString(next.description) ?? cleanString(base.description),
    industry: cleanString(next.industry) ?? cleanString(base.industry),
    goals: uniqueStrings([...(base.goals ?? []), ...(next.goals ?? [])]),
    constraints: uniqueStrings([...(base.constraints ?? []), ...(next.constraints ?? [])]),
    departments: mergeDepartments(base.departments, next.departments),
    workflows: mergeWorkflows(base.workflows, next.workflows),
  };
}

export function summarizeTemplate(template: OrgTemplate | null | undefined): OrgDataSummary {
  if (!template) return emptySummary;

  const departments = template.departments ?? [];
  const teams = departments.flatMap((department) => department.teams ?? []);
  const workflows = [
    ...(template.workflows ?? []),
    ...departments.flatMap((department) => department.workflows ?? []),
    ...teams.flatMap((team) => team.workflows ?? []),
  ];

  return {
    name: template.name,
    description: template.description ?? "",
    departments: uniqueStrings(departments.map((department) => department.name)),
    teams: uniqueStrings(teams.map((team) => team.name)),
    roles: uniqueStrings(
      teams.flatMap((team) => [
        ...(team.teamLead ? [team.teamLead] : []),
        ...(team.teamMembers ?? []),
      ])
    ),
    tools: uniqueStrings(teams.flatMap((team) => team.tools ?? [])),
    workflows: uniqueStrings(workflows.map((workflow) => workflow.name)),
  };
}

export function getMissingFields(state: OrgIntakeState): string[] {
  const template = intakeStateToTemplate(state);

  if (!template) {
    return [
      "organisation name",
      "organisation description",
      "at least one department or agent layer",
    ];
  }

  const departments = template.departments ?? [];
  const teams = departments.flatMap((department) => department.teams ?? []);
  const hasTopLevelWorkflow = (template.workflows ?? []).length > 0;
  const hasWorkflow =
    hasTopLevelWorkflow ||
    departments.some((department) => (department.workflows ?? []).length > 0) ||
    teams.some((team) => (team.workflows ?? []).length > 0);
  const hasRoles = teams.some(
    (team) => Boolean(team.teamLead) || (team.teamMembers?.length ?? 0) > 0
  );

  const missing: string[] = [];

  if (!cleanString(template.name)) {
    missing.push("organisation name");
  }

  if (!cleanString(template.description)) {
    missing.push("organisation description");
  }

  if (departments.length === 0 && !hasTopLevelWorkflow) {
    missing.push("at least one department or agent layer");
  }

  if (departments.length > 0 && teams.length === 0) {
    missing.push("at least one team under a department");
  }

  if (!hasRoles) {
    missing.push("key owners or team members");
  }

  if (!hasWorkflow) {
    missing.push("at least one agent or automation flow");
  }

  return missing;
}

export function isReadyToGenerate(state: OrgIntakeState): boolean {
  return getMissingFields(state).length === 0;
}

export const emptyIntakeState: OrgIntakeState = {
  name: "",
  description: "",
  industry: "",
  goals: [],
  constraints: [],
  departments: [],
  workflows: [],
};
