# Tech Context

## Technologies Used
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **State Management**: React Context (WhiteboardContext)
- **Icons**: Lucide React
- **Utilities**: clsx, tailwind-merge
- **Database**: Supabase (optional, for persistence)
- **Package Manager**: pnpm

## Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/
│   ├── ui/               # Base UI components (Button, Card, Input)
│   └── features/         # Feature components
│       ├── WhiteboardApp.tsx
│       ├── Breadcrumbs.tsx
│       ├── Canvas.tsx
│       ├── NodeCard.tsx
│       ├── NodePanel.tsx
│       └── CreateWhiteboardDialog.tsx
├── contexts/
│   └── WhiteboardContext.tsx  # State management
├── lib/
│   ├── supabase.ts       # Supabase client
│   └── utils.ts         # Utility functions
└── types/
    └── index.ts         # TypeScript types
```

## Development Setup
```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm run build
```

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

## Key Technical Decisions
1. **Client-side state**: Using React Context for whiteboard state (no persistence yet)
2. **In-memory data**: Nodes stored in context, not persisted to database
3. **Breadcrumb navigation**: Tracks drill-down path for easy backtracking
4. **Node hierarchy**: Tree structure with parent-child relationships
