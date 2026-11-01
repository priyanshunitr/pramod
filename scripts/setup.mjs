import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';

const environmentFile = new URL('../.env', import.meta.url);

try {
  await copyFile(
    new URL('../.env.example', import.meta.url),
    environmentFile,
    constants.COPYFILE_EXCL,
  );
  console.log('Created .env with local development settings.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Keeping your existing .env.');
}

const contents = await readFile(environmentFile, 'utf8');
if (!parseEnv(contents).JWT_SECRET) {
  const setting = `JWT_SECRET=${randomBytes(32).toString('hex')}`;
  const declaration = /^[ \t]*(?:export[ \t]+)?JWT_SECRET[ \t]*=.*$/gm;
  const updated = declaration.test(contents)
    ? contents.replace(declaration, setting)
    : `${contents.trimEnd()}\n\n# Generated locally by npm run setup.\n${setting}\n`;
  await writeFile(environmentFile, updated, { mode: 0o600 });
  console.log('Generated a local JWT signing secret. Existing settings were preserved.');
}

console.log('Next: npm run db:up, npm run db:migrate, npm run db:seed, npm run dev');
