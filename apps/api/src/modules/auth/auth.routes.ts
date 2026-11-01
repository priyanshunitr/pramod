import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { email, HttpError, parse } from '../../lib/http.js';
import { authenticate, signIn, signOut, memberships } from './auth.js';
import type { Account } from './jwt.js';
import { hashPassword, rateLimit, verifyPassword } from './security.js';

const credentials = z.object({ email, password: z.string().min(1).max(128) }).strict();
const registration = credentials.extend({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(100),
  password: z.string().min(15, 'Use at least 15 characters for your password.').max(128),
}).strict();

export const authRouter = Router();
authRouter.get('/me', async (request, response) => {
  const identity = await authenticate(request);
  response.json({ data: {
    user: identity?.user ?? null, expiresAt: identity?.expiresAt ?? null,
    memberships: identity ? await memberships(identity.user.id) : [],
  } });
});

authRouter.post('/register', async (request, response) => {
  const data = parse(registration, request.body);
  await rateLimit(`register:${request.ip}`, 10, 3600);
  const passwordHash = await hashPassword(data.password);
  const result = await pool.query<{ id: string; email: string; fullName: string }>(`
    INSERT INTO users(email, full_name, password_hash) VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING RETURNING id, email, full_name AS "fullName"`, [data.email, data.fullName, passwordHash]);
  const user = result.rows[0];
  if (!user) throw new HttpError(409, 'Unable to create an account with those details. Try signing in.');
  const expiresAt = await signIn(user, response);
  response.status(201).json({ data: { user, memberships: [], expiresAt } });
});

authRouter.post('/login', async (request, response) => {
  const data = parse(credentials, request.body);
  await rateLimit(`login-ip:${request.ip}`, 30, 900);
  await rateLimit(`login-email:${data.email}`, 10, 900);
  const result = await pool.query<Account & { password_hash: string | null }>(
    'SELECT id, email, full_name AS "fullName", password_hash FROM users WHERE lower(email) = $1', [data.email]);
  const user = result.rows[0];
  if (!await verifyPassword(data.password, user?.password_hash ?? null) || !user) throw new HttpError(401, 'Email or password is incorrect.');
  const expiresAt = await signIn(user, response);
  response.json({ data: { signedIn: true, expiresAt } });
});

authRouter.post('/logout', (_request, response) => {
  signOut(response);
  response.json({ data: { signedIn: false } });
});
