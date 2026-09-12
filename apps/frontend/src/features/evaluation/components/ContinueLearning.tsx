import styles from '../../../styles/Evaluation.module.css'
import { useT } from '../../../i18n/LanguageProvider'

interface ContinueLearningProps {
  topics: string[]
  onNewSession: () => void
  onResumeSession: () => void
  resuming?: boolean
}

export function ContinueLearning({ topics, onNewSession, onResumeSession, resuming = false }: ContinueLearningProps) {
  const t = useT()

  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>
        <span>🌱</span>
        <span>{t('evaluation.continueLearning')}</span>
      </div>

      <div className={styles.continueCard}>
        {topics.length === 0 ? (
          <p className={styles.continueEmpty}>{t('evaluation.noRecommendations')}</p>
        ) : (
          <ul className={styles.continueList}>
            {topics.map((topic, i) => (
              <li key={i} className={styles.continueTopic}>
                <span className={styles.continueTopicIndex}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.continueTopicName}>{topic}</span>
                <span className={styles.continueTopicArrow}>→</span>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.continueFooter}>
          <p className={styles.continueFooterText}>{t('evaluation.continueHint')}</p>
          <div className={styles.continueActions}>
            <button
              className={styles.continueSecondaryBtn}
              onClick={onResumeSession}
              disabled={resuming}
            >
              {resuming ? t('evaluation.opening') : `${t('evaluation.continueSession')} ↩`}
            </button>
            <button className={styles.continueBtn} onClick={onNewSession} disabled={resuming}>
              {t('evaluation.newSession')} ↗
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}