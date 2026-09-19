import { useMemo, useState } from 'react'
import type { EvaluationFindingDTO } from '../../../dto/EvaluationReportDTO'
import { CATEGORY_BADGE_CLASS, CATEGORY_LABEL } from '../lib/findingLabels'
import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/Evaluation.module.css'

type Category = EvaluationFindingDTO['category']

/** The order findings are grouped and filtered in: what needs work, first. */
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
 * A grid rather than the slider this used to be. A slider shows one finding at a
 * time, which is the right shape on a phone and the wrong one on a 1080px column:
 * eight findings meant eight arrow presses to learn something the set answers at
 * a glance — that every gap this session left was about mechanism, not naming.
 * The filter chips are the part a slider cannot do at all.
 */
export function EvaluatorNotes({ findings, onPractice }: EvaluatorNotesProps) {
  const t = useT()
  const [filter, setFilter] = useState<Category | 'ALL'>('ALL')
  const [openIndex, setOpenIndex] = useState<number | null>(null)
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

  const visible = useMemo(() => {
    const ordered = [...findings].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    )
    return filter === 'ALL' ? ordered : ordered.filter((f) => f.category === filter)
  }, [findings, filter])

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
          onClick={() => {
            setFilter('ALL')
            setOpenIndex(null)
          }}
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
            onClick={() => {
              setFilter(category)
              setOpenIndex(null)
            }}
          >
            <span className={`${styles.filterDot} ${CATEGORY_BADGE_CLASS[category]}`} />
            {t(CATEGORY_LABEL[category])}
            <span className={styles.filterCount}>{counts.get(category)}</span>
          </button>
        ))}
      </div>

      <div className={styles.findingsBoard}>
        {visible.map((finding) => {
          // Index within the whole set, so the open card survives a filter change.
          const index = findings.indexOf(finding)
          const open = openIndex === index
          return (
            <div
              key={index}
              className={`${styles.findingCard} ${open ? styles.findingCardOpen : ''}`}
            >
              <button
                type="button"
                className={styles.findingCardHead}
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? null : index)}
              >
                <span className={`${styles.findingBadge} ${CATEGORY_BADGE_CLASS[finding.category]}`}>
                  {t(CATEGORY_LABEL[finding.category])}
                </span>
                <span className={styles.findingCardConcept}>{finding.concept}</span>
              </button>

              {open && (
                <div className={styles.findingCardBody}>
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
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
