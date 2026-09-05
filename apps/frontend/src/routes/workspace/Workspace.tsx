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
import { useTeachingSession } from '../../features/teaching-session/state/useTeachingSession'
import { useWorkspaceTitleAutosave } from '../../features/teaching-session/hooks/useWorkspaceTitleAutosave'
import { useIntroSeen } from '../../features/teaching-session/hooks/useIntroSeen'
import { useWorkspaceChat } from '../../features/teaching-session/hooks/useWorkspaceChat'
import { useUserStore } from '../../state/UserStore'
import { deriveLearner, resolveFirstMessages } from '../../lib/Learner'
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
  const learner = useMemo(() => deriveLearner(id ?? ''), [id])
  const titleField = useWorkspaceTitleAutosave(id ?? '', workspace?.title, bridge)
  const intro = useIntroSeen(id ?? '')
  const { userName } = useUserStore()
  const navigate = useNavigate()
  const [finishingSession, setFinishingSession] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)

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
        learnerAvatarUrl={learner.avatarUrl}
        learnerName={learner.name}
        chatOpen={chat.isOpen}
        chatUnread={chat.unreadCount}
        onToggleChat={chat.toggle}
      />

      <div className={styles.workspaceBody}>
        {/* Canvas takes remaining space; sidebar is a flex sibling */}
        <div className={styles.canvasArea}>
          <Whiteboard
            ref={whiteboardRef}
            initialSnapshot={workspace?.currentWhiteboardSnapshot}
            onAutosave={handleAutosave}
            readOnly={session.mode === 'locked'}
          />

          <LearnerResponseBubble
            learner={learner}
            text={session.latestCheckpoint?.learnerResponse}
            pending={session.pending}
            checkpointId={session.latestCheckpoint?.id}
            audioUrl={session.latestCheckpoint?.learnerAudioUrl}
          />

          {!intro.seen && (
            <LearnerIntro learner={learner} userName={userName ?? ''} onDone={intro.markSeen} />
          )}

          {/* Toast notifications — float over canvas, only when sidebar is closed */}
          {intro.seen && !chat.isOpen && (
            <ChatToasts
              toasts={chat.toasts}
              onDismiss={chat.dismissToast}
              onOpenChat={chat.open}
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