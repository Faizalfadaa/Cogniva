import styles from '../../../styles/TeachingSession.module.css'
import { LEARNERS } from '../../../lib/Learner'

interface LearnerSelectProps {
  onSelect: (learnerId: string) => void
}

/**
 * One-time character picker, shown before the intro on a workspace the user has
 * not started yet. Deliberately built from the same pieces as LearnerIntro —
 * dark scrim, forest card, full-body portrait — so picking a student and then
 * being introduced to them feels like one sequence.
 *
 * No "skip": the choice is three cards and it only ever appears once per
 * workspace. Anyone who navigates away without choosing simply keeps the
 * hash-derived default (see resolveLearner).
 */
export function LearnerSelect({ onSelect }: LearnerSelectProps) {
  return (
    <div className={styles.selectOverlay} role="dialog" aria-modal="true" aria-label="Choose your student">
      <div className={styles.selectPanel}>
        <h2 className={styles.selectTitle}>Who would you like to teach?</h2>
        <p className={styles.selectSubtitle}>
          Pick a student for this workspace. They will stay with you for the whole session.
        </p>

        <div className={styles.selectGrid}>
          {LEARNERS.map((learner) => (
            <button
              key={learner.id}
              type="button"
              className={styles.selectCard}
              onClick={() => onSelect(learner.id)}
              aria-label={`Teach ${learner.name}`}
            >
              <img
                src={learner.introImageUrl}
                alt=""
                aria-hidden="true"
                className={styles.selectCardImage}
              />
              <span className={styles.selectCardName}>{learner.name}</span>
              <span className={styles.selectCardTraits}>{learner.traits}</span>
              <span className={styles.selectCardDesc}>{learner.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
