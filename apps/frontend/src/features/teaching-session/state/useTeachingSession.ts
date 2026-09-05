import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CognivaBridge } from '../../../bridge/CognivaBridge'
import type { TeachingCheckpointDTO } from '../../../dto/TeachingCheckpointDTO'
import type { TimelineDTO } from '../../../dto/TimelineDTO'
import type { BoardChange } from '../components/whiteboardTypes'
import type { WhiteboardHandle } from '../components/Whiteboard'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

type TeachingMode = 'editing' | 'locked'

const POLL_INTERVAL_MS = 1000

/**
 * Rebase the editor's wall-clock board changes onto the recording's origin
 * (Phase 1 of audio-visual sync: captured and sent, not yet used for anything).
 *
 * Without a recording there is no clock to measure against, so no timeline is
 * sent at all rather than one anchored to a made-up zero. Offsets can come out
 * negative when the user drew before the mic came up — that is real signal, so
 * it is kept rather than clamped.
 */
function buildTimeline(
  changes: BoardChange[],
  recordingStartedAt: number | null
): TimelineDTO | undefined {
  if (recordingStartedAt === null) return undefined

  return {
    recordingStartedAt: new Date(recordingStartedAt).toISOString(),
    events: changes.map(({ at, shapeIds, kind }) => ({
      at: at - recordingStartedAt,
      shapeIds,
      kind,
    })),
  }
}

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

    // Stop the active recording segment (if any) so the final chunk is committed,
    // then flush all accumulated chunks since the last checkpoint into one blob.
    await audio.stop()
    const audioBlob = audio.flush()
    // Drained in the same breath as the audio so the two always describe the
    // same span. recordingStartedAt survives the flush, so it can still be read.
    const boardChanges = handle.flushTimeline?.() ?? []
    const timeline = buildTimeline(boardChanges, audio.recordingStartedAt)
    const { document, image } = await handle.exportSnapshot()

    if (!image) {
      // Canvas is still empty - nothing meaningful to send to Vision, so cancel.
      setPending(false)
      setMode('editing')
      audio.start()
      return
    }

    const checkpoint = await bridge.submitCheckpoint(workspaceId, {
      snapshotImage: image,
      whiteboardSnapshot: document,
      audio: audioBlob,
      timeline,
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

  const toggleRecording = useCallback(async () => {
    if (audio.isRecording) {
      await audio.stop()
    } else {
      await audio.start()
    }
  }, [audio])

  useEffect(() => stopPolling, [stopPolling])

  return {
    mode,
    pending,
    latestCheckpoint,
    isRecording: audio.isRecording,
    micPermissionDenied: audio.permissionDenied,
    teach,
    continueEditing,
    toggleRecording,
  }
}