# Elite Funding Solutions Production QA Checklist

Use this checklist before each production deployment.

## Platform Build and Static Quality
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Verify no browser console errors on: `/`, `/apply`, `/login`, `/crm`.

## Auth and Invite Flow
- [ ] Admin can create user from **CRM > Users & Access**.
- [ ] Invite email is delivered with valid link.
- [ ] Invite link opens `/set-password` and allows password creation.
- [ ] Invite acceptance updates profile and access status.
- [ ] Broker/ISO invited user can access CRM after password setup.
- [ ] Inactive/revoked users are blocked from login.

## Broker/ISO Application Link Flow
- [ ] Admin can create ISO/Broker with generated apply link.
- [ ] Admin can copy broker link.
- [ ] Broker can view and copy own application link.
- [ ] Public broker link submission attributes lead/application/deal to broker.
- [ ] Broker only sees own submissions.

## Application and Intake Flow
- [ ] Public application submits successfully with required fields.
- [ ] EIN validation enforces exactly 9 digits (formatting removed).
- [ ] SSN capture/validation works and is not exposed in logs.
- [ ] Signature is captured and stored.
- [ ] Bank statements upload and attach to deal.
- [ ] Partner upload intake stores original partner application.

## Deal Operations and Underwriting
- [ ] Deal detail displays applicant, business, source, docs, notes, submissions.
- [ ] Human review checklist gates lender submission until complete (or admin override).
- [ ] Lender send flow allows selective document selection.
- [ ] Lender submission history is tracked.
- [ ] Duplicate history view shows prior submissions where available.

## Documents and Storage
- [ ] Deal documents can be uploaded by allowed roles.
- [ ] Preview/download uses secure access pattern.
- [ ] Document categories appear correctly (bank statements, IDs, partner app, etc.).

## Finance and Commission
- [ ] Commission recipients can be added on deal finance tab.
- [ ] Risk/default events can be added and displayed.
- [ ] Funded amount and payout statuses render correctly.

## Access Controls
- [ ] Admin sees all CRM sections and records.
- [ ] Broker/ISO cannot see other brokers' deals.
- [ ] Funder view is scoped to intended submissions only.
- [ ] Viewer role is read-only in permitted areas.

## Release Notes
Record test date, tester, environment, and unresolved issues before deploy.
