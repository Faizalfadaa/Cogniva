import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // tests/db is the Postgres suite and has its own config (`npm run test:db`).
    exclude: ["node_modules/**", "tests/db/**"],
    // The app stores everything in Postgres; this suite runs against the
    // in-memory doubles instead, so `npm test` needs no database.
    env: { COGNIVA_STORE: "memory" },
  },
});
