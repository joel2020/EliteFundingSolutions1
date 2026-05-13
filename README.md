# Elite Funding Solutions

Production Next.js CRM and public funding platform for Elite Funding Solutions.

## Stack

- Next.js 13 App Router
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui style component system
- Supabase Auth, Database, Storage
- Gmail OAuth integration scaffold
- Resend email route scaffold
- Recharts reporting

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example` and fill in the real keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://mdrrcrmowurbrwvdsgnq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GMAIL_ENCRYPTION_KEY=
OPENAI_API_KEY=
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

Run the app:

```bash
npm run dev
```

Verify before deploy:

```bash
npm run lint
npm run type-check
npm run build
```

## Current Product Surface

Public site routes include `/`, `/apply`, `/contact`, and `/faq`.

CRM routes include `/crm`, `/crm/leads`, `/crm/businesses`, `/crm/owners`, `/crm/applications`, `/crm/pipeline`, `/crm/documents`, `/crm/underwriting`, `/crm/offers`, `/crm/contracts`, `/crm/commissions`, `/crm/renewals`, `/crm/reports`, `/crm/messages`, `/crm/settings`, `/crm/users`, `/crm/tasks`, `/crm/partners`, and `/crm/iso-brokers`.

Client portal route is `/portal`.

Gmail API routes include `/api/gmail/auth`, `/api/gmail/callback`, and `/api/gmail/send`.

## Production Notes

The app builds successfully with placeholder-free owner and message CRM screens. Real production use still requires valid Supabase keys, database migrations applied to the target project, Google OAuth credentials, storage buckets/policies, and live email/SMS provider credentials.

Never place service role keys, Gmail refresh tokens, encryption keys, or provider secrets in `NEXT_PUBLIC_` variables.
