import { useState } from 'react'
import type {
  EvaluationFindingDTO,
  ScoreHistoryPointDTO,
} from '../../../dto/EvaluationReportDTO'
import type { LearnerCharacter } from '../../../lib/Learner'
import { buildScoreAxes } from '../lib/scoreAxes'
import { buildSessionHighlights } from '../lib/sessionHighlights'
import { AXIS_ICON } from '../lib/axisIcons'
import { AxisRadar } from './AxisRadar'
import { ScoreTrend } from './ScoreTrend'
import { SessionHighlights } from './SessionHighlights'
import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/Evaluation.module.css'

interface ScoreBreakdownProps {
  score: number
  depthScore: number
  findings: EvaluationFindingDTO[]
  learner: LearnerCharacter
  /** Every scored session this device has finished, for the trend strip. */
  history: ScoreHistoryPointDTO[]
  workspaceId: string
}

/**
 * The overall score, then the two lines that matter most, then the four axes.
 *
 * Three levels of zoom, widening as you go down: one number, two sentences, four
 * measurements. The radar sits beside the axis cards rather than instead of
 * them, because a shape answers "is this lopsided" and a card answers "by how
 * much, and counted from what".
 *
 * Which axis is being pointed at lives here rather than in either child, so the
 * link works both ways: hovering a vertex lights its card, hovering a card lights
 * its vertex.
 */
export function ScoreBreakdown({
  score,
  depthScore,
  findings,
  learner,
  history,
  workspaceId,
}: ScoreBreakdownProps) {
  const t = useT()
  const axes = buildScoreAxes(findings, depthScore, t)
  const highlights = buildSessionHighlights(findings, axes, t)
  const [activeAxis, setActiveAxis] = useState<string | null>(null)

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

        <ScoreTrend history={history} currentWorkspaceId={workspaceId} />

        <SessionHighlights highlights={highlights} learner={learner} />

        <div className={styles.axisLayout}>
          <AxisRadar axes={axes} activeKey={activeAxis} onActiveChange={setActiveAxis} />

          <div className={styles.axisGrid}>
            {axes.map((axis) => {
              const Icon = AXIS_ICON[axis.key]
              const active = activeAxis === axis.key
              return (
                <div
                  key={axis.key}
                  className={`${styles.axisCard} ${active ? styles.axisCardActive : ''}`}
                  onMouseEnter={() => setActiveAxis(axis.key)}
                  onMouseLeave={() => setActiveAxis(null)}
                >
                  <p className={styles.axisLabel}>
                    {Icon && (
                      <span className={styles.axisIcon}>
                        <Icon />
                      </span>
                    )}
                    <span>{axis.label}</span>
                  </p>
                  {axis.value === null ? (
                    <p className={styles.axisValueEmpty}>{t('evaluation.notMeasured')}</p>
                  ) : (
                    <>
                      <p className={styles.axisValue}>{axis.value}</p>
                      <div
                        className={styles.axisBar}
                        role="img"
                        aria-label={`${axis.label}: ${axis.value} / 100`}
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
