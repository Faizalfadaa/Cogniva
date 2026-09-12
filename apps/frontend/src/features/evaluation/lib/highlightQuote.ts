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

/** Which of a turn's two text channels a quote was found in. */
export type QuoteField = 'boardText' | 'speech'

export interface QuoteMatch {
  field: QuoteField
  /** Character offset of the quote within that field's text. */
  index: number
  /** The matched text, echoed back so callers need not re-slice. */
  text: string
}

/**
 * Find `quote` in `turn`, board text first and speech second.
 *
 * Board text wins ties because it is the channel the user deliberately wrote;
 * speech is the transcribed afterthought around it.
 */
export function highlightQuoteInText(
  turn: Pick<EvaluationTranscriptTurnDTO, 'boardText' | 'speech'>,
  quote: string | null | undefined,
): QuoteMatch | null {
  if (!quote) return null

  const board = turn.boardText ?? ''
  const inBoard = board.indexOf(quote)
  if (inBoard >= 0) return { field: 'boardText', index: inBoard, text: quote }

  const speech = turn.speech ?? ''
  const inSpeech = speech.indexOf(quote)
  if (inSpeech >= 0) return { field: 'speech', index: inSpeech, text: quote }

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
