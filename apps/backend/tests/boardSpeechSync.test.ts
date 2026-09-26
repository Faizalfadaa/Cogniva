/**
 * The board and the voice, lined up.
 *
 * A teacher says "this goes in here" while drawing the arrow, and neither the
 * board reading nor the transcript alone says what "this" and "here" were.
 * These cover the two halves that let the student see them together: ASR times
 * its sentences on the clip, and each board change is matched with the sentence
 * being spoken as it was made.
 */

import { describe, expect, it } from "vitest";

import { normalizeAsrLLMOutput, normalizeSegments, toSpeechTranscript } from "../src/agents/asr/asr.guard.js";
import { composeTeachingText } from "../src/agents/learner/index.js";
import { MAX_LINES, NEAR_MS, narrate } from "../src/agents/learner/narration.js";
import type { SpeechSegment, SpeechTranscript } from "../src/contracts/speech.js";
import type { BoardEvent } from "../src/contracts/timeline.js";

describe("ASR segments", () => {
  it("keeps sensible times in order and drops the rest rather than guessing", () => {
    expect(
      normalizeSegments([
        { start: 4, end: 6, text: "second" },
        { start: 0, end: 3.5, text: "first" },
        { start: 7, end: 5, text: "ends before it starts" },
        { start: -1, end: 2, text: "negative" },
        { start: 8, end: 9, text: "   " },
        { start: "9", end: 10, text: "not a number" },
        "not an object",
      ]),
    ).toEqual([
      { start: 0, end: 3.5, text: "first" },
      { start: 4, end: 6, text: "second" },
    ]);
  });

  it("carries them into the transcript in milliseconds", () => {
    const output = normalizeAsrLLMOutput({
      transcript: "Water is split. Oxygen is released.",
      confidence: 0.95,
      language: "en-US",
      ambiguities: [],
      segments: [
        { start: 0, end: 1.2, text: "Water is split." },
        { start: 1.25, end: 2.6, text: "Oxygen is released." },
      ],
    });
    const transcript = toSpeechTranscript(output, {
      segmentId: "seg",
      sessionId: "s",
      turnIndex: 0,
      topic: "photosynthesis",
      audioBase64: "x",
      mimeType: "audio/webm",
      capturedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(transcript.segments).toEqual([
      { startMs: 0, endMs: 1200, text: "Water is split." },
      { startMs: 1250, endMs: 2600, text: "Oxygen is released." },
    ]);
  });

  it("leaves segments out when the model gave none", () => {
    const output = normalizeAsrLLMOutput({ transcript: "hi", confidence: 1, language: "en", ambiguities: [] });
    expect(output.segments).toEqual([]);
  });
});

describe("what was drawn while what was said", () => {
  const segments: SpeechSegment[] = [
    { startMs: 0, endMs: 3000, text: "the light reactions make ATP" },
    { startMs: 5000, endMs: 8000, text: "then the carbon gets fixed here" },
  ];
  const add = (audioAt: number | null, extra: Partial<BoardEvent> = {}): BoardEvent => ({
    at: audioAt ?? 0,
    audioAt,
    shapeIds: ["x"],
    kind: "add",
    ...extra,
  });

  it("pairs each drawing with the sentence spoken as it was made", () => {
    expect(
      narrate(
        [
          add(1000, { shape: "text", text: "ATP" }),
          add(6000, { shape: "arrow" }),
          add(6500, { shape: "text", text: "G3P" }),
        ],
        segments,
      ),
    ).toEqual([
      'While saying "the light reactions make ATP": wrote "ATP"',
      'While saying "then the carbon gets fixed here": drew an arrow; wrote "G3P"',
    ]);
  });

  it("lets a stroke made just after the words still belong to them", () => {
    // 400ms after the first sentence ends, 1600ms before the second begins.
    expect(narrate([add(3400, { shape: "arrow" })], segments)).toEqual([
      'While saying "the light reactions make ATP": drew an arrow',
    ]);
  });

  it("gives a stroke in the gap to whichever sentence is nearer", () => {
    expect(narrate([add(4600, { shape: "arrow" })], segments)).toEqual([
      'While saying "then the carbon gets fixed here": drew an arrow',
    ]);
  });

  it("leaves out what has no sentence: the pause between them, the mic off, edits", () => {
    // Exactly between the two sentences, farther than NEAR_MS from both.
    const pause = add(4000, { shape: "arrow" });
    const micOff = add(null, { shape: "arrow" });
    const edit: BoardEvent = { ...add(1000, { shape: "text", text: "ATP" }), kind: "update" };
    const emptyText = add(1000, { shape: "text" });
    const farPause = narrate([pause], [
      { startMs: 0, endMs: 1000, text: "a" },
      { startMs: 1000 + 4 * NEAR_MS, endMs: 9000, text: "b" },
    ]);

    expect(farPause.length).toBe(0);
    expect(narrate([micOff, edit, emptyText], segments)).toEqual([]);
  });

  it("says nothing when either side is missing", () => {
    expect(narrate([add(1000, { shape: "arrow" })], undefined)).toEqual([]);
    expect(narrate(undefined, segments)).toEqual([]);
  });

  it(`stops at ${MAX_LINES} lines`, () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ startMs: i * 1000, endMs: i * 1000 + 900, text: `s${i}` }));
    const events = many.map((s) => add(s.startMs + 100, { shape: "arrow" }));
    expect(narrate(events, many)).toHaveLength(MAX_LINES);
  });

  it("reaches the student alongside the board and the speech", () => {
    const speech = { transcript: "then the carbon gets fixed here", segments } as unknown as SpeechTranscript;
    const text = composeTeachingText(
      { snapshotId: "s", transcribedText: "Light reactions\nCalvin cycle", elements: [], confidence: 1, needsConfirmation: false, newText: "Calvin cycle" },
      speech,
      { recordingStartedAt: "2026-01-01T00:00:00.000Z", events: [add(6000, { shape: "arrow" })] },
    );

    expect(text).toContain(
      'How the drawing and the talking lined up:\n- While saying "then the carbon gets fixed here": drew an arrow',
    );
  });
});

describe("narration text", () => {
  it("keeps wrapped text on one line", () => {
    const [line] = narrate(
      [{ at: 100, audioAt: 100, shapeIds: ["t"], kind: "add", shape: "text", text: "uses the ATP\nand NADPH" }],
      [{ startMs: 0, endMs: 500, text: "so" }],
    );
    expect(line).toBe('While saying "so": wrote "uses the ATP and NADPH"');
  });
});
