import type { CognivaBridge } from './CognivaBridge';
import type { WorkspaceDTO } from '../dto/WorkspaceDTO';
import type { TeachingCheckpointDTO } from '../dto/TeachingCheckpointDTO';
import type { ChatMessageDTO } from '../dto/ChatMessageDTO';
import type { EvaluationReportDTO } from '../dto/EvaluationReportDTO';

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
  reports: Map<string, EvaluationReportDTO>;
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

function generateMockReport(workspaceId: string): EvaluationReportDTO {
  const checkpoints = store.checkpoints.get(workspaceId) ?? [];
  const ws = store.workspaces.get(workspaceId);
  const topic = ws?.title || 'this topic';
  const count = checkpoints.length;

  const learned =
    count > 0
      ? [
          'The main concept you explained early in the session',
          'The step-by-step reasoning you drew on the whiteboard',
          'The concrete example you gave — that\'s what made it click for me',
        ]
      : ['A first introduction to the topic'];

  const stillConfused =
    count < 2
      ? [
          'The connection between the first and second concepts is still a bit fuzzy',
          'Edge cases — we didn\'t get to them yet',
        ]
      : [
          'Implementation details in special cases',
          'Why this approach is better than the alternatives',
          'I\'m still unsure about its limits / limitations',
        ];

  const date = now().slice(0, 10);

  return {
    letter: `Hi!\n\nThank you so much for teaching me about ${topic} earlier. Seriously, I really tried to understand everything you explained — and a lot of it clicked!\n\nWhat I liked most is that you didn't jump straight to the hard stuff. You started from the basics, slowly, until I could picture the big picture. The whiteboard diagrams helped a ton too — sometimes seeing it written/drawn lands better than just hearing it.\n\nHonestly, there are a few parts I still need time to absorb. It's not your fault — I think my brain just needs a few repeats, haha. But overall, this session felt like real progress.\n\nTeach me again sometime, okay? I want to know what comes next!\n\nSee you again~\n— Your learner 🌱\n\n(${date})`,
    notebook: {
      learned,
      stillConfused,
      reflection:
        count >= 3
          ? 'Your explanation flowed well and had a concrete example in each part — that\'s what made it easy to follow. If you can cover the edge cases next time, it\'ll be even more complete!'
          : count >= 1
          ? 'The foundation is there. I feel like with a longer session I could catch even more. The whiteboard diagrams were a big help!'
          : 'This session was short, but I caught where it was heading. Let\'s go deeper next time!',
    },
    continueLearning:
      count > 0
        ? [
            `${topic} — advanced cases & edge cases`,
            'Comparison with alternative approaches',
            'Real implementations / real-world examples',
          ]
        : ['VSEPR Theory', 'Molecular Orbital Diagrams'],
  };
}

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

  async createWorkspace(): Promise<WorkspaceDTO> {
    await delay(300);
    const id = uuid();
    const workspace: WorkspaceDTO = {
      id,
      state: 'Draft',
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
    meta: { title?: string; description?: string }
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
    const updated: WorkspaceDTO = { ...ws, pdfUrl, updatedAt: now() };
    store.workspaces.set(workspaceId, updated);
    return { ...updated };
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
      snapshotImage: Blob;
      whiteboardSnapshot: unknown;
      audio?: Blob;
    }
  ): Promise<TeachingCheckpointDTO> {
    await delay(1200);

    const snapshotImageUrl = URL.createObjectURL(payload.snapshotImage);
    const audioUrl = payload.audio ? URL.createObjectURL(payload.audio) : undefined;

    const checkpoint: TeachingCheckpointDTO = {
      id: uuid(),
      snapshotImageUrl,
      whiteboardSnapshot: payload.whiteboardSnapshot,
      audioUrl,
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
      store.reports.set(workspaceId, generateMockReport(workspaceId));
      store.evaluationTimers.delete(workspaceId);
    }, 5000);

    store.evaluationTimers.set(workspaceId, timer);
  }

  async getEvaluationReport(workspaceId: string): Promise<EvaluationReportDTO> {
    await delay(200);
    const report = store.reports.get(workspaceId);
    if (!report) throw new Error(`[Mock] Report not ready for workspace: ${workspaceId}`);
    return { ...report };
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