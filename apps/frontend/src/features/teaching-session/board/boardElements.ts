/**
 * The pages as Excalidraw sees them: locked pictures and locked sheets of paper.
 *
 * Kept apart from boardPages.ts so the layout arithmetic stays testable without
 * pulling the editor in. This file is the one place that knows how a page turns
 * into a scene element.
 */

import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import { PAGE_ID_PREFIX, pageBox, type BoardPage } from './boardPages'
import { fitIntoPage } from './pdfPages'

/** A rendered PDF page, with the pixel size the fit is computed from. */
export interface PageImage {
  dataUrl: string
  width: number
  height: number
}

/** Paper is drawn as a plain white sheet with a hairline edge. */
const PAPER_FILL = '#ffffff'
const PAPER_EDGE = '#d9d2c0'

export function pageElementId(page: BoardPage): string {
  return `${PAGE_ID_PREFIX}${page.id}`
}

export function pageFileId(page: BoardPage): string {
  return `${PAGE_ID_PREFIX}file-${page.id}`
}

type SceneElement = Record<string, unknown> & { id: string }

/**
 * Build the locked elements for a stack of pages.
 *
 * A PDF page becomes an image element; a blank page becomes a white rectangle.
 * Both are locked, so the user writes over a page instead of dragging it around
 * by accident, and both carry an id with the page prefix, which is how they are
 * recognized and stripped back out before saving.
 *
 * A PDF page whose picture has not been rendered yet is drawn as paper, so the
 * stack keeps its shape while the rest of the file is still rendering.
 */
export function buildPageElements(
  pages: BoardPage[],
  images: ReadonlyMap<string, PageImage>
): { elements: SceneElement[]; files: Record<string, unknown> } {
  const skeletons: Record<string, unknown>[] = []
  const ids: string[] = []
  const files: Record<string, unknown> = {}

  pages.forEach((page, index) => {
    const box = pageBox(index)
    const image = page.kind === 'pdf' ? images.get(page.id) : undefined

    if (image) {
      const fitted = fitIntoPage(image.width, image.height)
      const fileId = pageFileId(page)

      files[fileId] = {
        id: fileId,
        dataURL: image.dataUrl,
        mimeType: 'image/png',
        created: Date.now(),
      }

      skeletons.push({
        type: 'image',
        fileId,
        x: box.x + fitted.x,
        y: box.y + fitted.y,
        width: fitted.width,
        height: fitted.height,
      })
    } else {
      skeletons.push({
        type: 'rectangle',
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        backgroundColor: PAPER_FILL,
        fillStyle: 'solid',
        strokeColor: PAPER_EDGE,
        strokeWidth: 1,
        roughness: 0,
        roundness: null,
      })
    }

    ids.push(pageElementId(page))
  })

  // convertToExcalidrawElements fills in everything a real element needs (seeds,
  // versions, bindings). The id and the lock are forced on afterwards rather
  // than passed in, so this does not depend on which skeleton fields the current
  // Excalidraw version happens to honour.
  const converted = convertToExcalidrawElements(
    skeletons as Parameters<typeof convertToExcalidrawElements>[0]
  ) as unknown as SceneElement[]

  const elements = converted.map((element, index) => ({
    ...element,
    id: ids[index],
    locked: true,
  }))

  return { elements, files }
}
