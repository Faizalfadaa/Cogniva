import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { LearnerSpeechDTO } from '../../../dto/LearnerSpeechDTO'

/**
 * Playback for the learner's synthesized voice (Chatterbox, see services/tts).
 *
 * What this handles that a bare <audio> tag would not:
 *
 *  1. One clip at a time. A single shared element means a new reply cuts off the
 *     previous one instead of two learners talking over each other.
 *  2. Each reply spoken exactly once. The reply to a "Teach" press appears in
 *     BOTH the floating bubble and the chat stage, sharing one speech id — so
 *     without de-duplication the same line would play twice, together.
 *  3. Replies spoken sentence by sentence, with their text revealed in step:
 *     each sentence appears on screen as its clip starts, the way a person's
 *     words arrive, instead of the whole paragraph landing seconds before the
 *     voice catches up.
 *  4. A mute preference that survives a reload and applies everywhere at once.
 *  5. A live amplitude signal, so the avatar can move in time with the voice
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
    element.addEventListener('ended', () => {
      setCurrent(null)
      onClipEnded()
    })
    element.addEventListener('error', () => {
      setCurrent(null)
      onClipEnded()
    })
  }
  return element
}

/**
 * Start one clip on the shared element.
 *
 * Everything here is synchronous on purpose. Awaiting anything before play()
 * forfeits the user gesture that permits playback, and the call is then
 * rejected — silently, because a rejected play() throws nowhere the user can see.
 */
function playClip(url: string): void {
  const audio = audioElement()
  audio.src = blobUrls.get(url) ?? resolveAudioUrl(url)
  setCurrent(url)
  audio.play().catch(() => setCurrent(null))
  // Not cached yet: fetch it now so the next play of this clip is same-origin
  // and the analyser can read it.
  if (!blobUrls.has(url)) void prefetchClip(url)
}

// --- mute -----------------------------------------------------------------

/** One switch for the whole app, so muting in the header silences the stage too. */
let mutedFlag = readMuted()
const mutedListeners = new Set<(muted: boolean) => void>()

function setMutedFlag(next: boolean): void {
  mutedFlag = next
  try {
    localStorage.setItem(MUTED_KEY, String(next))
  } catch {
    // localStorage unavailable (private mode) — the toggle still works for
    // this session, it just will not be remembered.
  }
  if (next) {
    audioElement().pause()
    setCurrent(null)
    // Muting shows every held-back reply in full: nothing is coming to reveal it.
    interruptUtterances(true)
  }
  for (const listener of mutedListeners) listener(next)
  notifyUtterances()
}

// --- utterances: a reply spoken sentence by sentence ------------------------

/**
 * How long a reply's text is held back waiting for a clip — first for its
 * opening sentence, then for each next one — before the rest is shown anyway.
 * Words must never stay hidden behind a voice that is not coming.
 */
const CLIP_WAIT_MS = 8000

export type UtterancePhase = 'waiting' | 'speaking' | 'done'

export interface UtteranceProgress {
  phase: UtterancePhase
  /** How many leading sentences should be on screen. */
  revealed: number
}

interface Utterance {
  id: string
  speech: LearnerSpeechDTO
  phase: UtterancePhase
  revealed: number
  /** Index of the sentence whose clip holds the element, or -1. */
  playing: number
  timer: ReturnType<typeof setTimeout> | null
  /** A replay run: plays every clip again and never marks anything heard. */
  replay: boolean
}

const utterances = new Map<string, Utterance>()
/** Replies waiting for the element, in arrival order. */
const utteranceQueue: string[] = []
/** The reply that owns the element right now, if any. */
let activeUtterance: Utterance | null = null
/** Replies that already played, were skipped, or predate this page. */
const heardSpeech = new Set<string>()
const utteranceListeners = new Set<() => void>()

function notifyUtterances(): void {
  for (const listener of utteranceListeners) listener()
}

/**
 * Speak a reply as its clips become available.
 *
 * Called with the latest snapshot on every poll, and safe to be: a reply already
 * heard is ignored, a known one only has its snapshot refreshed, and replies are
 * spoken one after another in the order they first arrived.
 */
export function speakUtterance(speech: LearnerSpeechDTO): void {
  if (heardSpeech.has(speech.id)) return

  // Download clips as soon as they exist, so each sentence starts the instant
  // the previous one ends, and plays same-origin for the analyser.
  for (const segment of speech.segments) {
    if (segment.audioUrl) void prefetchClip(segment.audioUrl)
  }

  let utterance = utterances.get(speech.id)
  if (!utterance) {
    utterance = {
      id: speech.id,
      speech,
      phase: 'waiting',
      revealed: 0,
      playing: -1,
      timer: null,
      replay: false,
    }
    utterances.set(speech.id, utterance)
    if (mutedFlag) {
      finishUtterance(utterance)
      return
    }
    utteranceQueue.push(speech.id)
  } else {
    utterance.speech = speech
  }
  pump()
  notifyUtterances()
}

/** Play a reply again from its first sentence. Its text is already on screen. */
export function replayUtterance(speech: LearnerSpeechDTO): void {
  if (!speech.segments.some((segment) => segment.audioUrl)) return
  interruptUtterances()
  const run: Utterance = {
    id: `${speech.id}#replay`,
    speech,
    phase: 'waiting',
    revealed: 0,
    playing: -1,
    timer: null,
    replay: true,
  }
  utterances.set(run.id, run)
  activeUtterance = run
  // Synchronous down to audio.play(), so a replay press keeps its user gesture.
  advance(run)
}

/** Mark replies as already heard, e.g. a conversation restored on reload. */
export function markSpeechHeard(ids: Array<string | undefined>): void {
  for (const id of ids) {
    if (!id) continue
    heardSpeech.add(id)
    const utterance = utterances.get(id)
    if (utterance && utterance.phase !== 'done') finishUtterance(utterance)
  }
  notifyUtterances()
}

/** Mark single legacy clips as already heard so they never auto-play. */
export function markHeardUrls(urls: Array<string | undefined>): void {
  for (const url of urls) {
    if (url) autoPlayed.add(url)
  }
}

/** Where a reply stands: still waiting for its voice, being spoken, or done. */
export function utteranceProgress(speech: LearnerSpeechDTO): UtteranceProgress {
  const total = speech.segments.length
  const utterance = utterances.get(speech.id)
  if (utterance && utterance.phase !== 'done') {
    return { phase: utterance.phase, revealed: utterance.revealed }
  }
  if (utterance || heardSpeech.has(speech.id) || mutedFlag) return { phase: 'done', revealed: total }
  // Not started yet. Nothing to wait for if synthesis gave up before any clip.
  if (speech.status !== 'pending' && !speech.segments.some((segment) => segment.audioUrl)) {
    return { phase: 'done', revealed: total }
  }
  return { phase: 'waiting', revealed: 0 }
}

/** Re-render whenever any reply's progress changes. */
export function useUtteranceProgress(speech: LearnerSpeechDTO | undefined): UtteranceProgress | null {
  const [, rerender] = useState(0)
  useEffect(() => {
    const listener = () => rerender((n) => n + 1)
    utteranceListeners.add(listener)
    return () => {
      utteranceListeners.delete(listener)
    }
  }, [])
  return speech ? utteranceProgress(speech) : null
}

/**
 * The part of a reply that belongs on screen right now: everything once it is
 * done, the sentences said so far while it speaks, and nothing while it waits.
 */
export function spokenText(
  content: string,
  speech: LearnerSpeechDTO | undefined,
  progress: UtteranceProgress | null,
): string {
  if (!speech || !progress || progress.phase === 'done') return content
  return speech.segments
    .slice(0, progress.revealed)
    .map((segment) => segment.text)
    .join(' ')
}

/** Give the element to the next queued reply when nothing of ours holds it. */
function pump(): void {
  if (!activeUtterance) {
    // A manually played clip still owns the element; wait for it to end.
    if (currentUrl !== null) return
    while (utteranceQueue.length > 0 && !activeUtterance) {
      const next = utterances.get(utteranceQueue.shift()!)
      if (next && next.phase !== 'done') {
        activeUtterance = next
        armWait(next)
      }
    }
    if (!activeUtterance) return
  }
  advance(activeUtterance)
}

function advance(utterance: Utterance): void {
  if (utterance.phase === 'done' || utterance.playing !== -1) return
  const index = utterance.revealed
  const { segments, status } = utterance.speech
  if (index >= segments.length) {
    finishUtterance(utterance)
    return
  }
  const url = segments[index].audioUrl
  if (url) {
    playSegment(utterance, index, url)
    return
  }
  // No clip for this sentence yet: keep waiting only while one can still arrive.
  if (status !== 'pending') finishUtterance(utterance)
}

function playSegment(utterance: Utterance, index: number, url: string): void {
  clearWait(utterance)
  utterance.playing = index
  utterance.revealed = index + 1
  utterance.phase = 'speaking'
  const audio = audioElement()
  audio.src = blobUrls.get(url) ?? resolveAudioUrl(url)
  setCurrent(url)
  audio.play().catch(() => {
    // Refused (no user gesture in this tab yet) or a broken clip: show the
    // words rather than hold them behind audio that will not play.
    if (activeUtterance !== utterance) return
    utterance.playing = -1
    setCurrent(null)
    finishUtterance(utterance)
  })
  notifyUtterances()
}

function onClipEnded(): void {
  const utterance = activeUtterance
  if (!utterance || utterance.playing === -1) {
    // A manual clip ended; a queued reply may be waiting for the element.
    pump()
    return
  }
  utterance.playing = -1
  if (utterance.revealed >= utterance.speech.segments.length) {
    finishUtterance(utterance)
    return
  }
  armWait(utterance)
  advance(utterance)
  notifyUtterances()
}

function armWait(utterance: Utterance): void {
  clearWait(utterance)
  utterance.timer = setTimeout(() => {
    utterance.timer = null
    if (utterance.phase !== 'done' && utterance.playing === -1) finishUtterance(utterance)
  }, CLIP_WAIT_MS)
}

function clearWait(utterance: Utterance): void {
  if (utterance.timer) {
    clearTimeout(utterance.timer)
    utterance.timer = null
  }
}

function finishUtterance(utterance: Utterance, promote = true): void {
  clearWait(utterance)
  utterance.phase = 'done'
  utterance.revealed = utterance.speech.segments.length
  utterance.playing = -1
  if (utterance.replay) utterances.delete(utterance.id)
  else heardSpeech.add(utterance.id)
  if (activeUtterance === utterance) {
    activeUtterance = null
    if (promote) pump()
  }
  notifyUtterances()
}

/** Stop the speaking reply (and optionally every queued one), showing its text. */
function interruptUtterances(includeQueued = false): void {
  if (activeUtterance) finishUtterance(activeUtterance, false)
  if (!includeQueued) return
  for (const id of utteranceQueue.splice(0)) {
    const queued = utterances.get(id)
    if (queued && queued.phase !== 'done') finishUtterance(queued, false)
  }
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
  /** Play a single clip now, regardless of how many times it has played before. */
  play: (url: string) => void
  /** Play a single clip only if unmuted and it has never auto-played. */
  autoPlay: (url: string | undefined) => void
  /** Download a clip ahead of time so play() can start it without awaiting. */
  prefetch: (url: string | undefined) => void
  /**
   * Mark clips as already heard so they never auto-play. Used to seed the
   * backlog when a view opens on an existing conversation.
   */
  markHeard: (urls: Array<string | undefined>) => void
  /**
   * Speak a per-sentence reply as its clips arrive. Safe to call on every poll
   * with the latest snapshot: each reply is spoken once, in arrival order.
   */
  speak: (speech: LearnerSpeechDTO) => void
  /** Play a per-sentence reply again from its first sentence. */
  replay: (speech: LearnerSpeechDTO) => void
  stop: () => void
}

export function useLearnerVoice(): LearnerVoice {
  const [muted, setMuted] = useState(mutedFlag)
  const [playingUrl, setPlayingUrl] = useState<string | null>(currentUrl)

  useEffect(() => {
    listeners.add(setPlayingUrl)
    mutedListeners.add(setMuted)
    return () => {
      listeners.delete(setPlayingUrl)
      mutedListeners.delete(setMuted)
    }
  }, [])

  const stop = useCallback(() => {
    audioElement().pause()
    setCurrent(null)
    // A reply cut short is shown in full; its words must not stay hidden behind
    // audio the user chose to stop.
    interruptUtterances()
  }, [])

  const play = useCallback((url: string) => {
    // A manual play takes the element from whichever reply was speaking.
    interruptUtterances()
    playClip(url)
  }, [])

  const autoPlay = useCallback((url: string | undefined) => {
    if (!url || mutedFlag || autoPlayed.has(url)) return
    // Claimed before the await, so two polls landing together cannot both
    // start the same clip.
    autoPlayed.add(url)

    // Unlike a replay press, this fires from polling — there is no user
    // gesture to forfeit by awaiting. So fetch first: the very first play is
    // then same-origin, which is what lets the analyser read the waveform and
    // move the avatar. A manual press still plays synchronously.
    void prefetchClip(url).then(() => playClip(url))
  }, [])

  const markHeard = useCallback((urls: Array<string | undefined>) => markHeardUrls(urls), [])

  const toggleMuted = useCallback(() => setMutedFlag(!mutedFlag), [])

  const prefetch = useCallback((url: string | undefined) => {
    void prefetchClip(url)
  }, [])

  const speak = useCallback((speech: LearnerSpeechDTO) => speakUtterance(speech), [])
  const replay = useCallback((speech: LearnerSpeechDTO) => replayUtterance(speech), [])

  return { muted, toggleMuted, playingUrl, play, autoPlay, prefetch, markHeard, speak, replay, stop }
}
