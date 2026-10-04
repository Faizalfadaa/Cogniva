/**
 * Turning a PDF into pictures the board can stand on.
 *
 * pdf.js is loaded on demand, not at startup: it is about a megabyte, and most
 * sessions are a plain whiteboard that never needs it. The pages it renders are
 * kept in memory only — they are re-rendered each time the board opens rather
 * than saved, because the alternative is shipping re-encoded page images to the
 * server on every autosave (see boardPages.ts).
 */

import { MAX_PDF_PAGES, PAGE_HEIGHT, PAGE_WIDTH } from './boardPages'

/**
 * Pixels across for a rendered page. Wider than the page's canvas box so the
 * writing on it stays legible when zoomed in — and because this picture is what
 * Vision reads when the checkpoint is taken, so small print has to survive.
 */
const RENDER_WIDTH = 1600

type PdfjsModule = typeof import('pdfjs-dist')

/** The parsed file, as pdf.js hands it back. */
type PdfDocument = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>

let pdfjs: Promise<PdfjsModule> | null = null

function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjs) {
    pdfjs = import('pdfjs-dist').then((module) => {
      // Vite resolves this to a hashed asset URL at build time; the worker runs
      // the parsing off the main thread, which is what keeps drawing smooth
      // while pages render.
      module.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()
      return module
    })
  }
  return pdfjs
}

export interface RenderedPdf {
  /** How many pages the file has, before the board's own cap is applied. */
  pageCount: number
  /** PNG data URLs, one per rendered page, in page order. */
  pages: string[]
}

/**
 * Fetch a PDF and render its first pages to pictures.
 *
 * Failures here are not exceptional — a file may be corrupt, or the request may
 * fail — so the caller gets a rejected promise with a plain message and shows
 * the board without a base rather than an empty screen.
 */
export async function renderPdfPages(url: string): Promise<RenderedPdf> {
  const module = await loadPdfjs()
  const document = await module.getDocument({ url, isEvalSupported: false }).promise

  try {
    const count = Math.min(document.numPages, MAX_PDF_PAGES)
    const pages: string[] = []

    for (let number = 1; number <= count; number++) {
      pages.push(await renderOne(document, number))
    }

    return { pageCount: document.numPages, pages }
  } finally {
    // The worker holds the parsed file; without this a few PDFs in one sitting
    // keep their buffers alive for as long as the tab is open.
    void document.destroy()
  }
}

async function renderOne(document: PdfDocument, pageNumber: number): Promise<string> {
  const page = await document.getPage(pageNumber)
  const unscaled = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: RENDER_WIDTH / unscaled.width })

  const canvas = window.document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas unavailable')

  // Pages are drawn onto white: a PDF page has no background of its own, and on
  // the board's parchment an unpainted page would show through as a grey sheet.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  await page.render({ canvasContext: context, viewport }).promise
  page.cleanup()

  return canvas.toDataURL('image/png')
}

/**
 * A page picture fitted inside the board's page box, centred.
 *
 * Every page box is the same shape (boardPages.ts), so a PDF whose pages are a
 * different one — a landscape slide deck, say — is fitted rather than stretched.
 * Within one document every page is the same shape, so this normally does
 * nothing at all; it exists so the odd document does not come out distorted.
 */
export function fitIntoPage(
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number } {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT }
  }

  const scale = Math.min(PAGE_WIDTH / imageWidth, PAGE_HEIGHT / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale

  return {
    x: (PAGE_WIDTH - width) / 2,
    y: (PAGE_HEIGHT - height) / 2,
    width,
    height,
  }
}

/** Read a data URL's pixel size, so the page can be fitted before it is placed. */
export function measureImage(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    // A picture that will not load is placed at the full page box; it renders as
    // a blank page rather than breaking the layout of everything below it.
    image.onerror = () => resolve({ width: 0, height: 0 })
    image.src = dataUrl
  })
}
