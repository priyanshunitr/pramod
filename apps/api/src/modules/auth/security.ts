import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { pool } from '../../db/pool.js';
import { HttpError } from '../../lib/http.js';

export const token = () => randomBytes(32).toString('hex');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64,
    { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
    (error, key) => error ? reject(error) : resolve(key)));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return `scrypt-v1:${salt}:${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string | null): Promise<boolean> {
  const [version, salt, hash] = (encoded ?? '').split(':');
  const valid = version === 'scrypt-v1' && /^[a-f0-9]{32}$/.test(salt ?? '') && /^[a-f0-9]{128}$/.test(hash ?? '');
  // Unknown accounts still incur the password derivation cost.
  const key = await derive(password, valid ? salt! : '00000000000000000000000000000000');
  return Boolean(valid && timingSafeEqual(key, Buffer.from(hash!, 'hex')));
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const result = await pool.query<{ attempts: number }>(`
    INSERT INTO rate_limits(key, attempts, resets_at) VALUES ($1, 1, now() + $2 * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN rate_limits.resets_at <= now() THEN 1 ELSE rate_limits.attempts + 1 END,
      resets_at = CASE WHEN rate_limits.resets_at <= now() THEN EXCLUDED.resets_at ELSE rate_limits.resets_at END
    RETURNING attempts`, [digest(key), windowSeconds]);
  if (result.rows[0]!.attempts > limit) throw new HttpError(429, 'Too many attempts. Please try again later.');
}
