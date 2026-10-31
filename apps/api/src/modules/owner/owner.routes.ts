import { Router } from 'express';
import { z } from 'zod';
import { parse, propertyParam, uuid } from '../../lib/http.js';
import { account, requireUser } from '../auth/session.js';
import { dateValue } from '../bookings/stay.js';
import { ownerDashboard } from './owner.repository.js';

export const ownerRouter = Router({ mergeParams: true });
ownerRouter.use(requireUser);
ownerRouter.get('/dashboard', async (request, response) => {
  const query = parse(z.object({ from: dateValue.optional(), to: dateValue.optional(), roomTypeId: uuid.optional() }).strict(), request.query);
  response.json({ data: await ownerDashboard(propertyParam(request), account(response).id, query) });
});
