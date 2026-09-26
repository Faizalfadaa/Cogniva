import { useCallback, useEffect, useRef, useState } from 'react'
import { addFrame, isSpeech, LEVEL_SAMPLE_MS, NO_VOICE, rms, type VoiceCount } from './voiceActivity'

interface UseAudioRecorderResult {
  isRecording: boolean
  /** true if the user denies mic permission, or there's no device - audio stays optional and doesn't block the flow */
  permissionDenied: boolean
  start: () => Promise<void>
  stop: () => Promise<void>
  /** Drain all accumulated chunks into one Blob and reset the buffer.
   *  Called by teach() — not by the user directly. */
  flush: () => Blob | undefined
  /**
   * Whether the mic heard sustained sound, the way an explanation sounds, since
   * the last flush() (see voiceActivity.ts). Read it before flushing, which
   * resets it.
   *
   * Needed because the mic starts on its own when the workspace opens, so there
   * is nearly always a clip to flush: a clip existing says nothing about whether
   * the user spoke. True when the level cannot be measured at all, so a browser
   * without Web Audio never has its voice turn refused.
   */
  heardVoice: () => boolean
  /**
   * The stretches of wall-clock time the mic was actually recording since the
   * last flush(), in order. The clip holds only these, joined end to end, so a
   * moment on the wall clock maps into the clip by adding up the stretches
   * before it (see toAudioTime). Read it before flushing, which resets it.
   */
  recordedSpans: () => RecordedSpan[]
  /** Wall clock (epoch ms) at which the current, not-yet-flushed batch of audio
   *  began — i.e. the t=0 of the Blob that flush() will return. null until the
   *  first successful start (e.g. while mic permission is still denied).
   *  Deliberately NOT cleared by flush(), so teach() can still read it after
   *  draining; the next start() re-stamps it for the next batch. */
  recordingStartedAt: number | null
}

/** One stretch of recording, in epoch milliseconds. */
export interface RecordedSpan {
  start: number
  end: number
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
  // Level metering, alongside the recorder on the same stream. Frames persist
  // across start/stop cycles like the chunks do, and reset only on flush().
  const audioContextRef = useRef<AudioContext | null>(null)
  const meterRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceRef = useRef<VoiceCount>(NO_VOICE)
  const spansRef = useRef<{ start: number; end: number | null }[]>([])
  const meteredRef = useRef(false)

  const stopMeter = useCallback(() => {
    if (meterRef.current) clearInterval(meterRef.current)
    meterRef.current = null
    audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
  }, [])

  const startMeter = useCallback((stream: MediaStream) => {
    try {
      const context = new AudioContext()
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      context.createMediaStreamSource(stream).connect(analyser)
      const samples = new Float32Array(analyser.fftSize)

      meterRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(samples)
        voiceRef.current = addFrame(voiceRef.current, rms(samples))
      }, LEVEL_SAMPLE_MS)

      audioContextRef.current = context
      meteredRef.current = true
    } catch {
      // No Web Audio: recording still works, the level just is not known.
      meteredRef.current = false
    }
  }, [])

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
      spansRef.current.push({ start: Date.now(), end: null })
      startMeter(stream)
      setIsRecording(true)
      setPermissionDenied(false)
    } catch {
      setPermissionDenied(true)
      setIsRecording(false)
    }
  }, [startMeter])

  const stop = useCallback((): Promise<void> => {
    const recorder = recorderRef.current
    if (!recorder) return Promise.resolve()

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const open = spansRef.current[spansRef.current.length - 1]
        if (open && open.end === null) open.end = Date.now()
        stopMeter()
        // Release the mic track so the browser recording indicator clears.
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        recorderRef.current = null
        setIsRecording(false)
        resolve()
      }
      recorder.stop()
    })
  }, [stopMeter])

  const flush = useCallback((): Blob | undefined => {
    spansRef.current = []
    if (chunksRef.current.length === 0) return undefined
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
    chunksRef.current = []
    voiceRef.current = NO_VOICE
    return blob
  }, [])

  // Recording starts only from the mic button. Release the device on unmount.
  const heardVoice = useCallback(() => !meteredRef.current || isSpeech(voiceRef.current), [])

  const recordedSpans = useCallback(
    (): RecordedSpan[] =>
      spansRef.current.map(({ start, end }) => ({ start, end: end ?? Date.now() })),
    []
  )

  // Auto-start once on mount.
  useEffect(() => {
    return () => {
      recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      stopMeter()
    }
  }, [])

  return {
    isRecording,
    permissionDenied,
    start,
    stop,
    flush,
    heardVoice,
    recordedSpans,
    recordingStartedAt,
  }
}
