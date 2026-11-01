import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function readOrigins(mode: string, tunnel = 'https://preview.example.test') {
  return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    "const { allowedOrigins } = await import('./src/lib/http.ts'); console.log(JSON.stringify([...allowedOrigins]));",
  ], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
    env: {
      ...process.env, NODE_ENV: mode, DEV_TUNNEL_ORIGIN: tunnel,
      FRONTEND_ORIGIN: 'http://127.0.0.1:5176',
      RECEPTION_ORIGIN: 'http://127.0.0.1:5174', OWNER_ORIGIN: 'http://127.0.0.1:5175',
      JWT_SECRET: randomBytes(32).toString('hex'),
      DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
    },
  });
}

test('development permits the exact tunnel and retains local frontend origins', () => {
  const result = readOrigins('development');
  assert.equal(result.status, 0, result.stderr);
  const origins = JSON.parse(result.stdout) as string[];
  for (const origin of ['https://preview.example.test', 'http://127.0.0.1:5176',
    'http://localhost:5176', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175']) {
    assert.ok(origins.includes(origin), origin);
  }
  for (const origin of ['https://untrusted.example.test', 'https://preview.example.test.attacker.test',
    'http://preview.example.test', 'https://preview.example.test:444']) {
    assert.ok(!origins.includes(origin), origin);
  }
});

test('production does not trust the development tunnel', () => {
  const result = readOrigins('production');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!(JSON.parse(result.stdout) as string[]).includes('https://preview.example.test'));
});

test('invalid tunnel settings fail closed', () => {
  const result = readOrigins('development', 'file:///preview');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid environment settings: DEV_TUNNEL_ORIGIN/);
});
