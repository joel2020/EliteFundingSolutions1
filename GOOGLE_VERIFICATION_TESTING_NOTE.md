# Google Workspace / Gmail Verification Testing Note

## Test login

Use a CRM admin or sales user for testing. Navigate to:

- `https://crm.elitefundingsolution.com/login`

After login, the user lands in the CRM at `/crm`. Client-only users are routed to `/portal` and cannot access CRM screens.

## OAuth redirect URI

The production Google OAuth client must allow this exact redirect URI:

- `https://elitefundingsolution.com/api/gmail/callback`

If `GOOGLE_REDIRECT_URI` is set in Vercel, it must match the Google Cloud Console authorized redirect URI exactly. The CRM can still start the connection from `https://crm.elitefundingsolution.com`; the callback redirects users back to CRM settings after Google completes the grant.

## Where to connect Google

Open the CRM, then go to:

- Settings / Google Workspace connection

The CRM calls `/api/gmail/status` to show whether the current CRM user has a connected Google account. If no account is connected, use the Google/Gmail connect action, which calls `/api/gmail/auth` and returns the Google authorization URL.

## Requested OAuth scopes

The app requests only the Gmail sending and basic identity scopes needed for the lender-email workflow:

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

The app does not request Gmail read, modify, compose, mailbox management, Drive, Calendar, or broad Google Workspace scopes.

## Why Gmail send is needed

Elite Funding Solutions sends lender/funder submission packages from the authenticated CRM user's Google Workspace mailbox. The package may include a generated Elite application PDF and selected supporting documents. Gmail send access lets the CRM send that outbound lender email through the user's own connected business mailbox.

## How to trigger send functionality

1. Log into the CRM as an admin or sales user.
2. Connect Google from Settings.
3. Open a deal detail page.
4. Confirm the deal has a completed application and any supporting documents needed by the selected funder.
5. Open the `Lenders Sent To` / lender submission action.
6. Select a funder, enter the lender message, select attachments, and send.

If Google is connected, the CRM attempts to send through Gmail. If Google is not connected or the Gmail API returns an error, the lender submission is still logged and the UI presents a manual-send fallback.

## How Google testers can verify the scope functionality

1. Complete the OAuth connection and confirm Google shows only Gmail send plus basic profile/email access.
2. Return to the CRM settings page and confirm the account appears connected.
3. Trigger a lender submission from a deal.
4. Verify the CRM logs the lender submission and sends, or attempts to send, the outbound lender package email.
5. Confirm no inbox-reading functionality is available in the CRM and no Gmail read/modify scopes are requested.
