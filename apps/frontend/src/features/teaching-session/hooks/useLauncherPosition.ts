import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

/**
 * Where the chat button sits, which the user can now drag anywhere over the
 * canvas.
 *
 * Measured from the canvas's bottom-right corner, not its top-left, because
 * that is where the button starts and what the canvas keeps: when the chat
 * panel opens the canvas narrows from the right, and a button measured from
 * the left would slide under the panel.
 *
 * It starts in the bottom-right corner every time the workspace opens, and a
 * drag lasts only while the page is open. A remembered spot meant a button
 * dragged out of the way once turned up in the middle of the board on every
 * later visit, far from where anyone expects a chat button to be.
 */

/** Distance from the canvas's right and bottom edges, in pixels. */
export interface LauncherOffset {
  right: number
  bottom: number
}

export interface AreaSize {
  width: number
  height: number
}

/** Matches .chatLauncher's width and height. */
export const LAUNCHER_SIZE = 56

/** Where the button starts, and where it went before it could be moved. */
export const DEFAULT_OFFSET: LauncherOffset = { right: 24, bottom: 24 }

/** Space kept between the button and the canvas edge, so it never half-leaves. */
const EDGE = 8

/** Gap between the button and the toasts that come out of it. */
const TOAST_GAP = 10

/**
 * Where an earlier build remembered the position. Cleared on sight, so a spot
 * saved by that build does not linger in the browser unused.
 */
const RETIRED_STORAGE_KEY = 'cogniva:chat-launcher-offset'

/** Keep the whole button inside the canvas. */
export function clampOffset(offset: LauncherOffset, area: AreaSize): LauncherOffset {
  const clamp = (value: number, max: number) => Math.min(Math.max(value, EDGE), Math.max(EDGE, max))
  return {
    right: clamp(offset.right, area.width - LAUNCHER_SIZE - EDGE),
    bottom: clamp(offset.bottom, area.height - LAUNCHER_SIZE - EDGE),
  }
}

/**
 * Where the chat toasts go, so they come out of the button wherever it is.
 *
 * They open toward the middle of the canvas: above the button when it is in
 * the lower half and below it in the upper half, and lined up with its right
 * edge on the right side and its left edge on the left. From the default corner
 * that is exactly where they always were.
 */
export function toastPlacement(offset: LauncherOffset, area: AreaSize | null): {
  style: CSSProperties
  alignStart: boolean
} {
  if (!area) {
    return {
      style: { right: offset.right, bottom: offset.bottom + LAUNCHER_SIZE + TOAST_GAP },
      alignStart: false,
    }
  }
  const onRight = offset.right + LAUNCHER_SIZE / 2 < area.width / 2
  const onBottom = offset.bottom + LAUNCHER_SIZE / 2 < area.height / 2

  const horizontal: CSSProperties = onRight
    ? { right: offset.right, left: 'auto' }
    : { left: area.width - offset.right - LAUNCHER_SIZE, right: 'auto' }
  const vertical: CSSProperties = onBottom
    ? { bottom: offset.bottom + LAUNCHER_SIZE + TOAST_GAP, top: 'auto' }
    : { top: area.height - offset.bottom + TOAST_GAP, bottom: 'auto' }

  return { style: { ...horizontal, ...vertical }, alignStart: !onRight }
}

function forgetRetiredPosition(): void {
  try {
    localStorage.removeItem(RETIRED_STORAGE_KEY)
  } catch {
    // Storage unavailable: there is nothing saved to clear either.
  }
}

export function useLauncherPosition() {
  const [offset, setOffset] = useState<LauncherOffset>(DEFAULT_OFFSET)
  const [area, setArea] = useState<AreaSize | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  /** Attach to the canvas; its size is what the button is kept inside. */
  const areaRef = useCallback((element: HTMLElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!element) return
    const measure = () => setArea({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    observerRef.current = observer
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])
  useEffect(forgetRetiredPosition, [])

  // A canvas the chat panel just narrowed, or a smaller window, can leave the
  // button outside; it is shown clamped, and the dragged value is kept so it
  // goes back once there is room again.
  const shown = area ? clampOffset(offset, area) : offset

  const move = useCallback(
    (next: LauncherOffset) => {
      // Whole pixels: pointer coordinates are fractional on scaled displays.
      const rounded = { right: Math.round(next.right), bottom: Math.round(next.bottom) }
      setOffset(area ? clampOffset(rounded, area) : rounded)
    },
    [area]
  )

  return { offset: shown, area, areaRef, move }
}
