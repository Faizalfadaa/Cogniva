import type { CognivaBridge } from './CognivaBridge';
import type { WorkspaceDTO } from '../dto/WorkspaceDTO';
import type { TeachingCheckpointDTO } from '../dto/TeachingCheckpointDTO';
import type { ChatMessageDTO } from '../dto/ChatMessageDTO';
import type { EvaluationReportDTO } from '../dto/EvaluationReportDTO';

// ---------------------------------------------------------------------------
// RealCognivaBridge — talks to the Fastify backend (§7.1) over plain REST.
//
// The backend's workspace endpoints return exactly the DTO shapes below, so this
// is a thin fetch wrapper: no field remapping. Blobs (board snapshot, audio) are
// base64-encoded into the JSON body; the heavy calls return immediately and the
// learner reply / evaluation arrive via the callers' existing polling.
// ---------------------------------------------------------------------------

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

function getJson<T>(path: string): Promise<T> {
  return fetch(`${BASE}${path}`).then(json<T>);
}

function sendJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  // Only attach the JSON content-type when there's actually a body — Fastify
  // rejects an empty body sent with `Content-Type: application/json` (400
  // FST_ERR_CTP_EMPTY_JSON_BODY), which is exactly the no-body POST that
  // createWorkspace() / finishSession() make.
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return fetch(`${BASE}${path}`, init).then(json<T>);
}

/** Read a Blob as a `data:<mime>;base64,<data>` URL (handles large blobs). */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Split a Blob into raw base64 (no data-URL prefix) + its mime type. */
async function blobToBase64(blob: Blob): Promise<{ data: string; mime: string }> {
  const dataUrl = await blobToDataUrl(blob);
  const comma = dataUrl.indexOf(',');
  return {
    data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
    mime: blob.type || 'application/octet-stream',
  };
}

export class RealCognivaBridge implements CognivaBridge {
  // ── Home ───────────────────────────────────────────────────────────────

  listWorkspaces(): Promise<WorkspaceDTO[]> {
    return getJson<WorkspaceDTO[]>('/api/workspaces');
  }

  createWorkspace(): Promise<WorkspaceDTO> {
    return sendJson<WorkspaceDTO>('/api/workspaces', 'POST');
  }

  // ── Workspace meta ───────────────────────────────────────────────────────

  getWorkspace(workspaceId: string): Promise<WorkspaceDTO> {
    return getJson<WorkspaceDTO>(`/api/workspaces/${workspaceId}`);
  }

  updateWorkspaceMeta(
    workspaceId: string,
    meta: { title?: string; description?: string }
  ): Promise<WorkspaceDTO> {
    return sendJson<WorkspaceDTO>(`/api/workspaces/${workspaceId}`, 'PATCH', meta);
  }

  async uploadWorkspacePdf(workspaceId: string, file: File): Promise<WorkspaceDTO> {
    const { data, mime } = await blobToBase64(file);
    return sendJson<WorkspaceDTO>(`/api/workspaces/${workspaceId}/pdf`, 'POST', {
      data,
      mime: mime === 'application/octet-stream' ? 'application/pdf' : mime,
    });
  }

  async saveWhiteboardDraft(
    workspaceId: string,
    payload: { snapshot: unknown; thumbnail?: Blob }
  ): Promise<WorkspaceDTO> {
    const thumbnail = payload.thumbnail ? await blobToDataUrl(payload.thumbnail) : undefined;
    return sendJson<WorkspaceDTO>(`/api/workspaces/${workspaceId}/draft`, 'PUT', {
      snapshot: payload.snapshot,
      thumbnail,
    });
  }

  // ── Teaching session ──────────────────────────────────────────────────────

  async submitCheckpoint(
    workspaceId: string,
    payload: { snapshotImage: Blob; whiteboardSnapshot: unknown; audio?: Blob }
  ): Promise<TeachingCheckpointDTO> {
    const image = await blobToBase64(payload.snapshotImage);
    const audio = payload.audio ? await blobToBase64(payload.audio) : undefined;
    return sendJson<TeachingCheckpointDTO>(
      `/api/workspaces/${workspaceId}/checkpoints`,
      'POST',
      {
        snapshotImage: image.data,
        snapshotMime: image.mime === 'application/octet-stream' ? 'image/png' : image.mime,
        whiteboardSnapshot: payload.whiteboardSnapshot,
        audio: audio?.data,
        audioMime: audio?.mime,
      }
    );
  }

  getCheckpoints(workspaceId: string): Promise<TeachingCheckpointDTO[]> {
    return getJson<TeachingCheckpointDTO[]>(`/api/workspaces/${workspaceId}/checkpoints`);
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  sendChatMessage(workspaceId: string, content: string): Promise<ChatMessageDTO> {
    return sendJson<ChatMessageDTO>(`/api/workspaces/${workspaceId}/messages`, 'POST', {
      content,
    });
  }

  getChatMessages(workspaceId: string): Promise<ChatMessageDTO[]> {
    return getJson<ChatMessageDTO[]>(`/api/workspaces/${workspaceId}/messages`);
  }

  // ── Evaluation ────────────────────────────────────────────────────────────

  async finishSession(workspaceId: string): Promise<void> {
    const res = await fetch(`${BASE}/api/workspaces/${workspaceId}/finish`, { method: 'POST' });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText}: ${detail}`);
    }
  }

  getEvaluationReport(workspaceId: string): Promise<EvaluationReportDTO> {
    // 404 until the evaluation finishes — surfaced as a rejection, matching the
    // mock so the Evaluation screen keeps polling getWorkspace() until Completed.
    return getJson<EvaluationReportDTO>(`/api/workspaces/${workspaceId}/report`);
  }

  // Resume a finished session back into teaching — transcript and the Learner's
  // memory are preserved server-side; returns the workspace now in 'Teaching'.
  resumeSession(workspaceId: string): Promise<WorkspaceDTO> {
    return sendJson<WorkspaceDTO>(`/api/workspaces/${workspaceId}/resume`, 'POST');
  }
}
