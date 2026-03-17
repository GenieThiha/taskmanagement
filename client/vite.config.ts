import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/v1': 'http://localhost:3000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavyweight vendor libs into separate chunks so they are
        // cached independently and not re-downloaded on every app deploy.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable'],
          socket: ['socket.io-client'],
          state: ['zustand'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
