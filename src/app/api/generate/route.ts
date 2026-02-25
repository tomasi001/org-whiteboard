import { NextRequest, NextResponse } from "next/server";
import { AIConfigError, extractFirstJsonObject, generateText } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  conversationResponseSchema,
  generateRequestSchema,
  orgTemplateSchema,
} from "@/lib/schemas";
import {
  emptyIntakeState,
  getMissingFields,
  intakeStateToTemplate,
  isReadyToGenerate,
  mergeIntakeStates,
  mergeTemplates,
  templateToIntakeState,
} from "@/lib/orgIntake";
import type { OrgIntakeState } from "@/lib/orgIntake";
import type { OrgTemplateDepartment, OrgTemplateWorkflow } from "@/types/orgTemplate";
import { intakeStateFromLooseJson } from "@/lib/intakeJsonMapper";
import { normalizeJsonInput } from "@/lib/jsonNormalization";

const GENERATE_SYSTEM_PROMPT = `You are an expert organisational designer AI.

Your task is to produce a complete and realistic organisation template as valid JSON.

Output schema:
{
  "name": "Organisation Name",
  "description": "Brief description",
  "departments": [
    {
      "name": "Department Name",
      "description": "What this department does",
      "head": "Name of department head (optional)",
      "teams": [
        {
          "name": "Team Name",
          "description": "Team purpose",
          "teamLead": "Team lead name (optional)",
          "teamMembers": ["Member 1", "Member 2"],
          "tools": ["Tool 1", "Tool 2"],
          "workflows": [
            {
              "name": "Workflow Name",
              "type": "agentic or linear",
              "description": "What this workflow does",
              "processes": [
                {
                  "name": "Process Name",
                  "description": "Process description",
                  "agents": [
                    {
                      "name": "Agent Name",
                      "description": "What this agent does",
                      "automations": ["Automation 1", "Automation 2"]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ],
      "workflows": []
    }
  ],
  "workflows": []
}

Rules:
1. Prioritise existing intake data if provided.
2. If fields conflict, existing intake data wins.
3. Fill reasonable detail without inventing impossible specifics.
4. Use modern, practical tools/workflows.
5. Output only valid JSON (no markdown, no prose).`;

const CONVERSATION_SYSTEM_PROMPT = `You are an adaptive organisational design copilot.

You maintain internal structured memory across turns and update it using the latest user input.
The user may provide data as:
- free-text conversation
- pasted structured JSON
- extracted text from uploaded documents

Your behavior must be adaptive, not scripted:
1. Extract explicit and implicit organisational details (semantic inference, not exact keyword matching).
2. Merge new details with prior confirmed info.
3. If user confirms a suggestion (examples: "yes", "sounds good", "use those departments"), treat suggested items as accepted and add them.
4. Ask only for truly missing information. Never re-ask already provided details.
5. If the user already provided enough information, stop step-by-step questioning and suggest 1-3 high-value improvements.

CRITICAL UX RULES:
- Never mention internal mechanics.
- Never use phrases like "state", "schema", "canonical", "JSON format", "missing fields".
- Speak like a practical, friendly strategist.

Return JSON only in this exact shape:
{
  "guidance": "short conversational response",
  "state": {
    "name": "",
    "description": "",
    "industry": "",
    "goals": [],
    "constraints": [],
    "departments": [],
    "workflows": []
  },
  "previewData": {
    "name": "",
    "description": "",
    "departments": [],
    "workflows": []
  },
  "missingFields": ["..."],
  "suggestions": ["..."],
  "readyToGenerate": true
}

Rules for output fields:
- guidance: concise, direct, and contextual. 2-5 sentences.
- state: always present and updated.
- previewData: include when it can be represented as an org structure; else null.
- missingFields: list only blocking missing fields.
- suggestions: optional quality improvements.
- readyToGenerate: true only when enough data is present.

Output only valid JSON.`;

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

function clipText(value: string, maxLength = 40_000): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n[TRUNCATED]` : value;
}

function normaliseState(state: OrgIntakeState | undefined): OrgIntakeState {
  return mergeIntakeStates(emptyIntakeState, state ?? {});
}

function normaliseLabel(value: string): string {
  return value.trim().replace(/^[-*\d.)\s]+/, "").replace(/[\s.]+$/, "");
}

function splitList(raw: string): string[] {
  const normalised = raw
    .replace(/\s+and\s+/gi, ",")
    .replace(/\s*&\s*/g, ",")
    .replace(/\s*\/\s*/g, ",")
    .replace(/[;|]/g, ",");

  return [...new Set(
    normalised
      .split(",")
      .map((item) => normaliseLabel(item.replace(/\b(teams?|departments?)\b/gi, "")))
      .filter(Boolean)
  )];
}

function inferOrgName(text: string): string | undefined {
  const patterns = [
    /\b(?:company|business|organisation|organization)\s+called\s+([^\n.,;:]+)/i,
    /\bi\s+run\s+(?:a\s+)?(?:company\s+)?called\s+([^\n.,;:]+)/i,
    /\bwe\s+are\s+([^\n.,;:]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = normaliseLabel(match?.[1] ?? "");
    if (candidate) return candidate;
  }

  return undefined;
}

function inferDescription(text: string): string | undefined {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentences.length === 0) return undefined;

  const summary = sentences.slice(0, 2).join(" ");
  return summary.length > 420 ? `${summary.slice(0, 417)}...` : summary;
}

function matchDepartmentName(label: string, existingNames: string[]): string {
  const raw = normaliseLabel(label);
  const key = raw.toLowerCase();

  const aliasMap: Record<string, string> = {
    ops: "operations",
    operation: "operations",
    revops: "revenue operations",
  };

  const alias = aliasMap[key] ?? key;

  const direct = existingNames.find((name) => name.toLowerCase() === alias);
  if (direct) return direct;

  const fuzzy = existingNames.find((name) => {
    const value = name.toLowerCase();
    return value.startsWith(alias) || alias.startsWith(value);
  });

  return fuzzy ?? raw;
}

function inferDepartmentsAndTeams(text: string): OrgTemplateDepartment[] {
  const departmentNames: string[] = [];

  for (const match of text.matchAll(/departments?\s*(?:are|include|includes|:)?\s*([^\n.]+)/gi)) {
    departmentNames.push(...splitList(match[1]));
  }

  if (departmentNames.length === 0) {
    const keywordDepartments: Array<{ pattern: RegExp; name: string }> = [
      { pattern: /\boperations?\b|\bops\b/i, name: "Operations" },
      { pattern: /\bmarketing\b/i, name: "Marketing" },
      { pattern: /\bsales\b|\brevenue\b/i, name: "Sales" },
      { pattern: /\bfinance\b|\bfinops\b/i, name: "Finance" },
      { pattern: /\bengineering\b|\bdevelopment\b/i, name: "Engineering" },
      { pattern: /\bproduct\b/i, name: "Product" },
      { pattern: /\bcustomer service\b|\bcustomer success\b|\bsupport\b/i, name: "Customer Success" },
      { pattern: /\bhuman resources\b|\bhr\b|\bpeople ops\b/i, name: "People" },
    ];

    const matched = keywordDepartments
      .filter((entry) => entry.pattern.test(text))
      .map((entry) => entry.name);

    if (matched.length >= 2) {
      departmentNames.push(...matched);
    }
  }

  const teamByDepartment = new Map<string, string[]>();

  const teamPatterns = [
    /([A-Za-z][A-Za-z&/\- ]{1,40})\s+team\s*(?:includes?|has|:)?\s*([^\n.]+)/gi,
    /([A-Za-z][A-Za-z&/\- ]{1,40})\s+teams?\s*(?:include|includes|are|:)?\s*([^\n.]+)/gi,
    /([A-Za-z][A-Za-z&/\- ]{1,40})\s+(?:has|have)\s+([^\n.]+?)\s+teams?/gi,
  ];

  for (const pattern of teamPatterns) {
    for (const match of text.matchAll(pattern)) {
      const dept = matchDepartmentName(match[1], departmentNames);
      const teams = splitList(match[2]);
      if (teams.length === 0) continue;

      const current = teamByDepartment.get(dept) ?? [];
      teamByDepartment.set(dept, [...new Set([...current, ...teams])]);

      if (!departmentNames.some((name) => name.toLowerCase() === dept.toLowerCase())) {
        departmentNames.push(dept);
      }
    }
  }

  return [...new Set(departmentNames)]
    .map((name) => {
      const teams = (teamByDepartment.get(name) ?? []).map((teamName) => ({
        name: teamName,
      }));

      return {
        name,
        teams,
      };
    })
    .filter((department) => department.name.length > 0);
}

function parseWorkflowItem(item: string): OrgTemplateWorkflow | null {
  const cleaned = normaliseLabel(item);
  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();
  const type = lower.includes("agentic") ? "agentic" : "linear";
  const name = normaliseLabel(
    cleaned
      .replace(/\((?:agentic|linear)\)/gi, "")
      .replace(/\b(agentic|linear)\b/gi, "")
  );

  if (!name) return null;

  return {
    name,
    type,
  };
}

function inferWorkflows(text: string): OrgTemplateWorkflow[] {
  const items: string[] = [];

  for (const match of text.matchAll(/workflows?\s*(?:are|include|includes|:)?\s*([^\n.]+)/gi)) {
    items.push(...splitList(match[1]));
  }

  if (items.length === 0 && /\bagentic workflows?\b/i.test(text)) {
    items.push("Core business automation (agentic)");
  }

  return items
    .map(parseWorkflowItem)
    .filter((workflow): workflow is OrgTemplateWorkflow => workflow !== null);
}

function inferGoals(text: string): string[] {
  const goals: string[] = [];

  for (const match of text.matchAll(/(?:goal|goals|aim|objective|focus(?:ed)? on)\s*(?:is|are|to|:)?\s*([^\n.]+)/gi)) {
    goals.push(...splitList(match[1]));
  }

  if (/increase efficiency/i.test(text)) {
    goals.push("Increase operational efficiency");
  }
  if (/more leads|lead generation/i.test(text)) {
    goals.push("Increase qualified lead flow");
  }

  return [...new Set(goals.filter(Boolean))];
}

function inferStateFromText(text: string): OrgIntakeState {
  return {
    name: inferOrgName(text),
    description: inferDescription(text),
    goals: inferGoals(text),
    departments: inferDepartmentsAndTeams(text),
    workflows: inferWorkflows(text),
  };
}

function inferStateFromJsonPayload(payload: string): OrgIntakeState {
  try {
    const normalized = normalizeJsonInput(payload);
    return intakeStateFromLooseJson(normalized.value);
  } catch {
    return {};
  }
}

function friendlyMissingFields(missingFields: string[]): string[] {
  const map: Record<string, string> = {
    "at least one organisation seed detail": "at least one organisation seed detail",
    "organisation name": "company name",
    "organisation description": "what your company does",
    "at least one department or agent layer": "at least one department or agent layer",
    "at least one team under a department": "at least one team",
    "key owners or team members": "key owners or team members",
    "at least one agent or automation flow": "at least one agent or automation flow",
  };

  return [...new Set(missingFields.map((item) => map[item] ?? item))];
}

function buildSuggestions(state: OrgIntakeState): string[] {
  const suggestions: string[] = [];
  const template = intakeStateToTemplate(state);

  if (!template) {
    return suggestions;
  }

  const departments = template.departments ?? [];
  const teams = departments.flatMap((department) => department.teams ?? []);
  const hasTools = teams.some((team) => (team.tools?.length ?? 0) > 0);
  const hasWorkflow =
    (template.workflows?.length ?? 0) > 0 ||
    departments.some((department) => (department.workflows?.length ?? 0) > 0) ||
    teams.some((team) => (team.workflows?.length ?? 0) > 0);

  if (!hasTools) {
    suggestions.push("Add key tools per team so execution gaps are visible");
  }

  if (!hasWorkflow) {
    suggestions.push("Define 1-2 critical agent flows to anchor automation design");
  }

  if (teams.length > 0 && !teams.some((team) => (team.teamMembers?.length ?? 0) > 0 || team.teamLead)) {
    suggestions.push("Assign clear owners per team to reduce handoff ambiguity");
  }

  return suggestions.slice(0, 3);
}

function buildGuidance(state: OrgIntakeState, missingFields: string[]): string {
  const template = intakeStateToTemplate(state);
  const company = state.name || "your company";

  if (!template) {
    return "Let’s kick this off with your company name and a short description of what you do.";
  }

  const departments = template.departments ?? [];
  const teams = departments.flatMap((department) => department.teams ?? []);
  const summaryParts: string[] = [];

  if (departments.length > 0) {
    summaryParts.push(`${departments.length} department${departments.length === 1 ? "" : "s"}`);
  }

  if (teams.length > 0) {
    summaryParts.push(`${teams.length} team${teams.length === 1 ? "" : "s"}`);
  }

  if (missingFields.length === 0) {
    const summary = summaryParts.length > 0 ? summaryParts.join(" and ") : "a full structure";
    return `Perfect. I’ve mapped ${company} with ${summary}. Want me to generate the org chart now, or tune any part first?`;
  }

  const nextAsk = missingFields[0];
  const summary =
    summaryParts.length > 0 ? `I’ve pulled in ${summaryParts.join(" and ")} for ${company}. ` : "";

  return `${summary}Next, share ${nextAsk} and I’ll keep shaping the structure.`;
}

function buildFallbackConversationPayload(
  canonicalState: OrgIntakeState,
  prompt: string,
  source: "message" | "json" | "document" | undefined,
  jsonPayload?: string
) {
  const inferredState =
    source === "json"
      ? inferStateFromJsonPayload(jsonPayload ?? prompt)
      : inferStateFromText(prompt);

  const mergedState = mergeIntakeStates(canonicalState, inferredState);
  const preview = intakeStateToTemplate(mergedState);
  const missingFields = friendlyMissingFields(getMissingFields(mergedState));
  const readyToGenerate = isReadyToGenerate(mergedState);
  const suggestions = buildSuggestions(mergedState);
  const guidance = buildGuidance(mergedState, missingFields);

  return {
    guidance,
    state: mergedState,
    previewData: preview,
    missingFields,
    suggestions,
    readyToGenerate,
  };
}

function finaliseConversationPayload(
  canonicalState: OrgIntakeState,
  modelPayload: {
    guidance: string;
    state: OrgIntakeState;
    previewData: unknown;
    missingFields: string[];
    suggestions?: string[];
    readyToGenerate?: boolean;
  }
) {
  const modelState = normaliseState(modelPayload.state);
  const mergedState = mergeIntakeStates(canonicalState, modelState);

  const validatedPreview = orgTemplateSchema.safeParse(modelPayload.previewData);
  const previewFromModel = validatedPreview.success ? validatedPreview.data : null;
  const mergedPreview = mergeTemplates(intakeStateToTemplate(mergedState), previewFromModel);

  const finalState = mergeIntakeStates(
    mergedState,
    mergedPreview ? templateToIntakeState(mergedPreview) : {}
  );

  const inferredMissing = friendlyMissingFields(getMissingFields(finalState));
  const computedMissing = inferredMissing;
  const readyToGenerate = computedMissing.length === 0;

  return {
    guidance: modelPayload.guidance,
    state: finalState,
    previewData: mergedPreview,
    missingFields: computedMissing,
    suggestions: (modelPayload.suggestions ?? []).slice(0, 3),
    readyToGenerate,
  };
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`generate:${getClientIp(request)}`, 30, 60_000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsedRequest = generateRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { prompt, mode: rawMode, state: rawState, conversationHistory, source, structuredJson } =
      parsedRequest.data;
    const mode = rawMode === "conversation" ? "conversation" : "generate";
    const baseState = normaliseState(rawState);
    const inferredJsonState =
      source === "json" ? inferStateFromJsonPayload(structuredJson ?? prompt) : {};
    const canonicalState = mergeIntakeStates(baseState, inferredJsonState);

    if (mode === "conversation" && source === "json") {
      const preview = intakeStateToTemplate(canonicalState);
      const missingFields = friendlyMissingFields(getMissingFields(canonicalState));

      return NextResponse.json({
        guidance: buildGuidance(canonicalState, missingFields),
        state: canonicalState,
        previewData: preview,
        missingFields,
        suggestions: buildSuggestions(canonicalState),
        readyToGenerate: isReadyToGenerate(canonicalState),
      });
    }

    let content: string | null = null;

    try {
      const userPrompt =
        mode === "conversation"
          ? `Current internal memory JSON:
${JSON.stringify(canonicalState)}

Recent conversation history (latest last):
${JSON.stringify((conversationHistory ?? []).slice(-12))}

Latest user input source: ${source ?? "message"}
Latest user input:
${clipText(prompt)}`
          : `User request:
${clipText(prompt)}

Existing intake data to preserve:
${JSON.stringify(canonicalState)}

If intake data contains validated details, keep them in the final output.`;

      const response = await generateText({
        task: mode === "conversation" ? "chat" : "generate",
        systemPrompt:
          mode === "conversation" ? CONVERSATION_SYSTEM_PROMPT : GENERATE_SYSTEM_PROMPT,
        userPrompt,
        expectJson: true,
        temperature: 0.2,
        maxOutputTokens: 8192,
      });

      content = response.text || null;
    } catch (error) {
      if (mode === "conversation") {
        return NextResponse.json(
          buildFallbackConversationPayload(canonicalState, prompt, source, structuredJson)
        );
      }

      if (error instanceof AIConfigError) {
        return NextResponse.json(
          {
            error:
              "AI provider is not configured. Configure OPENAI_API_KEY or GEMINI_API_KEY.",
          },
          { status: 503 }
        );
      }

      throw error;
    }

    if (!content) {
      if (mode === "conversation") {
        return NextResponse.json(
          buildFallbackConversationPayload(canonicalState, prompt, source, structuredJson)
        );
      }

      return NextResponse.json(
        { error: "AI provider returned an empty response." },
        { status: 502 }
      );
    }

    const jsonString = extractFirstJsonObject(content);

    if (!jsonString) {
      if (mode === "conversation") {
        return NextResponse.json(
          buildFallbackConversationPayload(canonicalState, prompt, source, structuredJson)
        );
      }

      return NextResponse.json(
        { error: "AI response did not contain valid JSON." },
        { status: 502 }
      );
    }

    const parsedJson: unknown = JSON.parse(jsonString);

    if (mode === "conversation") {
      const parsedConversation = conversationResponseSchema.safeParse(parsedJson);

      if (!parsedConversation.success) {
        return NextResponse.json(
          buildFallbackConversationPayload(canonicalState, prompt, source, structuredJson)
        );
      }

      return NextResponse.json(
        finaliseConversationPayload(canonicalState, {
          guidance: parsedConversation.data.guidance,
          state: parsedConversation.data.state,
          previewData: parsedConversation.data.previewData,
          missingFields: parsedConversation.data.missingFields,
          suggestions: parsedConversation.data.suggestions,
          readyToGenerate: parsedConversation.data.readyToGenerate,
        })
      );
    }

    const parsedTemplate = orgTemplateSchema.safeParse(parsedJson);
    if (!parsedTemplate.success) {
      return NextResponse.json(
        { error: "AI response format was invalid for generation mode." },
        { status: 502 }
      );
    }

    const canonicalTemplate = intakeStateToTemplate(canonicalState);
    const mergedTemplate = mergeTemplates(canonicalTemplate, parsedTemplate.data);

    if (!mergedTemplate) {
      return NextResponse.json(
        { error: "Generated template was empty after merge." },
        { status: 502 }
      );
    }

    return NextResponse.json(mergedTemplate);
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json({ error: "Failed to generate organisation." }, { status: 500 });
  }
}
