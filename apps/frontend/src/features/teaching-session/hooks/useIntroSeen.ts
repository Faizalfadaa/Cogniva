import { useCallback, useState } from 'react'

function storageKey(workspaceId: string): string {
  return `cogniva:intro-seen:${workspaceId}`
}

/**
 * "Pertama kali dibuka" di-track per browser (localStorage), bukan di backend -
 * cukup buat keperluan UI (gak perlu nambah field di WorkspaceDTO/bridge).
 */
export function useIntroSeen(workspaceId: string) {
  const [seen, setSeen] = useState<boolean>(() => {
    if (!workspaceId) return true
    try {
      return localStorage.getItem(storageKey(workspaceId)) === '1'
    } catch {
      // localStorage gak available (private mode, dll) - anggap udah seen
      // supaya gak maksa nampilin intro tiap kali tanpa bisa di-skip-permanen-kan.
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