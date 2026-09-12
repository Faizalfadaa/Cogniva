import { useMemo, useState } from 'react'
import type {
  EvaluationFindingDTO,
  EvaluationTranscriptTurnDTO,
} from '../../../dto/EvaluationReportDTO'
import { findingsForTurn, segmentTextForFindings, type QuoteField } from '../lib/highlightQuote'
import { CATEGORY_BADGE_CLASS, CATEGORY_LABEL, CATEGORY_MARK_CLASS } from '../lib/findingLabels'
import styles from '../../../styles/Evaluation.module.css'

interface TranscriptReviewProps {
  transcript: EvaluationTranscriptTurnDTO[]
  findings: EvaluationFindingDTO[]
}

/**
 * What the user taught, with the assessment attached where it happened.
 *
 * This used to be two stacked blocks: a list of findings, then the raw
 * transcript below it. Reading one meant holding the other in your head. Here
 * the transcript is the only thing on screen and every judgement hangs off the
 * words that earned it, so a highlight and its explanation are never more than
 * one click apart.
 *
 * A finding with no usable quote still gets a click target. It is listed under
 * the turn it cites instead of inside the text, and one that cites a turn this
 * report never stored is collected at the bottom rather than dropped.
 *
 * Identity is the finding's index in `findings`, so the mark in the text and the
 * panel that opens under it always agree on which note is showing.
 */
export function TranscriptReview({ transcript, findings }: TranscriptReviewProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const indexOf = useMemo(() => {
    const map = new Map<EvaluationFindingDTO, number>()
    findings.forEach((f, i) => map.set(f, i))
    return map
  }, [findings])

  const turnIndexes = useMemo(
    () => new Set(transcript.map((t) => t.turnIndex)),
    [transcript],
  )

  const orphans = findings.filter(
    (f) =>
      f.evidenceTurnIndex === null ||
      f.evidenceTurnIndex === undefined ||
      !turnIndexes.has(f.evidenceTurnIndex),
  )

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  /** Open a finding's panel, then scroll its advice into view once it exists. */
  const openAndScroll = (i: number) => {
    setOpenIndex(i)
    requestAnimationFrame(() => {
      document
        .getElementById(followUpDomId(i))
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>
        <span>Yang Kamu Ajarkan</span>
      </div>
      <p className={styles.notesIntro}>
        Bagian yang ditandai punya catatan penilaian. Klik untuk membukanya di tempat.
      </p>

      {transcript.length === 0 ? (
        <div className={styles.findingsEmpty}>
          <p className={styles.findingsEmptyTitle}>Transkrip tidak tersimpan.</p>
          <p className={styles.findingsEmptyHint}>
            Sesi ini selesai sebelum transkrip sempat direkam, atau laporannya dibuat
            lewat jalur pemulihan. Penilaian di bawah tetap berlaku, hanya tidak bisa
            ditunjukkan di teks aslinya.
          </p>
        </div>
      ) : (
        <ol className={styles.transcriptList}>
          {transcript.map((turn) => {
            const { quoted, wholeTurn } = findingsForTurn(findings, turn)
            const openHere = [...quoted.map((q) => q.finding), ...wholeTurn].find(
              (f) => indexOf.get(f) === openIndex,
            )

            return (
              <li
                key={turn.turnIndex}
                className={`${styles.turnCard} ${wholeTurn.length ? styles.turnCardFlagged : ''}`}
              >
                <p className={styles.turnIndex}>Giliran {turn.turnIndex}</p>

                <p className={styles.turnBody}>
                  {renderChannel(turn.boardText, quoted, 'boardText', indexOf, openIndex, toggle, openAndScroll)}
                </p>

                {turn.speech && (
                  <p className={styles.turnSpeech}>
                    <span className={styles.turnSpeechLabel}>Lisan</span>
                    {renderChannel(turn.speech, quoted, 'speech', indexOf, openIndex, toggle, openAndScroll)}
                  </p>
                )}

                {quoted.length === 0 && wholeTurn.length === 0 && (
                  <p className={styles.turnNoNotes}>Tidak ada catatan khusus untuk giliran ini.</p>
                )}

                {wholeTurn.length > 0 && (
                  <div className={styles.turnWholeList}>
                    <p className={styles.turnWholeLabel}>
                      Catatan untuk giliran ini, tanpa kutipan presisi
                    </p>
                    {wholeTurn.map((finding) => {
                      const i = indexOf.get(finding)!
                      return (
                        <button
                          key={i}
                          type="button"
                          className={`${styles.turnWholeButton} ${
                            openIndex === i ? styles.turnWholeButtonOpen : ''
                          }`}
                          aria-expanded={openIndex === i}
                          onClick={() => toggle(i)}
                        >
                          <span
                            className={`${styles.findingBadge} ${CATEGORY_BADGE_CLASS[finding.category]}`}
                          >
                            {CATEGORY_LABEL[finding.category]}
                          </span>
                          <span className={styles.turnWholeConcept}>{finding.concept}</span>
                          <Chevron open={openIndex === i} />
                        </button>
                      )
                    })}
                  </div>
                )}

                {openHere && (
                  <FindingDetail
                    finding={openHere}
                    index={indexOf.get(openHere)!}
                    onClose={() => setOpenIndex(null)}
                  />
                )}
              </li>
            )
          })}
        </ol>
      )}

      {orphans.length > 0 && (
        <div className={styles.orphanBlock}>
          <p className={styles.turnWholeLabel}>Catatan tanpa giliran terkait</p>
          {orphans.map((finding) => {
            const i = indexOf.get(finding)!
            return (
              <div key={i}>
                <button
                  type="button"
                  className={`${styles.turnWholeButton} ${
                    openIndex === i ? styles.turnWholeButtonOpen : ''
                  }`}
                  aria-expanded={openIndex === i}
                  onClick={() => toggle(i)}
                >
                  <span
                    className={`${styles.findingBadge} ${CATEGORY_BADGE_CLASS[finding.category]}`}
                  >
                    {CATEGORY_LABEL[finding.category]}
                  </span>
                  <span className={styles.turnWholeConcept}>{finding.concept}</span>
                  <Chevron open={openIndex === i} />
                </button>
                {openIndex === i && (
                  <FindingDetail finding={finding} index={i} onClose={() => setOpenIndex(null)} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/** Open/closed affordance on a collapsible row. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/** Anchor the coaching popover links to, so "lihat saran" lands on the advice. */
function followUpDomId(index: number): string {
  return `followup-${index}`
}

function FindingDetail({
  finding,
  index,
  onClose,
}: {
  finding: EvaluationFindingDTO
  index: number
  onClose: () => void
}) {
  return (
    <div className={styles.inlineDetail} role="region" aria-label={`Penilaian: ${finding.concept}`}>
      <div className={styles.inlineDetailTop}>
        <span className={`${styles.findingBadge} ${CATEGORY_BADGE_CLASS[finding.category]}`}>
          {CATEGORY_LABEL[finding.category]}
        </span>
        <span className={styles.inlineDetailConcept}>{finding.concept}</span>
        <button
          type="button"
          className={styles.inlineDetailClose}
          onClick={onClose}
          aria-label="Tutup catatan"
        >
          Tutup
        </button>
      </div>

      <p className={styles.noteDetail}>{finding.detail}</p>

      {finding.followUp && (
        <div className={styles.followUpBox} id={followUpDomId(index)}>
          <p className={styles.followUpLabel}>Saran perbaikan</p>
          <p className={styles.followUpText}>{finding.followUp}</p>
        </div>
      )}
    </div>
  )
}

/** Render one text channel, each quote in it a button that opens its note. */
function renderChannel(
  text: string,
  quoted: ReturnType<typeof findingsForTurn>['quoted'],
  field: QuoteField,
  indexOf: Map<EvaluationFindingDTO, number>,
  openIndex: number | null,
  toggle: (i: number) => void,
  openAndScroll: (i: number) => void,
) {
  const matches = quoted
    .filter((q) => q.match.field === field)
    .map((q) => ({ finding: q.finding, index: q.match.index, length: q.match.text.length }))

  if (matches.length === 0) return text

  return segmentTextForFindings(text, matches).map((segment, i) => {
    if (!segment.finding) return <span key={i}>{segment.text}</span>

    const finding = segment.finding
    const at = indexOf.get(finding)!
    const open = openIndex === at

    return (
      <span key={i} className={styles.markWrap}>
        <button
          type="button"
          className={`${styles.markButton} ${CATEGORY_MARK_CLASS[finding.category]} ${
            open ? styles.markButtonOpen : ''
          }`}
          aria-expanded={open}
          onClick={() => toggle(at)}
        >
          {segment.text}
        </button>

        {/* Yoodli-style coaching note: the gist arrives on hover, without
            committing the reader to opening the full panel and losing their
            place in the sentence. */}
        <span className={styles.coachPop} role="tooltip">
          <span
            className={`${styles.findingBadge} ${CATEGORY_BADGE_CLASS[finding.category]}`}
          >
            {CATEGORY_LABEL[finding.category]}
          </span>
          <span className={styles.coachConcept}>{finding.concept}</span>
          <span className={styles.coachDetail}>{finding.detail}</span>
          {finding.followUp && (
            <button
              type="button"
              className={styles.coachLink}
              onClick={() => {
                openAndScroll(at)
              }}
            >
              Lihat saran perbaikan
            </button>
          )}
        </span>
      </span>
    )
  })
}
