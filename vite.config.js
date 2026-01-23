console.log("VITE CONFIG LOADED ✅");
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://147.45.219.43:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
