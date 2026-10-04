import { useCallback, useState } from 'react'

function storageKey(workspaceId: string): string {
  return `cogniva:session-language:${workspaceId}`
}

/**
 * Whether the user has been asked which language this session runs in.
 *
 * A workspace always *has* a language — it inherits the dashboard's when it is
 * created — so the workspace itself cannot say whether anyone chose it. This
 * flag does, and like the intro flag it lives per browser: it only decides
 * whether to show a dialog once, which is not worth a column.
 *
 * With localStorage unavailable it reports "already chosen", so a private
 * window gets the inherited language rather than the same dialog on every open.
 */
export function useSessionLanguage(workspaceId: string) {
  const [chosen, setChosen] = useState<boolean>(() => {
    if (!workspaceId) return true
    try {
      return localStorage.getItem(storageKey(workspaceId)) === '1'
    } catch {
      return true
    }
  })

  const markChosen = useCallback(() => {
    setChosen(true)
    try {
      localStorage.setItem(storageKey(workspaceId), '1')
    } catch {
      // Losing the flag only means being asked again, which is recoverable.
    }
  }, [workspaceId])

  return { chosen, markChosen }
}
