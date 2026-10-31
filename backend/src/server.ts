import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';

const server = createApp().listen(env.API_PORT, '127.0.0.1', () => {
  console.log(`Hotel API listening on http://localhost:${env.API_PORT}`);
});

server.on('error', (error) => {
  console.error('Could not start the API:', error.message);
  process.exitCode = 1;
  void pool.end();
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('Shutting down the API.');
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close(() => {
    void pool.end().then(() => {
      clearTimeout(timeout);
    }).catch(() => process.exit(1));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
