import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import { HttpError } from '../../lib/http.js';

export async function requireRole(propertyId: string, userId: string, ownerOnly = false, client: Pick<PoolClient, 'query'> = pool) {
  const result = await client.query<{ role: 'owner' | 'receptionist' }>(
    'SELECT role FROM staff_memberships WHERE property_id = $1 AND user_id = $2 AND active', [propertyId, userId]);
  const role = result.rows[0]?.role;
  if (!role || (ownerOnly && role !== 'owner')) throw new HttpError(403, 'You do not have permission to manage this hotel.');
  return role;
}

// All membership changes serialize on the hotel row, including owner bootstrap.
export async function lockProperty(client: PoolClient, propertyId: string) {
  const result = await client.query('SELECT id FROM properties WHERE id = $1 FOR UPDATE', [propertyId]);
  if (!result.rowCount) throw new HttpError(404, 'Hotel not found.');
}

export async function audit(client: PoolClient, propertyId: string, actorId: string, action: string, subjectId: string) {
  await client.query('INSERT INTO audit_events(property_id, actor_id, action, subject_id) VALUES ($1, $2, $3, $4)', [propertyId, actorId, action, subjectId]);
}
