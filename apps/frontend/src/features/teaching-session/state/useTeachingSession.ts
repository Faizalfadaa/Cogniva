import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CognivaBridge } from '../../../bridge/CognivaBridge'
import type { TeachingCheckpointDTO } from '../../../dto/TeachingCheckpointDTO'
import type { WhiteboardHandle } from '../components/Whiteboard'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

type TeachingMode = 'editing' | 'locked'

const POLL_INTERVAL_MS = 1000

export function useTeachingSession(
  workspaceId: string,
  bridge: CognivaBridge,
  whiteboardRef: RefObject<WhiteboardHandle>
) {
  const [mode, setMode] = useState<TeachingMode>('editing')
  const [pending, setPending] = useState(false)
  const [latestCheckpoint, setLatestCheckpoint] = useState<TeachingCheckpointDTO | null>(null)
  const audio = useAudioRecorder()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollForResponse = useCallback(
    (checkpointId: string) => {
      stopPolling()
      pollRef.current = setInterval(async () => {
        const list = await bridge.getCheckpoints(workspaceId)
        const found = list.find((c) => c.id === checkpointId)
        if (found?.learnerResponse) {
          setLatestCheckpoint(found)
          setPending(false)
          stopPolling()
        }
      }, POLL_INTERVAL_MS)
    },
    [bridge, workspaceId, stopPolling]
  )

  const teach = useCallback(async () => {
    const handle = whiteboardRef.current
    if (!handle) return

    setMode('locked')
    setPending(true)

    const audioBlob = await audio.stop()
    const { document, image } = await handle.exportSnapshot()

    if (!image) {
      // Kanvas masih kosong - gak ada yang berarti buat dikirim ke Vision, batalkan.
      setPending(false)
      setMode('editing')
      audio.start()
      return
    }

    const checkpoint = await bridge.submitCheckpoint(workspaceId, {
      snapshotImage: image,
      whiteboardSnapshot: document,
      audio: audioBlob,
    })
    setLatestCheckpoint(checkpoint)
    pollForResponse(checkpoint.id)
  }, [audio, bridge, workspaceId, whiteboardRef, pollForResponse])

  const continueEditing = useCallback(() => {
    stopPolling()
    setMode('editing')
    setPending(false)
    audio.start()
  }, [audio, stopPolling])

  useEffect(() => stopPolling, [stopPolling])

  return {
    mode,
    pending,
    latestCheckpoint,
    isRecording: audio.isRecording,
    micPermissionDenied: audio.permissionDenied,
    teach,
    continueEditing,
  }
}