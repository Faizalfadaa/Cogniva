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
  ReferencerAgent,
  getEvaluator,
  seedLearnerState,
  seedLearnerStateFromEvaluation,
  type ReferenceSuggestions,
  type TranscriptTurn,
} from "../../agents/index.js";
import * as config from "../../config/index.js";
import type { VisionInterpretation } from "../../contracts/board.js";
import { utcNowIso } from "../../contracts/common.js";
import type { Session } from "../../contracts/session.js";
import type { Timeline } from "../../contracts/timeline.js";
import type { Topic } from "../../contracts/topic.js";
import type {
  ChatMessage,
  CheckpointErrorKind,
  ReferenceSource,
  TeachingCheckpoint,
  Workspace,
} from "../../contracts/workspace.js";
import { getOrchestrator } from "../../orchestrator/index.js";
import {
  buildOutline,
  buildReferenceIndex,
  queriesFromTranscript,
  retrieveExcerpts,
  type ReferenceExcerpt,
} from "../retrieval/index.js";
import { newId, sessions } from "../storage/sessionStore.js";
import { synthesizeSpeech, ttsVoiceForWorkspace } from "../tts/index.js";
import { buildEvaluationReport } from "./evaluationReport.js";
import { newWorkspaceId, workspaces } from "./workspaceStore.js";

/** A single Learner instance for the free-text chat channel (mock when offline). */
const chatLearner = new LearnerAgent();

// --- Lifecycle / metadata --------------------------------------------------

/** Anonymous owner for requests that arrive without an x-client-id (e.g. curl). */
export const ANON_OWNER = "anonymous";

export async function listWorkspaces(ownerId: string = ANON_OWNER): Promise<Workspace[]> {
  return workspaces.list(ownerId);
}

/** True when this device owns the workspace — gates every per-workspace route. */
export async function isOwner(id: string, ownerId: string = ANON_OWNER): Promise<boolean> {
  return workspaces.isOwner(id, ownerId);
}

export async function createWorkspace(ownerId: string = ANON_OWNER): Promise<Workspace> {
  const id = newWorkspaceId();
  const now = utcNowIso();
  const workspace: Workspace = { id, state: "Draft", createdAt: now, updatedAt: now };

  // Back it with a Session so the orchestrator/Evaluator drive it unchanged.
  // The session is written first: the workspace row references it.
  const session: Session = {
    sessionId: newId("ses"),
    topicId: id, // synthetic — the Topic is built from workspace metadata
    status: "SETUP",
    createdAt: now,
    turnCount: 0,
    tokensUsed: 0,
    evaluationIds: [],
  };
  await sessions.saveSession(session);

  return workspaces.create(workspace, ownerId, session.sessionId);
}

export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  return workspaces.get(id);
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  const ws = await workspaces.get(id);
  if (!ws) return false;

  const sessionId = await workspaces.sessionId(id);
  await workspaces.delete(id);
  if (sessionId) await sessions.deleteSession(sessionId);

  return true;
}

export async function updateMeta(
  id: string,
  meta: { title?: string; description?: string },
): Promise<Workspace | undefined> {
  const ws = await workspaces.get(id);
  if (!ws) return undefined;
  if (meta.title !== undefined) ws.title = meta.title;
  if (meta.description !== undefined) ws.description = meta.description;
  return touch(ws);
}

export async function saveDraft(
  id: string,
  payload: { snapshot?: unknown; thumbnail?: string },
): Promise<Workspace | undefined> {
  const ws = await workspaces.get(id);
  if (!ws) return undefined;
  ws.currentWhiteboardSnapshot = payload.snapshot;
  if (payload.thumbnail) ws.thumbnailUrl = payload.thumbnail;
  // First real draft flips a blank workspace into Teaching (mirrors the mock).
  if (ws.state === "Draft") await startTeaching(ws);
  return touch(ws);
}

export async function setPdf(
  id: string,
  data: Buffer,
  mime: string,
): Promise<Workspace | undefined> {
  const ws = await workspaces.get(id);
  if (!ws) return undefined;
  await workspaces.savePdf(id, { data, mime });
  ws.pdfUrl = `/api/workspaces/${id}/pdf`;

  // An upload replaces whatever the Referencer had found: there is one answer
  // key per session, and leaving the old provenance would label this PDF with
  // someone else's URL.
  await workspaces.saveReferenceSource(id, undefined);
  ws.referenceSource = undefined;

  // Extract the text and keep it as this session's reference material — the
  // answer key the Evaluator grades against (§3.7). It flows ONLY to the
  // Evaluator, never to the Learner (§1.4). Extraction failures (e.g. a
  // scanned/image-only PDF) are non-fatal: the session has no reference.
  const text = await extractPdfText(data);
  if (text) {
    await workspaces.saveReference(id, text);
    // Chunk + embed in the background so the upload response stays fast, the
    // same pattern the checkpoint/chat/finish calls use. Evaluation builds the
    // index synchronously if it is still missing by then.
    void indexReference(id, text);
  }

  return touch(ws);
}

/**
 * Store reference material the user typed or pasted in themselves.
 *
 * The third source, beside an uploaded PDF (setPdf) and a page the Referencer
 * found (useReference), and the only one that needs no extraction step — the
 * text is already text. It lands in the same place as the other two and is read
 * by the Evaluator alone (§1.4).
 */
export async function setReferenceText(
  id: string,
  raw: string,
): Promise<{ workspace: Workspace; chars: number } | undefined> {
  const ws = await workspaces.get(id);
  if (!ws) return undefined;

  const text = raw
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, config.RAG_MAX_REFERENCE_CHARS);
  await workspaces.saveReference(id, text);

  // Pasted text has no provenance to show, and any previous chip would now be
  // pointing at material that is no longer in use.
  await workspaces.saveReferenceSource(id, undefined);
  ws.referenceSource = undefined;

  void indexReference(id, text);
  return { workspace: await touch(ws), chars: text.length };
}

/** Build (or rebuild) the retrieval index for a workspace's reference text. */
async function indexReference(id: string, text: string): Promise<void> {
  try {
    const index = await buildReferenceIndex(text);
    await workspaces.saveReferenceIndex(id, index);
    console.log(
      `[workspace] reference indexed for ${id}: ${index.size} bagian, mode ${index.mode}`,
    );
  } catch (err) {
    // buildReferenceIndex already degrades to keyword mode internally; reaching
    // here means chunking itself failed, and the Evaluator falls back to the
    // full-text path.
    console.error("[workspace] reference indexing failed:", err);
  }
}

// --- Reference sourcing (§3.7) ---------------------------------------------

/**
 * A single Referencer instance, matching how the chat Learner is held. Stateless
 * between calls; it exists so tests have a seam and so the offline default is
 * decided in one place.
 */
const referencer = new ReferencerAgent();

/**
 * Offer reading material for a workspace whose user has none.
 *
 * Synchronous on purpose, unlike the teaching-turn calls. Those return early
 * because the UI polls a list that fills in later; this one answers a modal the
 * user is sitting in front of, and there is nothing for them to do until the
 * options arrive. Nothing is stored — the user hands back the option they chose.
 */
export async function suggestReferences(
  id: string,
  hint?: string,
): Promise<ReferenceSuggestions | undefined> {
  const ws = await workspaces.get(id);
  if (!ws) return undefined;

  return referencer.suggest({
    topic: topicNameOf(ws),
    description: ws.description,
    hint,
  });
}

/** The outcome of adopting a suggested source. */
export interface UseReferenceResult {
  ok: boolean;
  /** Empty when ok; otherwise why the source could not be used, in Indonesian. */
  problem: string;
  /** How much reference text was extracted. Useful signal for the UI. */
  chars: number;
  workspace?: Workspace;
}

/**
 * Adopt one suggested source as this session's reference material.
 *
 * Same destination as a PDF upload — reference text plus a retrieval index, read
 * by the Evaluator alone (§1.4). The difference is only where the text came
 * from, which is recorded so the UI can show it after a reload.
 */
export async function useReference(
  id: string,
  choice: { url: string; title?: string; source?: string },
): Promise<UseReferenceResult | undefined> {
  const ws = await workspaces.get(id);
  if (!ws) return undefined;

  const fetched = await referencer.read(choice.url, topicNameOf(ws));
  if (!fetched.ok) return { ok: false, problem: fetched.problem, chars: 0 };

  const text = fetched.text.slice(0, config.RAG_MAX_REFERENCE_CHARS);
  await workspaces.saveReference(id, text);

  const provenance: ReferenceSource = {
    url: choice.url,
    title: choice.title?.trim() || fetched.title,
    source: choice.source?.trim() || hostLabel(choice.url),
  };
  await workspaces.saveReferenceSource(id, provenance);
  ws.referenceSource = provenance;

  // Same background indexing as an upload: the response stays fast, and
  // evaluation rebuilds the index synchronously if it is somehow still missing.
  void indexReference(id, text);

  return { ok: true, problem: "", chars: text.length, workspace: await touch(ws) };
}

/** What the session is about, as the Referencer should search for it. */
function topicNameOf(ws: Workspace): string {
  return ws.title?.trim() || ws.description?.trim().slice(0, 120) || "";
}

/** "khanacademy.org" from a URL — the fallback publisher label. */
function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Pull plain text out of a PDF buffer. Loaded lazily so the heavy PDF engine is
 * only imported when a document is actually uploaded. */
async function extractPdfText(data: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = Array.isArray(text) ? text.join("\n") : text;
    // Retrieval (§3.7) now bounds the Evaluator prompt by selecting passages, so
    // the old 20k truncation is gone — a long PDF is chunked, not cut off. What
    // remains is a sanity bound against a pathologically large upload.
    return merged
      .replace(/[ \t]+\n/g, "\n")
      .trim()
      .slice(0, config.RAG_MAX_REFERENCE_CHARS);
  } catch (err) {
    console.error("[workspace] PDF text extraction failed:", err);
    return "";
  }
}

// --- Teaching checkpoints --------------------------------------------------

export async function submitCheckpoint(
  id: string,
  payload: {
    snapshotImage: string;
    snapshotMime: string;
    whiteboardSnapshot?: unknown;
    audio?: string;
    audioMime?: string;
    timeline?: Timeline;
  },
): Promise<TeachingCheckpoint | undefined> {
  const ws = await workspaces.get(id);
  if (!ws) return undefined;

  // A checkpoint implies teaching; make sure the session is live first.
  if (ws.state === "Draft") await startTeaching(ws);

  const checkpoint: TeachingCheckpoint = {
    id: newId("chk"),
    snapshotImageUrl: dataUrl(payload.snapshotMime, payload.snapshotImage),
    whiteboardSnapshot: payload.whiteboardSnapshot,
    audioUrl: payload.audio
      ? dataUrl(payload.audioMime ?? "audio/webm", payload.audio)
      : undefined,
    learnerResponse: undefined,
    // Phase 1: stored alongside whiteboardSnapshot and deliberately NOT passed
    // to runTeachingTurn -- wiring it into Vision/Learner is Phase 2.
    timeline: payload.timeline,
    createdAt: utcNowIso(),
  };
  await workspaces.addCheckpoint(id, checkpoint);
  await touch(ws);

  // Run the actual teaching turn in the background; the UI polls getCheckpoints
  // for `learnerResponse` and getChatMessages for the mirrored reply.
  inBackground("teaching turn", async () => {
    let reply: TurnReply;
    try {
      reply = await runTeachingTurn(ws, {
        image: payload.snapshotImage,
        audio: payload.audio ?? null,
      });
    } catch (err) {
      // A thrown turn stays untagged: errorKind is for conditions we understand
      // and can explain, not for "something broke". The client surfaces those
      // from the failed request itself.
      console.error("[workspace] teaching turn failed:", err);
      reply = {
        text: "Hmm, I'm a little confused about this one... could you walk me through it again slowly?",
      };
    }
    if (!(await stillExists(id))) return;
    // Publish the text immediately; the voice is attached once it is ready.
    //
    // Speech used to be rendered first so both landed on the same poll. That
    // only held while a render took a few seconds — one was measured at over
    // three minutes, well past the client timeout, and the reply would have
    // been held back that long for audio that never arrived. Text is what the
    // user is waiting for; the voice catches up on a later poll.
    await workspaces.updateCheckpoint(id, checkpoint.id, {
      learnerResponse: reply.text,
      errorKind: reply.errorKind,
    });
    // Still mirrored into chat: the text is written in the student's voice, and
    // dropping it would leave a silent gap in the conversation history.
    const message = await workspaces.addMessage(id, learnerMessage(reply.text));
    await bump(id);

    // A tagged turn is a system message, not something the student said —
    // speaking "you are out of budget" in the learner's voice would be odd, and
    // it would spend GPU time on a session that just hit its ceiling.
    if (reply.errorKind) return;

    const learnerAudioUrl = await speakLearnerReply(id, reply.text);
    // Re-check: synthesis can take minutes, and the workspace may have been
    // deleted while it ran.
    if (learnerAudioUrl && (await stillExists(id))) {
      await workspaces.updateCheckpoint(id, checkpoint.id, { learnerAudioUrl });
      await workspaces.updateMessage(id, message.id, { learnerAudioUrl });
      await bump(id);
    }
  });

  return checkpoint;
}

export async function getCheckpoints(id: string): Promise<TeachingCheckpoint[] | undefined> {
  if (!(await workspaces.get(id))) return undefined;
  return workspaces.listCheckpoints(id);
}

// --- Chat ------------------------------------------------------------------

export async function sendChatMessage(
  id: string,
  content: string,
): Promise<ChatMessage | undefined> {
  const ws = await workspaces.get(id);
  if (!ws) return undefined;

  const userMsg: ChatMessage = {
    id: newId("msg"),
    sender: "user",
    content,
    createdAt: utcNowIso(),
  };
  await workspaces.addMessage(id, userMsg);
  await touch(ws);

  // The Learner replies asynchronously so the user's own bubble lands instantly;
  // the reply surfaces on the next getChatMessages poll.
  inBackground("chat reply", async () => {
    let reply: string;
    try {
      reply = await runChatReply(ws, content);
    } catch (err) {
      console.error("[workspace] chat reply failed:", err);
      reply = "Oh, sorry, I blanked for a second there... could you say that again?";
    }
    if (!(await stillExists(id))) return;
    const message = await workspaces.addMessage(id, learnerMessage(reply));
    await bump(id);

    // Same as the checkpoint path: the text does not wait on the voice.
    const learnerAudioUrl = await speakLearnerReply(id, reply);
    if (learnerAudioUrl && (await stillExists(id))) {
      await workspaces.updateMessage(id, message.id, { learnerAudioUrl });
      await bump(id);
    }
  });

  return userMsg;
}

export async function getChatMessages(id: string): Promise<ChatMessage[] | undefined> {
  if (!(await workspaces.get(id))) return undefined;
  return workspaces.listMessages(id);
}

// --- Evaluation ------------------------------------------------------------

export async function finishSession(id: string): Promise<boolean> {
  const ws = await workspaces.get(id);
  if (!ws) return false;
  // Idempotent: only a teaching workspace can be finished.
  if (ws.state !== "Teaching" && ws.state !== "Draft") return true;

  ws.state = "Evaluating";
  await touch(ws);

  inBackground("evaluation", async () => {
    try {
      await runEvaluation(ws);
    } catch (err) {
      console.error("[workspace] evaluation failed:", err);
    }
    if (!(await stillExists(id))) return;
    // Even on failure, surface a report so the debrief never dead-ends (§10).
    if (!(await workspaces.getReport(id))) {
      const session = await requireSession(ws);
      await workspaces.saveReport(
        id,
        buildEvaluationReport(emptyEvaluation(session.sessionId), {
          title: ws.title ?? "",
          turnCount: session.turnCount,
          learnerState: await sessions.getLearnerState(session.sessionId),
          meaningfulScore: false,
        }),
      );
    }
    await bump(id, { state: "Completed" });
  });

  return true;
}

export async function getReport(id: string) {
  return workspaces.getReport(id);
}

/**
 * Resume a finished workspace back into teaching (§4.2, §5.4). The transcript and
 * turn count carry over, and prior evaluations stay as history (the next finish
 * appends a fresh one). The Learner's mental model is re-seeded from the last
 * round's evaluation so the student now targets the user's real weak spots
 * (§4.3). Only a Completed workspace resumes.
 */
export async function resumeSession(id: string): Promise<Workspace | undefined> {
  const ws = await workspaces.get(id);
  if (!ws) return undefined;
  if (ws.state !== "Completed") return ws; // nothing to resume

  const session = await requireSession(ws);
  // EVALUATED/ENDED -> TEACHING. Direct move (the service owns workspace state),
  // keeping turnCount and evaluationIds intact.
  session.status = "TEACHING";
  session.endedAt = undefined;

  // Adaptive seeding (§4.3): re-aim the Learner at the weak spots the last
  // evaluation found, instead of carrying the old static misconceptions — so the
  // next round the student probes what the user actually got wrong/missed.
  const evaluation = await sessions.getLatestEvaluation(session.sessionId);
  if (evaluation) {
    await sessions.saveLearnerState(
      seedLearnerStateFromEvaluation(
        session.sessionId,
        evaluation,
        await sessions.getLearnerState(session.sessionId),
      ),
    );
  }

  await sessions.saveSession(session);
  ws.state = "Teaching";
  return touch(ws);
}

// --- Internals -------------------------------------------------------------

/** Shown in the chat when the session runs out of token budget (§7.3). The
 * workspace UI has no separate banner, so this speaks in the student's voice. */
const BUDGET_EXCEEDED_REPLY =
  "Waduh, sesi ini sudah mencapai batas token untuk babak ini. " +
  "Yuk akhiri dulu babak ini supaya aku bisa kasih evaluasinya.";

/**
 * What one teaching turn produced. `text` is always readable prose so a client
 * that ignores `errorKind` still shows something sensible; `errorKind` marks the
 * turns that ended in a handled condition rather than a real student reply.
 */
interface TurnReply {
  text: string;
  errorKind?: CheckpointErrorKind;
}

/** Run one teaching turn through the orchestrator, never pausing for confirmation. */
async function runTeachingTurn(
  ws: Workspace,
  input: { image: string; audio: string | null },
): Promise<TurnReply> {
  const session = await requireSession(ws);
  const topic = await synthTopic(ws);

  // The workspace UI has no confirmation step, so the planner is told not to
  // schedule one (§S5): an unsure board reading now gets one directed re-read
  // and then proceeds on Vision's best guess. This used to be a second full
  // teaching turn — the whole pipeline run twice for one checkpoint.
  const result = await getOrchestrator().runTeachingTurn(session, topic, {
    image: input.image,
    audio: input.audio,
    typedText: null,
    allowConfirmation: false,
  });

  // Only one orchestrator call now (the planner absorbed the retry), so one
  // budget check is enough -- the old second check guarded a retry that no
  // longer exists.
  if (result.kind === "budget_exceeded") {
    return { text: BUDGET_EXCEEDED_REPLY, errorKind: "budget_exceeded" };
  }

  return { text: result.response?.text ?? "Okay... go on, I'm following." };
}

/** Drive the Learner persona for a free-text chat message (no teaching turn saved). */
async function runChatReply(ws: Workspace, content: string): Promise<string> {
  const session = await requireSession(ws);
  const topic = await synthTopic(ws);

  const interpretation: VisionInterpretation = {
    snapshotId: `chat_${session.sessionId}`,
    transcribedText: content,
    elements: [],
    confidence: 1,
    needsConfirmation: false,
  };

  const state =
    (await sessions.getLearnerState(session.sessionId)) ??
    seedLearnerState(session.sessionId, [], { topicTitle: topic.title });

  const [response, nextState] = await chatLearner.respond({
    topicTitle: topic.title,
    topicDescription: topic.description,
    interpretation,
    speech: null,
    state,
    turnIndex: session.turnCount,
  });
  await sessions.saveLearnerState(nextState);
  return response.text;
}

/** End the round and run the Evaluator, then store the mapped debrief report. */
async function runEvaluation(ws: Workspace): Promise<void> {
  const session = await requireSession(ws);

  if (session.status === "TEACHING") session.status = "ENDED";
  session.endedAt = utcNowIso();
  await sessions.saveSession(session);

  // Same transcript projection the session REST layer feeds the Evaluator (§5.2).
  const rows = await sessions.listTurnsWithResponses(session.sessionId);
  const transcript: TranscriptTurn[] = rows.map(({ turn, response }) => ({
    turnIndex: turn.turnIndex,
    boardText: turn.interpretation.transcribedText,
    speech: turn.speechTranscript?.transcript || undefined,
    learnerUtterance: response?.text,
  }));

  const topic = await synthTopic(ws);
  const { referenceExcerpts, referenceOutline } = await retrieveReference(
    ws,
    transcript,
    topic,
  );

  const result = await getEvaluator().evaluate(
    {
      sessionId: session.sessionId,
      turns: transcript,
      // Only sent when retrieval produced nothing; excerpts take precedence.
      referenceMaterial: referenceExcerpts.length ? "" : topic.referenceMaterial,
      keyConcepts: topic.keyConcepts,
      commonMisconceptions: topic.commonMisconceptions,
      referenceExcerpts,
      referenceOutline,
    },
    newId("ev"),
  );
  await sessions.saveEvaluation(result);
  session.evaluationId = result.evaluationId;
  session.evaluationIds = (await sessions.listEvaluations(session.sessionId)).map(
    (e) => e.evaluationId,
  );
  session.status = "EVALUATED";
  await sessions.saveSession(session);

  // A synthesized workspace Topic has no key concepts, so the deterministic
  // offline evaluator can't produce a meaningful score — only a real LLM can.
  const usedMock = process.env.USE_MOCK_AI === "true" || !config.llmAvailable();

  await workspaces.saveReport(
    ws.id,
    buildEvaluationReport(result, {
      title: ws.title ?? "",
      turnCount: session.turnCount,
      learnerState: await sessions.getLearnerState(session.sessionId),
      meaningfulScore: !usedMock,
    }),
  );
}

/**
 * The retrieval step of the Evaluator's RAG path (§3.7).
 *
 * Searches this workspace's indexed reference for the passages relevant to what
 * the user actually taught, and returns them alongside an outline of the whole
 * document. A workspace with no PDF returns nothing, and the Evaluator falls
 * back to whatever full reference text the topic carries.
 */
async function retrieveReference(
  ws: Workspace,
  transcript: TranscriptTurn[],
  topic: Topic,
): Promise<{ referenceExcerpts: ReferenceExcerpt[]; referenceOutline: string[] }> {
  const empty = { referenceExcerpts: [], referenceOutline: [] };

  const text = await workspaces.getReference(ws.id);
  if (!text) return empty;

  // The upload indexes in the background; if the user finished before that
  // landed, build it now rather than silently grading against nothing.
  let index = await workspaces.getReferenceIndex(ws.id);
  if (!index) {
    index = await buildReferenceIndex(text);
    await workspaces.saveReferenceIndex(ws.id, index);
  }
  if (index.size === 0) return empty;

  const queries = queriesFromTranscript(transcript, topic.keyConcepts);
  const referenceExcerpts = await retrieveExcerpts(index, queries);
  if (referenceExcerpts.length === 0) return empty;

  console.log(
    `[workspace] retrieval untuk ${ws.id}: ${referenceExcerpts.length}/${index.size} bagian (mode ${index.mode})`,
  );
  return { referenceExcerpts, referenceOutline: buildOutline(index) };
}

/** Move a Draft workspace (and its Session) into the teaching loop. */
async function startTeaching(ws: Workspace): Promise<void> {
  ws.state = "Teaching";
  const session = await requireSession(ws);
  if (session.status === "SETUP") {
    session.status = "TEACHING";
    session.startedAt = utcNowIso();
    if (!(await sessions.getLearnerState(session.sessionId))) {
      const topic = await synthTopic(ws);
      await sessions.saveLearnerState(
        seedLearnerState(session.sessionId, topic.commonMisconceptions, {
          topicTitle: topic.title,
        }),
      );
    }
    await sessions.saveSession(session);
  }
}

/** Build the Topic the agents need from whatever metadata the workspace has. */
async function synthTopic(ws: Workspace): Promise<Topic> {
  return {
    topicId: ws.id,
    title: ws.title?.trim() || "Untitled session",
    description: ws.description?.trim() || "",
    // Grounding: the uploaded PDF's text becomes the Evaluator's answer key.
    referenceMaterial: (await workspaces.getReference(ws.id)) ?? "",
    keyConcepts: [],
    commonMisconceptions: [],
    difficulty: "medium",
  };
}

async function requireSession(ws: Workspace): Promise<Session> {
  const sessionId = await workspaces.sessionId(ws.id);
  const session = sessionId ? await sessions.getSession(sessionId) : undefined;
  if (!session) throw new Error(`No session backing workspace ${ws.id}`);
  return session;
}

function learnerMessage(content: string, learnerAudioUrl?: string): ChatMessage {
  return {
    id: newId("msg"),
    sender: "learner",
    content,
    learnerAudioUrl,
    createdAt: utcNowIso(),
  };
}

/**
 * Render a learner reply to speech and store it, returning the URL the UI can
 * play — or undefined when speech is off or the voice service is unavailable.
 *
 * The character is derived from the workspace id exactly as the frontend does,
 * so the voice always matches the face on screen.
 */
async function speakLearnerReply(
  workspaceId: string,
  text: string,
): Promise<string | undefined> {
  const speech = await synthesizeSpeech(text, ttsVoiceForWorkspace(workspaceId));
  if (!speech) return undefined;

  const audioId = newId("aud");
  await workspaces.saveAudioClip(workspaceId, audioId, {
    data: speech.audio,
    mime: speech.mime,
  });
  return `/api/workspaces/${workspaceId}/audio/${audioId}`;
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

function touch(ws: Workspace): Promise<Workspace> {
  ws.updatedAt = utcNowIso();
  return workspaces.save(ws);
}

/**
 * Run the agent work for a request that has already been answered.
 *
 * Nothing may escape one of these: the user can delete a workspace while its
 * teaching turn is still running, and the write that lands afterwards then fails
 * against a foreign key that no longer resolves. Unhandled, that rejection takes
 * down the process — so every background job is wrapped and its failure is
 * logged instead.
 */
function inBackground(label: string, job: () => Promise<void>): void {
  void job().catch((err) => {
    console.error(`[workspace] ${label} gagal di latar belakang:`, err);
  });
}

/**
 * Whether the workspace is still there before a background job writes to it.
 * A deleted workspace makes its in-flight turn moot: the reply is dropped rather
 * than resurrected. This only narrows the window — `inBackground` is what closes
 * it — but it keeps the ordinary delete-while-thinking case out of the log.
 */
async function stillExists(id: string): Promise<boolean> {
  return Boolean(await workspaces.get(id));
}

/**
 * Touch a workspace by id, re-reading it first.
 *
 * The background jobs (a teaching turn, a chat reply, an evaluation) finish long
 * after the request that started them, and the workspace may have been edited in
 * the meantime. Writing back the copy they captured would silently undo that
 * edit — so they re-read, apply only their own change, and save.
 */
async function bump(id: string, patch: Partial<Workspace> = {}): Promise<void> {
  const fresh = await workspaces.get(id);
  if (!fresh) return;
  await touch({ ...fresh, ...patch });
}

function dataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`;
}
