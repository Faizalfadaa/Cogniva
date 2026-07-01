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

const AUTOSAVE_DEBOUNCE_MS = 3000

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
    const elements = api.getSceneElements()
    return {
      elements,
      files: api.getFiles(),
      appState: { viewBackgroundColor: api.getAppState().viewBackgroundColor ?? CANVAS_BG },
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

  const runAutosave = useCallback(() => {
    const document = buildDocument()
    if (!document) return
    // Empty canvas: persist the (empty) document, no thumbnail — mirrors tldraw.
    if ((document.elements as readonly unknown[]).length === 0) {
      onAutosave({ snapshot: document })
      return
    }
    exportImage(0.4)
      .then((thumbnail) => onAutosave({ snapshot: document, thumbnail }))
      .catch(() => onAutosave({ snapshot: document }))
  }, [buildDocument, exportImage, onAutosave])

  // Excalidraw's onChange fires for any scene/appState change; debounce like tldraw.
  const handleChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(runAutosave, AUTOSAVE_DEBOUNCE_MS)
  }, [runAutosave])

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

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    []
  )

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
