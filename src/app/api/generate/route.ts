import { NextRequest, NextResponse } from "next/server";
import { AIConfigError, extractFirstJsonObject, getGeminiClient } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  conversationResponseSchema,
  generateRequestSchema,
  orgTemplateSchema,
} from "@/lib/schemas";

const GENERATE_SYSTEM_PROMPT = `You are an expert organisational designer AI that thinks deeply about organisational structures. Your task is to generate comprehensive, realistic organisational structures based on user descriptions.

You must output valid JSON that matches this exact structure:
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

Think carefully about:
1. The type of organisation (tech, healthcare, finance, retail, manufacturing, etc.)
2. The realistic size and complexity based on the description
3. Modern tools and systems that organisation would use
4. Whether workflows should be agentic (AI-driven) or linear (sequential) based on the task
5. Realistic job titles and roles
6. Practical automations that make sense

Be comprehensive - use all available levels: departments -> teams -> team members -> tools -> workflows -> processes -> agents -> automations

Output ONLY valid JSON, no markdown formatting or explanations.`;

const CONVERSATION_SYSTEM_PROMPT = `You are an expert organisational designer helping users build their organisation step by step through conversation.

When the user provides information about their organisation, you should:
1. Acknowledge what they've shared
2. Ask follow-up questions to gather more details
3. Provide guidance on next steps

IMPORTANT: You must ALWAYS respond with valid JSON in this exact format:
{
  "guidance": "Your conversational response with guidance and next question",
  "previewData": { 
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
            "workflows": []
          }
        ],
        "workflows": []
      }
    ],
    "workflows": []
  }
}

Guidelines:
- Keep guidance concise (2-4 sentences) and conversational
- Ask one focused question at a time
- Include previewData only when there is enough detail (at least org name and one department)
- If previewData is not ready, set previewData to null

Output ONLY valid JSON, no markdown formatting or explanations.`;

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(
      `generate:${getClientIp(request)}`,
      30,
      60_000
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsedRequest = generateRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { prompt, mode: rawMode, orgData, currentStep } = parsedRequest.data;
    const mode = rawMode === "conversation" ? "conversation" : "generate";

    const ai = getGeminiClient();
    const contents =
      mode === "conversation"
        ? `${CONVERSATION_SYSTEM_PROMPT}

Current conversation context:
- Current step: ${currentStep ?? "intro"}
- Org data so far: ${JSON.stringify(orgData ?? {})}
- User message: ${prompt}

Respond with JSON containing guidance and optional previewData.`
        : `${GENERATE_SYSTEM_PROMPT}

Generate an organisational structure for: ${prompt}`;

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

      return NextResponse.json({
        guidance: parsedConversation.data.guidance,
        previewData: parsedConversation.data.previewData ?? null,
      });
    }

    const parsedTemplate = orgTemplateSchema.safeParse(parsedJson);
    if (!parsedTemplate.success) {
      return NextResponse.json(
        { error: "AI response format was invalid for generation mode." },
        { status: 502 }
      );
    }

    return NextResponse.json(parsedTemplate.data);
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
    return NextResponse.json(
      { error: "Failed to generate organisation." },
      { status: 500 }
    );
  }
}

