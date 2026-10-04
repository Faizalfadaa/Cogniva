/**
 * Referencer tests (§3.7, reference sourcing).
 *
 * The agent's value is that its links are real, so what is worth locking down is
 * everything that stands between a model's output and a URL the user clicks:
 *
 *  1. The offline list never invents a document, and every URL it emits parses.
 *  2. The guard drops unusable links, deduplicates, and — the important one —
 *     marks an option verified only when the search actually returned its host.
 *  3. The source policy: what becomes an answer key has to be something someone
 *     is answerable for, so open-edit wikis and note dumps are dropped outright
 *     and the survivors are ordered by how much institution stands behind them.
 *  4. Suggesting works with no credential at all, like every other agent.
 *  5. The direct-fetch fallback keeps the substance of a page, drops its chrome,
 *     and refuses to fetch anything on the machine's own network.
 */

import { describe, expect, it } from "vitest";

import {
  fetchSourceText,
  groundedHosts,
  htmlToText,
  isBlockedHost,
  normalizeFetchedText,
  normalizeOptions,
  optionsFromSources,
  suggestOffline,
  suggestReferences,
  trustOfHost,
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

  it("offers no source the online path would have refused", () => {
    // The fallback for a feature cannot be laxer than the feature. Wikipedia led
    // this list once; an open-edit page must never become a marking key.
    for (const option of suggestOffline({ topic: "Fotosintesis", count: 6 }).options) {
      expect(isBlockedHost(new URL(option.url).hostname)).toBe(false);
      expect(option.url).not.toContain("wikipedia");
    }
  });

  it("puts the topic into the query string rather than the path", () => {
    const [first] = suggestOffline({ topic: "Hukum Newton II", count: 1 }).options;
    const url = new URL(first.url);
    // Which parameter carries it is the library's business; that it is a
    // parameter and not a guessed article path is the point.
    expect([...url.searchParams.values()]).toContain("Hukum Newton II");
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
    const { options } = normalizeOptions(
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
    const { options } = normalizeOptions(
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
    const { options } = normalizeOptions(
      { options: [entry, { ...entry, url: `${entry.url}/` }, { ...entry, url: `${entry.url}?x=1` }] },
      sources,
      4,
    );
    expect(options).toHaveLength(1);

    const { options: capped } = normalizeOptions(
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
    const { options: [pdf, other] } = normalizeOptions(
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
    const { options } = optionsFromSources(
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

describe("source policy", () => {
  const option = (url: string, title = "Judul") => ({
    title,
    url,
    source: "x",
    kind: "article",
    summary: "s",
    whyRelevant: "w",
  });

  it("blocks every Wikipedia edition, mobile host and mirror", () => {
    for (const host of [
      "en.wikipedia.org",
      "id.wikipedia.org",
      "id.m.wikipedia.org",
      "wikipedia.org",
      "simple.wikipedia.beta.example.com", // a mirror on somebody else's domain
      "www.wikiwand.com",
      "id.wikibooks.org",
      "commons.wikimedia.org",
    ]) {
      expect(isBlockedHost(host)).toBe(true);
    }
  });

  it("blocks the publishing models where nobody answers for the text", () => {
    for (const host of [
      "www.quora.com",
      "brainly.co.id",
      "www.coursehero.com",
      "id.scribd.com",
      "www.studocu.com",
      "www.academia.edu", // .edu in the name, self-upload in fact
      "www.researchgate.net",
      "someone.medium.com",
      "myclass.blogspot.com",
      "www.reddit.com",
    ]) {
      expect(isBlockedHost(host)).toBe(true);
    }
  });

  it("does not block the institutions it is protecting", () => {
    for (const host of [
      "ocw.mit.edu",
      "www.cam.ac.uk",
      "fisika.ui.ac.id",
      "kemdikbud.go.id",
      "science.nasa.gov",
      "openstax.org",
      "arxiv.org",
      "www.britannica.com",
    ]) {
      expect(isBlockedHost(host)).toBe(false);
    }
  });

  it("reads accountability off the domain, including outside the US", () => {
    expect(trustOfHost("ocw.mit.edu")).toBe("high");
    expect(trustOfHost("www.ox.ac.uk")).toBe("high");
    expect(trustOfHost("fisika.ui.ac.id")).toBe("high");
    expect(trustOfHost("bmkg.go.id")).toBe("high");
    expect(trustOfHost("www.who.int")).toBe("high");
    expect(trustOfHost("arxiv.org")).toBe("high");
    expect(trustOfHost("chem.libretexts.org")).toBe("high");
    expect(trustOfHost("www.britannica.com")).toBe("medium");
    expect(trustOfHost("www.khanacademy.org")).toBe("medium");
    // Not recognised is not the same as not allowed: kept, ranked last, labelled.
    expect(trustOfHost("some-teachers-site.example")).toBe("low");
  });

  it("removes unaccountable sources from model output and says which", () => {
    const { options, rejected } = normalizeOptions(
      {
        options: [
          option("https://id.wikipedia.org/wiki/Fotosintesis", "Fotosintesis"),
          option("https://www.quora.com/What-is-photosynthesis", "Quora"),
          option("https://openstax.org/books/biology-2e/pages/8-1", "Biology 2e"),
        ],
      },
      [],
      4,
    );

    expect(options).toHaveLength(1);
    expect(options[0].url).toContain("openstax.org");
    expect(rejected).toContain("id.wikipedia.org");
    expect(rejected).toContain("quora.com");
  });

  it("judges a grounded source by its publisher, not by the redirect host", () => {
    // Grounded results are all vertexaisearch redirects on Google's own domain.
    // Checking the URI alone would wave a Wikipedia result straight through.
    const { options, rejected } = optionsFromSources(
      [
        { title: "en.wikipedia.org", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a" },
        { title: "openstax.org", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/b" },
      ],
      4,
    );

    expect(options).toHaveLength(1);
    expect(options[0].source).toBe("openstax.org");
    expect(rejected).toContain("en.wikipedia.org");
  });

  it("ranks by accountability before relevance, and ranks before it cuts", () => {
    const { options } = normalizeOptions(
      {
        options: [
          option("https://some-blog.example/a", "Blog"),
          option("https://another-blog.example/b", "Blog lain"),
          option("https://www.khanacademy.org/c", "Khan"),
          option("https://ocw.mit.edu/d", "MIT"),
        ],
      },
      [],
      2,
    );

    // The university page arrived last and still leads: cutting at the limit
    // first would have thrown it away in favour of two unknown blogs.
    expect(options.map((entry) => entry.trust)).toEqual(["high", "medium"]);
    expect(options[0].url).toContain("ocw.mit.edu");
    // Ids carry the final position, so they are handed out after the sort.
    expect(options[0].id).toBe("ocw-mit-edu-1");
  });

  it("keeps relevance order within one tier", () => {
    const { options } = normalizeOptions(
      {
        options: [
          option("https://ocw.mit.edu/first", "Pertama"),
          option("https://www.ox.ac.uk/second", "Kedua"),
        ],
      },
      [],
      4,
    );
    expect(options.map((entry) => entry.title)).toEqual(["Pertama", "Kedua"]);
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
      expect(result.problem).toBe("That address is not allowed to be fetched.");
    }
  });

  it("refuses non-web schemes and malformed links", async () => {
    expect((await fetchSourceText("file:///C:/Windows/win.ini")).problem).toBe(
      "That link is not a web address.",
    );
    expect((await fetchSourceText("not a url")).problem).toBe("That link is not valid.");
  });
});
