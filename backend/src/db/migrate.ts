import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { pool } from './pool.js';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize migration runners, including the first creation of the tracking table.
    await client.query('SELECT pg_advisory_xact_lock(241031, 1)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const directory = new URL('../../migrations/', import.meta.url);
    const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
    for (const name of files) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE name = $1', [name],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration ${name} was changed. Add a new migration instead.`);
        }
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
      console.log(`Applied ${name}`);
    }
    await client.query('COMMIT');
    console.log('Database migrations are up to date.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

try {
  await migrate();
} catch (error) {
  console.error('Migration failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
} finally {
  await pool.end();
}
