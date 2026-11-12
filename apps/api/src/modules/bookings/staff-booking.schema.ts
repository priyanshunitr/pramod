import { z } from 'zod';
import { email, uuid } from '../../lib/http.js';
import { staySchema } from './stay.js';

export const staffBookingSchema = staySchema.extend({
  roomTypeId: uuid,
  roomId: uuid,
  expectedTotalMinor: z.number().int().min(0),
  currency: z.string().length(3),
  idempotencyKey: uuid,
  guest: z.object({
    fullName: z.string().trim().min(2, 'Enter the guest’s full name.').max(120),
    email: z.string().trim().pipe(email).optional(),
    phone: z.string().trim().min(7).max(30).regex(/^\+?[0-9\s().-]+$/, 'Enter a valid phone number.')
      .refine(value => { const digits = value.replace(/\D/g, ''); return digits.length >= 7 && digits.length <= 15; }, 'Enter a phone number with 7–15 digits.').optional(),
  }).strict().refine(guest => guest.email || guest.phone, 'Add a phone number or email for the guest.'),
}).strict();
