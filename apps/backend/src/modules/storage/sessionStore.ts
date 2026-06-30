/**
 * In-memory storage for the M1 skeleton (Architecture Document §8 placeholder).
 *
 * The persistent storage model (SQLite + object store) comes in a later
 * milestone. For M1 an in-memory store holds the session, its teaching turns
 * (the transcript), board snapshots, speech transcripts, learner responses, and
 * the per-session LearnerState — everything one full teaching turn produces and
 * the Evaluator (M3) will later read.
 */

import { randomUUID } from "node:crypto";

import type { BoardSnapshot } from "../../contracts/board.js";
import type { EvaluationResult } from "../../contracts/evaluation.js";
import type { LearnerResponse, LearnerState } from "../../contracts/learner.js";
import type { Session } from "../../contracts/session.js";
import type { SpeechTranscript } from "../../contracts/speech.js";
import type { TeachingTurn } from "../../contracts/teaching.js";

/** Generate a short prefixed id, e.g. "ses_1a2b3c4d". */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

/** In-memory store for sessions and everything a turn produces (§8 placeholder). */
export class SessionStore {
  private sessions = new Map<string, Session>();
  private evaluationsById = new Map<string, EvaluationResult>();
  private evaluationIdsBySession = new Map<string, string[]>();
  private snapshots = new Map<string, BoardSnapshot>();
  private transcripts = new Map<string, SpeechTranscript>();
  private responses = new Map<string, LearnerResponse>();
  private learnerStates = new Map<string, LearnerState>();
  private turns = new Map<string, TeachingTurn[]>();

  // --- Session ----------------------------------------------------------

  saveSession(session: Session): Session {
    this.sessions.set(session.sessionId, session);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    const evalIds = this.evaluationIdsBySession.get(sessionId) ?? [];
    for (const evalId of evalIds) this.evaluationsById.delete(evalId);
    this.evaluationIdsBySession.delete(sessionId);
    this.learnerStates.delete(sessionId);
    this.turns.delete(sessionId);
  }

  // --- Evaluation (history: one per ended round, oldest first) ----------

  saveEvaluation(result: EvaluationResult): EvaluationResult {
    this.evaluationsById.set(result.evaluationId, result);
    const ids = this.evaluationIdsBySession.get(result.sessionId) ?? [];
    ids.push(result.evaluationId);
    this.evaluationIdsBySession.set(result.sessionId, ids);
    return result;
  }

  getEvaluationById(evaluationId: string): EvaluationResult | undefined {
    return this.evaluationsById.get(evaluationId);
  }

  /** Full evaluation history for a session, oldest first. */
  listEvaluations(sessionId: string): EvaluationResult[] {
    const ids = this.evaluationIdsBySession.get(sessionId) ?? [];
    return ids
      .map((id) => this.evaluationsById.get(id))
      .filter((e): e is EvaluationResult => Boolean(e));
  }

  /** The most recent evaluation for a session (latest round), if any. */
  getLatestEvaluation(sessionId: string): EvaluationResult | undefined {
    const ids = this.evaluationIdsBySession.get(sessionId);
    return ids?.length ? this.evaluationsById.get(ids[ids.length - 1]) : undefined;
  }

  // --- Board snapshots --------------------------------------------------

  saveSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
    this.snapshots.set(snapshot.snapshotId, snapshot);
    return snapshot;
  }

  getSnapshot(snapshotId: string): BoardSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  // --- Speech transcripts ----------------------------------------------

  saveTranscript(transcript: SpeechTranscript): SpeechTranscript {
    this.transcripts.set(transcript.segmentId, transcript);
    return transcript;
  }

  // --- Learner responses & state ---------------------------------------

  saveResponse(response: LearnerResponse): LearnerResponse {
    this.responses.set(response.responseId, response);
    return response;
  }

  getResponse(responseId: string): LearnerResponse | undefined {
    return this.responses.get(responseId);
  }

  saveLearnerState(state: LearnerState): LearnerState {
    this.learnerStates.set(state.sessionId, state);
    return state;
  }

  getLearnerState(sessionId: string): LearnerState | undefined {
    return this.learnerStates.get(sessionId);
  }

  // --- Teaching turns (the transcript) ----------------------------------

  saveTurn(turn: TeachingTurn): TeachingTurn {
    const list = this.turns.get(turn.sessionId) ?? [];
    list.push(turn);
    this.turns.set(turn.sessionId, list);
    return turn;
  }

  listTurns(sessionId: string): TeachingTurn[] {
    return [...(this.turns.get(sessionId) ?? [])];
  }
}

/** Singleton store for the skeleton. */
export const sessions = new SessionStore();
