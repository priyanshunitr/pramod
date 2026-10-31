import { pool } from './pool.js';
import { transaction } from './transaction.js';
import { email, parse } from '../lib/http.js';
import { audit, lockProperty } from '../modules/staff/permissions.js';

// Trusted operator command only. There is deliberately no public owner endpoint.
try {
  const [slug, suppliedEmail] = process.argv.slice(2);
  if (!slug || !suppliedEmail) throw new Error('Usage: npm run owner:bootstrap -- <property-slug> <registered-email>');
  const ownerEmail = parse(email, suppliedEmail);
  await transaction(async client => {
    const property = await client.query<{ id: string }>('SELECT id FROM properties WHERE slug = $1', [slug]);
    const propertyId = property.rows[0]?.id;
    if (!propertyId) throw new Error('Hotel not found.');
    await lockProperty(client, propertyId);
    const owners = await client.query("SELECT 1 FROM staff_memberships WHERE property_id = $1 AND role = 'owner' AND active", [propertyId]);
    if (owners.rowCount) throw new Error('An owner already exists. Use an owner invitation instead.');
    const user = await client.query<{ id: string }>('SELECT id FROM users WHERE lower(email) = $1 AND password_hash IS NOT NULL', [ownerEmail]);
    if (!user.rows[0]) throw new Error('Register the intended owner account first. Verify the person and email before running this command.');
    await client.query(`INSERT INTO staff_memberships(property_id, user_id, role) VALUES ($1, $2, 'owner')
      ON CONFLICT (property_id, user_id) DO UPDATE SET role = 'owner', active = true`, [propertyId, user.rows[0].id]);
    await audit(client, propertyId, user.rows[0].id, 'owner.bootstrapped', user.rows[0].id);
  });
  console.log('Initial owner assigned. Refresh the account to open the hotel workspace.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Owner setup failed.');
  process.exitCode = 1;
} finally { await pool.end(); }
