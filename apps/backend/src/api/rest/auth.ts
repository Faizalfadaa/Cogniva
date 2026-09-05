import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  clearSessionCookie,
  getCurrentUser,
  loginUser,
  registerUser,
  setSessionCookie,
} from "../../modules/auth/authService.js";

const credentialsSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", async (req, reply) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ detail: "Username dan password wajib diisi" });

    try {
      const user = await registerUser(parsed.data);
      setSessionCookie(reply, user);
      reply.code(201);
      return { user };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Register gagal";
      if (message.includes("Unique constraint")) {
        return reply.code(409).send({ detail: "Username sudah dipakai" });
      }
      return reply.code(400).send({ detail: message });
    }
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ detail: "Username dan password wajib diisi" });

    const user = await loginUser(parsed.data);
    if (!user) return reply.code(401).send({ detail: "Username atau password salah" });
    setSessionCookie(reply, user);
    return { user };
  });

  app.get("/auth/me", async (req, reply) => {
    const user = await getCurrentUser(req);
    if (!user) return reply.code(401).send({ detail: "Not signed in" });
    return { user };
  });

  app.post("/auth/logout", async (_req, reply) => {
    clearSessionCookie(reply);
    return reply.code(204).send();
  });
}
