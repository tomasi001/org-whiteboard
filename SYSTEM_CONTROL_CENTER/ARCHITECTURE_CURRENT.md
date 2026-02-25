# Architecture Current

Source file:
- `SYSTEM_CONTROL_CENTER/ARCHITECTURE_CURRENT.mmd`

```mermaid
---
config:
  flowchart:
    curve: linear
---
graph TD;
    U["User"] --> UI["Whiteboard UI (React)"];
    UI --> Ctx["WhiteboardContext (Reducer + localStorage)"];
    Ctx --> Canvas["Canvas / NodePanel / Breadcrumbs"];
    UI --> Wizard["OrgBuilderWizard"];
    UI --> Quick["GenerateOrgDialog"];
    UI --> Chat["ChatWidget"];
    Wizard --> GRoute["POST /api/generate (conversation|generate)"];
    Quick --> GRoute;
    Chat --> CRoute["POST /api/chat"];
    Wizard --> ParseRoute["POST /api/intake/parse"];
    GRoute --> AI["src/lib/ai.ts (Provider + Model Routing)"];
    CRoute --> AI;
    GRoute --> Schemas["src/lib/schemas.ts (Zod Contracts)"];
    CRoute --> Schemas;
    ParseRoute --> ParseConstraints["File/Size/Text Constraints"];
    Ctx --> Tree["src/lib/whiteboardTree.ts"];
    Ctx --> Hierarchy["src/lib/hierarchy.ts"];
```

## Ownership
- UI state and behavior: `src/contexts` and `src/components/features`
- API contracts and AI orchestration: `src/app/api` + `src/lib`
- Structural rules: `src/lib/hierarchy.ts` and `src/lib/whiteboardTree.ts`

## Update Trigger
Update this file when:
- API routes or flow shape change
- state orchestration ownership changes
- AI routing path changes
