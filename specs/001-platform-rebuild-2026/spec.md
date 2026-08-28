# Feature Specification: Platform Rebuild for 2026 Brazilian Elections

**Feature Branch**: `001-platform-rebuild-2026`
**Created**: 2026-02-18
**Status**: Draft
**Input**: Rebuild the platform from the ground up focusing on 2026 Brazilian elections (especially presidential), maintaining existing static content, with unbiased candidate information, spending data, voting records, search, and quiz matching.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Presidential Candidates (Priority: P1)

A voter visits the platform to explore all registered presidential candidates for the 2026 elections. They can see each candidate's political positions organized by category (economy, social policy, security, environment, etc.), presented in a neutral, side-by-side format without editorial bias. Each position includes source attribution (official platform, public statements, or voting record).

**Why this priority**: The core value proposition — informing voters about who is running and what they stand for. Without this, the platform has no purpose.

**Independent Test**: Can be fully tested by navigating to the candidates listing page, viewing candidate profiles, and verifying that political positions are displayed with sources. Delivers the fundamental value of political transparency.

**Acceptance Scenarios**:

1. **Given** a voter on the homepage, **When** they click "Candidatos" or navigate to the candidates page, **Then** they see all presidential candidates with photo, name, party, coalition, and a brief political summary.
2. **Given** a voter viewing a candidate profile, **When** they scroll through the positions section, **Then** they see positions organized by category with source citations and "last updated" timestamps.
3. **Given** a voter on the candidates listing, **When** no candidates are registered yet (pre-registration period), **Then** they see a clear message explaining the election timeline and when candidates will be available.
4. **Given** a voter viewing any political data, **When** they look for bias indicators, **Then** all positions are presented factually with equal visual weight — no color coding suggesting "good" or "bad" positions.

---

### User Story 2 - Quiz Matching System (Priority: P1)

A voter who doesn't know which candidate aligns with their values takes a quiz. The quiz presents questions about key political topics (economy, social policy, security, environment, digital rights, government spending) and matches them to candidates based on alignment. The result shows a ranked list with match percentage, category breakdown, and a political archetype.

**Why this priority**: This is the platform's differentiator — active engagement that converts passive visitors into informed voters. Co-equal with P1 because it drives the core user journey.

**Independent Test**: Can be tested end-to-end by completing the quiz flow and verifying match results are calculated correctly against known candidate positions.

**Acceptance Scenarios**:

1. **Given** a voter starting the quiz, **When** they answer all questions, **Then** they are redirected to a results page showing their top candidate matches with percentages.
2. **Given** quiz results, **When** a voter views their top match, **Then** they see a radar chart comparing their preferences to the candidate's positions across categories.
3. **Given** quiz results, **When** a voter clicks on a matched candidate, **Then** they navigate to that candidate's full profile.
4. **Given** a voter on the homepage, **When** they see the quiz CTA, **Then** it clearly explains what the quiz does and how long it takes (estimated time).

---

### User Story 3 - Candidate Search & Filtering (Priority: P2)

A voter searches for candidates by name, party, coalition, or political position. They can filter candidates by category of political stance and compare up to 3 candidates side-by-side.

**Why this priority**: Important for users who already have candidates in mind but want to compare or verify information. Secondary to browsing/quiz because it serves a narrower use case.

**Independent Test**: Can be tested by searching for a candidate by name, applying filters, and verifying search results are accurate and relevant.

**Acceptance Scenarios**:

1. **Given** a voter on the search page, **When** they type a candidate name, **Then** results filter in real-time showing matching candidates.
2. **Given** a voter using filters, **When** they select a political position filter (e.g., "Privatização"), **Then** only candidates matching that position are shown.
3. **Given** a voter selecting 2-3 candidates for comparison, **When** they click "Comparar", **Then** they see a side-by-side table with positions, spending, and key votes.

---

### User Story 4 - Spending & Financial Transparency (Priority: P2)

A voter views a candidate's financial information: campaign spending (when available from TSE data), historical government spending (for candidates who held office — CEAP, verba de gabinete), and declared assets. All data is sourced from official government APIs and databases.

**Why this priority**: Financial transparency is a key voter concern in Brazil. Co-priority with search because it enriches the candidate profiles but isn't the primary discovery mechanism.

**Independent Test**: Can be tested by viewing a candidate's profile and verifying spending data is displayed with source attribution and proper formatting (BRL currency, time ranges).

**Acceptance Scenarios**:

1. **Given** a voter viewing a candidate who is a current/former deputado, **When** they navigate to the spending section, **Then** they see CEAP spending data with historical trends.
2. **Given** a voter viewing a candidate with no prior office, **When** they look at the spending section, **Then** they see a clear message: "Sem dados de gastos públicos anteriores" with explanation.
3. **Given** any spending data displayed, **When** the voter looks for context, **Then** they see the data source (TSE, Portal da Transparência) and the period covered.

---

### User Story 5 - Voting Record Display (Priority: P2)

For candidates who are current or former legislators (deputados, senadores), the platform displays their voting record on key bills. Each vote includes a simplified explanation of the bill and what a SIM/NÃO vote means in plain language.

**Why this priority**: Voting records are the most objective indicator of a politician's actual stance. Essential for candidates with legislative history.

**Independent Test**: Can be tested by viewing a candidate with voting history and verifying votes are displayed with simplified descriptions and source links.

**Acceptance Scenarios**:

1. **Given** a voter viewing a candidate with voting history, **When** they scroll to the votes section, **Then** they see a chronological list of key votes with simplified titles and SIM/NÃO indicators.
2. **Given** a voter viewing a specific vote, **When** they click for details, **Then** they see the full bill explanation, what each vote direction means, and a link to the official source.
3. **Given** a voter viewing a candidate without legislative history, **When** they look at the votes section, **Then** they see "Sem histórico legislativo" with an explanation of why.

---

### User Story 6 - Static Content & Education (Priority: P3)

All existing educational articles, FAQ, about page, and methodology pages are maintained and brought into the new design. New articles about the 2026 presidential election context are added.

**Why this priority**: Supporting content that enhances trust and education. Lower priority because it's content migration, not new functionality.

**Independent Test**: Can be tested by navigating to each education article, FAQ, and about page, verifying content renders correctly in the new design.

**Acceptance Scenarios**:

1. **Given** a voter navigating to /educacao, **When** the page loads, **Then** all existing articles are listed with their original content intact.
2. **Given** a voter reading an article, **When** the page loads, **Then** the MDX content renders in the new design system with proper typography and responsive layout.
3. **Given** the FAQ page, **When** a voter visits /faq, **Then** all existing questions and answers are displayed in the new design.

---

### User Story 7 - Newsletter & Engagement (Priority: P3)

> **DROPPED 2026-08-28** — Newsletter cut from the product: `app/routes/api.newsletter.ts`, `app/services/newsletter.server.ts` and the `Subscriber` table were removed (the table had 0 rows).
> Kept below as a dated record of what was planned — do not build it.

Voters can subscribe to a newsletter to receive updates about new candidates, voting records, and election timeline updates.

**Why this priority**: Retention mechanism. Lower priority because it's a secondary engagement feature.

**Independent Test**: Can be tested by submitting an email and verifying the subscription is created.

**Acceptance Scenarios**:

1. **Given** a voter on any page with the newsletter form, **When** they enter a valid email and submit, **Then** they see a success toast and the email is stored.
2. **Given** a voter submitting a duplicate email, **When** the form submits, **Then** they see a friendly message "Você já está inscrito!" without error.

---

### Edge Cases

- What happens when TSE candidate registration data is not yet available (pre-registration period)?
- How does the system handle candidates who drop out or change parties during the campaign?
- What happens when a candidate has voting records as both deputado and senador?
- How does the quiz handle candidates with very few known positions?
- What happens when the Câmara or TSE APIs are down?
- How does the system handle candidates with no photo available?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display all registered presidential candidates for 2026 with name, party, coalition, photo, and political summary.
- **FR-002**: System MUST present candidate political positions organized by category without editorial bias — equal visual weight for all stances.
- **FR-003**: System MUST include source attribution (official platform, public statement, voting record) for every political position displayed.
- **FR-004**: System MUST provide a quiz matching system that maps user preferences to candidate alignment with percentage scores and category radar charts.
- **FR-005**: System MUST support candidate search by name, party, and political position with real-time filtering.
- **FR-006**: System MUST support side-by-side comparison of up to 3 candidates.
- **FR-007**: System MUST display spending data (CEAP for legislators, campaign spending from TSE when available) with source attribution.
- **FR-008**: System MUST display voting records for candidates with legislative history, including simplified bill explanations.
- **FR-009**: System MUST maintain all existing static content (articles, FAQ, about, methodology) in the new design.
- **FR-010**: System MUST provide a newsletter subscription mechanism. — DROPPED 2026-08-28
- **FR-011**: System MUST gracefully handle missing data (no photo, no voting record, no spending data) with clear user-facing messages in Portuguese.
- **FR-012**: System MUST be accessible in Portuguese (pt-BR) throughout.
- **FR-013**: System MUST include an admin interface for managing candidate data and approving AI-classified positions.
- **FR-014**: System MUST generate Open Graph images for social media sharing of candidate profiles and quiz results.

### Key Entities

- **Candidate**: Represents a presidential candidate — name, party, coalition, photo, biography summary, registration status, political positions by category.
- **PoliticalPosition**: A candidate's stance on a specific topic — category, description, source type (platform/statement/vote), source URL, confidence level.
- **QuizQuestion**: A question in the matching quiz — topic, options with weighted position effects.
- **Bill**: A legislative vote record (reused from existing schema) — title, description, simplified explanation, vote date.
- **VoteRecord**: A candidate's vote on a bill (for candidates with legislative history).
- **SpendingRecord**: Financial data — type (CEAP/campaign/assets), amount, period, source.
- **Tag**: Political classification tags (reused and expanded from existing schema).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can find any presidential candidate and view their political positions within 3 clicks from the homepage.
- **SC-002**: Quiz completion rate ≥ 70% (users who start the quiz finish it).
- **SC-003**: All candidate data includes source attribution with zero uncited claims.
- **SC-004**: Page load time (LCP) < 2.5s on 4G connections for all pages.
- **SC-005**: Mobile responsiveness: all critical flows functional at 375px viewport width.
- **SC-006**: Zero bias indicators: political positions presented with equal visual weight (verified by editorial review).
- **SC-007**: Test coverage: ≥ 80% for services, ≥ 60% for components with business logic.
