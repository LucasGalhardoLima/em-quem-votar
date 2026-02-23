# Tasks: Platform Rebuild for 2026 Brazilian Elections

**Input**: Design documents from `/specs/001-platform-rebuild-2026/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-routes.md, quickstart.md

**Tests**: Not explicitly requested in spec. Test tasks are NOT included. Coverage targets (80% services, 60% components) are deferred to Polish phase.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- All paths relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new directory structure and install dependencies for the rebuild

- [x] T001 Create new component directories: `app/components/candidate/`, `app/components/quiz/`, `app/components/landing/`
- [x] T002 Verify all dependencies are installed (react-router v7, prisma, shadcn/ui, zustand, framer-motion, zod) in `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, seed data, core service, and navigation — MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Update `prisma/schema.prisma` with all new models: `Candidate` (with `RegistrationStatus` enum), `PoliticalTopic`, `CandidatePosition` (with `SourceType` enum), `CandidateTag` (join table), `CandidateLegislativeLink` (with `LegislativeSource` enum), `SpendingRecord` (with `SpendingType` enum), `VoteRecord`, `QuizQuestion`, `QuizOption` — update existing `Bill` model with `sourceType` field — preserve `Subscriber`, `UserProfile`, existing `Tag` model (add `description` field) — per data-model.md
- [x] T004 Run Prisma migration: `npx prisma migrate dev --name platform-rebuild-2026`
- [x] T005 [P] Create `prisma/seed.ts` with initial data: 20 PoliticalTopics (4 per axis: Economia, Segurança, Meio Ambiente, Direitos/Costumes, Democracia/Institucional), expanded Tags, 20 QuizQuestions with QuizOptions (5-point Likert: 1=Discordo Totalmente to 5=Concordo Totalmente), 3-5 sample Candidates with positions — per research.md thematic axes
- [x] T006 [P] Update `app/data/tag-definitions.ts` with expanded presidential-level tags covering all 5 thematic axes per research.md
- [x] T007 [P] Update `app/data/archetypes.ts` with 6 archetypes mapped to 2D political compass (O Liberal, O Estatista, O Conservador, O Progressista, O Pragmático, O Fiscal) per research.md section 5
- [x] T008 Create `app/services/candidate.server.ts` implementing `CandidateService` interface: `list()` with query/party/topic/stance filters and pagination, `getById()` with positions/tags/spending/votes includes, `getFilters()` returning available parties and topics, `listForComparison()`, `findAllForMatch()`, `listAllIds()` — per contracts/api-routes.md service contracts
- [x] T009 Create `app/services/position.server.ts` implementing `PositionService` interface: `listByCandidate()`, `listByTopic()`, `create()`, `approve()` — per contracts/api-routes.md
- [x] T010 Update `app/routes.ts` with new route configuration: rename `busca` → `candidatos`, `politico.$id` → `candidato.$id`, add `/comparar`, `/votacoes`, `/votacao.$id`, update admin routes to `admin.candidato.$id` — per plan.md project structure
- [x] T011 Update `app/components/Header.tsx` navigation links: "Candidatos" (→ /candidatos), "Quiz" (→ /quiz), "Votações" (→ /votacoes), "Educação" (→ /educacao), "Sobre" (→ /sobre) — mobile-first responsive nav

**Checkpoint**: Database migrated, seed data available, core service and routes configured — user story implementation can begin

---

## Phase 3: User Story 1 — Browse Presidential Candidates (Priority: P1) 🎯 MVP

**Goal**: Voters can explore all presidential candidates, view their profiles with political positions organized by category, source attribution, and neutral presentation

**Independent Test**: Navigate to `/candidatos`, see candidate cards. Click a candidate, see profile with positions by category. Verify source citations and neutral presentation (no color-coded stances). Verify empty state message when no candidates exist.

### Implementation for User Story 1

- [x] T012 [P] [US1] Create `app/components/candidate/CandidateCard.tsx` — displays photo, name, displayName, party, coalition, registrationStatus badge, positionCount, tags — per `CandidateListItem` interface in contracts/api-routes.md
- [x] T013 [P] [US1] Create `app/components/candidate/CandidatePositions.tsx` — displays positions grouped by `topicCategory` with stance visualization (5-point scale, neutral colors only), source type badge, source link, sourceDate — per bias mitigation rules in research.md section 6
- [x] T014 [P] [US1] Create `app/components/candidate/CandidateProfile.tsx` — full profile layout with biography, registration status, electoral number, positions section, tags — composition of sub-components
- [x] T015 [US1] Implement `app/routes/candidatos.tsx` with `candidatosLoader` returning `candidates` (deferred Promise) and `filters` — display CandidateCard grid, handle empty state ("Candidatos serão listados após registro no TSE") — per contracts/api-routes.md `/candidatos` contract
- [x] T016 [US1] Implement `app/routes/candidato.$id.tsx` with `candidatoLoader` returning full candidate detail — render CandidateProfile with positions, handle 404 with redirect — per contracts/api-routes.md `/candidato/:id` contract, set `Cache-Control: public, max-age=3600, s-maxage=86400`
- [x] T017 [US1] Update `app/routes/home.tsx` with redesigned landing page: election countdown, featured candidates section (deferred), quiz CTA, recent articles — per contracts/api-routes.md `homeLoader` contract
- [x] T018 [US1] Create `app/components/landing/HeroSection.tsx` — election countdown timer, main CTA to quiz, brief platform description
- [x] T019 [P] [US1] Create `app/components/landing/FeaturedCandidates.tsx` — horizontal scroll of top 4-6 CandidateCards with Suspense/Await deferred loading pattern
- [x] T020 [P] [US1] Create `app/components/candidate/SkeletonCandidateCard.tsx` and `app/components/candidate/SkeletonCandidateProfile.tsx` — skeleton loaders for deferred content

**Checkpoint**: User Story 1 complete — voters can browse candidates and view detailed profiles with positions

---

## Phase 4: User Story 2 — Quiz Matching System (Priority: P1)

**Goal**: Voters take a 20-question quiz (5-point Likert) and get matched to candidates via Euclidean distance algorithm with archetype classification and per-axis importance weighting

**Independent Test**: Navigate to `/quiz`, answer all 20 questions, submit. Verify results page shows ranked candidates with match percentages, category breakdowns, data completeness score, and political archetype. Test with known candidate positions to validate algorithm accuracy.

### Implementation for User Story 2

- [x] T021 [P] [US2] Create `app/components/quiz/QuizCard.tsx` — single question display with topic name, 5 Likert options as selectable cards with icons, progress indicator
- [x] T022 [P] [US2] Create `app/components/quiz/QuizProgress.tsx` — step progress bar showing current question / total, thematic axis label, estimated time remaining
- [x] T023 [P] [US2] Create `app/components/quiz/QuizOption.tsx` — individual option button with label, description, icon (Lucide), selected state animation (Framer Motion)
- [x] T024 [P] [US2] Create `app/components/quiz/ImportanceWeighting.tsx` — per-axis importance selector ("Muito importante / Importante / Pouco importante") shown before results — per research.md section 5 (highest-ROI feature)
- [x] T025 [US2] Implement `app/services/match.server.ts` refactored `MatchService`: Euclidean distance calculation with `uncertainty_penalty = 0.4` for missing positions, per-axis importance weight multipliers, archetype classification from 2D compass mapping, data completeness score per candidate — per research.md section 5 algorithm specification
- [x] T026 [US2] Implement `app/routes/quiz.tsx` with `quizLoader` returning questions from DB (active only, ordered), client-side quiz state management with Zustand or local state, URL-encoded answers on submit (`?v=topicSlug:stance,...`) — per contracts/api-routes.md `/quiz` contract
- [x] T027 [US2] Implement `app/routes/resultado.tsx` with `resultadoLoader` parsing URL vector, calling MatchService, returning deferred results with `topCandidates`, `archetype`, `metadata` — per contracts/api-routes.md `/resultado` contract
- [x] T028 [P] [US2] Create `app/components/quiz/MatchResult.tsx` — candidate match card with percentage, position comparison per category, data completeness indicator ("Baseado em X de 20 perguntas")
- [x] T029 [P] [US2] Create `app/components/quiz/ArchetypeCard.tsx` — political archetype display with gradient background, name, description — per archetypes.ts data
- [x] T030 [P] [US2] Create `app/components/quiz/PoliticalCompass.tsx` — 2D compass visualization replacing radar chart, plotting user position and candidate positions — per research.md section 5

**Checkpoint**: User Story 2 complete — full quiz flow with Euclidean distance matching, archetype classification, and importance weighting

---

## Phase 5: User Story 3 — Candidate Search & Filtering (Priority: P2)

**Goal**: Voters search candidates by name, party, or position topic, apply filters, and compare up to 3 candidates side-by-side

**Independent Test**: Search for a candidate by name on `/candidatos`, apply party and topic filters, verify results update. Select 2-3 candidates, click compare, verify side-by-side view at `/comparar`.

### Implementation for User Story 3

- [x] T031 [US3] Enhance `app/routes/candidatos.tsx` with search input (query param `?q=`), party filter chips, topic/stance filter panel — real-time URL-based filtering using React Router searchParams — per contracts/api-routes.md URL params
- [x] T032 [US3] Update `app/stores/comparisonStore.ts` to use `candidateId` instead of `politicianId`, maintain max 3 candidates, localStorage persistence — adapt existing Zustand store
- [x] T033 [US3] Update `app/components/ComparisonFloatingBar.tsx` for candidate comparison — show selected candidate names/photos, "Comparar" button linking to `/comparar?ids=...`
- [x] T034 [US3] Implement `app/routes/comparar.tsx` with `compararLoader` returning candidates with positions, topics, and featured bills — render side-by-side position comparison table, spending comparison, key votes — per contracts/api-routes.md `/comparar` contract
- [x] T035 [P] [US3] Update `app/stores/filterStore.ts` for candidate-specific filters: party, topic category, stance direction
- [x] T036 [P] [US3] Create `app/components/candidate/ComparisonTable.tsx` — side-by-side table with topics as rows, candidates as columns, stance cells with neutral visualization

**Checkpoint**: User Story 3 complete — search, filter, and comparison functionality working

---

## Phase 6: User Story 4 — Spending & Financial Transparency (Priority: P2)

**Goal**: Display candidate spending data (CEAP for legislators, campaign finance from TSE, declared assets) with source attribution on candidate profiles

**Independent Test**: View a candidate with legislative history — verify CEAP spending data appears with source. View a candidate without prior office — verify "Sem dados de gastos públicos anteriores" message.

### Implementation for User Story 4

- [ ] T037 [US4] Create `app/services/spending.server.ts` implementing `SpendingService`: `getByCandidate()` returning SpendingRecords grouped by type, `syncFromCamara()` placeholder for CEAP sync, `syncFromTSE()` placeholder for campaign finance sync — per contracts/api-routes.md
- [ ] T038 [P] [US4] Create `app/components/candidate/SpendingSummary.tsx` — spending overview card showing totals by type (CEAP, Campaign, Assets), period covered, source link, empty state message
- [ ] T039 [P] [US4] Create `app/components/candidate/SpendingChart.tsx` — spending breakdown by category with horizontal bar chart, BRL formatting
- [ ] T040 [US4] Add spending section to `app/routes/candidato.$id.tsx` — integrate SpendingService data into candidate profile loader, render SpendingSummary and SpendingChart components

**Checkpoint**: User Story 4 complete — spending transparency on candidate profiles

---

## Phase 7: User Story 5 — Voting Record Display (Priority: P2)

**Goal**: Display voting records for candidates with legislative history, with simplified bill explanations, SIM/NÃO indicators, and multi-source support (Câmara + Senado)

**Independent Test**: View a candidate with voting history — verify votes appear with simplified titles. Click a vote detail — verify bill explanation and source link. Navigate to `/votacoes` — verify bill listing with source filter.

### Implementation for User Story 5

- [ ] T041 [US5] Update `app/services/bill.server.ts` implementing extended `BillService`: `getById()` with candidate votes, `listApproved()` with source filter (camara/senado), `listFeatured()` — handle prefixed bill IDs (`camara-{id}` / `senado-{id}`) — per contracts/api-routes.md and research.md section 3
- [ ] T042 [P] [US5] Create `app/components/candidate/VoteList.tsx` — chronological vote list with simplified title, vote type badge (Sim/Não/Abstenção/Obstrução), vote date, source type indicator
- [ ] T043 [P] [US5] Create `app/components/candidate/VoteDetail.tsx` — expanded vote card with full bill description, voteSimDetails, voteNaoDetails, source URL link
- [ ] T044 [US5] Update `app/routes/votacoes._index.tsx` with `votacoesLoader` — list approved bills with search and source filter (camara/senado tabs) — per contracts/api-routes.md `/votacoes` contract
- [ ] T045 [US5] Update `app/routes/votacao.$id.tsx` with `votacaoLoader` — display bill detail with all candidate votes, vote summary counts — handle prefixed IDs — per contracts/api-routes.md `/votacao/:id` contract
- [ ] T046 [US5] Add votes section to `app/routes/candidato.$id.tsx` — integrate bill/vote data from VoteRecord relation, render VoteList component, handle "Sem histórico legislativo" empty state

**Checkpoint**: User Story 5 complete — voting records displayed across candidate profiles and dedicated vote pages

---

## Phase 8: User Story 6 — Static Content & Education (Priority: P3)

**Goal**: Migrate all existing MDX articles, FAQ, about page, and methodology into the new design system

**Independent Test**: Navigate to `/educacao` — verify all 9 articles listed. Open each article — verify MDX renders correctly. Check `/faq`, `/sobre` — verify content intact.

### Implementation for User Story 6

- [ ] T047 [P] [US6] Update `app/routes/educacao._index.tsx` — article listing page with new card design, article thumbnails, reading time estimates — per contracts/api-routes.md `/educacao` contract
- [ ] T048 [P] [US6] Update `app/routes/sobre.mdx` and `app/routes/faq.mdx` with refreshed layout wrappers matching new design system (content preserved, only styling updated)
- [ ] T049 [US6] Update `app/routes/metodologia.tsx` with updated methodology page explaining Euclidean distance algorithm, 5-point Likert scale, source hierarchy, bias mitigation approach — per research.md sections 5 and 6

**Checkpoint**: User Story 6 complete — all static content migrated to new design

---

## Phase 9: User Story 7 — Newsletter & Engagement (Priority: P3)

**Goal**: Preserve newsletter subscription functionality in the new design

**Independent Test**: Submit email in newsletter form — verify success toast. Submit duplicate — verify friendly message.

### Implementation for User Story 7

- [ ] T050 [US7] Preserve and update `app/components/NewsletterForm.tsx` — match new design system styling, keep existing validation and toast feedback
- [ ] T051 [US7] Verify `app/routes/api.newsletter.ts` action route works with existing Subscriber model — no changes needed if model preserved

**Checkpoint**: User Story 7 complete — newsletter subscription working

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Admin interface, OG images, sitemap, performance, and quality

- [ ] T052 [P] Refactor `app/routes/admin._index.tsx` — admin dashboard showing stats (totalCandidates, positionsApproved, positionsPending, billsApproved, billsPending), pending positions list, pending bills list — per contracts/api-routes.md `/admin` contract
- [ ] T053 [P] Create `app/routes/admin.candidato.$id.tsx` — admin candidate editor with full CRUD: edit candidate fields, manage positions (add/approve/reject), manage tags, link legislative record (CandidateLegislativeLink) — per contracts/api-routes.md `/admin/candidato/:id`
- [ ] T054 [P] Update `app/routes/resources.og.$id.tsx` — OG image generation adapted for candidate data (name, party, photo, match percentage for shared results)
- [ ] T055 [P] Update `app/routes/sitemap.xml.ts` — include `/candidatos`, `/candidato/:id` routes, remove old `/politico/:id` routes
- [ ] T056 Update `app/routes/home.tsx` landing page — add quiz CTA section, election timeline visualization, "Como funciona" steps section
- [ ] T057 [P] Create `app/data/filters.ts` — updated filter definitions for candidate-specific filters (parties, topics, stances)
- [ ] T058 [P] Update `app/data/votes.ts` — update featured vote IDs for presidential-relevant bills
- [ ] T059 Remove deprecated files: `app/routes/busca.tsx` (replaced by candidatos.tsx), `app/routes/politico.$id.tsx` (replaced by candidato.$id.tsx), `app/services/politician.server.ts` (replaced by candidate.server.ts) — after verifying no remaining references
- [ ] T060 Performance audit: verify LCP < 2.5s, bundle < 200KB gzipped, DB queries < 200ms — add Prisma `select` narrowing where needed, verify streaming/Suspense on all deferred data
- [ ] T061 Run quickstart.md validation: verify all setup steps work end-to-end on clean checkout

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 Browse Candidates (Phase 3)**: Depends on Phase 2 — no other story dependencies
- **US2 Quiz Matching (Phase 4)**: Depends on Phase 2 — benefits from US1 candidate data but independently testable
- **US3 Search & Filtering (Phase 5)**: Depends on Phase 2 — integrates with US1 components (CandidateCard) but independently testable
- **US4 Spending (Phase 6)**: Depends on Phase 2 — adds section to US1 profile page but independently testable
- **US5 Voting Records (Phase 7)**: Depends on Phase 2 — adds section to US1 profile page but independently testable
- **US6 Static Content (Phase 8)**: Depends on Phase 2 (navigation) — no story dependencies
- **US7 Newsletter (Phase 9)**: Depends on Phase 2 (design system) — no story dependencies
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundation only — core MVP
- **US2 (P1)**: Foundation only — uses `findAllForMatch()` from CandidateService (Phase 2)
- **US3 (P2)**: Foundation + reuses CandidateCard from US1 (but can stub if US1 not done)
- **US4 (P2)**: Foundation + adds to candidato.$id.tsx from US1 (but can create standalone)
- **US5 (P2)**: Foundation + adds to candidato.$id.tsx from US1 (but can create standalone)
- **US6 (P3)**: Foundation only
- **US7 (P3)**: Foundation only

### Within Each User Story

- Models/schema already created in Foundational phase
- Services before routes
- Components before routes that use them (or parallel if [P] marked)
- Core route implementation before enhancement/integration

### Parallel Opportunities

- **Phase 2**: T005, T006, T007 can all run in parallel (different files)
- **Phase 3 (US1)**: T012, T013, T014, T019, T020 can all run in parallel
- **Phase 4 (US2)**: T021, T022, T023, T024, T028, T029, T030 can all run in parallel
- **Phase 5 (US3)**: T035, T036 can run in parallel
- **Phase 6 (US4)**: T038, T039 can run in parallel
- **Phase 7 (US5)**: T042, T043 can run in parallel
- **Phase 8 (US6)**: T047, T048 can run in parallel
- **Phase 10**: T052, T053, T054, T055, T057, T058 can all run in parallel
- **Cross-story**: Once Phase 2 completes, US1 through US7 can technically all start in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all independent components in parallel:
Task: "Create CandidateCard in app/components/candidate/CandidateCard.tsx"
Task: "Create CandidatePositions in app/components/candidate/CandidatePositions.tsx"
Task: "Create CandidateProfile in app/components/candidate/CandidateProfile.tsx"
Task: "Create FeaturedCandidates in app/components/landing/FeaturedCandidates.tsx"
Task: "Create skeleton loaders in app/components/candidate/SkeletonCandidateCard.tsx"

# Then sequentially (depend on components):
Task: "Implement candidatos.tsx route"
Task: "Implement candidato.$id.tsx route"
Task: "Update home.tsx landing page"
```

## Parallel Example: User Story 2

```bash
# Launch all quiz components in parallel:
Task: "Create QuizCard in app/components/quiz/QuizCard.tsx"
Task: "Create QuizProgress in app/components/quiz/QuizProgress.tsx"
Task: "Create QuizOption in app/components/quiz/QuizOption.tsx"
Task: "Create ImportanceWeighting in app/components/quiz/ImportanceWeighting.tsx"
Task: "Create MatchResult in app/components/quiz/MatchResult.tsx"
Task: "Create ArchetypeCard in app/components/quiz/ArchetypeCard.tsx"
Task: "Create PoliticalCompass in app/components/quiz/PoliticalCompass.tsx"

# Then sequentially:
Task: "Implement MatchService in app/services/match.server.ts"
Task: "Implement quiz.tsx route"
Task: "Implement resultado.tsx route"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 Browse Candidates
4. **STOP and VALIDATE**: Can voters browse candidates and view profiles?
5. Complete Phase 4: US2 Quiz Matching
6. **STOP and VALIDATE**: Can voters take quiz and see results?
7. Deploy MVP with core candidate browsing + quiz matching

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 Browse Candidates → Test → Deploy (basic value)
3. US2 Quiz Matching → Test → Deploy (core differentiator)
4. US3 Search & Filter → Test → Deploy (power users)
5. US4 Spending → Test → Deploy (financial transparency)
6. US5 Voting Records → Test → Deploy (legislative accountability)
7. US6 Static Content → Test → Deploy (education/trust)
8. US7 Newsletter → Test → Deploy (retention)
9. Polish → Final deployment

### Suggested MVP Scope

**Phase 1 + 2 + 3 + 4** (Setup + Foundational + US1 + US2) = **30 tasks**

This delivers the two P1 stories: candidate browsing and quiz matching — the core platform value proposition.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same phase
- [Story] label maps task to specific user story for traceability
- All text content must be in Portuguese (pt-BR)
- Bias mitigation: no color-coded stances, randomized candidate order, source attribution on all positions
- Senado API quirk: returns 404 for empty data categories — handle in error logic (research.md section 3)
- Bill ID format: always prefixed `camara-{id}` or `senado-{id}` to prevent collisions
- CandidatePosition stance: 0=unknown, 1-5=Likert scale (NOT -1/0/+1)
- Quiz uses Euclidean distance with uncertainty_penalty=0.4 (NOT cosine similarity)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
