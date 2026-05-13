# QA Report

Date: 2026-05-12

## Verification Commands

```bash
npm run lint
npm run type-check
npm run build
```

## Results

`npm run lint` passes with no warnings or errors.

`npm run type-check` passes.

`npm run build` passes and generates 28 static/app routes plus runtime API routes.

`npx next start -p 3010` starts successfully and reports ready on `http://localhost:3010`.

## Routes Confirmed By Build

Public routes:

```text
/
/apply
/contact
/faq
```

Auth route:

```text
/login
```

CRM routes:

```text
/crm
/crm/applications
/crm/businesses
/crm/commissions
/crm/contracts
/crm/documents
/crm/iso-brokers
/crm/leads
/crm/messages
/crm/offers
/crm/owners
/crm/partners
/crm/pipeline
/crm/renewals
/crm/reports
/crm/settings
/crm/tasks
/crm/underwriting
/crm/users
```

Portal route:

```text
/portal
```

API routes:

```text
/api/email/send
/api/gmail/auth
/api/gmail/callback
/api/gmail/send
```

## Known Warnings

Build reports outdated Browserslist data.

Build reports `/crm/settings` deopts into client-side rendering. This is acceptable for the current client-heavy settings page, but it can be improved later with Suspense boundaries or server-side data separation.

`npm audit` reports 5 remaining vulnerabilities after non-breaking fixes. The available automated fix requires a breaking Next 16 upgrade, so this should be handled in a separate framework upgrade pass.

## Functional Gaps

Gmail OAuth routes exist and are runtime-only, but real Gmail sync/send requires Google OAuth credentials, token encryption, and live database validation.

Email sending fails gracefully without `RESEND_API_KEY`.

SMS/Twilio variables are documented, but full SMS send/receive workflow is not implemented in this pass.

AI variables are documented, but AI features are not implemented in this pass.

Supabase migrations are present locally, but remote application was not verified from this environment.
