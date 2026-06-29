import styles from '../../../styles/Evaluation.module.css'

interface ContinueLearningProps {
  topics: string[]
  onNewSession: () => void
  onResumeSession: () => void
  resuming?: boolean
}

export function ContinueLearning({ topics, onNewSession, onResumeSession, resuming = false }: ContinueLearningProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>
        <span>🌱</span>
        <span>Continue Learning</span>
      </div>

      <div className={styles.continueCard}>
        {topics.length === 0 ? (
          <p className={styles.continueEmpty}>Tidak ada rekomendasi saat ini.</p>
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
          <p className={styles.continueFooterText}>
            Siap mengajar topik-topik baru? Buat sesi baru atau lanjutkan sesi ini.
          </p>
          <div className={styles.continueActions}>
            <button
              className={styles.continueSecondaryBtn}
              onClick={onResumeSession}
              disabled={resuming}
            >
              {resuming ? 'Membuka...' : 'Lanjutkan Sesi ↩'}
            </button>
            <button className={styles.continueBtn} onClick={onNewSession} disabled={resuming}>
              Mulai sesi baru ↗
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}