import { useEffect, useMemo, useRef, useState } from 'react'
import styles from '../../styles/LandingPage.module.css'

interface TeamSliderProps {
  people: string[]
}

/** How many cards are duplicated at each end to make the seam invisible. */
const CLONES = 3

/**
 * The builders, as an endlessly looping horizontal slider.
 *
 * The loop is done with clones rather than by snapping back to the start: the
 * last few cards are copied in front of the list and the first few after it, so
 * there is always real content past either edge. When the scroll position
 * crosses out of the real range it is moved back by exactly one loop width with
 * a direct `scrollLeft` assignment (no animation). Because the card now under
 * the viewport is an identical copy, nothing visibly changes and the scroll
 * simply continues.
 *
 * The "active" card is still found with an IntersectionObserver watching a thin
 * band down the middle of the track. Clones are observed too, so a duplicate
 * sitting in the centre highlights exactly like the original.
 */
export function TeamSlider({ people }: TeamSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = useState(CLONES)

  /** Suppresses looping while an arrow's smooth scroll is still running: moving
   *  scrollLeft mid-animation cancels it and the jump becomes visible. */
  const animatingUntil = useRef(0)

  const items = useMemo(() => {
    if (people.length === 0) return []
    return [...people.slice(-CLONES), ...people, ...people.slice(0, CLONES)]
  }, [people])

  /**
   * `start` is the scroll offset that centres the first real card; `loop` is
   * the width of one full pass through the real cards. Measured from the live
   * layout rather than assumed, so gaps and clamped card widths are included.
   */
  const metrics = () => {
    const track = trackRef.current
    const first = cardRefs.current[CLONES]
    const firstTrailingClone = cardRefs.current[CLONES + people.length]
    if (!track || !first || !firstTrailingClone) return null

    const centre = (el: HTMLDivElement) =>
      el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2

    return { start: centre(first), loop: firstTrailingClone.offsetLeft - first.offsetLeft }
  }

  /** Pull the position back into the real range if it has drifted into clones. */
  const normalise = () => {
    const track = trackRef.current
    const m = metrics()
    if (!track || !m || m.loop <= 0) return

    if (track.scrollLeft >= m.start + m.loop) track.scrollLeft -= m.loop
    else if (track.scrollLeft < m.start) track.scrollLeft += m.loop
  }

  // Start on the first real card so the leading clones are never on screen.
  useEffect(() => {
    const track = trackRef.current
    const m = metrics()
    if (track && m) track.scrollLeft = m.start
    // Re-run when the set changes; layout is settled by the time effects run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  // Wrap on scroll, throttled to one check per frame.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (Date.now() < animatingUntil.current) return
        normalise()
      })
    }

    track.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      track.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, people.length])

  // Highlight whichever card crosses the middle of the track, clones included.
  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof IntersectionObserver === 'undefined') return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const i = cardRefs.current.indexOf(entry.target as HTMLDivElement)
          if (i >= 0) setActive(i)
        }
      },
      { root: track, rootMargin: '0px -48% 0px -48%', threshold: 0 }
    )

    cardRefs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [items.length])

  /**
   * One card per press. The position is wrapped *before* scrolling rather than
   * during, so a smooth scroll never has the ground moved under it, and the
   * loop stays seamless through the arrows as well as through dragging.
   */
  const nudge = (direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return

    normalise()

    const card = cardRefs.current[CLONES]
    const step = card ? card.offsetWidth + 20 : track.clientWidth * 0.6
    animatingUntil.current = Date.now() + 500
    track.scrollBy({ left: step * direction, behavior: 'smooth' })

    // Once the animation has settled, wrap if that press crossed an edge.
    window.setTimeout(() => {
      animatingUntil.current = 0
      normalise()
    }, 520)
  }

  return (
    <div className={styles.sliderWrap}>
      <button
        type="button"
        className={`${styles.sliderArrow} ${styles.sliderArrowLeft}`}
        onClick={() => nudge(-1)}
        aria-label="Previous"
      >
        ‹
      </button>

      <div ref={trackRef} className={styles.sliderTrack}>
        {items.map((person, i) => {
          // Clones repeat a name, so the key needs the position too. They are
          // also hidden from assistive tech: the same eight people should not
          // be announced fourteen times.
          const isClone = i < CLONES || i >= CLONES + people.length
          return (
            <div
              key={`${person}-${i}`}
              ref={(el) => {
                cardRefs.current[i] = el
              }}
              className={
                i === active ? `${styles.teamMember} ${styles.teamMemberActive}` : styles.teamMember
              }
              aria-hidden={isClone || undefined}
            >
              <div className={styles.teamPhoto} aria-hidden="true" />
              <div className={styles.teamMeta}>
                <span className={styles.teamName}>{person}</span>
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        className={`${styles.sliderArrow} ${styles.sliderArrowRight}`}
        onClick={() => nudge(1)}
        aria-label="Next"
      >
        ›
      </button>
    </div>
  )
}
