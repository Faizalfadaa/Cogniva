/**
 * One line icon per score axis.
 *
 * Inline SVG rather than an icon library or image assets: four glyphs is not
 * worth a dependency, and drawing them here lets them inherit `currentColor`
 * so they pick up the card's own text colour in both the dark score panel and
 * anywhere else they are reused.
 *
 * Each glyph names what its axis measures, not a generic decoration: a target
 * for hitting the mark, a checklist for coverage, a speech bubble for how
 * clearly it came across, a lamp for how far under the surface it went.
 */

const COMMON = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

/** Ketepatan: an arrow in the centre ring. */
function TargetIcon() {
  return (
    <svg {...COMMON}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
    </svg>
  )
}

/** Kelengkapan: a list with items ticked off. */
function ChecklistIcon() {
  return (
    <svg {...COMMON}>
      <path d="M4 7l2 2 3.5-3.5" />
      <path d="M4 17l2 2 3.5-3.5" />
      <path d="M13 7.5h7M13 17.5h7" />
    </svg>
  )
}

/** Kejelasan: a speech bubble, for how the explanation landed. */
function SpeechIcon() {
  return (
    <svg {...COMMON}>
      <path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5V7a2.5 2.5 0 0 1 2.5-2.5h10A2.5 2.5 0 0 1 20 7z" />
      <path d="M9 9.5h6M9 12.5h4" />
    </svg>
  )
}

/** Kedalaman: a lamp, for reaching the mechanism under the label. */
function LampIcon() {
  return (
    <svg {...COMMON}>
      <path d="M9.5 17.5h5M10.5 20.5h3" />
      <path d="M12 3.5a5.5 5.5 0 0 0-3 10.1v1.4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.4A5.5 5.5 0 0 0 12 3.5z" />
    </svg>
  )
}

/** Keyed to `ScoreAxis.key` in scoreAxes.ts. */
export const AXIS_ICON: Record<string, () => JSX.Element> = {
  accuracy: TargetIcon,
  completeness: ChecklistIcon,
  clarity: SpeechIcon,
  depth: LampIcon,
}
