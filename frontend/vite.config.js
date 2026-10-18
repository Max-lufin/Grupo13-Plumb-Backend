import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En desarrollo, /api se redirige a la API local para no lidiar con CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
