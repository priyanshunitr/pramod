import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? 'Invalid request.');
  return result.data;
}

export const uuid = z.uuid('Invalid identifier.');
export const propertyParam = (request: Request) => parse(uuid, request.params.propertyId);
export const email = z.email('Enter a valid email address.').max(254).transform(value => value.toLowerCase());

export const allowedOrigins = new Set([new URL(env.FRONTEND_ORIGIN).origin]);
if (env.NODE_ENV !== 'production') {
  const local = new URL(env.FRONTEND_ORIGIN);
  if (['localhost', '127.0.0.1'].includes(local.hostname)) {
    local.hostname = local.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    allowedOrigins.add(local.origin);
  }
}

// Browser writes must come from our configured frontend and use JSON. SameSite
// cookies are additional protection; they do not replace this origin check.
export const protectWrites: RequestHandler = (request, _response, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
  if (!allowedOrigins.has(request.get('origin') ?? '')) return next(new HttpError(403, 'Request origin is not allowed.'));
  if (!request.is('application/json')) return next(new HttpError(415, 'Use application/json.'));
  next();
};
