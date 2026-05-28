# CRM Button Audit

Date: 2026-05-28
Repo: `joel2020/EliteFundingSolutions1`

## Access Status

GitHub connector access is confirmed for this private repo with pull and push permissions. Local `git clone` was attempted from the new machine but command-line GitHub auth is not configured, so this audit is currently connector-based.

## Current Confidence

The CRM is not yet certified as fully working end-to-end in production. The codebase has strong mock Playwright coverage for the major CRM workflows, but production button confidence still requires live connected QA against Supabase, Vercel environment variables, storage, auth cookies, and Google Workspace/Gmail credentials.

## Existing Automated Coverage Found

`tests/crm-workflows.spec.ts` covers these important button/workflow areas with mocked CRM APIs:

- Login and logout.
- CRM shell navigation across core CRM routes.
- ISO partner workspace restrictions and document upload.
- Lead create, edit, CSV import, convert, and delete.
- Deal create and stage update.
- Deal detail tabs and empty states.
- Partner application upload, review, PDF generation, application link creation, and sensitive reveal.
- Missing document requests.
- Deal document upload and signed URL preview.
- Notes, lender submission, offers, tasks, earnings, reports, partner creation/delete, user create/edit/delete, and archive restore.

This coverage is valuable, but it is not a substitute for live production-like E2E because mocked handlers can pass while real API routes, RLS, storage policies, or provider credentials fail.

## First Critical Finding

### `Send to Lender` can partially succeed but still present as failure

Files inspected:

- `components/crm/crm-platform.tsx`
- `app/api/crm/deals/[id]/lender-submissions/route.ts`
- `LIVE_E2E_CHECKLIST.md`

Observed behavior:

- The UI expects a fallback path: if the API returns a successful logged submission with `emailDeliveryStatus !== 'sent'` and `emailDraft`, the UI opens a `mailto:` draft and shows the submission as logged.
- The live checklist also says that without Google Workspace connected, the route should log the submission and open a draft fallback instead of claiming the email was sent.
- The API currently hard-fails before creating the submission when Gmail tokens are missing.
- If Gmail is connected but sending fails, the API creates `partner_submissions`, attachment rows, activities, messages, and audit logs, then returns `success: false` with HTTP `502`.
- The UI treats that response as a failure and does not run its fallback branch, close the modal, or reload state. A user may retry and create duplicate lender submission records.

Risk:

- High. This is a core revenue workflow button. It can confuse users, create duplicate submissions, and make audit/history state look inconsistent.

Recommended fix:

- Make the lender submission API return `success: true` once the submission is durably logged, even if Gmail delivery fails or is not connected.
- Include `emailDeliveryStatus`, `emailDraft`, `warnings`, and `emailProviderConfigured` in the success response.
- Reserve `success: false` for cases where the submission was not created, such as invalid payload, forbidden access, failed readiness gate, missing lender email, bad attachments, or database insert failure.
- Update the UI toast copy to distinguish `sent` vs `logged_needs_manual_send` vs `failed_after_log`.

## Button Audit Matrix: Initial Pass

| Area | Button/action | UI wired? | Backend route found? | Mock test? | Production risk |
| --- | --- | ---: | ---: | ---: | --- |
| Leads | Add lead | Yes | Yes: `/api/crm/leads` | Yes | Medium: validate live RLS/schema |
| Leads | Edit lead | Yes | Yes: `/api/crm/leads/[id]` PATCH | Yes | Medium |
| Leads | Convert lead | Yes | Likely: `/api/crm/leads/[id]/convert` | Yes | Medium |
| Leads | Delete lead | Yes | Yes: `/api/crm/leads/[id]` DELETE | Yes | Medium |
| Leads | Import CSV | Yes | Yes: `/api/crm/leads` bulk POST | Yes | Medium: import validation |
| Deals | New deal | Yes | Yes: `/api/crm/deals` | Yes | Medium |
| Deal detail | Stage selector | Yes | Yes: `/api/crm/deals/[id]/stage` | Yes | Medium/high: stage gate must be live-tested |
| Deal detail | Upload document | Yes | Yes: `/api/crm/deals/[id]/documents` | Yes | High: storage/RLS/live file policy |
| Deal detail | Preview/download document | Yes | Yes: `/api/documents/[id]/signed-url` | Yes | High: private bucket access |
| Deal detail | Request missing items | Yes | UI route referenced | Yes | High: email/link/live table validation |
| Deal detail | Add note | Yes | UI route referenced | Yes | Medium |
| Deal detail | Send to lender | Yes | Yes: `/api/crm/deals/[id]/lender-submissions` | Yes | High: fallback mismatch found |
| Deal detail | Generate Elite application PDF | Yes | UI route referenced | Yes | High: PDF generation/storage/live data |
| Deal detail | Send application link | Yes | UI route referenced | Yes | High: email/link behavior |
| Deal detail | Reveal sensitive fields | Yes | UI route referenced | Yes | High: audit/security validation |
| Users | Send invite | Yes | Yes: `/api/crm/users` | Yes | High: Supabase auth admin/email |
| Users | Edit/revoke/resend/delete | Yes | UI routes referenced | Yes | High: auth/admin side effects |
| Archive | Restore lenders/brokers/users | Yes | UI routes referenced | Yes | Medium/high: role gates |
| Partners | Create/delete funder | Yes | Yes: `/api/crm/partners`, `/api/crm/partners/[id]` | Yes | High: external invite/email side effects |
| Reports | Export CSV/report pack | Yes | Client-side | Yes | Low/medium |
| Sidebar | Logout | Yes | Supabase client auth | Yes | Medium: session redirect live-test |

## Next Recommended Work

1. Patch the lender submission route and UI fallback semantics.
2. Use the Supabase connector to validate the production schema, RLS policies, storage bucket, and required tables for all CRM API routes.
3. Use the Vercel connector to inspect production/preview environment variables and runtime logs around lender submissions, document uploads, Gmail, and application links.
4. Run live E2E against a Vercel preview with test data using `LIVE_E2E_CHECKLIST.md`.
