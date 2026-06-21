/**
 * Thin REST client for the Cogniva backend (Architecture Document §7.1).
 * M0 skeleton: only wraps the session-lifecycle & topic endpoints.
 */

import type { EvaluationResult, Session, Topic } from "../contracts";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listTopics: (): Promise<Topic[]> =>
    fetch(`${BASE}/api/topics`).then(json<Topic[]>),

  getTopic: (id: string): Promise<Topic> =>
    fetch(`${BASE}/api/topics/${id}`).then(json<Topic>),

  createSession: (topicId: string): Promise<Session> =>
    fetch(`${BASE}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId }),
    }).then(json<Session>),

  getSession: (id: string): Promise<Session> =>
    fetch(`${BASE}/api/sessions/${id}`).then(json<Session>),

  startSession: (id: string): Promise<Session> =>
    fetch(`${BASE}/api/sessions/${id}/start`, { method: "POST" }).then(
      json<Session>,
    ),

  endSession: (id: string): Promise<Session> =>
    fetch(`${BASE}/api/sessions/${id}/end`, { method: "POST" }).then(
      json<Session>,
    ),

  evaluateSession: (id: string): Promise<EvaluationResult> =>
    fetch(`${BASE}/api/sessions/${id}/evaluate`, { method: "POST" }).then(
      json<EvaluationResult>,
    ),

  getEvaluation: (id: string): Promise<EvaluationResult> =>
    fetch(`${BASE}/api/sessions/${id}/evaluation`).then(json<EvaluationResult>),
};
