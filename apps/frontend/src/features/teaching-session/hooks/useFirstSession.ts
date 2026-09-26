import { useEffect, useState } from 'react'
import type { CognivaBridge } from '../../../bridge/CognivaBridge'
import type { WorkspaceDTO } from '../../../dto/WorkspaceDTO'

/**
 * Is this workspace still on its first session, before any round was finished?
 *
 * The student introduces itself once. It used to do so whenever this browser had
 * not seen the introduction yet, which is a fact about the browser rather than
 * about the lesson: open the workspace on another device, or in a tab whose
 * storage was cleared, and a student the user had already taught for a whole
 * session greeted them again as a stranger. "Continue teaching" is the same
 * lesson going on, so a greeting there is out of place however it is reached.
 *
 * Decided from the server instead. A Draft has never been taught in, so it
 * needs no request; anything else is asked how many rounds it has finished.
 *
 * `null` while that is not known yet. Callers hold anything that depends on it
 * rather than guessing, because guessing wrong in either direction is visible:
 * a greeting that appears and is then withdrawn, or one that arrives late.
 */
export function useFirstSession(
  workspaceId: string,
  bridge: CognivaBridge,
  workspace: WorkspaceDTO | null | undefined
): boolean | null {
  // Kept across refetches rather than reset: the first drawing moves a Draft to
  // Teaching mid-session, and dropping back to "unknown" while the rounds are
  // asked for again would pull the greeting off screen and put it back.
  // Tagged with its workspace, so moving straight to another one does not carry
  // this answer over before that workspace's own has been found.
  const [answer, setAnswer] = useState<{ id: string; first: boolean } | null>(null)
  const state = workspace?.state

  useEffect(() => {
    if (!workspaceId || !state) return
    if (state === 'Draft') {
      setAnswer({ id: workspaceId, first: true })
      return
    }
    let active = true
    bridge
      .getEvaluationRounds(workspaceId)
      .then((rounds) => {
        if (active) setAnswer({ id: workspaceId, first: rounds.length === 0 })
      })
      .catch((err) => {
        // Unknown is treated as "not the first": skipping a greeting costs
        // nothing, while greeting someone mid-lesson is the bug this exists for.
        console.error('[useFirstSession] getEvaluationRounds failed', err)
        if (active) setAnswer({ id: workspaceId, first: false })
      })
    return () => {
      active = false
    }
  }, [bridge, workspaceId, state])

  return answer?.id === workspaceId ? answer.first : null
}
