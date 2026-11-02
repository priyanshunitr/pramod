import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { transaction } from '../../db/transaction.js';
import { email, HttpError, parse, propertyParam, uuid } from '../../lib/http.js';
import { account, requireUser } from '../auth/auth.js';
import { digest, rateLimit, token } from '../auth/security.js';
import { audit, lockProperty, requireRole } from './permissions.js';
import { readStaffAccess } from './access.js';

export const staffRouter = Router({ mergeParams: true });
staffRouter.use(requireUser);

staffRouter.get('/rooms', async (request, response) => {
  const propertyId = propertyParam(request);
  await requireRole(propertyId, account(response).id);
  const result = await pool.query(`SELECT id, number, housekeeping_status AS "housekeepingStatus", operational_status AS "operationalStatus"
    FROM rooms WHERE property_id = $1 ORDER BY number`, [propertyId]);
  response.json({ data: result.rows });
});

staffRouter.post('/rooms/:roomId/housekeeping', async (request, response) => {
  const propertyId = propertyParam(request);
  const roomId = parse(uuid, request.params.roomId);
  const { status } = parse(z.object({ status: z.enum(['clean', 'dirty', 'cleaning']) }).strict(), request.body);
  await transaction(async client => {
    await lockProperty(client, propertyId);
    await requireRole(propertyId, account(response).id, false, client);
    const result = await client.query('UPDATE rooms SET housekeeping_status = $3 WHERE property_id = $1 AND id = $2', [propertyId, roomId, status]);
    if (!result.rowCount) throw new HttpError(404, 'Room not found.');
    await audit(client, propertyId, account(response).id, `room.${status}`, roomId);
  });
  response.json({ data: { updated: true } });
});

staffRouter.get('/access', async (request, response) => {
  const propertyId = propertyParam(request);
  const userId = account(response).id;
  response.json({ data: await readStaffAccess(propertyId, userId) });
});

staffRouter.post('/requests', async (request, response) => {
  const propertyId = propertyParam(request);
  const userId = account(response).id;
  const data = parse(z.object({
    introduction: z.string().trim().min(10).max(500).default('I would like to join the reception team.'),
    resubmit: z.boolean().default(false),
  }).strict(), request.body);
  const result = await transaction(async client => {
    await lockProperty(client, propertyId);
    const access = await readStaffAccess(propertyId, userId, client);
    // A login retry is a read after the first request. Declined or removed staff
    // must deliberately resubmit; login alone never overturns an owner's decision.
    if (access.role || access.request?.status === 'pending' || (!data.resubmit && (access.request || access.accessRevoked))) {
      return { created: false, access };
    }
    await rateLimit(`staff-request:${propertyId}:${userId}`, 5, 86400, client);
    const created = await client.query<{ id: string }>(`INSERT INTO staff_requests(property_id, user_id, introduction)
      VALUES ($1, $2, $3) RETURNING id`, [propertyId, userId, data.introduction]);
    await audit(client, propertyId, userId, 'staff.request.created', created.rows[0]!.id);
    return { created: true, access: await readStaffAccess(propertyId, userId, client) };
  });
  response.status(result.created ? 201 : 200).json({ data: result.access });
});

staffRouter.get('/notifications', async (request, response) => {
  const propertyId = propertyParam(request);
  await requireRole(propertyId, account(response).id, true);
  const result = await pool.query<{ pendingCount: number }>(`SELECT count(*)::int AS "pendingCount"
    FROM staff_requests WHERE property_id = $1 AND status = 'pending'`, [propertyId]);
  response.json({ data: result.rows[0] });
});

staffRouter.get('/team', async (request, response) => {
  const propertyId = propertyParam(request);
  await requireRole(propertyId, account(response).id, true);
  const members = await pool.query(`SELECT u.id, u.full_name AS "fullName", u.email, m.role
    FROM staff_memberships m JOIN users u ON u.id = m.user_id WHERE m.property_id = $1 AND m.active ORDER BY u.full_name`, [propertyId]);
  const requests = await pool.query(`SELECT r.id, u.full_name AS "fullName", u.email, r.introduction, r.created_at AS "createdAt"
    FROM staff_requests r JOIN users u ON u.id = r.user_id WHERE r.property_id = $1 AND r.status = 'pending' ORDER BY r.created_at`, [propertyId]);
  response.json({ data: { members: members.rows, requests: requests.rows } });
});

staffRouter.post('/requests/:requestId/review', async (request, response) => {
  const propertyId = propertyParam(request);
  const requestId = parse(uuid, request.params.requestId);
  const actorId = account(response).id;
  const { decision } = parse(z.object({ decision: z.enum(['approved', 'rejected']) }).strict(), request.body);
  await transaction(async client => {
    await lockProperty(client, propertyId);
    await requireRole(propertyId, actorId, true, client);
    const result = await client.query<{ user_id: string }>(`UPDATE staff_requests SET status = $3, reviewed_by = $4, reviewed_at = now()
      WHERE property_id = $1 AND id = $2 AND status = 'pending' RETURNING user_id`, [propertyId, requestId, decision, actorId]);
    if (!result.rows[0]) throw new HttpError(409, 'This request is no longer pending.');
    const userId = result.rows[0].user_id;
    if (decision === 'approved') await client.query(`INSERT INTO staff_memberships(property_id, user_id, role) VALUES ($1, $2, 'receptionist')
      ON CONFLICT (property_id, user_id) DO UPDATE SET active = true,
      role = CASE WHEN staff_memberships.role = 'owner' AND staff_memberships.active THEN 'owner' ELSE 'receptionist' END`, [propertyId, userId]);
    await audit(client, propertyId, actorId, `staff.request.${decision}`, userId);
  });
  response.json({ data: { status: decision } });
});

staffRouter.post('/invitations', async (request, response) => {
  const propertyId = propertyParam(request);
  const actorId = account(response).id;
  const data = parse(z.object({ email, role: z.literal('receptionist') }).strict(), request.body);
  await requireRole(propertyId, actorId, true);
  await rateLimit(`staff-invite:${actorId}`, 20, 3600);
  const invitationToken = token();
  const invitation = await transaction(async client => {
    await lockProperty(client, propertyId);
    await requireRole(propertyId, actorId, true, client);
    const result = await client.query(`INSERT INTO staff_invitations(property_id, email, role, token_hash, created_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, now() + interval '7 days') RETURNING id, expires_at AS "expiresAt"`,
    [propertyId, data.email, data.role, digest(invitationToken), actorId]);
    await audit(client, propertyId, actorId, 'staff.invitation.created', result.rows[0].id);
    return result.rows[0];
  });
  response.status(201).json({ data: { ...invitation, token: invitationToken } });
});

staffRouter.post('/invitations/accept', async (request, response) => {
  const propertyId = propertyParam(request);
  const user = account(response);
  const { code } = parse(z.object({ code: z.string().regex(/^[a-f0-9]{64}$/, 'Enter the invitation code from your owner.') }).strict(), request.body);
  await rateLimit(`accept-invite:${user.id}`, 10, 900);
  const role = await transaction(async client => {
    await lockProperty(client, propertyId);
    const result = await client.query<{ id: string; role: 'owner' | 'receptionist'; created_by: string }>(`SELECT id, role, created_by FROM staff_invitations
      WHERE property_id = $1 AND token_hash = $2 AND email = $3 AND expires_at > now() AND accepted_at IS NULL FOR UPDATE`,
    [propertyId, digest(code), user.email]);
    const invitation = result.rows[0];
    if (!invitation) throw new HttpError(400, 'This invitation is invalid, expired, already used, or belongs to another email.');
    // Also block owner codes issued before owner provisioning became operator-only.
    if (invitation.role !== 'receptionist') throw new HttpError(403, 'Owner accounts are provided by the hotel setup team.');
    await requireRole(propertyId, invitation.created_by, true, client);
    await client.query(`INSERT INTO staff_memberships(property_id, user_id, role) VALUES ($1, $2, $3)
      ON CONFLICT (property_id, user_id) DO UPDATE SET active = true,
      role = CASE WHEN staff_memberships.role = 'owner' AND staff_memberships.active THEN 'owner' ELSE EXCLUDED.role END`,
    [propertyId, user.id, invitation.role]);
    await client.query('UPDATE staff_invitations SET accepted_by = $2, accepted_at = now() WHERE id = $1', [invitation.id, user.id]);
    await client.query("UPDATE staff_requests SET status = 'approved', reviewed_by = $3, reviewed_at = now() WHERE property_id = $1 AND user_id = $2 AND status = 'pending'", [propertyId, user.id, invitation.created_by]);
    await audit(client, propertyId, user.id, 'staff.invitation.accepted', invitation.id);
    return invitation.role;
  });
  response.json({ data: { role } });
});

staffRouter.post('/members/:userId/revoke', async (request, response) => {
  const propertyId = propertyParam(request);
  const userId = parse(uuid, request.params.userId);
  const actorId = account(response).id;
  await transaction(async client => {
    await lockProperty(client, propertyId);
    await requireRole(propertyId, actorId, true, client);
    const result = await client.query<{ role: string }>('SELECT role FROM staff_memberships WHERE property_id = $1 AND user_id = $2 AND active', [propertyId, userId]);
    if (!result.rows[0]) throw new HttpError(404, 'Active team member not found.');
    if (result.rows[0].role === 'owner') {
      const count = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM staff_memberships WHERE property_id = $1 AND role = 'owner' AND active", [propertyId]);
      if (count.rows[0]!.count <= 1) throw new HttpError(409, 'The hotel must retain at least one owner.');
    }
    await client.query('UPDATE staff_memberships SET active = false WHERE property_id = $1 AND user_id = $2', [propertyId, userId]);
    await audit(client, propertyId, actorId, 'staff.access.revoked', userId);
  });
  response.json({ data: { revoked: true } });
});
