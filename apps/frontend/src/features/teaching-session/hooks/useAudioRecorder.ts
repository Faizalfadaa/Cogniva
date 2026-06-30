import { useCallback, useEffect, useRef, useState } from 'react'

interface UseAudioRecorderResult {
  isRecording: boolean
  /** true kalau user menolak izin mic, atau device gak ada - audio tetap optional, gak menghalangi flow */
  permissionDenied: boolean
  start: () => Promise<void>
  stop: () => Promise<void>
  /** Drain all accumulated chunks into one Blob and reset the buffer.
   *  Called by teach() — not by the user directly. */
  flush: () => Blob | undefined
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
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

  return { isRecording, permissionDenied, start, stop, flush }
}