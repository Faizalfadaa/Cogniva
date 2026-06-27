import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBridge } from '../../bridge/BridgeProvider'
import type { WorkspaceDTO } from '../../dto/WorkspaceDTO'
import { Whiteboard } from '../../features/teaching-session/components/Whiteboard/Whiteboard'

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const bridge = useBridge()
  const [workspace, setWorkspace] = useState<WorkspaceDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    bridge.getWorkspace(id).then((ws) => {
      if (!active) return
      setWorkspace(ws)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [bridge, id])

  const handleAutosave = useCallback(
    (payload: { snapshot: unknown; thumbnail?: Blob }) => {
      if (!id) return
      bridge.saveWhiteboardDraft(id, payload)
    },
    [bridge, id]
  )

  if (!id || loading) {
    // TODO: loading state proper di fase Polish
    return null
  }

  return <Whiteboard initialSnapshot={workspace?.currentWhiteboardSnapshot} onAutosave={handleAutosave} />
}