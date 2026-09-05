/**
 * Postgres-backed SessionStore (Architecture Document §8).
 *
 * Row <-> contract mapping lives here and nowhere else: the columns are
 * snake_case with real `timestamp` types, the contracts are camelCase with
 * ISO-8601 strings, and the agent payloads (VisionInterpretation,
 * SpeechTranscript, LearnerResponse, LearnerState, EvaluationResult) ride in
 * `Json` columns exactly as their Zod contracts define them.
 */

import type { BoardSnapshot } from "../../contracts/board.js";
import type { EvaluationResult } from "../../contracts/evaluation.js";
import type { LearnerResponse, LearnerState } from "../../contracts/learner.js";
import type { Session } from "../../contracts/session.js";
import type { SpeechTranscript } from "../../contracts/speech.js";
import type { TeachingTurn } from "../../contracts/teaching.js";
import type { SessionStore, TurnWithResponse } from "../../modules/storage/types.js";
import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../prisma.js";

/** A JSON column holding a contract object. */
type Payload = Prisma.InputJsonValue;

export class PrismaSessionStore implements SessionStore {
  // --- Session ----------------------------------------------------------

  async saveSession(session: Session): Promise<Session> {
    const row = {
      topic_id: session.topicId,
      status: session.status,
      created_at: new Date(session.createdAt),
      started_at: session.startedAt ? new Date(session.startedAt) : null,
      ended_at: session.endedAt ? new Date(session.endedAt) : null,
      turn_count: session.turnCount,
      tokens_used: session.tokensUsed,
      evaluation_id: session.evaluationId ?? null,
    };
    await prisma.session.upsert({
      where: { id_session: session.sessionId },
      create: { id_session: session.sessionId, ...row },
      update: row,
    });
    return session;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const row = await prisma.session.findUnique({
      where: { id_session: sessionId },
      include: { evaluation: { select: { id_evaluation: true }, orderBy: { seq: "asc" } } },
    });
    if (!row) return undefined;
    return {
      sessionId: row.id_session,
      topicId: row.topic_id,
      status: row.status as Session["status"],
      createdAt: row.created_at.toISOString(),
      startedAt: row.started_at?.toISOString(),
      endedAt: row.ended_at?.toISOString(),
      turnCount: row.turn_count,
      tokensUsed: row.tokens_used,
      evaluationId: row.evaluation_id ?? undefined,
      evaluationIds: row.evaluation.map((e) => e.id_evaluation),
    };
  }

  async addTokenUsage(sessionId: string, tokens: number): Promise<void> {
    if (tokens === 0) return;
    try {
      // An increment rather than read-modify-write: two turns can finish at once
      // and neither may lose the other's spend.
      await prisma.session.update({
        where: { id_session: sessionId },
        data: { tokens_used: { increment: tokens } },
      });
    } catch {
      // A missing session is a no-op by contract (§7.3): accounting must never
      // be the thing that breaks a turn.
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Everything else (turns, snapshots, evaluations, the learner state, and the
    // workspace itself) hangs off this row with ON DELETE CASCADE.
    await prisma.session.deleteMany({ where: { id_session: sessionId } });
  }

  // --- Evaluations ------------------------------------------------------

  async saveEvaluation(result: EvaluationResult): Promise<EvaluationResult> {
    await prisma.evaluation.upsert({
      where: { id_evaluation: result.evaluationId },
      create: {
        id_evaluation: result.evaluationId,
        id_session: result.sessionId,
        payload: result as unknown as Payload,
        created_at: new Date(result.generatedAt),
      },
      update: { payload: result as unknown as Payload },
    });
    return result;
  }

  async getEvaluationById(evaluationId: string): Promise<EvaluationResult | undefined> {
    const row = await prisma.evaluation.findUnique({ where: { id_evaluation: evaluationId } });
    return row ? (row.payload as unknown as EvaluationResult) : undefined;
  }

  async listEvaluations(sessionId: string): Promise<EvaluationResult[]> {
    const rows = await prisma.evaluation.findMany({
      where: { id_session: sessionId },
      orderBy: { seq: "asc" },
    });
    return rows.map((row) => row.payload as unknown as EvaluationResult);
  }

  async getLatestEvaluation(sessionId: string): Promise<EvaluationResult | undefined> {
    const row = await prisma.evaluation.findFirst({
      where: { id_session: sessionId },
      orderBy: { seq: "desc" },
    });
    return row ? (row.payload as unknown as EvaluationResult) : undefined;
  }

  // --- Board snapshots --------------------------------------------------

  async saveSnapshot(snapshot: BoardSnapshot): Promise<BoardSnapshot> {
    await prisma.board_snapshot.create({
      data: {
        id_snapshot: snapshot.snapshotId,
        id_session: snapshot.sessionId,
        turn_index: snapshot.turnIndex,
        image: snapshot.image,
        format: snapshot.format,
        captured_at: new Date(snapshot.capturedAt),
      },
    });
    return snapshot;
  }

  async getSnapshot(snapshotId: string): Promise<BoardSnapshot | undefined> {
    const row = await prisma.board_snapshot.findUnique({ where: { id_snapshot: snapshotId } });
    if (!row) return undefined;
    return {
      snapshotId: row.id_snapshot,
      sessionId: row.id_session,
      turnIndex: row.turn_index,
      image: row.image,
      format: row.format,
      capturedAt: row.captured_at.toISOString(),
    };
  }

  // --- Speech transcripts -----------------------------------------------

  async saveTranscript(transcript: SpeechTranscript): Promise<SpeechTranscript> {
    await prisma.speech_transcript.upsert({
      where: { id_segment: transcript.segmentId },
      create: {
        id_segment: transcript.segmentId,
        id_session: transcript.sessionId,
        payload: transcript as unknown as Payload,
      },
      update: { payload: transcript as unknown as Payload },
    });
    return transcript;
  }

  // --- Learner responses & state ----------------------------------------

  async saveResponse(sessionId: string, response: LearnerResponse): Promise<LearnerResponse> {
    await prisma.learner_response.upsert({
      where: { id_response: response.responseId },
      create: {
        id_response: response.responseId,
        id_session: sessionId,
        payload: response as unknown as Payload,
      },
      update: { payload: response as unknown as Payload },
    });
    return response;
  }

  async getResponse(responseId: string): Promise<LearnerResponse | undefined> {
    const row = await prisma.learner_response.findUnique({ where: { id_response: responseId } });
    return row ? (row.payload as unknown as LearnerResponse) : undefined;
  }

  async saveLearnerState(state: LearnerState): Promise<LearnerState> {
    await prisma.learner_state.upsert({
      where: { id_session: state.sessionId },
      create: { id_session: state.sessionId, payload: state as unknown as Payload },
      update: { payload: state as unknown as Payload },
    });
    return state;
  }

  async getLearnerState(sessionId: string): Promise<LearnerState | undefined> {
    const row = await prisma.learner_state.findUnique({ where: { id_session: sessionId } });
    return row ? (row.payload as unknown as LearnerState) : undefined;
  }

  // --- Teaching turns ---------------------------------------------------

  async saveTurn(turn: TeachingTurn): Promise<TeachingTurn> {
    await prisma.teaching_turn.upsert({
      where: {
        id_session_turn_index: { id_session: turn.sessionId, turn_index: turn.turnIndex },
      },
      create: {
        id_session: turn.sessionId,
        turn_index: turn.turnIndex,
        payload: turn as unknown as Payload,
        created_at: new Date(turn.createdAt),
      },
      update: { payload: turn as unknown as Payload },
    });
    return turn;
  }

  async listTurns(sessionId: string): Promise<TeachingTurn[]> {
    const rows = await prisma.teaching_turn.findMany({
      where: { id_session: sessionId },
      orderBy: { turn_index: "asc" },
    });
    return rows.map((row) => row.payload as unknown as TeachingTurn);
  }

  async lastTurn(sessionId: string): Promise<TeachingTurn | undefined> {
    const row = await prisma.teaching_turn.findFirst({
      where: { id_session: sessionId },
      orderBy: { turn_index: "desc" },
    });
    return row ? (row.payload as unknown as TeachingTurn) : undefined;
  }

  async listTurnsWithResponses(sessionId: string): Promise<TurnWithResponse[]> {
    const [turns, responses] = await Promise.all([
      this.listTurns(sessionId),
      prisma.learner_response.findMany({ where: { id_session: sessionId } }),
    ]);
    const byId = new Map(
      responses.map((row) => [row.id_response, row.payload as unknown as LearnerResponse]),
    );
    return turns.map((turn) => ({ turn, response: byId.get(turn.learnerResponseId) }));
  }
}
