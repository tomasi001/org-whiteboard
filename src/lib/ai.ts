import { GoogleGenAI } from "@google/genai";

export class AIConfigError extends Error {
  constructor(message = "AI provider is not configured") {
    super(message);
    this.name = "AIConfigError";
  }
}

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    throw new AIConfigError();
  }
  return key;
}

export function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
}

export function extractFirstJsonObject(content: string): string | null {
  let depth = 0;
  let start = -1;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0 && start >= 0) {
        return content.slice(start, i + 1);
      }
    }
  }

  return null;
}

