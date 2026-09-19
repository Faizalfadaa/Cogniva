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
import type { Finding } from "./evaluation.js";
import { timelineSchema, type Timeline } from "./timeline.js";

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
  /**
   * Where the reference material came from when it was not an upload — a web
   * source the Referencer found and the user chose. Absent for an uploaded PDF
   * (that one is `pdfUrl`) and when the session has no reference at all.
   */
  referenceSource?: ReferenceSource;
  state: WorkspaceState;
  /** Latest autosaved Excalidraw scene, so the canvas restores on reopen. */
  currentWhiteboardSnapshot?: unknown;
  /** Small raster preview (data URL) shown on the Home grid. */
  thumbnailUrl?: string;
  /**
   * The student the user picked for this workspace ("yuzuki" | "reina" |
   * "akira").
   *
   * On the wire because the backend has to speak in that character's voice
   * (§TTS), and it cannot see the browser's localStorage. Absent on workspaces
   * made before the picker existed; the id-derived default covers those.
   */
  learnerId?: string;
  /**
   * The language this session runs in, chosen when the workspace was created
   * and fixed from then on ("id" | "en").
   *
   * On the wire because it is a property of the session rather than of the
   * browser: the Home grid labels every card with it, and reopening a workspace
   * on another device has to show it in the language it was taught in.
   */
  locale: Locale;
  createdAt: string;
  updatedAt: string;
}

/**
 * The two languages the product ships in.
 *
 * Indonesian is first because that is the audience; English exists because the
 * learner's synthesized voice only speaks it (see services/tts/README.md).
 */
export const LOCALES = ["id", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** Narrow an unknown value to a Locale, falling back to Indonesian. */
export function asLocale(value: unknown): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : "id";
}

/** Provenance of web-sourced reference material (§1.4: Evaluator-side only). */
export interface ReferenceSource {
  url: string;
  title: string;
  /** Publisher/site, e.g. "Khan Academy". */
  source: string;
}

/** One teaching checkpoint — produced each time the user presses "Teach". */
export interface TeachingCheckpoint {
  id: string;
  /** The board snapshot sent to Vision, echoed back as a data URL. */
  snapshotImageUrl: string;
  /** The Excalidraw scene captured at this checkpoint. */
  whiteboardSnapshot: unknown;
  /** The spoken explanation recorded during editing, as a data URL. */
  audioUrl?: string;
  /** The Learner's reaction; absent while the turn is still processing. */
  learnerResponse?: string;
  /**
   * Spoken version of `learnerResponse` as a single clip, as an endpoint URL
   * (§TTS).
   *
   * Legacy: replies are now spoken per sentence through `speech`. This stays so
   * checkpoints recorded before that change still play. A URL rather than an
   * inline data URL because the UI polls this list every second — embedding
   * hundreds of kilobytes of audio per checkpoint in every poll would swamp it.
   */
  learnerAudioUrl?: string;
  /**
   * The reply as speech, one clip per sentence (§TTS). Written together with
   * `learnerResponse` whenever the voice is on, so the UI knows to hold the text
   * and reveal each sentence as it starts playing. Absent when speech is off.
   */
  speech?: LearnerSpeech;
  /**
   * Set when the turn ended in a handled condition rather than a real reply,
   * so the UI can show it as a state instead of as something the student said.
   * `learnerResponse` still carries readable text for clients that ignore this.
   * A union so more kinds can join without another field.
   */
  errorKind?: CheckpointErrorKind;
  /**
   * When each board change happened relative to the recording (Phase 1).
   * Stored only — like whiteboardSnapshot, nothing reads it yet. Absent on
   * checkpoints made before this field existed, and on clients that can't
   * capture it.
   */
  timeline?: Timeline;
  createdAt: string;
}

/** Handled, non-exceptional outcomes of a teaching turn (§7.3). */
export type CheckpointErrorKind = "budget_exceeded";

/**
 * A learner reply as speech, split into sentence-sized segments (§TTS).
 *
 * Rendering a whole reply before any of it could play left the voice trailing
 * the text by the full render time. Per sentence, the first one can start
 * playing while the rest are still rendering, and the UI can reveal each
 * sentence's text at the moment it is spoken.
 */
export interface LearnerSpeech {
  /**
   * Shared by a checkpoint and the chat message that mirrors it, so a client
   * rendering both still speaks the line only once.
   */
  id: string;
  /**
   * pending      at least one segment is still rendering
   * ready        every segment has audio
   * unavailable  synthesis stopped; segments that have audio can still play,
   *              and the rest should be shown as text rather than waited for
   */
  status: LearnerSpeechStatus;
  segments: SpeechSegment[];
}

export type LearnerSpeechStatus = "pending" | "ready" | "unavailable";

export interface SpeechSegment {
  text: string;
  /** Endpoint URL of this sentence's clip; absent until it has been rendered. */
  audioUrl?: string;
}

export type ChatSender = "user" | "learner";

/** One chat bubble between the user and the Learner persona. */
export interface ChatMessage {
  id: string;
  sender: ChatSender;
  content: string;
  /** Legacy single-clip voice for a learner bubble. See TeachingCheckpoint. */
  learnerAudioUrl?: string;
  /** The bubble as per-sentence speech; learner messages only. See LearnerSpeech. */
  speech?: LearnerSpeech;
  createdAt: string;
}

/**
 * Debrief content rendered on the Evaluation screen (EvaluationReportDTO).
 *
 * Two layers. The narrative one (letter, notebook, continueLearning) is what the
 * Learner says back to the user. Under it sits the Evaluator's own output, which
 * this report used to flatten away: the scores, the categorized findings, and
 * the turns those findings point at, so the screen can break a result down per
 * axis and highlight the sentence behind each judgement.
 */
export interface EvaluationReport {
  /**
   * Which finished round this debrief belongs to, counting from 1.
   *
   * A workspace keeps one report per round rather than one report, so a user
   * who resumed teaching can still read what the earlier round said.
   */
  round: number;
  /** When this round's debrief was written. */
  createdAt: string;
  /** A warm letter from the Learner to the user. */
  letter: string;
  notebook: {
    learned: string[];
    stillConfused: string[];
    reflection: string;
  };
  /** Suggested next topics to keep learning. */
  continueLearning: string[];
  /** Overall correctness and completeness, 0..100 (§6.9). */
  score: number;
  /** How deeply the mechanism was explained, scored apart from correctness. */
  depthScore: number;
  /** The Evaluator's per-concept findings, uncollapsed. */
  findings: Finding[];
  /**
   * The turns the findings cite, so a finding can be shown in context.
   *
   * Optional: the failure path builds a report without ever reading the
   * transcript, and an empty debrief is better than no debrief (§10).
   */
  transcript?: EvaluationTranscriptTurn[];
}

/** One transcript turn as the debrief screen needs it (§6.6, projected). */
export interface EvaluationTranscriptTurn {
  turnIndex: number;
  boardText: string;
  speech?: string;
}

/**
 * A debrief on its way into the store, before it has a place in the history.
 *
 * `round` and `createdAt` are the store's to assign: the builder that maps an
 * EvaluationResult into a report has no way to know how many rounds came
 * before it, and letting it guess is how two rounds end up claiming the same
 * number.
 */
export type NewEvaluationReport = Omit<EvaluationReport, "round" | "createdAt">;

/**
 * One round in a workspace's history, as the round picker lists them.
 *
 * Deliberately not the whole report: the picker needs enough to label a round
 * and show how it went, and a list of full debriefs would carry every
 * transcript and finding for rounds the user may never open.
 */
export interface EvaluationRoundSummary {
  round: number;
  score: number;
  depthScore: number;
  /** How many findings that round produced, for a one-glance sense of size. */
  findingCount: number;
  createdAt: string;
}

/**
 * One finished session's score, for the trend across sessions.
 *
 * Deliberately not part of EvaluationReport: a report describes one session, and
 * a session cannot know what came after it. This is read per owner at the moment
 * the debrief is opened, so a session's trend stays accurate as later ones land.
 */
export interface ScoreHistoryPoint {
  workspaceId: string;
  /** Which round of that workspace this score came from. */
  round: number;
  title: string | null;
  score: number;
  /** When the report was written, oldest first. */
  completedAt: string;
}

// --- Request bodies (validated at the REST boundary) ----------------------

export const updateMetaSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  /** Bounded, not enumerated: the guard in the TTS module decides what is a
   * usable voice, so an unknown id degrades to the default instead of 400ing a
   * request whose only fault is a newer client. */
  learnerId: z.string().max(40).optional(),
});

export const saveDraftSchema = z.object({
  /** Opaque Excalidraw scene JSON. */
  snapshot: z.unknown(),
  /** Optional thumbnail as a data URL (already rasterized by the client). */
  thumbnail: z.string().optional(),
});

/** Body of POST /workspaces. Empty is valid — the language then defaults. */
export const createWorkspaceSchema = z.object({
  locale: z.enum(LOCALES).optional(),
});

export const submitCheckpointSchema = z.object({
  /** Raw base64 (no data-URL prefix) PNG of the board. */
  snapshotImage: z.string(),
  snapshotMime: z.string().default("image/png"),
  whiteboardSnapshot: z.unknown(),
  /** Raw base64 audio clip of the spoken explanation, optional. */
  audio: z.string().optional(),
  audioMime: z.string().optional(),
  /** Board-change timeline for this checkpoint (Phase 1). Optional so older
   * clients keep posting valid checkpoints. */
  timeline: timelineSchema.optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1),
});

export const uploadPdfSchema = z.object({
  /** Raw base64 (no data-URL prefix) of the PDF. */
  data: z.string(),
  mime: z.string().default("application/pdf"),
});

/**
 * Reference material typed or pasted by the user — the third way in, beside an
 * uploaded PDF and a source the Referencer found. Bounded here rather than only
 * in the service so an oversized paste is rejected at the edge.
 */
export const saveReferenceTextSchema = z.object({
  text: z.string().min(1).max(400_000),
});

/**
 * Ask the Referencer for reading material. Everything about the topic comes from
 * the workspace itself; `hint` is the user's own steer ("for high school", "in
 * Indonesian"), which is why it is the only field.
 */
export const suggestReferencesSchema = z.object({
  hint: z.string().max(300).optional(),
});

/** Adopt one suggested source as this session's reference material. */
export const useReferenceSchema = z.object({
  url: z.string().url(),
  title: z.string().max(200).optional(),
  source: z.string().max(80).optional(),
});
