/**
 * The session store singleton, plus the in-memory double the tests use.
 *
 * Storage is Postgres (src/database/stores/prismaSessionStore.ts). The Map-based
 * implementation below is NOT a production path: it exists so `npm test` runs
 * without a database, and is selected only by an explicit COGNIVA_STORE=memory
 * (vitest sets it). Anything else gets Postgres, and a missing DATABASE_URL then
 * fails loudly at boot rather than silently losing data.
 */

import { randomUUID } from "node:crypto";

import type { BoardSnapshot } from "../../contracts/board.js";
import type { EvaluationResult } from "../../contracts/evaluation.js";
import type { LearnerResponse, LearnerState } from "../../contracts/learner.js";
import type { Session } from "../../contracts/session.js";
import type { SpeechTranscript } from "../../contracts/speech.js";
import type { TeachingTurn } from "../../contracts/teaching.js";
import { PrismaSessionStore } from "../../database/stores/prismaSessionStore.js";
import { usingMemoryStore } from "./mode.js";
import type { SessionStore, TurnWithResponse } from "./types.js";

export type { SessionStore, TurnWithResponse } from "./types.js";

/** Generate a short prefixed id, e.g. "ses_1a2b3c4d". */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

/** Test double: the same contract, held in Maps. See the file header. */
export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();
  private evaluationsById = new Map<string, EvaluationResult>();
  private evaluationIdsBySession = new Map<string, string[]>();
  private snapshots = new Map<string, BoardSnapshot>();
  private transcripts = new Map<string, SpeechTranscript>();
  private responses = new Map<string, LearnerResponse>();
  private learnerStates = new Map<string, LearnerState>();
  private turns = new Map<string, TeachingTurn[]>();

  // --- Session ----------------------------------------------------------

  async saveSession(session: Session): Promise<Session> {
    this.sessions.set(session.sessionId, session);
    return session;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    return this.sessions.get(sessionId);
  }

  async addTokenUsage(sessionId: string, tokens: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.tokensUsed += tokens;
    await this.saveSession(session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    for (const evalId of this.evaluationIdsBySession.get(sessionId) ?? []) {
      this.evaluationsById.delete(evalId);
    }
    this.evaluationIdsBySession.delete(sessionId);
    this.learnerStates.delete(sessionId);
    for (const turn of this.turns.get(sessionId) ?? []) {
      this.snapshots.delete(turn.snapshotId);
      this.responses.delete(turn.learnerResponseId);
    }
    this.turns.delete(sessionId);
    for (const [id, transcript] of this.transcripts) {
      if (transcript.sessionId === sessionId) this.transcripts.delete(id);
    }
  }

  // --- Evaluations ------------------------------------------------------

  async saveEvaluation(result: EvaluationResult): Promise<EvaluationResult> {
    this.evaluationsById.set(result.evaluationId, result);
    const ids = this.evaluationIdsBySession.get(result.sessionId) ?? [];
    if (!ids.includes(result.evaluationId)) ids.push(result.evaluationId);
    this.evaluationIdsBySession.set(result.sessionId, ids);
    return result;
  }

  async getEvaluationById(evaluationId: string): Promise<EvaluationResult | undefined> {
    return this.evaluationsById.get(evaluationId);
  }

  async listEvaluations(sessionId: string): Promise<EvaluationResult[]> {
    return (this.evaluationIdsBySession.get(sessionId) ?? [])
      .map((id) => this.evaluationsById.get(id))
      .filter((e): e is EvaluationResult => Boolean(e));
  }

  async getLatestEvaluation(sessionId: string): Promise<EvaluationResult | undefined> {
    const ids = this.evaluationIdsBySession.get(sessionId);
    return ids?.length ? this.evaluationsById.get(ids[ids.length - 1]) : undefined;
  }

  // --- Board snapshots --------------------------------------------------

  async saveSnapshot(snapshot: BoardSnapshot): Promise<BoardSnapshot> {
    this.snapshots.set(snapshot.snapshotId, snapshot);
    return snapshot;
  }

  async getSnapshot(snapshotId: string): Promise<BoardSnapshot | undefined> {
    return this.snapshots.get(snapshotId);
  }

  // --- Speech transcripts -----------------------------------------------

  async saveTranscript(transcript: SpeechTranscript): Promise<SpeechTranscript> {
    this.transcripts.set(transcript.segmentId, transcript);
    return transcript;
  }

  // --- Learner responses & state ----------------------------------------

  async saveResponse(_sessionId: string, response: LearnerResponse): Promise<LearnerResponse> {
    this.responses.set(response.responseId, response);
    return response;
  }

  async getResponse(responseId: string): Promise<LearnerResponse | undefined> {
    return this.responses.get(responseId);
  }

  async saveLearnerState(state: LearnerState): Promise<LearnerState> {
    this.learnerStates.set(state.sessionId, state);
    return state;
  }

  async getLearnerState(sessionId: string): Promise<LearnerState | undefined> {
    return this.learnerStates.get(sessionId);
  }

  // --- Teaching turns ---------------------------------------------------

  async saveTurn(turn: TeachingTurn): Promise<TeachingTurn> {
    const list = this.turns.get(turn.sessionId) ?? [];
    const existing = list.findIndex((t) => t.turnIndex === turn.turnIndex);
    if (existing === -1) list.push(turn);
    else list[existing] = turn;
    this.turns.set(turn.sessionId, list);
    return turn;
  }

  async listTurns(sessionId: string): Promise<TeachingTurn[]> {
    return [...(this.turns.get(sessionId) ?? [])];
  }

  async lastTurn(sessionId: string): Promise<TeachingTurn | undefined> {
    const list = this.turns.get(sessionId) ?? [];
    return list.length ? list[list.length - 1] : undefined;
  }

  async listTurnsWithResponses(sessionId: string): Promise<TurnWithResponse[]> {
    return (this.turns.get(sessionId) ?? []).map((turn) => ({
      turn,
      response: this.responses.get(turn.learnerResponseId),
    }));
  }
}

/** The store the whole backend writes through. */
export const sessions: SessionStore = usingMemoryStore()
  ? new MemorySessionStore()
  : new PrismaSessionStore();
