import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { payrollApiPlugin } from "./payroll-api-plugin";

// Same aliases / plugins as the web app (Replit-only dev plugins removed).
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss(), payrollApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: { postcss: { plugins: [] } },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
  },
  server: { host: "0.0.0.0" },
});
