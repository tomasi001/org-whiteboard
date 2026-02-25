# System Patterns

> Maintenance note: this memory-bank file is contextual and non-canonical.
> Canonical governance and runtime audit references live in `SYSTEM_CONTROL_CENTER/*`.

## Architecture Overview
The application follows a component-based architecture with React Context for global state management.

### State Management
- **WhiteboardContext**: Central context managing:
  - Current whiteboard state
  - Selected node
  - Zoom and pan state
  - Breadcrumb navigation
  - CRUD operations for nodes

### Data Flow
1. User interacts with Canvas (pan/zoom/click)
2. Events trigger Context updates
3. Components re-render based on context state
4. Changes persisted to localStorage

## Key Design Patterns

### Node Hierarchy
```
NodeType hierarchy:
- organisation: root node, contains departments
- department: contains teams, teamLeads, workflows
- team: contains teamLeads, teamMembers, tools, workflows
- teamLead/teamMember: contains subRoles, tools
- subRole: contains tools, workflows
- tool: contains workflows
- workflow: contains processes, has workflowType (agentic|linear)
- process: contains agents
- agent: contains automations
- automation: leaf node
```

### Component Patterns
- **Canvas**: Handles rendering, pan/zoom, node layout
- **NodeCard**: Individual node display with glassmorphism
- **NodePanel**: Details panel for selected node
- **ChatWidget**: AI-powered conversational interface

### Layout Algorithm
- Tree-based layout with automatic positioning
- Parent nodes centred above children
- Connection lines from parent centre to child centre

## Styling Patterns
- British/South African spelling in UI labels (colour, organisation, centre)
- Glassmorphism: `bg-white/70 backdrop-blur-xl`
- Fixed header/panel with canvas behind
- Z-index layering: canvas (0), breadcrumbs (40), panel (40), header (50)
