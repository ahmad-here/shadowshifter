import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { serviceWorkerPlugin } from './pwa/serviceWorkerPlugin';

export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  // Allow ngrok tunnels so the game can be tested on a phone.
  server: { allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app'] },
  preview: { allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app'] },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
