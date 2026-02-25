# Training and Maintenance Guide

## 1) Operator Training Path

### Stage A: Understand Flow Ownership
1. Read `SYSTEM_CONTROL_CENTER/README.md`.
2. Review `SYSTEM_CONTROL_CENTER/SYSTEM_MANIFEST.md`.
3. Review `SYSTEM_CONTROL_CENTER/ARCHITECTURE_CURRENT.mmd`.

### Stage B: Understand Prompt Surfaces
1. Review `SYSTEM_CONTROL_CENTER/PROMPT_REGISTRY.md`.
2. Map prompt locations in `SYSTEM_CONTROL_CENTER/CHANGE_MAP.md`.
3. Make one low-risk prompt text edit in a branch and validate behavior.

### Stage C: Understand Constraints
1. Review `SYSTEM_CONTROL_CENTER/CONSTRAINT_REGISTRY.md`.
2. Classify constraints as:
   - safety-critical
   - quality-critical
   - performance-critical
3. Verify where each constraint is enforced in code.

### Stage D: Understand Model Routing
1. Review `SYSTEM_CONTROL_CENTER/MODEL_ROUTING.md`.
2. Confirm env keys are documented for current deployment.
3. Run a provider toggle smoke test in a safe environment.

## 2) Daily Operations Checklist
1. Load project environment.
2. Run quality checks:
   - `pnpm run lint`
   - `pnpm run type-check`
   - `pnpm run test`
   - `pnpm run build`
3. If e2e is required:
   - `pnpm run test:e2e`
4. Confirm no uncontrolled doc drift:
   - update `SYSTEM_CONTROL_CENTER/*` when behavior changed.

## 3) Docs-Only Governance Change Protocol
Use this path for maintenance-structure changes with no runtime edits.

1. Modify only documentation files.
2. Confirm no `src/**`, `tests/**`, or config runtime files changed.
3. Run:
   - `git status --short`
4. Record what governance surfaces were updated.

## 4) Behavior Change Protocol
Use this path when runtime behavior changes are intentional.

1. Change minimal runtime surface from `CHANGE_MAP.md`.
2. Update matching governance docs in the same change:
   - `PROMPT_REGISTRY.md`
   - `CONSTRAINT_REGISTRY.md`
   - `MODEL_ROUTING.md` (if applicable)
   - `SYSTEM_MANIFEST.md`
3. Run validation commands and record outcomes.

## 5) Prompt Change Control
- One prompt surface change at a time.
- Validate before/after behavior with at least one focused scenario.
- If output shape changes, update `src/lib/schemas.ts` and docs together.

## 6) Source-of-Truth Hygiene
- Runtime truth: `src/**`
- Governance mirror: `SYSTEM_CONTROL_CENTER/**`
- Working context (non-canonical): `memory-bank/**`
