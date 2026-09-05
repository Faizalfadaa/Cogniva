import { useCallback, useEffect, useRef, useState } from 'react'

interface UseAudioRecorderResult {
  isRecording: boolean
  /** true if the user denies mic permission, or there's no device - audio stays optional and doesn't block the flow */
  permissionDenied: boolean
  start: () => Promise<void>
  stop: () => Promise<void>
  /** Drain all accumulated chunks into one Blob and reset the buffer.
   *  Called by teach() — not by the user directly. */
  flush: () => Blob | undefined
  /** Wall clock (epoch ms) at which the current, not-yet-flushed batch of audio
   *  began — i.e. the t=0 of the Blob that flush() will return. null until the
   *  first successful start (e.g. while mic permission is still denied).
   *  Deliberately NOT cleared by flush(), so teach() can still read it after
   *  draining; the next start() re-stamps it for the next batch. */
  recordingStartedAt: number | null
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // Chunks persist across start/stop cycles until flush() is called.
  const chunksRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef<string>('audio/webm')

  const start = useCallback(async () => {
    if (recorderRef.current) return // already running

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream)
      mimeTypeRef.current = recorder.mimeType || 'audio/webm'
      // Append — do NOT reset chunksRef here.
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start()

      // A batch spans every start/stop cycle until flush() drains it, so the
      // origin is stamped only when the buffer is empty. Toggling the mic
      // mid-explanation keeps the existing origin, which is what keeps the
      // board timestamps lined up with the single concatenated Blob.
      if (chunksRef.current.length === 0) setRecordingStartedAt(Date.now())

      recorderRef.current = recorder
      setIsRecording(true)
      setPermissionDenied(false)
    } catch {
      setPermissionDenied(true)
      setIsRecording(false)
    }
  }, [])

  const stop = useCallback((): Promise<void> => {
    const recorder = recorderRef.current
    if (!recorder) return Promise.resolve()

    return new Promise((resolve) => {
      recorder.onstop = () => {
        // Release the mic track so the browser recording indicator clears.
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        recorderRef.current = null
        setIsRecording(false)
        resolve()
      }
      recorder.stop()
    })
  }, [])

  const flush = useCallback((): Blob | undefined => {
    if (chunksRef.current.length === 0) return undefined
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
    chunksRef.current = []
    return blob
  }, [])

  // Auto-start once on mount.
  useEffect(() => {
    start()
    return () => {
      recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isRecording, permissionDenied, start, stop, flush, recordingStartedAt }
}