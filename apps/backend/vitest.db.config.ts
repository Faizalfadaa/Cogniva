/**
 * The database suite: the only tests that run against real Postgres.
 *
 * Kept in its own config because the store implementation is chosen once, when
 * the module is first imported — a test file cannot switch it afterwards. Run it
 * with `npm run test:db` and a DATABASE_URL pointing at a database you don't
 * mind writing to (the suite namespaces and cleans up its own rows).
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    // Shared rows and a shared connection: run the files one at a time.
    fileParallelism: false,
  },
});
