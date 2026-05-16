# Elite Funding Solutions Platform Remediation Plan

## Architecture Map

The app is a Next.js App Router project currently running Next `13.5.11`, React, TypeScript, Tailwind, Supabase Auth/Postgres/Storage, and Playwright. Public marketing routes live under `app/(public)`, CRM routes under `app/(crm)`, portal routes under `app/(portal)`, API routes under `app/api`, shared CRM shell code in `components/crm`, shared UI primitives in `components/ui`, and Supabase migrations in `supabase/migrations`.

Core domain entities are `leads`, `businesses`, `owners`, `applications`, `deals`, `documents`, `document_requests`, `underwriting_reviews`, `funding_partners`, `partner_submissions`, `offers`, `contracts`, `renewals`, `commissions`, `commission_recipients`, `tasks`, `notes`, `activities`, `messages`, `audit_logs`, `user_profiles`, `iso_brokers`, and `deal_risk_events`.

## Highest-Risk Findings

1. Several CRM screens still mutate Supabase directly from browser components. RLS now has stronger database coverage, but production workflows should continue moving writes behind server APIs for authorization, validation, audit logging, and consistent error handling.
2. Reporting calculations now have a SQL source of truth through the applied reporting view, but some React screens still perform local aggregation for display.
3. Workflow rules were partially enforced in UI only. Critical stage transitions now have server-side guards, with more browser mutation routes still queued for server API conversion.
4. Fit Check validation could expose invalid states too early. Field-level error timing and accessibility were corrected so default select values do not render as invalid before interaction or submit.
5. Placeholder CRM notification UI was removed and replaced with a live task/follow-up route.
6. Production Supabase migrations for `mdrrcrmowurbrwvdsgnq` were applied through MCP after direct connection attempts were blocked by network/password constraints.

## Current Remediation Pass

This pass prioritizes production blockers with small, reviewable changes:

1. Production Supabase migrations were applied and the public ID migration was corrected to avoid collisions on existing seeded deals.
2. Funding partner creation runs through `/api/crm/partners` with role checks, validation, audit logs, and activity logs.
3. Placeholder notification copy was removed from the CRM shell and replaced with a task/follow-up route.
4. Funding Fit Check validation, accessibility, placeholder text, and no-sensitive-data reassurance were refined.
5. Schema guardrails, public ID indexes, workflow models, CRM notifications, reporting indexes, and a reporting metrics view are live.
6. Authenticated CRM and portal mutation routes now reject cross-origin browser writes before running privileged server logic.
7. Deal stage and funded risk-event APIs now share a server-side workflow validator for accepted offer, required document, funded amount, terminal-stage, and role checks.
8. Lender package signed links were reduced from seven days to 24 hours.
9. Generic email sending now requires CRM authentication instead of accepting anonymous public requests.

## File-by-File Action Plan

`lib/server-auth.ts`: add a shared same-origin guard for authenticated mutation routes.

`lib/crm-workflow.ts`: add the shared CRM stage transition validator.

`app/api/crm/deals/[id]/stage/route.ts`: enforce stage transition rules server-side and write status history, activities, and audit logs.

`app/api/crm/deals/[id]/risk-events/route.ts`: block invalid funded events and synchronize funded/default/closed-not-funded deal state.

`app/api/crm/deals/[id]/commissions/route.ts`: require same-origin writes before commission recipient creation.

`app/api/crm/deals/[id]/lender-submissions/route.ts`: require same-origin writes and shorten fallback signed document links to 24 hours.

`app/api/documents/[id]/signed-url/route.ts`: require same-origin writes before creating document preview/download URLs.

`app/api/documents/[id]/route.ts`: require same-origin writes before document deletion.

`app/api/crm/deals/route.ts`, `app/api/crm/partners/route.ts`, `app/api/crm/iso-brokers/route.ts`, `app/api/crm/applications/[id]/status/route.ts`, `app/api/crm/users/route.ts`, `app/api/crm/users/[id]/route.ts`: require same-origin writes on authenticated CRM mutations.

`app/api/portal/documents/route.ts`, `app/api/portal/messages/route.ts`, `app/api/portal/offers/[id]/accept/route.ts`: require same-origin writes on authenticated client portal mutations.

`app/api/email/send/route.ts`, `app/api/gmail/send/route.ts`: require same-origin writes, and require CRM authentication for the generic email provider route.

`next.config.js`: remove production `unsafe-eval` from the Content Security Policy while preserving development compatibility.

`app/api/crm/partners/route.ts`: add audited, role-checked funding partner creation API with Zod validation.

`app/(crm)/crm/partners/page.tsx`: replace direct browser insert with server API call and actionable errors.

`components/crm/topbar.tsx`: remove “coming soon” notification placeholder and route users to live task follow-ups.

`app/(public)/funding-fit-check/funding-fit-check-form.tsx`: add field-level validation, delayed error visibility, accessible error descriptions, and stronger trust microcopy.

`supabase/migrations/20260516043847_platform_readiness_hardening.sql`: add additive production guardrails, indexes, workflow rules, CRM notification table, reporting metrics view, and collision-safe public ID backfills.

## Remaining Work Queue

The next pass should move these browser mutations behind APIs: lead create/update/convert, deal document upload/status updates, checklist updates, notes, lender submission status updates, offer creation, tasks, messages, and global document uploads.

The reporting dashboard should continue moving display calculations to `crm_reporting_metrics` so duplicate React-side aggregation can be removed.

The marketing site needs a dedicated conversion pass: stronger trust proof, case-study blocks, partner proof, schema, internal linking, metadata cleanup, and mobile screenshots.

The security pass still needs a full policy-by-policy Supabase review: RLS predicate review, storage policy test, service-role audit, and Data API exposure checks.

## Production Readiness Score

Current repo readiness after this pass: `82/100`.

Code is building and major workflow foundations are in place. The main gaps are remaining direct-browser mutations, a deeper marketing conversion pass, and full end-to-end verification against production Supabase.

## Launch Checklist

`PASS` TypeScript build and production build.

`PASS` Broker creation no longer relies on direct browser inserts.

`PASS` Lender submissions generate completed lender application PDFs and send through provider when configured.

`PASS` Fit Check preserves no SSN/EIN/bank-statement promise.

`PASS` Placeholder notification button removed.

`PARTIAL` Funding partner creation moved to audited server API.

`PASS` Reporting source of truth added as a production Supabase view.

`PASS` Live Supabase migrations applied through MCP.

`PARTIAL` Authenticated CRM and portal server mutations have same-origin guards.

`PARTIAL` Critical deal stage and funded-event transitions are enforced server-side.

`FAIL` Remaining CRM browser-side mutations still need server API remediation.

`FAIL` Full live E2E against production Supabase is not yet verified.
