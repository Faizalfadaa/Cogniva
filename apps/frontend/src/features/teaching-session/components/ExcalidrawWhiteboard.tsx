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
import type { BoardChange, WhiteboardHandle, WhiteboardProps } from './whiteboardTypes'
import { appendEvent, boardEvents, versionsOf, type BoardVersions, type ElementLike } from './boardDiff'
import {
  activePageFromViewport,
  elementsOnPage,
  insertBlankAfter,
  PAGE_ID_PREFIX,
  pageBox,
  removePage,
  scrollToPage,
  shiftElementsBelow,
  userElements,
  type BoardBase,
  type PositionedElement,
} from '../board/boardPages'
import { buildPageElements, pageElementId } from '../board/boardElements'

const AUTOSAVE_DEBOUNCE_MS = 1500
// Even during non-stop editing (where the debounce keeps resetting), force a
// save at least this often so a long session is never left unsaved.
const AUTOSAVE_MAX_INTERVAL_MS = 8000

// Parchment tone to match the app's look.
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
// domain), where it is a safe whiteboard engine without domain enforcement.
// paid license and blank the canvas. MIT-licensed, no domain/license enforcement.
const ExcalidrawWhiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function ExcalidrawWhiteboard(
  {
    initialSnapshot,
    onAutosave,
    readOnly = false,
    base,
    pageImages,
    onBaseChange,
    onActivePageChange,
  },
  ref
) {
  const apiRef = useRef<ExcalidrawAPI | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * The stack as the editor holds it. Kept in a ref beside the prop because the
   * page commands below (insert, remove) read and write it synchronously, in the
   * same breath as the scene they have to move; waiting for a re-render would
   * mean two inserts in quick succession losing one of them.
   */
  const baseRef = useRef<BoardBase | undefined>(base)
  const activePageRef = useRef(0)

  // Only adopt a stored snapshot if it actually looks like an Excalidraw scene —
  // an incompatible snapshot from an older deployment must not crash the load.
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

  /**
   * When each element was drawn, kept for the checkpoint's timeline.
   *
   * This editor never produced one: the hook was optional, Excalidraw was
   * added without it, and every checkpoint went out with an empty timeline, so
   * nothing could say which mark was made while which words were spoken. The
   * elements carry their own edit times, so the scene is compared with what was
   * last seen on each change. Seeded from the loaded scene, so opening a board
   * does not record everything already on it as just drawn.
   */
  const seenRef = useRef<BoardVersions>(
    versionsOf((initialData as { elements?: ElementLike[] } | undefined)?.elements)
  )
  const timelineRef = useRef<BoardChange[]>([])

  /** Whether the canvas has already been framed on the first page. */
  const framedRef = useRef(false)
  /**
   * Whether this board has ever stood on a PDF.
   *
   * Taking the base away has to be saved even when nothing is written on the
   * board, otherwise the empty-scene shortcut in runAutosave would skip the one
   * save that records it and the pages would return on reload.
   */
  const hadBaseRef = useRef(Boolean(base))

  /** Put the canvas on a page, the way the page bar's arrows do. */
  const goToPage = useCallback((index: number) => {
    const api = apiRef.current
    const pages = baseRef.current?.pages
    if (!api || !pages || index < 0 || index >= pages.length) return
    const state = api.getAppState()
    const { scrollY } = scrollToPage(index, {
      height: state.height,
      zoom: state.zoom.value,
    })
    api.updateScene({ appState: { scrollX: -pageBox(index).x + 40, scrollY } })
  }, [])


  const recordChanges = useCallback((elements: readonly unknown[]) => {
    const { events, seen } = boardEvents(
      seenRef.current,
      elements as readonly ElementLike[],
      Date.now()
    )
    seenRef.current = seen
    for (const event of events) appendEvent(timelineRef.current, event)
  }, [])

  /**
   * Current scene as a plain, serializable document for autosave/checkpoint.
   *
   * The pages are left out and described instead (`board`): they are locked,
   * derived entirely from the PDF, and re-rendered on open. Keeping them in
   * would put a few megabytes of re-encoded page images into every autosave —
   * one every couple of seconds — and into every checkpoint after that.
   */
  const buildDocument = useCallback(() => {
    const api = apiRef.current
    if (!api) return undefined
    try {
      const elements = userElements(api.getSceneElements())
      const files = Object.fromEntries(
        Object.entries(api.getFiles()).filter(([id]) => !id.startsWith(PAGE_ID_PREFIX))
      )
      const held = baseRef.current
      const board = held && held.pages.length > 0 ? held : undefined
      return {
        elements,
        files,
        appState: { viewBackgroundColor: api.getAppState().viewBackgroundColor ?? CANVAS_BG },
        ...(board ? { board } : {}),
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

  /**
   * Render ONE page: the page itself plus the marks made on it.
   *
   * This is what a PDF-backed board sends when Teach is pressed. The page is the
   * unit the user is teaching in, so it is the unit the student should be shown —
   * and a single page keeps the picture legible where the whole stack would
   * shrink the print past reading.
   */
  const exportPage = useCallback(
    async (index: number, scale: number): Promise<Blob | undefined> => {
      const api = apiRef.current
      const pages = baseRef.current?.pages
      if (!api || !pages || index < 0 || index >= pages.length) return undefined

      const scene = api.getSceneElements()
      const pageId = pageElementId(pages[index])
      const page = scene.find((element) => element.id === pageId)
      const marks = elementsOnPage(
        scene as unknown as PositionedElement[],
        index,
        pages.length
      )
      const elements = [...(page ? [page] : []), ...marks]
      if (elements.length === 0) return undefined

      try {
        return await exportToBlob({
          elements: elements as unknown as Parameters<typeof exportToBlob>[0]['elements'],
          files: api.getFiles(),
          mimeType: 'image/png',
          appState: { ...api.getAppState(), exportBackground: true, exportScale: scale },
        } as ExportOpts)
      } catch {
        return undefined
      }
    },
    []
  )

  /** Render just these elements to a PNG, cropped to them. */
  const exportImageOf = useCallback(async (ids: string[]): Promise<Blob | undefined> => {
    const api = apiRef.current
    if (!api || ids.length === 0) return undefined
    const wanted = new Set(ids)
    const elements = api.getSceneElements().filter((element) => wanted.has(element.id))
    if (elements.length === 0) return undefined
    try {
      return await exportToBlob({
        elements,
        files: api.getFiles(),
        mimeType: 'image/png',
        appState: { ...api.getAppState(), exportBackground: true, exportScale: 1 },
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
      //
      // A board standing on a PDF is NOT empty even with nothing written on it:
      // which pages it has, and where the blank paper sits, is the thing that
      // would be lost on reload.
      if ((doc.elements as readonly unknown[]).length === 0 && !doc.board && !hadBaseRef.current) {
        return
      }
      if (!withThumbnail) {
        onAutosave({ snapshot: doc })
        return
      }
      // On a PDF board the preview is the page being worked on; a thumbnail of
      // the whole stack would be a thin unreadable ribbon on the Home card.
      const preview = doc.board
        ? exportPage(activePageRef.current, 0.4)
        : exportImage(0.4)
      preview
        .then((thumbnail) => onAutosave({ snapshot: doc, thumbnail }))
        .catch(() => onAutosave({ snapshot: doc }))
    },
    [buildDocument, exportImage, exportPage, onAutosave]
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

  /**
   * Keep the scene's pages in step with the stack.
   *
   * The pages are rebuilt rather than patched: there are at most a few dozen of
   * them, they are entirely derived from `base` plus the rendered pictures, and
   * rebuilding is the only version of this that cannot drift out of step with
   * what was saved. The user's marks are carried across untouched.
   */
  useEffect(() => {
    baseRef.current = base
    const api = apiRef.current
    if (!api) return

    // Back to the endless whiteboard: the pages go, the marks stay where they
    // were made. Saving has to happen even with nothing written, or reopening
    // would bring the pages back (see runAutosave).
    if (!base) {
      if (!hadBaseRef.current) return
      framedRef.current = false
      api.updateScene({
        elements: userElements(api.getSceneElements()) as unknown as Parameters<
          ExcalidrawAPI['updateScene']
        >[0]['elements'],
      })
      flush(true)
      return
    }

    hadBaseRef.current = true

    const { elements, files } = buildPageElements(base.pages, pageImages ?? new Map())
    const fileList = Object.values(files)
    if (fileList.length > 0) {
      api.addFiles(fileList as Parameters<ExcalidrawAPI['addFiles']>[0])
    }

    const marks = userElements(api.getSceneElements())
    api.updateScene({
      elements: [...elements, ...marks] as unknown as Parameters<
        ExcalidrawAPI['updateScene']
      >[0]['elements'],
    })

    // Open on the first page rather than wherever the saved marks happen to be.
    if (!framedRef.current) {
      framedRef.current = true
      goToPage(0)
    }
  }, [base, flush, pageImages, goToPage])

  // Excalidraw's onChange fires for any scene/appState change; mark dirty and
  // save shortly after the last edit (the interval + exit handlers below cover
  // long sessions and leaving the page).
  const handleChange = useCallback(
    (elements: readonly unknown[], appState: { scrollY: number; height: number; zoom: { value: number } }) => {
      // Only the user's marks are the timeline: injecting or shifting pages is
      // the app rearranging paper, not the teacher drawing something.
      recordChanges(userElements(elements as readonly ElementLike[]))

      const pages = baseRef.current?.pages
      if (pages && pages.length > 0) {
        const active = activePageFromViewport(
          { scrollY: appState.scrollY, height: appState.height, zoom: appState.zoom.value },
          pages.length
        )
        if (active !== activePageRef.current) {
          activePageRef.current = active
          onActivePageChange?.(active)
        }
      }

      dirtyRef.current = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => flush(true), AUTOSAVE_DEBOUNCE_MS)
    },
    [flush, onActivePageChange, recordChanges]
  )

  /**
   * Rearrange the stack: a new page appears, and everything below it comes down
   * with it so no mark is left on the wrong page (see insertBlankAfter).
   *
   * The scene is moved here and the new stack is reported upwards, rather than
   * the parent changing `base` and this reacting to it: the marks have to move in
   * the same update as the pages, or the two would be briefly out of step and an
   * autosave landing in between would persist the mismatch.
   */
  const applyPageChange = useCallback(
    (change: { pages: BoardBase['pages']; shiftFrom: number; shiftBy: number } | null) => {
      const api = apiRef.current
      const current = baseRef.current
      if (!api || !current || !change) return

      const next: BoardBase = { source: current.source, pages: change.pages }
      baseRef.current = next

      const marks = shiftElementsBelow(
        userElements(api.getSceneElements()) as unknown as PositionedElement[],
        change.shiftFrom,
        change.shiftBy
      )
      const { elements, files } = buildPageElements(next.pages, pageImages ?? new Map())
      const fileList = Object.values(files)
      if (fileList.length > 0) {
        api.addFiles(fileList as Parameters<ExcalidrawAPI['addFiles']>[0])
      }
      api.updateScene({
        elements: [...elements, ...marks] as unknown as Parameters<
          ExcalidrawAPI['updateScene']
        >[0]['elements'],
      })

      onBaseChange?.(next)
      // Saved now rather than on the debounce: a page the user added and then
      // closed the tab on must not be gone when they come back.
      flush(true)
    },
    [flush, onBaseChange, pageImages]
  )

  useImperativeHandle(
    ref,
    () => ({
      exportSnapshot: async () => {
        const document = buildDocument()
        const image = baseRef.current
          ? await exportPage(activePageRef.current, 1)
          : await exportImage(1)
        return { document, image }
      },
      exportImageOf,
      flushTimeline: () => {
        const events = timelineRef.current
        timelineRef.current = []
        return events
      },
      insertBlankPage: (afterIndex: number) => {
        const pages = baseRef.current?.pages
        if (!pages) return
        applyPageChange(insertBlankAfter(pages, afterIndex))
        // Land on the page that was just added; adding paper means wanting to
        // write on it.
        goToPage(Math.max(0, Math.min(afterIndex + 1, pages.length)))
      },
      removeBlankPage: (index: number) => {
        const pages = baseRef.current?.pages
        if (!pages) return
        applyPageChange(removePage(pages, index))
        goToPage(Math.max(0, index - 1))
      },
      goToPage,
    }),
    [applyPageChange, buildDocument, exportImage, exportImageOf, exportPage, goToPage]
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
