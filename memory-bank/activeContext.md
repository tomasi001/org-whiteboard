# Active Context

> Maintenance note: this memory-bank file is contextual and non-canonical.
> Canonical governance and runtime audit references live in `SYSTEM_CONTROL_CENTER/*`.

## Current Work Focus
- AI integration with Gemini 2.5 Flash is working
- Application running at http://localhost:3001
- All core features implemented

## Recent Changes
- Fixed AI SDK: switched to `@google/genai` package
- Model: `gemini-2.5-flash` (latest stable)
- API endpoint `/api/generate` returns 200 successfully
- Memory bank updated with correct model name

## Next Steps
- No pending tasks - application is complete

## Active Decisions
- Using `@google/genai` SDK (not `@google/generative-ai`)
- Using `gemini-2.5-flash` model
- Fallback to mock responses when no API key provided

## Important Patterns
- British/South African spelling in UI (organisation, colour, centre)
- Glassmorphism design for nodes
- localStorage for persistence
- React Context for state management

## Learnings
- `@google/genai` is the correct SDK package name
- Model names must match exactly: `gemini-2.5-flash`
- API calls can take 30+ seconds for complex prompts
