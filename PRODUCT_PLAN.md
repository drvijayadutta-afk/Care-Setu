# Care Setu — End-to-End Product Plan

> **Status:** Draft v1 · **Date:** 2026-05-02 · **Owner:** Vijaya
> **Companion docs:** [SOLID refactor plan](~/.claude/plans/jazzy-scribbling-locket.md) (Phase 0 foundation work, S1 shipped)

---

## 1. Executive summary

**Care Setu is the operating system for cancer care.** Cancer is a multi-specialty, multi-month, multi-stakeholder journey — and today it lives in WhatsApp groups, scanned PDFs, and the memory of one overworked oncologist. We replace that with three tightly integrated surfaces that share one source of truth:

1. **Patient + Family App** — a digital caretaker that holds every report, appointment, medication, and symptom check-in, accessible by the patient and their nominated family members under granular consent.
2. **Clinician Console** — a decision layer for oncologists and specialists with AI-summarized case context, longitudinal history, guideline-grounded recommendations, and time-saving automation.
3. **Tumor Board / MDT Room** — a real-time + asynchronous multi-specialty collaboration space with auto-generated one-page briefs, signed decisions, and outcome tracking.

Today (commit `e7227a5`) Care Setu is a WhatsApp/Telegram patient coordinator with the seed of a clinical record store and an MDT brief generator. The platform is ~2 months from being production-pilot-ready after the SOLID Tier 1 refactors. From there, we have an 18-month roadmap to become the default tumor board software for tier-1 Indian oncology hospitals and a meaningful presence in tier-2/3 hospitals.

**The "irresistible" hook for oncologists:** auto-generated tumor board briefs reduce 2-hour case prep to 10 minutes; AI case summaries reduce 30-min new-patient onboarding to 5 min. The hook for hospitals: tumor board throughput goes up 2-3×; cross-hospital virtual MDT becomes feasible. The hook for patients: one place where everything in their cancer journey lives, in their own language, with their family looped in.

---

## 2. Vision & positioning

### Vision
To make excellent multidisciplinary cancer care available to every patient — regardless of which hospital they walk into.

### Positioning (one-liner)
*"Care Setu is to cancer care what the iPhone is to communication: a single trusted device through which every important interaction flows."*

### Why now
- WhatsApp penetration in India is universal — patient onboarding friction is essentially zero.
- LLMs are finally good enough (Claude Opus 4.7, Sonnet 4.6) to summarize complex oncology cases reliably.
- DPDP Act 2023 has clarified the rules of the road for healthcare data in India.
- Indian oncology demand is growing 6-8% per year while specialist supply grows ~2% per year — an efficiency tool is no longer optional.

### What we are NOT
- We are **not** an EMR/HIS replacement. We integrate with hospital systems (HL7 FHIR, OpenMRS, custom adapters).
- We are **not** a telemedicine platform. We embed video for tumor boards but routine telehealth lives elsewhere.
- We are **not** an AI doctor. We are an **AI-assist** layer — every recommendation is evidence-cited and the oncologist signs off.

---

## 3. Three product surfaces

### 3.1 Patient + Family App (Digital Caretaker)

**Format:** PWA at `app.caresetu.health` + WhatsApp/Telegram channels (existing). Native iOS/Android wrappers Phase 3.

**Core capabilities (P0 — Phase 1):**
- **Single timeline** of every report (lab, imaging, pathology), appointment, medication, and check-in.
- **Multi-channel onboarding** — start in WhatsApp, continue in PWA, no account re-creation. Phone-number-as-identity with OTP + WebAuthn passkey.
- **Daily symptom check-in** with CTCAE-grade auto-escalation (already partial).
- **Appointment hub** — reminders, prep instructions, telehealth join, location/parking info, what-to-bring.
- **Medication tracker** — schedule, side-effect log, adherence streak, refill reminders.
- **Discharge summary explainer** — every discharge note translated into the patient's language with a glossary.
- **Bills & insurance** — running estimate + claim status (manual upload Phase 1, integrations Phase 3).
- **Multi-language** — Hindi, English, Marathi, Tamil at launch; Telugu, Bengali, Kannada by Phase 2.

**Family/Caregiver capabilities (P0 — Phase 1):**

A patient may invite up to **5 family members** in defined roles:

| Role | Default scopes | Can do |
|---|---|---|
| **Primary caregiver** (1 max) | Full read + act | View everything; book appointments; chat with care team; log symptoms on patient's behalf |
| **Trusted family** (up to 3) | Read appointments + status | See "next appointment", "current treatment cycle", high-level status; receive appointment reminders |
| **Emergency contact** (1 min) | Notification only | Receives alerts for critical events (hospitalization, ER visit) |

- **Patient is always the data owner** — every invite is consented, time-bound (default 1 year, renewable), and revocable from a single screen.
- **Granular scope toggles** — patient can hide pathology results from a sibling but show appointments.
- **Audit log** — patient can see every time a family member accessed their record (who, what, when).
- **Pediatric mode** — for patients <18, parental account is primary; ownership transfers at 18 with consent ceremony.
- **Incapacity protocol** — patient pre-designates a healthcare proxy (with documentation upload); proxy can request elevated access via a 24-hour cooling-off + clinician approval.
- **End-of-life mode** — clinician-triggered transition to a memorial view; data retained per family wishes; export option.

**Phase 2 additions:**
- AI symptom triage chatbot (when to go to ER vs wait for next consult)
- Treatment journey visualization (where am I in AC-T cycle 3?)
- Peer support communities (moderated, by cancer type)
- Nutritionist/counselor booking
- Second-opinion request flow

**Phase 3 additions:**
- Wearable integration (heart rate, sleep, activity)
- Outcome diary with photo upload (wound healing, rash progression)
- Clinical trial matching alerts
- Family video calls inside the app

### 3.2 Clinician Console (Decision Layer)

**Format:** existing Next.js coordinator-app, evolved into role-aware views.

**Roles:** Coordinator, Medical Oncologist, Surgical Oncologist, Radiation Oncologist, Radiologist, Pathologist, Palliative Care, Nurse, Counselor, Nutritionist, Hospital Admin.

Each role gets a tailored landing page (e.g., a radiation oncologist sees imaging + dosimetry first; a coordinator sees the today-queue).

**Core capabilities (P0 — Phase 1):**
- **30-second case summary** on every patient open: "Mrs. Al-Mansoori, 52F, Breast Stage IIIA, AC-T Cycle 3. Last visit 8 days ago. Notable: ANC dropped to 0.8 on D7 — neutropenia escalation pending. No new imaging."
- **Longitudinal record** — labs, imaging, pathology, vitals, notes, documents, care team, conversations (already partial — 7 record types in commit `7319d67`).
- **Side-effect grade dashboard** with CTCAE auto-grading and trend lines.
- **Voice notes** via Whisper (`src/integrations/whisper.ts` exists) — auto-transcribed, auto-categorized.
- **Drug interaction + dose-modification** checks with NCCN/ESMO grounding.
- **Defensible audit trail** — every clinical action signed, timestamped, immutable.

**Phase 2 additions:**
- **Cohort comparison** — "show me my 20 most-similar AC-T patients and their outcomes."
- **Trial eligibility match** — CTRI for India + ClinicalTrials.gov.
- **Consult requests** — warm handoff to a specialist with one-click case context.
- **Outcome registry** — protocol response rates per oncologist, per hospital, per drug.

**Phase 3 additions:**
- **Predictive risk scores** — readmission risk, sepsis risk, treatment-failure risk (validated locally).
- **Voice-driven case dictation** — full clinical note authored from a 5-minute conversation.
- **Federated insights** — anonymized cross-hospital benchmarks.

### 3.3 MDT / Tumor Board Room (Collaboration)

**Format:** new module under `coordinator-app/app/dashboard/mdt/`. Uses real-time WebSocket (already exists) + video (Daily.co / Twilio Video integration).

**Core capabilities (P0 — Phase 1):**
- **Scheduled tumor boards** — weekly/biweekly cadence per cancer type (breast, GI, thoracic, etc.)
- **Case slot management** — oncologist nominates patient → coordinator preps brief → board reviews
- **Auto-generated one-page MDT brief** (already started: `generateMdtSummary` in `src/integrations/claude.ts:110`) — diagnosis, staging, prior treatment, current status, imaging summary, pathology summary, proposed plan, questions for the board.
- **Sync mode** — video + shared brief + collaborative annotation; one click to advance through cases.
- **Async mode** — busy specialists pre-comment on briefs 24h ahead; sync session focuses on disagreements.
- **Decision capture** — every recommendation tied to evidence, signed by the board, time-stamped, locked.
- **Outcome loop** — 90 days later, the board reviews "did our recommendation work?" — feeds back into the model.

**Phase 2 additions:**
- **Cross-hospital MDT** — a tier-2 hospital case is presented to a TMC/AIIMS panel virtually.
- **Second-opinion marketplace** — paid/free tiers, async or live.
- **Tumor board library** — published anonymized cases for resident education.

---

## 4. The "irresistible" hooks (per persona)

**For oncologists**
1. *Case prep collapses from 30 min to 5 min* — AI summary on every patient open
2. *Tumor board prep collapses from 2 hr to 10 min per case* — auto-generated briefs
3. *Adherence visibility* — they actually know if the antiemetic was taken and whether nausea was grade 1 or 3
4. *Defensible audit trail* — signed, timestamped, both for outcomes and medico-legal

**For hospitals**
1. *Tumor board throughput up 2-3×* — measurable, drives revenue
2. *Cross-hospital virtual MDT* — punches above their weight on complex cases
3. *Quality dashboards* — time-to-treatment, protocol adherence, recurrence rates
4. *NABH/JCI documentation* — audit trail and decision logs auto-compiled
5. *Trial portfolio matching* — fills trial slots faster

**For patients**
1. *One link to every report* — no more "bring the file from last time"
2. *Symptom escalation that works* — message → coordinator → oncologist within hours
3. *Their own language* — Hindi, Marathi, Tamil at launch
4. *Family loop* — spouse and adult child share the load with consent

**For family caregivers**
1. *No more being out of the loop* — appointment reminders, status updates
2. *Act on the patient's behalf* — book, log, ask, with patient's permission
3. *Geographic separation solved* — adult child in another city sees mom's lab trends in real time
4. *Bereavement support* — clean handoff at end-of-life; data export option

---

## 5. End-to-end execution roadmap (18 months)

### Phase 0 — Foundation hardening (May–Jun 2026)
**Goal:** make the platform safe and extensible before adding new product surfaces. This is the [SOLID refactor plan](~/.claude/plans/jazzy-scribbling-locket.md). S1 (JWT secret hard-fail) is shipped.

**Deliverables:**
- S2: patient-scope authorization (closes critical PHI leak)
- S3: messaging channel abstraction (fixes LSP violation, unblocks SMS later)
- H1: repository layer (DIP)
- H2: split god `routes.ts` by aggregate (SRP)
- H3: AI + Storage ports + 5-min signed URL TTL (DIP + PHI)
- H4: split patient detail page; record registry (SRP/OCP)
- H5: onboarding state machine (SRP + transactional integrity)
- M1-M4: config-driven SSL, login rate-limit, AI-extract review queue, API client split

**Exit criteria:** all SOLID Tier 1 + Tier 2 done; full test suite passing; PHI authorization reviewed by external security firm; NABH-equivalent documentation drafted.

### Phase 1 — Hospital pilot (Jun–Sep 2026)
**Goal:** 2-3 partner hospitals, ~150 patients total, end-to-end flow proven.

**Deliverables:**
- Patient PWA (`app.caresetu.health`) — single timeline, multi-language, OTP + passkey auth
- Family invite + consent + scope flow (P0)
- Clinician console role-aware views (start with Coordinator + Medical Oncologist + Nurse)
- MDT room MVP (sync mode with auto-brief)
- HL7 FHIR adapter for one partner HIS
- Onboarding playbook (white-glove, see Section 6)

**Exit criteria:**
- 2 hospitals live, each running ≥1 weekly tumor board on Care Setu
- ≥80% patient retention at 30 days
- ≥1 published time-saved metric per hospital (case prep, MDT prep)
- Zero P1 security incidents

### Phase 2 — Decision layer + multispecialty (Aug 2026 – Nov 2026)
**Goal:** the platform becomes the daily decision tool for the full multispecialty team.

**Deliverables:**
- AI case summarization on every patient open (with citation)
- NCCN/ESMO guideline integration + drug interaction checker
- Voice notes (Whisper) with auto-categorization
- All clinician roles live (Surgeon, Radiologist, Pathologist, Radiation Onc, Palliative)
- Async MDT mode
- Cohort comparison
- Trial matching (CTRI + ClinicalTrials.gov)

**Exit criteria:**
- ≥50% of MDT cases reviewed asynchronously before sync session
- ≥1 published outcomes paper co-authored with pilot hospital
- ≥30 trial enrollments matched via Care Setu

### Phase 3 — Network effects (Nov 2026 – May 2027)
**Goal:** cross-hospital tumor boards, second-opinion marketplace, patient outcome registry — the platform becomes more valuable as more hospitals join.

**Deliverables:**
- Multi-tenancy (hospital_id everywhere; clean migration from single-tenant)
- Federated identity for oncologists at multiple hospitals
- De-identification pipeline for cross-hospital case discussion
- Second-opinion marketplace (TMC/AIIMS/RGCIRC as anchor providers)
- Patient outcome registry with feedback loop into AI summaries
- Native iOS/Android wrappers (Capacitor or React Native shell over the PWA)
- Wearable integration (Apple Health, Google Fit)

**Exit criteria:**
- 10+ hospitals live
- ≥3 cross-hospital virtual MDTs per month
- 1000+ active oncologists
- 5000+ active patients

### Phase 4 — Scale + global readiness (May – Nov 2027)
**Goal:** the default tumor board platform for tier-1 Indian oncology hospitals; pilot in 1 international market.

**Deliverables:**
- Open APIs for HIS integration (REST + FHIR)
- SOC 2 Type II certification
- HIPAA-aligned data plane (US tenancy option)
- One international pilot (suggest: UAE or Singapore)
- ABDM (Ayushman Bharat Digital Mission) integration in India
- 24×7 clinical support desk

**Exit criteria:**
- 30+ hospitals live
- 5000+ active oncologists
- 25,000+ active patients
- Series A milestones met

---

## 6. Oncologist & hospital onboarding strategy

The hardest problem in Indian healthcare software is not building it — it is getting the consultant to use it on Monday morning. Strategy:

### 6.1 Pick the right first hospitals
- 2-3 hospitals with **engaged, tech-curious medical oncology heads**
- Mix of one tier-1 (TMC, AIIMS, RGCIRC) and one tier-2 to validate both ends
- Hospital that already runs tumor boards (we improve what exists; we don't create a new ritual)

### 6.2 Champion-led adoption (not top-down)
- Find ONE oncologist per hospital who'll evangelize internally
- Free 6-month pilot, no contract, no credit card
- 30-min white-glove onboarding — we set up their patient panel from existing files; they don't fill a form
- **First-week win:** auto-generate the MDT briefs for next week's tumor board. That's the "wow" moment — Sunday-night case prep collapses to a Friday-morning 20-min review

### 6.3 Train coordinators first
Coordinators are the ones doing data entry — if they love the product, they sell it internally. Spend the first 2 weeks at each hospital working alongside coordinators, not consultants.

### 6.4 Conference + KOL strategy
- ASCO India, AROI annual meeting, ICON, Tata Memorial Conferences
- Co-author 2 papers in year 1 with pilot hospitals on tumor board efficiency
- Sponsor a "Best Multidisciplinary Care" award at one major conference

### 6.5 Referral economics
- Each oncologist who onboards 5 colleagues gets premium features free for life
- Each hospital that brings in a peer hospital gets 6-month price lock

### 6.6 Pricing model
- **Patient app: free forever** (the data trust comes from patients, not their wallets)
- **Hospital tier: per-bed/month** with a generous oncology sub-cap (e.g., ₹500/oncologist/month)
- **Cross-hospital MDT: per-case fee** (₹2-5K, split between presenting and consulting hospitals)
- **Free for non-profit cancer NGOs** (St. Jude India, Cuddles Foundation) — these become advocates

### 6.7 Time-to-first-value SLA
- **Day 1:** patient timeline visible for any patient with one report uploaded
- **Day 3:** first AI case summary delivered to oncologist
- **Day 7:** first auto-generated MDT brief
- **Day 30:** outcome metric report (case prep time, MDT prep time)

---

## 7. Security & privacy architecture

**Non-negotiable** for a healthcare platform handling cancer PHI in India.

### 7.1 Regulatory frame
- **DPDP Act 2023 (India)** — primary regulation. Consent, data minimization, breach notification within 72h, data principal rights (access, correction, erasure)
- **HIPAA-equivalent best practices** — for international expansion + investor confidence
- **NABH** — hospital accreditation requires audit-grade documentation
- **MoHFW EHR standards 2016** + **HL7 FHIR R4**
- **ABDM (Ayushman Bharat Digital Mission)** — for interoperability with the national health stack

### 7.2 Architecture principles

**Encryption everywhere**
- TLS 1.3 in transit; certificate pinning on mobile
- AES-256 at rest (Postgres TDE + column-level encryption for sensitive fields like genomic markers)
- Document storage: encrypted Supabase bucket; signed URLs with **5-minute TTL** (closes the 60-min gap; SOLID plan H3)

**Zero-trust authorization**
- Every patient record gated by `requirePatientAccess` middleware (SOLID S2)
- RBAC with explicit scopes per role: Coordinator, Oncologist, Specialist, Patient, Caregiver, Admin
- Every API call logged: who, what, when, why
- Fine-grained: a sibling caregiver can see appointments but not pathology; the oncologist on consult sees the brief but not the family chat

**Patient-centric consent**
- Patient owns their data — no clinician access without explicit consent
- Every consent is time-bound (default 1 year, renewable)
- Granular consent: per data type, per role, per recipient
- Revocable from one screen
- Patient-visible audit log of every access

**Family caregiver access — 4-layer protection**
1. **Invite acceptance** — caregiver must verify own phone/email via OTP
2. **Patient ownership** — patient signs the consent (re-signed yearly)
3. **Scope enforcement** — middleware checks role + scope on every request
4. **Visible audit** — patient sees a "family activity" timeline in their app

**Audit logging**
- New `AuditLog` table: `{actor_id, actor_role, patient_id, resource_type, resource_id, action, timestamp, ip, user_agent, reason}`
- Append-only; cryptographic hash chain for non-repudiation
- Exportable for DPDP data principal requests
- Reviewed weekly by a security automation that flags anomalies (e.g., off-hours access to a non-assigned patient)

**Data residency**
- India region (Mumbai for Supabase / AWS) for DPDP compliance
- Backups encrypted with separate KMS keys
- Disaster recovery: cross-AZ within India region

**De-identification pipeline**
- For cross-hospital tumor board discussions: PHI stripped, replaced with case-pseudonyms
- For analytics warehouse: separate tenant, no patient-identifying fields
- Re-identification protected by access controls + audit

**Breach response**
- Documented runbook (NABH-aligned)
- 72-hour notification per DPDP
- Cyber insurance with healthcare PHI coverage

**Right to erasure**
- DPDP requirement: patient can request full deletion
- 30-day soft delete, 90-day hard delete
- Clinical-record retention exceptions documented per state law (commonly 8 years post-treatment)

**External review**
- Annual penetration test by a CERT-In empanelled vendor
- SOC 2 Type II certification by Phase 4
- HIPAA risk assessment by Phase 4

### 7.3 Specific gaps to close (already in SOLID plan)
- S2: patient-scope authz (currently any coordinator can read any patient — CRITICAL)
- H3: 5-min signed URL TTL
- M2: rate-limit auth + audit failed logins
- M3: AI extract review queue (no silent auto-create of clinical records)
- New: full audit log table + middleware (Phase 0 add-on)
- New: consent management module (Phase 1)
- New: column-level encryption for sensitive fields (Phase 2)

---

## 8. Family / caregiver access model — deep dive

This deserves its own section because it's where most cancer-app companies get burned.

### 8.1 Invite flow
1. Patient (or primary caregiver if patient incapacitated) opens **My family** screen
2. Enters family member's name, relationship, phone/email, role (Primary / Trusted / Emergency)
3. Selects scope toggles (e.g., Pathology: hide from siblings)
4. System sends OTP-verified invite to family member
5. Family member accepts; their account is created tied to patient with scope
6. Patient gets confirmation; consent record is signed and stored

### 8.2 Default scopes by role

| Role | Reports | Appointments | Symptoms | Medications | Care team chat | Bills | Act on patient's behalf |
|---|---|---|---|---|---|---|---|
| Primary caregiver | ✅ Full | ✅ Full | ✅ Read+log | ✅ Read+log | ✅ Send | ✅ Read+pay | ✅ Yes |
| Trusted family | Summary only | Read | Read | Read | Read-only | ❌ | ❌ |
| Emergency contact | ❌ | Critical only | Critical only | ❌ | ❌ | ❌ | ❌ |

Patient can **promote/demote/customize** per family member at any time.

### 8.3 Special cases

**Pediatric (patient <18)**
- Parent or guardian is primary account holder
- Patient view exists but limited until 13 (UNCRC age-of-assent)
- At 18, ownership transfers via a 2-step ceremony: patient confirms; system gives parent read-only-by-invite status

**Patient incapacity**
- Patient pre-designates a **healthcare proxy** with documentation upload (POA, advance directive)
- If patient becomes unable to grant access, proxy can request elevated scope via:
  1. Clinician-attested incapacity note
  2. 24-hour cooling-off period
  3. Notification to all listed family members
  4. Auto-revert when patient regains capacity

**End-of-life**
- Clinician triggers transition to **memorial mode**
- Read-only access to designated family
- Data export available to next-of-kin (PDF + structured)
- Retention per family wishes (30 days → 1 year → indefinite)
- Anonymized data may be retained for outcome registry with pre-mortem consent

**Domestic abuse / coercive control protection**
- Patient can hide a family member's existence from other family members (e.g., estranged spouse who shouldn't see new caregivers)
- "Quick-revoke" button revokes all family access in one tap
- 24×7 support line for revocation under duress
- Audit log accessible only to patient (not family)

### 8.4 Data inheritance & deceased patient policy
- Pre-mortem: patient nominates a **digital executor** in their app
- Post-mortem: executor gets time-bound access (90 days) to download / archive
- Optional contribution to anonymized research registry (consent must be granted while patient is alive)

---

## 9. Tech architecture evolution

The SOLID refactor plan delivers the foundation. Each new product surface needs specific platform capabilities:

### 9.1 Patient + Family App
- Separate Next.js app at `app.caresetu.health` (deploy on Vercel as a second project)
- **Auth:** WebAuthn / passkeys + OTP fallback (no patient passwords)
- **PWA:** offline-first for low-connectivity rural areas
- **Push:** Web Push (PWA) + WhatsApp + SMS fallback
- **i18n:** all clinical strings reviewed by oncology-trained translator (not just Google Translate)
- New repos/ports needed: `FamilyConsentRepository`, `AuditLogPort`, `NotificationPort` (multi-channel router)

### 9.2 Tumor Board Room
- Real-time WebSocket already exists — extend to multi-user case rooms
- Video integration: **Daily.co** (HIPAA-eligible, pay-as-you-go) for sync MDT
- New: case state machine (`Proposed → Briefed → Discussed → Recommended → Executed → Reviewed`)
- Decision artifact storage: signed JSON with cryptographic hash

### 9.3 Decision Layer
- `AiPort` (SOLID H3) abstracts model choice per task — Opus for reasoning, Sonnet for drafting, Haiku for high-volume summaries
- Vector DB (`pgvector`) for similar-case search
- Guideline corpus + RAG pipeline (NCCN, ESMO, IPS oncology guidelines)
- Evidence linkage: every AI recommendation includes `[guideline_id, paragraph]` citations

### 9.4 Cross-hospital network
- Multi-tenancy: `hospital_id` on every model (Phase 3 migration; significant)
- Federated identity: oncologist `Coordinator` belongs to N hospitals (current schema needs many-to-many)
- De-identification pipeline before sharing case across tenants
- Inter-hospital messaging audit (separate audit log per hospital)

### 9.5 HIS integration
- HL7 FHIR R4 adapter (start with `Patient`, `Observation`, `DiagnosticReport`, `Encounter`)
- One custom adapter per partner HIS in Phase 1; templated adapter framework by Phase 3
- ABDM integration via Health Information User (HIU) registration

---

## 10. Key metrics

### Patient side
- DAU / WAU / MAU (target: 60% MAU/installs)
- Symptom check-in completion rate (target: 70% daily during active treatment)
- Time-to-escalation (symptom report → coordinator response, target: <2 hr business hours)
- Caregiver activation rate (target: 60% of patients invite ≥1 caregiver)
- Multi-language usage split

### Clinician side
- **Case-prep time** (target: 30 min → 5 min) — primary "irresistible" metric
- **MDT case throughput** per session (target: +2× vs baseline)
- **Time-to-decision** after case presentation
- **Adherence to recommended protocol** (cohort-level)
- **Voice-notes adoption** (target: 30% of clinical notes by Phase 2)

### Tumor Board
- Cases reviewed per board (target: +2×)
- % cases reviewed asynchronously before sync session (target: 50%)
- Decision-to-execution time (target: <72 hr)
- Outcome review completion (target: 80% at 90 days)

### Business
- Hospitals onboarded
- Active oncologists per hospital (target: ≥80% of oncology dept by month 3)
- Patient retention (90-day, target: 75%)
- NPS (oncologists ≥40, patients ≥50, hospitals ≥30)
- Cross-hospital MDT volume (Phase 3+)

---

## 11. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Oncologist tool fatigue → no adoption | High | Critical | Champion-led, white-glove onboarding; week-1 wow (auto MDT briefs) |
| HIS integration drag (each hospital different) | High | High | Templated FHIR adapter framework; budget 1 engineer-month per hospital in Phase 1 |
| AI hallucination in clinical summary → harm | Medium | Critical | Citation-required outputs; never auto-create records (M3); oncologist signs every recommendation |
| DPDP rule changes mid-flight | Medium | Medium | Healthcare lawyer on retainer; modular consent module |
| Family access abused (coercive control) | Low | Critical | Quick-revoke + duress support line; hidden-family-member feature; per-family audit |
| PHI breach | Low | Critical | Annual pentest; SOC 2 by Phase 4; cyber insurance; 72-hr notification runbook |
| Clinical liability | Medium | High | "AI-assist not AI-decide" framing; oncologist signs every action; PI insurance for the company |
| Multi-language clinical accuracy | Medium | High | Oncology-trained translator review; never machine-translate critical strings (drug names, dose units) |
| Tumor board scheduling difficulty | High | Medium | Async-first design; never depend on all-specialists-on-camera-now |
| Pilot hospital pulls out | Medium | Medium | 2-3 hospitals in Phase 1, not 1; service contract clarifies exit |
| Investor pressure to monetize patient app | Medium | High | Patient app stays free; revenue from hospital tier — non-negotiable |

---

## 12. Recommended next 30 days

**Week 1 (May 5-11)**
- Land SOLID S2 (patient-scope authz, log-only mode in staging) + S3 (messaging channel abstraction). [SOLID plan](~/.claude/plans/jazzy-scribbling-locket.md) is the executable doc.
- Recruit healthcare lawyer (2-3 candidates; pick by week 3)
- Identify 5 candidate pilot hospital champions; book discovery calls

**Week 2 (May 12-18)**
- Land SOLID H1 (repository layer) + start H2 (split routes)
- Shadow 5 oncologists for half a day each — measure today's case-prep time, MDT-prep time
- Sketch family invite + consent UI flows; user-test with 5 patient + caregiver pairs

**Week 3 (May 19-25)**
- Land SOLID H3 (AI/Storage ports + 5-min signed URL TTL)
- Sign healthcare lawyer; begin DPDP gap analysis
- Confirm 2-3 pilot hospitals; draft pilot MOU

**Week 4 (May 26-Jun 1)**
- Land SOLID H4 + H5
- Begin patient PWA scaffold (`app.caresetu.health`)
- First weekly architecture-review cadence with pilot hospital tech leads

**End of month gate:** SOLID Tier 1+2 done; 2 pilot hospitals signed; lawyer engaged; patient PWA scaffold live; baseline metrics measured.

---

## Appendix A — Companion documents
- [SOLID refactor plan](~/.claude/plans/jazzy-scribbling-locket.md) — Tier 1 (S1-S3) + Tier 2 (H1-H5) + Tier 3 (M1-M4)
- DEPLOYMENT_CHECKLIST.md (existing)
- RENDER_DEPLOYMENT.md (existing)
- README.md (existing)

## Appendix B — Open questions for stakeholder review
1. Do we self-fund the pilot or raise a seed round first?
2. India-only or India + 1 international market in Phase 1?
3. Build or buy for video (Daily.co vs Twilio vs Jitsi)?
4. Do we offer a free tier for non-profit cancer NGOs from day 1?
5. Open-source patient PWA to build trust, or keep proprietary?
6. Do we pursue ABDM Health Information User (HIU) certification in Phase 1 or Phase 3?
