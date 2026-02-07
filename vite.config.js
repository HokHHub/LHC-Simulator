console.log("VITE CONFIG LOADED ✅");
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import generateRobotsTxt from "vite-plugin-robots-txt";

export default defineConfig({
  plugins: [react(), generateRobotsTxt()]
});
