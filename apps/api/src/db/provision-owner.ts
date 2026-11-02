import { z } from 'zod';
import { transaction } from './transaction.js';
import { email, HttpError, parse } from '../lib/http.js';
import { hashPassword } from '../modules/auth/security.js';
import { audit, lockProperty } from '../modules/staff/permissions.js';

const ownerDetails = z.object({
  slug: z.string().trim().min(1), email,
  fullName: z.string().trim().min(2).max(100),
  password: z.string().min(15, 'Use at least 15 characters for your password.').max(128),
}).strict();

// Operator CLI only; never imported by an HTTP route.
export async function provisionOwner(input: z.input<typeof ownerDetails>) {
  const data = parse(ownerDetails, input);
  const passwordHash = await hashPassword(data.password);
  return transaction(async client => {
    const property = await client.query<{ id: string }>('SELECT id FROM properties WHERE slug = $1', [data.slug]);
    const propertyId = property.rows[0]?.id;
    if (!propertyId) throw new HttpError(404, 'Hotel not found.');
    await lockProperty(client, propertyId);
    const owners = await client.query("SELECT 1 FROM staff_memberships WHERE property_id = $1 AND role = 'owner' AND active", [propertyId]);
    if (owners.rowCount) throw new HttpError(409, 'An owner already exists. This command only provisions the first owner.');
    const user = await client.query<{ id: string }>(`INSERT INTO users(email, full_name, password_hash) VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING RETURNING id`, [data.email, data.fullName, passwordHash]);
    const userId = user.rows[0]?.id;
    if (!userId) throw new HttpError(409, 'That email already has an account. No account or password was changed.');
    await client.query("INSERT INTO staff_memberships(property_id, user_id, role) VALUES ($1, $2, 'owner')", [propertyId, userId]);
    await audit(client, propertyId, userId, 'owner.provisioned', userId);
    return { userId, propertyId };
  });
}
