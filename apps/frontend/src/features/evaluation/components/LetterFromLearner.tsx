import { useState } from 'react'
import type { LearnerCharacter } from '../../../lib/Learner'
import styles from '../../../styles/Evaluation.module.css'

interface LetterFromLearnerProps {
  learner: LearnerCharacter
  letter: string
}

export function LetterFromLearner({ learner, letter }: LetterFromLearnerProps) {
  const [sealed, setSealed] = useState(true)

  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>
        <span>📩</span>
        <span>Letter from Your Learner</span>
      </div>

      {sealed ? (
        // Sealed envelope state — user clicks to open
        <div className={styles.letterSealed} onClick={() => setSealed(false)} role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setSealed(false)}
          aria-label="Open the letter from your learner"
        >
          <img src={learner.avatarUrl} alt={learner.name} className={styles.letterSealAvatar} />
          <div className={styles.letterSealText}>
            <p className={styles.letterSealFrom}>Letter from {learner.name}</p>
            <p className={styles.letterSealHint}>Click to open</p>
          </div>
          <span className={styles.letterSealIcon}>✉</span>
        </div>
      ) : (
        // Opened letter
        <div className={styles.letterOpen}>
          <div className={styles.letterHeader}>
            <img src={learner.avatarUrl} alt={learner.name} className={styles.letterAvatar} />
            <div>
              <p className={styles.letterFrom}>{learner.name}</p>
              <p className={styles.letterSub}>to their teacher</p>
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
      )}
    </section>
  )
}