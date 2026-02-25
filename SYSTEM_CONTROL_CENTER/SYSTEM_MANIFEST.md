# System Manifest
Generated (UTC): 2026-02-25

This manifest is the canonical technical audit of the active Org Whiteboard runtime.

## Active Application Flows

### Flow 1: Board Lifecycle (Client State)
- Entry: `CreateWhiteboardDialog` or previously saved board selection.
- State engine: reducer in `src/contexts/WhiteboardContext.tsx`.
- Core operations:
  - create/open/delete/reset whiteboards
  - create/update/move/delete nodes
  - breadcrumb drill-down/drill-up
  - layout mode (`auto` vs `freeform`)
  - zoom/pan and node positions
  - dashboard card list is organisation-only (automation child boards are hidden)

### Flow 2: Guided Setup (Wizard Conversation)
- UI: `src/components/features/OrgBuilderWizard.tsx`
- API:
  - conversational shaping: `POST /api/generate` with `mode="conversation"`
  - final generation: `POST /api/generate` with `mode="generate"`
  - document parsing: `POST /api/intake/parse`
- Merge behavior:
  - state is normalized and merged server-side
  - fallback heuristics run if model output is missing/invalid
  - readiness supports mini-org starts (users can generate from lightweight seed data)

### Flow 3: Quick Generate
- UI: `src/components/features/GenerateOrgDialog.tsx`
- API: `POST /api/generate` (default generation mode)
- Output: Org template mapped to whiteboard tree and loaded into context.

### Flow 4: Chat-Driven Edits
- UI: `src/components/features/ChatWidget.tsx`
- API: `POST /api/chat`
- Routing behavior:
  - local deterministic action parser first
  - AI-assisted action extraction second
  - safe no-op reply when intent is ambiguous

## Runtime Contracts

### State Contract (Client)
- Whiteboard state, selected node, zoom/pan, breadcrumbs, and board collection are managed by `WhiteboardContext`.
- Local persistence key: `org-whiteboard-state`.

### API Contract (Server)
- Request and response contracts are validated with Zod in `src/lib/schemas.ts`.
- JSON extraction and schema parse gates are enforced before model outputs are applied.

### Hierarchy Contract
- Node relationships are intentionally unrestricted by type in `src/lib/hierarchy.ts`.
- Tree mutations and parenting rules are enforced by `src/lib/whiteboardTree.ts`.

## Constraints and Guardrails
- Request limits:
  - `POST /api/generate`: 30 requests per minute per client IP (in-process memory store)
  - `POST /api/chat`: 50 requests per minute per client IP (in-process memory store)
- Intake parse limits:
  - max file size: 10 MB
  - max extracted text: 50,000 characters
- UI constraints:
  - zoom clamped between 0.1 and 3

## Model and Provider Routing
- Centralized in `src/lib/ai.ts`.
- Default provider: OpenAI.
- Optional provider switch: Gemini via environment flag.
- Task-aware model keys are supported for `chat` and `generate`.

## Observability Status
- Present:
  - server error logging via `console.error`
  - Playwright trace on first retry for e2e tests
- Not yet present:
  - explicit runtime handover markers
  - centralized request/flow tracing IDs
  - parity-grade audit logs for prompt and constraint changes

## Governance Note
This manifest governs maintenance and audit structure only. It does not alter product behavior.
