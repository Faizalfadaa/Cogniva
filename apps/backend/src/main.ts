/**
 * Cogniva backend entrypoint — boots the Fastify app (Architecture Document §2.1).
 *
 * Loads environment (.env), builds the app, and listens. The frontend expects
 * the backend on port 8000 by default (configurable via PORT).
 */

import "dotenv/config";

import { buildApp } from "./app.js";
import { PORT } from "./config/index.js";

const app = await buildApp();

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Cogniva backend listening on http://localhost:${PORT}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
