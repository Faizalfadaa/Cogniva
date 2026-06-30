import { useCallback, useEffect, useRef, useState } from 'react'
import type { CognivaBridge } from '../../../bridge/CognivaBridge'

export type TitleSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 800

export function useWorkspaceTitleAutosave(
  workspaceId: string,
  initialTitle: string | undefined,
  bridge: CognivaBridge
) {
  const [title, setTitle] = useState(initialTitle ?? '')
  const [status, setStatus] = useState<TitleSaveStatus>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Once the user starts typing, don't let a re-fetched initialTitle overwrite their input.
  const hasEditedRef = useRef(false)

  useEffect(() => {
    if (hasEditedRef.current) return
    setTitle(initialTitle ?? '')
  }, [initialTitle])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const onChange = useCallback(
    (value: string) => {
      hasEditedRef.current = true
      setTitle(value)
      setStatus('saving')

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        try {
          await bridge.updateWorkspaceMeta(workspaceId, { title: value })
          setStatus('saved')
        } catch {
          setStatus('error')
        }
      }, DEBOUNCE_MS)
    },
    [bridge, workspaceId]
  )

  return { title, status, onChange }
}