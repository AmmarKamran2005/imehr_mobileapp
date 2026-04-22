# IMEHR Clinician Mobile App — Analysis & Plan

> **Scope note:** This document plans the **IMEHR** clinician+nurse mobile app only.
> Rehabdox is a **separate, unrelated product** — referenced only as "lessons learned."
> Zero code/data/branding mixing.

---

## 0. Guiding Principles (Non-Negotiable)

1. **Backend is FROZEN.** Consume the existing IMEHR backend as-is. No schema changes, no new controllers, no new files in `ehr-system/`. Exception only with explicit approval.
2. **Flow parity with the web.** Every step, field, validation, and role gate mirrors the web system exactly. Mobile is a touch-friendly remote control, not a re-design.
3. **UI/UX is the differentiator.** Modern, spacious, professional, fast. Heavy investment in polish.
4. **AI Scribe and voice dictation MUST be preserved without compromise.** Every AI touchpoint available on the web is available on mobile.
5. **v1 goal = functional + nearly bug-free.** No watch companions, no advanced dashboards. Ship something that works everywhere.
6. **No code until the user says "Go Ahead."**

---

## 1. Executive Summary

**What:** A mobile app for IMEHR **nurses and clinicians**, using Angular 20 + Ionic 8 + Capacitor 8, Android first.

**Users (two roles in v1):**
- **Nurse / Medical Assistant (Role 6 / 7)** — owns Vitals, History, CC & HPI (steps 0–2 of the encounter wizard). Cannot create clinical notes.
- **Clinician / Provider (Role 2)** — owns Clinical Note, Orders, Prescriptions, Dx & CPT, Checkout (steps 3–7). Can fall back into steps 0–2 when no nurse is involved.

**Core v1 experience = the Encounter Wizard.** The mobile app's heart is the same 8-step encounter wizard that the web uses, rendered for touch. Everything else (login, dashboard, schedule, patient lookup, settings) is supporting scaffolding around it.

**Explicitly included in v1 (not deferred):**
- MEDOCS Voice / AI Scribe — Unified Voice Bar on Vitals, History, CC & HPI
- Clinical Note "Record Session" dictation
- AI ICD-10 suggestions (auto-fire + refresh)
- AI CPT suggestions (auto-fire on first ICD + refresh)
- ICD-10 family dropdown (3-char prefix expansion)
- Provider favorites for ICD / CPT
- Note signing + encounter checkout
- Telehealth transcription pass-through (we do NOT build telehealth video in v1, but when a telehealth-linked encounter is opened, transcription chunks already saved server-side must render)

**Deferred (post-v1):**
- Cosign inbox
- Offline editing DB / conflict resolution
- Push notifications
- Watch companion
- Tablet two-pane layout (unless user explicitly wants it in v1)
- In-app telehealth video
- Amendment / addendum authoring (view-only acceptable)

---

## 2. IMEHR Backend — What We Consume (As-Is)

Source at `C:\Main\imehr\imehr\ehr-system\`. **No modifications.** All endpoints below already exist.

### 2.1 Authentication
| Endpoint                                | Purpose                           |
|-----------------------------------------|-----------------------------------|
| `POST /api/auth/login`                  | Email + password → may require OTP |
| `POST /api/auth/verify-otp`             | 6-digit OTP verification          |
| `POST /api/auth/resend-otp`             | 60s cooldown                      |
| `POST /api/auth/refresh`                | Refresh JWT                       |
| `POST /api/auth/logout`                 |                                   |
| `GET  /api/auth/me`                     | User + role + tenant + providerId |

JWT role values: **0**=SuperAdmin, **1**=ClinicAdmin, **2**=Clinician, **3**=Scheduling, **6**=MA/Nurse, **7**=Secondary nurse/therapist.

### 2.2 Dashboard / Schedule
| Endpoint                                           | Purpose                         |
|----------------------------------------------------|---------------------------------|
| `GET /api/dashboard/appointments?date=`            | Today's appointments            |
| `GET /api/dashboard/stats`                         | Role-filtered widget counts     |

Statuses (`Models/Enums/AllEnums.cs:17-28`):
`Scheduled=0, Confirmed=1, CheckedIn=2, InProgress=3, Completed=4, NoShow=5, Cancelled=6, Rescheduled=7, Missed=8`

### 2.3 Appointment → Encounter transition
| Endpoint                                           | Role gate   | Effect                                    |
|----------------------------------------------------|-------------|-------------------------------------------|
| `POST /api/appointments/{id}/checkin`              | 0,1,2,3,6,7 | `Scheduled` / `Confirmed` → `CheckedIn`   |
| `POST /api/appointments/{id}/start-visit`          | 0,1,2,6,7   | `CheckedIn` → `InProgress`                |
| `POST /api/patients/{patientId}/encounters`        | 0,1,2       | Creates Encounter row, status = Open      |
| `PUT  /api/patients/{patientId}/encounters/{id}`   | 0,1,2,6,7   | Partial update (fields, IcdSelections…)   |
| `POST /api/appointments/{id}/checkout-with-cpt`    | 0,1,2       | Closes encounter, creates charges/claim   |

### 2.4 Encounter wizard data
| Step  | Endpoint(s)                                                                  |
|-------|-------------------------------------------------------------------------------|
| Vitals   | `GET/POST/PUT /api/patients/{pid}/vitals[/{vid}]`                          |
| History  | `/api/patients/{pid}/{allergies|medications|problems|family-history|social-history|immunizations}` |
| CC/HPI   | PUT `/api/encounters/{eid}` with `ChiefComplaint` + `HistoryOfPresentIllness` |
| Note     | `GET/POST/PUT /api/clinical-notes[/{id}]` · `GET /api/clinical-notes/by-appointment/{aid}` |
| Note sign| `POST /api/clinical-notes/{id}/sign`                                       |
| Orders   | `GET /orders?patientId=` · (CRUD per OrdersController)                     |
| Rx       | `GET /prescriptions?patientId=` · (CRUD per PrescriptionsController)       |
| Dx/CPT   | PUT encounter with `IcdSelections` + `CptSelections` JSON                  |

### 2.5 AI touchpoints (all must work on mobile)
| Feature                  | Endpoint                                          | Notes |
|--------------------------|---------------------------------------------------|-------|
| Unified Voice Bar chunk  | `POST /api/medocs-voice/process-chunk`            | Multipart audio + `tabKey` + `sequenceNumber` + `previousContext`. Returns transcription + extracted structured fields. Roles 0,1,2,6,7. |
| ICD-10 suggest           | `POST /api/appointments/{id}/suggest-icd`         | Returns 1–6 codes w/ confidence. Auto-fire on step open. |
| CPT suggest              | `POST /api/appointments/{id}/suggest-cpt`         | Reads `Encounter.IcdSelections`. Auto-fire on first ICD, auto-refresh on change. |
| Clinical Note record     | (dedicated record-session pipeline)                | Separate from Unified Voice Bar; used on clinical-note step. |
| Telehealth transcription | (same voice chunk endpoint, `tabKey=telehealth`)   | Chunks encrypted server-side, stored in `TelehealthTranscriptionChunk`. |

### 2.6 Lookups & favorites
| Endpoint                                 | Purpose |
|------------------------------------------|---------|
| `GET /api/icd-codes/search?query=&take=` | DB-only code search (also used for family expansion) |
| `GET /api/lookups/cpt-codes?search=`     | CPT search |
| `GET /api/favorites?type=ICD10|CPT`      | Per-user starred codes |
| `POST /api/favorites`                    | Add favorite |
| `DELETE /api/favorites?type=&code=`      | Remove favorite |

### 2.7 Real-time
- `MobileHub` (SignalR) — user-scoped group, used for mid-encounter events (e.g. note closed in embedded webview). We subscribe; we don't extend.

---

## 3. The Encounter Flow — Single Source of Truth

This is the spine of the mobile app. Every mobile screen exists to support these steps.

### 3.1 The 8 steps (identical to web)

| # | Step          | Owner      | Key data                                                              |
|---|---------------|------------|-----------------------------------------------------------------------|
| 0 | Vitals        | Nurse      | BP, HR, Temp, SpO₂, RR, Weight, Height, BMI (auto-calc), pain score   |
| 1 | History       | Nurse      | Allergies, Medications, Problems (PMH), Family Hx, Social Hx, Immunizations |
| 2 | CC & HPI      | Nurse      | Chief Complaint + HPI (both free-text, voice-dictatable)              |
| 3 | Clinical Note | Clinician  | SOAP / rich-text note; "Record Session" for voice-drafted note        |
| 4 | Orders        | Clinician  | Labs, imaging, referrals                                              |
| 5 | Prescriptions | Clinician  | Drug search, dose, frequency, quantity, refills                       |
| 6 | Dx & CPT      | Clinician  | ICD-10 (cap 12, order = priority) + CPT (no cap, units per row)       |
| 7 | Checkout      | Clinician  | Validate, sign all draft notes, close encounter → charges + claim     |

### 3.2 State machine

```
Appointment: Scheduled → [check-in]  → CheckedIn
                        → [start-visit] → InProgress
                        → [checkout-with-cpt] → Completed

Encounter:  Open → [sign note(s) + checkout] → Signed → (optionally) Locked / Amended
ClinicalNote: Draft(0) → [sign] → Signed(2)
```

### 3.3 Entry points on mobile

- **From Schedule tab** → tap an appointment → appointment detail → tap "Check in" (if needed) → tap "Start visit" → enters encounter at the default step for the user's role (nurse = step 0, clinician = step 3).
- **Dashboard banner** — if user has an in-progress encounter, a "Resume encounter" banner sits at the top of Schedule tab (web mirrors this on dashboard).

### 3.4 Role-based default & gating

- **Nurse lands on step 0 (Vitals).** Sidebar shows steps 0-2 as active; steps 3-7 visible but non-interactive (disabled with a lock icon + tooltip).
- **Clinician lands on step 3 (Clinical Note).** All 8 steps enabled.
- **Admin** can act as either; defaults to step 3.
- Server-side gates enforced by controllers; mobile gates are UX polish only.

### 3.5 Handoff between nurse and clinician

There is **no explicit handoff button** on the web. The nurse simply completes steps 0–2 (fields saved, auto-marked ✓ in sidebar) and either closes the app or moves on. When the clinician opens the encounter later, they see the ✓ marks and can start from step 3. The encounter stays in status `Open` throughout.

Mobile will match this — no fake "Complete triage" button. A subtle "Steps 0-2 complete" chip on the encounter header is the only visible indicator.

### 3.6 Unified Voice Bar (AI Scribe — steps 0-2)

A single floating voice bar pinned at the top of **Vitals, History, and CC/HPI** only.

Behavior:
1. Nurse taps record → mobile requests mic permission (once) → starts capture
2. Audio chunked every ~5-30 s and streamed to `POST /api/medocs-voice/process-chunk` with `tabKey` set to the current step and `sequenceNumber` incremented per chunk.
3. Server returns `{ transcription, extractedData }`. Extracted data is applied to the current step's fields (e.g. BP / HR values auto-populated on Vitals; HPI narrative inserted on CC/HPI).
4. Transcription text appears in a collapsible panel under the voice bar; user can edit it.
5. Tap stop → final chunk flushed, voice bar returns to idle.

Mobile-specific considerations:
- Use `capacitor-voice-recorder` with foreground service on Android so recording survives screen lock.
- Chunk rotation handled client-side; each chunk uploaded as a multipart FormData POST.
- If network drops mid-session, chunks queue locally and resume on reconnect (keeps sequenceNumber monotonic).
- `previousContext` payload carries recent transcription to give the AI continuity across chunks.

### 3.7 Clinical Note + Record Session (step 3, clinician)

- **Layout on mobile:** single-pane (vertical). On phones the web's side-by-side reference panel collapses into a toggleable drawer.
- **Reference drawer** shows Vitals summary, History summary, CC/HPI — all read-only, scrollable.
- **Record Session** button (distinct from Unified Voice Bar) — captures a full dictation, sends to the dedicated transcription pipeline, produces a drafted clinical note (rich-text HTML).
- **Rich-text** — minimal formatting (bold, italic, lists, headings). Implemented with a compact contentEditable + sanitizer (no heavy HTML editors).
- **Autosave** — debounced PUT on every keystroke. Status indicator: idle / saving / saved at HH:MM.
- **Prior notes for this appointment** pulled via `GET /api/clinical-notes/by-appointment/{aid}` and shown as a subtle "Previous" card at top.

### 3.8 Dx & CPT (step 6, clinician)

Mirrors `rules/technical/dx-and-cpt-codes.md` exactly:

- **Tabs:** ICD-10 / CPT (bottom sheet on mobile — full screen on small viewports)
- **Selected codes** chip row at top, draggable to reorder (ICD order = priority)
- **ICD-10 hard cap: 12** — further additions disabled with a toast
- **AI Suggestions** card — auto-fire on step open; each suggestion has:
  - Code + description
  - Confidence badge (green ≥90, yellow 60-89, gray <60)
  - Rationale expandable row
  - `{prefix}.x ▾` family-expansion pill (tapping opens floating overlay with 3-char family codes)
- **Favorites** card — starred ICD/CPT codes, tap to add
- **Search** — typeahead against `/api/icd-codes/search` or `/api/lookups/cpt-codes`
- **CPT row** — units input inline (default 1), AI rationale as tooltip
- **Auto-refresh CPT suggestions** when ICD selections change
- **Save** — single debounced PUT (800ms) to encounter with both arrays

### 3.9 Checkout (step 7, clinician)

On tap "Complete visit":
1. Client-side validation:
   - ≥1 clinical note exists
   - All notes signed (drafts must be signed now)
   - ≥1 CPT code selected
2. If any draft notes exist, prompt to sign in sequence (signature sheet per note, biometric re-confirm).
3. POST `/api/appointments/{id}/checkout-with-cpt` — server finalizes, creates charges + draft claim.
4. Success screen with "Visit complete" + summary + "Back to schedule".

---

## 4. UI/UX — The Differentiator

(Unchanged from v0.2 — same modern spec.)

- Spacious, minimal, 8pt grid, Inter font, Ionicons
- Light + dark mode both polished v1
- Generous whitespace, 12-16px rounded corners, soft shadows
- Skeleton loaders on all list screens
- Haptic feedback on sign / save / check-in
- Every screen has loading / empty / error states
- Large tap targets (≥48dp), accessibility AA
- Bottom tab bar (4 tabs: Schedule · Notes · Patients · More)
- Bottom-sheet modals over full-screen takeovers where possible
- Subtle offline banner at top when network drops

---

## 5. Tech Stack

| Layer            | Choice                                            | Note |
|------------------|---------------------------------------------------|------|
| Framework        | Angular 20, standalone + signals                  | |
| Mobile shell     | Ionic 8                                           | |
| Native bridge    | Capacitor 8                                       | |
| Language         | TypeScript strict, `noImplicitAny` ON             | |
| State            | Signals for UI + RxJS for streams (voice, SignalR)| |
| HTTP             | `ApiClient` wrapper over HttpClient; one file per domain | |
| Token storage    | Capacitor SecureStorage (keychain / keystore)     | |
| Voice recorder   | `capacitor-voice-recorder` + Android foreground service | Chunked upload to `/api/medocs-voice/process-chunk` |
| Real-time        | `@microsoft/signalr`                              | MobileHub |
| Biometric        | `@aparajita/capacitor-biometric-auth`             | For OTP-less re-auth after first login |
| Push (phase 2)   | `@capacitor/push-notifications` + FCM             | Not v1 |
| Signature        | `angular-signature-pad`                           | |
| Rich text        | Custom contentEditable + DOMPurify                | Minimal, mobile-friendly |
| Error tracking   | Sentry Capacitor SDK                              | Day 1 |
| Logging          | Custom `LoggerService`                            | ESLint bans `console.log` |
| i18n             | `@ngx-translate/core`                             | English v1 |
| Testing          | Jest (unit)                                       | E2E later |
| CI               | GitHub Actions → signed APK                       | |

---

## 6. App Architecture

```
src/
├── app/
│   ├── core/
│   │   ├── auth/               # AuthService, OtpService, BiometricService, RoleGuard
│   │   ├── http/               # ApiClient, interceptors (auth, error, retry, logger)
│   │   ├── realtime/           # SignalR wrapper
│   │   ├── storage/            # SecureStorage wrapper
│   │   ├── logger/             # LoggerService
│   │   ├── voice/              # VoiceRecorderService, ChunkUploader
│   │   └── models/             # DTOs mirroring backend
│   ├── features/
│   │   ├── auth/               # login, OTP, forgot password
│   │   ├── schedule/           # day list, resume-encounter banner
│   │   ├── appointment/        # detail, check-in, start-visit
│   │   ├── encounter/          # THE CORE
│   │   │   ├── wizard/         # stepper shell, sidebar, progress
│   │   │   ├── voice-bar/      # Unified Voice Bar (Vitals/Hx/CC+HPI)
│   │   │   ├── step-vitals/
│   │   │   ├── step-history/
│   │   │   ├── step-cc-hpi/
│   │   │   ├── step-note/
│   │   │   │   ├── record-session/
│   │   │   │   ├── rich-text/
│   │   │   │   └── reference-drawer/
│   │   │   ├── step-orders/
│   │   │   ├── step-prescriptions/
│   │   │   ├── step-codes/     # ICD + CPT picker (critical)
│   │   │   │   ├── ai-suggestions/
│   │   │   │   ├── family-overlay/
│   │   │   │   ├── favorites/
│   │   │   │   └── search/
│   │   │   └── step-checkout/
│   │   ├── notes/              # cross-encounter notes list
│   │   ├── patients/           # list + detail
│   │   └── settings/
│   ├── shared/                 # dumb UI: chips, avatars, buttons, sheets, empty states
│   └── tabs/                   # 4-tab shell
├── environments/
└── theme/
```

**Discipline:**
- `page.ts` ≤ 300 lines; `service.ts` ≤ 400 lines
- No `console.log`; no `: any`
- Every HTTP call via `ApiClient`
- Every screen has loading / empty / error

---

## 7. Feature Plan (v1)

### 7.1 Authentication (unchanged from v0.2)
Login → OTP → optional biometric enrollment → auto-logout after 15 min idle.

### 7.2 Schedule tab
- Today's appointments via `/api/dashboard/appointments`
- Status chips per row
- Resume-encounter banner at top if any encounter is `InProgress` for this user
- Pull-to-refresh
- FAB disabled on mobile v1 (new appointment is admin-only, not typical clinician action)

### 7.3 Appointment detail
- Patient summary, consent status, insurance
- Action buttons change by state:
  - `Scheduled/Confirmed` → "Check in"
  - `CheckedIn` → "Start visit"
  - `InProgress` → "Resume visit"
  - `Completed` → "View signed note"

### 7.4 Encounter wizard — the core (see §3)
- Stepper shell: top progress bar + collapsible sidebar (steps with icons + ✓)
- Swipe between adjacent steps
- Auto-save per step with visible status
- Unified Voice Bar on steps 0-2
- Reference drawer on step 3
- Full-screen ICD/CPT picker on step 6
- Signature sheet in checkout (step 7)
- Exit confirmation if unsaved draft data

### 7.5 Notes tab (cross-encounter)
- Filter chips: All / Drafts / Signed / My unsigned / Missing
- Pull from `GET /api/clinical-notes/paged?providerId=...` (or the equivalent existing paginated endpoint)
- Tapping a draft goes into the encounter's Clinical Note step; tapping a signed note opens read-only view

### 7.6 Patients tab
- List + search (name / MRN / DOB)
- Patient detail: demographics, active problems, recent notes, appointment history (all read-only in v1)

### 7.7 More tab
- Profile, change password, biometric toggle, theme, trusted devices, log out, version

**Explicitly excluded from v1:** appointment scheduling, patient creation, insurance editing, amendment/addendum authoring, cosign inbox, offline edits, push notifications, telehealth video, watch/tablet special layouts.

---

## 8. Lessons from Rehabdox (Avoid, Not Copy)

(Unchanged — 14 flaws to avoid. See v0.2 of this doc or repo history.)

Key ones most relevant now that voice/AI is v1 scope:
- Don't let the voice service balloon to 1400 lines (rehabdox's mistake). Split: `VoiceRecorderService`, `ChunkUploader`, `VoiceSessionState`, `VoiceBarComponent`.
- Don't swallow mic permission denials. Show a clean "Enable microphone in Settings" state with a system-settings deep link.
- Don't leave dangling recordings if the app backgrounds. Use Android foreground service + lifecycle hooks.

---

## 9. Phased Roadmap (v1 with voice/AI in-scope)

v1 is now **~16 weeks** because AI Scribe, Unified Voice Bar, and the full Dx/CPT picker are all in-scope.

| Phase | Duration | Deliverables                                                                                              |
|-------|----------|-----------------------------------------------------------------------------------------------------------|
| **0 — Setup**              | ~1 week  | Scaffold, theming (light+dark), CI, Sentry, logger, env config, ApiClient shell                         |
| **1 — Auth + Schedule**    | ~2 weeks | Login + OTP + biometric, Schedule tab, appointment detail, check-in + start-visit wiring               |
| **2 — Wizard shell + Vitals + History** | ~2 weeks | Stepper shell, role routing, Vitals step with full fields + autosave, History step (all 6 sections) |
| **3 — CC/HPI + Unified Voice Bar**      | ~2 weeks | CC/HPI step, chunked voice capture, process-chunk pipeline, field auto-population, transcription panel |
| **4 — Clinical Note + Record Session**  | ~3 weeks | Note step with rich-text editor, Record Session voice-to-draft, reference drawer, autosave, prior notes |
| **5 — Orders + Rx + Dx/CPT**           | ~3 weeks | Orders + Rx list (simple), full Dx/CPT picker with AI suggestions + family overlay + favorites        |
| **6 — Checkout + Signing**             | ~1 week  | Signature sheet, sign-all-drafts flow, checkout-with-cpt, success screen                              |
| **7 — UI/UX Polish Pass**              | ~2 weeks | Skeletons, empty/error states, animations, accessibility, dark mode polish, haptics                   |
| **8 — Hardening & Beta**               | ~2 weeks | Crash triage, voice edge cases (network drops, perm denials), APK signing, internal dogfood           |

**Phase 7 (polish) is non-negotiable.** It's the difference between "works" and "outclass."

---

## 10. Open Questions for User

1. **Target:** Android phone only, or also tablet in v1? iOS when?
2. **App name / bundle ID:** e.g. `com.medocs.imehr.clinician`?
3. **Brand:** reuse IMEHR web primary hex values?
4. **Device trust duration:** 30 days like web?
5. **Biometric:** on by default after enrollment, or opt-in each session?
6. **Distribution:** direct APK, or Google Play from day 1?
7. **Base URLs:** dev / staging / prod — confirm URLs.
8. **Voice recording max length per session** — is there a web limit we should mirror, or hard-cap mobile separately (battery/data)?
9. **Offline behavior for voice chunks** — queue + resume on reconnect, or fail fast and ask user to retry? (Our preference: queue silently up to N chunks, then warn.)
10. **Nurse role in v1** — confirm both nurse (6) and therapist (7) use the same flow, or does 7 have a different default step?

---

## 11. Next Steps

**No code yet.** Review this document.

On "Go Ahead":
1. Create `rules/technical/mobile-app.md` + `rules/overview/mobile-app.md` in the IMEHR repo.
2. Scaffold Angular+Ionic+Capacitor in `C:\Main\imehr_mobileapp\`.
3. Begin Phase 0.

---

_Document version: 0.3 — 2026-04-22_

_Changes in v0.3:_
- Added **Section 3: The Encounter Flow** — the authoritative 8-step wizard spec, role ownership, Unified Voice Bar, AI Scribe, Dx/CPT picker details.
- Promoted **nurse (role 6/7) to a first-class app user**; the app now targets both nurse and clinician.
- Promoted **AI Scribe / voice / AI ICD/CPT / family overlay / favorites** to v1 scope — "without compromise" per user instruction.
- Removed "Clinical note MVP" Phase 2 and replaced with split Phases 2/3/4/5/6 mirroring the wizard structure.
- Roadmap extended from 12 weeks → ~16 weeks.
- Documented state machine (Appointment + Encounter + ClinicalNote) explicitly.
- Backend endpoint table expanded with check-in / start-visit / checkout-with-cpt / voice-chunk / vitals / history / lookups / favorites / ICD/CPT suggest.
