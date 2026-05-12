import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey() {
  const rawKey = process.env.APPLICATION_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error('APPLICATION_ENCRYPTION_KEY is required to encrypt sensitive application fields.');
  }

  const key = Buffer.from(rawKey, 'base64');
  if (key.length !== 32) {
    throw new Error('APPLICATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key. Generate one with: openssl rand -base64 32');
  }

  return key;
}

export function encryptSensitiveField(value?: string | null) {
  if (!value) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value.trim(), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function getLastFour(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.slice(-4) || null;
}
