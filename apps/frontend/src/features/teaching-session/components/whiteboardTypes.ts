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

export interface WhiteboardHandle {
  /** Grab the CURRENT document + PNG snapshot — called when TeachButton is pressed, not debounced. */
  exportSnapshot: () => Promise<{ document: unknown; image?: Blob }>
}
