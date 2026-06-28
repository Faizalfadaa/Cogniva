/**
 * Fastify application factory (modular-monolith backend, §2.1).
 *
 * Combines the REST layer (session lifecycle) and the WebSocket layer (real-time
 * session channel). Exposed as a factory so tests can build an isolated app
 * (inject for REST, listen on an ephemeral port for WebSocket).
 */

import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";

import { restRoutes } from "./api/rest/index.js";
import { wsRoutes } from "./api/websocket/index.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // The frontend SPA (Vite dev server) calls the backend cross-origin in dev.
  await app.register(cors, {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  });

  await app.register(websocket);
  await app.register(restRoutes, { prefix: "/api" });
  await app.register(wsRoutes);

  app.get("/health", async () => ({ status: "ok", milestone: "M1" }));

  return app;
}
