/**
 * Real-time session channel via WebSocket (Architecture Document §7.2).
 *
 * Endpoint: /ws/sessions/:id. Client messages are only processed when the
 * session status allows it (teaching_input only in TEACHING, §4.2).
 *
 * M1 wires the core teaching loop: a teaching_input runs one full turn through
 * the orchestrator (Vision passthrough -> Learner) and streams back the board
 * reading plus the student's response. Real Vision/ASR land in M2.
 */

import type { FastifyInstance } from "fastify";

import type { ServerMessage } from "../../contracts/messages.js";
import { getOrchestrator } from "../../orchestrator/index.js";
import { acceptsTeachingInput } from "../../modules/session/stateMachine.js";
import { sessions } from "../../modules/storage/sessionStore.js";
import { topics } from "../../modules/topic/repository.js";

type Send = (message: ServerMessage) => void;

const log = (msg: string) => console.error(`[cogniva.ws] ${msg}`);

export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ws/sessions/:sessionId", { websocket: true }, (socket, req) => {
    const { sessionId } = req.params as { sessionId: string };
    const send: Send = (message) => socket.send(JSON.stringify(message));

    const session = sessions.getSession(sessionId);
    if (!session) {
      send({ type: "error", message: "Session not found" });
      socket.close();
      return;
    }

    send({ type: "state_update", status: session.status });

    socket.on("message", (raw) => {
      void handleMessage(send, sessionId, raw.toString());
    });
  });
}

async function handleMessage(send: Send, sessionId: string, raw: string): Promise<void> {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    send({ type: "error", message: "Invalid JSON payload" });
    return;
  }

  const type = payload.type;
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

  if (type === "teaching_input") {
    await runTurn(send, sessionId, str(payload.image), str(payload.typedText), str(payload.audio));
  } else if (type === "confirmation_response") {
    // The user corrected an uncertain board reading; rerun the turn with it.
    await runTurn(send, sessionId, null, str(payload.corrected), null);
  } else if (type === "end_session") {
    // Mirrors REST POST /sessions/:id/end; same state machine.
    send({ type: "state_update", status: "ENDED" });
  } else {
    send({ type: "error", message: `Unknown message type: ${JSON.stringify(type)}` });
  }
}

async function runTurn(
  send: Send,
  sessionId: string,
  image: string | null,
  typedText: string | null,
  audio: string | null,
): Promise<void> {
  const session = sessions.getSession(sessionId);
  if (!session) {
    send({ type: "error", message: "Session not found" });
    return;
  }
  if (!acceptsTeachingInput(session.status)) {
    send({
      type: "error",
      message: `teaching_input is only valid in TEACHING (current status: ${session.status})`,
    });
    return;
  }
  const topic = topics.get(session.topicId);
  if (!topic) {
    send({ type: "error", message: "Topic not found for session" });
    return;
  }

  let result;
  try {
    result = await getOrchestrator().runTeachingTurn(session, topic, { image, audio, typedText });
  } catch (err) {
    log(`Teaching turn failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    send({
      type: "error",
      message: `Teaching turn failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  if (result.kind === "confirmation") {
    send({
      type: "confirmation_request",
      snapshotId: result.snapshotId ?? "",
      suggestedClarification: result.suggestedClarification ?? "",
    });
    return;
  }

  if (result.interpretation) {
    send({ type: "vision_result", interpretation: result.interpretation });
  }
  if (result.speech) {
    send({ type: "speech_result", transcript: result.speech });
  }
  if (result.response) {
    send({ type: "learner_message", response: result.response });
  }
}
