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
 * Excalidraw has no change stream of its own, so ExcalidrawWhiteboard derives
 * these by comparing element versions on each change (see boardDiff.ts).
 */
export interface BoardChange {
  /** Epoch milliseconds. */
  at: number
  shapeIds: string[]
  kind: BoardEventKind
  /** Excalidraw's element type. */
  shape?: string
  /** The words, when the element is text. */
  text?: string
}

export interface WhiteboardHandle {
  /** Grab the current document and PNG snapshot when TeachButton is pressed. */
  exportSnapshot: () => Promise<{ document: unknown; image?: Blob }>
  /** Drain board changes recorded since the last call, if an editor implements it. */
  flushTimeline?: () => BoardChange[]
  /** A PNG of only these elements, cropped to them: what changed since the last Teach. */
  exportImageOf?: (ids: string[]) => Promise<Blob | undefined>
}
