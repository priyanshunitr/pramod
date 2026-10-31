import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

const result = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.url().refine((value) => /^postgres(ql)?:\/\//.test(value), {
    message: 'Use a PostgreSQL connection URL.',
  }),
}).safeParse(process.env);

if (!result.success) {
  const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Invalid environment settings: ${fields}. Run npm run setup and check .env.`);
}

export const env = result.data;
