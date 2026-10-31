import { pool } from './pool.js';
import { env } from '../config/env.js';

async function seed() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO properties (id, slug, name)
      VALUES ('00000000-0000-4000-8000-000000000001', 'demo-hotel', 'Your hotel')
      ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO room_types (id, property_id, name, description, max_guests) VALUES
        ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001',
          'Classic Room', 'A comfortable space for a quiet stay.', 2),
        ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001',
          'Deluxe Room', 'A little more room to settle in and unwind.', 3),
        ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001',
          'Family Suite', 'Room to spend time together, with space for everyone.', 4)
      ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO rooms (property_id, room_type_id, number) VALUES
        ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', '101'),
        ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '201'),
        ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', '301')
      ON CONFLICT DO NOTHING
    `);
    await client.query('COMMIT');
    console.log('Demo hotel, three room types, and three rooms are ready. No login accounts were created.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

try {
  await seed();
} catch (error) {
  console.error('Seed failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
} finally {
  await pool.end();
}
