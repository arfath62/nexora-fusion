import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mochaPlugins } from "@getmocha/vite-plugins";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    ...(process.env.GETMOCHA === "true" ? mochaPlugins(process.env) : []),
    react(),
  ],
  server: {
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 5000,
  },
});
