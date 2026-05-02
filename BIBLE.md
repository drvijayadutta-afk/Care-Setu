# Care Setu — Team Bible

> **The single source of truth for what we're building, why, and where we are.**
> **Status table and execution log auto-update on every commit. Don't hand-edit those sections.**
>
> Last manually edited: 2026-05-02 · Owner: Vijaya
> Companion docs: [PRODUCT_PLAN.md](PRODUCT_PLAN.md) · [SOLID refactor plan](~/.claude/plans/jazzy-scribbling-locket.md) · [README.md](README.md)

---

## 1. Vision (one paragraph)

Care Setu is the **operating system for cancer care in India** — a single trusted layer where the patient's full journey lives, the multispecialty team makes decisions together, and rural patients get tier-1 specialist quality without the trip. Three product surfaces sharing one source of truth: **(i)** a patient + family digital caretaker, **(ii)** a clinician decision console, **(iii)** a tumor board / MDT collaboration room. Pan-India urban + rural from Day 1. Patient app free forever; revenue from hospitals and cross-hospital MDT.

---

## 2. Live status (auto-updated)

> **How to read:** ✅ done · 🟨 in-progress · 🟥 blocked · ⬜ pending. The Date and Commit columns fill themselves when a commit lands tagged with the task ID, e.g. `feat: harden JWT secret check [S1]`.

<!-- bible:status:start -->
| ID    | Section | Title                                                       | Status    | Date                 | Commit  | Note                                                   |
| ----- | ------- | ----------------------------------------------------------- | --------- | -------------------- | ------- | ------------------------------------------------------ |
| S1    | Tier 1  | Hard-fail boot on missing/dev JWT secret (typed env loader) | ✅ done    | 2026-05-02 12:40:52Z | 528cf56 | feat: hard-fail boot on missing or dev JWT secret [S1] |
| S2    | Tier 1  | Patient-scope authorization middleware                      | ⬜ pending | —                    | —       | Has 4-step prod migration                              |
| S3    | Tier 1  | Messaging channel abstraction (LSP fix)                     | ⬜ pending | —                    | —       | Closes Bug 1 root cause                                |
| H1    | Tier 2  | Repository layer (DIP) — must precede H2                    | ⬜ pending | —                    | —       | Wraps Prisma 1:1, non-breaking                         |
| H2    | Tier 2  | Split routes.ts by aggregate (SRP)                          | ⬜ pending | —                    | —       | Depends on H1                                          |
| H3    | Tier 2  | AI + Storage ports + 5-min signed URL TTL                   | ⬜ pending | —                    | —       | Closes PHI signed-URL gap                              |
| H4    | Tier 2  | Patient detail page split + record registry (SRP/OCP)       | ⬜ pending | —                    | —       | Independent of backend tiers                           |
| H5    | Tier 2  | Onboarding state machine (SRP + transactional integrity)    | ⬜ pending | —                    | —       | Needs H1 and S3                                        |
| M1    | Tier 3  | Config-driven SSL (replace URL substring match)             | ⬜ pending | —                    | —       | Needs S1 env loader                                    |
| M2    | Tier 3  | Login rate-limit + JWT TTL/role to config                   | ⬜ pending | —                    | —       | Needs S1 env loader                                    |
| M3    | Tier 3  | AI extract review queue (no silent record creation)         | ⬜ pending | —                    | —       | Schema migration                                       |
| M4    | Tier 3  | Split coordinator-app/lib/api.ts (ISP)                      | ⬜ pending | —                    | —       | Falls out of H4                                        |
| P1.1  | Phase 1 | Patient PWA scaffold at app.caresetu.health                 | ⬜ pending | —                    | —       | OTP + WebAuthn                                         |
| P1.2  | Phase 1 | Family invite + consent + scope flow                        | ⬜ pending | —                    | —       | 4 roles incl. CHW                                      |
| P1.3  | Phase 1 | Clinician console role-aware views (Coord/Onc/Nurse)        | ⬜ pending | —                    | —       | —                                                      |
| P1.4  | Phase 1 | MDT room MVP (sync + auto-brief)                            | ⬜ pending | —                    | —       | Daily.co video                                         |
| P1.5  | Phase 1 | HL7 FHIR adapter for one partner HIS                        | ⬜ pending | —                    | —       | —                                                      |
| P1.6  | Phase 1 | ABHA identity integration (now Phase 1 per v2)              | ⬜ pending | —                    | —       | Sandbox first                                          |
| P1.7  | Phase 1 | IVR + SMS access modes (Exotel)                             | ⬜ pending | —                    | —       | Voice persona                                          |
| P1.8  | Phase 1 | Pictogram + voice-first symptom UI                          | ⬜ pending | —                    | —       | Bhasini TTS                                            |
| P1.9  | Phase 1 | Audit log middleware + table                                | ⬜ pending | —                    | —       | Append-only                                            |
| P1.10 | Phase 1 | Onboarding playbook (white-glove)                           | ⬜ pending | —                    | —       | —                                                      |
| O1    | Org     | Engage healthcare lawyer (DPDP gap analysis)                | ⬜ pending | —                    | —       | 2-3 candidates by W3                                   |
| O2    | Org     | Sign 2 urban pilot hospitals MOU                            | ⬜ pending | —                    | —       | Tier-1 + tier-2                                        |
| O3    | Org     | Sign 1 rural NGO partnership (St. Jude / Karkinos / ICS)    | ⬜ pending | —                    | —       | Hub-and-spoke pilot                                    |
| O4    | Org     | Shadow 5 oncologists; baseline case-prep + MDT-prep time    | ⬜ pending | —                    | —       | The "irresistible" KPI                                 |
| O5    | Org     | First weekly architecture review with pilot hospital tech   | ⬜ pending | —                    | —       | —                                                      |
| O6    | Org     | Publish v2 PRODUCT_PLAN.md (pan-India + accessibility)      | ⬜ pending | —                    | —       | Currently in chat only                                 |
<!-- bible:status:end -->

---

## 3. Strategic snapshot

### 3.1 Three product surfaces

**A. Patient + Family App** — digital caretaker. Single timeline of every report, appointment, medication, check-in. Multi-channel (PWA + WhatsApp + Telegram + IVR + SMS + USSD + clinic kiosk) so a feature-phone user in a tier-3 town has the same access as a smartphone user in Mumbai. Multi-language (4 at launch → 14+ by Phase 3). Family + CHW access with patient-owned consent and granular per-role scopes.

**B. Clinician Console** — decision layer. Role-aware views for Coordinator, Med Onc, Surg Onc, Rad Onc, Pathologist, Radiologist, Nurse, Palliative, Counselor. 30-second AI case summary on patient open. Drug interaction + dose-modification checks. Voice notes via Whisper. Defensible audit trail. Hub-and-spoke views: tier-1 oncologist sees referred cases from tier-3 partners.

**C. MDT / Tumor Board Room** — collaboration. Auto-generated one-page briefs (already started: `generateMdtSummary` in [src/integrations/claude.ts:110](src/integrations/claude.ts:110)). Sync mode (video + shared brief) and async mode (busy specialists pre-comment 24h ahead). Decisions captured, signed, and outcome-reviewed at 90 days. **District Tumor Boards** = tier-1 anchor + 5–10 tier-3 spokes meeting weekly virtually.

### 3.2 The "irresistible" hooks

- **Oncologists**: case-prep collapses 30 min → 5 min; MDT prep 2 hr → 10 min per case.
- **Hospitals**: tumor-board throughput 2-3×; cross-hospital virtual MDT punches above their weight.
- **Patients**: one link to every report; symptom escalation that reaches their doctor in hours, not days; their own language; family looped in.
- **Family caregivers**: real-time visibility into a loved one's care from any city; act on the patient's behalf with consent.
- **CHWs / ASHAs (rural)**: capture vitals at the patient's home, escalate to district hospital, get answers from tier-1 specialists.

### 3.3 Key strategic choices (v1 + v2 consolidated)

- **Pan-India urban + rural** from Day 1 — every feature ships across PWA + WhatsApp/Telegram + IVR + SMS, never assumes smartphone.
- **Patient app free forever** — revenue comes from hospital tier (₹300–800/oncologist/month) and cross-hospital MDT fees.
- **ABHA-anchored identity** (now Phase 1, was Phase 4) — pan-India interoperability via Ayushman Bharat Digital Mission.
- **NGO + Government partnerships** equal weight to private hospital partnerships — St. Jude India, Karkinos, ICS, NPCDCS, PMJAY, state cancer programs.
- **AI-assist, never AI-decide** — every recommendation cites NCCN/ESMO + the oncologist signs.
- **Defer**: generic CRUD factory (over-engineering); full event-sourced saga for onboarding (until multi-service trigger exists).

### 3.4 Phasing

- **Phase 0 (May–Jun 2026)** — SOLID Tier 1+2 foundation. **In flight.**
- **Phase 1 (Jun–Sep 2026)** — 2 urban hospitals + 1 rural cluster + 1 NGO; ABHA + IVR + SMS live; 4 languages.
- **Phase 2 (Aug–Nov 2026)** — full multispecialty roles; +6 languages; USSD; PMJAY application; 1 published outcomes paper.
- **Phase 3 (Nov 2026–May 2027)** — multi-tenancy; 5 hub-spoke clusters; 25+ urban hospitals; cross-hospital MDT marketplace; PMJAY + NPCDCS live in 2 states.
- **Phase 4 (May–Nov 2027)** — 50+ hospitals; 100,000+ patients (50% rural); ABDM HIU+HRP; SOC 2 Type II; 1 international pilot.

### 3.5 Security & privacy (non-negotiable)

DPDP Act 2023 + HIPAA-grade best practices + NABH + ABDM. Encryption everywhere (TLS 1.3, AES-256 at rest, 5-min signed URL TTL for PHI documents). Zero-trust authz: every patient record gated by `requirePatientAccess` (S2). Patient-owned, time-bound, revocable, granular consent — including **family member access**. Audit log: append-only, hash-chained, queryable by patient. India region only. Pan-India safety: ABHA identity, SIM-swap detection, **patient duress code** (silently revoke family access in coercion scenarios), female-only contact channel option.

> **Open critical gap (until S2 ships):** any authenticated coordinator can read/write any patient's records. Track and ship S2 with the 4-step migration path described in the SOLID plan.

---

## 4. SOLID refactor snapshot (the foundation)

Full plan: [~/.claude/plans/jazzy-scribbling-locket.md](~/.claude/plans/jazzy-scribbling-locket.md). Quick scorecard from the audit of recent commits:

| Principle | Grade | Headline finding |
| --------- | ----- | ---------------- |
| **S**RP   | D     | `routes.ts` (772 LoC, 37 handlers) and patient detail page (1151 LoC, 11 inline tabs) are god files |
| **O**CP   | D     | Adding an 8th record type = edits in 5+ files; new channel fans out across 4 files |
| **L**SP   | F     | Unified messaging API silently downgrades Telegram templates → caused Bug 1 (commit `0cf0ed5`) |
| **I**SP   | C     | `lib/api.ts` exports 31 functions to every consumer |
| **D**IP   | D     | 37+ direct Prisma imports; JWT secret had hardcoded prod fallback (closed by S1) |

Execution is sequenced in the status table above. Tier 1 (S1–S3) is "ship this week"; Tier 2 (H1–H5) is "next sprint"; Tier 3 (M1–M4) is "after H1–H3 land".

---

## 5. Open decisions (need stakeholder input)

| # | Question | Owner | Needed by |
| - | -------- | ----- | --------- |
| D1 | Self-fund pilot or raise seed round? | Vijaya | Phase 1 start (Jun) |
| D2 | India-only Phase 1 or India + 1 international? | Vijaya | Phase 1 scope |
| D3 | Build or buy for video — Daily.co vs Twilio vs Jitsi? | Tech lead | P1.4 start |
| D4 | Free tier for non-profit cancer NGOs from Day 1? | Vijaya | O3 outreach |
| D5 | Open-source the patient PWA to build trust, or keep proprietary? | Vijaya | P1.1 start |
| D6 | ABDM HIU certification in Phase 1 or Phase 3? | Lawyer (O1) | P1.6 design |
| D7 | Persist v2 pan-India refinements into PRODUCT_PLAN.md as rewrite or appendix? | Vijaya | This week |

---

## 6. Execution log (auto-appended)

> Newest entries at the bottom. The post-commit hook adds an entry every time a tagged commit lands.

<!-- bible:log:start -->
- `2026-05-02 19:00:00Z` · **S1** → done · `manual` · 5 boot scenarios verified (no/dev/short/real secret + dev fallback)
- `2026-05-02 12:40:52Z` · **S1** → done · `528cf56` · feat: hard-fail boot on missing or dev JWT secret [S1]
<!-- bible:log:end -->

---

## 7. How this Bible stays alive

### 7.1 Commit message convention

Tag the task ID in your commit message:

```
feat: extract patient repository [H1]
fix: messaging channel for telegram chat-id [S3]
chore: NGO partnership outreach script [O3]
```

Multiple tags allowed: `[S2][H1]`. Sub-tasks: `[P1.4]`. The post-commit hook scans for `[Sx]`, `[Hx]`, `[Mx]`, `[P1.x]`, `[O1]` and marks them **done** in the status table + appends to the execution log + amends the commit so BIBLE.md changes ride along.

### 7.2 Manual updates (for non-code work)

```bash
node scripts/update-bible.mjs --task=O1 --status=done --note="Hired Acme Health Law"
node scripts/update-bible.mjs --task=H1 --status=in-progress
node scripts/update-bible.mjs --task=S2 --status=blocked --note="Awaiting hospital-assignment data backfill"
```

Statuses: `pending` (default) · `in-progress` · `blocked` · `done`.

### 7.3 One-time setup per clone (run once after cloning)

```bash
git config core.hooksPath scripts/git-hooks
```

This points git at the tracked hooks directory. After this, every `git commit` in the repo runs the post-commit hook. The hook is **fail-soft** — it never blocks a commit even if Node is missing or the script errors.

### 7.4 What auto-updates and what doesn't

**Auto:** task status (`⬜` → `🟨` / `✅`), date, commit SHA, one-line note from the commit subject; new entry in the execution log.

**Manual:** strategic content (Sections 1, 3, 4, 5), open decisions, and the title/description of any new task added to the status table.

### 7.5 Adding a new task

Edit the status table to add a row with a new ID following the convention:
- `S` / `H` / `M` for SOLID Tier 1 / 2 / 3 (engineering)
- `P{phase}.{n}` for product/phase deliverables (e.g., `P2.3`)
- `O{n}` for org/partnership work

Then commit your edit (no special tag needed for the task definition itself).

### 7.6 Files involved

- [BIBLE.md](BIBLE.md) — this file. Edit Sections 1, 3, 4, 5 freely; leave the marked managed regions alone.
- [scripts/update-bible.mjs](scripts/update-bible.mjs) — the updater.
- [scripts/git-hooks/post-commit](scripts/git-hooks/post-commit) — the hook that runs the updater.
- [PRODUCT_PLAN.md](PRODUCT_PLAN.md) — full product plan (deeper than Section 3 here).
- [~/.claude/plans/jazzy-scribbling-locket.md](~/.claude/plans/jazzy-scribbling-locket.md) — full SOLID refactor plan (deeper than Section 4 here).
