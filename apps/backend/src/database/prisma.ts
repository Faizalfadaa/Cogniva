/**
 * The Prisma client, connected lazily.
 *
 * `prisma` is a proxy rather than an eagerly constructed client so that merely
 * importing a repository never opens a connection — and never throws on a
 * missing DATABASE_URL. That matters because the test suite swaps in the
 * in-memory store double (COGNIVA_STORE=memory) and must run without Postgres,
 * while `main.ts` fails fast on a missing URL before it serves a request.
 */

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let client: PrismaClient | undefined;

/** The connected client, built on first use. */
export function getPrisma(): PrismaClient {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL belum diisi — semua penyimpanan Cogniva ada di Postgres. " +
          "Salin .env.example ke .env dan isi DATABASE_URL, atau jalankan `docker compose up`.",
      );
    }
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return client;
}

/** True when DATABASE_URL is configured — used by the boot check in main.ts. */
export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Open the connection now, so a bad URL fails at boot instead of mid-request. */
export async function connectDatabase(): Promise<void> {
  await getPrisma().$connect();
}

export async function disconnectDatabase(): Promise<void> {
  if (client) await client.$disconnect();
}

/**
 * Drop-in for the client itself: every property access builds (or reuses) the
 * real client first. Methods are bound so `$transaction` and friends keep their
 * receiver.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const real = getPrisma() as unknown as Record<string | symbol, unknown>;
    const value = real[property];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
