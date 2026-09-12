import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // tests/db is the Postgres suite and has its own config (`npm run test:db`).
    exclude: ["node_modules/**", "tests/db/**"],
    // The app stores everything in Postgres; this suite runs against the
    // in-memory doubles instead, so `npm test` needs no database.
    env: {
      COGNIVA_STORE: "memory",
      // App modules pull in `dotenv/config`, which would otherwise hand the
      // developer's real .env credentials to this suite and turn it into a
      // live Gemini run. dotenv never overwrites a variable that is already
      // set, so blanking them here keeps every agent on its offline path.
      GEMINI_API_KEY: "",
      GOOGLE_API_KEY: "",
    },
  },
});
