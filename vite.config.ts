import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { serviceWorkerPlugin } from './pwa/serviceWorkerPlugin';
import { staticPages } from './pwa/staticPages.js';

export default defineConfig({
  // staticPages: guide pages and blog at their folder URLs in dev/preview (like the real host).
  plugins: [react(), serviceWorkerPlugin(), staticPages()],
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  // Allow ngrok tunnels so the game can be tested on a phone.
  server: { allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app'] },
  preview: { allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app'] },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
