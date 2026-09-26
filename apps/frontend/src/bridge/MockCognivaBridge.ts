import type { CognivaBridge } from './CognivaBridge';
import type { WorkspaceDTO } from '../dto/WorkspaceDTO';
import type { Locale } from '../i18n/messages';
import type { TeachingCheckpointDTO } from '../dto/TeachingCheckpointDTO';
import type { ChatMessageDTO } from '../dto/ChatMessageDTO';
import type {
  EvaluationReportDTO,
  EvaluationRoundSummaryDTO,
  ScoreHistoryPointDTO,
} from '../dto/EvaluationReportDTO';
import type { TimelineDTO } from '../dto/TimelineDTO';
import type {
  ReferenceSuggestionsDTO,
  SaveReferenceTextResultDTO,
  UseReferenceResultDTO,
} from '../dto/ReferenceDTO';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function delay(ms = 600): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

interface MockStore {
  workspaces: Map<string, WorkspaceDTO>;
  checkpoints: Map<string, TeachingCheckpointDTO[]>;
  messages: Map<string, ChatMessageDTO[]>;
  /** Rounds per workspace, oldest first — mirrors the real per-round store. */
  reports: Map<string, EvaluationReportDTO[]>;
  evaluationTimers: Map<string, ReturnType<typeof setTimeout>>;
}

const store: MockStore = {
  workspaces: new Map(),
  checkpoints: new Map(),
  messages: new Map(),
  reports: new Map(),
  evaluationTimers: new Map(),
};

// ---------------------------------------------------------------------------
// Mock learner response pool
// ---------------------------------------------------------------------------

const LEARNER_REACTIONS = [
  'Hmm... so what you mean is...?',
  'Oh! I caught the first part, but the middle is still unclear...',
  'Wait, why did that happen? Could you repeat it?',
  'Ohhh... *scribbles* ...like this?',
  'Hmm, and what if the case is different? Like if the input is empty?',
  "...I think I get it, but it feels like I missed something. Keep going?",
  'Interesting... I have never seen anything like that before.',
  '...Mmm. Could I see another example?',
];

function randomReaction(): string {
  return LEARNER_REACTIONS[Math.floor(Math.random() * LEARNER_REACTIONS.length)];
}

// ---------------------------------------------------------------------------
// Evaluation report generator
// ---------------------------------------------------------------------------

/** Everything but the round's place in the history, which the caller assigns. */
function generateMockReport(
  workspaceId: string,
): Omit<EvaluationReportDTO, 'round' | 'createdAt'> {
  const checkpoints = store.checkpoints.get(workspaceId) ?? [];
  const ws = store.workspaces.get(workspaceId);
  const topic = ws?.title || 'this topic';
  const count = checkpoints.length;

  const learned =
    count > 0
      ? [
          'The main concept you explained early in the session',
          'The step-by-step reasoning you drew on the whiteboard',
          'The concrete example you gave, that\'s what made it click for me',
        ]
      : ['A first introduction to the topic'];

  const stillConfused =
    count < 2
      ? [
          'The connection between the first and second concepts is still a bit fuzzy',
          'Edge cases, we didn\'t get to them yet',
        ]
      : [
          'Implementation details in special cases',
          'Why this approach is better than the alternatives',
          'I\'m still unsure about its limits / limitations',
        ];

  const date = now().slice(0, 10);

  return {
    letter: `Hi!\n\nThank you so much for teaching me about ${topic} earlier. Seriously, I really tried to understand everything you explained, and a lot of it clicked!\n\nWhat I liked most is that you didn't jump straight to the hard stuff. You started from the basics, slowly, until I could picture the big picture. The whiteboard diagrams helped a ton too. Sometimes seeing it written or drawn lands better than just hearing it.\n\nHonestly, there are a few parts I still need time to absorb. It's not your fault. I think my brain just needs a few repeats, haha. But overall, this session felt like real progress.\n\nTeach me again sometime, okay? I want to know what comes next!\n\nSee you again,
Your learner

(${date})`,
    notebook: {
      learned,
      stillConfused,
      reflection:
        count >= 3
          ? 'Your explanation flowed well and had a concrete example in each part, that\'s what made it easy to follow. If you can cover the edge cases next time, it\'ll be even more complete!'
          : count >= 1
          ? 'The foundation is there. I feel like with a longer session I could catch even more. The whiteboard diagrams were a big help!'
          : 'This session was short, but I caught where it was heading. Let\'s go deeper next time!',
    },
    continueLearning:
      count > 0
        ? [
            `${topic}: advanced cases and edge cases`,
            'Comparison with alternative approaches',
            'Real implementations / real-world examples',
          ]
        : ['VSEPR Theory', 'Molecular Orbital Diagrams'],
    score: count > 0 ? Math.min(95, 55 + count * 10) : 0,
    // Deliberately below score: the mock teacher names things correctly without
    // explaining the mechanism, which is exactly the gap depthScore exists for.
    depthScore: count > 0 ? Math.min(70, 25 + count * 8) : 0,
    findings: mockFindings,
    // Always both turns: the findings below cite turn 1, and trimming the
    // transcript to the checkpoint count would leave them pointing at a turn
    // this report does not contain.
    transcript: mockTranscript,
  };
}

/**
 * A board that the findings below can actually be highlighted against. The
 * quotes are exact substrings of these turns, which is the same contract the
 * backend guard enforces on the real Evaluator.
 */
const mockTranscript = [
  {
    turnIndex: 0,
    boardText: 'Photosynthesis converts light, water and CO2 into glucose and oxygen.',
  },
  {
    turnIndex: 1,
    // The whole board by now, with the line this turn added read on its own.
    boardText:
      'Photosynthesis converts light, water and CO2 into glucose and oxygen.\n' +
      'The light reactions run in the thylakoid membrane and make ATP.',
    newBoardText: 'The light reactions run in the thylakoid membrane and make ATP.',
    speech: 'The oxygen released comes from splitting water, not from the CO2.',
    // A concept the user only ever explained in the chat panel, which is
    // exactly the case the Detail tab used to show nothing for.
    chat: [
      {
        sender: 'learner' as const,
        text: 'Wait, so is ATP the sugar the plant keeps?',
      },
      {
        sender: 'user' as const,
        text: 'No, ATP is the battery that powers the reaction. The sugar is glucose.',
      },
    ],
  },
];

const mockFindings: EvaluationReportDTO['findings'] = [
  {
    category: 'CORRECT',
    concept: 'Inputs and outputs',
    detail: 'You named every input and output of the reaction accurately.',
    evidenceTurnIndex: 0,
    sourceQuote: 'converts light, water and CO2 into glucose and oxygen',
  },
  {
    category: 'CONFUSING',
    concept: 'Where the oxygen comes from',
    detail: 'You said it twice in two different ways, which left me unsure.',
    evidenceTurnIndex: 1,
    sourceQuote: 'comes from splitting water, not from the CO2',
    followUp: 'Say it once, in one direction: water is split, and the oxygen released comes from that water.',
  },
  {
    // Quoted from the chat, not the board: the one place this was explained.
    category: 'CORRECT',
    concept: 'What ATP is for',
    detail: 'You caught the mix-up the moment I asked and drew the line cleanly.',
    evidenceTurnIndex: 1,
    sourceQuote: 'ATP is the battery that powers the reaction',
  },
  {
    // No sourceQuote: stands in for a finding whose quote the backend guard
    // rejected, so the UI falls back to marking the whole turn.
    category: 'WRONG',
    concept: 'Where glucose is built',
    detail: 'The sugar is assembled in the stroma, not in the thylakoid membrane.',
    evidenceTurnIndex: 1,
    followUp: 'Separate the two stages next time: the membrane makes ATP, the stroma builds the sugar.',
  },
  {
    category: 'MISSED',
    concept: 'The Calvin cycle',
    detail: 'We never got to how the sugar is actually built.',
    evidenceTurnIndex: null,
    followUp: 'Open the next session with the Calvin cycle and walk through how carbon becomes sugar.',
  },
];

// ---------------------------------------------------------------------------
// MockCognivaBridge
// Tidak tahu userName. Tidak tahu learner. Tidak tahu first messages.
// Semua itu urusan UI — selesai di layer teaching-session setelah createWorkspace resolve.
// ---------------------------------------------------------------------------

export class MockCognivaBridge implements CognivaBridge {
  // ── Home ─────────────────────────────────────────────────────────────────

  async listWorkspaces(): Promise<WorkspaceDTO[]> {
    await delay(400);
    return Array.from(store.workspaces.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async createWorkspace(locale: Locale): Promise<WorkspaceDTO> {
    await delay(300);
    const id = uuid();
    const workspace: WorkspaceDTO = {
      id,
      state: 'Draft',
      locale,
      createdAt: now(),
      updatedAt: now(),
    };
    store.workspaces.set(id, workspace);
    store.checkpoints.set(id, []);
    store.messages.set(id, []); // empty — the UI fills in the first messages after this
    return workspace;
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await delay(300);
    const timer = store.evaluationTimers.get(workspaceId);
    if (timer) clearTimeout(timer);
    store.evaluationTimers.delete(workspaceId);
    store.workspaces.delete(workspaceId);
    store.checkpoints.delete(workspaceId);
    store.messages.delete(workspaceId);
    store.reports.delete(workspaceId);
  }

  // ── Workspace meta ────────────────────────────────────────────────────────

  async getWorkspace(workspaceId: string): Promise<WorkspaceDTO> {
    await delay(200);
    const ws = store.workspaces.get(workspaceId);
    if (!ws) throw new Error(`[Mock] Workspace not found: ${workspaceId}`);
    return { ...ws };
  }

  async updateWorkspaceMeta(
    workspaceId: string,
    meta: { title?: string; description?: string; learnerId?: string }
  ): Promise<WorkspaceDTO> {
    await delay(200);
    const ws = store.workspaces.get(workspaceId);
    if (!ws) throw new Error(`[Mock] Workspace not found: ${workspaceId}`);
    const updated: WorkspaceDTO = { ...ws, ...meta, updatedAt: now() };
    store.workspaces.set(workspaceId, updated);
    return { ...updated };
  }

  async uploadWorkspacePdf(workspaceId: string, file: File): Promise<WorkspaceDTO> {
    await delay(800);
    const ws = store.workspaces.get(workspaceId);
    if (!ws) throw new Error(`[Mock] Workspace not found: ${workspaceId}`);
    const pdfUrl = URL.createObjectURL(file);
    // One answer key per session: an upload replaces whatever was found before.
    const updated: WorkspaceDTO = { ...ws, pdfUrl, referenceSource: undefined, updatedAt: now() };
    store.workspaces.set(workspaceId, updated);
    return { ...updated };
  }

  async saveReferenceText(
    workspaceId: string,
    text: string
  ): Promise<SaveReferenceTextResultDTO> {
    await delay(300);
    const ws = store.workspaces.get(workspaceId);
    if (!ws) throw new Error(`[Mock] Workspace not found: ${workspaceId}`);
    // Pasted text carries no provenance, so any chip from an earlier source goes.
    const updated: WorkspaceDTO = { ...ws, referenceSource: undefined, updatedAt: now() };
    store.workspaces.set(workspaceId, updated);
    return { workspace: { ...updated }, chars: text.trim().length };
  }

  // Mirrors the backend's offline fallback: entry points into open libraries,
  // pre-filtered to the topic, never an invented document title. Same honesty
  // rule as the server — a fabricated link looks authoritative and leads nowhere.
  async suggestReferences(workspaceId: string, hint?: string): Promise<ReferenceSuggestionsDTO> {
    await delay(900);
    const ws = store.workspaces.get(workspaceId);
    const topic = ws?.title?.trim() || 'this topic';
    const query = encodeURIComponent([topic, hint].filter(Boolean).join(' ').trim());

    return {
      topic,
      source: 'offline',
      notice:
        'Mock mode: these are entry points into open libraries, not specific document titles.',
      options: [
        // Mirrors the backend's offline list, source policy included: no
        // open-edit wiki appears here either, or the mock would show a card the
        // real agent is no longer able to produce.
        {
          id: 'openstax-1',
          title: `OpenStax — open textbook on ${topic}`,
          url: `https://openstax.org/search?q=${query}`,
          source: 'OpenStax',
          kind: 'pdf',
          summary: 'Free university textbooks, available as a PDF per chapter.',
          whyRelevant: 'The best option when you need a downloadable PDF.',
          verified: false,
          trust: 'high',
        },
        {
          id: 'libretexts-2',
          title: `LibreTexts — textbook chapter on ${topic}`,
          url: `https://libretexts.org/search.html?q=${query}`,
          source: 'LibreTexts',
          kind: 'book',
          summary: 'Open textbooks run by a consortium of universities.',
          whyRelevant: 'University-level depth, broken down by section.',
          verified: false,
          trust: 'high',
        },
        {
          id: 'britannica-3',
          title: `Encyclopaedia Britannica: ${topic}`,
          url: `https://www.britannica.com/search?query=${query}`,
          source: 'Encyclopaedia Britannica',
          kind: 'article',
          summary: 'Encyclopedia articles that are editorially reviewed and carry a named author.',
          whyRelevant: 'Broad coverage, a good opening framework.',
          verified: false,
          trust: 'medium',
        },
      ],
    };
  }

  async useReference(
    workspaceId: string,
    choice: { url: string; title?: string; source?: string }
  ): Promise<UseReferenceResultDTO> {
    await delay(1200);
    const ws = store.workspaces.get(workspaceId);
    if (!ws) throw new Error(`[Mock] Workspace not found: ${workspaceId}`);

    const text = `Mock reference notes from ${choice.url}`;
    store.workspaces.set(workspaceId, {
      ...ws,
      referenceSource: {
        url: choice.url,
        title: choice.title ?? 'Referensi',
        source: choice.source ?? 'mock',
      },
      updatedAt: now(),
    });
    return { ok: true, problem: '', chars: text.length };
  }

  async saveWhiteboardDraft(
    workspaceId: string,
    payload: { snapshot: unknown; thumbnail?: Blob }
  ): Promise<WorkspaceDTO> {
    await delay(100);
    const ws = store.workspaces.get(workspaceId);
    if (!ws) throw new Error(`[Mock] Workspace not found: ${workspaceId}`);
    const updated: WorkspaceDTO = {
      ...ws,
      currentWhiteboardSnapshot: payload.snapshot,
      thumbnailUrl: payload.thumbnail ? URL.createObjectURL(payload.thumbnail) : ws.thumbnailUrl,
      state: ws.state === 'Draft' ? 'Teaching' : ws.state,
      updatedAt: now(),
    };
    store.workspaces.set(workspaceId, updated);
    return { ...updated };
  }

  // ── Teaching session ──────────────────────────────────────────────────────

  async submitCheckpoint(
    workspaceId: string,
    payload: {
      snapshotImage: Blob | null;
      whiteboardSnapshot: unknown;
      audio?: Blob;
      timeline?: TimelineDTO;
      newContentImage?: Blob;
    }
  ): Promise<TeachingCheckpointDTO> {
    await delay(1200);

    // Empty for a voice-only turn, matching what the real backend stores.
    const snapshotImageUrl = payload.snapshotImage
      ? URL.createObjectURL(payload.snapshotImage)
      : '';
    const audioUrl = payload.audio ? URL.createObjectURL(payload.audio) : undefined;

    const checkpoint: TeachingCheckpointDTO = {
      id: uuid(),
      snapshotImageUrl,
      whiteboardSnapshot: payload.whiteboardSnapshot,
      audioUrl,
      // Echoed back like the real backend does — stored, never read (Phase 1).
      timeline: payload.timeline,
      learnerResponse: undefined,
      createdAt: now(),
    };

    const list = store.checkpoints.get(workspaceId) ?? [];
    list.push(checkpoint);
    store.checkpoints.set(workspaceId, list);

    setTimeout(() => {
      // Use the same reaction string for both the chat message and the checkpoint
      // response — they represent the same learner reply.
      const reaction = randomReaction();

      const msgs = store.messages.get(workspaceId) ?? [];
      msgs.push({
        id: uuid(),
        sender: 'learner',
        content: reaction,
        createdAt: now(),
      });
      store.messages.set(workspaceId, msgs);

      const checkpoints = store.checkpoints.get(workspaceId) ?? [];
      const idx = checkpoints.findIndex((c) => c.id === checkpoint.id);
      if (idx !== -1) {
        checkpoints[idx] = { ...checkpoints[idx], learnerResponse: reaction };
        store.checkpoints.set(workspaceId, checkpoints);
      }
    }, 2000);

    return { ...checkpoint };
  }

  async getCheckpoints(workspaceId: string): Promise<TeachingCheckpointDTO[]> {
    await delay(200);
    return [...(store.checkpoints.get(workspaceId) ?? [])];
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  async sendChatMessage(workspaceId: string, content: string): Promise<ChatMessageDTO> {
    await delay(150);
    const userMsg: ChatMessageDTO = {
      id: uuid(),
      sender: 'user',
      content,
      createdAt: now(),
    };
    const msgs = store.messages.get(workspaceId) ?? [];
    msgs.push(userMsg);
    store.messages.set(workspaceId, msgs);

    setTimeout(() => {
      const current = store.messages.get(workspaceId) ?? [];
      current.push({
        id: uuid(),
        sender: 'learner',
        content: randomReaction(),
        createdAt: now(),
      });
      store.messages.set(workspaceId, current);
    }, 1500);

    return { ...userMsg };
  }

  async getChatMessages(workspaceId: string): Promise<ChatMessageDTO[]> {
    await delay(150);
    return [...(store.messages.get(workspaceId) ?? [])];
  }

  // ── Evaluation ────────────────────────────────────────────────────────────

  async finishSession(workspaceId: string): Promise<void> {
    await delay(300);
    const ws = store.workspaces.get(workspaceId);
    if (!ws) throw new Error(`[Mock] Workspace not found: ${workspaceId}`);

    store.workspaces.set(workspaceId, { ...ws, state: 'Evaluating', updatedAt: now() });

    const timer = setTimeout(() => {
      const current = store.workspaces.get(workspaceId);
      if (!current || current.state !== 'Evaluating') return;
      store.workspaces.set(workspaceId, { ...current, state: 'Completed', updatedAt: now() });
      // Appended, like the real store: finishing a resumed session adds a round
      // rather than replacing the debrief the previous one produced.
      const rounds = store.reports.get(workspaceId) ?? [];
      rounds.push({
        ...generateMockReport(workspaceId),
        round: rounds.length + 1,
        createdAt: now(),
      });
      store.reports.set(workspaceId, rounds);
      store.evaluationTimers.delete(workspaceId);
    }, 5000);

    store.evaluationTimers.set(workspaceId, timer);
  }

  async getEvaluationReport(
    workspaceId: string,
    round?: number,
  ): Promise<EvaluationReportDTO> {
    await delay(200);
    const rounds = store.reports.get(workspaceId);
    if (!rounds?.length) {
      throw new Error(`[Mock] Report not ready for workspace: ${workspaceId}`);
    }
    const report =
      round === undefined ? rounds[rounds.length - 1] : rounds.find((r) => r.round === round);
    if (!report) throw new Error(`[Mock] No round ${round} for workspace: ${workspaceId}`);
    return { ...report };
  }

  async getEvaluationRounds(workspaceId: string): Promise<EvaluationRoundSummaryDTO[]> {
    await delay(120);
    return (store.reports.get(workspaceId) ?? []).map((report) => ({
      round: report.round,
      score: report.score,
      depthScore: report.depthScore,
      findingCount: report.findings.length,
      createdAt: report.createdAt,
    }));
  }

  /** Every round the mock has produced this session, oldest first. */
  async getScoreHistory(): Promise<ScoreHistoryPointDTO[]> {
    await delay(120);
    const points: ScoreHistoryPointDTO[] = [];
    for (const [workspaceId, rounds] of store.reports) {
      const ws = store.workspaces.get(workspaceId);
      if (!ws) continue;
      for (const report of rounds) {
        points.push({
          workspaceId,
          round: report.round,
          title: ws.title ?? null,
          score: report.score,
          completedAt: report.createdAt,
        });
      }
    }
    return points.sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
    );
  }

  async resumeSession(workspaceId: string): Promise<WorkspaceDTO> {
    await delay(200);
    const ws = store.workspaces.get(workspaceId);
    if (!ws) throw new Error(`[Mock] Workspace not found: ${workspaceId}`);
    const updated: WorkspaceDTO = { ...ws, state: 'Teaching', updatedAt: now() };
    store.workspaces.set(workspaceId, updated);
    return { ...updated };
  }
}