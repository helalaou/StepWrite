import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // The build-time variables keep the names they had under Create React App
  // (README "Client settings", mobile/scripts/build.mjs)
  envPrefix: 'REACT_APP_',
  server: {
    port: 3000,
    // ngrok mode serves the dev client through a tunnel (server/lib/origins.js)
    allowedHosts: ['.ngrok.io', '.ngrok.app', '.ngrok.dev', '.ngrok-free.app', '.ngrok-free.dev'],
  },
  preview: {
    port: 3000,
  },
  build: {
    outDir: 'build',
    // The iPhone app runs on iOS 15 and later (mobile/ios)
    target: ['es2020', 'safari15', 'chrome87', 'edge88', 'firefox78'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
});
