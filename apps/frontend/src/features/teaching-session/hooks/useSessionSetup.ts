import { useCallback, useState } from 'react'

function storageKey(workspaceId: string): string {
  return `cogniva:setup-done:${workspaceId}`
}

/**
 * Whether the session-setup panel still has to be shown for this workspace.
 *
 * Tracked per browser, like useIntroSeen — the backend already knows the title
 * and the reference, but not whether the user was *asked*. Someone who skips the
 * panel on purpose has answered the question, and re-asking on every reload
 * would be nagging rather than helping.
 */
export function useSessionSetup(workspaceId: string) {
  const [done, setDone] = useState<boolean>(() => {
    if (!workspaceId) return true
    try {
      return localStorage.getItem(storageKey(workspaceId)) === '1'
    } catch {
      // localStorage unavailable (private mode): assume answered, so the panel
      // can never become an overlay the user has no way to get past.
      return true
    }
  })

  const markDone = useCallback(() => {
    setDone(true)
    try {
      localStorage.setItem(storageKey(workspaceId), '1')
    } catch {
      // ignore — the panel is dismissed for this session either way
    }
  }, [workspaceId])

  return { done, markDone }
}
