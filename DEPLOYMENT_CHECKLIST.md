# Deployment Checklist

## Preflight

- `npm install` completes.
- `npm run lint` passes.
- `npm run type-check` passes.
- `npm run build` passes.
- `.env.local` is not committed.
- Vercel or Netlify environment variables match `.env.example`.
- Supabase migrations are applied to `mdrrcrmowurbrwvdsgnq`.
- Supabase Auth redirect URLs include production domain and localhost.
- Google OAuth redirect URI matches `/api/gmail/callback`.
- Resend sender domain is verified before email send is enabled.
- Twilio credentials are set before SMS routes/webhooks are enabled.

## Required Production Variables

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
GMAIL_ENCRYPTION_KEY
OPENAI_API_KEY
RESEND_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
```

## Post-Deploy Smoke Test

Open `/`, `/apply`, `/login`, `/crm`, and `/portal`.

Submit a test application with non-sensitive dummy data.

Confirm a business, owner, application, and lead record are created in Supabase.

Confirm protected CRM and portal routes redirect unauthenticated visitors to `/login`.

Connect Gmail with a test Google account only after OAuth credentials and encryption are configured.
