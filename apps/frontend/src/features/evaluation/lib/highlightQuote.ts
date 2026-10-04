/**
 * Locating a finding's quote inside the turn it came from.
 *
 * The backend guard already verified that a `sourceQuote` occurs verbatim in
 * the turn it cites, and blanks the field when it could not (see
 * `evaluator.guard.ts`). So the search here is a plain exact `indexOf`: no
 * whitespace or case tolerance, because tolerating anything here would mean
 * highlighting text the backend never confirmed.
 *
 * A `null` result means "no precise anchor" — the quote is absent or the
 * backend rejected it — and the caller highlights the whole turn instead.
 */

import type { EvaluationFindingDTO, EvaluationTranscriptTurnDTO } from '../../../dto/EvaluationReportDTO'

/** Which of a turn's text channels a quote was found in. */
export type QuoteField = 'boardText' | 'newBoardText' | 'speech' | 'chat'

export interface QuoteMatch {
  field: QuoteField
  /**
   * Which chat bubble, when `field` is 'chat'.
   *
   * Chat is the one channel a turn can hold several of, so the field alone no
   * longer says where to draw the mark. Indexed into the turn's own `chat`
   * array, learner bubbles included, so the number lines up with what the
   * screen renders.
   */
  chatIndex?: number
  /** Character offset of the quote within that field's text. */
  index: number
  /** The matched text, echoed back so callers need not re-slice. */
  text: string
}

/**
 * Find `quote` in `turn`: board text, then speech, then the user's chat.
 *
 * Board text wins ties because it is the channel the user deliberately wrote;
 * speech is the transcribed afterthought around it; chat came after both.
 *
 * Learner bubbles are skipped. The backend guard already refuses to anchor a
 * finding to them, and searching them here could only produce a mark claiming
 * the user said something the student did.
 */
export function highlightQuoteInText(
  turn: Pick<EvaluationTranscriptTurnDTO, 'boardText' | 'newBoardText' | 'speech' | 'chat'>,
  quote: string | null | undefined,
): QuoteMatch | null {
  if (!quote) return null

  // The new part is what the screen puts first, so a quote found there is
  // marked there rather than in the whole board further down.
  const fresh = turn.newBoardText ?? ''
  const inFresh = fresh.indexOf(quote)
  if (inFresh >= 0) return { field: 'newBoardText', index: inFresh, text: quote }

  const board = turn.boardText ?? ''
  const inBoard = board.indexOf(quote)
  if (inBoard >= 0) return { field: 'boardText', index: inBoard, text: quote }

  const speech = turn.speech ?? ''
  const inSpeech = speech.indexOf(quote)
  if (inSpeech >= 0) return { field: 'speech', index: inSpeech, text: quote }

  const chat = turn.chat ?? []
  for (let i = 0; i < chat.length; i++) {
    if (chat[i].sender !== 'user') continue
    const at = chat[i].text.indexOf(quote)
    if (at >= 0) return { field: 'chat', chatIndex: i, index: at, text: quote }
  }

  return null
}

/** One run of text, carrying the finding that highlights it when there is one. */
export interface TextSegment {
  text: string
  finding?: EvaluationFindingDTO
}

/**
 * Cut `text` into highlighted and plain runs for every finding that quotes it.
 *
 * Several findings can cite the same turn, so the matches are laid down in
 * document order and any that overlaps an earlier one is skipped: two marks on
 * the same words would nest, and a nested mark is unreadable. The skipped
 * finding still appears in the list, just without its own highlight.
 */
export function segmentTextForFindings(
  text: string,
  matches: { finding: EvaluationFindingDTO; index: number; length: number }[],
): TextSegment[] {
  if (!text) return []

  const ordered = [...matches].sort((a, b) => a.index - b.index)
  const segments: TextSegment[] = []
  let cursor = 0

  for (const m of ordered) {
    if (m.index < cursor) continue
    if (m.index > cursor) segments.push({ text: text.slice(cursor, m.index) })
    segments.push({ text: text.slice(m.index, m.index + m.length), finding: m.finding })
    cursor = m.index + m.length
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor) })
  return segments
}

/**
 * Every finding that points at `turn`, split by whether it has a usable anchor.
 *
 * `quoted` drives the per-sentence marks; `wholeTurn` is the fallback set that
 * makes the turn block itself light up (§the backend rejected their quotes, or
 * there never was one).
 */
export function findingsForTurn(
  findings: EvaluationFindingDTO[],
  turn: EvaluationTranscriptTurnDTO,
): {
  quoted: { finding: EvaluationFindingDTO; match: QuoteMatch }[]
  wholeTurn: EvaluationFindingDTO[]
} {
  const quoted: { finding: EvaluationFindingDTO; match: QuoteMatch }[] = []
  const wholeTurn: EvaluationFindingDTO[] = []

  for (const finding of findings) {
    if (finding.evidenceTurnIndex !== turn.turnIndex) continue
    const match = highlightQuoteInText(turn, finding.sourceQuote)
    if (match) quoted.push({ finding, match })
    else wholeTurn.push(finding)
  }

  return { quoted, wholeTurn }
}
