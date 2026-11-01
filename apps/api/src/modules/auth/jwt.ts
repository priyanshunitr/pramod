import { randomUUID } from 'node:crypto';
import { errors, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import type { Session } from '@hotel/contracts';
import { env } from '../../config/env.js';

export type Account = NonNullable<Session['user']>;
export interface Identity { user: Account; expiresAt: string; }

const key = Buffer.from(env.JWT_SECRET, 'hex');
const claims = z.object({
  sub: z.uuid(), email: z.email().max(254), name: z.string().min(2).max(100),
  iat: z.number().int().nonnegative(), exp: z.number().int().positive(), jti: z.uuid(),
});

export async function issueAccessToken(user: Account): Promise<{ value: string; expiresAt: string }> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + env.JWT_TTL_SECONDS;
  // Permissions deliberately stay out of the token: staff access is checked live.
  const value = await new SignJWT({ email: user.email, name: user.fullName })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .setJti(randomUUID())
    .sign(key);
  return { value, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

export async function verifyAccessToken(value: string): Promise<Identity | null> {
  if (value.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(value, key, {
      algorithms: ['HS256'], typ: 'JWT', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE,
      requiredClaims: ['sub', 'email', 'name', 'iat', 'exp', 'jti'],
      maxTokenAge: env.JWT_TTL_SECONDS,
    });
    const parsed = claims.safeParse(payload);
    if (!parsed.success) return null;
    const { sub, email, name, iat, exp } = parsed.data;
    if (exp <= iat || exp - iat > env.JWT_TTL_SECONDS) return null;
    return { user: { id: sub, email, fullName: name }, expiresAt: new Date(exp * 1000).toISOString() };
  } catch (error) {
    if (error instanceof errors.JOSEError) return null;
    throw error;
  }
}
