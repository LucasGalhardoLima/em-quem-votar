# Research: Platform Rebuild for 2026 Presidential Elections

**Branch**: `001-platform-rebuild-2026` | **Date**: 2026-02-18

## 1. TSE Data Sources for Presidential Candidates

### Decision: Use TSE DivulgaCandContas API + Open Data Portal CSV fallback

**Rationale**: The TSE provides two main data channels:

1. **DivulgaCandContas API** (real-time during election period)
   - Base URL: `https://divulgacandcontas.tse.jus.br/divulga/rest/v2/`
   - Swagger: `https://divulgacandcontas.tse.jus.br/divulga/rest/swagger-ui.html`
   - Key endpoints:
     - `GET /v2/eleicoes/findAll` — List all available elections by year/type
     - `GET /v2/candidatos/listar/{eleicaoId}/{ufId}/{cargo}` — List candidates by state and office
     - `GET /v2/candidatos/findByCandidatura/{eleicaoId}/{ufId}/{cargoId}/{candidaturaId}` — Candidate detail
     - `GET /v2/candidatos/foto/{eleicaoId}/{sqcandidato}` — Candidate photo
     - `GET /v2/bens/findByIdCandidatura/{candidaturaId}` — Declared assets
     - `GET /v2/receitas/findByIdCandidatura/{candidaturaId}` — Campaign revenue
     - `GET /v2/despesas/findByIdCandidatura/{candidaturaId}` — Campaign spending
   - Data fields: `nomeCompleto`, `nomeUrna`, `partido.sigla`, `coligacao`, `fotoUrl`, `situacaoCandidatura`, `totalDespesa`, `totalReceita`, `numero` (ballot number)
   - **Availability**: Only active after registration opens (~August 2026). Before that, 2026 `eleicaoId` doesn't exist.
   - **Auth**: Public, no API key needed. No official rate limits, but safe rate is ~2 req/sec with 500ms delay. Use bulk CSV for initial seeding.

2. **TSE Open Data Portal** (`dadosabertos.tse.jus.br`)
   - CSV datasets for historical elections (1945-present)
   - Relevant datasets: `consulta_cand` (candidates), `prestacao_contas` (campaign finance), `bem_candidato` (declared assets)

**Alternatives Considered**:
- Scraping TSE website → Rejected: fragile, violates ToS
- Only CSV downloads → Rejected: not real-time enough for active election period

### Decision: Hybrid approach — Manual seeding pre-registration, API sync post-registration

**Rationale**: Presidential candidate registration opens ~August 2026. Before that:
- Pre-candidates are announced via party conventions (June-August)
- We need to seed candidate data manually from news/party announcements
- After TSE registration opens, sync with DivulgaCandContas API

**Pre-registration data model**:
- `registrationStatus`: `"pre-candidate" | "registered" | "approved" | "rejected" | "withdrawn"`
- Manual fields: name, party, photo, political positions
- API-synced fields: TSE ID, official registration data, campaign finance

### API Authentication: None required (public API), no documented rate limits

**Note**: The TSE API is historically unreliable under load (election day). Implement aggressive caching (1-hour TTL for candidate data, 24-hour for historical).

## 2. Election Timeline 2026

| Date | Event |
|------|-------|
| Feb-May 2026 | Pre-campaign period — party alliances forming |
| June 2026 | Party conventions begin |
| Aug 5, 2026 (est.) | Candidate registration deadline |
| Aug 16, 2026 (est.) | Official campaign start |
| Oct 4, 2026 | **First round** |
| Oct 25, 2026 | **Second round** (if needed) |

**Platform timeline implications**:
- **Now (Feb 2026)**: Build with manual candidate data seeding
- **June 2026**: Add party convention tracking
- **August 2026**: Switch to TSE API sync
- **October 2026**: Peak traffic — performance critical

## 3. Legislative Voting Records (Câmara + Senado)

### Decision: Extend existing Câmara integration + add Senado API

**Câmara dos Deputados API** (already in use):
- Base URL: `https://dadosabertos.camara.leg.br/api/v2`
- Key endpoints:
  - `GET /deputados` — List deputies (filter by nome, siglaPartido, siglaUf)
  - `GET /deputados/{id}/votacoes` — Deputy's votes
  - `GET /deputados/{id}/despesas` — CEAP spending
  - `GET /votacoes/{id}/votos` — All votes on a specific bill
  - `GET /proposicoes/{id}` — Bill details
- No auth required. Rate limit: ~300 req/min (undocumented, observed).

**Senado Federal API** (new):
- Base URL: `https://legis.senado.leg.br/dadosabertos/`
- Documentation: `https://legis.senado.leg.br/dadosabertos/docs/`
- Key endpoints:
  - `GET /senador/lista/atual` — Current senators (81 total)
  - `GET /senador/{codigo}` — Senator profile (uses `CodigoParlamentar`)
  - `GET /senador/{codigo}/votacoes` — Senator's votes
  - `GET /senador/{codigo}/despesas` — CEAPS spending
  - `GET /materia/{codigo}` — Bill details (called "matéria", not "proposição")
  - `GET /plenario/votacao/{codigo}/votos` — Individual votes on a session
- Response format: XML by default, JSON with `Accept: application/json` header
- No auth required. Safe rate: 2-3 req/sec
- **Quirk**: Returns 404 for senators with no data in a category (e.g., no expenses), not an empty array — handle in error logic
- **ID collision prevention**: Bill IDs must be prefixed: `"camara-{proposicaoId}-{votacaoId}"` and `"senado-{codigoMateria}-{codigoVotacao}"`

### Decision: Create a unified `PoliticalRecord` abstraction

**Rationale**: Presidential candidates may come from Câmara, Senado, governorships, or have no legislative record. We need a unified interface:

```typescript
interface PoliticalRecord {
  sourceType: "camara" | "senado" | "manual";
  sourceId: string; // Câmara deputado ID or Senado senador code
  votes: VoteRecord[];
  spending: SpendingRecord[];
}
```

**Cross-referencing challenge**: No official mapping between TSE candidate IDs and Câmara/Senado IDs. Solution: manual mapping table (`CandidateLegislativeLink`) maintained by admin, potentially assisted by name+party matching heuristic.

## 4. Spending Data Sources

### Decision: Three-tier spending data

| Tier | Source | Available For |
|------|--------|---------------|
| CEAP (Cota Parlamentar) | Câmara/Senado APIs | Current/former legislators |
| Campaign Finance | TSE DivulgaCandContas | All registered candidates (post-registration) |
| Declared Assets | TSE DivulgaCandContas | All registered candidates (post-registration) |

**CEAP data fields**: `tipoDespesa`, `valorDocumento`, `valorLiquido`, `dataDocumento`, `fornecedor`

**Campaign finance fields**: `totalReceitas`, `totalDespesas`, per-category breakdowns

## 5. Quiz Matching System Redesign

### Decision: Build a separate presidential quiz with 5-point Likert scale and 20 questions

**Rationale**: The current 9-question binary system is well-suited for deputados (binary vote records, hundreds of politicians, tags grounded in real legislative actions). Presidential elections are fundamentally different:
- Candidates come from varied backgrounds (legislators, governors, outsiders) with varying data completeness
- Questions need to cover **presidential-level** topics across 5 thematic axes
- Need more granularity: **5-point Likert scale** (Concordo Totalmente / Concordo / Neutro / Discordo / Discordo Totalmente)
- 20 questions (~7 min) is the sweet spot for completion rate vs. accuracy (academic studies show drop-off above 8-10 min)

**Thematic axes (4 questions each)**:

| Axis | Topics |
|------|--------|
| 1. Economia e Fiscal | Privatização, Reforma Tributária, Bolsa Família, política de juros |
| 2. Segurança Pública | Armamento civil, política de drogas, policiamento, sistema prisional |
| 3. Meio Ambiente e Agro | Desmatamento, créditos de carbono, política agrícola, demarcação FUNAI |
| 4. Direitos e Costumes | Direitos LGBTQIA+, aborto, educação de gênero, liberdade religiosa |
| 5. Democracia e Institucional | Sistema eleitoral, STF independência, regulação de mídia/IA, papel militar |

### Decision: Use Euclidean distance with neutral imputation for matching

**Current algorithm**: Tag-based scoring (sum of matching tag weights)
- Pro: Simple, fast, transparent
- Con: Doesn't handle candidates with few/no tags; binary-only

**New algorithm**: Position-aware Euclidean distance
- Each candidate has a position on each topic: scored on a 5-point scale
- User quiz produces a comparable vector
- Distance formula: `|user_score - candidate_score| / max_distance` per question
- For missing candidate positions: apply `uncertainty_penalty = 0.4` (candidate gets partial credit, not full credit for seeming neutral)
- Display a **data completeness score** alongside each match: "Baseado em 15 de 20 perguntas"

**Why Euclidean over Cosine Similarity**:
- Cosine similarity produces counterintuitive scores when most positions are near the centre (common in Brazilian politics)
- Euclidean distance is more interpretable for a consumer product
- Handles sparse data well with the imputation strategy

**Alternatives Considered**:
- Cosine similarity → Rejected: counterintuitive center-clustering scores
- Manhattan distance → Rejected: no clear advantage
- Keep tag scoring → Rejected: doesn't handle variable data completeness across candidates
- Directional matching → Rejected: favors extremist candidates empirically

### Decision: Maintain archetypes, map to 2D political compass

The 6 existing archetypes map to a **2D compass** (economic axis + social axis):
- "O Liberal" → economic-right / social-libertarian
- "O Estatista" → economic-left
- "O Conservador" → social-authoritarian / economic-right
- "O Progressista" → social-libertarian / economic-left
- "O Pragmático" → center
- "O Fiscal" → economic-right / center-social

The compass visualization replaces the radar chart for the presidential quiz results.

### Decision: Per-axis importance weighting

Allow users to mark which thematic axes matter most to them (5 axes with a "Muito importante / Importante / Pouco importante" toggle). This is the single highest-ROI feature per academic research (Garzia & Marschall, 2014). It adjusts the distance weights without adding per-question friction.

### Decision: Candidate position sourcing pipeline

| Priority | Source | Coverage | Reliability |
|----------|--------|----------|-------------|
| 1 | Legislative voting records | Legislator-candidates | Highest (API-backed) |
| 2 | Party platform document | Most candidates | Medium |
| 3 | Candidate website/program | Major candidates | High |
| 4 | Press interviews | Major candidates | High (with caveats) |
| 5 | TSE ENECON questionnaire | All registered | Medium (self-report) |
| 6 | Researcher coding | All | Variable |

**Party-level fallback**: If a candidate has no stated position, use their party's official position (with clear disclosure). This reduces missing data without fabricating individual positions.

## 6. Bias Mitigation Strategy

### Decision: Equal visual weight + randomized display order + source attribution

**Principles**:
1. **No color-coded positions**: Don't use green/red for agree/disagree
2. **Randomized candidate order**: Default sort is randomized, not alphabetical (which could favor certain names)
3. **Source attribution required**: Every claim linked to a source
4. **Neutral framing**: Quiz questions must present both sides equally (already done in current system)
5. **No editorial summaries**: Only factual descriptions of positions

**Quiz bias mitigation**:
- Questions reviewed by at least 2 independent reviewers
- Option A and B positions randomized per user session
- No leading language in question text

## 7. Architecture Decision: Rebuild vs Refactor

### Decision: Evolutionary rebuild — new data model, preserve working patterns

**What to keep**:
- React Router v7 SSR architecture
- Prisma + Supabase PostgreSQL
- Shadcn/ui + Tailwind design system
- Zustand for client state
- MDX for static content
- Service layer pattern (routes → loaders → services → Prisma)
- Streaming with Suspense + Await

**What to rebuild**:
- Database schema: new `Candidate` model replacing `Politician` as primary entity
- Services: new `CandidateService`, `PositionService`, refactored `MatchService`
- Quiz questions and tag system: expanded for presidential topics
- All route pages: new design, new data structures
- Admin interface: new candidate management + position tagging workflow

**What to migrate as-is**:
- All MDX content files (educacao, FAQ, sobre, etc.)
- Newsletter system
- OG image generation (adapt for candidates)
- Sitemap generation
- Rate limiting

**Alternatives Considered**:
- Full greenfield rewrite → Rejected: loses proven patterns, higher risk
- In-place refactor only → Rejected: schema changes too fundamental, would create tech debt
