import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server di port 5173; backend FastAPI di 8000 (lihat CORS di app/main.py).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
