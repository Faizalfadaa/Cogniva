/**
 * Retrieval tests — the "R" in the Evaluator's RAG path (§3.7).
 *
 * No network and no API key: the vector path is exercised with a deterministic
 * fake embedder, and the keyword path is the real offline implementation.
 */

import { describe, expect, it } from "vitest";

import { buildEvaluatorMessages } from "../src/agents/evaluator/evaluator.prompt.js";
import { normalize, type Embedder } from "../src/llm/index.js";
import {
  buildOutline,
  buildReferenceIndex,
  chunkText,
  queriesFromTranscript,
  retrieveExcerpts,
  tokenize,
  ReferenceIndex,
} from "../src/modules/retrieval/index.js";

// --- fixtures --------------------------------------------------------------

/** Three clearly distinct sections, so we can assert which one was retrieved. */
const REFERENCE = `
## Light reactions

The light reactions occur in the thylakoid membranes of the chloroplast.
Chlorophyll absorbs light and water is split, releasing O2. Energy is stored as
ATP and NADPH. The oxygen we breathe comes from splitting water, not from CO2.

## Calvin cycle

The Calvin cycle happens in the stroma and does not require light directly. It
uses the ATP and NADPH produced earlier to fix CO2 into glucose.

## Limiting factors

The rate depends on light intensity, CO2 concentration, and temperature. Beyond
a saturation point, adding more light no longer increases the rate.
`.trim();

/**
 * Deterministic stand-in for Gemini embeddings: hashes tokens into a small
 * vector, so texts sharing vocabulary end up close together. Enough to prove the
 * vector path is wired correctly without calling the network.
 */
function fakeEmbedder(calls: string[][] = []): Embedder {
  return {
    async embed({ texts }) {
      calls.push(texts);
      return texts.map((text) => {
        const vector = new Array(16).fill(0);
        for (const token of tokenize(text)) {
          let hash = 0;
          for (let i = 0; i < token.length; i++) {
            hash = (hash * 31 + token.charCodeAt(i)) % 16;
          }
          vector[hash] += 1;
        }
        return normalize(vector);
      });
    },
  };
}

const failingEmbedder: Embedder = {
  async embed() {
    throw new Error("embedding service is down");
  },
};

// --- chunking --------------------------------------------------------------

describe("chunkText", () => {
  it("splits a document into several chunks and keeps exact offsets", () => {
    const chunks = chunkText(REFERENCE, { size: 300, overlap: 40 });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
      expect(chunk.start).toBeLessThan(chunk.end);
      // The recorded slice must really contain the chunk's text.
      expect(REFERENCE.slice(chunk.start, chunk.end)).toContain(chunk.text.slice(0, 40));
    });
  });

  it("carries overlap from the previous chunk so boundaries stay readable", () => {
    const chunks = chunkText(REFERENCE, { size: 300, overlap: 60 });
    const [first, second] = chunks;

    expect(second.start).toBeLessThan(first.end);
  });

  it("captures Markdown headings for labelling", () => {
    const chunks = chunkText(REFERENCE, { size: 300, overlap: 40 });
    const headings = chunks.map((chunk) => chunk.heading);

    expect(headings).toContain("Light reactions");
    expect(headings).toContain("Calvin cycle");
  });

  it("prefers to break at a heading rather than mix two sections in one chunk", () => {
    // The last two sections together are well under this size, so plain
    // paragraph-packing would merge them; the heading boundary keeps them apart.
    const chunks = chunkText(REFERENCE, { size: 400, overlap: 0 });

    expect(chunks.map((chunk) => chunk.heading)).toEqual([
      "Light reactions",
      "Calvin cycle",
      "Limiting factors",
    ]);
    const limiting = chunks[2].text;
    expect(limiting).toContain("saturation point");
    expect(limiting).not.toContain("thylakoid");
  });

  it("returns nothing for blank input", () => {
    expect(chunkText("", { size: 300, overlap: 40 })).toEqual([]);
    expect(chunkText("   \n\n  ", { size: 300, overlap: 40 })).toEqual([]);
  });

  it("hard-splits a paragraph longer than one chunk instead of dropping it", () => {
    const long = "kata ".repeat(400).trim();
    const chunks = chunkText(long, { size: 300, overlap: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= 400)).toBe(true);
  });
});

// --- index modes -----------------------------------------------------------

describe("buildReferenceIndex", () => {
  it("builds a keyword index when no embedder is available", async () => {
    const index = await buildReferenceIndex(REFERENCE, { embedder: null, size: 300, overlap: 40 });

    expect(index.mode).toBe("keyword");
    expect(index.size).toBeGreaterThan(1);
  });

  it("builds a vector index when an embedder is available", async () => {
    const index = await buildReferenceIndex(REFERENCE, { embedder: fakeEmbedder(), size: 300, overlap: 40 });

    expect(index.mode).toBe("vector");
  });

  it("degrades to keyword mode when embedding fails, rather than throwing", async () => {
    const index = await buildReferenceIndex(REFERENCE, { embedder: failingEmbedder, size: 300, overlap: 40 });

    expect(index.mode).toBe("keyword");
    expect(index.size).toBeGreaterThan(1);
  });

  it("embeds documents with the RETRIEVAL_DOCUMENT task type", async () => {
    const seen: Array<string | undefined> = [];
    const embedder: Embedder = {
      async embed({ texts, taskType }) {
        seen.push(taskType);
        return texts.map(() => normalize([1, 0, 0]));
      },
    };
    await buildReferenceIndex(REFERENCE, { embedder, size: 300, overlap: 40 });

    expect(seen).toEqual(["RETRIEVAL_DOCUMENT"]);
  });
});

// --- retrieval -------------------------------------------------------------

describe("retrieveExcerpts", () => {
  it("returns the section that matches the query, not the whole document", async () => {
    const index = await buildReferenceIndex(REFERENCE, { embedder: null, size: 300, overlap: 40 });
    const excerpts = await retrieveExcerpts(
      index,
      ["the Calvin cycle fixes CO2 into glucose in the stroma"],
      { embedder: null, topK: 1, maxChunks: 1 },
    );

    expect(excerpts).toHaveLength(1);
    expect(excerpts[0].text).toContain("Calvin cycle");
    expect(excerpts[0].text).not.toContain("saturation point");
  });

  it("works the same way through the vector path", async () => {
    const index = await buildReferenceIndex(REFERENCE, { embedder: fakeEmbedder(), size: 300, overlap: 40 });
    const excerpts = await retrieveExcerpts(
      index,
      ["the Calvin cycle fixes CO2 into glucose in the stroma"],
      { embedder: fakeEmbedder(), topK: 1, maxChunks: 1 },
    );

    expect(index.mode).toBe("vector");
    expect(excerpts[0].text).toContain("Calvin cycle");
  });

  it("embeds queries with the RETRIEVAL_QUERY task type", async () => {
    const index = await buildReferenceIndex(REFERENCE, { embedder: fakeEmbedder(), size: 300, overlap: 40 });
    const seen: Array<string | undefined> = [];
    const embedder: Embedder = {
      async embed({ texts, taskType }) {
        seen.push(taskType);
        return texts.map(() => normalize(new Array(16).fill(1)));
      },
    };
    await retrieveExcerpts(index, ["light reactions in the thylakoid"], { embedder });

    expect(seen).toEqual(["RETRIEVAL_QUERY"]);
  });

  it("merges several queries, de-duplicates, and returns document order", async () => {
    const index = await buildReferenceIndex(REFERENCE, { embedder: null, size: 300, overlap: 40 });
    const excerpts = await retrieveExcerpts(
      index,
      [
        "light intensity and temperature limit the rate",
        "chlorophyll absorbs light in the thylakoid membranes",
        "chlorophyll absorbs light in the thylakoid membranes",
      ],
      { embedder: null, topK: 1, maxChunks: 5 },
    );

    const labels = excerpts.map((excerpt) => excerpt.label);
    expect(new Set(labels).size).toBe(labels.length);

    const positions = labels.map((label) => Number(/bagian (\d+)/.exec(label)?.[1]));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("still retrieves when query embedding fails mid-flight", async () => {
    const index = await buildReferenceIndex(REFERENCE, { embedder: fakeEmbedder(), size: 300, overlap: 40 });
    const excerpts = await retrieveExcerpts(index, ["the Calvin cycle and glucose"], {
      embedder: failingEmbedder,
      topK: 1,
      maxChunks: 1,
    });

    expect(excerpts[0].text).toContain("Calvin cycle");
  });

  it("ignores queries too short to be meaningful", async () => {
    const index = await buildReferenceIndex(REFERENCE, { embedder: null, size: 300, overlap: 40 });

    expect(await retrieveExcerpts(index, ["ok", "", "   "], { embedder: null })).toEqual([]);
  });

  it("returns nothing for an empty index", async () => {
    const empty = new ReferenceIndex([], null);

    expect(await retrieveExcerpts(empty, ["anything at all here"], { embedder: null })).toEqual([]);
  });
});

describe("buildOutline", () => {
  it("lists every chunk, so coverage can be judged without the full text", async () => {
    const index = await buildReferenceIndex(REFERENCE, { embedder: null, size: 300, overlap: 40 });
    const outline = buildOutline(index);

    expect(outline).toHaveLength(index.size);
    expect(outline.join("\n")).toContain("Limiting factors");
  });
});

describe("queriesFromTranscript", () => {
  it("uses each turn's board text and speech, plus any key concepts", () => {
    const queries = queriesFromTranscript(
      [
        { boardText: "photosynthesis needs light", speech: "and water too" },
        { boardText: "glucose is the output" },
      ],
      ["oxygen comes from water"],
    );

    expect(queries).toEqual([
      "photosynthesis needs light and water too",
      "glucose is the output",
      "oxygen comes from water",
    ]);
  });
});

// --- the prompt the Evaluator actually receives -----------------------------

describe("evaluator prompt on the RAG path", () => {
  const base = {
    sessionId: "ses_test",
    turns: [{ turnIndex: 0, boardText: "The Calvin cycle fixes CO2 into glucose." }],
    keyConcepts: [],
    commonMisconceptions: [],
  };

  it("sends retrieved excerpts and the outline instead of the full document", async () => {
    const index = await buildReferenceIndex(REFERENCE, { embedder: null, size: 300, overlap: 40 });
    const referenceExcerpts = await retrieveExcerpts(
      index,
      ["the Calvin cycle fixes CO2 into glucose"],
      { embedder: null, topK: 1, maxChunks: 1 },
    );

    const [, user] = buildEvaluatorMessages({
      ...base,
      referenceMaterial: "",
      referenceExcerpts,
      referenceOutline: buildOutline(index),
    });

    expect(user.content).toContain("Retrieved Excerpts");
    expect(user.content).toContain("Calvin cycle");
    // The outline names every section, but only the retrieved passage is quoted.
    expect(user.content).toContain("Limiting factors");
    expect(user.content).not.toContain("saturation point");
  });

  it("falls back to the full reference when nothing was retrieved", () => {
    const [, user] = buildEvaluatorMessages({
      ...base,
      referenceMaterial: REFERENCE,
      referenceExcerpts: [],
      referenceOutline: [],
    });

    expect(user.content).toContain("Reference Material (source of truth)");
    expect(user.content).toContain("saturation point");
    expect(user.content).not.toContain("Retrieved Excerpts");
  });
});
