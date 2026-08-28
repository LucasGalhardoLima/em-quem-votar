# Implementation Plan: Platform Rebuild 2026

**Branch**: `001-platform-rebuild-2026` | **Date**: 2026-02-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-platform-rebuild-2026/spec.md`

## Summary

Rebuild the "Em Quem Votar" platform from a deputados-focused tool to a presidential election platform for 2026 Brazil. The core shift: replace `Politician` with `Candidate` as the primary entity, expand the tag/position system for presidential-level topics, upgrade the quiz matching algorithm to Euclidean distance with neutral imputation over 5-point Likert position vectors, and redesign all routes with the new data model. All existing static content (MDX articles, FAQ, about) migrates into the new design. The tech stack remains: React Router v7 SSR, Prisma + Supabase PostgreSQL, Shadcn/ui + Tailwind, Zustand.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: React Router v7.10, React 19, Prisma 5.x, Shadcn/ui, Zustand 5.x, Framer Motion 12.x
**Storage**: PostgreSQL via Supabase, Prisma ORM
**Testing**: Vitest 3.x + Testing Library + jsdom
**Target Platform**: Web (SSR, Vercel deployment)
**Project Type**: Web application (single fullstack codebase)
**Performance Goals**: LCP < 2.5s, FID < 100ms, CLS < 0.1, TTFB < 600ms, < 200KB JS gzipped
**Constraints**: < 200ms DB queries, mobile-first (375px minimum), Portuguese (pt-BR) throughout
**Scale/Scope**: ~15-30 presidential candidates, ~15 political topics, ~12 quiz questions, ~7-10 key bills

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | PASS | TypeScript strict, service layer pattern preserved, Zod at boundaries |
| II. Speed & Velocity | PASS | Reuses existing libraries/patterns, streaming with Suspense + Await |
| III. UX Consistency | PASS | Mobile-first, skeleton loaders, Portuguese messages, source attribution |
| IV. Core Testing | PASS | Vitest for all services, 80% coverage target for services |
| V. UI Modernity | PASS | Shadcn/ui foundation, CSS variables, Lucide icons, dark mode ready |
| VI. Performance | PASS | SSR, < 200KB bundle, < 200ms queries, lazy loading |

**Post-Phase 1 Re-check**: All gates still PASS. The new data model adds 6 new tables but queries remain optimized with Prisma select/include. The Euclidean distance calculation is O(candidates * topics) which is well within limits for ~30 candidates.

## Project Structure

### Documentation (this feature)

```text
specs/001-platform-rebuild-2026/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: API research, algorithm decisions
├── data-model.md        # Phase 1: Database entities and relationships
├── quickstart.md        # Phase 1: Developer onboarding guide
├── contracts/
│   └── api-routes.md    # Phase 1: Route loaders and service contracts
└── tasks.md             # Phase 2: Implementation tasks (via /speckit.tasks)
```

### Source Code (repository root)

```text
app/
├── routes/
│   ├── home.tsx                    # Redesigned landing page
│   ├── candidatos.tsx              # NEW: Candidate listing (replaces busca.tsx)
│   ├── candidato.$id.tsx           # NEW: Candidate profile (replaces politico.$id.tsx)
│   ├── quiz.tsx                    # Refactored: DB-driven questions, 3-option answers
│   ├── resultado.tsx               # Refactored: Cosine similarity matching
│   ├── comparar.tsx                # Refactored: Position-based comparison
│   ├── votacoes._index.tsx         # Updated: Multi-source bills
│   ├── votacao.$id.tsx             # Updated: Candidate-aware
│   ├── educacao._index.tsx         # Preserved
│   ├── educacao.*.mdx              # Preserved (9 articles)
│   ├── sobre.mdx                   # Preserved
│   ├── faq.mdx                     # Preserved
│   ├── metodologia.tsx             # Updated
│   ├── admin._index.tsx            # Refactored: Candidate management
│   ├── admin.candidato.$id.tsx     # NEW: Candidate editor
│   ├── admin.votacao.$id.tsx       # Updated
│   ├── api.newsletter.ts           # Preserved — DROPPED 2026-08-28
│   ├── resources.og.$id.tsx        # Updated for candidates
│   └── sitemap.xml.ts              # Updated routes
├── components/
│   ├── ui/                         # Shadcn base (preserved)
│   ├── landing/                    # Updated landing sections
│   ├── candidate/                  # NEW: CandidateCard, CandidatePositions, etc.
│   ├── quiz/                       # NEW: QuizCard, QuizProgress, QuizOption
│   ├── Header.tsx                  # Updated navigation
│   ├── Footer.tsx                  # Preserved
│   ├── ComparisonFloatingBar.tsx   # Preserved (adapted)
│   ├── SkeletonLoader.tsx          # Updated skeletons
│   └── NewsletterForm.tsx          # Preserved — DROPPED 2026-08-28 (never built)
├── services/
│   ├── candidate.server.ts         # NEW (replaces politician.server.ts)
│   ├── position.server.ts          # NEW
│   ├── match.server.ts             # Refactored (Euclidean distance)
│   ├── spending.server.ts          # NEW
│   ├── bill.server.ts              # Updated (multi-source)
│   ├── article.server.ts           # Preserved
│   ├── newsletter.server.ts        # Preserved — DROPPED 2026-08-28
│   └── vote-classifier.server.ts   # Preserved (adapted)
├── data/
│   ├── archetypes.ts               # Updated for presidential context
│   ├── tag-definitions.ts          # Updated for new tags
│   ├── filters.ts                  # Updated for candidate filters
│   ├── votes.ts                    # Updated featured vote IDs
│   └── articles.ts                 # Preserved
├── stores/
│   ├── comparisonStore.ts          # Preserved (adapted for candidates)
│   └── filterStore.ts              # Preserved
├── hooks/
│   └── useMediaQuery.ts            # Preserved
├── lib/
│   └── utils.ts                    # Preserved
└── utils/
    ├── db.server.ts                # Preserved
    ├── rate-limit.server.ts        # Preserved
    └── supabase.server.ts          # Preserved

prisma/
├── schema.prisma                   # Updated with new models
├── migrations/                     # New migration
└── seed.ts                         # NEW: Seed candidates, topics, quiz questions
```

**Structure Decision**: Single fullstack web application. The existing React Router v7 SSR architecture is preserved. New models are added to the existing Prisma schema. Components are reorganized into domain-specific folders (candidate/, quiz/) but the fundamental app/ structure remains.

## Complexity Tracking

> No constitution violations detected. All principles are satisfied by the design.

| Decision | Justification | Simpler Alternative Rejected Because |
|----------|---------------|--------------------------------------|
| New `CandidatePosition` table (normalized) | Positions are multi-sourced, need individual approval, source tracking | Storing positions as JSON on Candidate → loses queryability, can't filter by topic |
| `CandidateLegislativeLink` table | Clean separation between candidate identity and legislative records | Hardcoding deputadoId on Candidate → couples TSE and Câmara data models |
| Cosine similarity for matching | Handles missing dimensions (candidates with few positions) gracefully | Tag scoring → can't handle variable data completeness across candidates |
| Quiz questions in DB (not static file) | Admin can add/modify questions without deploy, link to topics | Static `quiz-questions.ts` → requires code change for every question update |
