import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Tldraw, getSnapshot, loadSnapshot, type Editor, type TLComponents } from 'tldraw'
import 'tldraw/tldraw.css'

interface WhiteboardProps {
  /** Bagian "document" dari snapshot tldraw sebelumnya (dari WorkspaceDTO.currentWhiteboardSnapshot) */
  initialSnapshot?: unknown
  /** Dipanggil debounced setiap ada perubahan di kanvas (autosave draft) */
  onAutosave: (payload: { snapshot: unknown; thumbnail?: Blob }) => void
  /** true saat checkpoint dikunci (setelah Teach ditekan) - whiteboard jadi read-only */
  readOnly?: boolean
}

export interface WhiteboardHandle {
  /** Ambil snapshot dokumen + gambar SAAT INI - dipanggil TeachButton pas ditekan, bukan debounced */
  exportSnapshot: () => Promise<{ document: unknown; image?: Blob }>
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

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function Whiteboard(
  { initialSnapshot, onAutosave, readOnly = false },
  ref
) {
  const editorRef = useRef<Editor | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // StylePanel & SelectionForeground dipaksa null saat locked - jangan andalkan
  // readonly bawaan tldraw buat nyembunyiin ini sendiri, karena shape masih bisa
  // ke-select dalam mode readonly (lihat tldraw/tldraw#5903) dan panel ikut nongol.
  // Ini juga yang bikin posisi LearnerResponseBubble di top-right aman dari collision.
  const components = useMemo<TLComponents>(
    () => ({
      Background: ParchmentBackground,
      ...(readOnly ? { StylePanel: null, SelectionForeground: null } : {}),
    }),
    [readOnly]
  )

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

  useImperativeHandle(
    ref,
    () => ({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialSnapshot, runAutosave]
  )

  // readOnly bisa berubah setelah editor mount (toggle lock/unlock berulang kali
  // dalam satu sesi) - sinkronkan tiap kali nilainya berubah.
  useEffect(() => {
    editorRef.current?.updateInstanceState({ isReadonly: readOnly })
  }, [readOnly])

  return (
    // Ngisi parent-nya (.canvasArea di WorkspacePage, flex:1 + position:relative).
    // Bukan lagi full-viewport - itu sebabnya kanvas sekarang gak pernah ketiban header.
    <div style={{ position: 'absolute', inset: 0 }}>
      <Tldraw onMount={handleMount} components={components} />
    </div>
  )
})