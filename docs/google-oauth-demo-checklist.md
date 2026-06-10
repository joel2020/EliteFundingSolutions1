# Google OAuth Verification Demo Checklist

Use this checklist for the Google reviewer demo video and final QA pass.

## Reviewer Flow

1. Open `https://crm.elitefundingsolution.com/login?redirectTo=/crm`.
2. Log in with the reviewer/test CRM account.
3. Navigate to CRM Settings.
4. Click Connect Google Workspace.
5. Show the Google OAuth consent screen.
6. Approve only the requested scopes:
   - `gmail.send`
   - `userinfo.email`
   - `userinfo.profile`
7. Return to CRM Settings and show Gmail connected status.
8. Open a test deal.
9. Open Send to Funder.
10. Select `Google OAuth Test Lender`.
11. Send a test funder submission.
12. Show the success toast/message.
13. Show the submission logged on the deal.
14. Explain that Gmail is used only for user-initiated outbound funder submissions.
15. Explain that the CRM does not read, list, search, modify, or delete existing Gmail messages.

## Production Checks

- `GOOGLE_CLIENT_ID` is configured in production.
- `GOOGLE_CLIENT_SECRET` is configured in production.
- `NEXT_PUBLIC_APP_URL` points to the production CRM/site origin.
- Google Cloud Console redirect URI exactly matches the production callback route.
- Disconnect/reconnect flow works from Settings.
- `gmail.send` succeeds from the funder submission workflow.
- OAuth errors are shown to the user and logged clearly.
- `Google OAuth Test Lender` exists and uses a safe test email, not a real funder.
