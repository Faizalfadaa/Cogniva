import type { BoardEventKind } from '../../../dto/TimelineDTO'

// Shared contract for the pluggable whiteboard editors.
//
// Two implementations satisfy this contract and are swapped at build time
// (see Whiteboard.tsx): tldraw for local dev, Excalidraw for production. Keeping
// the props + imperative handle identical means Workspace.tsx never changes.

export interface WhiteboardProps {
  /** The previously saved snapshot (from WorkspaceDTO.currentWhiteboardSnapshot). */
  initialSnapshot?: unknown
  /** Called debounced whenever the canvas changes (draft autosave). */
  onAutosave: (payload: { snapshot: unknown; thumbnail?: Blob }) => void
  /** true when the checkpoint is locked (after Teach is pressed) — canvas is read-only. */
  readOnly?: boolean
}

/**
 * One board change as the editor observed it, stamped with the WALL CLOCK
 * (Date.now()), not an offset. The editor has no idea when the mic started, so
 * useTeachingSession rebases these onto the recording's origin when it builds
 * the checkpoint payload — that keeps the audio/board coupling in one place.
 */
export interface BoardChange {
  /** Epoch milliseconds. */
  at: number
  shapeIds: string[]
  kind: BoardEventKind
}

export interface WhiteboardHandle {
  /** Grab the CURRENT document + PNG snapshot — called when TeachButton is pressed, not debounced. */
  exportSnapshot: () => Promise<{ document: unknown; image?: Blob }>
  /**
   * Drain the board changes recorded since the last call (Phase 1 of
   * audio-visual sync). Optional because only the tldraw engine implements it
   * so far; Excalidraw — the PRODUCTION engine — has no diff to hook into yet,
   * so it simply sends no timeline. Callers must treat it as possibly absent.
   */
  flushTimeline?: () => BoardChange[]
}
