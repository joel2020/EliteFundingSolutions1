# Gmail Integration Setup Guide

## Overview
Your Elite Funding Solutions CRM now includes Gmail integration for Google Workspace. Each team member can connect their professional email (e.g., name@elitefundingsolutions.com) to send and receive emails directly through the CRM.

## Setup Steps

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com

### 2. Create a New Project (or select existing)
- Click "Select Project" → "New Project"
- Name: `Elite Funding Solutions CRM`
- Click "Create"

### 3. Enable Gmail API
1. Go to "APIs & Services" → "Library"
2. Search for "Gmail API"
3. Click "Enable"

### 4. Configure OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "Internal" (for Google Workspace only) or "External"
3. Fill in:
   - App name: `Elite Funding Solutions CRM`
   - User support email: your admin email
   - Developer contact email: your admin email
   - Authorized domains: `elitefundingsolutions.com` (your workspace domain)
4. Click "Save and Continue"
5. Add Scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
6. Click "Save and Continue"
7. Add Test Users (if External): Add your team members' emails
8. Click "Save and Continue"

### 5. Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: "Web application"
4. Name: `Elite Funding Solutions CRM`
5. Add Authorized JavaScript origins:
   - `http://localhost:3000` (for development)
   - `https://your-vercel-url.vercel.app` (your production URL)
   - Your custom domain if you have one
6. Add Authorized redirect URIs:
   - `http://localhost:3000/api/gmail/callback`
   - `https://your-vercel-url.vercel.app/api/gmail/callback`
   - `https://yourdomain.com/api/gmail/callback` (if custom domain)
7. Click "Create"
8. **Copy the Client ID and Client Secret** - you'll need these!

### 6. Add Credentials to Your App

#### For Local Development:
Add to `/app/.env.local`:
```env
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

#### For Vercel Production:
1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add:
   - `GOOGLE_CLIENT_ID`: (paste your Client ID)
   - `GOOGLE_CLIENT_SECRET`: (paste your Client Secret)
4. Redeploy your application

### 7. Run Database Migration
The Gmail tables need to be created in Supabase:

1. Go to your Supabase dashboard
2. SQL Editor
3. Run the migration file: `/app/supabase/migrations/20260512000000_gmail_integration.sql`
4. Or use Supabase CLI:
   ```bash
   supabase db push
   ```

### 8. Test the Integration

1. Log into your CRM
2. Go to "Settings" page (should be in sidebar)
3. Click "Connect Google Workspace"
4. Sign in with your work email (name@elitefundingsolutions.com)
5. Grant permissions
6. You should be redirected back with "Gmail connected successfully!"

## Features Available After Connection

### Send Emails from Gmail
- Each team member sends from their own work email
- Emails appear in their Gmail sent folder
- Professional sender reputation
- Replies come to their inbox

### Track Emails in CRM
- All sent emails logged automatically
- Link emails to deals, applications, leads
- View email history per client
- Search email communications

### Email Management
- Send emails from deal pages
- Email templates for common scenarios
- Bulk email capabilities
- Email scheduling (coming soon)

## Security Notes

✅ **Secure OAuth2 Flow**
- Industry-standard Google OAuth
- Tokens encrypted in database
- Refresh tokens for long-term access
- Row Level Security (RLS) policies

✅ **Data Privacy**
- Each user's emails are private
- No cross-user access
- Emails linked to user's org only
- Audit logging enabled

✅ **Google Workspace Admin**
- Workspace admins can control access
- Can revoke app access anytime
- View which employees connected
- Monitor OAuth usage

## Troubleshooting

### "Missing Google OAuth credentials" Error
- Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set
- Check for typos in environment variables
- Restart your development server
- Redeploy on Vercel after adding vars

### Redirect URI Mismatch
- Make sure callback URL matches exactly
- Include http:// or https://
- Check for trailing slashes
- Update in Google Cloud Console if URL changed

### "App not verified" Warning
- This is normal for new apps
- Click "Advanced" → "Go to [Your App] (unsafe)"
- Or publish your app (requires verification)
- Internal Workspace apps don't need public verification

### Tokens Expired
- Refresh tokens handle this automatically
- Users may need to reconnect occasionally
- Token refresh happens in background

## Multi-User Setup

Each team member needs to:
1. Log into the CRM
2. Go to Settings
3. Connect their own Gmail account
4. Grant permissions

**Important:** Each user connects individually. They send from their own email and see only their own conversations.

## Support

If you need help:
1. Check Google Cloud Console for any API errors
2. Check Vercel logs for backend errors
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly

## Next Steps

Once Gmail is connected, you can:
- Send professional emails from the CRM
- Track all client communications
- Build email templates
- Set up automated email workflows
- Generate email reports and analytics

---

**Your Gmail integration is ready!** Follow the steps above to connect your Google Workspace.
