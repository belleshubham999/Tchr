import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    publicDir: 'public',
    plugins: [
      react(), // Simple - let Vite handle the defaults
      tailwindcss()
    ],
    define: {
      'process.env.SARVAM_API_KEY': JSON.stringify(env.SARVAM_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      middlewareMode: true,
      watch: {
        ignored: ['**/*.db', '**/*.sqlite', 'node_modules', 'dist', '.git'],
        usePolling: true
      }
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom'],
            'motion': ['motion/react'],
            'markdown': ['react-markdown']
          }
        }
      }
    },
    optimizeDeps: {
      exclude: ['node-fetch'], // Just exclude node-fetch
    },
  };
});