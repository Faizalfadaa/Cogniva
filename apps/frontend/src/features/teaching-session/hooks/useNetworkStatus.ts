import { useEffect, useState } from 'react'

/**
 * Whether the browser thinks it is online, kept current by the 'online' and
 * 'offline' events.
 *
 * Proactive on purpose: without the listeners a dropped connection only shows
 * up when the user presses Teach and the request fails, which is the worst
 * possible moment to find out. Note `navigator.onLine` only proves the machine
 * has *a* network — a reachable-but-broken backend is `ai_unavailable`, which
 * is why the two are separate error kinds.
 */
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    // Re-sync on mount: the connection may have changed before the listeners
    // were attached (e.g. during a slow first render).
    setOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
