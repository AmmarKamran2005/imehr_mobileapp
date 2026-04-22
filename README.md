# IMEHR Mobile App

Mobile companion app for the IMEHR web system — for clinicians and nurses.

**Stack:** Angular 20 · Ionic 8 · Capacitor 8 · TypeScript (strict)

## Status

Pre-implementation phase. Contents:

- `IMEHR_MOBILE_APP_ANALYSIS_AND_PLAN.md` — authoritative plan mirroring the web system flow
- `mockup/` — clickable HTML prototype for flow and UI/UX validation (open `mockup/index.html` in a browser)

## Scope

The app mirrors the existing IMEHR web encounter flow and terminology. Backend is consumed **as-is** (no schema changes). Core v1 surface:

1. Login + OTP + biometric
2. Schedule (today's appointments, Active Visit banner)
3. Appointment detail (Check In → Start Visit → Resume Visit)
4. Encounter wizard — 8 steps: Vitals, History Review, CC & HPI, Clinical Note, Orders & Referrals, Prescriptions, Dx & CPT Codes, Checkout
5. Unified Voice Bar (AI Scribe) on Vitals / History Review / CC & HPI
6. Record Session (AI-drafted note) on Clinical Note step
7. Patient chart with 15-tab layout (Overview, Problems, Medications, Allergies, Vitals, Immunizations, History, Insurance, Encounters, Prescriptions, Orders, Attachments, Consent, **Appt / Notes**, Finance)
8. Clinical notes live under Patient → Appt / Notes → Clinical Notes sub-tab
9. Amendment / Addendum workflow on signed notes (24h window for amendments)

## Roles

- **Clinician** (role 2) — default step 3 (Clinical Note), full access to all steps
- **Nurse / MA** (role 6/7) — default step 0 (Vitals), limited to steps 0-2

Admin role is not targeted for this mobile app.

## Out of scope (v1)

- Appointment creation / scheduling (web only)
- Billing / claims
- Portal features
- In-app telehealth video

## Running the mockup

```
cd mockup
python -m http.server 5178
```

Open http://localhost:5178
