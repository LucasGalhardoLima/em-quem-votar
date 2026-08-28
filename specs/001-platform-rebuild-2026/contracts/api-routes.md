# API Routes & Loader Contracts

**Branch**: `001-platform-rebuild-2026` | **Date**: 2026-02-18

All data fetching uses React Router `loader()` functions (server-side). No REST API endpoints exposed publicly — all routes are SSR pages with server loaders.

## Page Routes & Loaders

### `/` — Homepage

**Loader**: `homeLoader`
```typescript
// Returns
{
  featuredCandidates: Promise<Candidate[]>;  // Top 4-6 candidates (deferred)
  recentArticles: Article[];                  // Latest 4 articles
  electionCountdown: { daysUntil: number; nextEvent: string };
}
```

### `/candidatos` — Candidate Listing (replaces `/busca`)

**Loader**: `candidatosLoader`
```typescript
// URL params: ?q=name&party=PT,PL&topic=economia&stance=favor
// Returns
{
  candidates: Promise<{
    items: CandidateListItem[];
    total: number;
  }>;
  filters: {
    parties: string[];
    topics: { slug: string; name: string; category: string }[];
  };
}

interface CandidateListItem {
  id: string;
  name: string;
  displayName: string;
  party: string;
  coalition: string | null;
  photoUrl: string | null;
  registrationStatus: string;
  tags: { name: string; slug: string; category: string }[];
  positionCount: number;  // How many positions have been mapped
}
```

### `/candidato/:id` — Candidate Profile (replaces `/politico/:id`)

**Loader**: `candidatoLoader`
```typescript
// Returns
{
  candidate: {
    id: string;
    name: string;
    displayName: string;
    party: string;
    coalition: string | null;
    photoUrl: string | null;
    biography: string | null;
    registrationStatus: string;
    number: number | null;
    positions: {
      topicName: string;
      topicCategory: string;
      topicSlug: string;
      stance: 0 | 1 | 2 | 3 | 4 | 5;  // 0=unknown, 1-5 Likert
      description: string | null;
      sourceType: string;
      sourceUrl: string | null;
      sourceDate: string | null;  // ISO string
    }[];
    tags: { name: string; slug: string; category: string }[];
    spending: {
      type: string;  // "CEAP" | "CAMPAIGN" | "DECLARED_ASSETS"
      totalAmount: number;
      period: string;
      source: string;
    }[];
    votes: {
      id: string;
      voteType: string;
      bill: {
        id: string;
        title: string;
        simplifiedTitle: string | null;
        simplifiedDescription: string | null;
        voteDate: string;  // ISO string
        voteSimDetails: string | null;
        voteNaoDetails: string | null;
      };
    }[];
    hasLegislativeRecord: boolean;
  } | null;
}
```
**Cache**: `Cache-Control: public, max-age=3600, s-maxage=86400`

### `/quiz` — Quiz Page

**Loader**: `quizLoader`
```typescript
// Returns
{
  questions: {
    id: string;
    text: string;
    topicSlug: string;
    topicName: string;
    options: {
      id: string;
      label: string;
      description: string | null;
      stanceValue: number;  // 1-5 Likert scale
      icon: string | null;
    }[];
  }[];
  totalQuestions: number;
}
```

### `/resultado` — Quiz Results (replaces `/resultado`)

**Loader**: `resultadoLoader`
```typescript
// URL params: ?v=topicSlug:stance,topicSlug:stance,...
// Returns
{
  results: Promise<{
    topCandidates: {
      candidate: CandidateListItem;
      matchPercentage: number;
      matchedPositions: {
        topicName: string;
        userStance: number;
        candidateStance: number;
        agreement: boolean;
      }[];
      categoryScores: { category: string; score: number }[];
    }[];
    archetype: {
      id: string;
      name: string;
      description: string;
      gradient: [string, string];
    };
    metadata: {
      matchStrength: "strong" | "moderate" | "weak";
      dominantCategories: string[];
      totalCandidatesEvaluated: number;
    };
  }>;
}
```

### `/comparar` — Candidate Comparison (replaces `/comparar`)

**Loader**: `compararLoader`
```typescript
// URL params: ?ids=uuid1,uuid2,uuid3
// Returns
{
  candidates: Promise<{
    id: string;
    name: string;
    displayName: string;
    party: string;
    photoUrl: string | null;
    positions: Record<string, { stance: number; description: string | null }>;
    spending: { type: string; totalAmount: number }[];
    votes: Record<string, string>;  // billId → voteType
  }[]>;
  topics: { slug: string; name: string; category: string }[];
  featuredBills: { id: string; title: string; voteDate: string }[];
}
```

### `/votacoes` — Voting Records List

**Loader**: `votacoesLoader`
```typescript
// URL params: ?q=search&source=camara|senado
// Returns
{
  bills: {
    id: string;
    title: string;
    simplifiedTitle: string | null;
    voteDate: string;  // ISO
    status: string;
    sourceType: string;
  }[];
}
```

### `/votacao/:id` — Vote Detail

**Loader**: `votacaoLoader`
```typescript
// Returns
{
  bill: Promise<{
    id: string;
    title: string;
    simplifiedTitle: string | null;
    simplifiedDescription: string | null;
    voteDate: string;
    voteSimDetails: string | null;
    voteNaoDetails: string | null;
    sourceUrl: string | null;
    sourceType: string;
    votes: {
      candidateId: string;
      candidateName: string;
      candidateParty: string;
      candidatePhotoUrl: string | null;
      voteType: string;
    }[];
    summary: { sim: number; nao: number; abstencao: number; obstrucao: number };
  }>;
}
```

### `/educacao` — Education Articles Index

**Loader**: `educacaoLoader`
```typescript
{ articles: Article[] }
```

### `/educacao/:slug` — MDX Article Pages

No loader change — MDX routes are static.

### `/sobre`, `/faq`, `/metodologia` — Static Pages

MDX routes — no loader changes needed.

### `/api/newsletter` — Newsletter API (resource route) — DROPPED 2026-08-28

**Action**: `POST`
```typescript
// Request body
{ email: string }

// Response
{ success: boolean; message: string }
```

### `/admin` — Admin Dashboard

**Loader**: `adminLoader`
```typescript
{
  stats: {
    totalCandidates: number;
    positionsApproved: number;
    positionsPending: number;
    billsApproved: number;
    billsPending: number;
  };
  pendingPositions: CandidatePosition[];
  pendingBills: Bill[];
}
```

### `/admin/candidato/:id` — Admin Candidate Editor

**Loader + Action**: Full CRUD for candidate data, positions, tags, legislative link.

### `/admin/votacao/:id` — Admin Vote Approval (preserved)

Same as current, adapted for `Candidate` instead of `Politician`.

### `/resources/og/:id` — OG Image Generation

Same pattern, adapted for candidate data.

### `/sitemap.xml` — Sitemap

Updated to include `/candidatos`, `/candidato/:id` routes.

## Service Layer Contracts

### `CandidateService` (replaces `PoliticianService`)

```typescript
interface CandidateService {
  list(params: { query?, party?, topic?, stance?, limit?, offset? }): Promise<{ items, total }>;
  getById(id: string): Promise<CandidateDetail | null>;
  getFilters(): Promise<{ parties, topics }>;
  listForComparison(ids: string[]): Promise<CandidateComparison[]>;
  findAllForMatch(): Promise<CandidateMatchData[]>;
  listAllIds(): Promise<{ id, updatedAt }[]>;
  // Admin
  create(data): Promise<Candidate>;
  update(id, data): Promise<Candidate>;
  delete(id): Promise<void>;
}
```

### `PositionService` (new)

```typescript
interface PositionService {
  listByCandidate(candidateId: string): Promise<CandidatePosition[]>;
  listByTopic(topicSlug: string): Promise<CandidatePosition[]>;
  create(data): Promise<CandidatePosition>;
  approve(id: string): Promise<CandidatePosition>;
  // AI-assisted
  classifyFromSource(candidateId, sourceUrl): Promise<SuggestedPosition>;
}
```

### `MatchService` (refactored)

```typescript
interface MatchService {
  calculate(userVector: Record<string, number>): Promise<{
    topCandidates: MatchResult[];
    archetype: Archetype;
    metadata: MatchMetadata;
  }>;
}
```

### `SpendingService` (new)

```typescript
interface SpendingService {
  getByCandidate(candidateId: string): Promise<SpendingRecord[]>;
  syncFromCamara(candidateId: string, deputadoId: string): Promise<void>;
  syncFromTSE(candidateId: string, tseId: string): Promise<void>;
}
```

### `BillService` (preserved, extended)

```typescript
interface BillService {
  getById(id: string): Promise<BillDetail | null>;
  listApproved(params: { query?, source?, limit? }): Promise<Bill[]>;
  listFeatured(ids: string[]): Promise<BillSummary[]>;
}
```
