# Change Map (Where To Edit What)

Use this map for controlled updates. Edit the smallest possible surface.

## Prompt Surfaces
- Generate prompts:
  - `src/app/api/generate/route.ts`
    - `GENERATE_SYSTEM_PROMPT`
    - `CONVERSATION_SYSTEM_PROMPT`
- Chat prompt:
  - `src/app/api/chat/route.ts`
    - `CHAT_SYSTEM_PROMPT`
- Wizard prompt templates:
  - `src/components/features/OrgBuilderWizard.tsx`

## Contract and Validation Surfaces
- API schemas:
  - `src/lib/schemas.ts`
- intake merge and readiness rules:
  - `src/lib/orgIntake.ts`
- loose JSON mapping:
  - `src/lib/intakeJsonMapper.ts`

## Model Routing
- provider and model resolution:
  - `src/lib/ai.ts`
- runtime env keys:
  - `USE_GEMINI_PROVIDER`
  - `USE_OPENAI_PROVIDER`
  - `OPENAI_API_KEY`
  - `GEMINI_API_KEY`
  - `GOOGLE_AI_API_KEY`
  - `OPENAI_MODEL`
  - `GEMINI_MODEL`
  - `OPENAI_CHAT_MODEL`
  - `OPENAI_GENERATE_MODEL`
  - `GEMINI_CHAT_MODEL`
  - `GEMINI_GENERATE_MODEL`

## State and Tree Behavior
- client state and persistence:
  - `src/contexts/WhiteboardContext.tsx`
- hierarchy rules:
  - `src/lib/hierarchy.ts`
- mutation helpers:
  - `src/lib/whiteboardTree.ts`

## API Behavior
- generate orchestration:
  - `src/app/api/generate/route.ts`
- chat action orchestration:
  - `src/app/api/chat/route.ts`
- file parsing:
  - `src/app/api/intake/parse/route.ts`
- request throttling:
  - `src/lib/rateLimit.ts`

## Test Surfaces
- unit/integration tests:
  - `src/**/*.test.{ts,tsx}`
- e2e:
  - `tests/e2e/whiteboard.spec.ts`
  - `playwright.config.ts`

## Documentation Surfaces (Must Update With Behavior Changes)
- `SYSTEM_CONTROL_CENTER/*`
- `README.md`
- relevant `memory-bank/*` notes when they reference changed behavior
