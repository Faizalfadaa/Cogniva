import styles from '../../../styles/Evaluation.module.css'

interface ContinueLearningProps {
  topics: string[]
  onNewSession: () => void
}

export function ContinueLearning({ topics, onNewSession }: ContinueLearningProps) {
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
            Siap mengajar lagi? Buat sesi baru dan lanjutkan perjalananmu.
          </p>
          <button className={styles.continueBtn} onClick={onNewSession}>
            Mulai sesi baru ↗
          </button>
        </div>
      </div>
    </section>
  )
}