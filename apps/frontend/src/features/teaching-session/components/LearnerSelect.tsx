import styles from '../../../styles/TeachingSession.module.css'
import { LEARNERS, learnerCopy } from '../../../lib/Learner'
import { useLocale, useT } from '../../../i18n/LanguageProvider'

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
  const t = useT()
  const { locale } = useLocale()

  return (
    <div
      className={styles.selectOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={t('learnerSelect.dialog')}
    >
      <div className={styles.selectPanel}>
        <h2 className={styles.selectTitle}>{t('learnerSelect.title')}</h2>
        <p className={styles.selectSubtitle}>{t('learnerSelect.subtitle')}</p>

        <div className={styles.selectGrid}>
          {LEARNERS.map((learner) => {
            const copy = learnerCopy(learner, locale)
            return (
              <button
                key={learner.id}
                type="button"
                className={styles.selectCard}
                onClick={() => onSelect(learner.id)}
                aria-label={t('learnerSelect.teach', { name: learner.name })}
              >
                <img
                  src={learner.introImageUrl}
                  alt=""
                  aria-hidden="true"
                  className={styles.selectCardImage}
                />
                <span className={styles.selectCardName}>{learner.name}</span>
                <span className={styles.selectCardTraits}>{copy.traits}</span>
                <span className={styles.selectCardDesc}>{copy.description}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
