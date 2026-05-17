import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // No sourcemaps en prod
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          amplify: ['aws-amplify', '@aws-amplify/ui-react'],
        },
      },
    },
  },
  define: {
    // Reemplazar window.global para AWS Amplify
    global: 'globalThis',
  },
});
