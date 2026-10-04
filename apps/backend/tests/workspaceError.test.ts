/**
 * Handled turn outcomes surface as `errorKind` on the checkpoint (§7.3).
 *
 * The point of the field: a budget stop is not something the student said, so
 * the UI must be able to tell it apart from a real reply. `learnerResponse`
 * still carries readable text for clients that ignore `errorKind`.
 */

import { beforeEach, describe, expect, it } from "vitest";

import * as config from "../src/config/index.js";
import * as service from "../src/modules/workspace/workspaceService.js";
import { sessions } from "../src/modules/storage/sessionStore.js";
import { workspaces } from "../src/modules/workspace/workspaceStore.js";

/** A 1x1 PNG is enough — the turn runs on mocks. */
const SNAPSHOT = "iVBORw0KGgo=";

/** The reply lands from a fire-and-forget background job, so poll for it. */
async function waitForReply(workspaceId: string, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await service.getCheckpoints(workspaceId);
    const done = list?.find((c) => c.learnerResponse);
    if (done) return done;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("background teaching turn never produced a reply");
}

async function submit(workspaceId: string) {
  return service.submitCheckpoint(workspaceId, {
    snapshotImage: SNAPSHOT,
    snapshotMime: "image/png",
    whiteboardSnapshot: {},
  });
}

describe("checkpoint errorKind", () => {
  beforeEach(() => {
    process.env.COGNIVA_DEMO_MODE = "false";
  });

  it("tags a checkpoint stopped by the token budget", async () => {
    const ws = await service.createWorkspace();
    await submit(ws.id); // moves Draft -> Teaching so a session exists

    // Spend the whole budget, then submit again: the next turn is refused.
    const sessionId = (await workspaces.sessionId(ws.id))!;
    await sessions.addTokenUsage(sessionId, config.SESSION_TOKEN_BUDGET);
    await waitForReply(ws.id);

    const second = await submit(ws.id);
    expect(second).toBeDefined();

    const deadline = Date.now() + 2000;
    let tagged;
    while (Date.now() < deadline && !tagged) {
      const list = await service.getCheckpoints(ws.id);
      tagged = list?.find((c) => c.id === second!.id && c.learnerResponse);
      if (!tagged) await new Promise((r) => setTimeout(r, 10));
    }

    expect(tagged?.errorKind).toBe("budget_exceeded");
    // Old clients that never read errorKind still get readable text.
    expect(tagged?.learnerResponse).toBeTruthy();
  });

  it("leaves errorKind unset on an ordinary reply", async () => {
    const ws = await service.createWorkspace();
    await submit(ws.id);

    const done = await waitForReply(ws.id);

    expect(done.errorKind).toBeUndefined();
    expect(done.learnerResponse).toBeTruthy();
  });
});
