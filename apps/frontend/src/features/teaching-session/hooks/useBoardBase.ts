import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CognivaBridge } from '../../../bridge/CognivaBridge'
import { resolveFileHref } from '../../../bridge/fileHref'
import type { WorkspaceDTO } from '../../../dto/WorkspaceDTO'
import type { WhiteboardHandle } from '../components/whiteboardTypes'
import type { PageImage } from '../board/boardElements'
import {
  MAX_PDF_PAGES,
  pagesFromPdf,
  readBoardBase,
  type BoardBase,
  type BoardBaseSource,
} from '../board/boardPages'
import { measureImage, renderPdfPages } from '../board/pdfPages'

const NO_IMAGES: ReadonlyMap<string, PageImage> = new Map()

interface UseBoardBaseArgs {
  workspace?: WorkspaceDTO
  bridge: CognivaBridge
  /** Keeps the caller's copy of the workspace current after an upload. */
  onWorkspaceChange: (workspace: WorkspaceDTO) => void
  boardRef: RefObject<WhiteboardHandle>
}

/**
 * Owns what the board stands on: which PDF, which pages, which page is in view.
 *
 * The pages are rendered here rather than in the editor because rendering is
 * asynchronous and the editor should not have to hold a loading state; it takes
 * pages and pictures as props and draws them. Pictures live in memory only — see
 * boardPages.ts for why they are never saved.
 */
export function useBoardBase({
  workspace,
  bridge,
  onWorkspaceChange,
  boardRef,
}: UseBoardBaseArgs) {
  const [base, setBase] = useState<BoardBase | undefined>(undefined)
  const [pageImages, setPageImages] = useState<ReadonlyMap<string, PageImage>>(NO_IMAGES)
  const [activePage, setActivePage] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | undefined>(undefined)
  /** How many pages the file really has, when more than the board shows. */
  const [cappedAt, setCappedAt] = useState<number | undefined>(undefined)

  /**
   * Seeded from the saved scene exactly once.
   *
   * The workspace is re-fetched while a session runs (polling the state), and a
   * later copy carries the snapshot as it was when it was last read — adopting it
   * again would undo paper the user has since inserted.
   */
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current || !workspace) return
    seededRef.current = true
    const saved = readBoardBase(workspace.currentWhiteboardSnapshot)
    if (saved) setBase(saved)
  }, [workspace])

  /** Which PDF the pictures in state were rendered from. */
  const renderedRef = useRef<string | undefined>(undefined)

  const sourceUrl = useCallback(
    (source: BoardBaseSource): string | undefined => {
      const url = source === 'reference' ? workspace?.pdfUrl : workspace?.boardPdfUrl
      return url ? resolveFileHref(url) : undefined
    },
    [workspace?.boardPdfUrl, workspace?.pdfUrl]
  )

  // Render the pages whenever the board points at a different PDF. Inserting
  // paper changes `base.pages` but not the file, so it must not land here.
  useEffect(() => {
    if (!base) {
      renderedRef.current = undefined
      setPageImages(NO_IMAGES)
      setCappedAt(undefined)
      return
    }

    const url = sourceUrl(base.source)
    if (!url || renderedRef.current === url) return

    let active = true
    renderedRef.current = url
    setBusy(true)
    setProblem(undefined)

    renderPdfPages(url)
      .then(({ pageCount, pages }) => {
        if (!active) return

        void Promise.all(pages.map((dataUrl) => measureImage(dataUrl))).then((sizes) => {
          if (!active) return
          const images = new Map<string, PageImage>()
          pages.forEach((dataUrl, index) => {
            images.set(`p${index + 1}`, { dataUrl, ...sizes[index] })
          })
          setPageImages(images)
          setCappedAt(pageCount > MAX_PDF_PAGES ? pageCount : undefined)
          // A base adopted from the picker has no pages yet; a base read back
          // from a saved scene already has them, paper included, and keeps them.
          setBase((current) => {
            if (!current || current.pages.length > 0) return current
            return { ...current, pages: pagesFromPdf(Math.min(pageCount, MAX_PDF_PAGES)) }
          })
          setBusy(false)
        })
      })
      .catch((err) => {
        if (!active) return
        console.error('[useBoardBase] rendering the PDF failed', err)
        // Back to the whiteboard rather than an empty stack: a board with no
        // pages and no canvas would be a blank screen with no way out.
        renderedRef.current = undefined
        setBase(undefined)
        setProblem('failed')
        setBusy(false)
      })

    return () => {
      active = false
    }
  }, [base, sourceUrl])

  const chooseSource = useCallback(
    (source: BoardBaseSource) => {
      setProblem(undefined)
      setBase((current) => {
        // Switching back to a PDF this board already had keeps its pages, so the
        // paper someone inserted survives a trip through the picker.
        if (current?.source === source) return current
        const saved = readBoardBase(workspace?.currentWhiteboardSnapshot)
        return saved?.source === source ? saved : { source, pages: [] }
      })
      setActivePage(0)
      setMenuOpen(false)
    },
    [workspace?.currentWhiteboardSnapshot]
  )

  const uploadPdf = useCallback(
    async (file: File) => {
      if (!workspace) return
      setBusy(true)
      setProblem(undefined)
      try {
        const updated = await bridge.uploadBoardPdf(workspace.id, file)
        onWorkspaceChange(updated)
        // A new file means a new stack; the pages follow once it has rendered.
        renderedRef.current = undefined
        setBase({ source: 'board', pages: [] })
        setActivePage(0)
        setMenuOpen(false)
      } catch (err) {
        console.error('[useBoardBase] uploading the board PDF failed', err)
        setProblem('failed')
      } finally {
        setBusy(false)
      }
    },
    [bridge, onWorkspaceChange, workspace]
  )

  const clearBase = useCallback(() => {
    setBase(undefined)
    setActivePage(0)
    setMenuOpen(false)
  }, [])

  const goToPage = useCallback(
    (index: number) => {
      boardRef.current?.goToPage?.(index)
      setActivePage(index)
    },
    [boardRef]
  )

  const addBlank = useCallback(
    (afterIndex: number) => boardRef.current?.insertBlankPage?.(afterIndex),
    [boardRef]
  )

  const removeBlank = useCallback(
    (index: number) => boardRef.current?.removeBlankPage?.(index),
    [boardRef]
  )

  return {
    base,
    pageImages,
    activePage,
    busy,
    /** 'failed' when the last PDF could not be opened; the caller translates it. */
    problem,
    /** Set when the file has more pages than the board renders. */
    cappedAt,
    menuOpen,
    openMenu: () => setMenuOpen(true),
    closeMenu: () => setMenuOpen(false),
    chooseSource,
    uploadPdf,
    clearBase,
    goToPage,
    addBlank,
    removeBlank,
    /** The editor reports the stack back after it inserts or removes a page. */
    onBaseChange: setBase,
    onActivePageChange: setActivePage,
  }
}
