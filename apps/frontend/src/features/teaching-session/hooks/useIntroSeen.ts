import { useCallback, useState } from 'react'

function storageKey(workspaceId: string): string {
  return `cogniva:intro-seen:${workspaceId}`
}

/**
 * "First opened" is tracked per browser (localStorage), not on the backend -
 * enough for UI purposes (no need to add a field to WorkspaceDTO/bridge).
 */
export function useIntroSeen(workspaceId: string) {
  const [seen, setSeen] = useState<boolean>(() => {
    if (!workspaceId) return true
    try {
      return localStorage.getItem(storageKey(workspaceId)) === '1'
    } catch {
      // localStorage not available (private mode, etc.) - assume already seen
      // so it doesn't force the intro every time without being permanently skippable.
      return true
    }
  })

  const markSeen = useCallback(() => {
    setSeen(true)
    try {
      localStorage.setItem(storageKey(workspaceId), '1')
    } catch {
      // ignore
    }
  }, [workspaceId])

  return { seen, markSeen }
}