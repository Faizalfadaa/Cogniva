import type { BoardEventKind } from '../../../dto/TimelineDTO'
import type { BoardBase } from '../board/boardPages'
import type { PageImage } from '../board/boardElements'

// Shared contract for the Excalidraw whiteboard editor.

export interface WhiteboardProps {
  /** The previously saved snapshot (from WorkspaceDTO.currentWhiteboardSnapshot). */
  initialSnapshot?: unknown
  /** Called debounced whenever the canvas changes (draft autosave). */
  onAutosave: (payload: { snapshot: unknown; thumbnail?: Blob }) => void
  /** true when the checkpoint is locked (after Teach is pressed) - canvas is read-only. */
  readOnly?: boolean
  /**
   * The pages this board stands on, when it stands on a PDF instead of being one
   * endless canvas. Absent - the plain whiteboard, exactly as before.
   */
  base?: BoardBase
  /** Rendered PDF pages, by page id. Pages still missing are drawn as paper. */
  pageImages?: ReadonlyMap<string, PageImage>
  /** The editor reports the stack back after it inserts or removes a page. */
  onBaseChange?: (base: BoardBase) => void
  /** The page the middle of the screen is on - what a checkpoint captures. */
  onActivePageChange?: (index: number) => void
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
  /**
   * Grab the current document and PNG snapshot when TeachButton is pressed.
   *
   * On a PDF-backed board the image is the PAGE being explained, not the whole
   * stack: that is what the user is teaching from, and handing Vision twenty
   * pages a turn would cost more and say less.
   */
  exportSnapshot: () => Promise<{ document: unknown; image?: Blob }>
  /** Drain board changes recorded since the last call, if an editor implements it. */
  flushTimeline?: () => BoardChange[]
  /** A PNG of only these elements, cropped to them: what changed since the last Teach. */
  exportImageOf?: (ids: string[]) => Promise<Blob | undefined>
  /** Slip blank paper in after this page, moving the marks below it down with it. */
  insertBlankPage?: (afterIndex: number) => void
  /** Take blank paper back out. PDF pages cannot be removed this way. */
  removeBlankPage?: (index: number) => void
  /** Scroll the canvas to a page, as the page bar's arrows do. */
  goToPage?: (index: number) => void
}
