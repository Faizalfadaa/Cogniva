/**
 * Audio-visual timeline, Phase 1 (capture + store only).
 *
 * Two things are locked here: the contract parses what the frontend will send
 * and rejects what it shouldn't, and submitCheckpoint persists it verbatim
 * without becoming required for clients that don't send it.
 */

import { describe, expect, it } from "vitest";

import { boardEventSchema, timelineSchema } from "../src/contracts/timeline.js";
import { submitCheckpointSchema } from "../src/contracts/workspace.js";
import { utcNowIso } from "../src/contracts/common.js";
import * as service from "../src/modules/workspace/workspaceService.js";

describe("boardEventSchema", () => {
  it("accepts a well-formed board event", () => {
    const parsed = boardEventSchema.parse({
      at: 1250,
      shapeIds: ["shape:abc", "shape:def"],
      kind: "add",
    });

    expect(parsed).toEqual({ at: 1250, shapeIds: ["shape:abc", "shape:def"], kind: "add" });
  });

  it("accepts a negative offset — drawing can precede the mic starting", () => {
    expect(boardEventSchema.parse({ at: -400, shapeIds: [], kind: "update" }).at).toBe(-400);
  });

  it("rejects a fractional offset", () => {
    expect(boardEventSchema.safeParse({ at: 12.5, shapeIds: [], kind: "add" }).success).toBe(
      false,
    );
  });

  it("rejects an unknown kind", () => {
    expect(boardEventSchema.safeParse({ at: 0, shapeIds: [], kind: "move" }).success).toBe(
      false,
    );
  });

  it("rejects shapeIds that are not strings", () => {
    expect(boardEventSchema.safeParse({ at: 0, shapeIds: [42], kind: "add" }).success).toBe(
      false,
    );
  });
});

describe("timelineSchema", () => {
  it("defaults events to an empty array", () => {
    const parsed = timelineSchema.parse({ recordingStartedAt: utcNowIso() });
    expect(parsed.events).toEqual([]);
  });

  it("rejects a recordingStartedAt that is not an ISO instant", () => {
    expect(timelineSchema.safeParse({ recordingStartedAt: "5 minutes ago" }).success).toBe(
      false,
    );
  });

  it("rejects a timeline with no recordingStartedAt at all", () => {
    expect(timelineSchema.safeParse({ events: [] }).success).toBe(false);
  });

  it("rejects a timeline carrying a malformed event", () => {
    const result = timelineSchema.safeParse({
      recordingStartedAt: utcNowIso(),
      events: [{ at: 0, shapeIds: [], kind: "add" }, { at: 0, kind: "add" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("submitCheckpointSchema", () => {
  const base = { snapshotImage: "aGVsbG8=", whiteboardSnapshot: {} };

  it("still accepts a checkpoint with no timeline (older clients)", () => {
    const parsed = submitCheckpointSchema.parse(base);
    expect(parsed.timeline).toBeUndefined();
  });

  it("accepts a checkpoint carrying a timeline", () => {
    const recordingStartedAt = utcNowIso();
    const parsed = submitCheckpointSchema.parse({
      ...base,
      timeline: {
        recordingStartedAt,
        events: [{ at: 900, shapeIds: ["shape:a"], kind: "add" }],
      },
    });

    expect(parsed.timeline?.recordingStartedAt).toBe(recordingStartedAt);
    expect(parsed.timeline?.events).toHaveLength(1);
  });

  it("rejects a checkpoint whose timeline is malformed", () => {
    const result = submitCheckpointSchema.safeParse({
      ...base,
      timeline: { recordingStartedAt: "not-a-date", events: [] },
    });
    expect(result.success).toBe(false);
  });
});

describe("submitCheckpoint storage", () => {
  /** A 1x1 PNG is enough — the teaching turn runs in the background on mocks. */
  const snapshotImage = "iVBORw0KGgo=";

  it("stores the timeline on the checkpoint verbatim", async () => {
    const ws = await service.createWorkspace();
    const timeline = {
      recordingStartedAt: utcNowIso(),
      events: [
        { at: 0, shapeIds: ["shape:a"], kind: "add" as const },
        { at: 2400, shapeIds: ["shape:a"], kind: "update" as const },
      ],
    };

    const checkpoint = await service.submitCheckpoint(ws.id, {
      snapshotImage,
      snapshotMime: "image/png",
      whiteboardSnapshot: {},
      timeline,
    });

    expect(checkpoint?.timeline).toEqual(timeline);
    // And it survives a round trip through the store, not just the return value.
    const stored = (await service.getCheckpoints(ws.id))?.[0];
    expect(stored?.timeline).toEqual(timeline);
  });

  it("stores a checkpoint with no timeline unchanged", async () => {
    const ws = await service.createWorkspace();

    const checkpoint = await service.submitCheckpoint(ws.id, {
      snapshotImage,
      snapshotMime: "image/png",
      whiteboardSnapshot: {},
    });

    expect(checkpoint).toBeDefined();
    expect(checkpoint?.timeline).toBeUndefined();
    // The rest of the checkpoint is unaffected by the new field.
    expect(checkpoint?.snapshotImageUrl).toContain("image/png");
  });
});
