import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Read only the API port here. Database secrets are never exposed to the browser.
  const env = loadEnv(mode, fileURLToPath(new URL('../', import.meta.url)), 'API_');
  const proxy = { '/api': { target: `http://127.0.0.1:${env.API_PORT || '4000'}` } };
  return {
    plugins: [react()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
    preview: { proxy },
  };
});
