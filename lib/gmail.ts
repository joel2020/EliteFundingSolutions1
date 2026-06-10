import { createHmac, timingSafeEqual } from 'crypto';
import { google } from 'googleapis';
import { createServiceSupabaseClient } from '@/lib/server-supabase';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

type GmailOAuthOptions = {
  redirectUri?: string;
  userId?: string;
};

type GmailOAuthState = {
  userId: string;
  issuedAt: number;
  nonce: string;
};

const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

export function getConfiguredRedirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;

  const crmUrl = process.env.NEXT_PUBLIC_CRM_URL || process.env.CRM_APP_URL;
  if (crmUrl) return `${crmUrl.replace(/\/$/, '')}/api/gmail/callback`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error(
      'Missing OAuth redirect URL. Set NEXT_PUBLIC_APP_URL or GOOGLE_REDIRECT_URI to your production CRM URL.'
    );
  }

  const url = new URL(appUrl);
  if (url.hostname.startsWith('www.')) url.hostname = url.hostname.replace(/^www\./, 'crm.');
  return `${url.origin}/api/gmail/callback`;
}

function getOAuthStateSecret() {
  const secret = process.env.GOOGLE_CLIENT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('Missing OAuth state secret. Set GOOGLE_CLIENT_SECRET in your environment variables.');
  }
  return secret;
}

function signOAuthState(encodedPayload: string) {
  return createHmac('sha256', getOAuthStateSecret()).update(encodedPayload).digest('base64url');
}

export function createOAuthState(userId: string) {
  const payload: GmailOAuthState = {
    userId,
    issuedAt: Date.now(),
    nonce: Math.random().toString(36).slice(2),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${signOAuthState(encodedPayload)}`;
}

export function verifyOAuthState(state?: string | null) {
  if (!state) return null;
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signOAuthState(encodedPayload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<GmailOAuthState>;
    if (!payload.userId || !payload.issuedAt) return null;
    if (Date.now() - payload.issuedAt > OAUTH_STATE_TTL_MS) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export function getOAuth2Client(options: GmailOAuthOptions = {}) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = options.redirectUri || getConfiguredRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing Google OAuth credentials. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables.'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(options: GmailOAuthOptions = {}) {
  const oauth2Client = getOAuth2Client(options);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    prompt: 'consent',
    include_granted_scopes: false,
    ...(options.userId && { state: createOAuthState(options.userId) }),
  });
}

/**
 * Build an authenticated Gmail OAuth2 client.
 *
 * When userId is supplied, a `tokens` listener is attached so that any
 * access_token Google auto-refreshes is immediately persisted back to
 * Supabase, preventing silent 401 failures after the ~1-hour expiry.
 */
export async function getGmailClient(
  accessToken: string,
  refreshToken?: string,
  userId?: string
) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (userId) {
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        try {
          const supabase = createServiceSupabaseClient();
          await supabase
            .from('gmail_tokens')
            .update({
              access_token: tokens.access_token,
              ...(tokens.expiry_date && {
                expires_at: new Date(tokens.expiry_date).toISOString(),
              }),
              ...(tokens.scope && { scope: tokens.scope }),
            })
            .eq('user_id', userId);
        } catch (err) {
          console.error('[gmail] Failed to persist refreshed token:', err);
        }
      }
    });
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function sendEmail({
  accessToken,
  refreshToken,
  userId,
  to,
  subject,
  body,
  html,
  from,
  attachments,
}: {
  accessToken: string;
  refreshToken?: string;
  userId?: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
  from?: string;
  attachments?: {
    filename?: string | false;
    content?: string | Buffer;
    contentType?: string;
  }[];
}) {
  const gmail = await getGmailClient(accessToken, refreshToken, userId);
  const boundary = `elite-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const altBoundary = `${boundary}-alt`;

  const encodeHeader = (value: string) => value.replace(/\r?\n/g, ' ').trim();
  const encodeBody = (value: string | Buffer) =>
    Buffer.isBuffer(value)
      ? value.toString('base64')
      : Buffer.from(value).toString('base64');
  const hasAttachments = Boolean(attachments?.length);
  const textBody = body || html?.replace(/<[^>]+>/g, ' ') || '';

  const messageParts = [
    `From: ${from || 'me'}`,
    `To: ${encodeHeader(to)}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
  ];

  if (hasAttachments) {
    messageParts.push(
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      `--${altBoundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      textBody,
      '',
      `--${altBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      html || textBody.replace(/\n/g, '<br />'),
      '',
      `--${altBoundary}--`
    );

    for (const attachment of attachments || []) {
      if (!attachment.content || !attachment.filename) continue;
      messageParts.push(
        '',
        `--${boundary}`,
        `Content-Type: ${
          attachment.contentType || 'application/octet-stream'
        }; name="${encodeHeader(String(attachment.filename))}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${encodeHeader(
          String(attachment.filename)
        )}"`,
        '',
        encodeBody(attachment.content).match(/.{1,76}/g)?.join('\n') || ''
      );
    }

    messageParts.push('', `--${boundary}--`);
  } else {
    messageParts.push(
      `Content-Type: ${
        html ? 'text/html' : 'text/plain'
      }; charset="UTF-8"`,
      'Content-Transfer-Encoding: 7bit',
      '',
      html || textBody
    );
  }

  const message = messageParts.join('\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage },
  });

  return res.data;
}
