import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentProps,
} from 'react'
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
// Cogniva brand accent — must come AFTER Excalidraw's own CSS to win the cascade.
import '../../../styles/excalidraw-theme.css'
import type { WhiteboardHandle, WhiteboardProps } from './whiteboardTypes'

const AUTOSAVE_DEBOUNCE_MS = 1500
// Even during non-stop editing (where the debounce keeps resetting), force a
// save at least this often so a long session is never left unsaved.
const AUTOSAVE_MAX_INTERVAL_MS = 8000

// Parchment tone to match the app's look (tldraw uses the same #f5f0e4).
const CANVAS_BG = '#f5f0e4'

// Pull the exact types straight off the component's props so we never depend on
// Excalidraw's deep internal type paths (which move between versions).
type ExcalidrawAPI = Parameters<NonNullable<ComponentProps<typeof Excalidraw>['excalidrawAPI']>>[0]
type ExportOpts = Parameters<typeof exportToBlob>[0]

/** A persisted Excalidraw scene, as we store it in WorkspaceDTO.currentWhiteboardSnapshot. */
interface ExcalidrawSnapshot {
  elements?: unknown
  files?: unknown
  appState?: { viewBackgroundColor?: string }
}

// Excalidraw editor — used for PRODUCTION deployments (any non-localhost HTTPS
// domain), where it is a safe drop-in for tldraw, which would otherwise demand a
// paid license and blank the canvas. MIT-licensed, no domain/license enforcement.
const ExcalidrawWhiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function ExcalidrawWhiteboard(
  { initialSnapshot, onAutosave, readOnly = false },
  ref
) {
  const apiRef = useRef<ExcalidrawAPI | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Only adopt a stored snapshot if it actually looks like an Excalidraw scene —
  // a tldraw snapshot from a different deployment must not crash the load.
  const initialData = useMemo<ComponentProps<typeof Excalidraw>['initialData']>(() => {
    const s = initialSnapshot as ExcalidrawSnapshot | undefined
    const elements = s && Array.isArray(s.elements) ? s.elements : []
    return {
      elements,
      files: s?.files ?? {},
      appState: { viewBackgroundColor: s?.appState?.viewBackgroundColor ?? CANVAS_BG },
      scrollToContent: true,
    } as unknown as ComponentProps<typeof Excalidraw>['initialData']
  }, [initialSnapshot])

  /** Current scene as a plain, serializable document for autosave/checkpoint. */
  const buildDocument = useCallback(() => {
    const api = apiRef.current
    if (!api) return undefined
    try {
      const elements = api.getSceneElements()
      return {
        elements,
        files: api.getFiles(),
        appState: { viewBackgroundColor: api.getAppState().viewBackgroundColor ?? CANVAS_BG },
      }
    } catch {
      return undefined // API torn down (e.g. during unmount)
    }
  }, [])

  /** Render current elements to a PNG. Returns undefined when the canvas is empty. */
  const exportImage = useCallback(async (scale: number): Promise<Blob | undefined> => {
    const api = apiRef.current
    if (!api) return undefined
    const elements = api.getSceneElements()
    if (elements.length === 0) return undefined
    try {
      return await exportToBlob({
        elements,
        files: api.getFiles(),
        mimeType: 'image/png',
        appState: { ...api.getAppState(), exportBackground: true, exportScale: scale },
      } as ExportOpts)
    } catch {
      return undefined
    }
  }, [])

  const dirtyRef = useRef(false)

  const runAutosave = useCallback(
    (withThumbnail: boolean) => {
      const doc = buildDocument()
      if (!doc) return
      // Skip empty scenes: nothing to persist yet, and it avoids flipping a fresh
      // Draft into Teaching on Excalidraw's initial onChange (which fires on mount).
      if ((doc.elements as readonly unknown[]).length === 0) return
      if (!withThumbnail) {
        onAutosave({ snapshot: doc })
        return
      }
      exportImage(0.4)
        .then((thumbnail) => onAutosave({ snapshot: doc, thumbnail }))
        .catch(() => onAutosave({ snapshot: doc }))
    },
    [buildDocument, exportImage, onAutosave]
  )

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

  // Excalidraw's onChange fires for any scene/appState change; mark dirty and
  // save shortly after the last edit (the interval + exit handlers below cover
  // long sessions and leaving the page).
  const handleChange = useCallback(() => {
    dirtyRef.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => flush(true), AUTOSAVE_DEBOUNCE_MS)
  }, [flush])

  useImperativeHandle(
    ref,
    () => ({
      exportSnapshot: async () => {
        const document = buildDocument()
        const image = await exportImage(1)
        return { document, image }
      },
    }),
    [buildDocument, exportImage]
  )

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
    <div style={{ position: 'absolute', inset: 0 }}>
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api
        }}
        initialData={initialData}
        onChange={handleChange}
        viewModeEnabled={readOnly}
      />
    </div>
  )
})

export default ExcalidrawWhiteboard
