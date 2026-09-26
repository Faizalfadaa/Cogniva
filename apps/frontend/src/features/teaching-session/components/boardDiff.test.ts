import { describe, expect, it } from 'vitest'

import type { BoardChange } from './whiteboardTypes'
import { appendEvent, boardEvents, changedSince, versionsOf, type ElementLike } from './boardDiff'

const el = (id: string, version: number, extra: Partial<ElementLike> = {}): ElementLike => ({
  id,
  version,
  ...extra,
})

describe('changedSince', () => {
  it('finds what was added and what was edited, and nothing else', () => {
    const taught = versionsOf([el('a', 1), el('b', 4)])
    expect(changedSince(taught, [el('a', 1), el('b', 5), el('c', 1)])).toEqual(['b', 'c'])
  })

  it('ignores what was erased: there is nothing left of it to show', () => {
    const taught = versionsOf([el('a', 1)])
    expect(changedSince(taught, [el('a', 2, { isDeleted: true })])).toEqual([])
  })

  it('keeps a shape and the text inside it together', () => {
    const taught = versionsOf([el('box', 1), el('label', 1, { containerId: 'box' })])
    // Only the label was edited, but the box has to come along or it floats.
    expect(changedSince(taught, [el('box', 1), el('label', 2, { containerId: 'box' })])).toEqual([
      'box',
      'label',
    ])
  })
})

describe('boardEvents', () => {
  it('stamps each change with when the element was edited', () => {
    const { events } = boardEvents(new Map(), [el('a', 1, { updated: 1000 })], 9999)
    expect(events).toEqual([{ at: 1000, shapeIds: ['a'], kind: 'add' }])
  })

  it('tells adds, edits and deletions apart', () => {
    const seen = versionsOf([el('a', 1), el('b', 1)])
    const { events } = boardEvents(
      seen,
      [el('a', 2, { updated: 20 }), el('b', 2, { isDeleted: true, updated: 30 }), el('c', 1, { updated: 10 })],
      99
    )
    expect(events).toEqual([
      { at: 10, shapeIds: ['c'], kind: 'add' },
      { at: 20, shapeIds: ['a'], kind: 'update' },
      { at: 30, shapeIds: ['b'], kind: 'delete' },
    ])
  })

  it('records nothing for a board that did not change', () => {
    const elements = [el('a', 3), el('b', 1)]
    expect(boardEvents(versionsOf(elements), elements, 0).events).toEqual([])
  })
})

describe('appendEvent', () => {
  it('folds the points of one pen stroke into the moment it began', () => {
    const timeline: BoardChange[] = []
    appendEvent(timeline, { at: 100, shapeIds: ['stroke'], kind: 'add' })
    for (let t = 116; t < 600; t += 16) appendEvent(timeline, { at: t, shapeIds: ['stroke'], kind: 'update' })
    expect(timeline).toEqual([{ at: 100, shapeIds: ['stroke'], kind: 'add' }])
  })

  it('keeps separate strokes separate', () => {
    const timeline: BoardChange[] = []
    appendEvent(timeline, { at: 100, shapeIds: ['one'], kind: 'add' })
    appendEvent(timeline, { at: 900, shapeIds: ['two'], kind: 'add' })
    appendEvent(timeline, { at: 950, shapeIds: ['one'], kind: 'update' })
    expect(timeline.map((e) => e.shapeIds[0])).toEqual(['one', 'two', 'one'])
  })
})

describe('what each change was', () => {
  it('says what kind of element it was, and the words when it is text', () => {
    const { events } = boardEvents(
      new Map(),
      [el('t', 1, { type: 'text', text: '  Calvin cycle ', updated: 5 }), el('a', 1, { type: 'arrow', updated: 9 })],
      0
    )
    expect(events).toEqual([
      { at: 5, shapeIds: ['t'], kind: 'add', shape: 'text', text: 'Calvin cycle' },
      { at: 9, shapeIds: ['a'], kind: 'add', shape: 'arrow' },
    ])
  })

  it('keeps the moment typing began, with the words as they ended up', () => {
    // Text is created empty and filled in one keystroke at a time.
    const timeline: BoardChange[] = []
    appendEvent(timeline, { at: 100, shapeIds: ['t'], kind: 'add', shape: 'text' })
    appendEvent(timeline, { at: 300, shapeIds: ['t'], kind: 'update', shape: 'text', text: 'Cal' })
    appendEvent(timeline, { at: 600, shapeIds: ['t'], kind: 'update', shape: 'text', text: 'Calvin' })
    expect(timeline).toEqual([{ at: 100, shapeIds: ['t'], kind: 'add', shape: 'text', text: 'Calvin' }])
  })
})
