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
npx prisma migrate deploy             # Apply pending migrations (CI/prod)
npx prisma studio    # Database GUI
npx prisma db seed   # Idempotent seed (topics, tags, quiz, 13 candidacies)
```

Data pipeline:
```bash
npm run sync:tse                  # Sync the 211 candidacies from TSE
npm run sync:tse -- --dry-run     # Show the diff, write nothing
npm run sync:tse -- --from-file <path>   # Parse an already-downloaded CSV/ZIP
npm run sync:tse -- --photos      # Also fetch official ballot photos
```

The sync reads **two** TSE sources, because neither is sufficient alone:

1. `cdn.tse.jus.br` — the open-data package, for identity, coalition, chapa.
2. `divulgacandcontas.tse.jus.br` — the divulgation REST API, for the
   **situação da candidatura**, in 28 calls (BR/presidente + 27 UFs/governador).

The second one is not optional. In 2026 the open-data package does not carry
the situation at all: `DS_SITUACAO_CANDIDATURA` is `#NE` in all 41,500 rows of
the 29 CSVs and `DS_DETALHE_SITUACAO_CAND` is absent from the layout (verified
2026-08-26 over the whole package). Without the API the site would state
"aguardando julgamento" for people the Justiça Eleitoral has already ruled on.

**Never let an API failure rewrite a situation.** When a unit does not answer,
the sync omits `tseStatusLabel`/`tseStatusDetail`/`registrationStatus` from the
update and warns once per unit — the stored value survives. Writing the
`PENDING_JUDGMENT` fallback there would turn a TSE outage into a false claim
about a real person. Verified by pointing the API at an unreachable host: 28
warnings, zero status diffs.

On 403s: `cdn.tse.jus.br` answers 403 to a request with **no** User-Agent and
200 with one (the script always sends `USER_AGENT`); `curl` is blocked on both
hosts by Akamai's TLS fingerprinting while Node's `fetch` is not. So a 403 from
`curl` says nothing about the script. If the script itself hits 403/404,
download the package manually and use `--from-file`.

### Scheduled refresh — `/api/cron/tse-status` (hourly)

GitHub Actions is disabled for this repo, so the schedule lives in
`vercel.json`. The hourly cron calls `refreshCandidateStatuses()`, which
re-reads only the **situação** — it never creates, deletes, or touches another
field. That cadence mirrors the TSE's own ("a atualização dos dados referentes
às candidaturas ocorre a cada 60 min"), and during the judgment of registrations
the situation is the fastest-moving and most consequential field on the site.

The route is a **write** endpoint on a public site: it requires
`Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this automatically) and
returns 503 in production when `CRON_SECRET` is unset — fails closed, like
`/admin`. `robots.txt` already disallows `/api/`.

**No LLM is involved in this path.** The OpenAI classifier
(`vote-classifier.server.ts`) belongs to the *votações* pipeline and is never
reached from the candidate sync or the cron, so neither costs model credits.

Code layout, so the two callers cannot drift:
- `app/lib/tse-divulga.ts` — pure: election code, region map, `divulgaUrl()`,
  `fetchDivulgaStatuses()`. No Prisma, so the sync script can import it without
  opening a second client.
- `app/services/tse-status.server.ts` — the DB write.
- `app/lib/candidate-status.ts` — `statusFromTseLabel()`, the TSE wording → enum
  map. Add new TSE wordings **here**, not in the script.

The **full sync** (identity, coalition, chapa, photos) has no scheduled home
right now — run `npm run sync:tse` by hand until one is decided.

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
- Main flow: `/`, `/candidatos`, `/candidato/:id`, `/comparar`, `/quiz`,
  `/resultado`, `/metodologia`
- Voting records: `/votacoes`, `/votacao/:id`
- MDX routes: `educacao/*.mdx` for static articles, plus `/sobre`, `/faq`,
  `/privacidade`, `/termos`
- Admin: `/admin/login`, `/admin`, `/admin/candidato/:id`,
  `/admin/votacao/:id`
- Resource routes (no UI): `api/newsletter`, `resources/og/:id`, `sitemap.xml`
- Legacy 301 redirects kept for SEO: `/busca`, `/politico/:id`,
  `/artigos/:slug`

### State Management
Zustand stores in `app/stores/`, both persisted to localStorage with
`skipHydration: true`. The SSR pass always renders the empty state; the
store is rehydrated after mount via `useQuizHydration()` /
`useComparisonHydration()`. Read that flag before rendering anything that
depends on stored state, or you reintroduce a hydration mismatch.
- `quizStore.ts` - Quiz answers (topicSlug -> 1..5) and per-axis weights
- `comparisonStore.ts` - Candidate comparison (max 3, `MAX_COMPARISON`)

### Quiz answers never reach the server
`/resultado` and the candidate profile compute compatibility **in the
browser** with the pure module `app/lib/match.ts`. The loader ships only
public data (candidate positions); answers stay in localStorage. This is a
promise made explicitly on `/metodologia` §5 — do not "simplify" it by
moving matching into a loader or serialising answers into the URL.

### Core domain vocabulary (`app/lib/`)
- `stance.ts` - Likert labels, `agreementFor()`, importance multipliers.
  Stance `0` means "sem posição registrada" and is NEVER treated as neutral.
- `match.ts` - the compatibility algorithm. A topic counts only when BOTH
  sides exist; topics without a documented position are excluded from the
  numerator AND the denominator. `matchPercentage` is `null` (never `0`)
  when nothing is comparable.
- `candidate-status.ts` - TSE registration status. The badge shows
  `tseStatusLabel` (the TSE's literal wording) when present; the enum is
  only for filtering. Never paraphrase a candidacy's situation.
- `election.ts` - 2026 calendar and countdown.

### Admin is behind a signed-cookie session
Every `/admin` loader AND action calls `requireAdmin(request)` from
`app/utils/admin-auth.server.ts`, which redirects to `/admin/login` when
there is no valid session. Configure `ADMIN_PASSWORD` (and optionally
`ADMIN_USER`) — see `.env.example`. In production a missing password fails
**closed** (503); in development it warns and allows.

The session is a stateless HMAC token (8h, `HttpOnly`, `SameSite=Lax`,
`Path=/admin`) signed with `ADMIN_PASSWORD` — so **changing the password
revokes every open session**. `?next=` is validated by `safeNextPath()` to
prevent an open redirect.

Do NOT switch this to HTTP Basic: React Router drops the headers of a
`Response` thrown from a loader, so `WWW-Authenticate` never reaches the
browser and nobody — including the editor — can log in. This was tried and
verified. If you add an admin route, guard both its loader and its action;
`noindex` is not access control.

### Neutrality rules (non-negotiable)
These are product requirements, not style preferences:
- Identical visual weight for every candidacy; no party colours anywhere.
- `/candidatos` order is randomised per request (`shuffleSeed`).
- Votes (`Sim`/`Não`) are shown in neutral chips — colouring a vote is a
  value judgement about the person who cast it.
- Every displayed position cites document, page and link via
  `SourceCite.tsx`. Missing data is rendered as missing, never inferred.

### Database Schema
Core models in `prisma/schema.prisma`:
- **Candidate**: the 2026 presidential candidacies. TSE identity
  (`tseId`, `number`, `tseStatusLabel`), chapa (`viceName`, `coalition`,
  `coalitionParties`), official documents (`governmentPlanUrl`), and
  provenance (`dataSource`: `tse` | `press` | `manual`, `sourceUrl`,
  `lastSyncedAt`). `tseId` is the upsert key used by the sync script.
- **PoliticalTopic**: the 20 themes, grouped into 5 thematic categories
- **CandidatePosition**: stance 1-5 per (candidate, topic), plus the source
  trail (`sourceType`, `sourceUrl`, `sourceDocument`, `sourcePage`,
  `sourceQuote`). Only rows with `approvedAt != null` are ever shown.
- **QuizQuestion** / **QuizOption**: one question per topic, 5-point Likert
- **Bill** / **VoteRecord**: nominal votes from Câmara and Senado
- **SpendingRecord**: CEAP, campaign spending and declared assets

Legacy, still present for the older vote pages: **Politician**,
**PoliticianTag**, **VoteLog**, **Tag**.

## Key Directories

```
app/
├── routes/          # Page components with loaders
├── components/
│   ├── layout/      # SiteHeader, SiteFooter, Container, CountdownBanner
│   ├── candidate/   # Avatar, Card, StatusBadge, SourceCite, PositionsByTopic
│   └── ui/          # Shadcn base components
├── services/        # Server-side business logic
├── stores/          # Zustand state management
├── data/            # Static data (archetypes, filters, tag definitions)
├── hooks/           # React hooks (useMediaQuery)
└── lib/             # Domain vocabulary + utilities (see above)

prisma/
├── schema.prisma
├── seed.ts          # Idempotent
└── data/
    ├── reference.ts        # 20 topics, 15 tags, 20 quiz questions
    └── candidates-2026.ts  # The 13 real candidacies, each with sourceUrl
```

## Conventions

- Components use `cn()` from `~/lib/utils` for conditional classes. The
  Shadcn primitives in `app/components/ui/` are still installed but are
  currently unused — the 2026 screens build on semantic HTML plus Tailwind
  utilities, which keeps the markup accessible without a wrapper layer. Add
  a primitive back with the Shadcn CLI if a component genuinely needs one
  (focus management, portals), not by default.
- Palette is Tailwind `slate` + `indigo-600`. Do not reintroduce the
  `brand-*` or Shadcn CSS-variable tokens (`bg-card`, `text-muted-foreground`,
  …) — they were fully purged from routes and components.
- Server data must be serializable (no Date objects, use ISO strings)
- Mobile-first responsive design using Tailwind breakpoints
- Use `<Suspense>` with skeleton loaders for deferred content

## Active Technologies
- TypeScript 5.x (strict mode) + React Router v7.10, React 19, Prisma 5.x, TailwindCSS v4, Shadcn/ui, Zustand 5.x

## Recent Changes
- 002-eleicao-real-2026: Full UI refactor to the approved 2026 prototype.
  Global layout moved into `app/root.tsx` (`SiteHeader`/`SiteFooter`) —
  routes no longer render their own chrome. Client-side quiz matching.
  Real TSE-sourced candidacies + `scripts/sync-tse-2026.ts`.
  Removed: `politician.server.ts`, `match.server.ts`, `app/store/`,
  `filterStore`, the `landing/` and `quiz/` component folders, and the
  duplicate article system in `app/data/articles.ts`.
- 001-platform-rebuild-2026: Added TypeScript 5.x (strict mode) + React Router v7.10, React 19, Prisma 5.x, Shadcn/ui, Zustand 5.x, Framer Motion 12.x
