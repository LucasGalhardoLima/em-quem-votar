# Data Model: Platform Rebuild 2026

**Branch**: `001-platform-rebuild-2026` | **Date**: 2026-02-18

## Entity Relationship Overview

```
Candidate ──1:N──> CandidatePosition ──N:1──> PoliticalTopic
Candidate ──1:N──> CandidateTag (via join)──N:1──> Tag
Candidate ──1:1──> CandidateLegislativeLink (optional)
Candidate ──1:N──> SpendingRecord
Candidate ──1:N──> VoteRecord ──N:1──> Bill

Bill ──1:N──> VoteRecord
Tag ──N:M──> Candidate (via CandidateTag)
PoliticalTopic ──1:N──> QuizQuestion
```

## Models

### Candidate (replaces Politician as primary entity)

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID, PK) | Internal identifier |
| `name` | String | Full name |
| `displayName` | String | Campaign/popular name |
| `party` | String | Party abbreviation (e.g., "PT", "PL") |
| `coalition` | String? | Coalition name if applicable |
| `photoUrl` | String? | Profile photo URL |
| `biography` | String? @db.Text | Brief biography (2-3 sentences) |
| `registrationStatus` | Enum | `PRE_CANDIDATE`, `REGISTERED`, `APPROVED`, `REJECTED`, `WITHDRAWN` |
| `tseId` | String? (unique) | TSE DivulgaCandContas candidate ID |
| `electionType` | String | `"presidential"` (extensible for future elections) |
| `number` | Int? | Electoral number (urna) |
| `createdAt` | DateTime | Auto |
| `updatedAt` | DateTime | Auto |

**Relations**: `positions`, `tags`, `legislativeLink`, `spendingRecords`, `votes`

**Indexes**: `name`, `party`, `registrationStatus`, `tseId` (unique), `electionType`

**Validation**:
- `name` required, min 2 chars
- `party` required, 2-20 chars
- `registrationStatus` must be valid enum value

---

### PoliticalTopic

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID, PK) | |
| `name` | String | Topic name (e.g., "Privatização") |
| `category` | String | Category (e.g., "Economia", "Segurança", "Meio Ambiente") |
| `slug` | String (unique) | URL-friendly slug |
| `description` | String? | Brief explanation of the topic |
| `order` | Int | Display order within category |

**Relations**: `positions`, `quizQuestions`

---

### CandidatePosition

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID, PK) | |
| `candidateId` | String (FK) | Reference to Candidate |
| `topicId` | String (FK) | Reference to PoliticalTopic |
| `stance` | Int | `1` (strongly against) to `5` (strongly in favor), `0` = unknown |
| `description` | String? @db.Text | Explanation of position in plain language |
| `sourceType` | Enum | `PLATFORM`, `PUBLIC_STATEMENT`, `VOTE_RECORD`, `INTERVIEW`, `MANUAL` |
| `sourceUrl` | String? | Link to source |
| `sourceDate` | DateTime? | When the position was stated |
| `confidence` | Float? | AI confidence (0-100) if AI-classified |
| `approvedAt` | DateTime? | Admin approval timestamp |
| `createdAt` | DateTime | Auto |
| `updatedAt` | DateTime | Auto |

**Indexes**: Unique `[candidateId, topicId]`

**Validation**:
- `stance` must be 0-5 (0 = unknown, 1-5 = Likert scale)
- `sourceType` required
- `sourceUrl` required if `sourceType` is not `MANUAL`

---

### Tag (preserved from existing, expanded)

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID, PK) | |
| `name` | String | Display name (e.g., "Privatista") |
| `category` | String | Category grouping |
| `slug` | String (unique) | URL-friendly slug |
| `description` | String? | What this tag means |

**Relations**: `candidates` (via CandidateTag)

---

### CandidateTag (many-to-many join)

| Field | Type | Description |
|-------|------|-------------|
| `candidateId` | String (FK) | |
| `tagId` | String (FK) | |

**Composite PK**: `[candidateId, tagId]`

---

### CandidateLegislativeLink

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID, PK) | |
| `candidateId` | String (FK, unique) | One-to-one with Candidate |
| `sourceType` | Enum | `CAMARA`, `SENADO` |
| `sourceId` | String | Câmara deputado ID or Senado senador code |
| `legislaturePeriod` | String? | E.g., "2023-2027" |

**Indexes**: Unique `[sourceType, sourceId]`

---

### Bill (preserved, minor additions)

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (PK) | Prefixed: `"camara-{proposicaoId}-{votacaoId}"` or `"senado-{codigoMateria}-{codigoVotacao}"` |
| `title` | String | Official title |
| `description` | String? | |
| `simplifiedTitle` | String? | AI-generated plain-language title |
| `simplifiedDescription` | String? @db.Text | AI-generated explanation |
| `voteSimDetails` | String? | What a SIM vote means |
| `voteNaoDetails` | String? | What a NÃO vote means |
| `voteDate` | DateTime | |
| `status` | String | `"pending"`, `"approved"`, `"rejected"` |
| `sourceUrl` | String? | Link to official source |
| `sourceType` | String | `"camara"`, `"senado"` |
| `aiConfidence` | Float? | |
| `suggestedTagSim` | String? | |
| `suggestedTagNao` | String? | |
| `suggestedCategory` | String? | |
| `approvedAt` | DateTime? | |
| `lastSyncAt` | DateTime? | |
| `createdAt` | DateTime | Auto |
| `updatedAt` | DateTime | Auto |

---

### VoteRecord (replaces VoteLog, adds source awareness)

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID, PK) | |
| `candidateId` | String (FK) | |
| `billId` | String (FK) | |
| `voteType` | String | `"Sim"`, `"Não"`, `"Abstenção"`, `"Obstrução"` |
| `sourceType` | String | `"camara"`, `"senado"` |

**Indexes**: Unique `[candidateId, billId]`

---

### SpendingRecord

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID, PK) | |
| `candidateId` | String (FK) | |
| `type` | Enum | `CEAP`, `CAMPAIGN`, `DECLARED_ASSETS` |
| `amount` | Decimal | Total amount in BRL |
| `periodStart` | DateTime | Period start |
| `periodEnd` | DateTime | Period end |
| `category` | String? | Spending category (e.g., "Passagens Aéreas") |
| `source` | String | Data source (e.g., "Câmara dos Deputados", "TSE") |
| `sourceUrl` | String? | Link to source |
| `createdAt` | DateTime | Auto |

**Indexes**: `[candidateId, type]`

---

### QuizQuestion (moved from static data to database)

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID, PK) | |
| `text` | String | Question text in Portuguese |
| `topicId` | String (FK) | Related PoliticalTopic |
| `order` | Int | Display order |
| `isActive` | Boolean | Whether question is used in current quiz |

---

### QuizOption

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID, PK) | |
| `questionId` | String (FK) | |
| `label` | String | Option text |
| `description` | String? | Brief explanation |
| `stanceValue` | Int | `1` (strongly against) to `5` (strongly in favor) on the Likert scale |
| `order` | Int | Display order |
| `icon` | String? | Lucide icon name |

---

### Subscriber (preserved)

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID, PK) | |
| `email` | String (unique) | |
| `createdAt` | DateTime | Auto |

---

### UserProfile (preserved)

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID, PK) | Supabase Auth ID |
| `email` | String (unique) | |
| `name` | String? | |
| `photoUrl` | String? | |
| `quizAnswers` | Json? | Stored quiz responses |
| `politicalVector` | Json? | Computed position vector |
| `createdAt` | DateTime | Auto |
| `updatedAt` | DateTime | Auto |

---

## State Transitions

### Candidate Registration Status

```
PRE_CANDIDATE → REGISTERED → APPROVED
                           → REJECTED
              → WITHDRAWN (from any state)
```

### Bill Status

```
pending → approved → (displayed on platform)
        → rejected → (hidden from public)
```

### CandidatePosition Approval

```
created (no approvedAt) → approved (approvedAt set) → displayed publicly
```

## Migration Strategy

1. Create new models (`Candidate`, `CandidatePosition`, `PoliticalTopic`, etc.) alongside existing
2. Write migration script to map existing `Politician` → `Candidate` for any relevant records
3. Keep `Politician` model temporarily for backwards compatibility
4. Remove `Politician` model once all references are updated
