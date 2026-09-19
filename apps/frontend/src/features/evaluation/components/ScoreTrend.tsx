import { useMemo } from 'react'
import type { ScoreHistoryPointDTO } from '../../../dto/EvaluationReportDTO'
import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/Evaluation.module.css'

/* A wide, short box: this is a glance at direction, not a chart to read values
   off. The dots carry the values; the line only carries the shape. */
const WIDTH = 260
const HEIGHT = 56
const PAD_X = 6
const PAD_Y = 8

interface ScoreTrendProps {
  history: ScoreHistoryPointDTO[]
  /** The session being read, so its own point can be marked in the run. */
  currentWorkspaceId: string
}

/**
 * Where this score sits in the run of sessions before it.
 *
 * A single score answers "how did this go" and nothing about whether teaching is
 * getting better, which is the question a second session makes askable. Hidden
 * below two points on purpose: one point is not a trend, and a lone dot on an
 * empty axis reads as a chart that failed to load.
 *
 * The scale is fixed at 0..100 rather than fitted to the data. A fitted scale
 * turns three scores a point apart into a dramatic climb; the whole value of
 * this strip is that a small gain looks small.
 */
export function ScoreTrend({ history, currentWorkspaceId }: ScoreTrendProps) {
  const t = useT()

  const points = useMemo(
    () =>
      history.map((point, i) => ({
        ...point,
        x:
          history.length === 1
            ? WIDTH / 2
            : PAD_X + (i * (WIDTH - PAD_X * 2)) / (history.length - 1),
        y: PAD_Y + ((100 - point.score) / 100) * (HEIGHT - PAD_Y * 2),
      })),
    [history],
  )

  if (points.length < 2) return null

  const currentIndex = points.findIndex((p) => p.workspaceId === currentWorkspaceId)
  const current = currentIndex === -1 ? points[points.length - 1] : points[currentIndex]
  const previous = currentIndex > 0 ? points[currentIndex - 1] : null
  const delta = previous ? current.score - previous.score : null

  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div className={styles.trendCard}>
      <div className={styles.trendTop}>
        <span className={styles.trendTitle}>
          {t('evaluation.trendTitle', { count: points.length })}
        </span>
        {delta !== null && (
          <span
            className={`${styles.trendDelta} ${
              delta > 0 ? styles.trendUp : delta < 0 ? styles.trendDown : ''
            }`}
          >
            {delta === 0
              ? t('evaluation.trendSame')
              : `${delta > 0 ? '+' : ''}${delta} ${t('evaluation.trendVsPrevious')}`}
          </span>
        )}
      </div>

      <svg
        className={styles.trendChart}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={points.map((p) => `${p.title ?? ''} ${p.score}`).join(', ')}
      >
        <polyline className={styles.trendLine} points={line} />
        {points.map((p) => (
          <circle
            key={p.workspaceId}
            className={
              p.workspaceId === current.workspaceId ? styles.trendDotCurrent : styles.trendDot
            }
            cx={p.x}
            cy={p.y}
            r={p.workspaceId === current.workspaceId ? 4.5 : 3}
          />
        ))}
      </svg>

      <p className={styles.trendCaption}>{t('evaluation.trendCaption')}</p>
    </div>
  )
}
