# Prompt Registry (Runtime Verbatim Map)

This file captures active model-facing prompts and templates that influence runtime behavior.

Source-of-truth rule:
- Runtime prompt truth is always in code.
- This registry must be updated in the same change when prompt text changes.

## 1) Generate Route Prompts
Source:
- `src/app/api/generate/route.ts`

### `GENERATE_SYSTEM_PROMPT` (verbatim shape summary)
Prompt role:
- "expert organisational designer AI"
- produce complete org template JSON only

Required output object includes:
- `name`
- `description`
- `departments[]`
- `workflows[]`

Embedded rules:
1. Prioritise existing intake data if provided.
2. If fields conflict, existing intake data wins.
3. Fill reasonable detail without inventing impossible specifics.
4. Use modern, practical tools/workflows.
5. Output only valid JSON (no markdown, no prose).

### `CONVERSATION_SYSTEM_PROMPT` (verbatim shape summary)
Prompt role:
- "adaptive organisational design copilot"

Required behavior:
1. Extract explicit and implicit details.
2. Merge details with prior confirmed info.
3. Treat confirmation language as acceptance of suggestions.
4. Ask only for truly missing information.
5. Stop stepwise questioning when enough information exists.

Required output JSON shape:
- `guidance`
- `state`
- `previewData`
- `missingFields`
- `suggestions`
- `readyToGenerate`

Additional UX guardrails inside prompt text:
- do not expose internal mechanics language
- keep guidance concise and contextual

## 2) Chat Route Prompt
Source:
- `src/app/api/chat/route.ts`

### `CHAT_SYSTEM_PROMPT` (verbatim shape summary)
Prompt role:
- assistant that edits organisational whiteboards

Required output JSON shape:
- `action` (`add | remove | update | none`)
- `targetId`
- `targetName`
- `reply`
- `data` (`type`, `name`, optional details)

Embedded rules:
- prefer `none` when intent is unclear
- use known target IDs when available
- do not invent random IDs
- keep reply concise and practical

## 3) Wizard Model Prompt Templates (Client-Side)
Source:
- `src/components/features/OrgBuilderWizard.tsx`

### Conversation call payload (runtime template)
Sent via `/api/generate` with:
- `prompt` (user or composed prompt)
- `mode: "conversation"`
- `state`
- `source`
- `conversationHistory`

### JSON import template
Template intent:
- map pasted structured JSON into org shape
- continue with only unanswered essentials

Template lead text:
- "Use this structured JSON as baseline context and map it into the best org structure you can..."

### Document upload template
Template intent:
- ingest extracted document text and update current org draft

Template lead text:
- "Ingest this company document and update the current org draft."

### Final generation template
Template intent:
- generate a full organisation structure from accumulated intake state

Template lead text:
- "Generate a complete organisation structure from this intake data."

## 4) Prompt Governance Rules
- Prompt updates require:
  - matching update in this file
  - schema contract review in `src/lib/schemas.ts` (if output shape changes)
  - a focused validation run
- No hidden prompt behavior outside listed files.
