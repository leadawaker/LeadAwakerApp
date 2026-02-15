import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { metaImagesPlugin } from "./vite-plugin-meta-images";



export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    metaImagesPlugin(),
    // No conditional plugins based on REPL_ID anymore
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"), // fixed import.meta.dirname → __dirname
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(__dirname, "client"), // fixed import.meta.dirname → __dirname
  build: {
    outDir: path.resolve(__dirname, "dist/public"), // fixed import.meta.dirname → __dirname
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});