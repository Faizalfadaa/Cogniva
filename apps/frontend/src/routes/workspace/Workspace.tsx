import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBridge } from '../../bridge/BridgeProvider'
import type { WorkspaceDTO } from '../../dto/WorkspaceDTO'
import { Whiteboard, type WhiteboardHandle } from '../../features/teaching-session/components/Whiteboard'
import { WorkspaceHeader } from '../../features/teaching-session/components/WorkspaceHeader'
import { LearnerResponseBubble } from '../../features/teaching-session/components/LearnerResponseBubble'
import { LearnerIntro } from '../../features/teaching-session/components/LearnerIntro'
import { LearnerDock } from '../../features/teaching-session/components/LearnerDock'
import { useTeachingSession } from '../../features/teaching-session/state/useTeachingSession'
import { useWorkspaceTitleAutosave } from '../../features/teaching-session/hooks/useWorkspaceTitleAutosave'
import { useIntroSeen } from '../../features/teaching-session/hooks/useIntroSeen'
import { useWorkspaceChat } from '../../features/teaching-session/hooks/useWorkspaceChat'
import { useUserStore } from '../../state/UserStore'
import { deriveLearner } from '../../lib/Learner'
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
    return () => {
      active = false
    }
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
  const chat = useWorkspaceChat(id ?? '', bridge)
  const { userName } = useUserStore()

  if (!id || loading) {
    // TODO: loading state proper di fase Polish
    return null
  }

  return (
    <div className={styles.page}>
      <WorkspaceHeader
        title={titleField.title}
        onTitleChange={titleField.onChange}
        saveStatus={titleField.status}
        isRecording={session.isRecording}
        micPermissionDenied={session.micPermissionDenied}
        mode={session.mode}
        pending={session.pending}
        onTeach={session.teach}
        onContinueEditing={session.continueEditing}
      />

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
        />

        {!intro.seen && (
          <LearnerIntro learner={learner} userName={userName ?? ''} onDone={intro.markSeen} />
        )}

        {intro.seen && (
          <LearnerDock
            learner={learner}
            messages={chat.messages}
            isOpen={chat.isOpen}
            unreadCount={chat.unreadCount}
            onToggle={chat.toggle}
            onSend={chat.sendMessage}
          />
        )}
      </div>
    </div>
  )
}