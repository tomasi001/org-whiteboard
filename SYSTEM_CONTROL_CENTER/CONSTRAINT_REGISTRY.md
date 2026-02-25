# Constraint Registry

This file records non-prompt controls and constraints that materially shape runtime behavior.

## API Request/Response Contracts
Source:
- `src/lib/schemas.ts`

Key constraints:
- `generateRequest.prompt` max length: 50,000
- `generateRequest.conversationHistory` max items: 24
- `chatRequest.message` max length: 4,000
- `conversationHistoryMessage.content` max length: 8,000
- strict enum validation for node types, action types, workflow types

## API Rate Limits
Source:
- `src/lib/rateLimit.ts`
- callers in:
  - `src/app/api/generate/route.ts`
  - `src/app/api/chat/route.ts`

Limits:
- `generate`: 30 requests / 60,000 ms / IP key
- `chat`: 50 requests / 60,000 ms / IP key

Implementation note:
- in-memory map (process-local), not distributed.

## File Intake Limits
Source:
- `src/app/api/intake/parse/route.ts`

Hard limits:
- max upload size: 10 MB
- max extracted text returned: 50,000 chars
- supported parsing:
  - PDF (`pdf-parse`)
  - DOCX (`mammoth`)
  - text-like formats (`utf8`)

Implementation constraint:
- PDF parser is loaded lazily during request handling to avoid build-time module evaluation failures.

## UI and State Constraints
Source:
- `src/contexts/WhiteboardContext.tsx`
- `src/lib/hierarchy.ts`
- `src/lib/whiteboardTree.ts`

Key constraints:
- zoom clamp: `[0.1, 3]`
- only allowed child types can be added/reparented
- root node cannot be reparented or deleted by delete-node action path
- automation board open/return only works with valid linked IDs

## Model Routing Constraints
Source:
- `src/lib/ai.ts`

Key constraints:
- provider defaults to OpenAI unless explicit flag selects Gemini
- provider key validation enforced before model invocation
- task-aware model resolution (`chat` vs `generate`)
- OpenAI call retries by relaxing unsupported options

## Fallback Constraints
Source:
- `src/app/api/generate/route.ts`
- `src/app/api/chat/route.ts`

Behavior:
- conversation mode falls back to heuristic state inference when model output fails
- chat route attempts deterministic local action parse before AI parse

## Current Gaps vs Deep-Copy Governance Model
- no centralized runtime handover markers
- no single guardrail function enforcing all cross-flow invariants
- no trace-link propagation for request-level audits
