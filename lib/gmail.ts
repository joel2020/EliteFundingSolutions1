import { google } from 'googleapis';
import { createServiceSupabaseClient } from '@/lib/server-supabase';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/gmail/callback`;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing Google OAuth credentials. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables.'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

/**
 * Build an authenticated Gmail OAuth2 client.
 *
 * When userId is supplied, a `tokens` listener is attached so that any
 * access_token Google auto-refreshes is immediately persisted back to
 * Supabase — preventing silent 401 failures after the ~1-hour expiry.
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

export async function listEmails({
  accessToken,
  refreshToken,
  userId,
  maxResults = 50,
  query,
}: {
  accessToken: string;
  refreshToken?: string;
  userId?: string;
  maxResults?: number;
  query?: string;
}) {
  const gmail = await getGmailClient(accessToken, refreshToken, userId);

  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: query,
  });

  return res.data.messages || [];
}

export async function getEmail({
  accessToken,
  refreshToken,
  userId,
  messageId,
}: {
  accessToken: string;
  refreshToken?: string;
  userId?: string;
  messageId: string;
}) {
  const gmail = await getGmailClient(accessToken, refreshToken, userId);

  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  return res.data;
}

export async function getUserProfile(
  accessToken: string,
  refreshToken?: string,
  userId?: string
) {
  const gmail = await getGmailClient(accessToken, refreshToken, userId);

  const res = await gmail.users.getProfile({ userId: 'me' });
  return res.data;
}
