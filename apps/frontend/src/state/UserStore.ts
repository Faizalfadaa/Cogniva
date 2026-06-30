import { create } from 'zustand';

const USER_NAME_KEY = 'cogniva:userName';

interface UserState {
  userName: string | null;
  /** true when the "what's your name" popup should be shown */
  needsNameSetup: boolean;
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
    userName: stored,
    needsNameSetup: stored === null || stored.trim() === '',
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