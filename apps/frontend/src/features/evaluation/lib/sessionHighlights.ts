/**
 * The two lines worth reading before anything else: what went best, and what to
 * fix first.
 *
 * Both are derived from data already on screen further down, so nothing new is
 * asked of the backend. The point is ordering, not new information: a debrief
 * that opens with four numbers and a transcript makes the reader do the ranking
 * themselves, and most will not.
 */

import type { EvaluationFindingDTO } from '../../../dto/EvaluationReportDTO'
import type { Translate } from '../../../i18n/LanguageProvider'
import type { ScoreAxis } from './scoreAxes'

export interface SessionHighlight {
  /** Short label for the thing itself, shown in bold. */
  headline: string
  /** One line of context under it. */
  support: string
}

export interface SessionHighlights {
  strength: SessionHighlight | null
  priority: SessionHighlight | null
}

/** Ranked worst-first: a wrong statement misleads, a gap merely omits. */
const PRIORITY_ORDER: EvaluationFindingDTO['category'][] = ['WRONG', 'CONFUSING', 'MISSED']

export function buildSessionHighlights(
  findings: EvaluationFindingDTO[],
  axes: ScoreAxis[],
  t: Translate,
): SessionHighlights {
  const measured = axes.filter((a) => a.value !== null) as (ScoreAxis & { value: number })[]

  return {
    strength: pickStrength(findings, measured, t),
    priority: pickPriority(findings, measured, t),
  }
}

/**
 * Prefer a concrete thing the user got right over a number about it: "you
 * explained the inputs and outputs" tells them more than "accuracy 100".
 */
function pickStrength(
  findings: EvaluationFindingDTO[],
  measured: (ScoreAxis & { value: number })[],
  t: Translate,
): SessionHighlight | null {
  const correct = findings.filter((f) => f.category === 'CORRECT')
  if (correct.length > 0) {
    const best = correct[0]
    return {
      headline: best.concept,
      support:
        correct.length > 1
          ? t('evaluation.plusOthers', {
              detail: best.detail,
              count: correct.length - 1,
            })
          : best.detail,
    }
  }

  const top = [...measured].sort((a, b) => b.value - a.value)[0]
  if (!top) return null
  return {
    headline: top.label,
    support: t('evaluation.highestScore', { value: top.value }),
  }
}

/**
 * The opposite ordering: here a category beats a score, because "this part is
 * wrong" is actionable and "clarity 60" is not.
 */
function pickPriority(
  findings: EvaluationFindingDTO[],
  measured: (ScoreAxis & { value: number })[],
  t: Translate,
): SessionHighlight | null {
  for (const category of PRIORITY_ORDER) {
    const hit = findings.find((f) => f.category === category)
    if (!hit) continue
    return { headline: hit.concept, support: hit.followUp ?? hit.detail }
  }

  const low = [...measured].sort((a, b) => a.value - b.value)[0]
  if (!low) return null
  return {
    headline: low.label,
    support: t('evaluation.lowestScore', { value: low.value }),
  }
}
