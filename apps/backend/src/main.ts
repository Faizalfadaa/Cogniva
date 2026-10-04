/**
 * Cogniva backend entrypoint — boots the Fastify app (Architecture Document §2.1).
 *
 * Loads environment (.env), opens the database, builds the app, and listens. The
 * frontend expects the backend on port 8000 by default (configurable via PORT).
 */

import "dotenv/config";

import { buildApp } from "./app.js";
import { PORT } from "./config/index.js";
import { connectDatabase, databaseConfigured, disconnectDatabase } from "./database/prisma.js";
import { usingMemoryStore } from "./modules/storage/mode.js";

// Storage is Postgres. A missing DATABASE_URL is fatal here rather than at the
// first write: a server that silently keeps everything in a Map would look
// healthy right up until a restart threw the user's session away.
if (usingMemoryStore()) {
  console.warn(
    "[cogniva] COGNIVA_STORE=memory — penyimpanan tidak permanen, hanya untuk pengujian.",
  );
} else if (!databaseConfigured()) {
  console.error(
    "DATABASE_URL belum diisi. Salin .env.example ke .env dan isi DATABASE_URL, " +
      "atau jalankan `docker compose up` yang sudah menyertakan Postgres.",
  );
  process.exit(1);
} else {
  try {
    await connectDatabase();
    console.log("Cogniva backend terhubung ke Postgres");
  } catch (err) {
    console.error("Gagal terhubung ke database:", err);
    process.exit(1);
  }
}

const app = await buildApp();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void (async () => {
      await app.close();
      await disconnectDatabase();
      process.exit(0);
    })();
  });
}

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Cogniva backend listening on http://localhost:${PORT}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
