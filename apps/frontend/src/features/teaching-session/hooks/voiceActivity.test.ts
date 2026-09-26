import { describe, expect, it } from 'vitest'

import { addFrame, isSpeech, NO_VOICE, rms, toAudioTime, VOICE_RMS_THRESHOLD, type VoiceCount } from './voiceActivity'

const LOUD = VOICE_RMS_THRESHOLD * 4
const QUIET = VOICE_RMS_THRESHOLD / 4

/** Run a sequence of levels through the counter from nothing. */
function feed(levels: number[]): VoiceCount {
  return levels.reduce(addFrame, NO_VOICE)
}

describe('rms', () => {
  it('is zero for silence and for an empty block', () => {
    expect(rms(new Float32Array(8))).toBe(0)
    expect(rms(new Float32Array(0))).toBe(0)
  })

  it('is the amplitude of a constant signal', () => {
    expect(rms(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5)
  })
})

describe('voice activity', () => {
  it('ignores a quiet room however long it goes on', () => {
    expect(isSpeech(feed(Array(600).fill(QUIET)))).toBe(false)
  })

  it('ignores clicks: loud single frames never add up, however many there are', () => {
    // A minute of typing: one loud frame, then quiet, over and over.
    const typing = Array.from({ length: 600 }, (_, i) => (i % 2 === 0 ? LOUD : QUIET))
    expect(isSpeech(feed(typing))).toBe(false)
  })

  it('ignores a short burst that is sustained but too brief to be an explanation', () => {
    expect(isSpeech(feed([LOUD, LOUD, LOUD, LOUD, QUIET]))).toBe(false)
  })

  it('hears one second of continuous sound', () => {
    expect(isSpeech(feed(Array(10).fill(LOUD)))).toBe(true)
  })

  it('hears speech broken up by the pauses between words', () => {
    // Words of about 400ms with 200ms gaps: every run qualifies on its own.
    const word = [LOUD, LOUD, LOUD, LOUD, QUIET, QUIET]
    expect(isSpeech(feed([...word, ...word, ...word]))).toBe(true)
  })

  it('counts the opening frames of a run once it proves itself', () => {
    expect(feed([LOUD, LOUD]).voiced).toBe(0)
    expect(feed([LOUD, LOUD, LOUD]).voiced).toBe(3)
    expect(feed([LOUD, LOUD, LOUD, LOUD]).voiced).toBe(4)
  })
})

describe('toAudioTime', () => {
  // Recorded 0-10s, mic off 10-20s, recorded again 20-30s (wall clock, ms).
  const spans = [
    { start: 0, end: 10_000 },
    { start: 20_000, end: 30_000 },
  ]

  it('matches the wall clock until the first pause', () => {
    expect(toAudioTime(4_000, spans)).toBe(4_000)
  })

  it('skips the paused stretch, which the clip does not contain', () => {
    // 25s on the wall is 15s into the clip: 10s before the pause, 5s after.
    expect(toAudioTime(25_000, spans)).toBe(15_000)
  })

  it('has no place in the clip for a moment the mic was off', () => {
    expect(toAudioTime(15_000, spans)).toBeNull()
    expect(toAudioTime(-1, spans)).toBeNull()
    expect(toAudioTime(31_000, spans)).toBeNull()
  })
})
