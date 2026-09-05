/**
 * Splitting reference material into retrievable chunks (§3.7 retrieval).
 *
 * Retrieval is only ever as good as its chunks. Two rules shape this splitter:
 *
 *  1. Never cut mid-thought when it can be avoided. Text is split on blank-line
 *     boundaries first, and paragraphs are packed together until the target size
 *     is reached, so a chunk is a whole number of paragraphs whenever possible.
 *  2. Carry a little of the previous text into each chunk. A sentence that
 *     straddles a boundary is then readable in full in at least one chunk.
 *
 * Every chunk keeps its exact character offsets in the source, so an excerpt can
 * always be traced back to where it came from.
 */

/** One retrievable passage of the reference material. */
export interface ReferenceChunk {
  /** Position in the document, 0-based. Also the sort key for reading order. */
  index: number;
  /** The passage itself, including the carried-over overlap. */
  text: string;
  /** Nearest preceding heading, when the document has any. */
  heading: string | null;
  /** Offsets into the source text; `start` includes the overlap. */
  start: number;
  end: number;
}

/**
 * How full a chunk must be before a new heading is allowed to end it. Below
 * this, the section is too short to stand alone and is merged with the next.
 */
const HEADING_BREAK_RATIO = 0.4;

export interface ChunkOptions {
  /** Target chunk size in characters. */
  size: number;
  /** Characters of preceding text carried into each chunk. */
  overlap: number;
}

interface Block {
  start: number;
  end: number;
  heading: string | null;
}

/**
 * Split `text` into overlapping chunks. Returns an empty array for blank input.
 */
export function chunkText(text: string, { size, overlap }: ChunkOptions): ReferenceChunk[] {
  const source = text.replace(/\r\n?/g, "\n");
  if (source.trim().length === 0) return [];

  const chunkSize = Math.max(200, size);
  const chunkOverlap = Math.max(0, Math.min(overlap, Math.floor(chunkSize / 2)));

  const blocks = splitIntoBlocks(source, chunkSize);
  const chunks: ReferenceChunk[] = [];

  let groupStart: number | null = null;
  let groupEnd = 0;
  let groupHeading: string | null = null;

  const flush = (): void => {
    if (groupStart === null) return;
    const start = overlapStart(source, groupStart, chunkOverlap);
    chunks.push({
      index: chunks.length,
      text: source.slice(start, groupEnd).trim(),
      heading: groupHeading,
      start,
      end: groupEnd,
    });
    groupStart = null;
  };

  for (const block of blocks) {
    if (groupStart === null) {
      groupStart = block.start;
      groupEnd = block.end;
      groupHeading = block.heading;
      continue;
    }

    // A new heading is a real boundary in the material, so prefer to break
    // there rather than packing two sections into one chunk — a mixed chunk
    // gets a misleading label and dilutes its own retrieval score. Only break
    // once the current chunk carries enough content to stand on its own,
    // otherwise a run of short sections would produce a run of tiny chunks.
    const startsNewSection =
      block.heading !== null &&
      block.heading !== groupHeading &&
      groupEnd - groupStart >= chunkSize * HEADING_BREAK_RATIO;

    // Keep packing while the accumulated content still fits.
    if (!startsNewSection && block.end - groupStart <= chunkSize) {
      groupEnd = block.end;
      continue;
    }
    flush();
    groupStart = block.start;
    groupEnd = block.end;
    groupHeading = block.heading;
  }
  flush();

  return chunks.filter((chunk) => chunk.text.length > 0);
}

/**
 * Break the source into paragraph-sized blocks, hard-splitting any single
 * paragraph that is longer than one chunk. Tracks the nearest Markdown heading
 * so chunks can be labelled; plain PDF text usually has none, and that is fine.
 */
function splitIntoBlocks(source: string, chunkSize: number): Block[] {
  const blocks: Block[] = [];
  let heading: string | null = null;
  let cursor = 0;

  for (const paragraph of source.split(/\n{2,}/)) {
    const start = source.indexOf(paragraph, cursor);
    if (start === -1) continue;
    const end = start + paragraph.length;
    cursor = end;

    if (paragraph.trim().length === 0) continue;

    const found = findHeading(paragraph);
    if (found) heading = found;

    if (paragraph.length <= chunkSize) {
      blocks.push({ start, end, heading });
      continue;
    }
    for (const piece of splitLongParagraph(source, start, end, chunkSize)) {
      blocks.push({ ...piece, heading });
    }
  }

  return blocks;
}

/**
 * A paragraph longer than one chunk is cut at sentence boundaries; if even a
 * single sentence is oversized, it is cut at the size limit rather than dropped.
 */
function splitLongParagraph(
  source: string,
  start: number,
  end: number,
  chunkSize: number,
): Array<{ start: number; end: number }> {
  const pieces: Array<{ start: number; end: number }> = [];
  let pieceStart = start;
  let cursor = start;

  const boundary = /[.!?]\s+|\n/g;
  boundary.lastIndex = 0;
  const paragraph = source.slice(start, end);

  let match: RegExpExecArray | null;
  while ((match = boundary.exec(paragraph)) !== null) {
    const absolute = start + match.index + match[0].length;
    if (absolute - pieceStart >= chunkSize) {
      pieces.push({ start: pieceStart, end: absolute });
      pieceStart = absolute;
    }
    cursor = absolute;
  }
  if (cursor < end || pieceStart < end) {
    // Whatever is left; hard-cut it if a lone sentence still exceeds the size.
    let remaining = pieceStart;
    while (end - remaining > chunkSize) {
      pieces.push({ start: remaining, end: remaining + chunkSize });
      remaining += chunkSize;
    }
    if (remaining < end) pieces.push({ start: remaining, end });
  }
  return pieces;
}

/** Back up from `start` by `overlap` characters, snapping to a word boundary. */
function overlapStart(source: string, start: number, overlap: number): number {
  if (overlap === 0 || start === 0) return start;
  const target = Math.max(0, start - overlap);
  const space = source.indexOf(" ", target);
  return space !== -1 && space < start ? space + 1 : target;
}

/** Markdown-style headings only; anything else is too ambiguous to guess at. */
function findHeading(paragraph: string): string | null {
  for (const line of paragraph.split("\n")) {
    const match = /^\s{0,3}#{1,6}\s+(.{1,80})$/.exec(line);
    if (match) return match[1].replace(/[*_`#]/g, "").trim();
  }
  return null;
}

/**
 * A one-line label for a chunk, used both in the prompt and in the outline.
 * Falls back to the opening words when the document has no headings.
 */
export function chunkLabel(chunk: ReferenceChunk): string {
  const position = `bagian ${chunk.index + 1}`;
  if (chunk.heading) return `${position} · ${chunk.heading}`;
  const opening = chunk.text.replace(/\s+/g, " ").trim().slice(0, 60);
  return opening ? `${position} · ${opening}…` : position;
}
