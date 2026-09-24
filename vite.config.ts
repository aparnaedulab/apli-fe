import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Pinned, and strict: fail loudly if it is taken rather than silently
    // drifting to another port and breaking CORS / CLIENT_ORIGIN.
    port: 5180,
    strictPort: true,
    // Calls to /api are proxied to the Node server, so the browser sees one
    // origin in development and the session cookie is sent without fuss.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
