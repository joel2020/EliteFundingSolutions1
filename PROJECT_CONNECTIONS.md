# Elite Funding Solutions - Project Connections

This file defines the correct production connections for the Elite Funding Solutions build so Codex, Cursor, Replit, Vercel, Supabase, and any future automation agents do not confuse this project with other client builds.

## Correct Project Identity

- Business / Product: Elite Funding Solutions
- Primary Build Repo: joel2020/EliteFundingSolutions1
- Production Vercel Project: elite-funding-solutions1
- Current Supabase Project: bolt-native-database-66464383

## GitHub

- GitHub Account: joel2020
- Connected Email: joelcarias23@gmail.com
- Repository: joel2020/EliteFundingSolutions1
- Default Branch: main
- Repository Visibility: private

## Vercel

- Vercel Team: Joel Carias' projects
- Vercel Team Slug: joel-carias-projects
- Vercel Team ID: team_EMDpI0zAemC52GgIiDU4bmE9
- Correct Vercel Project: elite-funding-solutions1
- Vercel Project ID: prj_rdMIIE052Gvi8EI664kXFYQHQYue

Important: Do not deploy this repo to the similarly named Vercel project `elite-funding-solutions` unless Joel explicitly requests it. The correct project is `elite-funding-solutions1`.

## Supabase

- Current Supabase Project Name: bolt-native-database-66464383
- Supabase Project Ref: hiweeafewcralneqfosy
- Supabase Project ID: hiweeafewcralneqfosy
- Supabase Organization ID: utugucabodpilaarifxj
- Region: us-west-2
- Database Host: db.hiweeafewcralneqfosy.supabase.co
- Status: ACTIVE_HEALTHY

Recommended future production cleanup: create a dedicated Supabase project named `elite-funding-solutions-crm` before going fully live, then update this file and all Vercel environment variables.

## Required Environment Variables

Use these names in Vercel and local `.env.local` files.

```env
NEXT_PUBLIC_SUPABASE_URL=https://hiweeafewcralneqfosy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_WITH_SUPABASE_ANON_OR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_SERVICE_ROLE_KEY

NEXT_PUBLIC_APP_URL=https://elitefundingsolutions.com
NEXT_PUBLIC_CRM_URL=https://crm.elitefundingsolutions.com
NEXT_PUBLIC_ADMIN_URL=https://admin.elitefundingsolutions.com
```

Never commit real secret keys to GitHub. Store production secrets only in Vercel Environment Variables and Supabase.

## Production Domains

- Main Website: https://elitefundingsolutions.com
- CRM: https://crm.elitefundingsolutions.com
- Admin: https://admin.elitefundingsolutions.com

## Agent / Codex Instructions

When working on this project:

1. Use GitHub repo `joel2020/EliteFundingSolutions1`.
2. Deploy to Vercel project `elite-funding-solutions1`.
3. Use Supabase project ref `hiweeafewcralneqfosy` unless a newer dedicated Elite Funding Solutions Supabase project is documented here.
4. Do not use the `elite-funding-solutions` Vercel project by default.
5. Do not use any Bypass Solution, Bravo Mechanical, Murray Legal, or Alivio projects for this build.
6. Before schema or auth changes, confirm the Supabase project ref matches `hiweeafewcralneqfosy`.
7. Before deployment work, confirm the Vercel project ID matches `prj_rdMIIE052Gvi8EI664kXFYQHQYue`.

## Current Status

- GitHub connection confirmed.
- Vercel connection confirmed.
- Supabase connection confirmed.
- Dedicated production Supabase project still recommended before final launch.
