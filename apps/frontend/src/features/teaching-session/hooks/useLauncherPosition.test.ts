import { describe, expect, it } from 'vitest'

import { clampOffset, DEFAULT_OFFSET, LAUNCHER_SIZE, toastPlacement } from './useLauncherPosition'

const area = { width: 1000, height: 600 }

describe('clampOffset', () => {
  it('leaves a position inside the canvas alone', () => {
    expect(clampOffset({ right: 300, bottom: 200 }, area)).toEqual({ right: 300, bottom: 200 })
  })

  it('keeps the whole button inside, however far it is dragged', () => {
    expect(clampOffset({ right: -500, bottom: 5000 }, area)).toEqual({
      right: 8,
      bottom: area.height - LAUNCHER_SIZE - 8,
    })
  })

  it('pulls a spot saved on a wider screen back into a narrower one', () => {
    // Saved near the left edge of a 1600px canvas, shown on a 900px one.
    expect(clampOffset({ right: 1500, bottom: 24 }, { width: 900, height: 600 }).right).toBe(
      900 - LAUNCHER_SIZE - 8
    )
  })
})

describe('toastPlacement', () => {
  it('puts toasts where they always were when the button has not moved', () => {
    expect(toastPlacement(DEFAULT_OFFSET, area)).toEqual({
      style: { right: 24, left: 'auto', bottom: 24 + LAUNCHER_SIZE + 10, top: 'auto' },
      alignStart: false,
    })
  })

  it('opens them downward and left-aligned when the button is top-left', () => {
    const offset = { right: area.width - 40 - LAUNCHER_SIZE, bottom: area.height - 30 - LAUNCHER_SIZE }
    expect(toastPlacement(offset, area)).toEqual({
      style: { left: 40, right: 'auto', top: 30 + LAUNCHER_SIZE + 10, bottom: 'auto' },
      alignStart: true,
    })
  })

  it('stays usable before the canvas has been measured', () => {
    expect(toastPlacement(DEFAULT_OFFSET, null).style).toEqual({
      right: 24,
      bottom: 24 + LAUNCHER_SIZE + 10,
    })
  })
})
