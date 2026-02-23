# Em Quem Votar Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)

- TypeScript strict mode enforced across the entire codebase; no `any` types, no `@ts-ignore`
- Clear separation between server (`.server.ts`) and client code; never import server modules from client components
- Follow the established service layer pattern: routes → loaders → services → Prisma
- All data crossing the server/client boundary must be serializable (ISO strings, plain numbers, no Date/Decimal objects)
- Use `~/*` path aliases consistently; no relative imports climbing more than one level (`../../`)
- Functions must have a single responsibility; files should not exceed 300 lines without strong justification
- Zod validation at all system boundaries (user input, API responses, external data)

### II. Speed & Development Velocity

- Prefer existing libraries and Shadcn/ui components over custom implementations
- Use React Router's streaming pattern (`Suspense` + `Await`) for all data-heavy routes to unblock the UI
- Server-side data fetching via `loader()` only; no client-side `useEffect` for initial data loads
- Keep build times fast: avoid heavy runtime dependencies; prefer tree-shakeable imports
- Use Prisma's query optimization (select/include only needed fields) to minimize database round-trips
- Incremental adoption: new features must not require rewriting existing stable code

### III. User Experience Consistency

- Mobile-first responsive design using Tailwind breakpoints (`sm`, `md`, `lg`, `xl`)
- Every loading state must have a skeleton loader or meaningful placeholder; no blank screens
- Error states must be user-friendly with clear Portuguese messages and recovery actions
- Navigation must be consistent: Header and Footer present on all pages; breadcrumbs on detail pages
- Form interactions must provide immediate feedback (validation, loading spinners, success/error toasts via Sonner)
- All political data must include source attribution and last-updated timestamps for transparency
- Animations via Framer Motion must be subtle (< 300ms), purposeful, and respect `prefers-reduced-motion`

### IV. Core Testing

- All service layer functions (`*.server.ts`) must have unit tests with Vitest
- Test the business logic, not the framework: mock Prisma, test data transformations and edge cases
- Quiz matching algorithm (`match.server.ts`) requires comprehensive test coverage including edge cases
- Critical user flows (search, filter, quiz completion) must have integration tests
- Tests must run in under 30 seconds for the full suite; optimize with `vitest.workspace` if needed
- No PR merges with failing tests; `npm run test` must pass before any deployment
- Coverage target: 80% for services, 60% for components with business logic

### V. User Interface Modernity

- Use Shadcn/ui as the component foundation; customize via Tailwind and `cn()` utility, not CSS overrides
- Consistent color palette aligned with the project's civic/political theme; use CSS variables for theming
- Typography must be readable: minimum 16px base font, proper heading hierarchy, adequate line-height
- Interactive elements must have visible focus indicators for keyboard navigation (accessibility)
- Cards, badges, and data visualizations (Recharts) must follow a unified design language
- Support dark mode readiness in component architecture (CSS variables, not hardcoded colors)
- Icons exclusively from Lucide React; no mixing icon libraries

### VI. Performance Requirements

- Largest Contentful Paint (LCP) < 2.5s on 4G connections
- First Input Delay (FID) < 100ms
- Cumulative Layout Shift (CLS) < 0.1
- Time to First Byte (TTFB) < 600ms via SSR with React Router
- Bundle size budget: < 200KB JavaScript (gzipped) for initial page load
- Images must use lazy loading and appropriate formats (WebP/AVIF with fallbacks)
- Database queries must complete in < 200ms; add indexes for any query exceeding this threshold
- Use Vercel Analytics and Speed Insights for continuous performance monitoring

## Technology Standards

### Required Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React Router v7 (SSR) | 7.x |
| Language | TypeScript | 5.x (strict) |
| UI | React 19 + Shadcn/ui | 19.x |
| Styling | TailwindCSS v4 | 4.x |
| Database | PostgreSQL via Supabase | - |
| ORM | Prisma | 5.x |
| State | Zustand | 5.x |
| Testing | Vitest + Testing Library | 3.x |
| Content | MDX | 3.x |
| Animations | Framer Motion | 12.x |

### Prohibited Patterns

- No CSS-in-JS solutions (styled-components, Emotion); use Tailwind exclusively
- No client-side routing for initial data loads; always use server loaders
- No `localStorage` for data that should live in the database
- No inline styles; use Tailwind classes or `cn()` for conditional styling
- No untyped API responses; all external data must pass through Zod schemas

## Development Workflow

### Pre-Commit Gates

1. `npm run typecheck` — must pass with zero errors
2. `npm run test` — full test suite must pass
3. No console.log statements in committed code (use structured logging if needed)

### Code Review Checklist

- [ ] Server/client boundary respected (no `.server.ts` imports in client code)
- [ ] Loading and error states implemented
- [ ] Mobile layout tested at 375px width minimum
- [ ] Serialization handled (no Date/Decimal objects crossing the wire)
- [ ] New Prisma queries use select/include to limit returned data
- [ ] Accessibility: semantic HTML, ARIA labels where needed, keyboard navigable

### Branch Strategy

- Feature branches named: `NNN-feature-name` (e.g., `001-quiz-redesign`)
- All work through pull requests against `main`
- Squash merge preferred for clean history

## Governance

- This constitution supersedes all ad-hoc practices and must be consulted for every feature implementation
- Amendments require: documentation of the change, rationale, and migration plan for existing code
- All code reviews must verify compliance with these principles
- Performance budgets are hard limits; violations must be resolved before merge

**Version**: 1.0.0 | **Ratified**: 2026-02-18 | **Last Amended**: 2026-02-18
