import { useCallback, useMemo, useState } from 'react'

/**
 * How far through the app tour someone is.
 *
 * `home` and `workspace` are the two screens the tour crosses, in that order;
 * `done` means it is over, whether it was finished or skipped.
 */
export type TourProgress = 'home' | 'workspace' | 'done'

export type TourPhase = 'home' | 'workspace'

/** One global key, not one per workspace: the tour teaches where the buttons
 *  are, and that only needs learning once. (The learner intro is per-workspace
 *  because you meet a different student each time — different thing.) */
const KEY = 'cogniva:tour'

function read(): TourProgress {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'home' || stored === 'workspace' || stored === 'done') return stored
    // Never started -> begin at the dashboard, which is where the landing
    // page's "Start teaching" drops people.
    return stored === null ? 'home' : 'done'
  } catch {
    // Storage unavailable (private mode). Treat as finished rather than
    // replaying the tour on every single page load with no way to stop it.
    return 'done'
  }
}

function write(value: TourProgress): void {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    // Losing the progress marker is not worth interrupting anyone over.
  }
}

/**
 * Drives the two-screen tour. Each screen calls this with its own phase and
 * only shows the tour when `active` is true, so the sequence survives the
 * navigation between the dashboard and a workspace.
 */
export function useAppTour(phase: TourPhase) {
  const [progress, setProgress] = useState<TourProgress>(read)
  const [index, setIndex] = useState(0)

  /** Finished this screen's steps — hand over to the next phase. */
  const advance = useCallback(() => {
    const next: TourProgress = phase === 'home' ? 'workspace' : 'done'
    setProgress(next)
    write(next)
  }, [phase])

  /** "Skip tour" means the whole thing, not just this screen. */
  const skipAll = useCallback(() => {
    setProgress('done')
    write('done')
  }, [])

  return useMemo(
    () => ({ active: progress === phase, index, setIndex, advance, skipAll }),
    [progress, phase, index, advance, skipAll]
  )
}
