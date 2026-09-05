/**
 * The storage contract (Architecture Document §8).
 *
 * Two stores hold everything the app remembers: `SessionStore` for what the
 * agents produce (turns, snapshots, transcripts, the Learner's mental model,
 * evaluations) and `WorkspaceStore` for what the UI reads back (workspaces,
 * checkpoints, chat, the debrief report, the uploaded PDF).
 *
 * Both are asynchronous because the real implementation is Postgres
 * (src/database/stores). The in-memory implementations in this folder exist
 * only as test doubles, so the suite runs without a database.
 */

import type { BoardSnapshot } from "../../contracts/board.js";
import type { EvaluationResult } from "../../contracts/evaluation.js";
import type { LearnerResponse, LearnerState } from "../../contracts/learner.js";
import type { Session } from "../../contracts/session.js";
import type { SpeechTranscript } from "../../contracts/speech.js";
import type { TeachingTurn } from "../../contracts/teaching.js";
import type {
  ChatMessage,
  EvaluationReport,
  TeachingCheckpoint,
  Workspace,
} from "../../contracts/workspace.js";
import type { ReferenceIndex } from "../retrieval/index.js";

/** A stored binary blob (the uploaded PDF) served back through a GET endpoint. */
export interface StoredBlob {
  data: Buffer;
  mime: string;
}

/** One turn paired with the Learner utterance it produced — the transcript row
 * both the session REST layer and the workspace service project for the
 * Evaluator. Fetched together so a transcript costs two queries, not 2N. */
export interface TurnWithResponse {
  turn: TeachingTurn;
  response?: LearnerResponse;
}

export interface SessionStore {
  // --- Session ----------------------------------------------------------
  saveSession(session: Session): Promise<Session>;
  getSession(sessionId: string): Promise<Session | undefined>;
  /**
   * Add one turn's token spend to the session's running total. A missing
   * session is a no-op on purpose: usage accounting must never be the thing
   * that breaks a turn (§7.3).
   */
  addTokenUsage(sessionId: string, tokens: number): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  // --- Evaluations (history: one per ended round, oldest first) ----------
  saveEvaluation(result: EvaluationResult): Promise<EvaluationResult>;
  getEvaluationById(evaluationId: string): Promise<EvaluationResult | undefined>;
  listEvaluations(sessionId: string): Promise<EvaluationResult[]>;
  getLatestEvaluation(sessionId: string): Promise<EvaluationResult | undefined>;

  // --- Board snapshots --------------------------------------------------
  saveSnapshot(snapshot: BoardSnapshot): Promise<BoardSnapshot>;
  getSnapshot(snapshotId: string): Promise<BoardSnapshot | undefined>;

  // --- Speech transcripts -----------------------------------------------
  saveTranscript(transcript: SpeechTranscript): Promise<SpeechTranscript>;

  // --- Learner responses & state ----------------------------------------
  /** The response carries no session of its own, so the caller names it. */
  saveResponse(sessionId: string, response: LearnerResponse): Promise<LearnerResponse>;
  getResponse(responseId: string): Promise<LearnerResponse | undefined>;
  saveLearnerState(state: LearnerState): Promise<LearnerState>;
  getLearnerState(sessionId: string): Promise<LearnerState | undefined>;

  // --- Teaching turns (the transcript) ----------------------------------
  saveTurn(turn: TeachingTurn): Promise<TeachingTurn>;
  listTurns(sessionId: string): Promise<TeachingTurn[]>;
  /** The most recent turn, without loading the whole transcript. */
  lastTurn(sessionId: string): Promise<TeachingTurn | undefined>;
  /** The transcript with each turn's Learner utterance already joined on. */
  listTurnsWithResponses(sessionId: string): Promise<TurnWithResponse[]>;
}

export interface WorkspaceStore {
  // --- Workspaces -------------------------------------------------------
  /**
   * Create a workspace owned by `ownerId` and backed by `sessionId`. The owner
   * and the session link are set once, here, because both are foreign keys —
   * unlike `save`, which only updates the mutable metadata.
   */
  create(workspace: Workspace, ownerId: string, sessionId: string): Promise<Workspace>;
  save(workspace: Workspace): Promise<Workspace>;
  get(id: string): Promise<Workspace | undefined>;
  /** True when `ownerId` owns an existing workspace `id`. */
  isOwner(id: string, ownerId: string): Promise<boolean>;
  /** This owner's workspaces, most-recently-updated first (Home grid order). */
  list(ownerId: string): Promise<Workspace[]>;
  delete(id: string): Promise<void>;
  /** The session backing this workspace. */
  sessionId(workspaceId: string): Promise<string | undefined>;

  // --- Checkpoints ------------------------------------------------------
  addCheckpoint(
    workspaceId: string,
    checkpoint: TeachingCheckpoint,
  ): Promise<TeachingCheckpoint>;
  listCheckpoints(workspaceId: string): Promise<TeachingCheckpoint[]>;
  updateCheckpoint(
    workspaceId: string,
    checkpointId: string,
    patch: Partial<TeachingCheckpoint>,
  ): Promise<void>;

  // --- Chat messages ----------------------------------------------------
  addMessage(workspaceId: string, message: ChatMessage): Promise<ChatMessage>;
  listMessages(workspaceId: string): Promise<ChatMessage[]>;

  // --- Evaluation report ------------------------------------------------
  saveReport(workspaceId: string, report: EvaluationReport): Promise<EvaluationReport>;
  getReport(workspaceId: string): Promise<EvaluationReport | undefined>;

  // --- PDF blob ---------------------------------------------------------
  savePdf(workspaceId: string, blob: StoredBlob): Promise<void>;
  getPdf(workspaceId: string): Promise<StoredBlob | undefined>;

  // --- Reference material (text extracted from the uploaded PDF) ---------
  // Read only by the Evaluator as the answer key (§1.4); never by the Learner.
  saveReference(workspaceId: string, text: string): Promise<void>;
  getReference(workspaceId: string): Promise<string | undefined>;

  // --- Reference index (chunked/embedded reference, §3.7 retrieval) -------
  saveReferenceIndex(workspaceId: string, index: ReferenceIndex): Promise<void>;
  getReferenceIndex(workspaceId: string): Promise<ReferenceIndex | undefined>;
}
