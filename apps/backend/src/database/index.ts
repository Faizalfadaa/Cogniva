/**
 * The persistence layer.
 *
 * `stores/` holds the two Postgres-backed implementations of the storage
 * contract in ../modules/storage/types.ts. They are the only place that speaks
 * Prisma: the rest of the backend goes through the `sessions` / `workspaces`
 * singletons and never imports this module directly.
 */

export { connectDatabase, databaseConfigured, disconnectDatabase, prisma } from "./prisma.js";
export { PrismaSessionStore } from "./stores/prismaSessionStore.js";
export { PrismaWorkspaceStore } from "./stores/prismaWorkspaceStore.js";
