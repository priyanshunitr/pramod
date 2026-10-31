import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 5000,
});

pool.on('error', (error) => {
  console.error('Unexpected idle PostgreSQL connection error:', error.message);
});
