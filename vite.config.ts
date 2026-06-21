import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  optimizeDeps: {
    exclude: ["emoji-mart", "@emoji-mart/react", "@emoji-mart/data"],
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "client/app.html"),
      output: {
        // Split heavy shared vendors into their own chunks so they are not
        // duplicated across route chunks (and so three.js only loads with faq).
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // The cn() utility trio is used by the app shell (entry) AND is a
            // transitive dep of recharts. Pin it to its own tiny chunk so Rollup
            // never absorbs it into vendor-charts — otherwise the entry would
            // statically import (and modulepreload) the whole 109 KB charts
            // bundle just to get clsx. Keep this rule before the charts rule.
            if (
              id.includes("node_modules/clsx") ||
              id.includes("node_modules/tailwind-merge") ||
              id.includes("node_modules/class-variance-authority")
            )
              return "vendor-ui-utils";
            if (id.includes("recharts") || id.includes("/d3-")) return "vendor-charts";
            if (id.includes("framer-motion")) return "vendor-motion";
            if (id.includes("three")) return "vendor-three";
            if (id.includes("xlsx") || id.includes("papaparse")) return "vendor-sheets";
            if (id.includes("@radix-ui")) return "vendor-radix";
          }
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    strictPort: false,
    open: false,
    cors: true,
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 1500,
    },
    hmr: {
      host: "app.leadawaker.com",
      protocol: "wss",
      clientPort: 443,
    },
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
});
