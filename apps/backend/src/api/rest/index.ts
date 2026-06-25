/**
 * REST endpoints for the session lifecycle & data retrieval (Architecture Document §7.1).
 *
 * Registered under the /api prefix. The session state machine (§4) is enforced
 * here. Triggering evaluation is idempotent (§4.2): calling it twice for the
 * same session returns the same result rather than re-running the Evaluator.
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { seedLearnerState } from "../../agents/index.js";
import { utcNowIso } from "../../contracts/common.js";
import type { EvaluationResult } from "../../contracts/evaluation.js";
import type { Session } from "../../contracts/session.js";
import {
  END,
  EVALUATE,
  InvalidTransition,
  START,
  nextStatus,
  type SessionEvent,
} from "../../modules/session/stateMachine.js";
import { newId, sessions } from "../../modules/storage/sessionStore.js";
import { topics } from "../../modules/topic/repository.js";

const createSessionSchema = z.object({ topicId: z.string() });

export async function restRoutes(app: FastifyInstance): Promise<void> {
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
    };
    reply.code(201);
    return sessions.saveSession(session);
  });

  app.get("/sessions/:sessionId", async (req, reply) => {
    const session = requireSession(req.params, reply);
    if (!session) return reply;
    return session;
  });

  app.post("/sessions/:sessionId/start", async (req, reply) => {
    const session = requireSession(req.params, reply);
    if (!session) return reply;
    if (!advance(session, START, reply)) return reply;
    session.startedAt = utcNowIso();

    // Seed the Learner's initial mental model from the topic's common
    // misconceptions (§3.6) so the student starts with believable gaps.
    if (!sessions.getLearnerState(session.sessionId)) {
      const topic = topics.get(session.topicId);
      if (topic) {
        sessions.saveLearnerState(
          seedLearnerState(session.sessionId, topic.commonMisconceptions, {
            topicTitle: topic.title,
          }),
        );
      }
    }
    return sessions.saveSession(session);
  });

  app.post("/sessions/:sessionId/end", async (req, reply) => {
    const session = requireSession(req.params, reply);
    if (!session) return reply;
    if (!advance(session, END, reply)) return reply;
    session.endedAt = utcNowIso();
    return sessions.saveSession(session);
  });

  app.post("/sessions/:sessionId/evaluate", async (req, reply) => {
    const session = requireSession(req.params, reply);
    if (!session) return reply;

    const existing = sessions.getEvaluationBySession(session.sessionId);
    if (existing) return existing; // idempotent: do not re-run the Evaluator

    if (session.status === "ENDED") {
      if (!advance(session, EVALUATE, reply)) return reply;
    }

    // TODO(M3): call the real Evaluator with the transcript + referenceMaterial.
    const result: EvaluationResult = {
      evaluationId: newId("ev"),
      sessionId: session.sessionId,
      score: 0,
      findings: [],
      summary: "Evaluator not implemented yet (M0 placeholder).",
      strengths: [],
      improvements: [],
      generatedAt: utcNowIso(),
    };
    sessions.saveEvaluation(result);
    session.evaluationId = result.evaluationId;
    sessions.saveSession(session);
    return result;
  });

  app.get("/sessions/:sessionId/evaluation", async (req, reply) => {
    const session = requireSession(req.params, reply);
    if (!session) return reply;
    const result = sessions.getEvaluationBySession(session.sessionId);
    if (!result) return reply.code(404).send({ detail: "Evaluation not available yet" });
    return result;
  });
}

// --- Helpers ---------------------------------------------------------------

function notFound(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(404).send({ detail });
}

function requireSession(params: unknown, reply: FastifyReply): Session | undefined {
  const { sessionId } = params as { sessionId: string };
  const session = sessions.getSession(sessionId);
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
