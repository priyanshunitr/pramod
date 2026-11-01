import type { Request, RequestHandler, Response } from 'express';
import { pool } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http.js';
import { issueAccessToken, verifyAccessToken, type Account, type Identity } from './jwt.js';

export interface Membership { propertyId: string; propertyName: string; slug: string; role: 'owner' | 'receptionist'; }
export const cookieName = env.NODE_ENV === 'production' ? '__Host-pramod_access' : 'pramod_access';
const legacyCookieName = env.NODE_ENV === 'production' ? '__Host-pramod_session' : 'pramod_session';
const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

export async function signIn(user: Account, response: Response): Promise<string> {
  const { value, expiresAt } = await issueAccessToken(user);
  response.cookie(cookieName, value, { ...cookieOptions, expires: new Date(expiresAt) });
  response.clearCookie(legacyCookieName, cookieOptions);
  return expiresAt;
}

export function signOut(response: Response): void {
  // Stateless logout cannot revoke an already issued JWT before its expiry.
  response.clearCookie(cookieName, cookieOptions);
  response.clearCookie(legacyCookieName, cookieOptions);
}

export async function authenticate(request: Request): Promise<Identity | null> {
  const cookies = request.headers.cookie?.split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${cookieName}=`));
  // Reject ambiguous duplicate credentials as well as missing cookies.
  if (cookies?.length !== 1) return null;
  return verifyAccessToken(cookies[0]!.slice(cookieName.length + 1));
}

export const requireUser: RequestHandler = async (request, response, next) => {
  const identity = await authenticate(request);
  if (!identity) throw new HttpError(401, 'Sign in to continue.');
  response.locals.user = identity.user;
  next();
};

export const account = (response: Response): Account => response.locals.user as Account;

export async function memberships(userId: string): Promise<Membership[]> {
  const result = await pool.query<Membership>(`SELECT p.id AS "propertyId", p.name AS "propertyName", p.slug, m.role
    FROM staff_memberships m JOIN properties p ON p.id = m.property_id WHERE m.user_id = $1 AND m.active ORDER BY p.name`, [userId]);
  return result.rows;
}
