import { describe, expect, it } from 'vitest'
import {
  activePageFromViewport,
  elementsOnPage,
  insertBlankAfter,
  isPageElement,
  MAX_PDF_PAGES,
  PAGE_GAP,
  PAGE_HEIGHT,
  PAGE_ID_PREFIX,
  pageBox,
  pageIndexOfElement,
  pageLabel,
  pagesFromPdf,
  readBoardBase,
  removePage,
  scrollToPage,
  shiftElementsBelow,
  stackHeight,
  userElements,
  type BoardPage,
} from './boardPages'

const stride = PAGE_HEIGHT + PAGE_GAP

function mark(id: string, y: number, height = 40) {
  return { id, x: 100, y, width: 200, height }
}

describe('page layout', () => {
  it('stacks pages top to bottom with a gap between them', () => {
    expect(pageBox(0).y).toBe(0)
    expect(pageBox(1).y).toBe(stride)
    expect(pageBox(3).y).toBe(3 * stride)
    // The stack has gaps between pages, not after the last one.
    expect(stackHeight(3)).toBe(3 * PAGE_HEIGHT + 2 * PAGE_GAP)
    expect(stackHeight(0)).toBe(0)
  })

  it('makes one board page per PDF page, up to the cap', () => {
    expect(pagesFromPdf(3)).toEqual([
      { id: 'p1', kind: 'pdf', pdfPage: 1 },
      { id: 'p2', kind: 'pdf', pdfPage: 2 },
      { id: 'p3', kind: 'pdf', pdfPage: 3 },
    ])
    expect(pagesFromPdf(500)).toHaveLength(MAX_PDF_PAGES)
    expect(pagesFromPdf(0)).toEqual([])
  })
})

describe('inserting blank paper between pages', () => {
  it('slips paper in after the given page', () => {
    const pages = pagesFromPdf(3)
    const { pages: next } = insertBlankAfter(pages, 1)

    expect(next.map((p) => p.kind)).toEqual(['pdf', 'pdf', 'blank', 'pdf'])
    // PDF pages keep their own numbering; the paper is a page of its own.
    expect(next[3]).toEqual({ id: 'p3', kind: 'pdf', pdfPage: 3 })
    // Ids stay unique, which is what keeps the rendered pictures stable.
    expect(new Set(next.map((p) => p.id)).size).toBe(next.length)
  })

  it('can add paper before the first page and after the last', () => {
    const pages = pagesFromPdf(2)
    expect(insertBlankAfter(pages, -1).pages[0].kind).toBe('blank')
    expect(insertBlankAfter(pages, 99).pages[2].kind).toBe('blank')
  })

  it('says how far the pages below move, so marks keep their page', () => {
    const pages = pagesFromPdf(3)
    const { shiftFrom, shiftBy } = insertBlankAfter(pages, 0)

    // Everything from the second page's top down moves one page further down.
    expect(shiftFrom).toBe(pageBox(1).y)
    expect(shiftBy).toBe(stride)

    // A mark on page 3 is still on page 3 (now the fourth box) afterwards.
    const onThirdPage = mark('a', pageBox(2).y + 100)
    const moved = shiftElementsBelow([onThirdPage], shiftFrom, shiftBy)
    expect(pageIndexOfElement(moved[0], 4)).toBe(3)
    expect(pages[2].id).toBe(insertBlankAfter(pages, 0).pages[3].id)

    // A mark on the first page does not move.
    const onFirstPage = mark('b', 200)
    expect(shiftElementsBelow([onFirstPage], shiftFrom, shiftBy)[0].y).toBe(200)
  })

  it('takes paper back out, but never a PDF page', () => {
    const pages = insertBlankAfter(pagesFromPdf(2), 0).pages

    const removed = removePage(pages, 1)
    expect(removed?.pages.map((p) => p.kind)).toEqual(['pdf', 'pdf'])
    expect(removed?.shiftBy).toBe(-stride)

    expect(removePage(pages, 0)).toBeNull()
    expect(removePage(pages, 99)).toBeNull()
  })
})

describe('telling pages and marks apart', () => {
  it('recognizes the locked page elements by their id', () => {
    expect(isPageElement({ id: `${PAGE_ID_PREFIX}p1` })).toBe(true)
    expect(isPageElement({ id: 'abc123' })).toBe(false)
    expect(isPageElement({})).toBe(false)

    const scene = [{ id: `${PAGE_ID_PREFIX}p1` }, { id: 'stroke' }]
    expect(userElements(scene)).toEqual([{ id: 'stroke' }])
  })

  it('assigns a mark to the page its middle sits on', () => {
    expect(pageIndexOfElement(mark('a', 10), 3)).toBe(0)
    expect(pageIndexOfElement(mark('b', pageBox(1).y + 50), 3)).toBe(1)
    // In the gap above page 2: its middle is still nearest that page.
    expect(pageIndexOfElement(mark('c', pageBox(1).y - 20), 3)).toBe(1)
    // Past the last page it clamps, rather than dropping out of every export.
    expect(pageIndexOfElement(mark('d', pageBox(9).y), 3)).toBe(2)
  })

  it('collects only the marks on one page, never the page itself', () => {
    const scene = [
      { id: `${PAGE_ID_PREFIX}p1`, x: 0, y: 0, width: 10, height: 10 },
      mark('first', 100),
      mark('second', pageBox(1).y + 100),
    ]

    expect(elementsOnPage(scene, 0, 2).map((e) => e.id)).toEqual(['first'])
    expect(elementsOnPage(scene, 1, 2).map((e) => e.id)).toEqual(['second'])
  })
})

describe('which page the user is on', () => {
  it('follows the middle of the screen, because pages change by scrolling', () => {
    const viewport = (scrollY: number) => ({ scrollY, height: 800, zoom: 1 })

    expect(activePageFromViewport(viewport(0), 3)).toBe(0)
    expect(activePageFromViewport(viewport(-stride), 3)).toBe(1)
    // Clamped at both ends: scrolled above the first page and past the last.
    expect(activePageFromViewport(viewport(500), 3)).toBe(0)
    expect(activePageFromViewport(viewport(-99 * stride), 3)).toBe(2)
    expect(activePageFromViewport(viewport(0), 0)).toBe(-1)
  })

  it('round-trips: scrolling to a page reports that page as active', () => {
    const view = { height: 800, zoom: 1 }
    for (const index of [0, 1, 4]) {
      const { scrollY } = scrollToPage(index, view)
      expect(activePageFromViewport({ ...view, scrollY }, 5)).toBe(index)
    }
  })

  it('survives a zero zoom rather than dividing by it', () => {
    expect(activePageFromViewport({ scrollY: 0, height: 800, zoom: 0 }, 2)).toBe(0)
    expect(Number.isFinite(scrollToPage(1, { height: 800, zoom: 0 }).scrollY)).toBe(true)
  })
})

describe('page labels', () => {
  it('names paper after the page it follows', () => {
    const pages: BoardPage[] = [
      { id: 'p1', kind: 'pdf', pdfPage: 1 },
      { id: 'p2', kind: 'pdf', pdfPage: 2 },
      { id: 'p3', kind: 'blank' },
      { id: 'p4', kind: 'blank' },
      { id: 'p5', kind: 'pdf', pdfPage: 3 },
    ]

    expect(pageLabel(pages, 1)).toBe('2')
    expect(pageLabel(pages, 2)).toBe('2a')
    expect(pageLabel(pages, 3)).toBe('2b')
    expect(pageLabel(pages, 4)).toBe('3')
    expect(pageLabel(pages, 99)).toBe('')
  })

  it('counts paper from the front when it comes before any PDF page', () => {
    const pages: BoardPage[] = [
      { id: 'p1', kind: 'blank' },
      { id: 'p2', kind: 'pdf', pdfPage: 1 },
    ]
    expect(pageLabel(pages, 0)).toBe('a')
  })
})

describe('reading a saved board', () => {
  it('reads back the base a scene was saved with', () => {
    const base = { source: 'reference', pages: [{ id: 'p1', kind: 'pdf', pdfPage: 1 }] }
    expect(readBoardBase({ elements: [], board: base })).toEqual(base)
  })

  it('treats anything unrecognizable as a plain whiteboard', () => {
    expect(readBoardBase(undefined)).toBeUndefined()
    expect(readBoardBase({ elements: [] })).toBeUndefined()
    expect(readBoardBase({ board: { source: 'elsewhere', pages: [] } })).toBeUndefined()
    expect(readBoardBase({ board: { source: 'board', pages: [] } })).toBeUndefined()
    // A page list that survives partially keeps the pages that make sense.
    expect(
      readBoardBase({
        board: { source: 'board', pages: [{ id: 'p1', kind: 'pdf' }, { id: 'p2', kind: 'blank' }] },
      })
    ).toEqual({ source: 'board', pages: [{ id: 'p2', kind: 'blank' }] })
  })
})
