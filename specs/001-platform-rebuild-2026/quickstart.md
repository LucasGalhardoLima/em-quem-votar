# Quickstart: Platform Rebuild 2026

**Branch**: `001-platform-rebuild-2026` | **Date**: 2026-02-18

## Prerequisites

- Node.js 20+
- PostgreSQL (via Supabase)
- npm

## Setup

```bash
# 1. Clone and checkout
git checkout 001-platform-rebuild-2026

# 2. Install dependencies
npm install

# 3. Environment variables
cp .env.example .env
# Fill in: DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY

# 4. Database setup
npx prisma migrate dev

# 5. Seed initial data (candidates, topics, quiz questions)
npx prisma db seed

# 6. Start dev server
npm run dev
# → http://localhost:5173
```

## Key Development Workflows

### Adding a new candidate

1. Admin UI: Navigate to `/admin` → "Novo Candidato"
2. Or seed via Prisma Studio: `npx prisma studio`

### Adding political positions

1. Admin UI: `/admin/candidato/:id` → "Adicionar Posição"
2. Select topic, stance (-1/0/+1), source type, source URL
3. Approve position for public display

### Updating quiz questions

1. Database: Quiz questions are in `QuizQuestion` + `QuizOption` tables
2. Each question links to a `PoliticalTopic`
3. Options have `stanceValue` (-1, 0, +1) that maps to the topic dimension

### Syncing voting records

1. Link candidate to legislative ID via `CandidateLegislativeLink`
2. Run sync script: `npm run sync:votes -- --candidate-id=<uuid>`
3. Votes appear on candidate profile after bill approval

## Architecture Overview

```
User Request
    ↓
React Router (SSR)
    ↓
Route Loader (server-side)
    ↓
Service Layer (*.server.ts)
    ↓
Prisma ORM
    ↓
PostgreSQL (Supabase)
```

## Testing

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run typecheck     # TypeScript check
```

## Key Directories (post-rebuild)

```
app/
├── routes/              # Page components with loaders
│   ├── home.tsx         # Landing page
│   ├── candidatos.tsx   # Candidate listing (was busca.tsx)
│   ├── candidato.$id.tsx # Candidate profile (was politico.$id.tsx)
│   ├── quiz.tsx         # Quiz flow
│   ├── resultado.tsx    # Quiz results
│   ├── comparar.tsx     # Side-by-side comparison
│   ├── votacoes.tsx     # Voting records list
│   ├── votacao.$id.tsx  # Vote detail
│   ├── educacao.*.mdx   # Education articles (preserved)
│   ├── admin.*.tsx      # Admin pages
│   └── api.*.ts         # API routes
├── components/          # Reusable UI components
│   ├── ui/              # Shadcn base components
│   ├── landing/         # Homepage sections
│   ├── candidate/       # Candidate-specific components
│   └── quiz/            # Quiz-specific components
├── services/            # Server-side business logic
│   ├── candidate.server.ts
│   ├── position.server.ts
│   ├── match.server.ts
│   ├── spending.server.ts
│   ├── bill.server.ts
│   ├── article.server.ts
│   └── newsletter.server.ts   # DROPPED 2026-08-28
├── data/                # Static data (archetypes, featured items)
├── stores/              # Zustand client state
├── hooks/               # React hooks
└── lib/                 # Utilities
```
