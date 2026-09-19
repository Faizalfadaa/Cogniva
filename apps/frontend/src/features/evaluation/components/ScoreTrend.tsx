import { useMemo } from 'react'
import type { ScoreHistoryPointDTO } from '../../../dto/EvaluationReportDTO'
import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/Evaluation.module.css'

/* Wide and short, because this is a strip that answers "which way" — not a
   chart to be studied. The ratio matters as much as the numbers: the SVG scales
   to its container, so a squarer viewBox is what made this render 400px tall
   and take up more of the score card than the score. Room is still reserved on
   the left for the y-axis numbers, above for the y-axis name, and underneath
   for the x-axis labels and name, so none of them can land on the line. */
const WIDTH = 340
const HEIGHT = 120
const PAD_LEFT = 32
const PAD_RIGHT = 14
const PAD_TOP = 22
const PLOT_BOTTOM = 88

/** The score scale, fixed at 0..100 and labelled at these marks. */
const Y_TICKS = [0, 50, 100]

interface ScoreTrendProps {
  history: ScoreHistoryPointDTO[]
  /** The workspace being read. */
  currentWorkspaceId: string
  /**
   * The round being read, which the workspace id alone no longer identifies:
   * a workspace taught twice contributes two points, and only one of them is
   * the one on screen.
   */
  currentRound: number
}

/** Unique per point now that a workspace can contribute several. */
function keyOf(point: { workspaceId: string; round: number }): string {
  return `${point.workspaceId}#${point.round}`
}

/** Score to a y pixel, on a scale that is always 0..100. */
function yFor(score: number): number {
  return PAD_TOP + ((100 - score) / 100) * (PLOT_BOTTOM - PAD_TOP)
}

/**
 * Where this score sits in the run of sessions before it.
 *
 * A single score answers "how did this go" and nothing about whether teaching is
 * getting better, which is the question a second session makes askable. Hidden
 * below two points on purpose: one point is not a trend, and a lone dot on an
 * empty axis reads as a chart that failed to load.
 *
 * Both axes are drawn and labelled. Without them this was a line that went up
 * or down by an amount nobody could name: the y scale was invisible, so a climb
 * from 40 to 45 looked identical to one from 40 to 90, and nothing said what a
 * dot was. Now the y axis carries the score scale and the x axis names each
 * session, so the shape can be read off it rather than guessed at.
 *
 * The y scale is fixed at 0..100 rather than fitted to the data, for the same
 * reason. A fitted scale turns three scores a point apart into a dramatic
 * climb; the whole value of this strip is that a small gain looks small.
 */
export function ScoreTrend({ history, currentWorkspaceId, currentRound }: ScoreTrendProps) {
  const t = useT()

  const points = useMemo(
    () =>
      history.map((point, i) => ({
        ...point,
        x:
          history.length === 1
            ? (PAD_LEFT + WIDTH - PAD_RIGHT) / 2
            : PAD_LEFT + (i * (WIDTH - PAD_LEFT - PAD_RIGHT)) / (history.length - 1),
        y: yFor(point.score),
      })),
    [history],
  )

  if (points.length < 2) return null

  const currentIndex = points.findIndex(
    (p) => p.workspaceId === currentWorkspaceId && p.round === currentRound,
  )
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
        aria-label={points
          .map((p) => `${p.title ?? t('home.untitledWorkspace')} ${p.score}`)
          .join(', ')}
      >
        {/* Y axis: the score scale, with a gridline at each labelled mark. */}
        {Y_TICKS.map((tick) => {
          const y = yFor(tick)
          return (
            <g key={tick}>
              <line
                className={styles.trendGrid}
                x1={PAD_LEFT}
                y1={y}
                x2={WIDTH - PAD_RIGHT}
                y2={y}
              />
              <text className={styles.trendAxisTick} x={PAD_LEFT - 6} y={y} textAnchor="end">
                {tick}
              </text>
            </g>
          )
        })}

        <polyline className={styles.trendLine} points={line} />

        {points.map((p, i) => {
          const isCurrent = keyOf(p) === keyOf(current)
          return (
            <g key={keyOf(p)}>
              <circle
                className={isCurrent ? styles.trendDotCurrent : styles.trendDot}
                cx={p.x}
                cy={p.y}
                r={isCurrent ? 4.5 : 3}
              />
              {/* The value on the point, so the exact number never has to be
                  read off the axis by eye. The end points lean inward: centred
                  on the first dot, the label sat on top of the y-axis numbers,
                  and on the last it ran past the right edge. */}
              <text
                className={isCurrent ? styles.trendValueCurrent : styles.trendValue}
                x={p.x + (i === 0 ? 4 : i === points.length - 1 ? -4 : 0)}
                y={p.y - 9}
                textAnchor={
                  i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'
                }
              >
                {p.score}
              </text>
              {/* X axis: which session this dot is. Numbered rather than
                  titled, because titles are user-written and would collide at
                  this width; the legend under the chart maps the numbers. */}
              <text
                className={styles.trendAxisTick}
                x={p.x}
                y={PLOT_BOTTOM + 14}
                textAnchor="middle"
              >
                {i + 1}
              </text>
            </g>
          )
        })}

        {/* Axis titles, so neither scale has to be inferred. The y name sits on
            its own row above the plot rather than beside the topmost tick,
            which is where it collided with the "100". */}
        <text className={styles.trendAxisName} x={0} y={10} textAnchor="start">
          {t('evaluation.trendAxisY')}
        </text>
        <text
          className={styles.trendAxisName}
          x={(PAD_LEFT + WIDTH - PAD_RIGHT) / 2}
          y={HEIGHT - 4}
          textAnchor="middle"
        >
          {t('evaluation.trendAxisX')}
        </text>
      </svg>

      {/* Which numbered session is which, including the round when a workspace
          was taught more than once. */}
      <ol className={styles.trendLegend}>
        {points.map((p, i) => (
          <li
            key={keyOf(p)}
            className={`${styles.trendLegendItem} ${
              keyOf(p) === keyOf(current) ? styles.trendLegendCurrent : ''
            }`}
          >
            <span className={styles.trendLegendIndex}>{i + 1}</span>
            <span className={styles.trendLegendName}>
              {p.title ?? t('home.untitledWorkspace')}
              {p.round > 1 && ` · ${t('evaluation.roundLabel', { round: p.round })}`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
