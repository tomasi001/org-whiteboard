# Org Whiteboard

An interactive organisational whiteboarding tool for workflow mapping and process mapping. Build nested hierarchical structures with drill-down capabilities for departments, roles, and workflows.

## Features

- **Nested Structure Visualisation**: Click into departments, teams, and roles to gain deeper insight as you navigate through the hierarchy
- **Interactive Whiteboarding**: Rich interactive canvas for visualising organisational structures with zoom and pan controls
- **Workflow Mapping**: Map both agentically orchestrated and linearly automated processes with clear visual distinction
- **Documentation Previews**: Link documentation directly to any node in the whiteboard
- **Deep Drill-down**: Navigate through nested hierarchies with breadcrumbs for easy backtracking
- **Node Types**: Organisation, Department, Team, Role, Workflow, Process, Agent, Automation

## Getting Started

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Tech Stack

- Next.js 16
- TypeScript
- Tailwind CSS 4
- React Context for state management
- LocalStorage for persistence
- OpenAI (default, GPT-5) and Gemini via server-side API routes

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/
│   ├── ui/               # Base UI components
│   └── features/         # Feature components
├── contexts/             # React Context providers
├── lib/                  # Utilities
└── types/               # TypeScript types
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
USE_GEMINI_PROVIDER=false
OPENAI_API_KEY=your-server-side-openai-key
# Optional Gemini fallback/switch:
# USE_GEMINI_PROVIDER=true
# GEMINI_API_KEY=your-server-side-gemini-key
```

## Build

```bash
# Build for production
pnpm run build
```

## Quality Gates

```bash
# Lint + type check + tests + build
pnpm run check

# Unit and integration tests
pnpm run test

# End-to-end tests
pnpm run test:e2e
```

## License

MIT
