# Technical Context

## Technologies Used
- **Framework**: Next.js 16.1.6 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with glassmorphism design
- **Icons**: Lucide React
- **State Management**: React Context API
- **Storage**: localStorage for persistence
- **AI**: Google Gemini (gemini-2.0-flash) via @google/genai

## Development Setup
- Node.js with pnpm package manager
- Running on port 3001
- Hot reload enabled via Next.js Turbopack

## Project Structure
```
org-whiteboard/
├── src/
│   ├── app/
│   │   ├── api/generate/route.ts  # Gemini AI endpoint
│   │   ├── page.tsx               # Main page
│   │   └── layout.tsx
│   ├── components/
│   │   ├── features/
│   │   │   ├── Canvas.tsx         # Main canvas with pan/zoom
│   │   │   ├── NodeCard.tsx       # Node display component
│   │   │   ├── NodePanel.tsx      # Details panel
│   │   │   ├── Breadcrumbs.tsx    # Navigation breadcrumbs
│   │   │   ├── ChatWidget.tsx     # AI chat interface
│   │   │   ├── GenerateOrgDialog.tsx
│   │   │   ├── CreateWhiteboardDialog.tsx
│   │   │   └── WhiteboardApp.tsx
│   │   └── ui/                    # Base UI components
│   ├── contexts/
│   │   └── WhiteboardContext.tsx  # Global state
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   └── lib/
│       └── utils.ts
├── memory-bank/                   # Cline memory bank
└── .clinerules                    # Project rules
```

## Key Dependencies
- next: 16.1.6
- react: 19.x
- tailwindcss: 4.x
- lucide-react: icons
- @google/genai: Gemini AI integration

## Environment Variables
- GEMINI_API_KEY: Google Gemini API key for AI generation