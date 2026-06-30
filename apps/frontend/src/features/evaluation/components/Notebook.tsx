import type { EvaluationNotebookDTO } from '../../../dto/EvaluationReportDTO'
import styles from '../../../styles/Evaluation.module.css'

interface NotebookProps {
  notebook: EvaluationNotebookDTO
  learnerName: string
}

export function Notebook({ notebook, learnerName }: NotebookProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>
        <span>📖</span>
        <span>My Notes</span>
      </div>

      <div className={styles.notebookCard}>
        {/* Notebook ruled-paper header */}
        <div className={styles.notebookHeader}>
          <p className={styles.notebookOwner}>{learnerName}'s notes</p>
        </div>

        <div className={styles.notebookBody}>
          {/* Learned */}
          <div className={styles.notebookBlock}>
            <h3 className={styles.notebookBlockTitle}>Learned</h3>
            {notebook.learned.length === 0 ? (
              <p className={styles.notebookEmpty}>Nothing noted yet.</p>
            ) : (
              <ul className={styles.notebookList}>
                {notebook.learned.map((item, i) => (
                  <li key={i} className={styles.notebookItemLearned}>
                    <span className={styles.notebookCheck}>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.notebookDivider} />

          {/* Still Confused */}
          <div className={styles.notebookBlock}>
            <h3 className={styles.notebookBlockTitle}>Still Confused</h3>
            {notebook.stillConfused.length === 0 ? (
              <p className={styles.notebookEmpty}>Nothing confusing — amazing!</p>
            ) : (
              <ul className={styles.notebookList}>
                {notebook.stillConfused.map((item, i) => (
                  <li key={i} className={styles.notebookItemConfused}>
                    <span className={styles.notebookQuestion}>?</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.notebookDivider} />

          {/* Reflection */}
          <div className={styles.notebookBlock}>
            <h3 className={styles.notebookBlockTitle}>Reflection</h3>
            <p className={styles.notebookReflection}>{notebook.reflection}</p>
          </div>
        </div>
      </div>
    </section>
  )
}