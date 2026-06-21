import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server on port 5173; FastAPI backend on 8000 (see CORS in app/main.py).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
