import { MemorySessionStore } from "./sessionStore.js";
import { MemoryWorkspaceStore } from "../workspace/workspaceStore.js";
import type { GuestStorage } from "./context.js";

export const GUEST_IDLE_MS = 30 * 60 * 1000;
const guests = new Map<string, { storage: GuestStorage; touchedAt: number }>();
const workspaceOwners = new Map<string, string>();

export function guestStorage(id: string): GuestStorage {
  expireGuests();
  let entry = guests.get(id);
  if (!entry) {
    entry = {
      storage: {
        ownerId: id,
        sessions: new MemorySessionStore(),
        workspaces: new MemoryWorkspaceStore(),
        closed: false,
      },
      touchedAt: Date.now(),
    };
    guests.set(id, entry);
  }
  entry.touchedAt = Date.now();
  return entry.storage;
}

export function rememberGuestWorkspace(workspaceId: string, guestId: string): void {
  workspaceOwners.set(workspaceId, guestId);
}

// PDF/audio elements cannot send the guest header. Preserve their existing
// unguessable workspace URLs, resolving only live guest workspaces in memory.
export function guestForWorkspace(workspaceId: string): GuestStorage | undefined {
  expireGuests();
  const owner = workspaceOwners.get(workspaceId);
  return owner ? guests.get(owner)?.storage : undefined;
}

export function endGuest(id: string): void {
  const entry = guests.get(id);
  if (entry) entry.storage.closed = true;
  guests.delete(id);
  for (const [workspaceId, owner] of workspaceOwners) {
    if (owner === id) workspaceOwners.delete(workspaceId);
  }
}

export function expireGuests(now = Date.now()): void {
  for (const [id, entry] of guests) {
    if (now - entry.touchedAt >= GUEST_IDLE_MS) endGuest(id);
  }
}

// Tab-close delivery is best effort; abandoned sessions still expire in RAM.
setInterval(expireGuests, 60_000).unref();
