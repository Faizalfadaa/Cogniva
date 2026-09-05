import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from '../../styles/ProductTour.module.css'

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TourStep {
  /** CSS selector for the element to highlight, e.g. '[data-tour="mic-button"]'. */
  selector: string
  title: string
  body: string
  /** Preferred side for the callout. Flipped automatically when it won't fit. */
  placement?: TourPlacement
}

interface ProductTourProps {
  steps: TourStep[]
  /** Active step. Controlled, so the host owns where the tour is. */
  index: number
  /**
   * Asked for a different step. The tour raises this for "Next" AND for the
   * auto-skip when a target is missing, so it cannot move on its own.
   */
  onIndexChange: (next: number) => void
  onFinish: () => void
  onSkip: () => void
  /** Label for the button on the final step. The home leg of a multi-screen
   *  tour is not "done" — it continues on the next screen. */
  finishLabel?: string
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/** Breathing room between the highlighted element and the hole's edge. */
const PAD = 8
/** Distance between the hole and the callout. */
const GAP = 14
/** Smallest allowed distance from the callout to the viewport edge. */
const MARGIN = 16
/** Above this share of the viewport a target is "the whole screen", and the
 *  callout is centred instead of hung off one edge. */
const LARGE_TARGET_RATIO = 0.6

const OPPOSITE: Record<TourPlacement, TourPlacement> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

/** Measure a target, or null when it is absent or not rendered. */
function measure(selector: string): { box: Box; radius: string } | null {
  const el = document.querySelector(selector)
  if (!el) return null

  const r = el.getBoundingClientRect()
  // A zero-sized rect means display:none or an unmounted-but-present node —
  // there is nothing to point at, so treat it exactly like "missing".
  if (r.width === 0 || r.height === 0) return null

  return {
    box: {
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    },
    // Borrow the element's own corner radius so a pill button gets a pill hole
    // rather than a rectangle with the button rattling around inside it.
    radius: window.getComputedStyle(el).borderRadius || '10px',
  }
}

function sameBox(a: Box, b: Box): boolean {
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

function placeAt(
  box: Box,
  tw: number,
  th: number,
  placement: TourPlacement | 'center',
  vw: number,
  vh: number
): { top: number; left: number } {
  switch (placement) {
    case 'top':
      return { top: box.top - GAP - th, left: box.left + box.width / 2 - tw / 2 }
    case 'bottom':
      return { top: box.top + box.height + GAP, left: box.left + box.width / 2 - tw / 2 }
    case 'left':
      return { top: box.top + box.height / 2 - th / 2, left: box.left - GAP - tw }
    case 'right':
      return { top: box.top + box.height / 2 - th / 2, left: box.left + box.width + GAP }
    default:
      return { top: vh / 2 - th / 2, left: vw / 2 - tw / 2 }
  }
}

function fits(pos: { top: number; left: number }, tw: number, th: number, vw: number, vh: number) {
  return (
    pos.top >= MARGIN &&
    pos.left >= MARGIN &&
    pos.top + th <= vh - MARGIN &&
    pos.left + tw <= vw - MARGIN
  )
}

function clamp(pos: { top: number; left: number }, tw: number, th: number, vw: number, vh: number) {
  return {
    top: Math.min(Math.max(pos.top, MARGIN), Math.max(MARGIN, vh - th - MARGIN)),
    left: Math.min(Math.max(pos.left, MARGIN), Math.max(MARGIN, vw - tw - MARGIN)),
  }
}

/**
 * Where to put the callout: the requested side first, then its opposite, then
 * anything that fits, and finally the middle of the screen.
 *
 * The fallback chain is what keeps the callout off the chat launcher and the
 * toast stack in the bottom-right corner — a step anchored down there asks for
 * 'left', and only slides elsewhere if that genuinely does not fit.
 */
function computePosition(
  box: Box,
  tw: number,
  th: number,
  placement: TourPlacement
): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  // A target the size of the whiteboard has no "outside" left on screen.
  if (box.height > vh * LARGE_TARGET_RATIO && box.width > vw * LARGE_TARGET_RATIO) {
    return clamp(placeAt(box, tw, th, 'center', vw, vh), tw, th, vw, vh)
  }

  const order: TourPlacement[] = [
    placement,
    OPPOSITE[placement],
    ...(['bottom', 'top', 'right', 'left'] as TourPlacement[]),
  ]

  for (const p of order) {
    const pos = placeAt(box, tw, th, p, vw, vh)
    if (fits(pos, tw, th, vw, vh)) return pos
  }

  return clamp(placeAt(box, tw, th, 'center', vw, vh), tw, th, vw, vh)
}

/**
 * Spotlight tour: darkens the screen, cuts a hole over one real UI element at a
 * time, and explains it in a callout beside the hole.
 *
 * It reaches its targets through `data-tour` attributes and document.
 * querySelector rather than refs threaded down through the tree, so adding the
 * tour to a screen costs one attribute per element and nothing else.
 */
export function ProductTour({
  steps,
  index,
  onIndexChange,
  onFinish,
  onSkip,
  finishLabel = 'Done',
}: ProductTourProps) {
  const [target, setTarget] = useState<{ box: Box; radius: string } | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  const step = steps[index]
  const isLast = index >= steps.length - 1

  const goNext = useCallback(() => {
    if (isLast) onFinish()
    else onIndexChange(index + 1)
  }, [index, isLast, onFinish, onIndexChange])

  // The measuring effect must re-run when the STEP changes and at no other
  // time. Reading the callbacks through a ref keeps a caller that re-creates
  // its handlers every render (the common case) from re-triggering it — which
  // would loop, because the effect itself sets state.
  const actions = useRef({ goNext, onFinish })
  actions.current = { goNext, onFinish }

  // ── Track the target's geometry ──────────────────────────────────────────
  useLayoutEffect(() => {
    // Ran past the end (all remaining steps were skipped, say).
    if (!step) {
      actions.current.onFinish()
      return
    }

    const found = measure(step.selector)
    if (!found) {
      // Target is not on screen — a mic button hidden because permission was
      // denied, an element behind a closed menu. Move on instead of stalling on
      // an empty spotlight. Each step is visited at most once, so a run where
      // nothing resolves walks to the end and finishes.
      actions.current.goNext()
      return
    }

    setTarget(found)
    setPos(null) // re-measure the callout against the new box before showing it

    const update = () => {
      const next = measure(step.selector)
      if (!next) return
      // Only publish real movement: scroll fires continuously, and a new object
      // on every event would re-render (and reposition the callout) for nothing.
      setTarget((prev) => (prev && sameBox(prev.box, next.box) ? prev : next))
    }

    window.addEventListener('resize', update)
    // Capture phase: scrolling inside the canvas or the chat panel moves the
    // target too, and those events never reach window in the bubble phase.
    window.addEventListener('scroll', update, true)

    const el = document.querySelector(step.selector)
    const observer = new ResizeObserver(update)
    if (el) observer.observe(el)
    observer.observe(document.body)

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      observer.disconnect()
    }
    // Intentionally keyed on the step alone; callbacks come from `actions`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ── Position the callout once its real size is known ─────────────────────
  useLayoutEffect(() => {
    if (!target || !tipRef.current) return
    const tip = tipRef.current.getBoundingClientRect()
    setPos(computePosition(target.box, tip.width, tip.height, step?.placement ?? 'bottom'))
  }, [target, step])

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onSkip()
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, onSkip])

  // Move focus to the callout so the tour is reachable by keyboard and screen
  // readers announce it on every step.
  useEffect(() => {
    if (pos) tipRef.current?.focus()
  }, [pos, index])

  if (!step || !target) return null

  return (
    <>
      <div className={styles.backdrop} />

      <div
        className={styles.spotlight}
        style={{
          top: target.box.top,
          left: target.box.left,
          width: target.box.width,
          height: target.box.height,
          borderRadius: target.radius,
        }}
      />

      <div
        ref={tipRef}
        className={styles.tooltip}
        style={{
          top: pos?.top ?? 0,
          left: pos?.left ?? 0,
          // Rendered but invisible for the first pass so its height can be
          // measured; shown once the real position is known.
          visibility: pos ? 'visible' : 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
      >
        <span className={styles.counter}>
          {index + 1} / {steps.length}
        </span>
        <h3 id="tour-title" className={styles.title}>
          {step.title}
        </h3>
        <p id="tour-body" className={styles.body}>
          {step.body}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={onSkip}>
            Skip tour
          </button>
          <div className={styles.spacer} />
          <button type="button" className={styles.next} onClick={goNext}>
            {isLast ? finishLabel : 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}
