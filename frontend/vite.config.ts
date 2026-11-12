import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { msw } from 'msw/vite'

// The mode of `npm run dev:mock`, where a fake backend answers the client
// app's API requests in the browser (ADR 0032).
const MOCK_MODE = 'mock'

export default defineConfig(({ mode }) => ({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    // Serves MSW's worker and its virtual:msw module, only in the mock mode.
    mode === MOCK_MODE && msw(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces inside devcontainer
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Only /docs and paths below it, not client routes such as /docsets.
      // The pattern is matched against the URL including its query string.
      '^/docs([/?#]|$)': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../backend/internal/infra/spa/dist'),
    emptyOutDir: true,
  },
}))
