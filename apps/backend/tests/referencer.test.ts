/**
 * Referencer tests (§3.7, reference sourcing).
 *
 * The agent's value is that its links are real, so what is worth locking down is
 * everything that stands between a model's output and a URL the user clicks:
 *
 *  1. The offline list never invents a document, and every URL it emits parses.
 *  2. The guard drops unusable links, deduplicates, and — the important one —
 *     marks an option verified only when the search actually returned its host.
 *  3. Suggesting works with no credential at all, like every other agent.
 *  4. The direct-fetch fallback keeps the substance of a page, drops its chrome,
 *     and refuses to fetch anything on the machine's own network.
 */

import { describe, expect, it } from "vitest";

import {
  fetchSourceText,
  groundedHosts,
  htmlToText,
  normalizeFetchedText,
  normalizeOptions,
  optionsFromSources,
  suggestOffline,
  suggestReferences,
} from "../src/agents/referencer/index.js";
import type { GroundedSource } from "../src/llm/index.js";

describe("offline suggestions", () => {
  it("returns usable options with parseable URLs and no invented document titles", async () => {
    const result = suggestOffline({ topic: "Fotosintesis", count: 4 });

    expect(result.source).toBe("offline");
    expect(result.options).toHaveLength(4);
    expect(result.notice).not.toBe("");

    for (const option of result.options) {
      expect(() => new URL(option.url)).not.toThrow();
      expect(option.url.startsWith("https://")).toBe(true);
      // Nothing was searched, so nothing may claim corroboration.
      expect(option.verified).toBe(false);
      expect(option.title).toContain("Fotosintesis");
    }
  });

  it("puts the topic into the query string rather than the path", () => {
    const [wikipedia] = suggestOffline({ topic: "Hukum Newton II", count: 1 }).options;
    const url = new URL(wikipedia.url);
    expect(url.searchParams.get("search")).toBe("Hukum Newton II");
  });

  it("survives an empty topic", () => {
    const result = suggestOffline({ topic: "   " });
    expect(result.options.length).toBeGreaterThan(0);
    for (const option of result.options) {
      expect(() => new URL(option.url)).not.toThrow();
    }
  });
});

describe("guard", () => {
  const sources: GroundedSource[] = [
    { title: "khanacademy.org", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc" },
    { title: "openstax.org", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/def" },
  ];

  it("reads publisher hosts out of grounding chunk titles", () => {
    const hosts = groundedHosts(sources);
    expect(hosts.has("khanacademy.org")).toBe(true);
    expect(hosts.has("openstax.org")).toBe(true);
  });

  it("verifies only options whose host the search actually returned", () => {
    const options = normalizeOptions(
      {
        options: [
          {
            title: "Photosynthesis",
            url: "https://www.khanacademy.org/science/biology/photosynthesis",
            source: "Khan Academy",
            kind: "course",
            summary: "s",
            whyRelevant: "w",
          },
          {
            title: "Invented page",
            url: "https://totally-made-up-site.example/photosynthesis",
            source: "Nowhere",
            kind: "article",
            summary: "s",
            whyRelevant: "w",
          },
        ],
      },
      sources,
      4,
    );

    expect(options).toHaveLength(2);
    expect(options[0].verified).toBe(true);
    // Kept, but honestly labelled — the user can judge a link they can see.
    expect(options[1].verified).toBe(false);
  });

  it("drops entries with no usable URL or no title", () => {
    const options = normalizeOptions(
      {
        options: [
          { title: "No link", url: "", source: "x", kind: "article", summary: "", whyRelevant: "" },
          { title: "Not http", url: "javascript:alert(1)", source: "x", kind: "article", summary: "", whyRelevant: "" },
          { title: "Bare word", url: "photosynthesis", source: "x", kind: "article", summary: "", whyRelevant: "" },
          { title: "", url: "https://openstax.org/details/books/biology-2e", source: "x", kind: "pdf", summary: "", whyRelevant: "" },
        ],
      },
      sources,
      4,
    );

    expect(options).toHaveLength(0);
  });

  it("deduplicates the same page and honors the limit", () => {
    const entry = {
      title: "Biology 2e",
      url: "https://openstax.org/details/books/biology-2e",
      source: "OpenStax",
      kind: "pdf",
      summary: "",
      whyRelevant: "",
    };
    const options = normalizeOptions(
      { options: [entry, { ...entry, url: `${entry.url}/` }, { ...entry, url: `${entry.url}?x=1` }] },
      sources,
      4,
    );
    expect(options).toHaveLength(1);

    const capped = normalizeOptions(
      {
        options: [
          entry,
          { ...entry, url: "https://openstax.org/a" },
          { ...entry, url: "https://openstax.org/b" },
        ],
      },
      sources,
      2,
    );
    expect(capped).toHaveLength(2);
  });

  it("infers kind from the link when the model omits or invents one", () => {
    const [pdf, other] = normalizeOptions(
      {
        options: [
          { title: "Notes", url: "https://ocw.mit.edu/notes.pdf", source: "MIT", summary: "", whyRelevant: "" },
          { title: "Page", url: "https://ocw.mit.edu/course", kind: "encyclopedia", source: "MIT", summary: "", whyRelevant: "" },
        ],
      },
      [],
      4,
    );
    expect(pdf.kind).toBe("pdf");
    expect(other.kind).toBe("article");
  });

  it("falls back to the grounded sources themselves", () => {
    const options = optionsFromSources(
      [{ title: "khanacademy.org", uri: "https://www.khanacademy.org/x" }],
      4,
    );
    expect(options).toHaveLength(1);
    // Straight from a search result, so corroborated by construction.
    expect(options[0].verified).toBe(true);
  });

  it("tidies fetched text and bounds it", () => {
    const text = normalizeFetchedText("Judul  \r\n\n\n\nIsi   \n", 8);
    expect(text).toBe("Judul\n\nI");
  });
});

describe("suggestReferences", () => {
  it("works with no credential, like every other agent", async () => {
    const result = await suggestReferences({ topic: "Fotosintesis", useMock: true });
    expect(result.source).toBe("offline");
    expect(result.options.length).toBeGreaterThan(0);
  });
});

describe("direct fetch fallback", () => {
  it("keeps headings, formulas and paragraph breaks; drops chrome and scripts", () => {
    const text = htmlToText(`
      <html><head><title>Hukum Newton</title>
        <style>.a{color:red}</style>
        <script>var tracked = 1;</script>
      </head>
      <body>
        <nav><a href="/x">Beranda</a><a href="/y">Kelas</a></nav>
        <h2>Hukum Newton II</h2>
        <p>Percepatan sebanding dengan gaya: F = m &times; a.</p>
        <ul><li>F = gaya (N)</li><li>m = massa (kg)</li></ul>
        <footer>&copy; 2026</footer>
      </body></html>
    `);

    expect(text).toContain("Hukum Newton");
    expect(text).toContain("Hukum Newton II");
    expect(text).toContain("F = m × a");
    expect(text).toContain("m = massa (kg)");
    // Chrome and code must not become part of the answer key.
    expect(text).not.toContain("tracked");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("Beranda");
    expect(text).not.toContain("2026");
    // Blocks stay separated, which is what the chunker splits on.
    expect(text.split("\n").length).toBeGreaterThan(2);
  });

  it("decodes named and numeric entities, casing included", () => {
    expect(htmlToText("<p>a &amp; b &lt; c &#65; &#x42;&nbsp;d</p>")).toContain("a & b < c A B d");
    // &Delta; and &delta; are different characters; lowercasing them both would
    // quietly rewrite a formula.
    expect(htmlToText("<p>&Delta;v = a &times; &delta;t</p>")).toContain("Δv = a × δt");
  });

  it("refuses loopback and private addresses without making a request", async () => {
    for (const url of [
      "http://localhost:8000/admin",
      "http://127.0.0.1/",
      "http://10.0.0.5/secrets",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data",
      "http://172.16.4.4/",
    ]) {
      const result = await fetchSourceText(url);
      expect(result.text).toBe("");
      expect(result.problem).toBe("Alamat itu tidak boleh diambil.");
    }
  });

  it("refuses non-web schemes and malformed links", async () => {
    expect((await fetchSourceText("file:///C:/Windows/win.ini")).problem).toBe(
      "Tautan itu bukan alamat web.",
    );
    expect((await fetchSourceText("not a url")).problem).toBe("Tautan itu tidak valid.");
  });
});
