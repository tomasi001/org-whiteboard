import { NextRequest, NextResponse } from "next/server";
import {
  AIConfigError,
  extractFirstJsonObject,
  getGeminiClient,
} from "@/lib/ai";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  chatActionSchema,
  chatRequestSchema,
  type ChatAction,
} from "@/lib/schemas";
import type { NodeType } from "@/types";

interface WhiteboardSnapshotNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  children: WhiteboardSnapshotNode[];
}

interface FlatNode {
  id: string;
  type: NodeType;
  name: string;
}

const CHAT_SYSTEM_PROMPT = `You are an assistant that edits an organisational whiteboard.

Return JSON only in this exact shape:
{
  "action": "add" | "remove" | "update" | "none",
  "targetId": "node-id-when-known",
  "targetName": "node-name-when-id-not-known",
  "reply": "short confirmation or clarification",
  "data": {
    "type": "department|team|teamLead|teamMember|role|subRole|tool|workflow|process|agent|automation",
    "name": "name when adding/updating",
    "description": "optional description",
    "workflowType": "agentic|linear"
  }
}

Rules:
- Prefer action="none" when user intent is unclear.
- Use targetId when available from provided node list.
- Do not invent random IDs.
- Keep reply concise and practical.`;

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

function flattenNodes(node: WhiteboardSnapshotNode): FlatNode[] {
  const nodes: FlatNode[] = [{ id: node.id, type: node.type, name: node.name }];
  for (const child of node.children) {
    nodes.push(...flattenNodes(child));
  }
  return nodes;
}

function findNodeById(
  node: WhiteboardSnapshotNode,
  id: string
): WhiteboardSnapshotNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function findNodeByName(
  node: WhiteboardSnapshotNode,
  name: string
): WhiteboardSnapshotNode | null {
  if (node.name.toLowerCase() === name.toLowerCase()) return node;
  for (const child of node.children) {
    const found = findNodeByName(child, name);
    if (found) return found;
  }
  return null;
}

function extractQuotedValue(message: string): string | null {
  const quoted = message.match(/["']([^"']+)["']/);
  return quoted?.[1]?.trim() || null;
}

function extractAddName(message: string, noun: string): string | null {
  const quoted = extractQuotedValue(message);
  if (quoted) return quoted;

  const regex = new RegExp(
    `\\b${noun}\\b\\s*(?:called|named)?\\s*([A-Za-z0-9\\s\\-_/&]+)`,
    "i"
  );
  const match = message.match(regex)?.[1]?.trim();
  return match && match.length > 0 ? match : null;
}

function inferNodeFromMessage(
  root: WhiteboardSnapshotNode,
  message: string,
  type: NodeType
): WhiteboardSnapshotNode | null {
  const lowerMessage = message.toLowerCase();
  const allNodes = flattenNodes(root);
  const candidates = allNodes.filter((node) => node.type === type);
  const matching = candidates.find((node) =>
    lowerMessage.includes(node.name.toLowerCase())
  );

  if (!matching) return null;
  return findNodeById(root, matching.id);
}

function localAction(
  message: string,
  root: WhiteboardSnapshotNode,
  selectedNodeId?: string
): ChatAction | null {
  const lower = message.toLowerCase();
  const selected = selectedNodeId ? findNodeById(root, selectedNodeId) : null;

  if (lower.includes("help")) {
    return {
      action: "none",
      reply:
        "Try commands like: add a Marketing department, add a Frontend team, add tool Figma, add member John, or remove \"Node Name\".",
    };
  }

  if (lower.includes("add") && lower.includes("department")) {
    const name = extractAddName(message, "department");
    if (!name) {
      return {
        action: "none",
        reply: "Tell me the department name to add.",
      };
    }
    return {
      action: "add",
      targetId: root.id,
      reply: `Adding department "${name}".`,
      data: { type: "department", name },
    };
  }

  if (lower.includes("add") && lower.includes("team")) {
    const name = extractAddName(message, "team");
    const targetDepartment =
      selected?.type === "department"
        ? selected
        : inferNodeFromMessage(root, message, "department");

    if (!targetDepartment) {
      return {
        action: "none",
        reply:
          "Select a department (or mention one by name) so I know where to add the team.",
      };
    }

    if (!name) {
      return {
        action: "none",
        reply: "Tell me the team name to add.",
      };
    }

    return {
      action: "add",
      targetId: targetDepartment.id,
      reply: `Adding team "${name}" to ${targetDepartment.name}.`,
      data: { type: "team", name },
    };
  }

  if (
    lower.includes("add") &&
    (lower.includes("member") || lower.includes("person"))
  ) {
    const name = extractAddName(message, "member") ?? extractAddName(message, "person");
    const targetTeam =
      selected?.type === "team" ? selected : inferNodeFromMessage(root, message, "team");

    if (!targetTeam) {
      return {
        action: "none",
        reply: "Select a team (or mention one) to add a member.",
      };
    }

    if (!name) {
      return {
        action: "none",
        reply: "Tell me the member name to add.",
      };
    }

    return {
      action: "add",
      targetId: targetTeam.id,
      reply: `Adding member "${name}" to ${targetTeam.name}.`,
      data: { type: "teamMember", name },
    };
  }

  if (lower.includes("add") && lower.includes("tool")) {
    const name = extractAddName(message, "tool");
    const target =
      selected && ["team", "teamLead", "teamMember", "role", "subRole"].includes(selected.type)
        ? selected
        : inferNodeFromMessage(root, message, "team");

    if (!target) {
      return {
        action: "none",
        reply: "Select a team or role node to add a tool.",
      };
    }

    if (!name) {
      return {
        action: "none",
        reply: "Tell me the tool name to add.",
      };
    }

    return {
      action: "add",
      targetId: target.id,
      reply: `Adding tool "${name}" to ${target.name}.`,
      data: { type: "tool", name },
    };
  }

  if (lower.includes("remove") || lower.includes("delete")) {
    const quoted = extractQuotedValue(message);
    const targetName =
      quoted ?? message.match(/\b(?:remove|delete)\s+(.+)$/i)?.[1]?.trim() ?? null;

    if (!targetName) {
      return {
        action: "none",
        reply: 'Tell me which node to remove, for example: remove "Marketing".',
      };
    }

    const targetNode = findNodeByName(root, targetName);
    if (!targetNode) {
      return {
        action: "none",
        reply: `I could not find "${targetName}" in the current whiteboard.`,
      };
    }

    return {
      action: "remove",
      targetId: targetNode.id,
      reply: `Removing "${targetNode.name}".`,
    };
  }

  const renameMatch = message.match(/\brename\s+(.+?)\s+to\s+(.+)$/i);
  if (renameMatch) {
    const targetName = renameMatch[1].trim().replace(/^["']|["']$/g, "");
    const nextName = renameMatch[2].trim().replace(/^["']|["']$/g, "");
    const targetNode = findNodeByName(root, targetName);

    if (!targetNode) {
      return {
        action: "none",
        reply: `I could not find "${targetName}" to rename.`,
      };
    }

    return {
      action: "update",
      targetId: targetNode.id,
      reply: `Renaming "${targetNode.name}" to "${nextName}".`,
      data: { name: nextName },
    };
  }

  return null;
}

async function aiAction(
  message: string,
  root: WhiteboardSnapshotNode,
  selectedNodeId?: string
): Promise<ChatAction | null> {
  try {
    const ai = getGeminiClient();
    const nodes = flattenNodes(root).slice(0, 300);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${CHAT_SYSTEM_PROMPT}

Selected node id: ${selectedNodeId ?? "none"}
Available nodes (id, type, name):
${JSON.stringify(nodes)}

User request:
${message}

Return JSON only.`,
    });

    const text = response.text;
    if (!text) return null;

    const jsonString = extractFirstJsonObject(text);
    if (!jsonString) return null;

    const parsedJson: unknown = JSON.parse(jsonString);
    const parsed = chatActionSchema.safeParse(parsedJson);
    if (!parsed.success) return null;

    return parsed.data;
  } catch (error) {
    if (error instanceof AIConfigError) return null;
    console.error("Chat AI parse error:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`chat:${getClientIp(request)}`, 50, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { reply: "Too many requests. Please wait a moment and retry.", action: null },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsedRequest = chatRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      return NextResponse.json({ reply: "Invalid chat request.", action: null }, { status: 400 });
    }

    const { message, currentWhiteboard, selectedNodeId } = parsedRequest.data;

    if (!currentWhiteboard) {
      return NextResponse.json({
        reply: "Create a whiteboard first, then I can apply structure changes.",
        action: null,
      });
    }

    const local = localAction(message, currentWhiteboard.rootNode, selectedNodeId);
    if (local) {
      return NextResponse.json({ reply: local.reply, action: local });
    }

    const modelAction = await aiAction(message, currentWhiteboard.rootNode, selectedNodeId);
    if (modelAction) {
      return NextResponse.json({ reply: modelAction.reply, action: modelAction });
    }

    return NextResponse.json({
      reply:
        'I could not infer a safe change. Try a direct command like "add a Marketing department" or "remove \\"Sales\\"".',
      action: null,
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json(
      { reply: "Failed to process chat request.", action: null },
      { status: 500 }
    );
  }
}

