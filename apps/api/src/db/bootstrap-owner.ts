import { pool } from './pool.js';
import { provisionOwner } from './provision-owner.js';
import { promptOwnerPassword } from './owner-password.js';

try {
  const args = process.argv.slice(2);
  if (args.length !== 3 || args.some(value => !value.trim())) throw new Error('Usage: npm run owner:bootstrap -- <property-slug> <email> "<full-name>"');
  const [slug, email, fullName] = args as [string, string, string];
  const password = await promptOwnerPassword();
  await provisionOwner({ slug, email, fullName, password });
  console.log('Owner account created. Provide the email and password privately to the owner, who can now sign in.');
} catch (error) {
  console.error(error instanceof Error && error.name !== 'AbortError' ? error.message : 'Owner setup cancelled.');
  process.exitCode = 1;
} finally { await pool.end(); }
