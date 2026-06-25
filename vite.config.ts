import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiHost = process.env.THIA_LOCAL_API_HOST ?? "127.0.0.1";
const apiPort = process.env.THIA_LOCAL_API_PORT ?? "3100";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("/react-dom/") || id.includes("/react/")) {
            return "react-vendor";
          }

          if (id.includes("/react-router/")) {
            return "router-vendor";
          }

          if (id.includes("/motion/")) {
            return "motion-vendor";
          }

          if (id.includes("/react-icons/")) {
            return "profile-icons";
          }

          return undefined;
        },
      },
    },
  },
  server: {
    host: "localhost",
    port: 5173,
    proxy: {
      "/api": {
        target: `http://${apiHost}:${apiPort}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ""),
      },
    },
  },
});
