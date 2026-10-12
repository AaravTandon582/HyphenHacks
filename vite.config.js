import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // the ML pipeline runs in Flask (see server.py); proxy so the frontend
    // can call same-origin /api/* in dev without a CORS dance
    proxy: {
      "/api": "http://localhost:5050",
    },
  },
});
