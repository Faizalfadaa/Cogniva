import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useBridge } from '../../bridge/BridgeProvider'
import type { WorkspaceDTO } from '../../dto/WorkspaceDTO'
import type { EvaluationReportDTO } from '../../dto/EvaluationReportDTO'
import { resolveLearner } from '../../lib/Learner'
import { EvaluationProcessing } from '../../features/evaluation/components/EvaluationProcessing'
import { LetterFromLearner } from '../../features/evaluation/components/LetterFromLearner'
import { ContinueLearning } from '../../features/evaluation/components/ContinueLearning'
import { ScoreBreakdown } from '../../features/evaluation/components/ScoreBreakdown'
import { EvaluatorNotes } from '../../features/evaluation/components/EvaluatorNotes'
import { TranscriptReview } from '../../features/evaluation/components/TranscriptReview'
import { SessionSnapshot } from '../../features/evaluation/components/SessionSnapshot'
import { useLocale, usePinnedLocale, useT } from '../../i18n/LanguageProvider'
import { LanguageToggle } from '../../i18n/LanguageToggle'
import styles from '../../styles/Evaluation.module.css'

const POLL_INTERVAL_MS = 3000

type ReportTab = 'summary' | 'detail'

export default function EvaluationPage() {
  const { id } = useParams<{ id: string }>()
  const bridge = useBridge()
  const navigate = useNavigate()
  const t = useT()

  const [workspace, setWorkspace] = useState<WorkspaceDTO | null>(null)
  const [report, setReport] = useState<EvaluationReportDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [resuming, setResuming] = useState(false)
  const [tab, setTab] = useState<ReportTab>('summary')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // The report is written in the language the session ran in, so the page
  // around it is too — and the header's switch becomes a label.
  usePinnedLocale(workspace?.locale)
  const { locale } = useLocale()

  // Same resolution as Workspace.tsx: the user's pick when there is one, the
  // hash-derived default otherwise — so the debrief comes from the student they
  // actually taught.
  const learner = useMemo(
    () => resolveLearner(id ?? '', workspace?.learnerId),
    [id, workspace?.learnerId],
  )

  // Initial load
  useEffect(() => {
    if (!id) return
    bridge.getWorkspace(id).then(ws => {
      setWorkspace(ws)
      setLoading(false)
    })
  }, [bridge, id])

  // Poll while Evaluating; fetch report once Completed
  useEffect(() => {
    if (!id || !workspace) return

    if (workspace.state === 'Completed') {
      // Already done — fetch report if we don't have it yet
      if (!report) {
        bridge.getEvaluationReport(id).then(setReport).catch(() => {})
      }
      return
    }

    if (workspace.state !== 'Evaluating') return

    // Poll getWorkspace until state becomes Completed
    pollRef.current = setInterval(async () => {
      try {
        const ws = await bridge.getWorkspace(id)
        setWorkspace(ws)
        if (ws.state === 'Completed') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          const r = await bridge.getEvaluationReport(id)
          setReport(r)
        }
      } catch {}
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [bridge, id, workspace?.state]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleNewSession() {
    const ws = await bridge.createWorkspace(locale)
    navigate(`/workspace/${ws.id}`)
  }

  async function handleResumeSession() {
    if (!id) return
    setResuming(true)
    try {
      await bridge.resumeSession(id)
      navigate(`/workspace/${id}`)
    } catch (err) {
      console.error('[Evaluation] resumeSession failed', err)
      setResuming(false)
    }
  }

  if (loading || !workspace) return null

  // A resumed workspace is back in Teaching — the debrief no longer applies
  // (e.g. landing here via the browser back button after "Lanjutkan Sesi").
  if (workspace.state === 'Teaching' || workspace.state === 'Draft') {
    return <Navigate to={`/workspace/${id}`} replace />
  }

  // ── Processing screen ─────────────────────────────────────────────────────
  if (workspace.state === 'Evaluating' || (workspace.state === 'Completed' && !report)) {
    return <EvaluationProcessing workspaceId={id!} workspaceTitle={workspace.title} />
  }

  // ── Report screen ─────────────────────────────────────────────────────────
  return (
    <div className={styles.reportPage}>
      {/* Minimal top bar */}
      <header className={styles.reportHeader}>
        <button className={styles.reportBack} onClick={() => navigate('/home')}>
          ← {t('header.home')}
        </button>
        <div className={styles.reportHeaderCenter}>
          <img src="/cogniva_logo.png" alt="Cogniva" className={styles.reportLogo} />
        </div>
        <div className={styles.reportHeaderRight}>
          <LanguageToggle />
          <img src={learner.avatarUrl} alt={learner.name} className={styles.reportLearnerAvatar} />
          <span className={styles.reportLearnerName}>{learner.name}</span>
        </div>
      </header>

      {/* Hero */}
      <div className={styles.reportHero}>
        <p className={styles.reportHeroEyebrow}>{t('evaluation.complete')}</p>
        <h1 className={styles.reportHeroTitle}>
          {workspace.title ?? t('home.untitledWorkspace')}
        </h1>
      </div>

      {/* Sections */}
      <div className={styles.reportContent}>
        <ScoreBreakdown
          score={report!.score}
          depthScore={report!.depthScore}
          findings={report!.findings}
          learner={learner}
        />

        <div className={styles.tabBar} role="tablist" aria-label={t('evaluation.reportView')}>
          <button
            type="button"
            role="tab"
            id="report-tab-summary"
            aria-selected={tab === 'summary'}
            aria-controls="report-panel-summary"
            className={`${styles.tabButton} ${tab === 'summary' ? styles.tabButtonActive : ''}`}
            onClick={() => setTab('summary')}
          >
            {t('evaluation.tabSummary')}
          </button>
          <button
            type="button"
            role="tab"
            id="report-tab-detail"
            aria-selected={tab === 'detail'}
            aria-controls="report-panel-detail"
            className={`${styles.tabButton} ${tab === 'detail' ? styles.tabButtonActive : ''}`}
            onClick={() => setTab('detail')}
          >
            {t('evaluation.tabDetail')}
          </button>
        </div>

        {tab === 'summary' ? (
          <div
            id="report-panel-summary"
            role="tabpanel"
            aria-labelledby="report-tab-summary"
            className={styles.tabPanel}
          >
            {/* Assessment, then the learner's own words about it, then where
                to go next. Continue Learning closes the tab because it is the
                step out of this screen. */}
            <EvaluatorNotes findings={report!.findings} />
            <LetterFromLearner learner={learner} letter={report!.letter} />
            <ContinueLearning
              topics={report!.continueLearning}
              onNewSession={handleNewSession}
              onResumeSession={handleResumeSession}
              resuming={resuming}
            />
          </div>
        ) : (
          <div
            id="report-panel-detail"
            role="tabpanel"
            aria-labelledby="report-tab-detail"
            className={styles.tabPanel}
          >
            {/* The shape of the session, then the session itself. */}
            <SessionSnapshot
              transcript={report!.transcript ?? []}
              findings={report!.findings}
            />
            <TranscriptReview
              transcript={report!.transcript ?? []}
              findings={report!.findings}
            />
          </div>
        )}
      </div>
    </div>
  )
}