import type { Request, RequestHandler, Response } from 'express';
import { pool } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { digest, token } from './security.js';
import { HttpError } from '../../lib/http.js';

export interface Account { id: string; email: string; fullName: string; }
export interface Membership { propertyId: string; propertyName: string; slug: string; role: 'owner' | 'receptionist'; }
export const cookieName = env.NODE_ENV === 'production' ? '__Host-pramod_session' : 'pramod_session';
const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

export function sessionToken(request: Request): string | null {
  const value = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export async function createSession(userId: string, request: Request, response: Response): Promise<void> {
  const value = token();
  const previous = sessionToken(request);
  // Rotating an existing browser session prevents session fixation.
  await pool.query('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval \'7 days\')', [digest(value), userId]);
  if (previous) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [digest(previous)]);
  response.cookie(cookieName, value, { ...cookieOptions, maxAge: 7 * 86400 * 1000 });
}

export async function endSession(request: Request, response: Response): Promise<void> {
  const value = sessionToken(request);
  if (value) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [digest(value)]);
  response.clearCookie(cookieName, cookieOptions);
}

export async function currentUser(request: Request): Promise<Account | null> {
  const value = sessionToken(request);
  if (!value) return null;
  const result = await pool.query<Account>(`SELECT u.id, u.email, u.full_name AS "fullName"
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`, [digest(value)]);
  return result.rows[0] ?? null;
}

export const requireUser: RequestHandler = async (request, response, next) => {
  const user = await currentUser(request);
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  response.locals.user = user;
  next();
};

export const account = (response: Response): Account => response.locals.user as Account;

export async function memberships(userId: string): Promise<Membership[]> {
  const result = await pool.query<Membership>(`SELECT p.id AS "propertyId", p.name AS "propertyName", p.slug, m.role
    FROM staff_memberships m JOIN properties p ON p.id = m.property_id WHERE m.user_id = $1 AND m.active ORDER BY p.name`, [userId]);
  return result.rows;
}
