import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CognivaBridge } from '../../../bridge/CognivaBridge'
import type { TeachingCheckpointDTO } from '../../../dto/TeachingCheckpointDTO'
import type { TimelineDTO } from '../../../dto/TimelineDTO'
import type { BoardChange } from '../components/whiteboardTypes'
import type { SessionError } from '../components/errorTypes'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import type { WhiteboardHandle } from '../components/Whiteboard'
import { useAudioRecorder, type RecordedSpan } from '../hooks/useAudioRecorder'
import { toAudioTime } from '../hooks/voiceActivity'
import { changedSince, versionsOf, type BoardVersions, type ElementLike } from '../components/boardDiff'

type TeachingMode = 'editing' | 'locked'

const POLL_INTERVAL_MS = 1000

/** Once the text is in, a voiced reply is polled faster: each poll can bring the next sentence. */
const SPEECH_POLL_INTERVAL_MS = 500

/** How long the "nothing to teach yet" nudge stays up on its own. */
const EMPTY_NUDGE_MS = 6000

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
  recordingStartedAt: number | null,
  spans: readonly RecordedSpan[]
): TimelineDTO | undefined {
  if (recordingStartedAt === null) return undefined

  return {
    recordingStartedAt: new Date(recordingStartedAt).toISOString(),
    events: changes.map(({ at, shapeIds, kind, shape, text }) => ({
      at: at - recordingStartedAt,
      // On the clip's own clock, which is what speech segments are timed on:
      // the two only agree with `at` until the mic is first paused.
      audioAt: toAudioTime(at, spans),
      shapeIds,
      kind,
      ...(shape ? { shape } : {}),
      ...(text ? { text } : {}),
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
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * The board as it stood at the last successful Teach, element by element.
   *
   * What changed since then is exported on its own and read separately, so
   * the student can be told what the teacher just added rather than handed the
   * whole board every turn as if all of it were new. Loaded from the latest
   * checkpoint so a reload or another device picks up where the lesson is.
   *
   * `null` until known, and then nothing is marked as new: the whole board is
   * read as today, which is the safe default.
   */
  const taughtRef = useRef<BoardVersions | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    let active = true
    bridge
      .getCheckpoints(workspaceId)
      .then((list) => {
        if (!active) return
        const last = [...list]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .pop()
        const doc = last?.whiteboardSnapshot as { elements?: ElementLike[] } | undefined
        taughtRef.current = versionsOf(doc?.elements)
      })
      .catch((err) => console.error('[useTeachingSession] loading the last taught board failed', err))
    return () => {
      active = false
    }
  }, [bridge, workspaceId])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollForResponse = useCallback(
    (checkpointId: string) => {
      stopPolling()
      const tick = async () => {
        let found: TeachingCheckpointDTO | undefined
        try {
          const list = await bridge.getCheckpoints(workspaceId)
          found = list.find((c) => c.id === checkpointId)
        } catch (err) {
          // Keep polling: one dropped request is not a failed turn, and the
          // network banner already reports a real outage on its own.
          console.error('[useTeachingSession] getCheckpoints failed', err)
        }
        // Stopped while the request was in flight (continue editing, unmount).
        if (pollRef.current === null) return

        if (found?.learnerResponse) {
          setLatestCheckpoint(found)
          setPending(false)
          // The text is in, but a voiced reply keeps arriving one sentence at a
          // time: keep polling until every clip has landed.
          if (found.speech?.status !== 'pending') {
            stopPolling()
            return
          }
        }
        pollRef.current = setTimeout(
          tick,
          found?.speech?.status === 'pending' ? SPEECH_POLL_INTERVAL_MS : POLL_INTERVAL_MS
        )
      }
      pollRef.current = setTimeout(tick, POLL_INTERVAL_MS)
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
    // Read before flush(), which resets both.
    const spoke = audio.heardVoice()
    const spans = audio.recordedSpans()
    const audioBlob = audio.flush()
    // Drained in the same breath as the audio so the two always describe the
    // same span. recordingStartedAt survives the flush, so it can still be read.
    const boardChanges = handle.flushTimeline?.() ?? []
    const timeline = buildTimeline(boardChanges, audio.recordingStartedAt, spans)
    const { document, image } = await handle.exportSnapshot()
    const elements = (document as { elements?: ElementLike[] } | undefined)?.elements

    // Only after an earlier Teach: on the first one everything is new, and the
    // full reading already says so.
    const taught = taughtRef.current
    const changed = image && taught && taught.size > 0 ? changedSince(taught, elements) : []
    const newContentImage =
      changed.length > 0 ? await handle.exportImageOf?.(changed) : undefined

    // The board and the voice are both teaching, so either one is enough to
    // start a turn: an empty board with something said over it goes out as a
    // voice-only turn, and the backend skips the board reading.
    //
    // Only when both are empty is there nothing for the student to react to.
    // This used to cancel silently, which looked exactly like the button being
    // broken. `spoke` rather than `audioBlob` because the mic starts on its own:
    // there is nearly always a clip, and most of the time it is room noise.
    if (!image && !(audioBlob && spoke)) {
      setError({ kind: 'empty_board' })
      setPending(false)
      setMode('editing')
      return
    }

    try {
      const checkpoint = await bridge.submitCheckpoint(workspaceId, {
        snapshotImage: image ?? null,
        whiteboardSnapshot: document,
        audio: audioBlob,
        timeline,
        newContentImage,
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

      // The student has this board now; the next Teach is measured from here.
      taughtRef.current = versionsOf(elements)
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
    }
  }, [audio, bridge, workspaceId, whiteboardRef, pollForResponse])

  const continueEditing = useCallback(() => {
    stopPolling()
    setMode('editing')
    setPending(false)
  }, [stopPolling])

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

  // The empty-board nudge describes a moment, not a condition that persists:
  // left up, it would go on saying "the board is empty" while the user draws.
  useEffect(() => {
    if (error?.kind !== 'empty_board') return
    const timer = setTimeout(
      () => setError((prev) => (prev?.kind === 'empty_board' ? null : prev)),
      EMPTY_NUDGE_MS
    )
    return () => clearTimeout(timer)
  }, [error])

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
