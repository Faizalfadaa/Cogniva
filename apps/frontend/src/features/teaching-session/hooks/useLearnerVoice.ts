import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Playback for the learner's synthesized voice (XTTS, see services/tts).
 *
 * Three things this handles that a bare <audio> tag would not:
 *
 *  1. One clip at a time. A single shared element means a new reply cuts off the
 *     previous one instead of two learners talking over each other.
 *  2. Auto-play exactly once per clip. The reply to a "Teach" press appears in
 *     BOTH the floating bubble and the chat sidebar, sharing one audio URL — so
 *     without de-duplication the same line would play twice, together.
 *  3. A mute preference that survives a reload.
 *  4. A live amplitude signal, so the avatar can move in time with the voice
 *     instead of playing a canned animation.
 */

const MUTED_KEY = 'cogniva:voiceMuted'

// One element for the whole app; module scope so it is shared across components.
let element: HTMLAudioElement | null = null

/**
 * Clips already downloaded, keyed by their API url.
 *
 * Playing from a same-origin blob is what lets the Web Audio analyser read the
 * waveform; a cross-origin media stream reports silence and the avatar never
 * moves. But fetching cannot happen inside play(): an `await` before
 * `audio.play()` loses the user-gesture context and the browser rejects
 * playback outright. So clips are fetched ahead of time and play() stays
 * synchronous.
 */
const blobUrls = new Map<string, string>()

/** Download a clip so a later play() can start it without awaiting. */
export async function prefetchClip(url: string | undefined): Promise<void> {
  if (!url || blobUrls.has(url)) return
  try {
    const response = await fetch(resolveAudioUrl(url))
    if (!response.ok) return
    blobUrls.set(url, URL.createObjectURL(await response.blob()))
  } catch {
    // Offline or the clip vanished; play() falls back to the remote url.
  }
}

/** URLs already auto-played, so a clip auto-plays once no matter who asks. */
const autoPlayed = new Set<string>()

/** Subscribers to the "what is playing" state. */
const listeners = new Set<(url: string | null) => void>()
let currentUrl: string | null = null

function setCurrent(url: string | null): void {
  currentUrl = url
  for (const listener of listeners) listener(url)
}

function audioElement(): HTMLAudioElement {
  if (!element) {
    element = new Audio()
    element.addEventListener('ended', () => setCurrent(null))
    element.addEventListener('error', () => setCurrent(null))
  }
  return element
}

// --- amplitude ------------------------------------------------------------

let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let wiringAttempted = false

function ensureContext(): AudioContext | null {
  if (audioContext || wiringAttempted) return audioContext
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) {
      wiringAttempted = true
      return null
    }
    audioContext = new Ctor()
    return audioContext
  } catch {
    wiringAttempted = true
    return null
  }
}

/**
 * Wire the shared element through an analyser, once — and only once it is safe.
 *
 * The ordering here matters more than it looks. `createMediaElementSource`
 * captures an element permanently: from that call onward the audio reaches the
 * speakers only through this graph. A browser starts an AudioContext
 * *suspended* until a real user gesture, so capturing the element early would
 * route every auto-played reply into a stalled graph and silence it — trading a
 * moving avatar for no voice at all.
 *
 * So the element is left alone until the context is actually running. Until
 * then playback goes straight out of the element as it always did, and the
 * avatar simply does not react yet.
 */
function ensureAnalyser(): AnalyserNode | null {
  if (analyser) return analyser
  const context = ensureContext()
  if (!context) return null

  if (context.state !== 'running') {
    void context.resume()
    return null
  }

  try {
    const source = context.createMediaElementSource(audioElement())
    const node = context.createAnalyser()
    node.fftSize = 1024
    node.smoothingTimeConstant = 0.6
    source.connect(node)
    node.connect(context.destination)
    analyser = node
    return node
  } catch {
    // Capture failed; leave the element on its default output.
    wiringAttempted = true
    return null
  }
}

// A browser only lets an AudioContext start from a genuine user gesture. The
// app has plenty of those, so resume on the first one rather than waiting for
// the user to happen to click inside the stage.
if (typeof window !== 'undefined') {
  const wake = (): void => {
    const context = ensureContext()
    if (context && context.state !== 'running') void context.resume()
  }
  window.addEventListener('pointerdown', wake, { passive: true })
  window.addEventListener('keydown', wake, { passive: true })
}

/**
 * Drive `--voice-level` (0..1) on an element for as long as speech is playing.
 *
 * The value is written straight to the DOM rather than held in React state:
 * this updates every animation frame, and re-rendering the tree 60 times a
 * second to move an avatar would be absurd. CSS reads the variable and does the
 * rest.
 */
export function useVoiceLevel(target: RefObject<HTMLElement | null>): void {
  const { playingUrl } = useLearnerVoice()
  const frame = useRef<number | null>(null)
  const smoothed = useRef(0)

  useEffect(() => {
    const node = target.current
    if (!node) return

    if (!playingUrl) {
      smoothed.current = 0
      node.style.setProperty('--voice-level', '0')
      return
    }

    const scope = ensureAnalyser()
    if (!scope) {
      // No analyser: hold a mid-level so the avatar still reads as "speaking".
      node.style.setProperty('--voice-level', '0.45')
      return
    }

    void audioContext?.resume()
    const samples = new Uint8Array(scope.fftSize)
    const startedAt = performance.now()
    let heardAnything = false

    const tick = (): void => {
      scope.getByteTimeDomainData(samples)
      // RMS around the 128 midpoint, scaled so ordinary speech lands near 1.
      let sum = 0
      for (const sample of samples) {
        const deviation = (sample - 128) / 128
        sum += deviation * deviation
      }
      let level = Math.min(1, Math.sqrt(sum / samples.length) * 3.2)
      if (level > 0.01) heardAnything = true

      // The analyser can legitimately be wired and still report pure silence —
      // a tainted stream, or an output the graph never actually receives. That
      // is invisible: no error, just an avatar that never moves. If nothing has
      // been heard shortly after playback began, drive the motion from a
      // synthetic envelope instead so the character still visibly speaks.
      if (!heardAnything && performance.now() - startedAt > 1200) {
        const t = performance.now() / 1000
        level = 0.34 + 0.3 * Math.abs(Math.sin(t * 5.1)) + 0.16 * Math.abs(Math.sin(t * 11.7))
      }

      // Fast attack, slow release — mirrors how a voice actually decays, and
      // stops the avatar from flickering between syllables.
      const previous = smoothed.current
      smoothed.current = level > previous ? level : previous * 0.82 + level * 0.18

      node.style.setProperty('--voice-level', smoothed.current.toFixed(3))
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      node.style.setProperty('--voice-level', '0')
    }
  }, [playingUrl, target])
}

/** The backend returns a relative /api path; blob/data URLs are already absolute. */
export function resolveAudioUrl(url: string): string {
  if (/^(https?:|blob:|data:)/.test(url)) return url
  const base = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'
  return `${base}${url}`
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === 'true'
  } catch {
    return false
  }
}

export interface LearnerVoice {
  muted: boolean
  toggleMuted: () => void
  /** Currently playing URL, or null. Use it to render a "speaking" state. */
  playingUrl: string | null
  /** Play now, regardless of how many times this clip has played before. */
  play: (url: string) => void
  /** Play only if unmuted and this clip has never auto-played. */
  autoPlay: (url: string | undefined) => void
  /** Download a clip ahead of time so play() can start it without awaiting. */
  prefetch: (url: string | undefined) => void
  /**
   * Mark clips as already heard so they never auto-play. Used to seed the
   * backlog when a view opens on an existing conversation.
   */
  markHeard: (urls: Array<string | undefined>) => void
  stop: () => void
}

export function useLearnerVoice(): LearnerVoice {
  const [muted, setMuted] = useState(readMuted)
  const [playingUrl, setPlayingUrl] = useState<string | null>(currentUrl)

  useEffect(() => {
    listeners.add(setPlayingUrl)
    return () => {
      listeners.delete(setPlayingUrl)
    }
  }, [])

  const stop = useCallback(() => {
    const audio = audioElement()
    audio.pause()
    setCurrent(null)
  }, [])

  const play = useCallback((url: string) => {
    const audio = audioElement()
    // Everything here is synchronous on purpose. Awaiting anything before
    // play() forfeits the user gesture that permits playback, and the call is
    // then rejected — silently, because a rejected play() throws nowhere the
    // user can see.
    audio.src = blobUrls.get(url) ?? resolveAudioUrl(url)
    setCurrent(url)
    audio.play().catch(() => setCurrent(null))
    // Not cached yet: fetch it now so the next play of this clip is
    // same-origin and the analyser can read it.
    if (!blobUrls.has(url)) void prefetchClip(url)
  }, [])

  const autoPlay = useCallback(
    (url: string | undefined) => {
      if (!url || muted || autoPlayed.has(url)) return
      // Claimed before the await, so two polls landing together cannot both
      // start the same clip.
      autoPlayed.add(url)

      // Unlike a replay press, this fires from polling — there is no user
      // gesture to forfeit by awaiting. So fetch first: the very first play is
      // then same-origin, which is what lets the analyser read the waveform and
      // move the avatar. A manual press still plays synchronously.
      void prefetchClip(url).then(() => play(url))
    },
    [muted, play],
  )

  const markHeard = useCallback((urls: Array<string | undefined>) => {
    for (const url of urls) {
      if (url) autoPlayed.add(url)
    }
  }, [])

  const toggleMuted = useCallback(() => {
    setMuted((wasMuted) => {
      const next = !wasMuted
      try {
        localStorage.setItem(MUTED_KEY, String(next))
      } catch {
        // localStorage unavailable (private mode) — the toggle still works for
        // this session, it just will not be remembered.
      }
      if (next) {
        audioElement().pause()
        setCurrent(null)
      }
      return next
    })
  }, [])

  const prefetch = useCallback((url: string | undefined) => {
    void prefetchClip(url)
  }, [])

  return { muted, toggleMuted, playingUrl, play, autoPlay, prefetch, markHeard, stop }
}
