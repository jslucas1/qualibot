# QUALIBOT — Claude Code Context

## Project Overview

QUALIBOT is a two-phase GenAI research tool for qualitative IS (Information Systems) research. It is being built as both a functional research instrument and an academic artifact for submission to the ISR Special Issue on Generative AI and New Methods of Inquiry in IS Research (deadline: September 7, 2026).

The system has two distinct phases that share a session and are not separable:

- **Phase 1 — Instrument Development**: AI methodologist helps a researcher iteratively build a rigorous qualitative interview guide
- **Phase 2 — Interview Execution**: AI interviewer conducts adaptive, structured interviews with research participants using the Phase 1 output

## Status

In development. Next.js scaffold, Prisma schema, auth, and dashboard are built.

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend + API | Next.js | SSR required for session management; responsive layout |
| LLM | Anthropic Claude API | Model: `claude-sonnet-4-6` throughout both phases |
| RAG — Vector DB | Pinecone | Managed, fast, Node.js-friendly |
| RAG — Embeddings | `voyage-3` (Anthropic) | Must match at index and query time — do not change after indexing |
| Database | MySQL + Prisma ORM | Session state, override logs, transcripts, exports |
| Auth | NextAuth v5 (Auth.js) with Resend email provider | Magic-link auth; Clerk was removed due to enterprise endpoint security (ThreatDown) blocking its external domains |
| Participant access | Tokenized links via built-in email delivery | No participant account creation required |
| File export | `pdf-lib` (PDF) + `docx` npm package (Word) | Both required |
| Hosting | Azure | |

---

## Architecture Summary

### Two User Flows Sharing One Session

**Researcher flow (Phase 1):**
Authenticate → create study session → input research context (text or file upload) → iterative AI-methodologist dialogue → approve final guide → Phase 2 unlocked

**Participant flow (Phase 2):**
Researcher generates + emails tokenized participant URL → participant authenticates via token link (no account) → AI-conducted interview → transcript written to DB → researcher views transcripts in real time from dashboard

---

## Phase 1 — Instrument Development

### 6 Sequential Steps (enforced — cannot skip)

1. **Research Context Onboarding** — Research question, theoretical framework + constructs, target population, existing materials (PDF/Word upload supported). All four inputs required before advancing.
2. **Construct Interrogation** — RAG-backed interrogation of each construct's operationalization against IS methodology corpus.
3. **Coverage Assessment** — Evaluates question-to-construct coverage; produces preliminary coverage map. Gaps must be resolved before advancing.
4. **Question Refinement** — Flags leading language, double-barreled questions, jargon, abstraction issues. Every flag must be resolved or overridden with justification.
5. **Probe Development** — Develops construct-specific probes per question (≥2 per question). Probes are passed directly into Phase 2 prompt context.
6. **Final Guide Output** — Produces finalized guide + coverage map; stored in DB; Phase 2 unlocked.

### Phase 1 Prompt Design

- Role: Expert qualitative IS methodologist with access to RAG knowledge base
- Rules: Never skip steps; require justification for overrides; cite retrieved knowledge-base content explicitly; tone is collaborative, not compliance-checklist
- RAG injected at Steps 2, 3, and 4

### Override Logging — Critical Research Data

**This is not optional logging — it is a primary empirical data source for the paper.**

Every researcher override must capture as a structured DB record:
- Original AI flag
- AI recommendation
- Researcher decision
- Researcher's written justification (required before override is accepted)
- Timestamp
- Linked to session and construct

---

## Phase 2 — Interview Execution

### Three-Layer Prompt Architecture

**Layer 1 — Fixed Core Questions (Comparability Anchor)**
Three fixed questions in exact order, populated from Phase 1 output:
1. Behavioral breadth — AI tools used in academic work and how
2. Experiential depth — walk through a specific recent AI use in an assignment (redirect vague responses back to concrete examples)
3. Tension/sensitivity — uncertainty or discomfort about AI use in academic work

**Layer 2 — Silent Context Detection**
During Layer 1, AI silently registers (never announced to participant):
- Academic context (field, type of work)
- Usage profile (tools, intensity)
- Affective signals (ambivalence, justification language)
- Institutional context (course types, instructor attitudes, AI policies)

Rule: AI references only explicitly stated content. No inferences.

**Layer 3 — Adaptive Probing**
After all three core questions, AI probes using four types prioritized by Layer 2 detections:
1. Elaboration — request specificity when examples are lacking
2. Affective — return to affective signal moments with curiosity framing
3. Context-tailored — use participant's stated academic context with Phase 1 probes
4. Contradiction — surface inconsistencies gently

**Behavioral rules (must be in system prompt and pilot-tested):**
- Anti-sycophancy: no evaluative affirmation ("great point", "interesting")
- Anti-leading: no implied expected answers
- Sequencing fidelity: all 3 core questions before probing
- Time awareness: 15-minute target; move to closing if approaching limit
- Withdrawal respect: after 2 minimal responses to a probe, move on

**Fixed closing:** "Is there anything about your experience with AI in your academic work that we have not discussed that you would like to share?"

### Transcript & Session Log Structure

Each participant session stores:
- **Transcript**: array of `{role, content, timestamp, layer_tag}` — layer tags: `core_q1 | core_q2 | core_q3 | probe_elaboration | probe_affective | probe_contextual | probe_contradiction | closing`
- **Session log**: detected Layer 2 context variables, probes deployed + order, total duration, whether closing was reached

Layer tags are essential for the paper's analysis — do not omit them.

---

## RAG Knowledge Base

- **Vector DB**: Pinecone
- **Embeddings**: `voyage-3` — must be consistent between indexing and query time
- **Chunk size**: 400–600 tokens with ~10% overlap
- **Metadata per chunk**: source journal, publication year, content domain, document type (empirical vs. methodology paper)
- **Domain-filtered retrieval**: each Phase 1 step queries only its relevant domain

| Domain | Active At |
|---|---|
| Construct operationalization | Step 2 |
| Coverage assessment | Step 3 |
| Question design principles | Step 4 |
| Probe development | Step 5 |

**Status: Knowledge base source documents not yet assembled.** The research team will supply IS methodology papers (MISQ, ISR). Developer is responsible for chunking, embedding, and indexing once documents are provided.

Retrieve top 3–5 chunks per query, filtered by domain tag, injected into prompt before AI response.

---

## Database Schema (Core Entities)

| Entity | Key Fields |
|---|---|
| Study Session | `session_id`, `researcher_id`, `created_at`, `status` (phase1_in_progress \| phase1_complete \| phase2_active \| complete), `phase1_output` (JSON), `coverage_map` (JSON) |
| Researcher | `researcher_id`, `email`, `name`, `institution`, `created_at` |
| Construct | `construct_id`, `session_id`, `name`, `definition`, `operationalization`, `status` (pending \| approved \| overridden) |
| Override Log | `override_id`, `session_id`, `construct_id`, `flag_text`, `ai_recommendation`, `researcher_decision`, `justification_text`, `timestamp` |
| Interview Guide | `guide_id`, `session_id`, `questions` (JSON array), `probes` (JSON map), `coverage_map` (JSON), `approved_at` |
| Participant Session | `participant_session_id`, `session_id`, `participant_token`, `started_at`, `completed_at`, `transcript` (JSON), `session_log` (JSON) |

---

## Authentication & Access

**Researcher accounts (Clerk):**
- Full registration: email, institution, password, email verification
- Access: session creation, Phase 1 chatbot, Phase 2 dashboard (real-time transcript view), exports, participant URL/email generation

**Participant access:**
- Tokenized link delivered via built-in email (no account creation)
- Token is session-scoped, single-use per participant
- Expires 72 hours after generation or on interview completion
- Access: Phase 2 interview only — no researcher views, no other transcripts

**Privacy / IRB (hard requirement):**
- No PII in participant transcripts — token is the only identifier
- Do NOT collect IP addresses, browser fingerprints, or re-identifying metadata
- This is a research ethics requirement

---

## Exports (All from Researcher Dashboard)

| Export | Format | Contents |
|---|---|---|
| Finalized Interview Guide | PDF + Word (.docx) | Core questions, probe sets, sequencing rationale, coverage map, session ID, approval timestamp |
| Construct Coverage Map | PDF | Visual matrix: construct-to-question alignment, flagged gaps, override count per construct |
| Full Interview Transcripts | PDF per participant + bulk ZIP | Turn-by-turn with timestamps and layer tags; participant token as identifier |
| Session Audit Trail | CSV | Full override log, Phase 1 step timestamps, Phase 2 session metadata; structured for direct analysis software import |

Exports generated on demand (not pre-rendered). Include session ID + generation timestamp in header/filename.

---

## Non-Functional Requirements

| Requirement | Spec |
|---|---|
| Responsiveness | Desktop + tablet required; mobile required for Phase 2 (participants may use phones) |
| API latency | Typing indicator during all Claude API calls — never blank screen |
| Session persistence | Phase 1 sessions survive browser close; researcher can resume without history loss |
| Concurrent participants | Multiple Phase 2 interviews simultaneously per session — no transcript contamination |
| Data retention | All data retained indefinitely unless researcher explicitly deletes |
| Error handling | Claude API failures: user-friendly error + retry option; full request context logged; Phase 1 state must not be lost on failure |
| Browser support | Chrome, Firefox, Safari, Edge — current + one prior major version |

---

## Open Decisions (Resolved)

| Question | Decision |
|---|---|
| Auth provider | NextAuth v5 (Auth.js) — magic-link via Resend. Clerk was dropped: ThreatDown endpoint security blocks Clerk's external auth domains on developer's machine. |
| Participant token delivery | Built-in email delivery (system sends tokenized link) |
| Real-time transcript visibility | Yes — researcher can view participant transcripts in real time during interviews |
| LLM model | `claude-sonnet-4-6` |
| Embedding model | `voyage-3` |
| RAG vector DB | Pinecone |

## Open Decisions (Still Pending)

| Question | Notes |
|---|---|
| Phase 1 session timeout | How long before inactive session requires restart? TBD — propose with rationale |
| RAG chunk size validation | Validate 400–600 token range on sample corpus before full indexing |
| Knowledge base update workflow | Lightweight admin UI vs. CLI for adding new docs post-indexing; TBD |

---

## Academic Context

- **Target venue**: ISR Special Issue — Generative AI and New Methods of Inquiry in IS Research
- **Submission deadline**: September 7, 2026
- **Evaluation design**: Between-subjects — control (conventional instrument dev + chatbot interview) vs. treatment (full pipeline: chatbot instrument dev + chatbot interview)
- **Primary empirical contribution**: Override log data — behavioral trace of researcher deviations from methodological best practice during Phase 1
- **Mediation pathway tested**: Does instrument quality (Phase 1 output) predict interview data quality (Phase 2 output)?

---

## Key Files

- [resources/QUALIBOT_Executive_Summary 1.docx](resources/QUALIBOT_Executive_Summary%201.docx) — Project overview and academic framing
- [resources/QUALIBOT_Technical_Specification.docx](resources/QUALIBOT_Technical_Specification.docx) — Full technical spec (authoritative reference)
