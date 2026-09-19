import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EvaluationFindingDTO } from '../../../dto/EvaluationReportDTO'
import { CATEGORY_BADGE_CLASS, CATEGORY_LABEL } from '../lib/findingLabels'
import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/Evaluation.module.css'

type Category = EvaluationFindingDTO['category']

/** The order the chips appear in, and the order findings are read in. */
const CATEGORY_ORDER: Category[] = ['WRONG', 'MISSED', 'CONFUSING', 'CORRECT']

interface EvaluatorNotesProps {
  findings: EvaluationFindingDTO[]
  /** Open a new session pointed at one concept. */
  onPractice: (concept: string) => void
}

/**
 * The Evaluator's own assessment, one card per finding.
 *
 * Deliberately not attributed to the learner character. The text in a finding is
 * written about the user in the third person, so presenting it as the student's
 * private notebook made the label and the contents disagree. This section says
 * plainly that it is the system's judgement; the character speaks in the letter
 * at the bottom of the tab and nowhere else.
 *
 * The slider follows the landing page's TeamSlider: a scroll-snapping track with
 * arrows and an IntersectionObserver marking the card in view. The clone-based
 * infinite loop is not reused. Findings are a finite, ordered assessment, so
 * wrapping past the last one would hide how much is left to read; the arrows
 * stop at the ends instead.
 *
 * The chips above it are the one thing a slider cannot do on its own. Reading
 * one card at a time is fine for taking in a judgement, but it cannot answer
 * "how many did I get wrong" without walking the whole set, so the counts sit
 * above the track and filtering narrows what the track holds.
 */
export function EvaluatorNotes({ findings, onPractice }: EvaluatorNotesProps) {
  const t = useT()
  const trackRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [filter, setFilter] = useState<Category | 'ALL'>('ALL')
  const [starting, setStarting] = useState<string | null>(null)

  const counts = useMemo(() => {
    const byCategory = new Map<Category, number>()
    findings.forEach((f) => byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1))
    return byCategory
  }, [findings])

  // Only the categories this session actually produced get a chip. A row of
  // zeroes would read as four things to check rather than one thing to fix.
  const chips = useMemo(
    () => CATEGORY_ORDER.filter((c) => (counts.get(c) ?? 0) > 0),
    [counts],
  )

  /** Worst first, so the cards that need action are the ones you reach first. */
  const visible = useMemo(() => {
    const ordered = [...findings].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    )
    return filter === 'ALL' ? ordered : ordered.filter((f) => f.category === filter)
  }, [findings, filter])

  /**
   * Pad the track by half the leftover width at each end.
   *
   * Without it the first and last cards physically cannot reach the middle:
   * they hit the container edge first, so a centre-band test never fires for
   * them and the last card stays dim no matter how far right you scroll.
   * TeamSlider does not hit this because its clones always leave real content
   * past either edge; a finite list has to buy that room with padding instead.
   *
   * Measured from the live layout rather than derived from the card's clamped
   * width, which is the same approach TeamSlider takes for its own offsets.
   */
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const applyPadding = () => {
      const card = cardRefs.current[0]
      if (!card) return
      const pad = Math.max(0, (track.clientWidth - card.offsetWidth) / 2)
      track.style.paddingLeft = `${pad}px`
      track.style.paddingRight = `${pad}px`
    }

    // Twice on every trigger: the card's clamped width and the track's own
    // width settle in the same pass, so a single synchronous read can catch the
    // card at its previous size and bake a stale padding in.
    let settle = 0
    const run = () => {
      applyPadding()
      cancelAnimationFrame(settle)
      settle = requestAnimationFrame(applyPadding)
    }

    run()
    const ro = new ResizeObserver(run)
    ro.observe(track)
    // The card as well as the track. Card width is sized against the viewport
    // while the track sits in a fixed-width column, so narrowing the window
    // changes the card and leaves the track untouched: observing only the track
    // would never notice, and the padding would stay at its first value.
    if (cardRefs.current[0]) ro.observe(cardRefs.current[0])
    return () => {
      cancelAnimationFrame(settle)
      ro.disconnect()
    }
  }, [visible.length])

  /**
   * Active card = the one whose centre sits closest to the track's centre.
   *
   * Geometry, not an observer verdict. An IntersectionObserver only reports
   * what crosses its band, so a card that stops just short of the middle
   * reports nothing and the previous winner stays highlighted: that is how the
   * last card stayed dim at the end of the scroll. Here the observer is only a
   * cheap "something moved" signal, and the answer always comes from measuring
   * all the cards.
   */
  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const centre = track.scrollLeft + track.clientWidth / 2
    let best = 0
    let bestDistance = Infinity
    cardRefs.current.forEach((card, i) => {
      if (!card) return
      const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - centre)
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    })
    setActive(best)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }

    // Thresholds all the way up so partial movement keeps re-firing, which is
    // what turns the observer into a scroll signal rather than a verdict.
    const io = new IntersectionObserver(schedule, {
      root: track,
      threshold: [0, 0.25, 0.5, 0.75, 1],
    })
    cardRefs.current.forEach((el) => el && io.observe(el))

    track.addEventListener('scroll', schedule, { passive: true })
    track.addEventListener('scrollend', schedule)
    schedule()

    return () => {
      io.disconnect()
      track.removeEventListener('scroll', schedule)
      track.removeEventListener('scrollend', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [visible.length, measure])

  /**
   * Scroll a card to the centre. `active` is set here rather than waiting for
   * the measurement, so an arrow press is never at the mercy of whether a
   * scroll signal arrives.
   */
  function goTo(index: number) {
    const track = trackRef.current
    const card = cardRefs.current[index]
    if (!track || !card) return
    setActive(index)
    track.scrollTo({
      left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2,
      behavior: 'smooth',
    })
  }

  function nudge(direction: 1 | -1) {
    goTo(Math.min(visible.length - 1, Math.max(0, active + direction)))
  }

  /**
   * Narrowing the set leaves the track scrolled where the old set was, which
   * reads as a slider that jumped somewhere arbitrary. Snap back to the first
   * card of whatever is now showing.
   */
  function applyFilter(next: Category | 'ALL') {
    setFilter(next)
    setActive(0)
    cardRefs.current = []
    trackRef.current?.scrollTo({ left: 0 })
  }

  if (findings.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionLabel}>
          <span>{t('evaluation.notesTitle')}</span>
        </div>
        <div className={styles.findingsEmpty}>
          <p className={styles.findingsEmptyTitle}>{t('evaluation.nothingToAssess')}</p>
          <p className={styles.findingsEmptyHint}>{t('evaluation.notesEmptyHint')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>
        <span>{t('evaluation.notesTitle')}</span>
      </div>
      <p className={styles.notesIntro}>{t('evaluation.notesIntro')}</p>

      <div className={styles.filterRow} role="group" aria-label={t('evaluation.filterAria')}>
        <button
          type="button"
          className={styles.filterChip}
          aria-pressed={filter === 'ALL'}
          onClick={() => applyFilter('ALL')}
        >
          {t('evaluation.filterAll')}
          <span className={styles.filterCount}>{findings.length}</span>
        </button>

        {chips.map((category) => (
          <button
            key={category}
            type="button"
            className={styles.filterChip}
            aria-pressed={filter === category}
            onClick={() => applyFilter(category)}
          >
            <span className={`${styles.filterDot} ${CATEGORY_BADGE_CLASS[category]}`} />
            {t(CATEGORY_LABEL[category])}
            <span className={styles.filterCount}>{counts.get(category)}</span>
          </button>
        ))}
      </div>

      <div className={styles.notesSlider}>
        <button
          type="button"
          className={`${styles.notesArrow} ${styles.notesArrowLeft}`}
          onClick={() => nudge(-1)}
          disabled={active === 0}
          aria-label={t('evaluation.prevFinding')}
        >
          {'‹'}
        </button>

        <div ref={trackRef} className={styles.notesTrack}>
          {visible.map((finding, i) => (
            <div
              key={`${filter}-${i}`}
              ref={(el) => {
                cardRefs.current[i] = el
              }}
              className={
                i === active ? `${styles.noteCard} ${styles.noteCardActive}` : styles.noteCard
              }
            >
              <div className={styles.noteCardTop}>
                <span
                  className={`${styles.findingBadge} ${CATEGORY_BADGE_CLASS[finding.category]}`}
                >
                  {t(CATEGORY_LABEL[finding.category])}
                </span>
                <span className={styles.noteCardCount}>
                  {i + 1} / {visible.length}
                </span>
              </div>

              <p className={styles.noteConcept}>{finding.concept}</p>
              <p className={styles.noteDetail}>{finding.detail}</p>

              {finding.followUp && (
                <div className={styles.followUpBox}>
                  <p className={styles.followUpLabel}>{t('evaluation.followUpLabel')}</p>
                  <p className={styles.followUpText}>{finding.followUp}</p>
                </div>
              )}

              {/* Only where something is actually owed. A CORRECT finding has
                  nothing to practise, and offering it anyway would make the
                  button mean "another session" rather than "fix this". */}
              {finding.category !== 'CORRECT' && (
                <button
                  type="button"
                  className={styles.practiceButton}
                  disabled={starting !== null}
                  onClick={() => {
                    setStarting(finding.concept)
                    onPractice(finding.concept)
                  }}
                >
                  {starting === finding.concept
                    ? t('evaluation.opening')
                    : t('evaluation.practiceConcept')}
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          className={`${styles.notesArrow} ${styles.notesArrowRight}`}
          onClick={() => nudge(1)}
          disabled={active === visible.length - 1}
          aria-label={t('evaluation.nextFinding')}
        >
          {'›'}
        </button>
      </div>
    </section>
  )
}
