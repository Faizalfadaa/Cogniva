import { create } from 'zustand';

const USER_NAME_KEY = 'cogniva:userName';
const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export interface AuthUser {
  id: string;
  username: string;
}

interface UserState {
  user: AuthUser | null;
  userName: string | null;
  authLoading: boolean;
  /** true when the "what's your name" popup should be shown */
  needsNameSetup: boolean;
  fetchMe: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUserName: (name: string) => void;
}

function loadStoredName(): string | null {
  try {
    return localStorage.getItem(USER_NAME_KEY);
  } catch {
    return null;
  }
}

export const useUserStore = create<UserState>((set) => {
  const stored = loadStoredName();
  return {
    user: null,
    userName: stored,
    authLoading: true,
    needsNameSetup: false,
    fetchMe: async () => {
      set({ authLoading: true });
      try {
        const res = await fetch(`${BASE}/api/auth/me`, { credentials: 'include' });
        if (!res.ok) {
          set({ user: null, userName: stored, authLoading: false, needsNameSetup: false });
          return;
        }
        const { user } = (await res.json()) as { user: AuthUser };
        try {
          localStorage.setItem(USER_NAME_KEY, user.username);
        } catch {
          // localStorage unavailable - the authenticated user still lives in memory
        }
        set({ user, userName: user.username, authLoading: false, needsNameSetup: false });
      } catch {
        set({ user: null, authLoading: false, needsNameSetup: false });
      }
    },
    login: async (username: string, password: string) => {
      const { user } = await sendCredentials('/api/auth/login', username, password);
      try {
        localStorage.setItem(USER_NAME_KEY, user.username);
      } catch {
        // localStorage unavailable - the authenticated user still lives in memory
      }
      set({ user, userName: user.username, authLoading: false, needsNameSetup: false });
    },
    register: async (username: string, password: string) => {
      const { user } = await sendCredentials('/api/auth/register', username, password);
      try {
        localStorage.setItem(USER_NAME_KEY, user.username);
      } catch {
        // localStorage unavailable - the authenticated user still lives in memory
      }
      set({ user, userName: user.username, authLoading: false, needsNameSetup: false });
    },
    logout: async () => {
      await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
      try {
        localStorage.removeItem(USER_NAME_KEY);
      } catch {
        // localStorage unavailable - nothing else to clear
      }
      set({ user: null, userName: null, needsNameSetup: false });
    },
    setUserName: (name: string) => {
      const trimmed = name.trim();
      try {
        localStorage.setItem(USER_NAME_KEY, trimmed);
      } catch {
        // localStorage unavailable (private mode, etc.) - just carry on
      }
      set({ userName: trimmed, needsNameSetup: false });
    },
  };
});

async function sendCredentials(
  path: string,
  username: string,
  password: string,
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? 'Authentication failed');
  }
  return res.json() as Promise<{ user: AuthUser }>;
}
