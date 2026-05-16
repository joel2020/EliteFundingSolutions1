# Elite Funding Solutions Platform Remediation Plan

## Architecture Map

The app is a Next.js App Router project currently running Next `13.5.11`, React, TypeScript, Tailwind, Supabase Auth/Postgres/Storage, and Playwright. Public marketing routes live under `app/(public)`, CRM routes under `app/(crm)`, portal routes under `app/(portal)`, API routes under `app/api`, shared CRM shell code in `components/crm`, shared UI primitives in `components/ui`, and Supabase migrations in `supabase/migrations`.

Core domain entities are `leads`, `businesses`, `owners`, `applications`, `deals`, `documents`, `document_requests`, `underwriting_reviews`, `funding_partners`, `partner_submissions`, `offers`, `contracts`, `renewals`, `commissions`, `commission_recipients`, `tasks`, `notes`, `activities`, `messages`, `audit_logs`, `user_profiles`, `iso_brokers`, and `deal_risk_events`.

## Highest-Risk Findings

1. Several CRM screens still mutate Supabase directly from browser components. RLS exists, but production workflows need server APIs for authorization, validation, audit logging, and consistent error handling.
2. Reporting calculations are duplicated in React and SQL functions/views. This creates inconsistent metric risk as the system grows.
3. Workflow rules are partially enforced in UI only. Critical transitions like funded/defaulted and lender submission need server-side state machine checks.
4. Fit Check validation was form-level only and could expose invalid states too early. Field-level error timing and accessibility needed refinement.
5. Placeholder UI existed in the CRM topbar for notifications. Production surfaces should link to live operational queues or be removed.
6. Live Supabase migration application remains blocked by project permissions for `mdrrcrmowurbrwvdsgnq`.

## Current Remediation Pass

This pass prioritizes production blockers with small, reviewable changes:

1. Move funding partner creation behind `/api/crm/partners`.
2. Replace placeholder notification control with a real link to task/follow-up operations.
3. Refine Funding Fit Check validation, accessibility, placeholder text, and no-sensitive-data reassurance.
4. Add schema guardrails for public IDs, stage transition rules, CRM notifications, reporting indexes, and a single reporting view.
5. Preserve the already implemented lender package generation flow with completed application PDF and explicit attachment selection.

## File-by-File Action Plan

`app/api/crm/partners/route.ts`: add audited, role-checked funding partner creation API with Zod validation.

`app/(crm)/crm/partners/page.tsx`: replace direct browser insert with server API call and actionable errors.

`components/crm/topbar.tsx`: remove “coming soon” notification placeholder and route users to live task follow-ups.

`app/(public)/funding-fit-check/funding-fit-check-form.tsx`: add field-level validation, delayed error visibility, accessible error descriptions, and stronger trust microcopy.

`supabase/migrations/20260516043847_platform_readiness_hardening.sql`: add additive production guardrails, indexes, workflow rules, CRM notification table, and reporting metrics view.

## Remaining Work Queue

The next pass should move these browser mutations behind APIs: lead create/update/convert, deal document upload/status updates, checklist updates, notes, lender submission status updates, offer creation, tasks, messages, and global document uploads.

The reporting dashboard should read from `crm_reporting_metrics` after the migration is live, then duplicate React-side aggregation should be removed.

The marketing site needs a dedicated conversion pass: stronger trust proof, case-study blocks, partner proof, schema, internal linking, metadata cleanup, and mobile screenshots.

The security pass still needs live Supabase verification: RLS policy review, storage policy test, signed URL TTL test, service-role audit, and Data API exposure checks.

## Production Readiness Score

Current repo readiness after this pass: `72/100`.

Code is building and major workflow foundations are in place. The main gap is not code shape anymore; it is live database migration access, remaining direct-browser mutations, and end-to-end verification against production Supabase.

## Launch Checklist

`PASS` TypeScript build and production build.

`PASS` Broker creation no longer relies on direct browser inserts.

`PASS` Lender submissions generate completed lender application PDFs and send through provider when configured.

`PASS` Fit Check preserves no SSN/EIN/bank-statement promise.

`PASS` Placeholder notification button removed.

`PARTIAL` Funding partner creation moved to audited server API.

`PARTIAL` Reporting source of truth added as migration, pending live DB apply.

`FAIL` Live Supabase migrations cannot be applied from this machine due project permissions.

`FAIL` Remaining CRM browser-side mutations still need server API remediation.

`FAIL` Full live E2E against production Supabase is not yet verified.
