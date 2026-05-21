import { randomBytes } from 'crypto';

const TOKEN_BYTES = 18;

export function createOpaqueApplyToken(prefix: 'rep' | 'iso') {
  return `${prefix}_${randomBytes(TOKEN_BYTES).toString('base64url')}`;
}

export function isBlockedProductionEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return /(^test@|^demo@|^codex|@example\.com$|@example\.test$|@elitefunding\.test$)/.test(normalized);
}

export function referralPath(kind: 'rep' | 'iso', tokenOrSlug?: string | null) {
  const value = tokenOrSlug?.trim();
  return value ? `/apply/${kind}/${encodeURIComponent(value)}` : '';
}
