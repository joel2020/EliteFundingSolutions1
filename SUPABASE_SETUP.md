# Supabase Setup

Project URL:

```text
https://mdrrcrmowurbrwvdsgnq.supabase.co
```

## Required Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://mdrrcrmowurbrwvdsgnq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe for browser use. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed to the frontend.

## Migrations

Local migrations are in `supabase/migrations`.

Current migration set:

```text
001_core_schema
002_leads_businesses_owners
003_applications_deals
004_documents_tasks
005_underwriting_partners_offers
006_contracts_renewals_commissions_messages
007_views_and_functions
008_seed_data
009_security_hardening
010_revoke_anon_execute_on_security_definer_functions
gmail_integration
```

Apply migrations to the linked Supabase project with the Supabase CLI after logging in and linking the project:

```bash
npx supabase login
npx supabase link --project-ref mdrrcrmowurbrwvdsgnq
npx supabase db push
```

## Auth/Profile Bootstrap

The app expects CRM users to have records in `user_profiles`. The schema includes helper functions and policies for profile repair. If a user can authenticate but cannot load CRM data, check that `user_profiles.user_id` matches `auth.users.id` and that `organization_id` is `00000000-0000-0000-0000-000000000001` unless a different organization has been configured.

## Storage

Create a private bucket for CRM and portal documents. The current UI expects document uploads to be stored privately and represented in the `documents` table. Storage policies should require authenticated users and organization-scoped access.

## Security Baseline

RLS is enabled in the migration set for the core public schema tables. Before production launch, run Supabase advisors, confirm policies on every exposed table, and verify that no table is readable by `anon` unless it is explicitly intended for public intake.
