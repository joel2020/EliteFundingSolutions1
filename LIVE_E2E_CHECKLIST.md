# Live E2E Checklist

Run this only against production or a production-like Vercel preview connected to Supabase project `mdrrcrmowurbrwvdsgnq`. Use test merchant data only. Do not use real SSNs, EINs, DOBs, or bank statements unless the production privacy process is active.

## Setup

Test users:

- Admin CRM user with role `admin` or `super_admin`.
- Sales CRM user with role `sales_rep`.
- Processor or underwriter user.
- Client portal user linked to a test owner/application.

Test files:

- One small PDF under 10 MB.
- One PNG or JPEG under 10 MB.
- No real bank statements unless approved for production testing.

Migration prerequisite:

1. Open `supabase/migrations/20260516075153_final_production_readiness_hardening.sql`.
2. Copy the actual SQL contents.
3. Paste the SQL contents into Supabase Dashboard SQL Editor as project owner/admin.
4. Do not paste the file path into SQL Editor.
5. Re-run Supabase advisors before starting live E2E.

If storage policy SQL is blocked, keep `application-documents` private and continue testing through the app only. The app routes use server-side storage access for uploads, previews, downloads, and lender packages, so live CRM testing does not require direct browser access to `storage.objects`.

Email prerequisite:

1. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the production Google OAuth callback URL in Vercel.
2. Connect Google Workspace from `/crm/settings` for each CRM user who will send lender packages.
3. Add a funding partner with `submission_email` or `email`.
4. If Google Workspace is not connected for the sender, the lender route should log the submission and open a draft fallback instead of claiming the email was sent.

## Public Application Form Validation

1. Open `/apply`.
2. Try to continue with required fields empty.
3. Expected: browser validation blocks progress and no database rows are created.

## Public Application Submission API

1. Complete `/apply` with test data and upload a PDF.
2. Submit.
3. Expected UI: application submitted success state.
4. Expected records: one `businesses`, one or more `owners`, `business_owners`, one `leads`, one `applications`, one `deals`, one or more `documents`, one `deal_status_history`, one `activities`, and one `audit_logs`.
5. Expected storage: each uploaded `documents.storage_path` starts with the production organization ID and application ID.
6. Expected security: full SSN/EIN/DOB are not visible in public CRM table columns.

## Document Upload Flow

1. Open the created deal in `/crm/deals/[id]`.
2. Upload a PDF from the Documents tab.
3. Expected records: new `documents` row with `deal_id`, `application_id`, `organization_id`, and `storage_path`.
4. Expected storage: object exists in `application-documents`, bucket remains private.
5. Preview the document.
6. Expected: signed URL opens and expires quickly. URL is not saved in any database field.

## CRM Login And Access Gating

1. Visit `/crm` while logged out.
2. Expected: redirect to `/login`.
3. Log in as admin.
4. Expected: CRM dashboard loads.
5. Log in as client.
6. Expected: CRM access is rejected.

## Unauthorized CRM Rejection

1. Call a CRM write route without cookies, such as `POST /api/crm/deals`.
2. Expected: `401`.
3. Call the same route with a client profile.
4. Expected: `403`.
5. Call with a cross-origin `Origin` header.
6. Expected: `403`.

## Lead Workflow

1. Create a lead in `/crm/leads`.
2. Update the lead.
3. Convert the lead to a deal.
4. Expected records: `leads` updated, new `businesses` as needed, new `deals`, `deal_status_history`, `activities`, and `audit_logs`.

## Deal Workflow

1. Create a deal in `/crm/deals`.
2. Open the deal command center.
3. Confirm all tabs render: Overview, Readiness, Documents, Notes, Lenders Sent To, Offers, Finance, Tasks, Activity.
4. Expected: deal details show merchant, amount, owner/rep, stage, documents, lenders, offers, notes, and tasks.

## Notes, Tasks, Checklist

1. Add a deal note.
2. Create a deal task.
3. Update a checklist item.
4. Complete a task.
5. Expected records: `notes`, `tasks`, `document_requests` as applicable, `activities`, and `audit_logs`.

## Lender Submission

1. From the deal page, select a funding partner.
2. Select allowed documents.
3. Submit to lender.
4. Expected records: `partner_submissions`, `lender_submission_attachments`, `documents` for generated package if applicable, `messages`, `activities`, and `audit_logs`.
5. Expected email: with Google Workspace connected for the sender, the lender receives the email from that user's mailbox with the generated application and selected attachments, or 24-hour secure links if the package is too large for direct attachment.
6. Expected fallback: without Google Workspace connected for the sender, the CRM logs the submission and opens an email draft. This is not a direct-send pass.
7. Expected UI: lender appears in Lenders Sent To on the deal.

## Submission Outcome

1. Update lender submission status and outcome.
2. Expected records: `partner_submissions` updated, activity and audit log written.

## Offer Workflow

1. Create an offer from a lender submission.
2. Present the offer.
3. Log in as linked client and accept or decline if available.
4. Expected records: `offers` status changes, `activities`, and `audit_logs`.
5. Expected UI: offer appears on deal and portal.

## Stage Validation

1. Try to move a deal to a restricted stage before requirements are met.
2. Expected: API rejects with validation message.
3. Complete required conditions and retry.
4. Expected: stage updates and `deal_status_history` records the transition.

## Funded-Stage Validation

1. Try to mark funded without accepted offer, complete documents, or funded amount.
2. Expected: rejection.
3. Add required data and retry as an authorized role.
4. Expected: deal becomes funded, `funded_at` is set, and logs are written.

## User And Admin Management

1. As admin, create a CRM user.
2. Update the user role/status.
3. As sales rep, open `/crm/users`.
4. Expected: sales rep cannot create users.

## ISO Broker And Referral Link

1. Create an ISO broker in `/crm/iso-brokers`.
2. Copy/open referral link.
3. Submit a test application through that link.
4. Expected records: `iso_brokers`, application/deal rows with ISO referral fields populated.

## Funding Partner

1. Create a funding partner in `/crm/partners`.
2. Use that partner in a lender submission.
3. Expected: partner appears in CRM and on the deal lender tracking tab.

## Gmail And Email Auth Requirements

1. Call `POST /api/gmail/send` logged out.
2. Expected: `401`.
3. Call as client.
4. Expected: `403`.
5. Call as CRM user without Gmail connected.
6. Expected: authenticated error explaining Gmail is not connected.

## Storage Signed URL Auth Requirement

1. Call `POST /api/documents/[id]/signed-url` logged out.
2. Expected: `401`.
3. Call as CRM user from another organization if available.
4. Expected: `404` or `403`.
5. Call as authorized CRM user.
6. Expected: signed URL returned with short expiry and audit log written.

## Pass Criteria

The live pass is complete only when all critical flows above pass, all expected records exist, no sensitive fields are exposed in UI/API responses, and document access uses short-lived signed URLs only.
