# Production Readiness

## Project Overview

Elite Funding Solutions is a Next.js MCA and business funding platform with a public funding site, secure application intake, document upload, CRM command center, portal flows, Gmail integration, and Supabase-backed workflow/audit data.

Current production Supabase project: `mdrrcrmowurbrwvdsgnq`, named `Elite Funding Solution`, region `us-east-2`.

## Production URLs

Set these before launch:

- Public site: `https://elitefundingsolution.com`
- Vercel production URL: confirm in Vercel after final deployment.
- Supabase URL: `https://mdrrcrmowurbrwvdsgnq.supabase.co`
- CRM: `/crm`
- Client portal: `/portal`
- Public application: `/apply`

## Repository

GitHub: `joel2020/EliteFundingSolutions1`

## Required Environment Variables

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FIELD_ENCRYPTION_KEY`
- `FIELD_LOOKUP_PEPPER`
- `RESEND_API_KEY`, for public/contact/system notifications unless fully replaced
- `SENDER_EMAIL`, for public/contact/system notifications unless fully replaced
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `ADMIN_EMAIL`
- `ROHAN_SUPERADMIN_EMAIL`

Configured but optional unless the related feature is enabled:

- `E2E_AUTH_BYPASS`, local/CI only
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `OPENAI_API_KEY`, not used by the current launch-critical app paths

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `FIELD_ENCRYPTION_KEY`, Gmail tokens, SSNs, EINs, DOBs, bank statements, or storage signed URLs through `NEXT_PUBLIC_` variables.

## Vercel Setup Checklist

- Production project points to `joel2020/EliteFundingSolutions1`.
- Production branch is `main`.
- Build command is `npm run build`.
- Install command is `npm ci`.
- Node version is compatible with Next 13 and the current lockfile.
- All required environment variables above are set in Production and Preview as appropriate.
- `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` use the production custom domain.
- Domain `elitefundingsolution.com` is assigned and SSL is active.
- Vercel deployment protection is configured for preview environments.
- No secret values are printed in build logs.

## Supabase Setup Checklist

- Project ID is `mdrrcrmowurbrwvdsgnq`.
- Database is healthy.
- Migrations are applied through the latest production-readiness migration.
- RLS remains enabled on public tables.
- Sensitive tables have no broad anon access.
- `application_sensitive_data` remains restricted to admin, super admin, and underwriter read access, with write access limited to admin and super admin.
- `rate_limits` is server-only. Browser roles have no grants and no anon/authenticated policies.
- SECURITY DEFINER functions used by RLS live in the private schema where possible.
- Public SECURITY DEFINER helper functions are not executable by normal authenticated browser clients.

## Applying The Final Supabase Migration

The final hardening migration modifies `storage.objects` policies. The Codex/Supabase MCP role may fail with `ERROR: 42501: must be owner of relation objects`. Apply it from Supabase Dashboard SQL Editor as a project owner/admin, or through the Supabase CLI/direct database connection using an owner-capable role.

Migration file:

`supabase/migrations/20260516075153_final_production_readiness_hardening.sql`

In SQL Editor, paste the actual SQL contents of the file. Do not paste the file path. After it runs, verify storage policies, security advisors, and bucket privacy before launch.

If the storage policy section cannot be applied before launch, keep the bucket private and keep all document operations server-mediated. The current CRM, portal, public application, document signed URL, and lender submission routes use authenticated server APIs and service-role storage access, so browser clients do not need direct `storage.objects` permissions to upload, preview, download, or package lender documents. Do not add broad anon/authenticated storage policies as a workaround.

## Supabase Auth Manual Settings

- Enable leaked password protection in Supabase Auth if the project plan exposes that control.
- If leaked password protection is unavailable, use compensating controls: strong CRM password policy, short JWT lifetime, limited admin seats, MFA where available, immediate deactivation of departed users, and audit log review for sensitive actions.
- Confirm email auth settings and templates.
- Confirm production redirect URLs include:
  - `https://elitefundingsolution.com/auth/callback`
  - `https://elitefundingsolution.com/api/gmail/callback`
  - the active Vercel production domain equivalents
- Remove stale localhost redirect URLs from production unless needed for a controlled admin workflow.
- Keep JWT expiry short enough for a financial workflow and validate sensitive operations server-side.

## Storage Bucket Checklist

Bucket: `application-documents`

- Private bucket: required.
- File size limit: 10 MB.
- Allowed MIME types: PDF, JPEG, PNG, HEIC, HEIF.
- No anonymous object policy.
- No public read access.
- CRM object access is limited by organization.
- Portal object access is limited to the related client owner/application.
- Preview/download signed URLs should use 15 minutes or less. Current CRM document preview/download route uses 120 seconds.
- Lender package signed URLs must never exceed 24 hours. Current lender package setting must remain at or below 86,400 seconds.
- Signed URLs must not be persisted in database records, audit logs, or client-visible documents.

## First Admin User

1. Create the admin auth user in Supabase Auth.
2. Insert or update the matching `public.user_profiles` row with the production organization ID, active status, and role `super_admin` or `admin`.
3. Confirm the user can log in at `/login`.
4. Confirm `/crm/users` is visible.
5. Confirm a sales rep cannot access user creation controls.

## CRM User Management

Admins manage CRM users from `/crm/users`. Use active roles only: `super_admin`, `admin`, `manager`, `sales_rep`, `underwriter`, `processor`, `viewer`, `iso_broker`, or `client`. Do not use profile repair functions from the browser.

## Application Submission Test

1. Open `/apply`.
2. Complete business, owner, funding, consent, and bank statement fields.
3. Submit with a PDF under 10 MB.
4. Expected records: `businesses`, `owners`, `business_owners`, `leads`, `applications`, `deals`, `documents`, `deal_status_history`, `activities`, and `audit_logs`.
5. Expected storage path: uploaded files should be under `organization_id/application_id/...` inside `application-documents`.
6. Confirm SSN/EIN/DOB are encrypted or masked and not visible in regular CRM tables.

## CRM Deal Workflow Test

1. Log in as an internal CRM user.
2. Create or open a deal.
3. Add a note from the deal page.
4. Upload a document from the deal page.
5. Create a task from the deal page.
6. Submit the deal to a funding partner.
7. Create an offer from a lender submission.
8. Present the offer.
9. Move stages only when workflow rules allow it.
10. Mark funded only after accepted offer, required documents, and funded amount requirements are met.
11. Expected records: `notes`, `documents`, `tasks`, `partner_submissions`, `lender_submission_attachments`, `offers`, `deal_status_history`, `activities`, and `audit_logs`.

## Lender Submission Tracking

Use the deal detail page, not a global folder. Each deal must show lenders sent to, selected documents, generated lender application package, status, response, and outcome.

## Offer And Contract Workflow

Offers are created through authenticated CRM APIs. Presented and accepted statuses must write activity and audit logs. Client acceptance must be scoped to the client-owned application. Contract sending is server-routed and same-origin protected.

## Document Upload And Download

Documents upload through server routes. The browser receives only short-lived signed URLs after CRM or portal authorization. Do not email raw document URLs except lender package signed URLs with a strict TTL.

## Gmail And Email Integration

Gmail auth, status, disconnect, and send routes require authenticated CRM users. Gmail token reads/deletes are not performed directly from browser Supabase clients. Confirm Google OAuth redirect URL exactly matches the production callback.

Lender email sending uses the CRM lender submission route and the connected Google Workspace account for the CRM user sending the package. It generates the completed application PDF, pulls selected private documents server-side, attaches files directly when under the Gmail-safe size limit, falls back to 24-hour signed links for oversized packages, records the submission/audit trail, and sends through Gmail from the user's connected Workspace mailbox. If the user has not connected Google Workspace, the route logs the submission and returns a mail draft fallback instead of requiring browser storage access.

## Supabase Advisor Status

Fixed by the final hardening migration:

- `public.rate_limits` RLS enabled with no policies, now documented as server-only with service-role policy and no browser grants.
- `public.update_gmail_tokens_updated_at` mutable search path.
- Public SECURITY DEFINER execute exposure for `current_user_org_id`, `current_user_role`, `get_dashboard_metrics`, and `repair_user_profile`.
- High-impact missing FK indexes for launch-critical workflow tables.

Manual remaining:

- Leaked password protection should be enabled if available. If unavailable, document the compensating controls above as accepted launch risk.
- Re-run Supabase security and performance advisors after applying the migration.

## Known Limitations

- Live CRM verification requires real Supabase Auth users and production Vercel environment variables.
- E2E tests use mocked Supabase/route fixtures for repeatability and do not prove production Google OAuth or Gmail deliverability.
- Lender package links are still signed URLs sent by email and must be kept at or below 24 hours.
- Some legacy CRM list pages still read directly from Supabase using RLS, but browser mutations have been moved behind API routes.

## Manual Launch Checklist

- Apply latest migration to production Supabase.
- Re-run Supabase security advisor.
- Re-run Supabase performance advisor.
- Enable leaked password protection if available, or document the compensating controls and accepted risk.
- Confirm Auth redirect URLs.
- Confirm storage bucket settings.
- Confirm each CRM user who sends lender packages connects Google Workspace from `/crm/settings`.
- Confirm Vercel environment variables.
- Run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e:ci`.
- Complete `LIVE_E2E_CHECKLIST.md` against production or a protected production-like preview.

## Rollback Notes

- Revert the Vercel deployment to the previous known-good deployment if app behavior regresses.
- For database rollback, prefer a forward migration restoring prior grants/policies only after identifying the failing policy. Do not disable RLS as a rollback.
- Rotate any exposed secrets immediately if logs or URLs leak sensitive material.

## Post-Launch Monitoring

- Watch Vercel function errors and slow routes.
- Watch Supabase API, Auth, Storage, and Postgres logs.
- Check failed application submissions daily during launch week.
- Review audit logs for document signed URL creation.
- Review Gmail send failures and token refresh errors.
- Monitor advisor warnings after schema changes.
