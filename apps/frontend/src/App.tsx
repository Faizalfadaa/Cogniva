import { useEffect, useState } from "react";
import { api } from "./api/client";
import type { Topic } from "./contracts";

/**
 * M0 frontend skeleton. Proves the contract end-to-end: it loads the demo
 * topics from the backend and renders them. The real components — Whiteboard
 * & Input (§3.1) and Dialog/Debrief (§3.2) — come in M1/M2/M3.
 */
export default function App() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listTopics()
      .then(setTopics)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <h1 className="text-2xl font-bold text-cogniva">Cogniva</h1>
          <p className="text-sm text-slate-500">
            A Learning-by-Teaching study platform · M0 skeleton
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <h2 className="mb-4 text-lg font-semibold">Available demo topics</h2>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load topics: {error}
            <div className="mt-1 text-red-500">
              Make sure the backend is running at http://localhost:8000.
            </div>
          </div>
        )}

        <ul className="space-y-3">
          {topics.map((t) => (
            <li
              key={t.topicId}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{t.title}</h3>
                <span className="rounded-full bg-cogniva/10 px-2 py-0.5 text-xs font-medium text-cogniva">
                  {t.difficulty}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{t.description}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
