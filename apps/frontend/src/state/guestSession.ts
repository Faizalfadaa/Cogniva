const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
let guestId: string | undefined;

export function getGuestSessionId(): string | undefined {
  return guestId;
}

export function startGuestSession(): void {
  endGuestSession();
  guestId = crypto.randomUUID();
}

export function endGuestSession(): void {
  const id = guestId;
  guestId = undefined;
  if (!id) return;
  void fetch(`${BASE}/api/guest-session/end`, {
    method: 'POST',
    headers: { 'x-guest-session': id },
    keepalive: true,
  }).catch(() => {});
}

// Guest identity exists only in this page, never in persistent browser storage.
window.addEventListener('pagehide', () => endGuestSession());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});
