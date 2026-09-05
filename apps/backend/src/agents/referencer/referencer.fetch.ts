/**
 * Direct fetch — the fallback for when Gemini's URL context cannot read a page.
 *
 * Why this exists: the grounded read works on some sites and simply returns
 * nothing on many others (a page that renders only through JavaScript, a host
 * that refuses Google's fetcher, a PDF it will not open). Measured on Indonesian
 * study sites, that was most of them — which made a good-looking list of options
 * mostly unusable, the one failure this feature cannot afford.
 *
 * So when the model comes back empty, the server fetches the URL itself. The
 * text this produces is rawer than the model's notes — navigation and footers
 * come along with it — but that is exactly the shape the uploaded-PDF path
 * already stores, and the retrieval layer (§3.7) chunks and selects from it the
 * same way. Rawer material beats no material.
 *
 * This never fetches on behalf of a page: the URL comes from an option the user
 * picked in the dialog. Private and loopback hosts are refused anyway, so a
 * suggestion that somehow named an internal address cannot turn this into a
 * probe of the machine the server runs on.
 */

/** Cap on the download, before extraction. Larger than any real article. */
const MAX_BYTES = 8 * 1024 * 1024;

/** A slow host must not hold a request open indefinitely. */
const TIMEOUT_MS = 20_000;

/**
 * Sent so a site serves what it would serve a reader. Some hosts return an empty
 * body or a challenge page to an unrecognized client, which would look here like
 * a page with no content rather than one we simply asked for badly.
 */
const USER_AGENT =
  "Mozilla/5.0 (compatible; CognivaReferenceBot/1.0; +https://cogniva.web.id)";

export interface DirectFetchResult {
  text: string;
  /** Empty when the fetch worked; otherwise why it did not. */
  problem: string;
}

/** Reject loopback, link-local and private ranges before any request is made. */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Fetch a URL and return its readable text. Never throws. */
export async function fetchSourceText(url: string): Promise<DirectFetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { text: "", problem: "Tautan itu tidak valid." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { text: "", problem: "Tautan itu bukan alamat web." };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { text: "", problem: "Alamat itu tidak boleh diambil." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/pdf,text/plain,*/*" },
    });
    if (!response.ok) {
      return { text: "", problem: `Sumber itu menolak dibuka (${response.status}).` };
    }

    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return { text: "", problem: "Berkasnya terlalu besar untuk diproses." };
    }

    if (type.includes("pdf") || buffer.subarray(0, 5).toString("latin1") === "%PDF-") {
      return { text: await extractPdf(buffer), problem: "" };
    }
    if (type.includes("html") || type.includes("xml") || type === "") {
      return { text: htmlToText(buffer.toString("utf8")), problem: "" };
    }
    if (type.startsWith("text/")) {
      return { text: buffer.toString("utf8"), problem: "" };
    }
    return { text: "", problem: "Jenis berkas itu tidak bisa dibaca." };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { text: "", problem: aborted ? "Sumber itu terlalu lambat dibuka." : "Gagal membuka sumber itu." };
  } finally {
    clearTimeout(timer);
  }
}

/** Same PDF engine the upload path uses, imported lazily for the same reason. */
async function extractPdf(data: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  } catch {
    // A scanned or encrypted PDF yields nothing; the caller reports it as unread.
    return "";
  }
}

/**
 * Named entities worth decoding.
 *
 * Not the full HTML set — just punctuation, plus the maths and Greek characters
 * that carry meaning in study material. `&times;` left undecoded turns "F = m ×
 * a" into "F = m &times; a", and the Evaluator would then be grading against a
 * formula that does not read as one.
 */
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  middot: "·",
  bull: "•",
  laquo: "«",
  raquo: "»",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
  micro: "µ",
  // Maths
  times: "×",
  divide: "÷",
  minus: "−",
  plusmn: "±",
  ne: "≠",
  le: "≤",
  ge: "≥",
  asymp: "≈",
  equiv: "≡",
  infin: "∞",
  radic: "√",
  sum: "∑",
  prod: "∏",
  int: "∫",
  part: "∂",
  prop: "∝",
  sup2: "²",
  sup3: "³",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  rarr: "→",
  larr: "←",
  harr: "↔",
  // Greek, as it appears in formulas
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  Delta: "Δ",
  epsilon: "ε",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  Sigma: "Σ",
  tau: "τ",
  phi: "φ",
  omega: "ω",
  Omega: "Ω",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    // Case matters before it does not: &Delta; and &delta; are different
    // characters, so the exact name wins and the lowercase form is the fallback
    // for entities whose casing carries no meaning (&AMP;, &Nbsp;).
    .replace(
      /&([a-z]+);/gi,
      (whole, name: string) => ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? whole,
    );
}

/**
 * Strip HTML down to readable text.
 *
 * Deliberately a small hand-rolled pass rather than a readability library: the
 * output feeds a chunker that already tolerates noise, and the alternative is a
 * heavyweight dependency on the server's critical path for a fallback that only
 * runs when the model has already failed.
 */
export function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|template)\b[\s\S]*?<\/\1>/gi, " ")
    // Chrome-only regions. Dropping them removes most menus and boilerplate,
    // which is what makes the remaining text worth indexing.
    .replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ");

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(withoutNoise)?.[1] ?? "";

  const body = withoutNoise
    // Block boundaries become line breaks so headings and paragraphs stay apart
    // — the chunker splits on those, and without them the page is one long line.
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote|pre)\s*>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<h([1-6])[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(`${title}\n\n${body}`)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
