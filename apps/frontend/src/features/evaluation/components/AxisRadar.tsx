import type { ScoreAxis } from '../lib/scoreAxes'
import styles from '../../../styles/Evaluation.module.css'

/**
 * The four axes as one shape.
 *
 * Native SVG on purpose: the project ships no charting library, and pulling one
 * in for a single four-point polygon would cost more than the drawing. The maths
 * is four points on a circle.
 *
 * It does not replace the numbered cards below it, it summarises them. The shape
 * answers "is this lopsided?" at a glance; the cards still carry the number and
 * the sentence explaining what each one counted.
 */

/* Wider than it is tall, because the left and right axis tips carry text that
   a square viewBox clips. */
const WIDTH = 260
const HEIGHT = 200
const CX = WIDTH / 2
const CY = HEIGHT / 2
const RADIUS = 66
const RINGS = [0.25, 0.5, 0.75, 1]

/** Top, right, bottom, left, in the order the axes are declared. */
function pointAt(index: number, total: number, fraction: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  return {
    x: CX + Math.cos(angle) * RADIUS * fraction,
    y: CY + Math.sin(angle) * RADIUS * fraction,
  }
}

interface AxisRadarProps {
  axes: ScoreAxis[]
}

export function AxisRadar({ axes }: AxisRadarProps) {
  const total = axes.length
  if (total < 3) return null

  // An unmeasurable axis plots at the centre. The card under it still says
  // "belum terukur", so the shape is never the only thing telling the story.
  const polygon = axes
    .map((axis, i) => {
      const p = pointAt(i, total, (axis.value ?? 0) / 100)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')

  const label = axes
    .map((a) => `${a.label} ${a.value === null ? 'belum terukur' : a.value}`)
    .join(', ')

  return (
    <div className={styles.radarWrap}>
      <svg
        className={styles.radar}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Bentuk skor per aksis: ${label}`}
      >
        {RINGS.map((r) => (
          <polygon
            key={r}
            className={styles.radarRing}
            points={axes
              .map((_, i) => {
                const p = pointAt(i, total, r)
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
              })
              .join(' ')}
          />
        ))}

        {axes.map((_, i) => {
          const p = pointAt(i, total, 1)
          return (
            <line
              key={i}
              className={styles.radarSpoke}
              x1={CX}
              y1={CY}
              x2={p.x}
              y2={p.y}
            />
          )
        })}

        <polygon className={styles.radarShape} points={polygon} />

        {axes.map((axis, i) => {
          const p = pointAt(i, total, (axis.value ?? 0) / 100)
          return <circle key={axis.key} className={styles.radarDot} cx={p.x} cy={p.y} r="3.5" />
        })}

        {axes.map((axis, i) => {
          const p = pointAt(i, total, 1.34)
          return (
            <text
              key={axis.key}
              className={styles.radarLabel}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {axis.short}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
