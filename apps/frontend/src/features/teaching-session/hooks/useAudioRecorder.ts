import { useCallback, useEffect, useRef, useState } from 'react'

interface UseAudioRecorderResult {
  isRecording: boolean
  /** true kalau user menolak izin mic, atau device gak ada - audio tetap optional, gak menghalangi flow */
  permissionDenied: boolean
  start: () => Promise<void>
  stop: () => Promise<Blob | undefined>
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(async () => {
    if (recorderRef.current) return // sudah jalan

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start()

      recorderRef.current = recorder
      setIsRecording(true)
      setPermissionDenied(false)
    } catch {
      // Mic ditolak / gak ada device - audio cuma optional, lanjut tanpa rekam.
      setPermissionDenied(true)
      setIsRecording(false)
    }
  }, [])

  const stop = useCallback((): Promise<Blob | undefined> => {
    const recorder = recorderRef.current
    if (!recorder) return Promise.resolve(undefined)

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
            : undefined

        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        recorderRef.current = null
        setIsRecording(false)
        resolve(blob)
      }
      recorder.stop()
    })
  }, [])

  // Auto-start sekali saat komponen pertama mount (mode Editing dimulai).
  useEffect(() => {
    start()
    return () => {
      recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isRecording, permissionDenied, start, stop }
}