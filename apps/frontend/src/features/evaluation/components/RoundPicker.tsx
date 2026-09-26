import type { EvaluationRoundSummaryDTO } from '../../../dto/EvaluationReportDTO'
import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/Evaluation.module.css'

interface RoundPickerProps {
  rounds: EvaluationRoundSummaryDTO[]
  selected: number
  onSelect: (round: number) => void
}

/**
 * Which finished round of this workspace is being read.
 *
 * A workspace used to keep one debrief: choosing "continue teaching" and
 * finishing again deleted the previous one, so the round a user most wanted to
 * compare against was the one the app had just thrown away. Rounds are kept
 * now, and this is how you move between them.
 *
 * Hidden at one round, where there is nothing to choose and a lone tab would
 * only ask a question the session cannot answer yet.
 */
export function RoundPicker({ rounds, selected, onSelect }: RoundPickerProps) {
  const t = useT()
  if (rounds.length < 2) return null

  const latest = rounds[rounds.length - 1].round

  return (
    <div className={styles.roundPicker}>
      <span className={styles.roundPickerLabel}>{t('evaluation.roundPickerLabel')}</span>

      <div className={styles.roundTabs} role="tablist" aria-label={t('evaluation.roundPickerLabel')}>
        {rounds.map((round) => {
          const active = round.round === selected
          return (
            <button
              key={round.round}
              type="button"
              role="tab"
              aria-selected={active}
              className={`${styles.roundTab} ${active ? styles.roundTabActive : ''}`}
              onClick={() => onSelect(round.round)}
            >
              <span className={styles.roundTabName}>
                {t('evaluation.roundLabel', { round: round.round })}
              </span>
              {/* The score is on the tab because it is the reason to switch:
                  comparing rounds is the whole point of keeping them. */}
              <span className={styles.roundTabScore}>{round.score}</span>
            </button>
          )
        })}
      </div>

      {selected !== latest && (
        <p className={styles.roundNotice}>{t('evaluation.viewingOlderRound')}</p>
      )}
    </div>
  )
}
