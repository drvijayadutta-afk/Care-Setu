# Onco Board by Care Setu — Pre-Launch · Launch · Post-Launch Plan

> **Version:** 1.0 — May 2026  
> **Audience:** Product, Engineering, Ops, Hospital Partnerships  
> **Status:** Ready for T−4 weeks review

---

## Executive Summary

Onco Board is a push-first oncology coordination platform for Indian hospitals. This document covers the end-to-end plan from four weeks before launch to three months post-launch. The single north-star metric: **Doctor 7-day retention ≥ 40% by Day 30.**

---

## Part 1 — PRE-LAUNCH (Weeks −4 to −1)

### Week −4 · Infrastructure Hardening

#### Environment Setup

| Task | Owner | Done? |
|------|-------|-------|
| Render backend deployed from `main` branch | Eng | ☐ |
| Vercel frontend deployed with `NEXT_PUBLIC_API_URL` pointing to Render | Eng | ☐ |
| Supabase production project isolated from staging | Eng | ☐ |
| Upstash Redis production instance (paid plan ≥ 10M cmd/month) | Eng | ☐ |
| All secrets rotated: `JWT_SECRET` ≥ 32 chars, Aisensy key, OpenAI key | Eng | ☐ |
| Sentry DSN wired to both frontend and backend | Eng | ☐ |
| Automated daily Supabase backup verified with test restore | Eng | ☐ |
| `DATABASE_SSL=require` enforced in production env | Eng | ☐ |

#### Rate-Limit & Load Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| `POST /auth/login` | 5 req / 15 min / IP | Intentionally strict — coordinator password auth |
| `POST /auth/doctor/request-magic-link` | 100 req / 15 min / IP | Doctor magic-link — generous |
| Global default | 100 req / 15 min / IP | Covers all other endpoints |
| `LOGIN_RATE_LIMIT` env var | `5` | Configure via Render env |

#### Security Checklist

- [ ] HTTPS enforced on all endpoints (HTTP → HTTPS redirect)
- [ ] CORS allows only `*.vercel.app`, `care-setu-lac.vercel.app`, and `localhost:*` (dev)
- [ ] `HttpOnly; Secure; SameSite=strict` on all JWT cookies
- [ ] `JWT_SECRET` is ≥ 64 random characters in production
- [ ] No secrets committed to Git (audit with `git log --all --oneline`)
- [ ] OWASP Top-10 tested: SQL injection, XSS (no raw innerHTML), IDOR via patient scope
- [ ] Role isolation verified: DOCTOR cannot access `/patients`, COORDINATOR cannot access `/auth/doctor/me`
- [ ] Magic-link tokens: 15-min TTL, SHA-256 hashed, single-use — verified in smoke test ✅
- [ ] External pen-test booked (optional for V1; required before NMC CME integration)

---

### Week −3 · Pilot Hospital Preparation

#### Select 3 Pilot Hospitals

Priority: tier-2 / tier-3 where doctor has no existing digital tool.

| Hospital | City | Tier | Oncologists | Coordinator Contact |
|----------|------|------|------------|---------------------|
| Apollo Cancer Centre, Chennai | Chennai | Tier-2 | 4 | TBD |
| HCG Oncology, Bangalore | Bangalore | Tier-2 | 3 | TBD |
| Regional Cancer Centre, Thiruvananthapuram | Thiruvananthapuram | Tier-3 | 2 | TBD |

#### Hospital Onboarding Steps (per hospital)

1. **Admin account created** — coordinator email + password, role `ADMIN`
2. **Doctors registered** — `POST /doctors` with email + WhatsApp number
3. **Doctors set isOptedIn = true** — enables magic-link authentication
4. **Patients assigned** — imported from existing records or added manually
5. **WhatsApp integration verified** — test magic-link delivery < 30 seconds
6. **Quick-start kit sent** — 1-page PDF for doctors, 2-page PDF for coordinators

#### Quick-Start Kit Contents

**For Doctors (1 page):**
- "You'll get a WhatsApp message at 7 AM before clinic — tap the link"
- "No app download. No password. Just tap."
- "First time: tap 'Add to Home Screen' for one-click access"
- Support WhatsApp: +91 XXXXX XXXXX

**For Coordinators (2 pages):**
- Login URL + credentials
- How to add a doctor (with screenshots)
- How to add a patient manually
- How to interpret the outcomes dashboard

---

### Week −2 · Full System Dress Rehearsal

#### Staging Environment Smoke Test

Run against staging (not production). Target: **zero failures**.

| Test | Expected | Pass? |
|------|----------|-------|
| Coordinator login | HTTP 200, cookie set | ☐ |
| `GET /patients` returns seeded patients | HTTP 200, list ≥ 1 | ☐ |
| `POST /admin/patients` creates patient | HTTP 201, id returned | ☐ |
| `POST /doctors` creates doctor (ADMIN) | HTTP 201 | ☐ |
| `GET /admin/outcomes` returns all keys | HTTP 200 | ☐ |
| Magic-link request for opted-in doctor | HTTP 200, no email leak | ☐ |
| Magic-link verify → JWT cookie set | HTTP 200, doctor info returned | ☐ |
| `GET /auth/doctor/me` with DOCTOR JWT | HTTP 200 | ☐ |
| `GET /patients` with DOCTOR JWT | HTTP 403 | ☐ |
| `GET /auth/doctor/me` with COORDINATOR JWT | HTTP 403 | ☐ |
| 15× rapid magic-link requests | All HTTP 200 (no 429) | ☐ |
| `GET /doctor/today` with DOCTOR JWT | HTTP 200, cards array | ☐ |
| WhatsApp delivery of magic link | Delivered < 30s | ☐ |

#### Load Test

Tool: `autocannon` or `k6`  
Scenario: 100 concurrent doctors hitting `/doctor/today` + `/patients` for 60 seconds  
Target:
- P95 latency < 500 ms
- Error rate < 0.1%
- No OOM on Render

#### Deployment Runbook

```
# Deployment sequence (run in order)
1. git tag v1.0.0 && git push origin v1.0.0
2. Render auto-deploys backend on push to main
3. Run `npx prisma migrate deploy` via Render shell
4. Run `npx tsx src/db/seed.ts` for production coordinator account
5. Vercel auto-deploys frontend
6. Smoke test checklist above against production
7. Send comms (below)
```

**Rollback trigger:** if error rate > 2% for > 5 minutes → revert Render deployment to previous version.

---

### Week −1 · Comms & Go / No-Go

#### Internal Comms

- **Engineering:** deploy runbook walkthrough, on-call schedule confirmed
- **Product:** demo walkthrough with hospital coordinators
- **Hospital admins:** "Launch is Monday — here's what to expect" email

#### Go / No-Go Gate

All of the following must be GREEN before launch:

| Gate | Owner | Status |
|------|-------|--------|
| All smoke tests pass on staging | Eng | ☐ |
| Load test P95 < 500 ms | Eng | ☐ |
| WhatsApp template `pre_clinic_brief_v1` approved by Meta | Product | ☐ |
| 3 pilot hospital admins onboarded and trained | Ops | ☐ |
| ≥ 15 doctors registered with `isOptedIn = true` | Ops | ☐ |
| On-call rotation confirmed (3 engineers, 72-hour coverage) | Eng | ☐ |
| Sentry alerts wired and tested | Eng | ☐ |
| Support email `support@caresetu.health` active | Ops | ☐ |

---

## Part 2 — LAUNCH DAY

### Timeline (Monday, D-Day)

| Time (IST) | Action | Owner |
|------------|--------|-------|
| 06:00 | Final health check — all services green | Eng |
| 06:30 | On-call engineers on Slack `#onco-board-launch` | Eng |
| 07:00 | **Morning brief job fires** — first doctors receive WhatsApp brief | Automated |
| 07:15 | Ops spots-check: 3 doctors confirmed brief received | Ops |
| 08:00 | Coordinator onboarding emails sent | Ops |
| 08:30 | Hospital admins begin registering doctors | Ops |
| 09:00 | **Inbox digest job fires** — doctors with pending urgent messages notified | Automated |
| 10:00 | First registration count: target ≥ 5 | Product |
| 12:00 | Mid-day pulse — API latency, error rate, registrations | Eng |
| 15:00 | Product check-in with 2 pilot hospitals by phone | Product |
| 18:00 | EOD summary posted to `#onco-board-launch` | Product |
| 20:00 | On-call handover to night engineer | Eng |

### Monitoring Dashboard (D-Day)

Watch live in Render + Supabase + Sentry:

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| API error rate | > 1% | Page on-call |
| P95 latency | > 2 s | Investigate query plans |
| Redis commands | > 500K/hour | Scale Upstash |
| Doctor registrations | < 2 in first 3 hours | Call hospital admin |
| Magic-link delivery | < 80% delivered in 60 s | Check Aisensy logs |
| Sentry new errors | Any high-severity | Page on-call |

### Crisis Playbook

**If magic-link WhatsApp delivery fails:**
- Check Aisensy dashboard for delivery status
- Fallback: email the magic link directly (backend has email-sender integration)
- ETA to fix: < 30 minutes

**If backend crashes (Render restart loop):**
- Check Render logs for OOM or unhandled promise rejection
- If DB connection: check Supabase connection pool (`pgbouncer` or increase pool size)
- Rollback: click "Redeploy" on previous version in Render

**If 429 errors appear unexpectedly:**
- Identify which endpoint via Sentry
- Raise `rateLimit.max` for that endpoint in code + redeploy
- ETA: 10 minutes

**If morning brief job fails silently:**
- Check BullMQ dashboard (Upstash) for failed jobs
- Manual trigger: `POST /admin/trigger-morning-brief` (internal endpoint)
- Notify hospital admins via WhatsApp that brief was delayed

---

## Part 3 — POST-LAUNCH MONITORING

### Week 1 — Daily Health Checks

Run at 09:00 and 18:00 IST:

| Metric | Week-1 Target | How to Check |
|--------|--------------|--------------|
| Doctors registered | ≥ 30 | Prisma: `count DoctorUser` |
| Doctor logins (DAU) | ≥ 10 | `lastLoginAt` in DoctorUser |
| Morning briefs opened | ≥ 50% of registered doctors | WhatsApp delivery receipts |
| Inbox messages classified | ≥ 90% triage accuracy | Sample 20 from DB |
| API error rate | < 0.5% | Sentry |
| Support tickets | < 20/day | support@ inbox |
| Critical patient alerts sent | 100% | Alert table: `coordinatorNotified` |

### Week 1 — Rapid Fixes Expected

Based on prior testing, these issues are likely to surface in the first 72 hours:

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| Doctor gets brief but can't log in | Cookie not persisting on iOS Safari | Check `SameSite=strict` works cross-port; add explicit cookie domain |
| Outcomes dashboard empty for new hospitals | No check-in data yet | Show "collecting data — come back in 3 days" placeholder |
| Voice note upload fails on poor 3G | 10 MB limit hit | Compress audio client-side before upload |
| Doctor doesn't see "Add to Home Screen" | Browser varies | Update login page with manual install instructions |

---

### Months 1–3 — KPIs & Retention Targets

| Metric | Month 1 Target | Month 2 Target | Month 3 Target |
|--------|---------------|---------------|---------------|
| Doctors registered | 50 | 150 | 300 |
| Doctor 7-day retention | 25% | 35% | 40% |
| Doctor 30-day retention | 15% | 25% | 35% |
| DAU | 15 | 50 | 100 |
| Morning briefs opened / sent | 50% | 65% | 75% |
| Voice notes / doctor / week | — | 5 | 15 |
| Care records generated | 5 | 25 | 75 |
| NPS (doctor) | 20 | 30 | 40 |
| Critical alerts acted on < 2h | 80% | 90% | 95% |
| Support MTTR | < 8h | < 4h | < 2h |

### If 7-Day Retention < 25% by Day 30 — Intervention Protocol

**Stop all new feature work. Focus entirely on the wedge.**

Diagnostic questions (run in this order):
1. Is the morning brief arriving at the right time? (survey 10 doctors)
2. Is the brief content trusted? (are urgency signals accurate?)
3. Is the magic-link flow completing? (check `lastLoginAt` vs. link-click logs)
4. Is the PWA install happening? (only 5% of daily-active users use it standalone)

Likely fix: the 7 AM brief time is wrong. Adjust to 6:30 AM. Monitor for 7 days.

---

### Month 2 — KOL Seeding at Tier-1

Target 10 KOL oncologists from:
- Tata Memorial Hospital, Mumbai
- AIIMS, New Delhi
- Apollo Cancer Centre, Hyderabad
- HCG, Bangalore

Offer: **free lifetime Onco Board access** in exchange for:
- Monthly 30-minute product feedback session
- One published case study or testimonial
- Permission to be named as reference customer

KOL seeding budget: ₹2 lakh / year (dinners, travel, gift cards)

---

### Month 3 — Feature Expansion (if retention ≥ 40%)

Release in this order:

1. **Full AI Inbox Replies** (Hook 4 complete) — doctor sends reply from app
2. **Personal Outcomes Dashboard** (Hook 6) — response rates, toxicity, MDT activity
3. **CME Tracker** (Hook 7A) — auto-accrual, NMC certificate generation
4. **Cohort Export** (Hook 7B) — de-identified CSV, k-anonymity enforced
5. **Tamil + Hindi voice notes** (Hook 5 multilingual) — expand beyond English

---

### Month 4–6 — Scale & SOC 2

| Initiative | Rationale | Timeline |
|-----------|-----------|---------|
| SOC 2 Type 1 audit prep | Required for tier-1 hospital procurement | Month 5 |
| NABH documentation alignment | Indian healthcare quality standard | Month 5 |
| Peer benchmarks go live (n ≥ 10) | Unlocks Hook 6 full value | Month 4 |
| Additional languages: Marathi, Bengali | Expand to Maharashtra + Bengal markets | Month 6 |
| Enterprise tier pricing (₹30K/hospital/month) | Monetisation for hospitals with > 100 patients | Month 5 |

---

## Part 4 — SUCCESS METRICS SCORECARD

| Metric | Month 3 Target | Actual | Status |
|--------|---------------|--------|--------|
| Doctors registered | 300 | — | ☐ |
| Doctor 7-day retention | 40% | — | ☐ |
| Doctor 30-day retention | 35% | — | ☐ |
| DAU | 100 | — | ☐ |
| Morning briefs opened | 75% | — | ☐ |
| Voice notes / doctor / week | 15 | — | ☐ |
| Care records generated (total) | 75 | — | ☐ |
| NPS (doctor) | 40 | — | ☐ |
| Hospital partnerships | 8 | — | ☐ |
| Support MTTR | < 2h | — | ☐ |

---

## Part 5 — DISTRIBUTION STRATEGY

### Phase 1 (Months 1–3): Coordinator Pull-Through

Every coordinator using Onco Board is a doctor-acquisition channel.

**Flow:**
1. Coordinator adds doctor to hospital (fills in WhatsApp + email)
2. Backend auto-creates Doctor record with `isOptedIn = true`
3. Doctor receives onboarding WhatsApp: "Your morning brief is ready — tap to log in"
4. Doctor taps → magic link → PWA → installed

Target: **each coordinator onboards ≥ 3 doctors in first week**.

### Phase 2 (Months 2–4): Referral Viral Loop

When a coordinator sends a patient referral to an out-of-network doctor:
- Referral WhatsApp includes: *"View this patient's complete record → [magic link]"*
- The receiving doctor gets a 14-day read-only view without registration
- After 3 referrals received, doctor is prompted to register their hospital

This makes every referral an acquisition event.

### Phase 3 (Months 4–6): KOL-Led Tier-1 Entry

- 10 KOL oncologists using Onco Board → feature in ISMPO / ICON conference
- Case study: "How Onco Board reduced morning prep time by 45 minutes"
- Tier-1 hospitals approach Care Setu for procurement (inbound, not outbound)

---

## Appendix A — Environment Variables (Production Checklist)

```
# Backend (Render)
NODE_ENV=production
PORT=10000                         # Render default
DATABASE_URL=<supabase-prod-url>
DATABASE_SSL=require
JWT_SECRET=<64-char-random>        # openssl rand -hex 32
JWT_TTL=8h
LOGIN_RATE_LIMIT=5
ALLOWED_ORIGINS=https://onco-board.caresetu.health,https://care-setu-lac.vercel.app
COORDINATOR_APP_URL=https://onco-board.caresetu.health
REDIS_URL=<upstash-prod-url>
WHATSAPP_API_VERSION=aisensy
AISENSY_API_KEY=<key>
OPENAI_API_KEY=<key>              # for Whisper transcription
ANTHROPIC_API_KEY=<key>           # for Claude AI features

# Frontend (Vercel)
NEXT_PUBLIC_API_URL=https://care-setu-backend.onrender.com
NEXT_PUBLIC_APP_NAME=Onco Board — Care Setu
```

---

## Appendix B — Support Escalation Path

```
Level 1 (L1) — Hospital admin handles:
  - Doctor can't log in → resend magic link
  - Patient missing from list → add manually
  - WhatsApp not received → check number format (91XXXXXXXXXX)

Level 2 (L2) — Care Setu Ops handles:
  - API errors (4xx/5xx) from coordinator dashboard
  - Outcomes data missing or stale
  - Rate-limit errors
  - Billing / access tier questions

Level 3 (L3) — Engineering on-call handles:
  - Backend down
  - Data loss / corruption
  - Security incident
  - BullMQ job failures
```

**SLA:**
- L1: < 4 hours during business hours (9 AM – 7 PM IST)
- L2: < 2 hours (24/7 during first month)
- L3: < 30 minutes (paged via Sentry / PagerDuty)

---

## Appendix C — Demo Credentials (Staging Only — Never Share in Production)

| Role | Email | Password |
|------|-------|----------|
| Admin Coordinator | coordinator@caresetu.health | CareSetu@2026 |
| Doctor (magic-link) | ananya.k@apollo-cancer.in | *(magic link via WhatsApp)* |
| Doctor (magic-link) | vikram.nair@tmc.gov.in | *(magic link via WhatsApp)* |

**Sample patients in demo database:**
- Kavitha Rajagopal — Breast Cancer Stage II — **CRITICAL** (active alert)
- Ramesh Iyer — Lung Cancer Stage IIIA — **CRITICAL**
- Deepa Krishnan — Ovarian Cancer Stage IIIC — **NOTABLE**
- Priya Sundaram — Breast Cancer Stage I — **STABLE**

---

*Last updated: May 2026 — Onco Board v1.0 Launch Edition*
