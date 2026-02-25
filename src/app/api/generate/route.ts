import { NextRequest, NextResponse } from "next/server";
import { AIConfigError, extractFirstJsonObject, getGeminiClient } from "@/lib/ai";
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
1. Prioritise canonical state data if provided.
2. If fields conflict, canonical state wins.
3. Fill reasonable detail without inventing impossible specifics.
4. Use modern, practical tools/workflows.
5. Output only valid JSON (no markdown, no prose).`;

const CONVERSATION_SYSTEM_PROMPT = `You are an adaptive organisational design copilot.

You maintain a canonical state object across turns and update it using the latest user input.
The user may provide data as:
- free-text conversation
- pasted structured JSON
- extracted text from uploaded documents

Your behavior must be adaptive, not scripted:
1. Extract explicit and implicit organisational details (semantic inference, not exact keyword matching).
2. Merge new details into canonical state without losing prior confirmed info.
3. If user confirms a suggestion (examples: "yes", "sounds good", "use those departments"), treat suggested items as accepted and add them.
4. Ask only for truly missing information. Never re-ask already provided details.
5. If the user already provided enough information, do not continue step-by-step questioning. Instead suggest 1-3 high-value improvements.

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
- previewData: include when state can be represented as an org structure; else null.
- missingFields: list only blocking missing fields.
- suggestions: optional quality improvements.
- readyToGenerate: true only when enough data is present to produce a useful org structure.

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

    const {
      prompt,
      mode: rawMode,
      state: rawState,
      conversationHistory,
      source,
    } = parsedRequest.data;
    const mode = rawMode === "conversation" ? "conversation" : "generate";

    const ai = getGeminiClient();
    const canonicalState = normaliseState(rawState);

    const contents =
      mode === "conversation"
        ? `${CONVERSATION_SYSTEM_PROMPT}

Current canonical state JSON:
${JSON.stringify(canonicalState)}

Recent conversation history (latest last):
${JSON.stringify((conversationHistory ?? []).slice(-12))}

Latest user input source: ${source ?? "message"}
Latest user input:
${clipText(prompt)}`
        : `${GENERATE_SYSTEM_PROMPT}

User request:
${clipText(prompt)}

Canonical state to preserve:
${JSON.stringify(canonicalState)}

If canonical state contains validated data, keep it in the final output.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
    });

    const content = response.text;
    if (!content) {
      return NextResponse.json(
        { error: "AI provider returned an empty response." },
        { status: 502 }
      );
    }

    const jsonString = extractFirstJsonObject(content);
    if (!jsonString) {
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
          { error: "AI response format was invalid for conversation mode." },
          { status: 502 }
        );
      }

      const modelState = normaliseState(parsedConversation.data.state);
      const mergedState = mergeIntakeStates(canonicalState, modelState);
      const modelPreview = parsedConversation.data.previewData ?? null;
      const mergedPreview = mergeTemplates(intakeStateToTemplate(mergedState), modelPreview);

      const finalState = mergeIntakeStates(
        mergedState,
        mergedPreview ? templateToIntakeState(mergedPreview) : {}
      );

      const missingFields =
        parsedConversation.data.missingFields.length > 0
          ? parsedConversation.data.missingFields
          : getMissingFields(finalState);

      const readyToGenerate =
        parsedConversation.data.readyToGenerate ?? isReadyToGenerate(finalState);

      return NextResponse.json({
        guidance: parsedConversation.data.guidance,
        state: finalState,
        previewData: mergedPreview,
        missingFields,
        suggestions: parsedConversation.data.suggestions ?? [],
        readyToGenerate,
      });
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
    if (error instanceof AIConfigError) {
      return NextResponse.json(
        {
          error:
            "AI provider is not configured. Set GEMINI_API_KEY (or GOOGLE_AI_API_KEY) on the server.",
        },
        { status: 503 }
      );
    }

    console.error("Generate API error:", error);
    return NextResponse.json({ error: "Failed to generate organisation." }, { status: 500 });
  }
}
