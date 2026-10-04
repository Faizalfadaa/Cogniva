import { AsyncLocalStorage } from "node:async_hooks";
import type { SessionStore, WorkspaceStore } from "./types.js";

export interface GuestStorage {
  ownerId: string;
  sessions: SessionStore;
  workspaces: WorkspaceStore;
  closed: boolean;
}

// AsyncLocalStorage also follows detached AI jobs started by a request.
export const storageContext = new AsyncLocalStorage<GuestStorage>();

export function contextualStore<K extends "sessions" | "workspaces">(
  key: K,
  persistent: GuestStorage[K],
): GuestStorage[K] {
  return new Proxy(persistent, {
    get(_target, property) {
      return (...args: unknown[]) => {
        const guest = storageContext.getStore();
        if (guest?.closed) return Promise.reject(new Error("Guest session ended"));
        const store = guest ? guest[key] : persistent;
        const method = Reflect.get(store, property) as (...values: unknown[]) => unknown;
        return method.apply(store, args);
      };
    },
  });
}
