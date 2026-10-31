import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  // Parse without loading backend NODE_ENV into Vite's own production/build settings.
  // Only the API port is used; database settings are never exposed to browser code.
  const envPath = fileURLToPath(new URL('../.env', import.meta.url));
  const settings = existsSync(envPath) ? parse(readFileSync(envPath)) : {};
  const apiPort = process.env.API_PORT ?? settings.API_PORT ?? '4000';
  const proxy = { '/api': { target: `http://127.0.0.1:${apiPort}` } };
  return {
    plugins: [react()],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [{ name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
          },
        },
      },
    },
    server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
    preview: { proxy },
  };
});
