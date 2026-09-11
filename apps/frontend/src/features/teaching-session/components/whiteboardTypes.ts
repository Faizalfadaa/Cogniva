import type { BoardEventKind } from '../../../dto/TimelineDTO'

// Shared contract for the Excalidraw whiteboard editor.

export interface WhiteboardProps {
  /** The previously saved snapshot (from WorkspaceDTO.currentWhiteboardSnapshot). */
  initialSnapshot?: unknown
  /** Called debounced whenever the canvas changes (draft autosave). */
  onAutosave: (payload: { snapshot: unknown; thumbnail?: Blob }) => void
  /** true when the checkpoint is locked (after Teach is pressed) - canvas is read-only. */
  readOnly?: boolean
}

/**
 * One board change as the editor observed it, stamped with the wall clock.
 * Excalidraw does not currently emit the granular shape diff stream that the
 * previous editor exposed, so this timeline hook is optional.
 */
export interface BoardChange {
  /** Epoch milliseconds. */
  at: number
  shapeIds: string[]
  kind: BoardEventKind
}

export interface WhiteboardHandle {
  /** Grab the current document and PNG snapshot when TeachButton is pressed. */
  exportSnapshot: () => Promise<{ document: unknown; image?: Blob }>
  /** Drain board changes recorded since the last call, if an editor implements it. */
  flushTimeline?: () => BoardChange[]
}
