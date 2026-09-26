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
import { SessionLanguage } from '../../features/teaching-session/components/SessionLanguage'
import { useSessionLanguage } from '../../features/teaching-session/hooks/useSessionLanguage'
import type { Locale } from '../../i18n/messages'
import { useTeachingSession } from '../../features/teaching-session/state/useTeachingSession'
import { useWorkspaceTitleAutosave } from '../../features/teaching-session/hooks/useWorkspaceTitleAutosave'
import { useIntroSeen } from '../../features/teaching-session/hooks/useIntroSeen'
import { useFirstSession } from '../../features/teaching-session/hooks/useFirstSession'
import { useSessionSetup } from '../../features/teaching-session/hooks/useSessionSetup'
import { useWorkspaceChat } from '../../features/teaching-session/hooks/useWorkspaceChat'
import {
  toastPlacement,
  useLauncherPosition,
} from '../../features/teaching-session/hooks/useLauncherPosition'
import { useUserStore } from '../../state/UserStore'
import {
  getStoredLearnerId,
  resolveFirstMessages,
  resolveLearner,
  setStoredLearnerId,
} from '../../lib/Learner'
import { useLocale, usePinnedLocale, useT } from '../../i18n/LanguageProvider'
import styles from '../../styles/TeachingSession.module.css'

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const bridge = useBridge()
  const t = useT()
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

  // The board is shown entirely in the session's own language, fixed when the
  // workspace was created, so the interface never mixes with what the student
  // says. The header switch becomes a label naming it. Undefined until the
  // workspace loads, which leaves the reader's preference in place for a moment.
  usePinnedLocale(workspace?.locale)
  const { locale: uiLocale } = useLocale()
  /** The language the student speaks in this workspace. */
  const locale = workspace?.locale ?? uiLocale

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
  const learner = useMemo(
    () => resolveLearner(id ?? '', workspace?.learnerId),
    // chosenLearnerId is not read here — it is in the list so that picking a
    // student re-runs the memo instead of keeping the previous character.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, chosenLearnerId, workspace?.learnerId],
  )
  const titleField = useWorkspaceTitleAutosave(id ?? '', workspace?.title, bridge)
  const intro = useIntroSeen(id ?? '')
  const firstSession = useFirstSession(id ?? '', bridge, workspace)
  /**
   * Past the introduction, whether it played here or never needs to.
   *
   * The chat, its toasts, the learner stage and the tour all wait for the
   * introduction to finish. From the second session on it no longer plays at
   * all, so waiting on `intro.seen` alone would keep them hidden for good on any
   * browser that had not watched it during the first session.
   */
  const introDone = intro.seen || firstSession === false
  const setup = useSessionSetup(id ?? '')
  const language = useSessionLanguage(id ?? '')
  const [savingLanguage, setSavingLanguage] = useState(false)
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

  /**
   * The student's greeting in the chat, on the first session only.
   *
   * Every later session is the same lesson carrying on, and a student who says
   * hello again as if meeting the user for the first time breaks that. Held as
   * `undefined` until useFirstSession knows, so no greeting flashes up and is
   * then withdrawn.
   *
   * Dated from when the workspace was made, a millisecond apart, so the lines
   * keep their order and always sort ahead of the real conversation.
   */
  const seedMessages = useMemo(() => {
    if (firstSession === null || !workspace) return undefined
    if (!firstSession) return []
    const start = new Date(workspace.createdAt).getTime()
    return resolveFirstMessages(learner, userName || t('intro.you'), locale).map((content, i) => ({
      id: `seed-${id}-${i}`,
      content,
      createdAt: new Date(start + i).toISOString(),
    }))
    // userName is left out on purpose: the greeting names whoever the user was
    // when it was first shown, and should not rewrite itself when they rename.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learner, id, workspace?.locale, workspace?.createdAt, firstSession])

  const launcher = useLauncherPosition()

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
  const needsLanguagePick = !language.chosen && workspace?.state === 'Draft' && !intro.seen

  const needsLearnerPick =
    !needsLanguagePick &&
    !chosenLearnerId &&
    !workspace?.learnerId &&
    workspace?.state === 'Draft' &&
    !intro.seen

  const handleSelectLearner = useCallback(
    (learnerId: string) => {
      if (!id) return
      setStoredLearnerId(id, learnerId)
      setChosenLearnerId(learnerId)

      // Also tell the backend, which cannot see localStorage and synthesizes the
      // learner's speech itself — without this the voice is picked from the
      // workspace id and stops matching the face on screen. Fire-and-forget: a
      // failed write costs the voice, not the session, and the choice is still
      // correct in this browser.
      void bridge
        .updateWorkspaceMeta(id, { learnerId })
        .then(setWorkspace)
        .catch((err) => console.error('[Workspace] saving the picked learner failed', err))
    },
    [bridge, id]
  )

  /**
   * The language the session runs in, chosen once on the way in.
   *
   * The dialog offers it and the workspace stores it, so the student speaks in
   * it and the report comes back in it. The server only accepts the change
   * while the workspace is still a Draft, which is exactly when this is asked.
   * A failed write leaves the language the workspace was created with; the
   * dialog still closes, because asking again on every open would be worse than
   * running in the inherited language.
   */
  const handleChooseLanguage = useCallback(
    async (next: Locale) => {
      if (!id) return
      setSavingLanguage(true)
      try {
        if (next !== workspace?.locale) {
          setWorkspace(await bridge.updateWorkspaceMeta(id, { locale: next }))
        }
      } catch (err) {
        console.error('[Workspace] saving the session language failed', err)
      } finally {
        setSavingLanguage(false)
        language.markChosen()
      }
    },
    [bridge, id, language, workspace?.locale]
  )

  /**
   * Ask what the session is about, once, before the student introduces
   * themselves — the topic is what the Learner reacts to and what the Evaluator
   * grades, so it is worth having before the first explanation rather than
   * after it.
   *
   * Only on a Draft: a workspace already being taught has answered the question
   * by existing, and interrupting a resumed session with a form would be absurd.
   */
  const needsSetup =
    !needsLanguagePick && !needsLearnerPick && !setup.done && workspace?.state === 'Draft'

  /**
   * Second leg of the app tour, resumed from the dashboard. Held until the
   * greeting is over and the setup panel is gone: those own the screen with
   * their own overlays, and two dimmed layers at once would be a mess.
   */
  const showTour =
    tour.active && introDone && !needsLanguagePick && !needsLearnerPick && !needsSetup

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
            the whiteboard implementation can evolve, and this
            wrapper is the one element both render into. */}
        <div className={styles.canvasArea} data-tour="whiteboard-area" ref={launcher.areaRef}>
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
            hidden={chat.isOpen}
            learner={learner}
            text={session.latestCheckpoint?.learnerResponse}
            pending={session.pending}
            checkpointId={session.latestCheckpoint?.id}
            audioUrl={session.latestCheckpoint?.learnerAudioUrl}
            speech={session.latestCheckpoint?.speech}
          />

          {/* Pick a student, set up the topic, then play their greeting. */}
          {needsLanguagePick && workspace && (
            <SessionLanguage
              current={workspace.locale}
              onChoose={(next) => void handleChooseLanguage(next)}
              saving={savingLanguage}
            />
          )}

          {needsLearnerPick && <LearnerSelect onSelect={handleSelectLearner} />}

          {needsSetup && (
            <SessionSetup
              workspaceId={id}
              learner={learner}
              workspace={workspace}
              onWorkspaceChange={setWorkspace}
              onDone={setup.markDone}
            />
          )}

          {!needsLanguagePick &&
            !needsLearnerPick &&
            !needsSetup &&
            !intro.seen &&
            firstSession === true && (
              <LearnerIntro learner={learner} userName={userName ?? ''} onDone={intro.markSeen} />
            )}

          {/* Toast notifications — float over canvas, only when sidebar is closed */}
          {introDone && !needsSetup && !chat.isOpen && (
            <ChatToasts
              toasts={chat.toasts}
              onDismiss={chat.dismissToast}
              onOpenChat={chat.open}
              placement={toastPlacement(launcher.offset, launcher.area)}
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

          {/* Chat entry point, bottom-right until the user drags it elsewhere;
              the panel it opens stays on the right either way. Gated on
              introDone for the same reason ChatSidebar is: before the intro is
              done the sidebar is not mounted, so a toggle would flip state with
              nothing to show. */}
          {introDone && !needsSetup && (
            <ChatLauncher
              chatOpen={chat.isOpen}
              chatUnread={chat.unreadCount}
              onToggleChat={chat.toggle}
              offset={launcher.offset}
              onMove={launcher.move}
              learnerAvatarUrl={learner.avatarUrl}
              learnerName={learner.name}
            />
          )}
        </div>

        {/* Learner stage — flex sibling so it pushes the canvas, not overlaps it */}
        {introDone && (
          <LearnerStage
            learner={learner}
            messages={chat.messages}
            isOpen={chat.isOpen}
            isTyping={session.pending || chat.isTyping}
            onToggle={chat.toggle}
            onSend={chat.sendMessage}
          />
        )}
      </div>
    </div>
  )
}
