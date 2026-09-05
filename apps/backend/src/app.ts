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

import { authRoutes } from "./api/rest/auth.js";
import { restRoutes } from "./api/rest/index.js";
import { workspaceRoutes } from "./api/rest/workspaces.js";
import { wsRoutes } from "./api/websocket/index.js";

export async function buildApp(): Promise<FastifyInstance> {
  // Whiteboard snapshots and spoken-explanation clips arrive base64-encoded in
  // the JSON body, so the default 1 MB limit is far too small (§3.1, §3.5).
  const app = Fastify({ logger: false, bodyLimit: 50 * 1024 * 1024 });

  // The frontend SPA (Vite dev server) calls the backend cross-origin in dev.
  // Allow any localhost origin so a non-default Vite port (5174, …) still works;
  // requests with no Origin (curl, same-origin, tests) are allowed too.
  await app.register(cors, {
    origin: (origin, cb) => {
      const ok = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      cb(null, ok);
    },
    credentials: true,
  });

  await app.register(websocket);
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(restRoutes, { prefix: "/api" });
  await app.register(workspaceRoutes, { prefix: "/api" });
  await app.register(wsRoutes);

  app.get("/health", async () => ({ status: "ok", milestone: "M1" }));

  return app;
}
