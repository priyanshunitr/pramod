import type { StaffAccess } from '@hotel/contracts';
import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import { HttpError } from '../../lib/http.js';

export async function readStaffAccess(propertyId: string, userId: string, client: Pick<PoolClient, 'query'> = pool): Promise<StaffAccess> {
  // Read membership and the latest decision in one snapshot, including removed memberships.
  const result = await client.query<StaffAccess>(`SELECT
    CASE WHEN m.active THEN m.role ELSE NULL END AS role,
    COALESCE(NOT m.active, false) AS "accessRevoked",
    CASE WHEN r.id IS NULL THEN NULL ELSE json_build_object(
      'id', r.id, 'status', r.status, 'createdAt', r.created_at, 'reviewedAt', r.reviewed_at
    ) END AS request
    FROM properties p
    LEFT JOIN staff_memberships m ON m.property_id = p.id AND m.user_id = $2
    LEFT JOIN LATERAL (SELECT id, status, created_at, reviewed_at FROM staff_requests
      WHERE property_id = p.id AND user_id = $2 ORDER BY created_at DESC, id DESC LIMIT 1) r ON true
    WHERE p.id = $1`, [propertyId, userId]);
  if (!result.rows[0]) throw new HttpError(404, 'Hotel not found.');
  return result.rows[0];
}
