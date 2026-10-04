import { useMemo } from 'react'
import type {
  EvaluationFindingDTO,
  EvaluationTranscriptTurnDTO,
} from '../../../dto/EvaluationReportDTO'
import type { TeachingCheckpointDTO } from '../../../dto/TeachingCheckpointDTO'
import { CATEGORY_BADGE_CLASS, CATEGORY_LABEL } from '../lib/findingLabels'
import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/Evaluation.module.css'

type Category = EvaluationFindingDTO['category']

/** Worst first: a turn with one WRONG note is a WRONG turn, whatever else it holds. */
const SEVERITY: Category[] = ['WRONG', 'CONFUSING', 'MISSED', 'CORRECT']

interface SessionSnapshotProps {
  transcript: EvaluationTranscriptTurnDTO[]
  findings: EvaluationFindingDTO[]
  /** Null while the Detail tab's lazy fetch is still in flight. */
  checkpoints: TeachingCheckpointDTO[] | null
}

function countWords(text: string | undefined): number {
  if (!text) return 0
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length
}

/** "6m 42s", or "48s" under a minute. Seconds are dropped above an hour. */
function formatSpan(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

/**
 * How long the teaching ran, and the longest the user paused inside it.
 *
 * Measured between "Teach" presses, which is what the checkpoints record — not
 * the whole session, which would include the time the debrief itself took. The
 * labels say "teaching" for that reason. Deliberately never scored: how long
 * someone thinks before explaining is not a measure of how well they explained.
 */
function timingFrom(checkpoints: TeachingCheckpointDTO[]): {
  spanMs: number
  /**
   * Null with only two turns. There is exactly one gap then, and it equals the
   * span — printing the same number under two labels reads as a bug, not as
   * two facts.
   */
  longestGapMs: number | null
} | null {
  if (checkpoints.length < 2) return null
  const times = checkpoints
    .map((c) => new Date(c.createdAt).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)
  if (times.length < 2) return null

  let longestGapMs = 0
  for (let i = 1; i < times.length; i++) {
    longestGapMs = Math.max(longestGapMs, times[i] - times[i - 1])
  }
  return {
    spanMs: times[times.length - 1] - times[0],
    longestGapMs: times.length > 2 ? longestGapMs : null,
  }
}

/**
 * The shape of the session, above the transcript that spells it out.
 *
 * The Detail tab used to open straight into the transcript, which answers "what
 * did I say" but never "how much did I say, and where did it go wrong" — so a
 * reader had to scroll the whole thing to find the two turns worth re-reading.
 * These are counts of what the report already carries, not new measurements:
 * turns and words come from the transcript, the concept figures from the same
 * findings the Summary tab lists.
 *
 * The turn rail is the part that earns its place. Each turn gets a dot in its
 * worst finding's colour, so the one turn that confused the student is findable
 * before reading a word of it.
 */
export function SessionSnapshot({ transcript, findings, checkpoints }: SessionSnapshotProps) {
  const t = useT()
  const timing = useMemo(() => (checkpoints ? timingFrom(checkpoints) : null), [checkpoints])

  const stats = useMemo(() => {
    const words = transcript.reduce(
      (sum, turn) => sum + countWords(turn.boardText) + countWords(turn.speech),
      0,
    )
    const missed = findings.filter((f) => f.category === 'MISSED').length
    return {
      turns: transcript.length,
      words,
      assessed: findings.length,
      covered: findings.length - missed,
    }
  }, [transcript, findings])

  /** The worst category noted on each turn, or null when the turn drew none. */
  const turnStatus = useMemo(() => {
    const worst = new Map<number, Category>()
    findings.forEach((finding) => {
      const at = finding.evidenceTurnIndex
      if (at === null || at === undefined) return
      const current = worst.get(at)
      if (!current || SEVERITY.indexOf(finding.category) < SEVERITY.indexOf(current)) {
        worst.set(at, finding.category)
      }
    })
    return worst
  }, [findings])

  if (transcript.length === 0 && findings.length === 0) return null

  function jumpToTurn(turnIndex: number) {
    document
      .getElementById(`transcript-turn-${turnIndex}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>
        <span>{t('evaluation.statsTitle')}</span>
      </div>

      <div className={styles.snapshotCard}>
        <div className={styles.statRow}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.turns}</span>
            <span className={styles.statLabel}>{t('evaluation.statTurns')}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.words}</span>
            <span className={styles.statLabel}>{t('evaluation.statWords')}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.assessed}</span>
            <span className={styles.statLabel}>{t('evaluation.statAssessed')}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.covered}</span>
            <span className={styles.statLabel}>{t('evaluation.statCovered')}</span>
          </div>

          {/* Timing needs at least two checkpoints to be a span rather than a
              moment, so it joins the row only when there is one to show. */}
          {timing && (
            <>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{formatSpan(timing.spanMs)}</span>
                <span className={styles.statLabel}>{t('evaluation.statSpan')}</span>
              </div>
              {timing.longestGapMs !== null && (
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{formatSpan(timing.longestGapMs)}</span>
                  <span className={styles.statLabel}>{t('evaluation.statLongestGap')}</span>
                </div>
              )}
            </>
          )}
        </div>

        {timing && <p className={styles.statCaveat}>{t('evaluation.timingCaveat')}</p>}

        {transcript.length > 0 && (
          <div className={styles.turnRail}>
            {transcript.map((turn) => {
              const status = turnStatus.get(turn.turnIndex)
              return (
                <button
                  key={turn.turnIndex}
                  type="button"
                  className={styles.turnChip}
                  onClick={() => jumpToTurn(turn.turnIndex)}
                >
                  <span
                    className={`${styles.turnChipDot} ${
                      status ? CATEGORY_BADGE_CLASS[status] : styles.turnChipDotPlain
                    }`}
                    aria-hidden="true"
                  />
                  {t('evaluation.turnLabel', { index: turn.turnIndex })}
                  {status && (
                    <span className={styles.turnChipStatus}>{t(CATEGORY_LABEL[status])}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
