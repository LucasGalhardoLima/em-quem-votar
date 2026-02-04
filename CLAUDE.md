# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Em Quem Votar is a Brazilian political information platform that helps citizens research politicians based on their voting records and political stances. It features politician search/filtering, a political quiz for matching users to politicians, vote history browsing, and educational content.

## Tech Stack

- **Framework**: React Router v7 (SSR mode) with React 19
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL via Supabase, Prisma ORM
- **Styling**: TailwindCSS v4, Shadcn/ui components
- **State**: Zustand (client-side stores with localStorage persistence)
- **Content**: MDX for educational articles

## Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Production build
npm run start        # Run production server
npm run typecheck    # Generate types + TypeScript check
```

Prisma commands:
```bash
npx prisma generate  # Regenerate client after schema changes
npx prisma migrate dev --name <name>  # Create migration
npx prisma studio    # Database GUI
```

## Architecture

### Path Alias
Use `~/*` for imports from `app/` directory (e.g., `import { cn } from "~/lib/utils"`).

### Server vs Client Code
- Files with `.server.ts` suffix run only on server
- Services in `app/services/*.server.ts` contain all database queries
- Never import `.server.ts` files from client components

### Data Fetching Pattern
Routes use React Router's `loader()` for server-side data fetching with streaming:

```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const resultsPromise = PoliticianService.list({ ... });
  return { results: resultsPromise };  // Returns Promise for streaming
}

// In component, use Await + Suspense for deferred data
<Suspense fallback={<SkeletonLoader />}>
  <Await resolve={results}>{(data) => <Component data={data} />}</Await>
</Suspense>
```

### Service Layer
Business logic is in `app/services/*.server.ts`:
- `politician.server.ts` - Search, filter, pagination
- `bill.server.ts` - Vote/bill queries
- `match.server.ts` - Quiz matching algorithm
- `article.server.ts` - Article retrieval

Services handle Prisma serialization (convert Dates to ISO strings, Decimals to numbers).

### Routing
Routes defined in `app/routes.ts` using React Router config API:
- Dynamic routes: `politico/:id`, `votacao/:id`, `artigos/:slug`
- MDX routes: `educacao/*.mdx` for static articles
- API routes: `api/newsletter` (resource routes without UI)

### State Management
Zustand stores in `app/stores/`:
- `filterStore.ts` - Tag filter state (client-only)
- `comparisonStore.ts` - Politician comparison (persisted to localStorage, max 3)

### Database Schema
Core models in `prisma/schema.prisma`:
- **Politician**: Name, party, state, attendance, spending, tags
- **Tag**: Political stances with category and slug
- **PoliticianTag**: Many-to-many join
- **Bill**: Voting records from Câmara API
- **VoteLog**: Individual politician votes

## Key Directories

```
app/
├── routes/          # Page components with loaders
├── components/      # Reusable UI (Header, Footer, Cards, etc.)
│   └── ui/          # Shadcn base components
├── services/        # Server-side business logic
├── stores/          # Zustand state management
├── data/            # Static data (filters, quiz questions, tags)
├── hooks/           # React hooks (useMediaQuery)
└── lib/             # Utilities (cn for class merging)
```

## Conventions

- Components use Shadcn/ui patterns with `cn()` for conditional classes
- Server data must be serializable (no Date objects, use ISO strings)
- Mobile-first responsive design using Tailwind breakpoints
- Use `<Suspense>` with skeleton loaders for deferred content
