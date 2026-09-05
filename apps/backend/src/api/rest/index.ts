/**
 * REST endpoints for the session lifecycle & data retrieval (Architecture Document §7.1).
 *
 * Registered under the /api prefix. The session state machine (§4) is enforced
 * here. Triggering evaluation is idempotent for the current round (§4.2). A
 * finished session is resumable (POST /resume): it returns to TEACHING and each
 * ended round keeps its own EvaluationResult as history (agreed extension).
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import {
  getEvaluator,
  seedLearnerState,
  seedLearnerStateFromEvaluation,
  type TranscriptTurn,
} from "../../agents/index.js";
import { utcNowIso } from "../../contracts/common.js";
import type { EvaluationResult } from "../../contracts/evaluation.js";
import type { Session } from "../../contracts/session.js";
import {
  END,
  EVALUATE,
  InvalidTransition,
  RESUME,
  START,
  nextStatus,
  type SessionEvent,
} from "../../modules/session/stateMachine.js";
import { newId, sessions } from "../../modules/storage/sessionStore.js";
import { topics } from "../../modules/topic/repository.js";

const createSessionSchema = z.object({ topicId: z.string() });

export async function restRoutes(app: FastifyInstance): Promise<void> {
  // In-flight evaluations per session, to de-duplicate concurrent /evaluate
  // calls for the same round (e.g. React StrictMode mounts the debrief twice).
  const evaluating = new Map<string, Promise<EvaluateOutcome>>();

  // --- Topics --------------------------------------------------------------

  app.get("/topics", async () => topics.list());

  app.get("/topics/:topicId", async (req, reply) => {
    const { topicId } = req.params as { topicId: string };
    const topic = topics.get(topicId);
    if (!topic) return notFound(reply, "Topic not found");
    return topic;
  });

  // --- Session lifecycle ---------------------------------------------------

  app.post("/sessions", async (req, reply) => {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ detail: "topicId is required" });
    if (!topics.get(parsed.data.topicId)) return notFound(reply, "Topic not found");

    const session: Session = {
      sessionId: newId("ses"),
      topicId: parsed.data.topicId,
      status: "SETUP",
      createdAt: utcNowIso(),
      turnCount: 0,
      tokensUsed: 0,
      evaluationIds: [],
    };
    reply.code(201);
    return sessions.saveSession(session);
  });

  app.get("/sessions/:sessionId", async (req, reply) => {
    const session = await requireSession(req.params, reply);
    if (!session) return reply;
    return session;
  });

  app.post("/sessions/:sessionId/start", async (req, reply) => {
    const session = await requireSession(req.params, reply);
    if (!session) return reply;
    if (!advance(session, START, reply)) return reply;
    session.startedAt = utcNowIso();

    // Seed the Learner's initial mental model from the topic's common
    // misconceptions (§3.6) so the student starts with believable gaps.
    if (!(await sessions.getLearnerState(session.sessionId))) {
      const topic = topics.get(session.topicId);
      if (topic) {
        await sessions.saveLearnerState(
          seedLearnerState(session.sessionId, topic.commonMisconceptions, {
            topicTitle: topic.title,
          }),
        );
      }
    }
    return sessions.saveSession(session);
  });

  app.post("/sessions/:sessionId/end", async (req, reply) => {
    const session = await requireSession(req.params, reply);
    if (!session) return reply;
    if (!advance(session, END, reply)) return reply;
    session.endedAt = utcNowIso();
    return sessions.saveSession(session);
  });

  app.post("/sessions/:sessionId/evaluate", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };

    // De-duplicate concurrent evaluates for the same round: the first call runs
    // the Evaluator and advances the state; overlapping calls await that same
    // in-flight promise instead of starting a second run and racing on the
    // ENDED -> EVALUATED transition (which used to 409 for the loser).
    //
    // The slot is claimed synchronously, before the first await. Reading the
    // session is a database query now, so a check-then-claim would leave a
    // window in which both calls looked, found nothing in flight, and started.
    const run = evaluating.get(sessionId) ?? startEvaluation(sessionId);

    // The Evaluator never throws (it falls back to a deterministic assessment),
    // but guard anyway: on failure leave the session ENDED so it can be retried
    // without corrupting session data (§10).
    let outcome: EvaluateOutcome;
    try {
      outcome = await run;
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ detail: "Evaluation failed; please retry" });
    }
    if (!outcome.ok) return reply.code(outcome.status).send({ detail: outcome.detail });
    return outcome.result;
  });

  /** Start one evaluation round and register it for dedup, without awaiting. */
  function startEvaluation(sessionId: string): Promise<EvaluateOutcome> {
    const run = evaluateRound(sessionId);
    evaluating.set(sessionId, run);
    // Release the slot once the round settles, so a later round (after a resume
    // and re-end) starts fresh rather than replaying this result.
    void run.catch(() => undefined).then(() => evaluating.delete(sessionId));
    return run;
  }

  async function evaluateRound(sessionId: string): Promise<EvaluateOutcome> {
    const session = await sessions.getSession(sessionId);
    if (!session) return { ok: false, status: 404, detail: "Session not found" };

    // Idempotent within a round (§4.2): if this round is already EVALUATED,
    // return its result without re-running. After a resume + re-end the status
    // is ENDED again, so a fresh evaluation runs and is appended to history.
    if (session.status === "EVALUATED") {
      const latest = await sessions.getLatestEvaluation(sessionId);
      if (latest) return { ok: true, result: latest };
    }

    // A new evaluation is only valid once the current round has ENDED (§4.2).
    if (session.status !== "ENDED") {
      return {
        ok: false,
        status: 409,
        detail: `Cannot evaluate in status '${session.status}'; end the session first`,
      };
    }

    const topic = topics.get(session.topicId);
    if (!topic) return { ok: false, status: 404, detail: "Topic not found for session" };

    // Project the stored teaching turns (§6.6) down to the transcript the
    // Evaluator reads: board reading + spoken transcript + the student's reply.
    const rows = await sessions.listTurnsWithResponses(sessionId);
    const transcript: TranscriptTurn[] = rows.map(({ turn, response }) => ({
      turnIndex: turn.turnIndex,
      boardText: turn.interpretation.transcribedText,
      speech: turn.speechTranscript?.transcript || undefined,
      learnerUtterance: response?.text,
    }));

    const result = await getEvaluator().evaluate(
      {
        sessionId,
        turns: transcript,
        referenceMaterial: topic.referenceMaterial,
        keyConcepts: topic.keyConcepts,
        commonMisconceptions: topic.commonMisconceptions,
      },
      newId("ev"),
    );
    await sessions.saveEvaluation(result);
    session.evaluationId = result.evaluationId;
    session.evaluationIds = (await sessions.listEvaluations(sessionId)).map(
      (e) => e.evaluationId,
    );
    session.status = nextStatus(session.status, EVALUATE); // ENDED -> EVALUATED
    await sessions.saveSession(session);
    return { ok: true, result };
  }

  // Resume a finished session to keep teaching (EVALUATED/ENDED -> TEACHING).
  // The transcript, turn count, and Learner mental model are preserved, so the
  // conversation continues; prior evaluations remain as history.
  app.post("/sessions/:sessionId/resume", async (req, reply) => {
    const session = await requireSession(req.params, reply);
    if (!session) return reply;
    if (!advance(session, RESUME, reply)) return reply;
    session.endedAt = undefined;

    // Adaptive seeding (§4.3): re-aim the Learner at the weak spots the last
    // round's evaluation surfaced, rather than carrying the static seed forward.
    const latest = await sessions.getLatestEvaluation(session.sessionId);
    if (latest) {
      await sessions.saveLearnerState(
        seedLearnerStateFromEvaluation(
          session.sessionId,
          latest,
          await sessions.getLearnerState(session.sessionId),
        ),
      );
    }
    return sessions.saveSession(session);
  });

  app.get("/sessions/:sessionId/evaluation", async (req, reply) => {
    const session = await requireSession(req.params, reply);
    if (!session) return reply;
    const result = await sessions.getLatestEvaluation(session.sessionId);
    if (!result) return reply.code(404).send({ detail: "Evaluation not available yet" });
    return result;
  });

  // Full evaluation history (oldest first) — one entry per ended round.
  app.get("/sessions/:sessionId/evaluations", async (req, reply) => {
    const session = await requireSession(req.params, reply);
    if (!session) return reply;
    return sessions.listEvaluations(session.sessionId);
  });
}

// --- Helpers ---------------------------------------------------------------

/**
 * What one evaluation round produced. Errors travel as data rather than through
 * `reply`, because a round is shared by every caller that overlapped it — each
 * one has its own reply to write the same answer to.
 */
type EvaluateOutcome =
  | { ok: true; result: EvaluationResult }
  | { ok: false; status: number; detail: string };

function notFound(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(404).send({ detail });
}

async function requireSession(
  params: unknown,
  reply: FastifyReply,
): Promise<Session | undefined> {
  const { sessionId } = params as { sessionId: string };
  const session = await sessions.getSession(sessionId);
  if (!session) {
    notFound(reply, "Session not found");
    return undefined;
  }
  return session;
}

/** Advance the session via the state machine; on an illegal move reply 409. */
function advance(session: Session, event: SessionEvent, reply: FastifyReply): boolean {
  try {
    session.status = nextStatus(session.status, event);
    return true;
  } catch (err) {
    if (err instanceof InvalidTransition) {
      reply.code(409).send({ detail: err.message });
      return false;
    }
    throw err;
  }
}
