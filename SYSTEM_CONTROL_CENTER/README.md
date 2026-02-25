# System Control Center

This folder is the operational control plane for governing and maintaining Org Whiteboard.

## What This Contains
- `SYSTEM_MANIFEST.md`: canonical runtime audit of active app flows and contracts.
- `ARCHITECTURE_CURRENT.mmd`: current architecture graph in Mermaid.
- `ARCHITECTURE_CURRENT.md`: architecture reference and ownership notes.
- `PROMPT_REGISTRY.md`: active model-facing prompts and prompt templates.
- `CONSTRAINT_REGISTRY.md`: hard limits, guardrails, and behavioral constraints.
- `MODEL_ROUTING.md`: provider and model routing map.
- `CHANGE_MAP.md`: exact edit points for controlled changes.
- `TRAINING_AND_MAINTENANCE.md`: operator workflow and maintenance protocol.
- `PARITY_CHECKLIST.md`: governance alignment checklist.

## Canonical Runtime Surfaces
- Client state orchestration: `src/contexts/WhiteboardContext.tsx`
- Server API orchestration:
  - `src/app/api/generate/route.ts`
  - `src/app/api/chat/route.ts`
  - `src/app/api/intake/parse/route.ts`
- AI provider routing: `src/lib/ai.ts`
- Contract schemas: `src/lib/schemas.ts`
- Tree and hierarchy rules:
  - `src/lib/whiteboardTree.ts`
  - `src/lib/hierarchy.ts`

## Source of Truth Policy
1. Runtime behavior source: `src/**`
2. Contract source: `src/lib/schemas.ts` and `src/types/**`
3. This folder mirrors runtime behavior for operators and maintainers.
4. `memory-bank/**` is working context and may lag; it is non-canonical.

## Update Policy
- If runtime behavior changes, update this folder in the same change.
- If only this folder changes, no runtime behavior may be altered.
