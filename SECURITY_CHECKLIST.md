# Security Checklist

## Secrets

- No service role key in frontend code.
- No Gmail refresh token in frontend code.
- No encryption key in frontend code.
- `.env.local` remains ignored by git.
- Production secrets are stored only in the hosting provider and Supabase dashboard.

## Supabase

- RLS enabled on all exposed public schema tables.
- Policies restrict CRM records by `organization_id`.
- Client portal records are scoped to the authenticated client.
- Broker records are scoped to submitted deals.
- Storage buckets are private by default.
- Security definer functions are locked down and not callable by `anon`.
- Views use safe access patterns and do not unintentionally bypass RLS.

## Application

- Middleware protects `/crm` and `/portal`.
- Login redirects users by profile role.
- Missing profile recovery should be verified against the live Supabase project before launch.
- Public application only collects SSN last four, not full SSN.
- EIN is collected in the form but should be encrypted or masked before production storage.
- Email and SMS provider routes must be rate limited before public launch.

## Remaining Hardening

The current build passes, but npm audit still reports vulnerabilities that require a breaking Next major upgrade path. Plan a Next 15 or Next 16 migration in a dedicated branch and retest every route before production launch.
