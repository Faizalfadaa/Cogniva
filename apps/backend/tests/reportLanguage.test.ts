/**
 * The debrief speaks the session's language, and says when it had no reference.
 *
 * The language picker promises "the report comes back in it". The Evaluator was
 * told to write English and the letter, notebook and fallbacks were English
 * strings, so an Indonesian session got an Indonesian screen around an English
 * report. And a session with no reference material was graded and scored like
 * any other, with nothing on the screen saying the score had nothing to check
 * against.
 */

import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.USE_MOCK_AI = "true";
  process.env.GEMINI_API_KEY = "";
  process.env.GOOGLE_API_KEY = "";
});
vi.mock("../src/modules/auth/authService.js", () => ({
  getCurrentUser: vi.fn(async () => undefined),
}));

import { mockEvaluator } from "../src/agents/evaluator/evaluator.mock.js";
import { buildEvaluatorMessages } from "../src/agents/evaluator/evaluator.prompt.js";
import type { EvaluatorInput } from "../src/agents/evaluator/types.js";
import { workspaceRoutes } from "../src/api/rest/workspaces.js";
import type { EvaluationResult } from "../src/contracts/evaluation.js";
import { buildEvaluationReport } from "../src/modules/workspace/evaluationReport.js";

const input: EvaluatorInput = {
  sessionId: "ses_report",
  turns: [{ turnIndex: 0, boardText: "Fotosintesis mengubah cahaya menjadi glukosa." }],
  referenceMaterial: "Tumbuhan membuat glukosa dari cahaya, air, dan karbon dioksida.",
  keyConcepts: ["cahaya menjadi glukosa", "oksigen dilepaskan"],
  commonMisconceptions: [],
};

/** An evaluation written the way the real Evaluator writes: full sentences. */
const result: EvaluationResult = {
  evaluationId: "ev_1",
  sessionId: "ses_report",
  score: 60,
  depthScore: 40,
  findings: [],
  summary: "Ringkasan.",
  strengths: ["Kamu dengan tepat menyebut bahwa cahaya diubah menjadi energi kimia."],
  improvements: ["Jelaskan bagaimana ATP dan NADPH berpindah ke siklus Calvin."],
  generatedAt: new Date().toISOString(),
};

describe("the Evaluator is asked for the session's language", () => {
  const user = (locale?: "id" | "en") =>
    buildEvaluatorMessages({ ...input, locale }).find((m) => m.role === "user")!.content;

  it("asks for Indonesian in an Indonesian session, and English otherwise", () => {
    expect(user("id")).toMatch(/Write every text field in Bahasa Indonesia/);
    expect(user("en")).toMatch(/Write every text field in English/);
    expect(user(undefined)).toMatch(/Write every text field in English/);
  });

  it("keeps quotes exactly as the teacher wrote them, whatever the language", () => {
    expect(user("id")).toMatch(/Keep sourceQuote exactly as it appears in the transcript/);
  });

  it("speaks to the teacher, never about 'the user'", () => {
    const system = buildEvaluatorMessages(input).find((m) => m.role === "system")!.content;
    expect(system).toMatch(/Never call\s+them "the user"/);
  });
});

describe("the offline evaluator, which is also the fallback when grading fails", () => {
  it("writes in the session's language", () => {
    const id = mockEvaluator({ ...input, locale: "id" }, "ev_id");
    expect(id.summary).toMatch(/konsep kunci/);
    expect(id.findings.map((f) => f.detail).join(" ")).toMatch(/penjelasanmu|belum disentuh/);

    const en = mockEvaluator(input, "ev_en");
    expect(en.summary).toMatch(/key concepts/);
  });
});

describe("the debrief's own words", () => {
  it("writes the letter and notebook in Indonesian for an Indonesian session", () => {
    const report = buildEvaluationReport(result, { title: "Fotosintesis", turnCount: 2, locale: "id" });
    expect(report.letter).toMatch(/^Hai!/);
    expect(report.letter).toMatch(/Makasih banyak ya udah ngajarin aku tentang Fotosintesis/);
    expect(report.letter).toMatch(/Muridmu/);

    const empty = buildEvaluationReport(
      { ...result, strengths: [], improvements: [], summary: "" },
      { title: "Fotosintesis", turnCount: 0, locale: "id", meaningfulScore: false },
    );
    expect(empty.notebook.learned).toEqual(["Perkenalan pertama dengan topiknya"]);
    expect(empty.notebook.reflection).toMatch(/Sesi ini singkat/);
    expect(empty.continueLearning[0]).toMatch(/kasus lanjutan/);
  });

  it("stays English without a language, as before", () => {
    const report = buildEvaluationReport(result, { title: "Photosynthesis", turnCount: 2 });
    expect(report.letter).toMatch(/^Hi!/);
  });

  it("quotes the Evaluator's sentences whole, without a doubled period or a broken clause", () => {
    // The letter used to read "What helped the most: … chemical energy.." and
    // "could we go over the user could provide more detail on …?".
    const { letter } = buildEvaluationReport(result, { title: "Fotosintesis", turnCount: 2, locale: "id" });

    expect(letter).not.toMatch(/\.\./);
    expect(letter).toContain(
      "Yang paling membantu aku: Kamu dengan tepat menyebut bahwa cahaya diubah menjadi energi kimia.",
    );
    expect(letter).toContain(
      "Satu hal yang pengin aku bahas lagi lain kali: Jelaskan bagaimana ATP dan NADPH berpindah ke siklus Calvin.",
    );
  });

  it("keeps a name or a capitalised pronoun at the start of a quoted sentence", () => {
    // Lowering the first letter turned these into "naruto" and "anda".
    const { letter } = buildEvaluationReport(
      { ...result, strengths: ["Naruto dijelaskan sebagai anak Minato."], improvements: ["Anda perlu menjelaskan motif Mizuki."] },
      { title: "Naruto", turnCount: 2, locale: "id" },
    );
    expect(letter).toContain("Yang paling membantu aku: Naruto dijelaskan sebagai anak Minato.");
    expect(letter).toContain("Satu hal yang pengin aku bahas lagi lain kali: Anda perlu menjelaskan motif Mizuki.");
  });

  it("records whether there was a reference, and leaves it out when unknown", () => {
    expect(buildEvaluationReport(result, { title: "", turnCount: 1, hadReference: false }).hadReference).toBe(false);
    expect(buildEvaluationReport(result, { title: "", turnCount: 1, hadReference: true }).hadReference).toBe(true);
    expect("hadReference" in buildEvaluationReport(result, { title: "", turnCount: 1 })).toBe(false);
  });
});

describe("a session's reference, end to end", () => {
  const app = Fastify();
  const guest = { "x-guest-session": "guest-session-report-language" };

  beforeAll(async () => {
    await app.register(workspaceRoutes, { prefix: "/api" });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  async function waitFor(url: string, ready: (body: any) => boolean) {
    for (let i = 0; i < 300; i++) {
      const response = await app.inject({ method: "GET", url, headers: guest });
      if (response.statusCode === 200 && ready(response.json())) return response.json();
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out: ${url}`);
  }

  async function teachAndFinish(url: string) {
    await app.inject({
      method: "POST",
      url: `${url}/checkpoints`,
      headers: guest,
      payload: { snapshotImage: "iVBORw0KGgo=", snapshotMime: "image/png", whiteboardSnapshot: {} },
    });
    await waitFor(`${url}/checkpoints`, (rows) => rows.some((row: any) => row.learnerResponse));
    expect((await app.inject({ method: "POST", url: `${url}/finish`, headers: guest })).statusCode).toBe(204);
    return waitFor(`${url}/report`, (body) => Boolean(body.letter));
  }

  it("tells the client there is no reference, and the debrief says it was graded without one", async () => {
    const created = await app.inject({ method: "POST", url: "/api/workspaces", headers: guest });
    const url = `/api/workspaces/${created.json().id}`;

    const ws = (await app.inject({ method: "GET", url, headers: guest })).json();
    expect(Boolean(ws.hasReference)).toBe(false);

    const report = await teachAndFinish(url);
    expect(report.hadReference).toBe(false);
  });

  it("knows about pasted reference text, which leaves no pdf or source behind", async () => {
    const created = await app.inject({ method: "POST", url: "/api/workspaces", headers: guest });
    const url = `/api/workspaces/${created.json().id}`;

    const saved = await app.inject({
      method: "POST",
      url: `${url}/reference-text`,
      headers: guest,
      payload: { text: "Fotosintesis mengubah energi cahaya menjadi energi kimia dalam bentuk glukosa." },
    });
    expect(saved.statusCode).toBe(200);

    const ws = (await app.inject({ method: "GET", url, headers: guest })).json();
    expect(ws.hasReference).toBe(true);
    expect(ws.pdfUrl).toBeUndefined();
    expect(ws.referenceSource).toBeUndefined();

    const report = await teachAndFinish(url);
    expect(report.hadReference).toBe(true);
  });
});
