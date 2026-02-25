# Governance Parity Checklist

Status: ACTIVE
Last Updated (UTC): 2026-02-25

## Non-Negotiable Rule
Governance structure may evolve without changing runtime behavior unless explicitly approved.

## Control Plane Presence
- [x] `SYSTEM_CONTROL_CENTER/README.md`
- [x] `SYSTEM_CONTROL_CENTER/SYSTEM_MANIFEST.md`
- [x] `SYSTEM_CONTROL_CENTER/ARCHITECTURE_CURRENT.mmd`
- [x] `SYSTEM_CONTROL_CENTER/PROMPT_REGISTRY.md`
- [x] `SYSTEM_CONTROL_CENTER/CONSTRAINT_REGISTRY.md`
- [x] `SYSTEM_CONTROL_CENTER/MODEL_ROUTING.md`
- [x] `SYSTEM_CONTROL_CENTER/CHANGE_MAP.md`
- [x] `SYSTEM_CONTROL_CENTER/TRAINING_AND_MAINTENANCE.md`

## Prompt Governance
- [x] all model-facing prompts mapped to source files
- [x] client-side prompt templates included for governance
- [x] prompt change control policy defined

## Constraint Governance
- [x] schema-level constraints documented
- [x] rate limits documented
- [x] file parse limits documented
- [x] hierarchy and state constraints documented
- [x] known governance gaps called out explicitly

## Routing Governance
- [x] provider/model env keys documented
- [x] default provider and model documented
- [x] task-aware routing behavior documented

## Maintenance Governance
- [x] docs-only change protocol defined
- [x] behavior-change protocol defined
- [x] source-of-truth precedence defined

## Validation Gates
### Docs-only alignment (apply only when the change set is docs-only)
- [ ] confirm no runtime files changed
- [ ] confirm no test logic changed
- [ ] confirm only governance/documentation surfaces were edited

### Runtime remediation alignment
- [x] `pnpm run check` passes (lint, type-check, test, build)
- [x] `pnpm run test:e2e` passes
- [x] local runtime boot probe passes
