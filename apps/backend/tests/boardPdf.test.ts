/**
 * The PDF a board is drawn on, kept apart from the reference PDF (§1.4).
 *
 * Two uploads, two purposes. The reference is the Evaluator's answer key and is
 * read by nothing else; the board PDF is teaching material, and the page the
 * user is explaining goes into the checkpoint like any other board. This suite
 * pins that they do not leak into each other — attaching pages to draw on must
 * never quietly hand the Evaluator an answer key, and must never take one away.
 */

import { describe, expect, it } from "vitest";

import * as service from "../src/modules/workspace/workspaceService.js";
import { workspaces } from "../src/modules/workspace/workspaceStore.js";

/** Minimal PDF bytes: nothing here parses them, they only have to round-trip. */
const BOARD_PDF = Buffer.from("%PDF-1.4 board pages", "utf8");
const REFERENCE_PDF = Buffer.from("%PDF-1.4 reference material", "utf8");

describe("board PDF", () => {
  it("stores the pages and serves them back under their own URL", async () => {
    const ws = await service.createWorkspace();

    const updated = await service.setBoardPdf(ws.id, BOARD_PDF, "application/pdf");

    expect(updated?.boardPdfUrl).toBe(`/api/workspaces/${ws.id}/board-pdf`);
    const stored = await workspaces.getBoardPdf(ws.id);
    expect(stored?.data.equals(BOARD_PDF)).toBe(true);
    expect(stored?.mime).toBe("application/pdf");
  });

  it("does not become reference material — the Evaluator is handed nothing", async () => {
    const ws = await service.createWorkspace();

    await service.setBoardPdf(ws.id, BOARD_PDF, "application/pdf");

    // No answer key, no provenance, and no reference URL: a board to write on
    // says nothing about what the explanation should have contained.
    expect(await workspaces.getReference(ws.id)).toBeUndefined();
    expect(await workspaces.getReferenceSource(ws.id)).toBeUndefined();
    const after = await service.getWorkspace(ws.id);
    expect(after?.pdfUrl).toBeUndefined();
    expect(after?.boardPdfUrl).toBe(`/api/workspaces/${ws.id}/board-pdf`);
  });

  it("leaves an existing reference alone, and is left alone by one", async () => {
    const ws = await service.createWorkspace();

    await service.setReferenceText(ws.id, "the material this session is graded against");
    await service.setBoardPdf(ws.id, BOARD_PDF, "application/pdf");

    // The board arriving does not disturb the key...
    expect(await workspaces.getReference(ws.id)).toContain("graded against");

    // ...and a later reference upload does not disturb the board's pages.
    await service.setPdf(ws.id, REFERENCE_PDF, "application/pdf");
    const board = await workspaces.getBoardPdf(ws.id);
    expect(board?.data.equals(BOARD_PDF)).toBe(true);

    const after = await service.getWorkspace(ws.id);
    expect(after?.pdfUrl).toBe(`/api/workspaces/${ws.id}/pdf`);
    expect(after?.boardPdfUrl).toBe(`/api/workspaces/${ws.id}/board-pdf`);
  });

  it("replaces the pages when a second file is attached", async () => {
    const ws = await service.createWorkspace();
    const next = Buffer.from("%PDF-1.4 other slides", "utf8");

    await service.setBoardPdf(ws.id, BOARD_PDF, "application/pdf");
    await service.setBoardPdf(ws.id, next, "application/pdf");

    const stored = await workspaces.getBoardPdf(ws.id);
    expect(stored?.data.equals(next)).toBe(true);
  });

  it("answers for a workspace that has none", async () => {
    const ws = await service.createWorkspace();

    expect(await workspaces.getBoardPdf(ws.id)).toBeUndefined();
    expect((await service.getWorkspace(ws.id))?.boardPdfUrl).toBeUndefined();
    expect(await service.setBoardPdf("ws_missing", BOARD_PDF, "application/pdf")).toBeUndefined();
  });
});
