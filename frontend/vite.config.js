import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'react-icons/md': path.join(__dirname, 'node_modules/react-icons/md/index.mjs'),
    },
  },
  server: {
    port: 5173,
    watch: {
      ignored: ['**/backend/**', '**/.vite/**', '**/*.log', '**/*.txt', '**/node_modules/**'],
    },
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
