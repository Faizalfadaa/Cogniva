import { describe, expect, it } from 'vitest'

import type { EvaluationFindingDTO } from '../../../dto/EvaluationReportDTO'
import {
  findingsForTurn,
  highlightQuoteInText,
  segmentTextForFindings,
} from './highlightQuote'

const turn = {
  turnIndex: 0,
  boardText: 'Chlorophyll absorbs red and blue light. Green is reflected.',
  speech: 'That is why leaves look green to our eyes.',
}

describe('highlightQuoteInText', () => {
  it('finds a quote in the board text', () => {
    const match = highlightQuoteInText(turn, 'absorbs red and blue light')

    expect(match).toEqual({ field: 'boardText', index: 12, text: 'absorbs red and blue light' })
    expect(turn.boardText.slice(match!.index, match!.index + match!.text.length)).toBe(
      'absorbs red and blue light',
    )
  })

  it('falls through to the speech when the board does not contain it', () => {
    const match = highlightQuoteInText(turn, 'leaves look green')

    expect(match?.field).toBe('speech')
    expect(turn.speech.slice(match!.index, match!.index + match!.text.length)).toBe(
      'leaves look green',
    )
  })

  it('returns null for a quote in neither channel, so the caller falls back', () => {
    expect(highlightQuoteInText(turn, 'the plant captures sunlight')).toBeNull()
  })

  it('returns null when there is no quote at all', () => {
    expect(highlightQuoteInText(turn, undefined)).toBeNull()
    expect(highlightQuoteInText(turn, null)).toBeNull()
    expect(highlightQuoteInText(turn, '')).toBeNull()
  })

  it('does not tolerate case or whitespace drift, which the backend already filtered', () => {
    expect(highlightQuoteInText(turn, 'CHLOROPHYLL ABSORBS')).toBeNull()
    expect(highlightQuoteInText(turn, 'red  and  blue')).toBeNull()
  })

  it('matches a turn with no speech channel', () => {
    expect(highlightQuoteInText({ boardText: 'ATP is made here.' }, 'ATP')).toEqual({
      field: 'boardText',
      index: 0,
      text: 'ATP',
    })
  })
})

describe('segmentTextForFindings', () => {
  const correct: EvaluationFindingDTO = {
    category: 'CORRECT',
    concept: 'absorption',
    detail: 'right',
  }
  const confusing: EvaluationFindingDTO = {
    category: 'CONFUSING',
    concept: 'reflection',
    detail: 'muddled',
  }

  it('splits a sentence into plain and highlighted runs', () => {
    const segments = segmentTextForFindings('abc def ghi', [
      { finding: correct, index: 4, length: 3 },
    ])

    expect(segments).toEqual([
      { text: 'abc ' },
      { text: 'def', finding: correct },
      { text: ' ghi' },
    ])
  })

  it('lays several findings down in document order, not array order', () => {
    const segments = segmentTextForFindings('one two three', [
      { finding: confusing, index: 8, length: 5 },
      { finding: correct, index: 0, length: 3 },
    ])

    expect(segments.map((s) => s.text)).toEqual(['one', ' two ', 'three'])
    expect(segments[0].finding).toBe(correct)
    expect(segments[2].finding).toBe(confusing)
  })

  it('skips a match that overlaps an earlier one rather than nesting marks', () => {
    const segments = segmentTextForFindings('one two three', [
      { finding: correct, index: 0, length: 7 },
      { finding: confusing, index: 4, length: 3 },
    ])

    expect(segments).toEqual([{ text: 'one two', finding: correct }, { text: ' three' }])
  })

  it('returns nothing for empty text', () => {
    expect(segmentTextForFindings('', [{ finding: correct, index: 0, length: 1 }])).toEqual([])
  })
})

describe('findingsForTurn', () => {
  const findings: EvaluationFindingDTO[] = [
    {
      category: 'CORRECT',
      concept: 'absorption',
      detail: 'right',
      evidenceTurnIndex: 0,
      sourceQuote: 'absorbs red and blue light',
    },
    {
      // Cites this turn, but the backend rejected its quote: whole-turn fallback.
      category: 'WRONG',
      concept: 'reflection',
      detail: 'off',
      evidenceTurnIndex: 0,
    },
    {
      category: 'MISSED',
      concept: 'Calvin cycle',
      detail: 'absent',
      evidenceTurnIndex: null,
    },
    {
      category: 'CORRECT',
      concept: 'other turn',
      detail: 'elsewhere',
      evidenceTurnIndex: 1,
      sourceQuote: 'absorbs red and blue light',
    },
  ]

  it('separates precise anchors from whole-turn fallbacks, ignoring other turns', () => {
    const { quoted, wholeTurn } = findingsForTurn(findings, turn)

    expect(quoted).toHaveLength(1)
    expect(quoted[0].finding.concept).toBe('absorption')
    expect(quoted[0].match.field).toBe('boardText')

    expect(wholeTurn.map((f) => f.concept)).toEqual(['reflection'])
  })

  it('treats a quote the turn does not contain as a whole-turn fallback', () => {
    const { quoted, wholeTurn } = findingsForTurn(
      [{ category: 'WRONG', concept: 'x', detail: 'y', evidenceTurnIndex: 0, sourceQuote: 'nope' }],
      turn,
    )

    expect(quoted).toHaveLength(0)
    expect(wholeTurn).toHaveLength(1)
  })
})
