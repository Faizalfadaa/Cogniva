/**
 * Telling "the user explained something out loud" apart from room noise.
 *
 * The mic starts on its own when the workspace opens, so by the time Teach is
 * pressed there is nearly always a recording, and most of the time it holds
 * nothing but the room. What separates speech from the rest is not loudness
 * alone: a keystroke or a bumped desk is as loud as a word, for one frame. It is
 * that speech keeps going. A syllable runs for a couple of hundred milliseconds
 * and an explanation runs for seconds.
 *
 * So a frame only counts once it is part of an unbroken run of loud frames, and
 * the recording only counts as speech once enough of those have piled up.
 *
 * This cannot tell the user from someone else talking in the same room. It does
 * not need to: a turn that goes out on someone else's voice gets a transcript
 * of it, or an empty one, and the student answers what it was actually given.
 */

/**
 * RMS level, on samples in -1..1, above which a frame counts as sound rather
 * than room noise. Browsers apply noise suppression to getUserMedia by default,
 * so a quiet room sits well under 0.005 and ordinary speech well over 0.02;
 * this sits low in that gap so a soft voice is not mistaken for silence.
 */
export const VOICE_RMS_THRESHOLD = 0.015

/** How often the level is sampled. */
export const LEVEL_SAMPLE_MS = 100

/** Unbroken loud frames before any of them count: 300ms, longer than a click. */
export const MIN_RUN_FRAMES = 3

/** Counted frames before the recording is treated as speech: one second. */
export const MIN_VOICE_FRAMES = 10

export interface VoiceCount {
  /** Loud frames in a row, up to and including the latest. */
  run: number
  /** Frames that belonged to a run long enough to count. */
  voiced: number
}

export const NO_VOICE: VoiceCount = { run: 0, voiced: 0 }

/** Root-mean-square level of one block of samples. */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

/**
 * Fold one frame's level into the count.
 *
 * A run is credited all at once when it reaches MIN_RUN_FRAMES, and one frame
 * at a time after that, so its opening frames count too once it has proved it
 * is not a click.
 */
export function addFrame(count: VoiceCount, level: number): VoiceCount {
  if (level <= VOICE_RMS_THRESHOLD) return { run: 0, voiced: count.voiced }
  const run = count.run + 1
  if (run < MIN_RUN_FRAMES) return { run, voiced: count.voiced }
  return { run, voiced: count.voiced + (run === MIN_RUN_FRAMES ? MIN_RUN_FRAMES : 1) }
}

/** Enough sustained sound to be someone explaining something. */
export function isSpeech(count: VoiceCount): boolean {
  return count.voiced >= MIN_VOICE_FRAMES
}

/**
 * Where a wall-clock moment falls inside the recorded clip, in milliseconds.
 *
 * The clip is the recorded stretches joined end to end, with the pauses cut
 * out. So a moment inside a stretch lands at the time recorded before it plus
 * how far into this stretch it is; a moment in a pause, or outside the
 * recording, has no place in the clip and gets null.
 */
export function toAudioTime(at: number, spans: readonly { start: number; end: number }[]): number | null {
  let offset = 0
  for (const span of spans) {
    if (at < span.start) return null
    if (at <= span.end) return Math.round(offset + at - span.start)
    offset += span.end - span.start
  }
  return null
}
