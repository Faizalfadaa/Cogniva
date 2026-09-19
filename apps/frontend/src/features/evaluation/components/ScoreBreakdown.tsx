import type { EvaluationFindingDTO } from '../../../dto/EvaluationReportDTO'
import type { LearnerCharacter } from '../../../lib/Learner'
import { buildScoreAxes } from '../lib/scoreAxes'
import { buildSessionHighlights } from '../lib/sessionHighlights'
import { AXIS_ICON } from '../lib/axisIcons'
import { AxisRadar } from './AxisRadar'
import { SessionHighlights } from './SessionHighlights'
import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/Evaluation.module.css'

interface ScoreBreakdownProps {
  score: number
  depthScore: number
  findings: EvaluationFindingDTO[]
  learner: LearnerCharacter
}

/**
 * The overall score, then the two lines that matter most, then the four axes.
 *
 * Three levels of zoom, widening as you go down: one number, two sentences, four
 * measurements. The radar sits beside the axis cards rather than instead of
 * them, because a shape answers "is this lopsided" and a card answers "by how
 * much, and counted from what".
 */
export function ScoreBreakdown({ score, depthScore, findings, learner }: ScoreBreakdownProps) {
  const t = useT()
  const axes = buildScoreAxes(findings, depthScore, t)
  const highlights = buildSessionHighlights(findings, axes, t)

  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>
        <span>{t('evaluation.scoreTitle')}</span>
      </div>

      <div className={styles.scoreCard}>
        <div className={styles.scoreHeadline}>
          <span className={styles.scoreValue}>{score}</span>
          <span className={styles.scoreOutOf}>/ 100</span>
          <p className={styles.scoreCaption}>{t('evaluation.scoreCaption')}</p>
        </div>

        <SessionHighlights highlights={highlights} learner={learner} />

        <div className={styles.axisLayout}>
          <AxisRadar axes={axes} />

          <div className={styles.axisGrid}>
            {axes.map((axis) => {
              const Icon = AXIS_ICON[axis.key]
              return (
                <div key={axis.key} className={styles.axisCard}>
                  <p className={styles.axisLabel}>
                    {Icon && (
                      <span className={styles.axisIcon}>
                        <Icon />
                      </span>
                    )}
                    <span>{axis.label}</span>
                  </p>
                  {axis.value === null ? (
                    <p className={styles.axisValueEmpty}>{t('evaluation.axisUnmeasured')}</p>
                  ) : (
                    <>
                      <p className={styles.axisValue}>{axis.value}</p>
                      <div
                        className={styles.axisBar}
                        role="img"
                        aria-label={t('evaluation.axisOutOf100', { label: axis.label, value: axis.value })}
                      >
                        <div className={styles.axisBarFill} style={{ width: `${axis.value}%` }} />
                      </div>
                    </>
                  )}
                  <p className={styles.axisCaption}>{axis.caption}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
