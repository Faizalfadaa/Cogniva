import type { LearnerCharacter } from '../../../lib/Learner'
import { learnerCopy } from '../../../lib/Learner'
import { useLocale, useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/Evaluation.module.css'

interface LetterFromLearnerProps {
  learner: LearnerCharacter
  letter: string
}

/**
 * The student's own words about the session, with the student beside them.
 *
 * No longer behind a sealed envelope. The letter is the warmest thing on this
 * screen and the part that makes the score feel like it came from someone, so
 * hiding it behind a click meant the page's best moment was the one a reader was
 * least likely to reach. The character now sits next to it at a size you can
 * actually read a face at — the header's 26px circle never carried that.
 */
export function LetterFromLearner({ learner, letter }: LetterFromLearnerProps) {
  const t = useT()
  const { locale } = useLocale()
  const copy = learnerCopy(learner, locale)

  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>
        <span>{t('evaluation.letterTitle')}</span>
      </div>

      <div className={styles.letterLayout}>
        <div className={styles.letterPortrait}>
          <img src={learner.chibiUrl} alt={learner.name} className={styles.letterChibi} />
          <p className={styles.letterPortraitName}>{learner.name}</p>
          <p className={styles.letterPortraitTrait}>{copy.traits}</p>
        </div>

        <div className={styles.letterOpen}>
          <div className={styles.letterHeader}>
            <img src={learner.avatarUrl} alt="" aria-hidden="true" className={styles.letterAvatar} />
            <div>
              <p className={styles.letterFrom}>{learner.name}</p>
              <p className={styles.letterSub}>{t('evaluation.toTheirTeacher')}</p>
            </div>
          </div>
          <div className={styles.letterBody}>
            {letter.split('\n').map((line, i) =>
              line.trim() === '' ? (
                <br key={i} />
              ) : (
                <p key={i} className={styles.letterLine}>{line}</p>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
