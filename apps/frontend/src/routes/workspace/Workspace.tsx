import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBridge } from '../../bridge/BridgeProvider'
import type { WorkspaceDTO } from '../../dto/WorkspaceDTO'
import { Whiteboard, type WhiteboardHandle } from '../../features/teaching-session/components/Whiteboard'
import { WorkspaceHeader } from '../../features/teaching-session/components/WorkspaceHeader'
import { LearnerResponseBubble } from '../../features/teaching-session/components/LearnerResponseBubble'
import { LearnerIntro } from '../../features/teaching-session/components/LearnerIntro'
import { LearnerStage } from '../../features/teaching-session/components/LearnerStage'
import { ChatToasts } from '../../features/teaching-session/components/ChatToasts'
import { ChatLauncher } from '../../features/teaching-session/components/ChatLauncher'
import { ErrorBanner } from '../../features/teaching-session/components/ErrorBanner'
import { ReferenceFinder } from '../../features/teaching-session/components/ReferenceFinder'
import { SessionSetup } from '../../features/teaching-session/components/SessionSetup'
import { ProductTour } from '../../features/tour/ProductTour'
import { WORKSPACE_TOUR_STEPS } from '../../features/tour/tourSteps'
import { useAppTour } from '../../features/tour/useAppTour'
import { LearnerSelect } from '../../features/teaching-session/components/LearnerSelect'
import { useTeachingSession } from '../../features/teaching-session/state/useTeachingSession'
import { useWorkspaceTitleAutosave } from '../../features/teaching-session/hooks/useWorkspaceTitleAutosave'
import { useIntroSeen } from '../../features/teaching-session/hooks/useIntroSeen'
import { useSessionSetup } from '../../features/teaching-session/hooks/useSessionSetup'
import { useWorkspaceChat } from '../../features/teaching-session/hooks/useWorkspaceChat'
import { useUserStore } from '../../state/UserStore'
import {
  getStoredLearnerId,
  resolveFirstMessages,
  resolveLearner,
  setStoredLearnerId,
} from '../../lib/Learner'
import styles from '../../styles/TeachingSession.module.css'

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const bridge = useBridge()
  const [workspace, setWorkspace] = useState<WorkspaceDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const whiteboardRef = useRef<WhiteboardHandle>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    bridge.getWorkspace(id).then((ws) => {
      if (!active) return
      setWorkspace(ws)
      setLoading(false)
    })
    return () => { active = false }
  }, [bridge, id])

  const handleAutosave = useCallback(
    (payload: { snapshot: unknown; thumbnail?: Blob }) => {
      if (!id) return
      bridge.saveWhiteboardDraft(id, payload)
    },
    [bridge, id]
  )

  const session = useTeachingSession(id ?? '', bridge, whiteboardRef)

  // The picked id is state, not just a localStorage read, so choosing a student
  // re-renders with the new one instead of keeping the memoised old character.
  const [chosenLearnerId, setChosenLearnerId] = useState<string | null>(() =>
    getStoredLearnerId(id ?? '')
  )
  const learner = useMemo(() => resolveLearner(id ?? ''), [id, chosenLearnerId])
  const titleField = useWorkspaceTitleAutosave(id ?? '', workspace?.title, bridge)
  const intro = useIntroSeen(id ?? '')
  const setup = useSessionSetup(id ?? '')
  const tour = useAppTour('workspace')
  const { userName } = useUserStore()
  const navigate = useNavigate()
  const [finishingSession, setFinishingSession] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [findingReference, setFindingReference] = useState(false)

  const handleFinishSession = useCallback(async () => {
    if (!id) return
    setFinishingSession(true)
    try {
      await bridge.finishSession(id)
      navigate(`/evaluation/${id}`)
    } catch (err) {
      console.error('[Workspace] finishSession failed', err)
      setFinishingSession(false)
    }
  }, [bridge, id, navigate])

  const handleUploadPdf = useCallback(
    async (file: File) => {
      if (!id) return
      setUploadingPdf(true)
      try {
        const ws = await bridge.uploadWorkspacePdf(id, file)
        setWorkspace(ws)
      } catch (err) {
        console.error('[Workspace] uploadWorkspacePdf failed', err)
      } finally {
        setUploadingPdf(false)
      }
    },
    [bridge, id]
  )

  // Adopting a source changes the workspace server-side (reference text, and the
  // provenance chip in the header), so the local copy is refetched rather than
  // patched — the dialog only knows what it chose, not what the server stored.
  const handleReferenceAdopted = useCallback(async () => {
    if (!id) return
    try {
      setWorkspace(await bridge.getWorkspace(id))
    } catch (err) {
      console.error('[Workspace] getWorkspace after reference failed', err)
    }
  }, [bridge, id])

  // Resolve first messages with userName substitution — stable across renders
  const seedMessages = useMemo(
    () =>
      resolveFirstMessages(learner, userName || 'you').map((content, i) => ({
        id: `seed-${id}-${i}`,
        content,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [learner, id] // userName intentionally excluded — only seed once on mount
  )

  const chat = useWorkspaceChat(id ?? '', bridge, learner.name, learner.avatarUrl, {
    seedMessages,
  })

  /**
   * Ask only on a workspace nobody has started yet.
   *
   * `state === 'Draft'` is the "never used" signal: the backend leaves Draft on
   * the first checkpoint AND on the first whiteboard autosave, so anything that
   * has ever been drawn in or taught in is already past it. That is broader
   * than "has checkpoints" and deliberately so — erring towards NOT asking
   * keeps an existing workspace's character from changing under the user.
   * `intro.seen` covers the same ground from the other side: if they have
   * already met a student here, the choice was effectively made.
   */
  const needsLearnerPick =
    !chosenLearnerId && workspace?.state === 'Draft' && !intro.seen

  const handleSelectLearner = useCallback(
    (learnerId: string) => {
      if (!id) return
      setStoredLearnerId(id, learnerId)
      setChosenLearnerId(learnerId)
    },
    [id]
  )

  /**
   * Ask what the session is about, once, after the student has introduced
   * themselves — the topic is what the Learner reacts to and what the Evaluator
   * grades, so it is worth having before the first explanation rather than
   * after it.
   *
   * Only on a Draft: a workspace already being taught has answered the question
   * by existing, and interrupting a resumed session with a form would be absurd.
   */
  const needsSetup =
    intro.seen && !needsLearnerPick && !setup.done && workspace?.state === 'Draft'

  /**
   * Second leg of the app tour, resumed from the dashboard. Held until the
   * greeting is over and the setup panel is gone: those own the screen with
   * their own overlays, and two dimmed layers at once would be a mess.
   */
  const showTour = tour.active && intro.seen && !needsLearnerPick && !needsSetup

  // One banner, two sources. Teaching errors win: the user just pressed Teach
  // and is waiting on that, whereas a chat poll fails quietly in the background.
  // Both hooks report `network` identically, so a dropped connection reads the
  // same whichever noticed it first.
  const activeError = session.error ?? chat.error
  const dismissActiveError = session.error ? session.dismissError : chat.dismissError

  if (!id || loading) return null

  return (
    <div className={styles.page}>
      <WorkspaceHeader
        title={titleField.title}
        onTitleChange={titleField.onChange}
        saveStatus={titleField.status}
        isRecording={session.isRecording}
        micPermissionDenied={session.micPermissionDenied}
        onToggleRecording={session.toggleRecording}
        mode={session.mode}
        pending={session.pending}
        onTeach={session.teach}
        onContinueEditing={session.continueEditing}
        onFinishSession={handleFinishSession}
        finishingSession={finishingSession}
        onUploadPdf={handleUploadPdf}
        pdfUrl={workspace?.pdfUrl}
        uploadingPdf={uploadingPdf}
        onFindReference={() => setFindingReference(true)}
        referenceSource={workspace?.referenceSource}
      />

      {findingReference && (
        <ReferenceFinder
          workspaceId={id}
          topic={titleField.title}
          onClose={() => setFindingReference(false)}
          onAdopted={handleReferenceAdopted}
        />
      )}

      <div className={styles.workspaceBody}>
        {/* Canvas takes remaining space; sidebar is a flex sibling */}
        {/* data-tour sits on the canvas area rather than inside Whiteboard:
            the engine is swapped at build time (tldraw vs Excalidraw), and this
            wrapper is the one element both render into. */}
        <div className={styles.canvasArea} data-tour="whiteboard-area">
          <Whiteboard
            ref={whiteboardRef}
            initialSnapshot={workspace?.currentWhiteboardSnapshot}
            onAutosave={handleAutosave}
            readOnly={session.mode === 'locked'}
          />

          {/* Top-centre: the bottom-right corner already holds the toast stack,
              the response bubble and the chat launcher. See .errorBanner. */}
          <ErrorBanner error={activeError} onDismiss={dismissActiveError} />

          <LearnerResponseBubble
            learner={learner}
            text={session.latestCheckpoint?.learnerResponse}
            pending={session.pending}
            checkpointId={session.latestCheckpoint?.id}
            audioUrl={session.latestCheckpoint?.learnerAudioUrl}
          />

          {/* Pick first, then meet them: the intro is held back until a student
              exists, otherwise it would introduce the character being replaced. */}
          {needsLearnerPick && <LearnerSelect onSelect={handleSelectLearner} />}

          {!needsLearnerPick && !intro.seen && (
            <LearnerIntro learner={learner} userName={userName ?? ''} onDone={intro.markSeen} />
          )}

          {/* Last beat of the opening sequence: the student is here, now say
              what you will teach them. */}
          {needsSetup && (
            <SessionSetup
              workspaceId={id}
              learner={learner}
              workspace={workspace}
              onWorkspaceChange={setWorkspace}
              onDone={setup.markDone}
            />
          )}

          {/* Toast notifications — float over canvas, only when sidebar is closed */}
          {intro.seen && !needsSetup && !chat.isOpen && (
            <ChatToasts
              toasts={chat.toasts}
              onDismiss={chat.dismissToast}
              onOpenChat={chat.open}
            />
          )}

          {showTour && (
            <ProductTour
              steps={WORKSPACE_TOUR_STEPS}
              index={tour.index}
              onIndexChange={tour.setIndex}
              onFinish={tour.advance}
              onSkip={tour.skipAll}
            />
          )}

          {/* Chat entry point, bottom-right. Gated on intro.seen for the same
              reason ChatSidebar is: before the intro is done the sidebar is not
              mounted, so a toggle would flip state with nothing to show. */}
          {intro.seen && !needsSetup && (
            <ChatLauncher
              chatOpen={chat.isOpen}
              chatUnread={chat.unreadCount}
              onToggleChat={chat.toggle}
              learnerAvatarUrl={learner.avatarUrl}
              learnerName={learner.name}
            />
          )}
        </div>

        {/* Learner stage — flex sibling so it pushes the canvas, not overlaps it */}
        {intro.seen && (
          <LearnerStage
            learner={learner}
            messages={chat.messages}
            isOpen={chat.isOpen}
            onToggle={chat.toggle}
            onSend={chat.sendMessage}
          />
        )}
      </div>
    </div>
  )
}