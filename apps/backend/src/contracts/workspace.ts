/**
 * Workspace contracts — the data the frontend bridge speaks (CognivaBridge.ts).
 *
 * The UI is workspace-centric: the user opens a blank workspace, teaches on a
 * whiteboard, chats with the Learner, then finishes to get an evaluation report.
 * These shapes mirror the frontend DTOs 1:1 (camelCase on the wire, §6) so the
 * RealCognivaBridge is a thin fetch wrapper with no field remapping.
 *
 * A workspace is backed by a regular Session (§6.2) under the hood so the
 * existing orchestrator (§3.3) and Evaluator (§3.7) drive it unchanged — the
 * workspace adds the metadata (title, whiteboard draft, thumbnail) and the
 * cyclic Draft/Teaching/Evaluating/Completed view the UI needs.
 */

import { z } from "zod";

/**
 * Workspace lifecycle as the UI sees it. Maps onto the session state machine
 * (§4): Draft≈SETUP, Teaching≈TEACHING, Evaluating≈ENDED (evaluation running),
 * Completed≈EVALUATED (report ready).
 */
export const workspaceStateSchema = z.enum([
  "Draft",
  "Teaching",
  "Evaluating",
  "Completed",
]);
export type WorkspaceState = z.infer<typeof workspaceStateSchema>;

/** One workspace card / session as the frontend renders it (WorkspaceDTO). */
export interface Workspace {
  id: string;
  title?: string;
  description?: string;
  /** Endpoint URL for an uploaded reference PDF, if any. */
  pdfUrl?: string;
  state: WorkspaceState;
  /** Latest autosaved tldraw document, so the canvas restores on reopen. */
  currentWhiteboardSnapshot?: unknown;
  /** Small raster preview (data URL) shown on the Home grid. */
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** One teaching checkpoint — produced each time the user presses "Teach". */
export interface TeachingCheckpoint {
  id: string;
  /** The board snapshot sent to Vision, echoed back as a data URL. */
  snapshotImageUrl: string;
  /** The tldraw document captured at this checkpoint. */
  whiteboardSnapshot: unknown;
  /** The spoken explanation recorded during editing, as a data URL. */
  audioUrl?: string;
  /** The Learner's reaction; absent while the turn is still processing. */
  learnerResponse?: string;
  createdAt: string;
}

export type ChatSender = "user" | "learner";

/** One chat bubble between the user and the Learner persona. */
export interface ChatMessage {
  id: string;
  sender: ChatSender;
  content: string;
  createdAt: string;
}

/** Debrief content rendered on the Evaluation screen (EvaluationReportDTO). */
export interface EvaluationReport {
  /** A warm letter from the Learner to the user. */
  letter: string;
  notebook: {
    learned: string[];
    stillConfused: string[];
    reflection: string;
  };
  /** Suggested next topics to keep learning. */
  continueLearning: string[];
}

// --- Request bodies (validated at the REST boundary) ----------------------

export const updateMetaSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

export const saveDraftSchema = z.object({
  /** Opaque tldraw document JSON. */
  snapshot: z.unknown(),
  /** Optional thumbnail as a data URL (already rasterized by the client). */
  thumbnail: z.string().optional(),
});

export const submitCheckpointSchema = z.object({
  /** Raw base64 (no data-URL prefix) PNG of the board. */
  snapshotImage: z.string(),
  snapshotMime: z.string().default("image/png"),
  whiteboardSnapshot: z.unknown(),
  /** Raw base64 audio clip of the spoken explanation, optional. */
  audio: z.string().optional(),
  audioMime: z.string().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1),
});

export const uploadPdfSchema = z.object({
  /** Raw base64 (no data-URL prefix) of the PDF. */
  data: z.string(),
  mime: z.string().default("application/pdf"),
});
