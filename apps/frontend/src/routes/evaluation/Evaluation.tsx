import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBridge } from '../../bridge/BridgeProvider'
import type { WorkspaceDTO } from '../../dto/WorkspaceDTO'
import type { EvaluationReportDTO } from '../../dto/EvaluationReportDTO'
import { deriveLearner } from '../../lib/Learner'
import { EvaluationProcessing } from '../../features/evaluation/components/EvaluationProcessing'
import { LetterFromLearner } from '../../features/evaluation/components/LetterFromLearner'
import { Notebook } from '../../features/evaluation/components/Notebook'
import { ContinueLearning } from '../../features/evaluation/components/ContinueLearning'
import styles from '../../styles/Evaluation.module.css'

const POLL_INTERVAL_MS = 3000

export default function EvaluationPage() {
  const { id } = useParams<{ id: string }>()
  const bridge = useBridge()
  const navigate = useNavigate()

  const [workspace, setWorkspace] = useState<WorkspaceDTO | null>(null)
  const [report, setReport] = useState<EvaluationReportDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [resuming, setResuming] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const learner = useMemo(() => deriveLearner(id ?? ''), [id])

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
    const ws = await bridge.createWorkspace()
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

  // ── Processing screen ─────────────────────────────────────────────────────
  if (workspace.state === 'Evaluating' || (workspace.state === 'Completed' && !report)) {
    return <EvaluationProcessing workspaceId={id!} workspaceTitle={workspace.title} />
  }

  // ── Report screen ─────────────────────────────────────────────────────────
  return (
    <div className={styles.reportPage}>
      {/* Minimal top bar */}
      <header className={styles.reportHeader}>
        <button className={styles.reportBack} onClick={() => navigate('/')}>
          ← Home
        </button>
        <div className={styles.reportHeaderCenter}>
          <img src="/cogniva_logo.png" alt="Cogniva" className={styles.reportLogo} />
        </div>
        <div className={styles.reportHeaderRight}>
          <img src={learner.avatarUrl} alt={learner.name} className={styles.reportLearnerAvatar} />
          <span className={styles.reportLearnerName}>{learner.name}</span>
        </div>
      </header>

      {/* Hero */}
      <div className={styles.reportHero}>
        <p className={styles.reportHeroEyebrow}>Sesi selesai</p>
        <h1 className={styles.reportHeroTitle}>
          {workspace.title ?? 'Workspace tanpa judul'}
        </h1>
      </div>

      {/* Sections */}
      <div className={styles.reportContent}>
        <LetterFromLearner learner={learner} letter={report!.letter} />
        <Notebook notebook={report!.notebook} learnerName={learner.name} />
        <ContinueLearning topics={report!.continueLearning} onNewSession={handleNewSession} onResumeSession={handleResumeSession} resuming={resuming} />
      </div>
    </div>
  )
}