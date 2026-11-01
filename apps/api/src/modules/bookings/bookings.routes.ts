import { Router } from 'express';
import { z } from 'zod';
import { parse, propertyParam, uuid } from '../../lib/http.js';
import { account, requireUser } from '../auth/auth.js';
import { rateLimit } from '../auth/security.js';
import { availability, createBooking, listBookings, listHotelBookings, transitionBooking } from './bookings.repository.js';
import { staySchema } from './stay.js';

export const propertyBookingRouter = Router({ mergeParams: true });
propertyBookingRouter.get('/availability', async (request, response) => {
  response.json({ data: await availability(propertyParam(request), parse(staySchema.strict(), request.query)) });
});
propertyBookingRouter.post('/bookings', requireUser, async (request, response) => {
  const propertyId = propertyParam(request);
  const data = parse(staySchema.extend({ roomTypeId: uuid, expectedTotalMinor: z.number().int().min(0), currency: z.string().length(3), idempotencyKey: uuid }).strict(), request.body);
  await rateLimit(`booking:${account(response).id}`, 20, 900);
  const result = await createBooking(propertyId, account(response).id, data);
  response.status(result.created ? 201 : 200).json({ data: result.booking });
});
propertyBookingRouter.get('/bookings', requireUser, async (request, response) => {
  response.json({ data: await listHotelBookings(propertyParam(request), account(response).id) });
});
propertyBookingRouter.post('/bookings/:bookingId/:action', requireUser, async (request, response) => {
  await transitionBooking(parse(uuid, request.params.bookingId), account(response).id,
    parse(z.enum(['cancel', 'check-in', 'check-out']), request.params.action), propertyParam(request));
  response.json({ data: { updated: true } });
});

export const customerBookingRouter = Router();
customerBookingRouter.use(requireUser);
customerBookingRouter.get('/', async (_request, response) => { response.json({ data: await listBookings(account(response).id) }); });
customerBookingRouter.post('/:bookingId/cancel', async (request, response) => {
  await transitionBooking(parse(uuid, request.params.bookingId), account(response).id, 'cancel');
  response.json({ data: { updated: true } });
});
