import { useMemo, useState } from 'react'
import type {
  EvaluationFindingDTO,
  EvaluationTranscriptTurnDTO,
} from '../../../dto/EvaluationReportDTO'
import type { TeachingCheckpointDTO } from '../../../dto/TeachingCheckpointDTO'
import { findingsForTurn, segmentTextForFindings, type QuoteField } from '../lib/highlightQuote'
import { CATEGORY_BADGE_CLASS, CATEGORY_LABEL, CATEGORY_MARK_CLASS } from '../lib/findingLabels'
import { useT, type Translate } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/Evaluation.module.css'

interface TranscriptReviewProps {
  transcript: EvaluationTranscriptTurnDTO[]
  findings: EvaluationFindingDTO[]
  /** Null while the Detail tab's lazy fetch is still in flight. */
  checkpoints: TeachingCheckpointDTO[] | null
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
 *
 * Each turn can also show what it was taught from: the board that was drawn,
 * the recording that was spoken over it, and the chat that followed. The app is built around a
 * whiteboard and a microphone, and until now the debrief only ever showed what
 * the agents read out of them — never the drawing or the voice itself. Both are
 * matched by position and only when the counts line up exactly (see
 * `capturesByTurn`).
 */
export function TranscriptReview({ transcript, findings, checkpoints }: TranscriptReviewProps) {
  const t = useT()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  /**
   * Board image per turn, or null when they cannot be matched with certainty.
   *
   * Checkpoints and turns are written by the same loop, so position N is turn N
   * — but a turn that ended in a handled failure leaves a checkpoint without a
   * transcript entry, and the positions drift. Showing the wrong board under
   * the wrong words is worse than showing none, so an uneven count shows none.
   */
  const capturesByTurn = useMemo(() => {
    if (!checkpoints || checkpoints.length !== transcript.length) return null
    const ordered = [...checkpoints].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    const map = new Map<number, { image?: string; audio?: string }>()
    transcript.forEach((turn, i) => {
      const checkpoint = ordered[i]
      if (!checkpoint) return
      map.set(turn.turnIndex, {
        image: checkpoint.snapshotImageUrl || undefined,
        audio: checkpoint.audioUrl,
      })
    })
    return map
  }, [checkpoints, transcript])

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
        <span>{t('evaluation.transcriptTitle')}</span>
      </div>
      <p className={styles.notesIntro}>{t('evaluation.transcriptIntro')}</p>

      {transcript.length === 0 ? (
        <div className={styles.findingsEmpty}>
          <p className={styles.findingsEmptyTitle}>{t('evaluation.transcriptEmpty')}</p>
          <p className={styles.findingsEmptyHint}>{t('evaluation.transcriptEmptyHint')}</p>
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
                id={`transcript-turn-${turn.turnIndex}`}
                className={`${styles.turnCard} ${wholeTurn.length ? styles.turnCardFlagged : ''}`}
              >
                <p className={styles.turnIndex}>
                  {t('evaluation.turnLabel', { index: turn.turnIndex })}
                </p>

                {capturesByTurn?.get(turn.turnIndex)?.image && (
                  <figure className={styles.turnBoard}>
                    <img
                      src={capturesByTurn.get(turn.turnIndex)!.image}
                      alt={t('evaluation.boardAlt', { index: turn.turnIndex })}
                      className={styles.turnBoardImage}
                      loading="lazy"
                    />
                    <figcaption className={styles.turnBoardCaption}>
                      {t('evaluation.boardCaption')}
                    </figcaption>
                  </figure>
                )}

                {turn.newBoardText === undefined ? (
                  <p className={styles.turnBody}>
                    {renderChannel(turn.boardText, quoted, 'boardText', indexOf, openIndex, toggle, openAndScroll, t)}
                  </p>
                ) : (
                  <>
                    {/* What this turn added, first. The board text is the whole
                        board, so everything written earlier repeats in every
                        turn after it; shown alone, a later turn looked like it
                        re-taught all of it. */}
                    <div className={styles.turnNewBoard}>
                      <span className={styles.turnNewBoardLabel}>{t('evaluation.newOnBoard')}</span>
                      {turn.newBoardText.trim() ? (
                        <p className={styles.turnBody}>
                          {renderChannel(turn.newBoardText, quoted, 'newBoardText', indexOf, openIndex, toggle, openAndScroll, t)}
                        </p>
                      ) : (
                        <p className={styles.turnNoNotes}>{t('evaluation.nothingNewOnBoard')}</p>
                      )}
                    </div>

                    {/* The rest of the board, folded away, but opened on its own
                        when a finding is marked inside it so no mark is hidden. */}
                    {turn.boardText.trim() && (
                      <details
                        className={styles.turnWholeBoard}
                        open={quoted.some((q) => q.match.field === 'boardText')}
                      >
                        <summary className={styles.turnWholeBoardSummary}>{t('evaluation.wholeBoard')}</summary>
                        <p className={styles.turnBody}>
                          {renderChannel(turn.boardText, quoted, 'boardText', indexOf, openIndex, toggle, openAndScroll, t)}
                        </p>
                      </details>
                    )}
                  </>
                )}

                {turn.speech && (
                  <p className={styles.turnSpeech}>
                    <span className={styles.turnSpeechLabel}>{t('evaluation.spokenLabel')}</span>
                    {renderChannel(turn.speech, quoted, 'speech', indexOf, openIndex, toggle, openAndScroll, t)}
                  </p>
                )}

                {/* The recording itself, under the words ASR made of it. A
                    transcript can be read for what was said; only the audio
                    carries how it was said, which is the half a user wanting to
                    teach better actually has to hear. Native controls: this is
                    a short clip played once, not a player worth building. */}
                {capturesByTurn?.get(turn.turnIndex)?.audio && (
                  <div className={styles.turnAudio}>
                    <span className={styles.turnAudioLabel}>
                      {t('evaluation.recordingLabel')}
                    </span>
                    <audio
                      className={styles.turnAudioPlayer}
                      src={capturesByTurn.get(turn.turnIndex)!.audio}
                      controls
                      preload="none"
                    />
                  </div>
                )}

                {/* The chat that followed this board. It is teaching too: the
                    student asks what it did not follow and the user answers,
                    often more directly than anything they drew. Both sides are
                    shown because the answer is unreadable without the question,
                    and only the user's half can carry a mark. */}
                {turn.chat && turn.chat.length > 0 && (
                  <div className={styles.turnChat}>
                    <span className={styles.turnChatLabel}>{t('evaluation.chatLabel')}</span>
                    <ol className={styles.turnChatList}>
                      {turn.chat.map((message, i) => (
                        <li
                          key={i}
                          className={`${styles.turnChatRow} ${
                            message.sender === 'user'
                              ? styles.turnChatFromUser
                              : styles.turnChatFromLearner
                          }`}
                        >
                          <span className={styles.turnChatWho}>
                            {t(
                              message.sender === 'user'
                                ? 'evaluation.chatYou'
                                : 'evaluation.chatLearner',
                            )}
                          </span>
                          <span className={styles.turnChatText}>
                            {message.sender === 'user'
                              ? renderChannel(
                                  message.text,
                                  quoted,
                                  'chat',
                                  indexOf,
                                  openIndex,
                                  toggle,
                                  openAndScroll,
                                  t,
                                  i,
                                )
                              : message.text}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {quoted.length === 0 && wholeTurn.length === 0 && (
                  <p className={styles.turnNoNotes}>{t('evaluation.turnNoNotes')}</p>
                )}

                {wholeTurn.length > 0 && (
                  <div className={styles.turnWholeList}>
                    <p className={styles.turnWholeLabel}>{t('evaluation.turnWholeLabel')}</p>
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
                            {t(CATEGORY_LABEL[finding.category])}
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
          <p className={styles.turnWholeLabel}>{t('evaluation.orphanLabel')}</p>
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
                    {t(CATEGORY_LABEL[finding.category])}
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
  const t = useT()

  return (
    <div
      className={styles.inlineDetail}
      role="region"
      aria-label={t('evaluation.findingAria', { concept: finding.concept })}
    >
      <div className={styles.inlineDetailTop}>
        <span className={`${styles.findingBadge} ${CATEGORY_BADGE_CLASS[finding.category]}`}>
          {t(CATEGORY_LABEL[finding.category])}
        </span>
        <span className={styles.inlineDetailConcept}>{finding.concept}</span>
        <button
          type="button"
          className={styles.inlineDetailClose}
          onClick={onClose}
          aria-label={t('evaluation.closeNote')}
        >
          {t('evaluation.close')}
        </button>
      </div>

      <p className={styles.noteDetail}>{finding.detail}</p>

      {finding.followUp && (
        <div className={styles.followUpBox} id={followUpDomId(index)}>
          <p className={styles.followUpLabel}>{t('evaluation.followUpLabel')}</p>
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
  t: Translate,
  /** Which chat bubble this is, when `field` is 'chat'. */
  chatIndex?: number,
) {
  const matches = quoted
    .filter((q) => q.match.field === field && q.match.chatIndex === chatIndex)
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
            {t(CATEGORY_LABEL[finding.category])}
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
              {t('evaluation.seeFollowUp')}
            </button>
          )}
        </span>
      </span>
    )
  })
}
