/**
 * Which storage implementation the process runs on.
 *
 * Postgres is the only production path. The in-memory doubles are opt-in via
 * COGNIVA_STORE=memory so that a forgotten DATABASE_URL can never quietly
 * downgrade a running server to volatile storage — it fails at boot instead.
 */

export function usingMemoryStore(): boolean {
  return process.env.COGNIVA_STORE === "memory";
}
