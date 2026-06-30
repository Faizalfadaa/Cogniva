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
  const ws = store.workspaces.get(workspaceId);
  const topic = ws?.title || 'topik ini';
  const count = checkpoints.length;

  const learned =
    count > 0
      ? [
          'Konsep utama yang kamu jelaskan di awal sesi',
          'Alur pemikiran step-by-step yang kamu gambar di whiteboard',
          'Contoh konkret yang kamu berikan — itu yang paling bikin aku "oh!"',
        ]
      : ['Pengenalan awal topik'];

  const stillConfused =
    count < 2
      ? [
          'Koneksi antara konsep pertama dan kedua masih agak kabur',
          'Edge case — belum sempat dibahas',
        ]
      : [
          'Detail implementasi di kasus khusus',
          'Kenapa pendekatan ini lebih baik dari alternatifnya',
          'Aku masih ragu soal batasan / limitasi-nya',
        ];

  const date = now().slice(0, 10);

  return {
    letter: `Haii!\n\nMakasih banget udah ngajarin aku soal ${topic} tadi. Serius, aku beneran berusaha ngerti semua yang kamu jelasin — dan lumayan banyak yang nyantol!\n\nYang paling aku suka, kamu nggak langsung loncat ke hal yang rumit. Kamu mulai dari yang dasar dulu, pelan-pelan, sampai aku bisa bayangin gambaran besarnya. Diagram di whiteboard-nya juga ngebantu banget — kadang lihat tulisan/gambar langsung lebih masuk daripada dengerin penjelasan doang.\n\nJujur sih, ada beberapa bagian yang aku masih perlu waktu buat nyerap. Bukan salah kamu — kayaknya otak aku aja yang butuh diulang beberapa kali hehe. Tapi overall, sesi ini kerasa progress banget.\n\nKapan-kapan ngajar aku lagi ya? Aku mau tau kelanjutannya!\n\nSampai ketemu lagi~\n— Learner-mu 🌱\n\n(${date})`,
    notebook: {
      learned,
      stillConfused,
      reflection:
        count >= 3
          ? 'Penjelasan kamu runtut dan ada contoh konkret di tiap bagian — itu yang bikin aku gampang ngikutin. Kalau next time bisa bahas edge case-nya juga, pasti makin lengkap!'
          : count >= 1
          ? 'Fondasi awalnya udah kena. Rasanya kalau sesi-nya lebih panjang lagi aku bisa nangkep lebih banyak. Diagram di whiteboard sangat membantu!'
          : 'Sesi ini singkat, tapi aku nangkep arahnya ke mana. Lanjut lebih dalam di sesi berikutnya ya!',
    },
    continueLearning:
      count > 0
        ? [
            `${topic} — kasus lanjutan & edge case`,
            'Perbandingan dengan pendekatan alternatif',
            'Implementasi nyata / contoh di dunia nyata',
          ]
        : ['Teori VSEPR', 'Diagram Orbital Molekul'],
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