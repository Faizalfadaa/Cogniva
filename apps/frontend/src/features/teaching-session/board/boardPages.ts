/**
 * The board as a stack of pages.
 *
 * A board used to be one endless canvas. It can now stand on a PDF instead: each
 * of its pages becomes a locked picture on the canvas, laid out top to bottom,
 * and the user writes over them the way they would write in a book. Blank pages
 * can be slipped in between, for the working-out that does not fit in a margin.
 *
 * Everything here is arithmetic and plain objects on purpose — no Excalidraw API,
 * no canvas, no PDF. The editor component owns the side effects; this owns the
 * layout, and can therefore be tested directly.
 *
 * Two rules hold the whole design together:
 *
 * 1. Pages are LOCKED and are not part of what gets saved. The saved scene holds
 *    the user's marks and a small description of the pages (`BoardBase`); the
 *    page pictures are rendered again from the PDF on open. Otherwise every
 *    autosave — one every few seconds — would carry megabytes of re-encoded PDF
 *    pages to the server and back.
 * 2. Every page is the same box. A PDF page that is a different shape is fitted
 *    inside it. Uniform boxes make "which page is this mark on" and "shift
 *    everything below the insertion point" simple arithmetic instead of a
 *    layout engine, and within one document the pages are the same shape anyway.
 */

/** Canvas units across, for every page. Tuned so handwriting feels natural. */
export const PAGE_WIDTH = 1240

/** A4 portrait. A PDF whose pages are a different shape is fitted inside it. */
export const PAGE_ASPECT = 1.4142

export const PAGE_HEIGHT = Math.round(PAGE_WIDTH * PAGE_ASPECT)

/** Space between two pages, so the seam reads as a page break. */
export const PAGE_GAP = 72

/** Element ids for pages carry this prefix, which is how they are recognized. */
export const PAGE_ID_PREFIX = 'cogniva-page-'

/**
 * Rendering more pages than this eagerly is slower and heavier than it is worth;
 * a lesson works through a handful of pages, not a whole textbook at once.
 */
export const MAX_PDF_PAGES = 40

/** Where the board's pages come from. */
export type BoardBaseSource =
  /** A PDF uploaded to be written on. */
  | 'board'
  /**
   * The reference PDF the session already has. The user's call: only the page
   * they are explaining is ever captured into a checkpoint, and the student is
   * then a student being taught out of a book, which is the role it always had.
   */
  | 'reference'

export type BoardPage =
  /** Page `pdfPage` (1-based) of the PDF. */
  | { id: string; kind: 'pdf'; pdfPage: number }
  /** Paper slipped in for working out; belongs to no PDF page. */
  | { id: string; kind: 'blank' }

/** What the saved scene records about its pages, in place of the pictures. */
export interface BoardBase {
  source: BoardBaseSource
  pages: BoardPage[]
}

/** A page's box on the canvas. */
export interface PageBox {
  x: number
  y: number
  width: number
  height: number
}

export function pageBox(index: number): PageBox {
  return {
    x: 0,
    y: index * (PAGE_HEIGHT + PAGE_GAP),
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  }
}

/** The whole stack's height, used to frame the board when it opens. */
export function stackHeight(pageCount: number): number {
  if (pageCount <= 0) return 0
  return pageCount * PAGE_HEIGHT + (pageCount - 1) * PAGE_GAP
}

/** The first pages of a freshly attached PDF, one board page each. */
export function pagesFromPdf(pageCount: number): BoardPage[] {
  const count = Math.max(0, Math.min(pageCount, MAX_PDF_PAGES))
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    kind: 'pdf' as const,
    pdfPage: i + 1,
  }))
}

/** An id no page in `pages` is using, so ids stay stable across inserts. */
function freshPageId(pages: BoardPage[]): string {
  const used = new Set(pages.map((page) => page.id))
  for (let n = pages.length + 1; ; n++) {
    const id = `p${n}`
    if (!used.has(id)) return id
  }
}

/**
 * Slip a blank page in after `index`, and say how far everything below has to
 * move.
 *
 * The shift matters: a mark sitting on page 4 has to stay on page 4 when a page
 * appears above it. Without it, inserting a page would silently peel every
 * annotation off the page it belongs to — which is worse than not having the
 * feature. `shiftFrom` is the top of the gap the new page takes, and every
 * element at or below it moves down by `shiftBy`.
 */
export function insertBlankAfter(
  pages: BoardPage[],
  index: number
): { pages: BoardPage[]; shiftFrom: number; shiftBy: number } {
  // A negative index means "before everything", which is how a blank first page
  // gets added; anything past the end appends.
  const at = Math.max(-1, Math.min(index, pages.length - 1))
  const next = [...pages]
  next.splice(at + 1, 0, { id: freshPageId(pages), kind: 'blank' })

  return {
    pages: next,
    shiftFrom: pageBox(at + 1).y,
    shiftBy: PAGE_HEIGHT + PAGE_GAP,
  }
}

/** Drop a page. Blank pages can be taken back out; PDF pages stay. */
export function removePage(
  pages: BoardPage[],
  index: number
): { pages: BoardPage[]; shiftFrom: number; shiftBy: number } | null {
  const page = pages[index]
  if (!page || page.kind !== 'blank') return null

  return {
    pages: pages.filter((_, i) => i !== index),
    shiftFrom: pageBox(index + 1).y,
    shiftBy: -(PAGE_HEIGHT + PAGE_GAP),
  }
}

/** An element as much as this module needs to know about one. */
export interface PositionedElement {
  id: string
  x: number
  y: number
  width?: number
  height?: number
  [key: string]: unknown
}

/** True for the locked pictures and frames that ARE the pages. */
export function isPageElement(element: { id?: unknown }): boolean {
  return typeof element.id === 'string' && element.id.startsWith(PAGE_ID_PREFIX)
}

/** The user's own marks: everything that is not a page. */
export function userElements<T extends { id?: unknown }>(elements: readonly T[]): T[] {
  return elements.filter((element) => !isPageElement(element))
}

/**
 * Move every element at or below `from` down by `by`, so marks keep the page
 * they were made on when a page is inserted above or removed.
 */
export function shiftElementsBelow<T extends PositionedElement>(
  elements: readonly T[],
  from: number,
  by: number
): T[] {
  return elements.map((element) =>
    element.y >= from ? { ...element, y: element.y + by } : element
  )
}

/**
 * Which page a mark belongs to: the one whose band contains its middle.
 *
 * The middle rather than the top, so a stroke that starts in the gap above a
 * page still counts as being on that page. Marks past the last page clamp to it
 * instead of vanishing from every export.
 */
export function pageIndexOfElement(
  element: PositionedElement,
  pageCount: number
): number {
  if (pageCount <= 0) return -1
  const middle = element.y + (element.height ?? 0) / 2
  const stride = PAGE_HEIGHT + PAGE_GAP
  const index = Math.floor(middle / stride)
  return Math.max(0, Math.min(index, pageCount - 1))
}

/** The user's marks that sit on one page — what gets exported for that page. */
export function elementsOnPage<T extends PositionedElement>(
  elements: readonly T[],
  pageIndex: number,
  pageCount: number
): T[] {
  return userElements(elements).filter(
    (element) => pageIndexOfElement(element, pageCount) === pageIndex
  )
}

/** Where the canvas is looking, in the units the page boxes use. */
export interface ViewportLike {
  scrollY: number
  height: number
  zoom: number
}

/**
 * The page the user is on: whichever one the middle of the screen is inside.
 *
 * Read from the viewport rather than tracked as state, because the user changes
 * pages by scrolling, not only by pressing the arrows in the page bar. It is
 * also the page a checkpoint captures, so it has to mean "the page being
 * explained", not "the page last clicked".
 */
export function activePageFromViewport(
  viewport: ViewportLike,
  pageCount: number
): number {
  if (pageCount <= 0) return -1
  const zoom = viewport.zoom > 0 ? viewport.zoom : 1
  const middleOfScreen = -viewport.scrollY + viewport.height / 2 / zoom
  const stride = PAGE_HEIGHT + PAGE_GAP
  const index = Math.floor(middleOfScreen / stride)
  return Math.max(0, Math.min(index, pageCount - 1))
}

/** Scroll values that put page `index` in the middle of the screen. */
export function scrollToPage(
  index: number,
  viewport: { height: number; zoom: number }
): { scrollY: number } {
  const zoom = viewport.zoom > 0 ? viewport.zoom : 1
  const box = pageBox(index)
  return { scrollY: -(box.y + box.height / 2) + viewport.height / 2 / zoom }
}

/** How a page is labelled in the page bar: "3" for a PDF page, "3a" for paper. */
export function pageLabel(pages: BoardPage[], index: number): string {
  const page = pages[index]
  if (!page) return ''
  if (page.kind === 'pdf') return String(page.pdfPage)

  // A blank page is named after the PDF page it follows — "4a", "4b" — because
  // that is how a person refers to it ("the sheet after page 4"). Paper before
  // any PDF page counts from the front instead.
  let previousPdf = 0
  let nth = 0
  for (let i = 0; i <= index; i++) {
    const current = pages[i]
    if (current.kind === 'pdf') {
      previousPdf = current.pdfPage
      nth = 0
    } else {
      nth++
    }
  }
  const suffix = String.fromCharCode('a'.charCodeAt(0) + Math.min(nth - 1, 25))
  return previousPdf === 0 ? suffix : `${previousPdf}${suffix}`
}

/** Does this scene stand on a PDF, or is it the plain endless whiteboard? */
export function readBoardBase(snapshot: unknown): BoardBase | undefined {
  const base = (snapshot as { board?: unknown } | undefined)?.board

  if (!base || typeof base !== 'object') return undefined
  const { source, pages } = base as { source?: unknown; pages?: unknown }
  if (source !== 'board' && source !== 'reference') return undefined
  if (!Array.isArray(pages) || pages.length === 0) return undefined

  const cleaned = pages.filter((page): page is BoardPage => {
    if (!page || typeof page !== 'object') return false
    const { id, kind, pdfPage } = page as Partial<BoardPage> & { pdfPage?: unknown }
    if (typeof id !== 'string') return false
    if (kind === 'blank') return true
    return kind === 'pdf' && typeof pdfPage === 'number' && pdfPage >= 1
  })

  return cleaned.length > 0 ? { source, pages: cleaned } : undefined
}
