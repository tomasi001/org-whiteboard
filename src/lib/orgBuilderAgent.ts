import { z } from "zod";
import { AIConfigError, extractFirstJsonObject, generateText } from "@/lib/ai";
import type { OrgBuilderRequest, OrgBuilderResponse } from "@/lib/schemas";
import { orgTemplateSchema } from "@/lib/schemas";
import { mergeTemplates } from "@/lib/orgIntake";
import type { OrgTemplate, OrgTemplateDepartment, OrgTemplateTeam } from "@/types/orgTemplate";

const ORG_BUILDER_AGENT_PROMPT = `You are an Org Design Agent for a guided org builder.

Your job:
1. Build or revise organisation structure drafts.
2. Keep output practical and implementation-ready.
3. For initial mode, produce departments and department heads, plus optional starter teams.
4. For revision mode, apply user feedback while preserving accepted structure.

Output JSON only with this exact shape:
{
  "guidance": "short user-facing summary",
  "updatedDraft": {
    "name": "Company Name",
    "description": "Company description",
    "departments": [
      {
        "name": "Department Name",
        "head": "Department Head",
        "description": "Optional description",
        "teams": [
          {
            "name": "Team Name",
            "teamLead": "Optional team lead",
            "teamMembers": ["Optional member"],
            "tools": [],
            "workflows": []
          }
        ]
      }
    ],
    "workflows": []
  },
  "questions": ["optional short question"]
}

Rules:
- Always return valid JSON only.
- Keep guidance concise and specific.
- If feedback asks to add departments, heads, roles, teams, agents, or automations, apply it directly.
- Never erase previously accepted sections unless user explicitly asks to remove them.
- Ensure updatedDraft has a valid company name and practical structure.`;

const modelResponseSchema = z.object({
  guidance: z.string().trim().min(1),
  updatedDraft: orgTemplateSchema,
  questions: z.array(z.string().trim().min(1)).optional(),
});

function normalizeLabel(value: string): string {
  return value
    .replace(/^[-*\d.)\s]+/, "")
    .replace(/^(?:add|include|create|new)\s+/i, "")
    .trim();
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function splitLabels(raw: string): string[] {
  return [...new Set(
    raw
      .replace(/\s+and\s+/gi, ",")
      .replace(/[;|]/g, ",")
      .split(",")
      .map((item) =>
        normalizeLabel(
          item
            .replace(/\bdepartments?\b/gi, "")
            .replace(/\bteams?\b/gi, "")
        )
      )
      .filter(Boolean)
  )];
}

function cloneTeam(team: OrgTemplateTeam): OrgTemplateTeam {
  return {
    ...team,
    teamMembers: team.teamMembers ? [...team.teamMembers] : undefined,
    tools: team.tools ? [...team.tools] : undefined,
    workflows: team.workflows ? [...team.workflows] : undefined,
  };
}

function cloneDepartment(department: OrgTemplateDepartment): OrgTemplateDepartment {
  return {
    ...department,
    teams: department.teams ? department.teams.map(cloneTeam) : undefined,
    workflows: department.workflows ? [...department.workflows] : undefined,
  };
}

function cloneTemplate(template: OrgTemplate): OrgTemplate {
  return {
    ...template,
    departments: template.departments ? template.departments.map(cloneDepartment) : [],
    workflows: template.workflows ? [...template.workflows] : [],
  };
}

function inferredDepartmentsFromDescription(description: string): string[] {
  const rules: Array<{ name: string; pattern: RegExp }> = [
    { name: "Operations", pattern: /\boperations?\b|\bops\b|\bdelivery\b|\bservice\b/i },
    { name: "Sales", pattern: /\bsales\b|\brevenue\b|\bbiz(?:\s|-)?dev\b/i },
    { name: "Marketing", pattern: /\bmarketing\b|\bgrowth\b|\bdemand gen\b/i },
    { name: "Engineering", pattern: /\bengineering\b|\bsoftware\b|\bplatform\b|\btech\b/i },
    { name: "Product", pattern: /\bproduct\b|\broadmap\b|\bpm\b/i },
    { name: "Finance", pattern: /\bfinance\b|\baccounting\b|\bfp&a\b|\bfinops\b/i },
    { name: "People", pattern: /\bhr\b|\bpeople\b|\btalent\b|\brecruit/i },
    { name: "Customer Success", pattern: /\bcustomer success\b|\bsupport\b|\bservice desk\b/i },
  ];

  const matched = rules.filter((entry) => entry.pattern.test(description)).map((entry) => entry.name);
  if (matched.length > 0) return matched;
  return ["Operations", "Sales", "Customer Success"];
}

function makeDepartment(name: string): OrgTemplateDepartment {
  const cleanName = toTitleCase(normalizeLabel(name));
  const head = `${cleanName} Head`;
  return {
    name: cleanName,
    head,
    teams: [
      {
        name: `${cleanName} Team`,
        teamLead: head,
      },
    ],
  };
}

function draftHasProceedableShape(draft: OrgTemplate): boolean {
  const hasName = draft.name.trim().length > 0;
  const hasDepartments = (draft.departments?.length ?? 0) > 0;
  const hasWorkflows = (draft.workflows?.length ?? 0) > 0;
  return hasName && (hasDepartments || hasWorkflows);
}

function buildInitialFallbackDraft(input: OrgBuilderRequest): OrgTemplate {
  const companyName = input.onboarding?.companyName?.trim() || "Organisation";
  const companyDescription = input.onboarding?.companyDescription?.trim() || "";
  const departments = inferredDepartmentsFromDescription(companyDescription).map(makeDepartment);

  return {
    name: companyName,
    description: companyDescription,
    departments,
    workflows: [],
  };
}

function findDepartment(
  departments: OrgTemplateDepartment[],
  name: string
): OrgTemplateDepartment | undefined {
  const normalized = name.trim().toLowerCase();
  return departments.find((department) => department.name.toLowerCase() === normalized);
}

function addDepartmentIfMissing(draft: OrgTemplate, name: string): void {
  const departments = draft.departments ?? [];
  draft.departments = departments;

  if (findDepartment(departments, name)) return;
  departments.push(makeDepartment(name));
}

function addTeamToDepartment(
  draft: OrgTemplate,
  departmentName: string | undefined,
  teamName: string
): void {
  const departments = draft.departments ?? [];
  if (departments.length === 0) return;

  const target =
    (departmentName ? findDepartment(departments, departmentName) : undefined) ?? departments[0];
  if (!target) return;

  const teams = target.teams ?? [];
  target.teams = teams;

  const normalizedTeam = teamName.trim().toLowerCase();
  if (teams.some((team) => team.name.toLowerCase() === normalizedTeam)) return;

  teams.push({ name: toTitleCase(normalizeLabel(teamName)) });
}

function applyHeadAssignments(draft: OrgTemplate, feedback: string): void {
  const departments = draft.departments ?? [];
  if (departments.length === 0) return;

  const patterns = [
    /(?:set|assign|add)\s+(?:the\s+)?head\s+(?:for|of)\s+([^:;,.]+?)\s*(?:to|as|:)\s*([^;,.]+)/gi,
    /([^:;,.]+?)\s+head\s*(?:is|=|:)\s*([^;,.]+)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of feedback.matchAll(pattern)) {
      const departmentName = toTitleCase(normalizeLabel(match[1] ?? ""));
      const headName = normalizeLabel(match[2] ?? "");
      if (!departmentName || !headName) continue;

      const department = findDepartment(departments, departmentName);
      if (!department) continue;
      department.head = headName;
    }
  }
}

function applyRevisionHeuristics(baseDraft: OrgTemplate, feedback: string): OrgTemplate {
  const draft = cloneTemplate(baseDraft);
  const normalizedFeedback = feedback.trim();

  const addDepartmentMatches = [
    ...normalizedFeedback.matchAll(
      /\b(?:add|include|create)\s+(?:new\s+)?departments?\s+([^.\n;]+)/gi
    ),
  ];

  for (const match of addDepartmentMatches) {
    splitLabels(match[1] ?? "").forEach((name) => addDepartmentIfMissing(draft, name));
  }

  if (/\badd\b/i.test(normalizedFeedback)) {
    for (const match of normalizedFeedback.matchAll(/\b([A-Za-z][A-Za-z&/\- ]{2,40})\s+department\b/gi)) {
      addDepartmentIfMissing(draft, match[1]);
    }
  }

  for (const match of normalizedFeedback.matchAll(
    /\badd\s+(?:a\s+)?team(?:\s+called|\s+named)?\s+([^,.;\n]+?)(?:\s+(?:to|under|in)\s+([^,.;\n]+))?(?:[,.;\n]|$)/gi
  )) {
    const teamName = normalizeLabel(match[1] ?? "");
    const departmentName = normalizeLabel(match[2] ?? "");
    if (!teamName) continue;
    addTeamToDepartment(draft, departmentName || undefined, teamName);
  }

  applyHeadAssignments(draft, normalizedFeedback);

  return draft;
}

function buildFallbackResponse(input: OrgBuilderRequest): OrgBuilderResponse {
  const baseDraft =
    input.mode === "initial"
      ? buildInitialFallbackDraft(input)
      : input.currentDraft
        ? cloneTemplate(input.currentDraft)
        : buildInitialFallbackDraft(input);

  const updatedDraft =
    input.mode === "revision" && input.feedback
      ? applyRevisionHeuristics(baseDraft, input.feedback)
      : baseDraft;

  const guidance =
    input.mode === "initial"
      ? "I drafted an initial organisation structure with department heads and starter teams. Share edits or click proceed when ready."
      : "Applied your revision request to the current structure. Review the updated draft and continue iterating or proceed.";

  return {
    guidance,
    updatedDraft,
    questions: [
      "Would you like to adjust any department heads, add more departments, or expand teams and agents before proceeding?",
    ],
    isValidForProceed: draftHasProceedableShape(updatedDraft),
  };
}

function sanitizeModelDraft(baseDraft: OrgTemplate, modelDraft: OrgTemplate): OrgTemplate {
  const merged = mergeTemplates(baseDraft, modelDraft);
  return merged ?? modelDraft;
}

function parseModelResponse(content: string): z.infer<typeof modelResponseSchema> | null {
  const json = extractFirstJsonObject(content);
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as unknown;
    const validated = modelResponseSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

export async function runOrgBuilderAgent(input: OrgBuilderRequest): Promise<OrgBuilderResponse> {
  const fallback = buildFallbackResponse(input);

  try {
    const response = await generateText({
      task: "chat",
      systemPrompt: ORG_BUILDER_AGENT_PROMPT,
      userPrompt: JSON.stringify(
        {
          mode: input.mode,
          onboarding: input.onboarding ?? null,
          currentDraft: input.currentDraft ?? null,
          feedback: input.feedback ?? null,
        },
        null,
        2
      ),
      expectJson: true,
      temperature: 0.2,
      maxOutputTokens: 8192,
    });

    const modelResult = parseModelResponse(response.text);
    if (!modelResult) return fallback;

    const updatedDraft = sanitizeModelDraft(fallback.updatedDraft, modelResult.updatedDraft);
    return {
      guidance: modelResult.guidance,
      updatedDraft,
      questions: (modelResult.questions ?? []).slice(0, 3),
      isValidForProceed: draftHasProceedableShape(updatedDraft),
    };
  } catch (error) {
    if (error instanceof AIConfigError) {
      return fallback;
    }

    return fallback;
  }
}
