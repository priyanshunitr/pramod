import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { email, HttpError, parse } from '../../lib/http.js';
import { createSession, currentUser, endSession, memberships } from './session.js';
import { hashPassword, rateLimit, verifyPassword } from './security.js';

const credentials = z.object({ email, password: z.string().min(1).max(128) }).strict();
const registration = credentials.extend({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(100),
  password: z.string().min(15, 'Use at least 15 characters for your password.').max(128),
}).strict();

export const authRouter = Router();
authRouter.get('/me', async (request, response) => {
  const user = await currentUser(request);
  response.json({ data: { user, memberships: user ? await memberships(user.id) : [] } });
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
  await createSession(user.id, request, response);
  response.status(201).json({ data: { user, memberships: [] } });
});

authRouter.post('/login', async (request, response) => {
  const data = parse(credentials, request.body);
  await rateLimit(`login-ip:${request.ip}`, 30, 900);
  await rateLimit(`login-email:${data.email}`, 10, 900);
  const result = await pool.query<{ id: string; password_hash: string | null }>('SELECT id, password_hash FROM users WHERE lower(email) = $1', [data.email]);
  const user = result.rows[0];
  if (!await verifyPassword(data.password, user?.password_hash ?? null) || !user) throw new HttpError(401, 'Email or password is incorrect.');
  await createSession(user.id, request, response);
  response.json({ data: { signedIn: true } });
});

authRouter.post('/logout', async (request, response) => {
  await endSession(request, response);
  response.json({ data: { signedIn: false } });
});
