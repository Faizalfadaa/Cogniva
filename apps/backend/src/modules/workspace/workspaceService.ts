/**
 * Workspace service — drives the UI's workspace lifecycle on top of the existing
 * session orchestrator (§3.3) and Evaluator (§3.7).
 *
 * The frontend bridge (CognivaBridge.ts) is workspace-centric and polls over
 * plain REST, so this service:
 *   - backs each workspace with a real Session, reusing the teaching-turn loop
 *     and the evaluation transcript projection;
 *   - returns immediately from the "heavy" calls (submit checkpoint, send chat,
 *     finish) and finishes the agent work in the background, so the UI's polling
 *     model (getCheckpoints / getChatMessages / getWorkspace) just works;
 *   - synthesizes a Topic from the workspace metadata, since a free-form
 *     workspace has no curated topic. Vision still reads the board and the
 *     Learner still reacts; the Evaluator grades explanation quality even
 *     without a strict answer key (and falls back deterministically offline).
 */

import {
  LearnerAgent,
  getEvaluator,
  seedLearnerState,
  seedLearnerStateFromEvaluation,
  type TranscriptTurn,
} from "../../agents/index.js";
import * as config from "../../config/index.js";
import type { VisionInterpretation } from "../../contracts/board.js";
import { utcNowIso } from "../../contracts/common.js";
import type { Session } from "../../contracts/session.js";
import type { Topic } from "../../contracts/topic.js";
import type {
  ChatMessage,
  TeachingCheckpoint,
  Workspace,
} from "../../contracts/workspace.js";
import { getOrchestrator } from "../../orchestrator/index.js";
import { newId, sessions } from "../storage/sessionStore.js";
import { buildEvaluationReport } from "./evaluationReport.js";
import { newWorkspaceId, workspaces } from "./workspaceStore.js";

/** A single Learner instance for the free-text chat channel (mock when offline). */
const chatLearner = new LearnerAgent();

// --- Lifecycle / metadata --------------------------------------------------

export function listWorkspaces(): Workspace[] {
  return workspaces.list();
}

export function createWorkspace(): Workspace {
  const id = newWorkspaceId();
  const now = utcNowIso();
  const workspace: Workspace = { id, state: "Draft", createdAt: now, updatedAt: now };

  // Back it with a Session so the orchestrator/Evaluator drive it unchanged.
  const session: Session = {
    sessionId: newId("ses"),
    topicId: id, // synthetic — the Topic is built from workspace metadata
    status: "SETUP",
    createdAt: now,
    turnCount: 0,
    evaluationIds: [],
  };
  sessions.saveSession(session);
  workspaces.linkSession(id, session.sessionId);

  return workspaces.save(workspace);
}

export function getWorkspace(id: string): Workspace | undefined {
  return workspaces.get(id);
}

export function deleteWorkspace(id: string): boolean {
  const ws = workspaces.get(id);
  if (!ws) return false;

  const sessionId = workspaces.sessionId(id);
  if (sessionId) sessions.deleteSession(sessionId);
  workspaces.delete(id);

  return true;
}

export function updateMeta(
  id: string,
  meta: { title?: string; description?: string },
): Workspace | undefined {
  const ws = workspaces.get(id);
  if (!ws) return undefined;
  if (meta.title !== undefined) ws.title = meta.title;
  if (meta.description !== undefined) ws.description = meta.description;
  return touch(ws);
}

export function saveDraft(
  id: string,
  payload: { snapshot?: unknown; thumbnail?: string },
): Workspace | undefined {
  const ws = workspaces.get(id);
  if (!ws) return undefined;
  ws.currentWhiteboardSnapshot = payload.snapshot;
  if (payload.thumbnail) ws.thumbnailUrl = payload.thumbnail;
  // First real draft flips a blank workspace into Teaching (mirrors the mock).
  if (ws.state === "Draft") startTeaching(ws);
  return touch(ws);
}

export async function setPdf(
  id: string,
  data: Buffer,
  mime: string,
): Promise<Workspace | undefined> {
  const ws = workspaces.get(id);
  if (!ws) return undefined;
  workspaces.savePdf(id, { data, mime });
  ws.pdfUrl = `/api/workspaces/${id}/pdf`;

  // Extract the text and keep it as this session's reference material — the
  // answer key the Evaluator grades against (§3.7). It flows ONLY to the
  // Evaluator (via synthTopic), never to the Learner (§1.4). Extraction failures
  // (e.g. a scanned/image-only PDF) are non-fatal: the session has no reference.
  const text = await extractPdfText(data);
  if (text) workspaces.saveReference(id, text);

  return touch(ws);
}

/** Pull plain text out of a PDF buffer. Loaded lazily so the heavy PDF engine is
 * only imported when a document is actually uploaded. */
async function extractPdfText(data: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = Array.isArray(text) ? text.join("\n") : text;
    // Cap the length to keep the Evaluator prompt bounded.
    return merged.replace(/[ \t]+\n/g, "\n").trim().slice(0, 20000);
  } catch (err) {
    console.error("[workspace] PDF text extraction failed:", err);
    return "";
  }
}

// --- Teaching checkpoints --------------------------------------------------

export function submitCheckpoint(
  id: string,
  payload: {
    snapshotImage: string;
    snapshotMime: string;
    whiteboardSnapshot?: unknown;
    audio?: string;
    audioMime?: string;
  },
): TeachingCheckpoint | undefined {
  const ws = workspaces.get(id);
  if (!ws) return undefined;

  // A checkpoint implies teaching; make sure the session is live first.
  if (ws.state === "Draft") startTeaching(ws);

  const checkpoint: TeachingCheckpoint = {
    id: newId("chk"),
    snapshotImageUrl: dataUrl(payload.snapshotMime, payload.snapshotImage),
    whiteboardSnapshot: payload.whiteboardSnapshot,
    audioUrl: payload.audio
      ? dataUrl(payload.audioMime ?? "audio/webm", payload.audio)
      : undefined,
    learnerResponse: undefined,
    createdAt: utcNowIso(),
  };
  workspaces.addCheckpoint(id, checkpoint);
  touch(ws);

  // Run the actual teaching turn in the background; the UI polls getCheckpoints
  // for `learnerResponse` and getChatMessages for the mirrored reply.
  void (async () => {
    let reply: string;
    try {
      reply = await runTeachingTurn(ws, {
        image: payload.snapshotImage,
        audio: payload.audio ?? null,
      });
    } catch (err) {
      console.error("[workspace] teaching turn failed:", err);
      reply = "Hmm, I'm a little confused about this one... could you walk me through it again slowly?";
    }
    workspaces.updateCheckpoint(id, checkpoint.id, { learnerResponse: reply });
    workspaces.addMessage(id, learnerMessage(reply));
    touch(ws);
  })();

  return checkpoint;
}

export function getCheckpoints(id: string): TeachingCheckpoint[] | undefined {
  if (!workspaces.get(id)) return undefined;
  return workspaces.listCheckpoints(id);
}

// --- Chat ------------------------------------------------------------------

export function sendChatMessage(id: string, content: string): ChatMessage | undefined {
  const ws = workspaces.get(id);
  if (!ws) return undefined;

  const userMsg: ChatMessage = {
    id: newId("msg"),
    sender: "user",
    content,
    createdAt: utcNowIso(),
  };
  workspaces.addMessage(id, userMsg);
  touch(ws);

  // The Learner replies asynchronously so the user's own bubble lands instantly;
  // the reply surfaces on the next getChatMessages poll.
  void (async () => {
    let reply: string;
    try {
      reply = await runChatReply(ws, content);
    } catch (err) {
      console.error("[workspace] chat reply failed:", err);
      reply = "Oh, sorry, I blanked for a second there... could you say that again?";
    }
    workspaces.addMessage(id, learnerMessage(reply));
    touch(ws);
  })();

  return userMsg;
}

export function getChatMessages(id: string): ChatMessage[] | undefined {
  if (!workspaces.get(id)) return undefined;
  return workspaces.listMessages(id);
}

// --- Evaluation ------------------------------------------------------------

export function finishSession(id: string): boolean {
  const ws = workspaces.get(id);
  if (!ws) return false;
  // Idempotent: only a teaching workspace can be finished.
  if (ws.state !== "Teaching" && ws.state !== "Draft") return true;

  ws.state = "Evaluating";
  touch(ws);

  void (async () => {
    try {
      await runEvaluation(ws);
    } catch (err) {
      console.error("[workspace] evaluation failed:", err);
    }
    // Even on failure, surface a report so the debrief never dead-ends (§10).
    if (!workspaces.getReport(id)) {
      const session = requireSession(ws);
      workspaces.saveReport(
        id,
        buildEvaluationReport(emptyEvaluation(session.sessionId), {
          title: ws.title ?? "",
          turnCount: session.turnCount,
          learnerState: sessions.getLearnerState(session.sessionId),
          meaningfulScore: false,
        }),
      );
    }
    ws.state = "Completed";
    touch(ws);
  })();

  return true;
}

export function getReport(id: string) {
  return workspaces.getReport(id);
}

/**
 * Resume a finished workspace back into teaching (§4.2, §5.4). The transcript and
 * turn count carry over, and prior evaluations stay as history (the next finish
 * appends a fresh one). The Learner's mental model is re-seeded from the last
 * round's evaluation so the student now targets the user's real weak spots
 * (§4.3). Only a Completed workspace resumes.
 */
export function resumeSession(id: string): Workspace | undefined {
  const ws = workspaces.get(id);
  if (!ws) return undefined;
  if (ws.state !== "Completed") return ws; // nothing to resume

  const session = requireSession(ws);
  // EVALUATED/ENDED -> TEACHING. Direct move (the service owns workspace state),
  // keeping turnCount and evaluationIds intact.
  session.status = "TEACHING";
  session.endedAt = undefined;

  // Adaptive seeding (§4.3): re-aim the Learner at the weak spots the last
  // evaluation found, instead of carrying the old static misconceptions — so the
  // next round the student probes what the user actually got wrong/missed.
  const evaluation = sessions.getLatestEvaluation(session.sessionId);
  if (evaluation) {
    sessions.saveLearnerState(
      seedLearnerStateFromEvaluation(
        session.sessionId,
        evaluation,
        sessions.getLearnerState(session.sessionId),
      ),
    );
  }

  sessions.saveSession(session);
  ws.state = "Teaching";
  return touch(ws);
}

// --- Internals -------------------------------------------------------------

/** Run one teaching turn through the orchestrator, never pausing for confirmation. */
async function runTeachingTurn(
  ws: Workspace,
  input: { image: string; audio: string | null },
): Promise<string> {
  const session = requireSession(ws);
  const topic = synthTopic(ws);
  const orchestrator = getOrchestrator();

  let result = await orchestrator.runTeachingTurn(session, topic, {
    image: input.image,
    audio: input.audio,
    typedText: null,
  });

  // Low-confidence board reading would normally pause and ask the user, but the
  // workspace UI has no confirmation step — re-run trusting Vision's best guess.
  if (result.kind === "confirmation") {
    const guess = result.interpretation?.transcribedText?.trim() || "The explanation on the whiteboard";
    result = await orchestrator.runTeachingTurn(session, topic, {
      image: null,
      audio: input.audio,
      typedText: guess,
    });
  }

  return result.response?.text ?? "Okay... go on, I'm following.";
}

/** Drive the Learner persona for a free-text chat message (no teaching turn saved). */
async function runChatReply(ws: Workspace, content: string): Promise<string> {
  const session = requireSession(ws);
  const topic = synthTopic(ws);

  const interpretation: VisionInterpretation = {
    snapshotId: `chat_${session.sessionId}`,
    transcribedText: content,
    elements: [],
    confidence: 1,
    needsConfirmation: false,
  };

  const state =
    sessions.getLearnerState(session.sessionId) ??
    seedLearnerState(session.sessionId, [], { topicTitle: topic.title });

  const [response, nextState] = await chatLearner.respond({
    topicTitle: topic.title,
    topicDescription: topic.description,
    interpretation,
    speech: null,
    state,
    turnIndex: session.turnCount,
  });
  sessions.saveLearnerState(nextState);
  return response.text;
}

/** End the round and run the Evaluator, then store the mapped debrief report. */
async function runEvaluation(ws: Workspace): Promise<void> {
  const session = requireSession(ws);

  if (session.status === "TEACHING") session.status = "ENDED";
  session.endedAt = utcNowIso();
  sessions.saveSession(session);

  // Same transcript projection the session REST layer feeds the Evaluator (§5.2).
  const transcript: TranscriptTurn[] = sessions.listTurns(session.sessionId).map((turn) => {
    const learner = sessions.getResponse(turn.learnerResponseId);
    return {
      turnIndex: turn.turnIndex,
      boardText: turn.interpretation.transcribedText,
      speech: turn.speechTranscript?.transcript || undefined,
      learnerUtterance: learner?.text,
    };
  });

  const topic = synthTopic(ws);
  const result = await getEvaluator().evaluate(
    {
      sessionId: session.sessionId,
      turns: transcript,
      referenceMaterial: topic.referenceMaterial,
      keyConcepts: topic.keyConcepts,
      commonMisconceptions: topic.commonMisconceptions,
    },
    newId("ev"),
  );
  sessions.saveEvaluation(result);
  session.evaluationId = result.evaluationId;
  session.evaluationIds = sessions.listEvaluations(session.sessionId).map((e) => e.evaluationId);
  session.status = "EVALUATED";
  sessions.saveSession(session);

  // A synthesized workspace Topic has no key concepts, so the deterministic
  // offline evaluator can't produce a meaningful score — only a real LLM can.
  const usedMock = process.env.USE_MOCK_AI === "true" || !config.llmAvailable();

  workspaces.saveReport(
    ws.id,
    buildEvaluationReport(result, {
      title: ws.title ?? "",
      turnCount: session.turnCount,
      learnerState: sessions.getLearnerState(session.sessionId),
      meaningfulScore: !usedMock,
    }),
  );
}

/** Move a Draft workspace (and its Session) into the teaching loop. */
function startTeaching(ws: Workspace): void {
  ws.state = "Teaching";
  const session = requireSession(ws);
  if (session.status === "SETUP") {
    session.status = "TEACHING";
    session.startedAt = utcNowIso();
    if (!sessions.getLearnerState(session.sessionId)) {
      sessions.saveLearnerState(
        seedLearnerState(session.sessionId, synthTopic(ws).commonMisconceptions, {
          topicTitle: synthTopic(ws).title,
        }),
      );
    }
    sessions.saveSession(session);
  }
}

/** Build the Topic the agents need from whatever metadata the workspace has. */
function synthTopic(ws: Workspace): Topic {
  return {
    topicId: ws.id,
    title: ws.title?.trim() || "Untitled session",
    description: ws.description?.trim() || "",
    // Grounding: the uploaded PDF's text becomes the Evaluator's answer key.
    referenceMaterial: workspaces.getReference(ws.id) ?? "",
    keyConcepts: [],
    commonMisconceptions: [],
    difficulty: "medium",
  };
}

function requireSession(ws: Workspace): Session {
  const sessionId = workspaces.sessionId(ws.id);
  const session = sessionId ? sessions.getSession(sessionId) : undefined;
  if (!session) throw new Error(`No session backing workspace ${ws.id}`);
  return session;
}

function learnerMessage(content: string): ChatMessage {
  return { id: newId("msg"), sender: "learner", content, createdAt: utcNowIso() };
}

function emptyEvaluation(sessionId: string) {
  return {
    evaluationId: newId("ev"),
    sessionId,
    score: 0,
    findings: [],
    summary: "",
    strengths: [],
    improvements: [],
    generatedAt: utcNowIso(),
  };
}

function touch(ws: Workspace): Workspace {
  ws.updatedAt = utcNowIso();
  return workspaces.save(ws);
}

function dataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`;
}
