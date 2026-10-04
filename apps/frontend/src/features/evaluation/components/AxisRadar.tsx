import type { ScoreAxis } from '../lib/scoreAxes'
import { useT } from '../../../i18n/LanguageProvider'
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
 *
 * Pointing at a vertex lights the card that explains it (and the reverse), so
 * the two halves stop being two drawings of the same numbers and start being one
 * control: the shape says which corner is short, the card says by how much. The
 * vertices are focusable for the same reason — a keyboard reader gets the link
 * too, and the tooltip doubles as the hover text a pointer user sees.
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
  /** Key of the axis currently pointed at, from either the shape or a card. */
  activeKey: string | null
  onActiveChange: (key: string | null) => void
}

export function AxisRadar({ axes, activeKey, onActiveChange }: AxisRadarProps) {
  const t = useT()
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
    .map((a) => `${a.label} ${a.value === null ? t('evaluation.notMeasured') : a.value}`)
    .join(', ')

  return (
    <div className={styles.radarWrap}>
      <svg
        className={styles.radar}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${t('evaluation.radarAria')}: ${label}`}
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
          const active = activeKey === axis.key
          return (
            <circle
              key={axis.key}
              className={`${styles.radarDot} ${active ? styles.radarDotActive : ''}`}
              cx={p.x}
              cy={p.y}
              r={active ? 6 : 3.5}
              tabIndex={0}
              role="button"
              aria-label={`${axis.label}: ${
                axis.value === null ? t('evaluation.notMeasured') : axis.value
              }`}
              onMouseEnter={() => onActiveChange(axis.key)}
              onMouseLeave={() => onActiveChange(null)}
              onFocus={() => onActiveChange(axis.key)}
              onBlur={() => onActiveChange(null)}
            />
          )
        })}

        {axes.map((axis, i) => {
          const p = pointAt(i, total, 1.34)
          const active = activeKey === axis.key
          return (
            <text
              key={axis.key}
              className={`${styles.radarLabel} ${active ? styles.radarLabelActive : ''}`}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              onMouseEnter={() => onActiveChange(axis.key)}
              onMouseLeave={() => onActiveChange(null)}
            >
              {axis.short}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
