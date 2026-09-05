import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CognivaBridge } from '../../../bridge/CognivaBridge'
import type { TeachingCheckpointDTO } from '../../../dto/TeachingCheckpointDTO'
import type { TimelineDTO } from '../../../dto/TimelineDTO'
import type { BoardChange } from '../components/whiteboardTypes'
import type { SessionError } from '../components/errorTypes'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
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
  const [error, setError] = useState<SessionError | null>(null)
  const online = useNetworkStatus()
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
    // A fresh attempt clears the last complaint; a still-true one comes back
    // below, and the offline effect re-raises the network case on its own.
    setError(null)

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

    try {
      const checkpoint = await bridge.submitCheckpoint(workspaceId, {
        snapshotImage: image,
        whiteboardSnapshot: document,
        audio: audioBlob,
        timeline,
      })
      setLatestCheckpoint(checkpoint)

      // Not an exception: the request succeeded, and the backend is telling us
      // the turn was refused for a reason it understands (§7.3). No point
      // polling for a reply that will never be written.
      if (checkpoint.errorKind === 'budget_exceeded') {
        setError({ kind: 'budget_exceeded' })
        setPending(false)
        setMode('editing')
        return
      }

      pollForResponse(checkpoint.id)
    } catch (err) {
      // The bridge throws a plain Error for a non-2xx response and a TypeError
      // when fetch never reached anyone; `navigator.onLine` is what separates
      // "your wifi is off" from "the server is unhappy".
      console.error('[useTeachingSession] submitCheckpoint failed', err)
      const detail = err instanceof Error ? err.message : String(err)
      setError(
        navigator.onLine ? { kind: 'ai_unavailable', detail } : { kind: 'network' }
      )
      // Unlock the board so the work is not trapped behind a failed turn.
      setPending(false)
      setMode('editing')
      audio.start()
    }
  }, [audio, bridge, workspaceId, whiteboardRef, pollForResponse])

  const continueEditing = useCallback(() => {
    stopPolling()
    setMode('editing')
    setPending(false)
    audio.start()
  }, [audio, stopPolling])

  const dismissError = useCallback(() => setError(null), [])

  const toggleRecording = useCallback(async () => {
    if (audio.isRecording) {
      await audio.stop()
    } else {
      await audio.start()
    }
  }, [audio])

  // Proactive: raise the moment the connection drops rather than waiting for
  // the user to press Teach and fail. Clearing is automatic too — a network
  // banner the user has to dismiss by hand after reconnecting is just noise.
  useEffect(() => {
    if (!online) {
      setError({ kind: 'network' })
      return
    }
    setError((prev) => (prev?.kind === 'network' ? null : prev))
  }, [online])

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
    error,
    dismissError,
  }
}