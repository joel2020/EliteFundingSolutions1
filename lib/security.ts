import { createCipheriv, createHash, randomBytes } from 'crypto';
import type { createServiceSupabaseClient } from '@/lib/server-supabase';

const RATE_LIMIT_WINDOW_MS = 60_000;

export const digitsOnly = (value?: string | null) => (value || '').replace(/\D/g, '');

export function getRequiredFieldEncryptionKey() {
  const secret = process.env.FIELD_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('FIELD_ENCRYPTION_KEY is not configured. Refusing to persist sensitive application data.');
  }

  return createHash('sha256').update(secret).digest();
}

export function encryptSensitiveField(value?: string | null) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getRequiredFieldEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function maskDigits(value?: string | null) {
  const digits = digitsOnly(value || '');
  if (!digits) return '';
  return `${'*'.repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}

export function escapeHtml(value?: string | null) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function checkPersistentRateLimit(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  key: string,
  maxAttempts: number,
  windowMs = RATE_LIMIT_WINDOW_MS,
) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs).toISOString();
  const { data, error } = await supabase
    .from('rate_limits')
    .select('count, reset_at')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    throw new Error('Rate limit check failed.');
  }

  if (!data || new Date(data.reset_at).getTime() < now.getTime()) {
    const { error: upsertError } = await supabase
      .from('rate_limits')
      .upsert({ key, count: 1, reset_at: resetAt, updated_at: now.toISOString() }, { onConflict: 'key' });
    if (upsertError) throw new Error('Rate limit update failed.');
    return false;
  }

  const nextCount = Number(data.count || 0) + 1;
  const { error: updateError } = await supabase
    .from('rate_limits')
    .update({ count: nextCount, updated_at: now.toISOString() })
    .eq('key', key);
  if (updateError) throw new Error('Rate limit update failed.');

  return nextCount > maxAttempts;
}
