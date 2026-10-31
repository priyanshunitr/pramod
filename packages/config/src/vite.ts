import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export function hotelViteConfig(port: number) {
  // Parse only: loading the API's NODE_ENV would change React's production build.
  const envPath = new URL('../../../.env', import.meta.url);
  const settings = existsSync(envPath) ? parse(readFileSync(envPath)) : {};
  const apiPort = process.env.API_PORT ?? settings.API_PORT ?? '4000';
  const proxy = { '/api': { target: `http://127.0.0.1:${apiPort}` } };
  const publicKeys = ['VITE_GUEST_URL', 'VITE_RECEPTION_URL', 'VITE_OWNER_URL', 'VITE_PROPERTY_SLUG'];
  return defineConfig({
    plugins: [react()],
    define: Object.fromEntries(publicKeys.flatMap(key => {
      const value = process.env[key] ?? settings[key];
      return value === undefined ? [] : [[`import.meta.env.${key}`, JSON.stringify(value)]];
    })),
    build: { rolldownOptions: { output: { codeSplitting: {
      groups: [{ name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
    } } } },
    server: { host: '127.0.0.1', port, strictPort: true, proxy },
    preview: { host: '127.0.0.1', port: port - 1000, strictPort: true, proxy },
  });
}
