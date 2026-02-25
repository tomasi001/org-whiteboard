# Model Routing

This file documents model/provider routing used at runtime.

## Environment Keys
- Provider toggles:
  - `USE_GEMINI_PROVIDER`
  - `USE_OPENAI_PROVIDER`
- Provider keys:
  - `OPENAI_API_KEY`
  - `GEMINI_API_KEY`
  - `GOOGLE_AI_API_KEY`
- Provider defaults:
  - `OPENAI_MODEL`
  - `GEMINI_MODEL`
- Task-specific overrides:
  - `OPENAI_CHAT_MODEL`
  - `OPENAI_GENERATE_MODEL`
  - `GEMINI_CHAT_MODEL`
  - `GEMINI_GENERATE_MODEL`

## Runtime Defaults in Code
Source: `src/lib/ai.ts`
- Default provider resolution: OpenAI (unless explicit flag selects Gemini)
- Default models:
  - OpenAI: `gpt-5`
  - Gemini: `gemini-2.5-flash`

## Task Routing
`generateText` takes `task: "chat" | "generate"` and resolves model by:
1. explicit model input
2. provider + task-specific env key
3. provider default env key
4. hardcoded provider default

## API Usage
- `POST /api/generate`:
  - task = `chat` when `mode="conversation"`
  - task = `generate` when `mode="generate"` or unspecified
- `POST /api/chat`:
  - task = `chat`

## Reliability Notes
- provider key checks run before invocation
- OpenAI call retries by relaxing unsupported options
- JSON extraction is guarded by `extractFirstJsonObject` + schema parsing in API routes

## Governance Rule
Any routing change requires updates to:
- this file
- `SYSTEM_MANIFEST.md`
- `CONSTRAINT_REGISTRY.md` (if reliability behavior changes)
