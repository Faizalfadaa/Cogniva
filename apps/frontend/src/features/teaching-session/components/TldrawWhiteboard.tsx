import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Tldraw, getSnapshot, loadSnapshot, type Editor, type TLComponents } from 'tldraw'
import 'tldraw/tldraw.css'
import type { BoardChange, WhiteboardHandle, WhiteboardProps } from './whiteboardTypes'

// Only shape records are interesting for the timeline; a document-scope change
// also covers pages and assets, which say nothing about what was drawn.
const SHAPE_ID_PREFIX = 'shape:'

/**
 * The slice of tldraw's RecordsDiff we actually read. Declared structurally so
 * this file doesn't import from @tldraw/store, which is a transitive dependency
 * rather than one this app declares.
 */
interface StoreChanges {
  added: Record<string, unknown>
  updated: Record<string, unknown>
  removed: Record<string, unknown>
}

const AUTOSAVE_DEBOUNCE_MS = 1500
// Force a save at least this often during non-stop editing (debounce keeps resetting).
const AUTOSAVE_MAX_INTERVAL_MS = 8000

// Custom background (Parchment + dot grid) - this is the official tldraw v5 way
// to override the canvas background via the `Background` component, not a CSS-variable hack.
function ParchmentBackground() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#f5f0e4',
        backgroundImage: 'radial-gradient(circle, #bba98855 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    />
  )
}

// tldraw editor — used for local development on localhost, where tldraw runs in
// its free "development" mode (no license key required). On a production HTTPS
// domain tldraw demands a paid license, so production builds swap in Excalidraw
// (see Whiteboard.tsx).
const TldrawWhiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function TldrawWhiteboard(
  { initialSnapshot, onAutosave, readOnly = false },
  ref
) {
  const editorRef = useRef<Editor | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  // Board changes since the last flushTimeline(), oldest first. Purely additive
  // to autosave — nothing here feeds the debounce or the snapshot.
  const eventsRef = useRef<BoardChange[]>([])

  // StylePanel & SelectionForeground are forced null when locked - don't rely on
  // tldraw's built-in readonly to hide these itself, because shapes can still be
  // selected in readonly mode (see tldraw/tldraw#5903) and the panel shows up too.
  // This is also what keeps the LearnerResponseBubble's top-right position collision-safe.
  const components = useMemo<TLComponents>(
    () => ({
      Background: ParchmentBackground,
      ...(readOnly ? { StylePanel: null, SelectionForeground: null } : {}),
    }),
    [readOnly]
  )

  const runAutosave = useCallback(
    (withThumbnail: boolean) => {
      const editor = editorRef.current
      if (!editor) return

      try {
        const { document } = getSnapshot(editor.store)
        const shapeIds = [...editor.getCurrentPageShapeIds()]

        if (shapeIds.length === 0 || !withThumbnail) {
          onAutosave({ snapshot: document })
          return
        }

        // Small thumbnail for the Home preview card - low res, doesn't need to be sharp.
        editor
          .toImage(shapeIds, { format: 'png', background: true, scale: 0.4 })
          .then((result) => onAutosave({ snapshot: document, thumbnail: result?.blob }))
          .catch(() => onAutosave({ snapshot: document }))
      } catch {
        // editor already torn down (e.g. during unmount)
      }
    },
    [onAutosave]
  )

  /**
   * Append one board change to the timeline buffer (Phase 1: capture only).
   *
   * NOTE for review: a single store entry can touch several buckets at once
   * (e.g. a cut-and-paste adds and removes in one go), but BoardEvent carries
   * exactly one `kind`. This follows the agreed shape — all touched shape ids
   * together, `kind` chosen by precedence — which means a mixed entry is
   * labelled by its dominant bucket. If Phase 2 needs per-shape accuracy,
   * emitting one event per non-empty bucket would be the change to make.
   */
  const recordBoardChange = useCallback((changes: StoreChanges) => {
    const shapeIds = [
      ...Object.keys(changes.added),
      ...Object.keys(changes.updated),
      ...Object.keys(changes.removed),
    ].filter((id) => id.startsWith(SHAPE_ID_PREFIX))

    // A change that touched no shape (page rename, asset bookkeeping) is not a
    // board event.
    if (shapeIds.length === 0) return

    const kind: BoardChange['kind'] = Object.keys(changes.added).length
      ? 'add'
      : Object.keys(changes.removed).length
        ? 'delete'
        : 'update'

    eventsRef.current.push({ at: Date.now(), shapeIds, kind })
  }, [])

  /** Run the pending save immediately (if there are unsaved changes). */
  const flush = useCallback(
    (withThumbnail: boolean) => {
      if (!dirtyRef.current) return
      dirtyRef.current = false
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      runAutosave(withThumbnail)
    },
    [runAutosave]
  )

  useImperativeHandle(
    ref,
    () => ({
      flushTimeline: () => {
        const events = eventsRef.current
        eventsRef.current = []
        return events
      },
      exportSnapshot: async () => {
        const editor = editorRef.current
        if (!editor) return { document: undefined }

        const { document } = getSnapshot(editor.store)
        const shapeIds = [...editor.getCurrentPageShapeIds()]
        if (shapeIds.length === 0) return { document }

        try {
          const result = await editor.toImage(shapeIds, { format: 'png', background: true })
          return { document, image: result?.blob }
        } catch {
          return { document }
        }
      },
    }),
    []
  )

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor
      editor.updateInstanceState({ isReadonly: readOnly })

      if (initialSnapshot) {
        try {
          loadSnapshot(editor.store, { document: initialSnapshot as never })
        } catch {
          // Old/incompatible snapshot - just continue with an empty canvas.
        }
      }

      const unsubscribe = editor.store.listen(
        (entry) => {
          dirtyRef.current = true
          // Autosave behaviour below is untouched; this line is the only
          // addition — the diff tldraw was already handing us is now recorded.
          recordBoardChange(entry.changes)
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => flush(true), AUTOSAVE_DEBOUNCE_MS)
        },
        { scope: 'document', source: 'user' }
      )

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        unsubscribe()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialSnapshot, flush, recordBoardChange]
  )

  // readOnly can change after the editor mounts (toggling lock/unlock repeatedly
  // within one session) - sync it whenever the value changes.
  useEffect(() => {
    editorRef.current?.updateInstanceState({ isReadonly: readOnly })
  }, [readOnly])

  // Safety nets so a session is saved even without pausing: a periodic flush
  // during long editing, and a flush when the tab is hidden/closed or the
  // component unmounts (navigating away).
  useEffect(() => {
    const interval = setInterval(() => flush(true), AUTOSAVE_MAX_INTERVAL_MS)
    const onPageHide = () => flush(false)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush(false)
    }
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
      flush(false) // persist the latest before this editor goes away
    }
  }, [flush])

  return (
    // Ngisi parent-nya (.canvasArea di WorkspacePage, flex:1 + position:relative).
    // Bukan lagi full-viewport - itu sebabnya kanvas sekarang gak pernah ketiban header.
    <div style={{ position: 'absolute', inset: 0 }}>
      <Tldraw onMount={handleMount} components={components} />
    </div>
  )
})

export default TldrawWhiteboard
