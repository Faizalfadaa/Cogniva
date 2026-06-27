import { useCallback, useRef } from 'react'
import { Tldraw, getSnapshot, loadSnapshot, type Editor, type TLComponents } from 'tldraw'
import 'tldraw/tldraw.css'

interface WhiteboardProps {
  /** Bagian "document" dari snapshot tldraw sebelumnya (dari WorkspaceDTO.currentWhiteboardSnapshot) */
  initialSnapshot?: unknown
  /** Dipanggil debounced setiap ada perubahan di kanvas */
  onAutosave: (payload: { snapshot: unknown; thumbnail?: Blob }) => void
}

const AUTOSAVE_DEBOUNCE_MS = 3000

// Background custom (Parchment + dot grid) - ini cara resmi tldraw v5 untuk
// override canvas background lewat komponen `Background`, bukan hack CSS variable.
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

const components: TLComponents = {
  Background: ParchmentBackground,
}

export function Whiteboard({ initialSnapshot, onAutosave }: WhiteboardProps) {
  const editorRef = useRef<Editor | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runAutosave = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const { document } = getSnapshot(editor.store)
    const shapeIds = [...editor.getCurrentPageShapeIds()]

    if (shapeIds.length === 0) {
      onAutosave({ snapshot: document })
      return
    }

    // Thumbnail kecil buat preview card di Home - resolusi rendah, gak perlu tajam.
    editor
      .toImage(shapeIds, { format: 'png', background: true, scale: 0.4 })
      .then((result) => onAutosave({ snapshot: document, thumbnail: result?.blob }))
      .catch(() => onAutosave({ snapshot: document }))
  }, [onAutosave])

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor

      if (initialSnapshot) {
        try {
          loadSnapshot(editor.store, { document: initialSnapshot as never })
        } catch {
          // Snapshot lama/incompatible - lanjut dengan kanvas kosong saja.
        }
      }

      const unsubscribe = editor.store.listen(
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(runAutosave, AUTOSAVE_DEBOUNCE_MS)
        },
        { scope: 'document', source: 'user' }
      )

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        unsubscribe()
      }
    },
    [initialSnapshot, runAutosave]
  )

  return (
    // TODO: full-viewport buat sekarang. Akan disesuaikan saat TeachButton,
    // title/description/PDF, dan LearnerPanel masuk di increment berikutnya.
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw onMount={handleMount} components={components} />
    </div>
  )
}