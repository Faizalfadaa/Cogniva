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
  'Hmm... jadi maksudnya tuh...?',
  'Oh! Aku nangkep yang bagian awal, tapi yang tengah masih belum jelas deh...',
  'Wait, itu tadi kenapa bisa gitu? Bisa diulangin?',
  'Ohhh... *tulis-tulis* ...gini ya?',
  'Eh, terus kalau kasusnya beda gimana? Misalnya kalau inputnya kosong?',
  '...Aku ngerti sih, tapi rasanya ada yang kelewat. Lanjut dulu?',
  'Interesting... aku belum pernah liat yang kayak gitu sebelumnya.',
  '...Mmm. Boleh lihat contoh yang lain?',
];

function randomReaction(): string {
  return LEARNER_REACTIONS[Math.floor(Math.random() * LEARNER_REACTIONS.length)];
}

// ---------------------------------------------------------------------------
// Evaluation report generator
// ---------------------------------------------------------------------------

function generateMockReport(workspaceId: string): EvaluationReportDTO {
  const checkpoints = store.checkpoints.get(workspaceId) ?? [];
  const count = checkpoints.length;

  const learned =
    count > 0
      ? ['Konsep dasar yang dijelaskan', 'Alur pemikiran utama', 'Contoh yang diberikan']
      : [];

  const stillConfused =
    count < 3
      ? ['Edge case belum dibahas', 'Koneksi antar konsep masih kabur']
      : ['Edge case tertentu', 'Detail implementasi lanjutan'];

  return {
    letter: `Haii, ${now().slice(0, 10)}...\n\nMakasih banget udah ngajar aku hari ini. Aku beneran berusaha ngerti semua yang kamu jelasin, dan... lumayan banyak yang nyantol! Terutama bagian awal — kamu jelasinnya runtut banget dan aku suka.\n\nTapi jujur, ada beberapa bagian yang aku masih bingung. Bukan salah kamu sih, kayaknya otak aku aja yang butuh waktu lebih. Mau ngajar aku lagi kapan-kapan?\n\nSampai ketemu lagi ya~\n— Learner-mu`,
    notebook: {
      learned,
      stillConfused,
      reflection:
        count >= 2
          ? 'Penjelasan runtut dan ada contoh konkret. Diagram membantu banget. Edge case bisa jadi bahan sesi berikutnya.'
          : 'Sesi ini singkat, tapi fondasi awalnya udah keliatan. Lanjut lebih dalam di sesi berikutnya!',
    },
    continueLearning:
      count > 0
        ? ['Topik lanjutan A', 'Topik lanjutan B', 'Variasi / edge case dari topik ini']
        : ['Mulai dari konsep dasar', 'Coba praktik dengan contoh sederhana'],
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
    store.messages.set(id, []); // kosong — UI yang isi first messages setelah ini
    return workspace;
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
      const msgs = store.messages.get(workspaceId) ?? [];
      msgs.push({
        id: uuid(),
        sender: 'learner',
        content: randomReaction(),
        createdAt: now(),
      });
      store.messages.set(workspaceId, msgs);

      const checkpoints = store.checkpoints.get(workspaceId) ?? [];
      const idx = checkpoints.findIndex((c) => c.id === checkpoint.id);
      if (idx !== -1) {
        checkpoints[idx] = { ...checkpoints[idx], learnerResponse: randomReaction() };
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
}