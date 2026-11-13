import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { msw } from "msw/vite";

// The mode of `npm run dev:mock`, where a fake backend answers the client
// app's API requests in the browser (ADR 0032).
const MOCK_MODE = "mock";

export default defineConfig(({ mode }) => ({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    // Serves MSW's worker and its virtual:msw module, only in the mock mode.
    mode === MOCK_MODE && msw(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Vite's dependency scan doesn't follow virtual:msw. In the mock mode, it
  // is told what that module imports, so MSW is pre-bundled up front, as
  // one copy, rather than found on the first load, which reloads the page.
  // Elsewhere virtual:msw doesn't resolve, and the scan, which follows
  // main.tsx's import of the mock start-up module anyway, skips it and
  // MSW, which those modes never load, instead of failing or bundling them.
  optimizeDeps:
    mode === MOCK_MODE
      ? { include: ["msw/browser", "msw/experimental"] }
      : { exclude: ["virtual:msw", "msw", "openapi-msw"] },
  server: {
    host: "0.0.0.0", // Listen on all network interfaces inside devcontainer
    port: 5173,
    // No proxy in the mock mode, so even a request MSW lets through (while
    // HMR swaps modules, say) never reaches a backend.
    proxy:
      mode === MOCK_MODE
        ? undefined
        : {
            "/api": {
              target: "http://localhost:8080",
              changeOrigin: true,
            },
            // Only /docs and paths below it, not client routes such as /docsets.
            // The pattern is matched against the URL including its query string.
            "^/docs([/?#]|$)": {
              target: "http://localhost:8080",
              changeOrigin: true,
            },
          },
  },
  build: {
    outDir: path.resolve(__dirname, "../backend/internal/infra/spa/dist"),
    emptyOutDir: true,
  },
}));
