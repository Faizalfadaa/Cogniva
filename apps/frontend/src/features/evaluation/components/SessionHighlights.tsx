import type { LearnerCharacter } from '../../../lib/Learner'
import type { SessionHighlights as Highlights } from '../lib/sessionHighlights'
import styles from '../../../styles/Evaluation.module.css'

interface SessionHighlightsProps {
  highlights: Highlights
  learner: LearnerCharacter
}

/**
 * Two lines above the numbers: the best thing and the first thing to fix.
 *
 * The student's face sits on the priority card because that is the one asking
 * for something. It is the same character the letter comes from, so the request
 * reads as coming from someone rather than from a scoring function.
 */
export function SessionHighlights({ highlights, learner }: SessionHighlightsProps) {
  const { strength, priority } = highlights
  if (!strength && !priority) return null

  return (
    <div className={styles.highlightRow}>
      {strength && (
        <div className={`${styles.highlightCard} ${styles.highlightStrength}`}>
          <p className={styles.highlightLabel}>Kekuatan utama</p>
          <p className={styles.highlightHeadline}>{strength.headline}</p>
          <p className={styles.highlightSupport}>{strength.support}</p>
        </div>
      )}

      {priority && (
        <div className={`${styles.highlightCard} ${styles.highlightPriority}`}>
          <div className={styles.highlightTop}>
            <img
              src={learner.avatarUrl}
              alt=""
              aria-hidden="true"
              className={styles.highlightAvatar}
            />
            <p className={styles.highlightLabel}>Prioritas perbaikan</p>
          </div>
          <p className={styles.highlightHeadline}>{priority.headline}</p>
          <p className={styles.highlightSupport}>{priority.support}</p>
        </div>
      )}
    </div>
  )
}
