/**
 * Shared presentation for a finding's category.
 *
 * Kept in one place because the badge in the notes slider and the highlight in
 * the transcript have to agree: a reader who learns that amber means "rancu" in
 * one section must find the same thing in the other.
 */

import type { EvaluationFindingDTO } from '../../../dto/EvaluationReportDTO'
import styles from '../../../styles/Evaluation.module.css'

type Category = EvaluationFindingDTO['category']

/** Indonesian labels for the canonical English categories (§6.9). */
export const CATEGORY_LABEL: Record<Category, string> = {
  CORRECT: 'Tepat',
  WRONG: 'Keliru',
  CONFUSING: 'Rancu',
  MISSED: 'Terlewat',
}

export const CATEGORY_BADGE_CLASS: Record<Category, string> = {
  CORRECT: styles.badgeCorrect,
  WRONG: styles.badgeWrong,
  CONFUSING: styles.badgeConfusing,
  MISSED: styles.badgeMissed,
}

/**
 * Highlight styling per category.
 *
 * WRONG and CONFUSING carry underline and weight on top of their colour, so the
 * parts that need fixing are separable from the parts that do not by more than
 * hue alone. CORRECT stays flat colour on purpose: it is not a problem, and
 * emphasising it would compete with the things that are.
 */
export const CATEGORY_MARK_CLASS: Record<Category, string> = {
  CORRECT: styles.markCorrect,
  WRONG: styles.markWrong,
  CONFUSING: styles.markConfusing,
  MISSED: styles.markMissed,
}
