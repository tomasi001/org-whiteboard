import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { z } from "zod";

export class AIConfigError extends Error {
  constructor(message = "AI provider is not configured") {
    super(message);
    this.name = "AIConfigError";
  }
}

const envSchema = z.object({
  USE_GEMINI_PROVIDER: z
    .string()
    .optional()
    .transform((value) => (value ?? "false").toLowerCase() === "true"),
  USE_OPENAI_PROVIDER: z
    .string()
    .optional()
    .transform((value) => (value ?? "").toLowerCase() === "true"),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  OPENAI_CHAT_MODEL: z.string().optional(),
  OPENAI_GENERATE_MODEL: z.string().optional(),
  GEMINI_CHAT_MODEL: z.string().optional(),
  GEMINI_GENERATE_MODEL: z.string().optional(),
});

type RuntimeEnv = z.infer<typeof envSchema>;
export type AIProviderName = "openai" | "gemini";

type ModelTask = "chat" | "generate";

const DEFAULT_MODELS: Record<AIProviderName, string> = {
  openai: "gpt-5",
  gemini: "gemini-2.5-flash",
};

let cachedEnv: RuntimeEnv | null = null;
let cachedOpenAiClient: OpenAI | null = null;
let cachedGeminiClient: GoogleGenAI | null = null;

function getEnv(): RuntimeEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}

function normalizeModelName(model?: string): string {
  return (model ?? "").trim().toLowerCase();
}

function inferModelFamily(model?: string): AIProviderName | "unknown" {
  const normalized = normalizeModelName(model);

  if (!normalized) return "unknown";
  if (normalized.includes("gemini")) return "gemini";

  if (
    normalized.includes("gpt") ||
    normalized.includes("openai") ||
    normalized.startsWith("o1") ||
    normalized.startsWith("o3") ||
    normalized.startsWith("o4") ||
    normalized.startsWith("chatgpt")
  ) {
    return "openai";
  }

  return "unknown";
}

export function resolveProvider(): AIProviderName {
  const env = getEnv();

  if (env.USE_GEMINI_PROVIDER) {
    return "gemini";
  }

  if (env.USE_OPENAI_PROVIDER) {
    return "openai";
  }

  return "openai";
}

export function assertProviderKeys(provider: AIProviderName): void {
  const env = getEnv();

  if (provider === "openai" && !env.OPENAI_API_KEY) {
    throw new AIConfigError("OPENAI_API_KEY is required when using OpenAI provider.");
  }

  if (provider === "gemini" && !(env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY)) {
    throw new AIConfigError(
      "GEMINI_API_KEY (or GOOGLE_AI_API_KEY) is required when using Gemini provider."
    );
  }
}

function resolveModel(provider: AIProviderName, task: ModelTask, explicitModel?: string): string {
  const env = getEnv();

  const providerTaskModel =
    provider === "openai"
      ? task === "chat"
        ? env.OPENAI_CHAT_MODEL
        : env.OPENAI_GENERATE_MODEL
      : task === "chat"
        ? env.GEMINI_CHAT_MODEL
        : env.GEMINI_GENERATE_MODEL;

  const providerDefaultModel = provider === "openai" ? env.OPENAI_MODEL : env.GEMINI_MODEL;
  const candidates = [explicitModel, providerTaskModel, providerDefaultModel, DEFAULT_MODELS[provider]];

  for (const candidate of candidates) {
    const cleaned = (candidate ?? "").trim();
    if (!cleaned) continue;

    const family = inferModelFamily(cleaned);
    if (family === "unknown" || family === provider) {
      return cleaned;
    }
  }

  return DEFAULT_MODELS[provider];
}

function getGeminiApiKey(): string {
  const env = getEnv();
  const key = env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY;

  if (!key) {
    throw new AIConfigError("GEMINI_API_KEY (or GOOGLE_AI_API_KEY) is not configured.");
  }

  return key;
}

function getOpenAiApiKey(): string {
  const env = getEnv();

  if (!env.OPENAI_API_KEY) {
    throw new AIConfigError("OPENAI_API_KEY is not configured.");
  }

  return env.OPENAI_API_KEY;
}

export function getGeminiClient(): GoogleGenAI {
  if (cachedGeminiClient) {
    return cachedGeminiClient;
  }

  cachedGeminiClient = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  return cachedGeminiClient;
}

export function getOpenAiClient(): OpenAI {
  if (cachedOpenAiClient) {
    return cachedOpenAiClient;
  }

  cachedOpenAiClient = new OpenAI({ apiKey: getOpenAiApiKey() });
  return cachedOpenAiClient;
}

export interface GenerateTextInput {
  task: ModelTask;
  systemPrompt: string;
  userPrompt: string;
  expectJson?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
}

export interface GenerateTextResult {
  text: string;
  provider: AIProviderName;
  model: string;
}

async function generateWithGemini(
  model: string,
  input: GenerateTextInput
): Promise<string> {
  const gemini = getGeminiClient();

  const stitchedPrompt = ["SYSTEM:", input.systemPrompt, "", "USER:", input.userPrompt].join("\n");

  const response = await gemini.models.generateContent({
    model,
    contents: stitchedPrompt,
    config: {
      temperature: input.temperature ?? 0.2,
      maxOutputTokens: input.maxOutputTokens ?? 8192,
      ...(input.expectJson ? { responseMimeType: "application/json" } : {}),
    },
  });

  return response.text ?? "";
}

async function generateWithOpenAI(
  model: string,
  input: GenerateTextInput
): Promise<string> {
  const openai = getOpenAiClient();

  const makePayload = (opts: {
    includeTemperature: boolean;
    includeJsonResponse: boolean;
  }): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming => {
    const payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
      ...(input.maxOutputTokens ? { max_completion_tokens: input.maxOutputTokens } : {}),
    };

    if (opts.includeTemperature) {
      payload.temperature = input.temperature ?? 0.2;
    }

    if (opts.includeJsonResponse) {
      payload.response_format = { type: "json_object" };
    }

    return payload;
  };

  const isUnsupportedTemperatureError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("Unsupported value: 'temperature'");
  };

  let includeTemperature = true;
  let includeJsonResponse = Boolean(input.expectJson);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await openai.chat.completions.create(
        makePayload({ includeTemperature, includeJsonResponse })
      );

      const content = response.choices[0]?.message?.content;
      return typeof content === "string" ? content : "";
    } catch (error) {
      lastError = error;

      if (includeTemperature && isUnsupportedTemperatureError(error)) {
        includeTemperature = false;
        continue;
      }

      if (includeJsonResponse) {
        includeJsonResponse = false;
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Unknown OpenAI error"));
}

export async function generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
  const provider = resolveProvider();
  assertProviderKeys(provider);

  const model = resolveModel(provider, input.task, input.model);

  const text =
    provider === "openai"
      ? await generateWithOpenAI(model, input)
      : await generateWithGemini(model, input);

  return {
    text,
    provider,
    model,
  };
}

export function clearAiClientCaches(): void {
  cachedOpenAiClient = null;
  cachedGeminiClient = null;
  cachedEnv = null;
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
