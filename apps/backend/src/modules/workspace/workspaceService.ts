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

import { LearnerAgent, getEvaluator, seedLearnerState, type TranscriptTurn } from "../../agents/index.js";
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

export function setPdf(id: string, data: Buffer, mime: string): Workspace | undefined {
  const ws = workspaces.get(id);
  if (!ws) return undefined;
  workspaces.savePdf(id, { data, mime });
  ws.pdfUrl = `/api/workspaces/${id}/pdf`;
  return touch(ws);
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
      reply = "Hmm, aku agak bingung sama yang ini... bisa dijelasin ulang pelan-pelan?";
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
      reply = "Eh, maaf, aku nge-blank sebentar... boleh diulang?";
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
 * Resume a finished workspace back into teaching (§4.2, §5.4). The transcript,
 * turn count, and the Learner's mental model are all preserved — the student
 * keeps remembering what was taught — and prior evaluations stay as history; the
 * next finish appends a fresh one. Only a Completed workspace resumes.
 */
export function resumeSession(id: string): Workspace | undefined {
  const ws = workspaces.get(id);
  if (!ws) return undefined;
  if (ws.state !== "Completed") return ws; // nothing to resume

  const session = requireSession(ws);
  // EVALUATED/ENDED -> TEACHING. Direct move (the service owns workspace state),
  // keeping turnCount, LearnerState, and evaluationIds intact.
  session.status = "TEACHING";
  session.endedAt = undefined;
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
    const guess = result.interpretation?.transcribedText?.trim() || "Penjelasan di papan tulis";
    result = await orchestrator.runTeachingTurn(session, topic, {
      image: null,
      audio: input.audio,
      typedText: guess,
    });
  }

  return result.response?.text ?? "Oke... lanjut deh, aku ikutin.";
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
    title: ws.title?.trim() || "Sesi tanpa judul",
    description: ws.description?.trim() || "",
    referenceMaterial: "",
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
