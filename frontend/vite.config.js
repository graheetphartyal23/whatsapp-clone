import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3080,
    strictPort: false,
    // No proxy: frontend talks directly to backend via VITE_API_URL (e.g. http://localhost:8000)
  },
});
