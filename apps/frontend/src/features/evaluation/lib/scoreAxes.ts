/**
 * The three axes the debrief derives from `findings[]`.
 *
 * Derived here rather than asked of the backend: these are readings of the same
 * findings the screen already renders, so computing them client-side keeps the
 * number and the list it summarises from ever disagreeing.
 *
 * A `null` value means "not measurable from this session", not zero. A session
 * with no WRONG and no CORRECT findings has no accuracy to report, and printing
 * 0 there would read as a failing grade for a session that was merely short.
 */

import type { EvaluationFindingDTO } from '../../../dto/EvaluationReportDTO'
import type { Translate } from '../../../i18n/LanguageProvider'

/** Each CONFUSING finding costs this much clarity. Five of them reach zero. */
const CONFUSION_PENALTY = 20

export interface ScoreAxis {
  key: string
  label: string
  /** One word, for the radar's axis tips where a full label will not fit. */
  short: string
  /** 0..100, or null when the session gives nothing to measure. */
  value: number | null
  /** Shown under the number: what it counts, or why it is unmeasurable. */
  caption: string
}

export function buildScoreAxes(
  findings: EvaluationFindingDTO[],
  depthScore: number,
  t: Translate,
): ScoreAxis[] {
  const correct = findings.filter((f) => f.category === 'CORRECT').length
  const wrong = findings.filter((f) => f.category === 'WRONG').length
  const missed = findings.filter((f) => f.category === 'MISSED').length
  const confusing = findings.filter((f) => f.category === 'CONFUSING').length
  const judged = correct + wrong

  return [
    {
      key: 'accuracy',
      short: t('evaluation.axisAccuracyShort'),
      label: t('evaluation.axisAccuracy'),
      value: judged === 0 ? null : Math.round((correct / judged) * 100),
      caption:
        judged === 0
          ? t('evaluation.accuracyNone')
          : judged === 1
            ? t('evaluation.accuracyOne', { correct })
            : t('evaluation.accuracyCount', { correct, judged }),
    },
    {
      key: 'completeness',
      short: t('evaluation.axisCompletenessShort'),
      label: t('evaluation.axisCompleteness'),
      value:
        findings.length === 0
          ? null
          : Math.round(((findings.length - missed) / findings.length) * 100),
      caption:
        findings.length === 0
          ? t('evaluation.nothingMeasured')
          : missed === 0
            ? t('evaluation.nothingMissed')
            : missed === 1
              ? t('evaluation.missedOne')
              : t('evaluation.missedCount', { count: missed }),
    },
    {
      key: 'clarity',
      short: t('evaluation.axisClarityShort'),
      label: t('evaluation.axisClarity'),
      value:
        findings.length === 0
          ? null
          : Math.max(0, 100 - confusing * CONFUSION_PENALTY),
      caption:
        findings.length === 0
          ? t('evaluation.nothingMeasured')
          : confusing === 0
            ? t('evaluation.nothingConfusingAxis')
            : confusing === 1
              ? t('evaluation.confusingOne')
              : t('evaluation.confusingCount', { count: confusing }),
    },
    {
      key: 'depth',
      short: t('evaluation.axisDepthShort'),
      label: t('evaluation.axisDepth'),
      // Straight from the Evaluator: depth is a judgement about mechanism that
      // counting findings cannot reach.
      value: depthScore,
      caption: t('evaluation.depthCaption'),
    },
  ]
}
