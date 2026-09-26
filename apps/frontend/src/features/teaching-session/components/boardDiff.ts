import type { BoardChange } from './whiteboardTypes'

/**
 * Which parts of the board changed, worked out from the board itself.
 *
 * Every Excalidraw element carries an id, a version that goes up on each edit,
 * and the wall-clock time of its last edit. That is enough to say exactly what
 * is new since the last Teach, and when each thing was drawn, without asking a
 * model to spot the difference between two pictures.
 */

/** The parts of an Excalidraw element this module reads. */
export interface ElementLike {
  id: string
  version: number
  /** Epoch ms of the element's last edit. */
  updated?: number
  isDeleted?: boolean
  /** Set on text bound inside a shape: the shape it lives in. */
  containerId?: string | null
  /** Excalidraw's element type: "text", "arrow", "freedraw"... */
  type?: string
  /** The words, on a text element. */
  text?: string
}

/** id -> version, for the elements still on the board. */
export type BoardVersions = Map<string, number>

export function versionsOf(elements: readonly ElementLike[] | undefined): BoardVersions {
  const versions: BoardVersions = new Map()
  for (const element of elements ?? []) {
    if (!element.isDeleted) versions.set(element.id, element.version)
  }
  return versions
}

/**
 * Elements added or edited since `baseline`, as ids to export.
 *
 * Text written inside a shape is a separate element bound to it, and exporting
 * one without the other cuts the drawing in half: a new box would arrive empty,
 * or a new label would float with no box around it. So a changed shape brings
 * its text along, and changed text brings its shape.
 */
export function changedSince(
  baseline: BoardVersions,
  elements: readonly ElementLike[] | undefined
): string[] {
  const live = (elements ?? []).filter((e) => !e.isDeleted)
  const changed = new Set(
    live.filter((e) => baseline.get(e.id) !== e.version).map((e) => e.id)
  )
  for (const e of live) {
    if (e.containerId && changed.has(e.containerId)) changed.add(e.id)
    if (e.containerId && changed.has(e.id)) changed.add(e.containerId)
  }
  return live.filter((e) => changed.has(e.id)).map((e) => e.id)
}

/**
 * The board changes between two looks at the scene, one per element, each
 * stamped with when the element was last edited and saying what it is.
 *
 * One per element rather than one per batch, because what was drawn is the
 * point: a text element's words, or the kind of mark, is what lets a change be
 * described next to the sentence spoken while it was made.
 *
 * Excalidraw reports the scene on every pointer move, so a single pen stroke
 * arrives as an add followed by dozens of updates to the same element. Those
 * are folded into the event that started the stroke (see `appendEvent`); the
 * moment that matters for lining the board up with the voice is when a mark
 * was begun, not each of the points along it.
 */
export function boardEvents(
  seen: BoardVersions,
  elements: readonly ElementLike[],
  now: number
): { events: BoardChange[]; seen: BoardVersions } {
  const next: BoardVersions = new Map()
  const byKind: Record<BoardChange['kind'], ElementLike[]> = { add: [], update: [], delete: [] }

  for (const element of elements) {
    if (element.isDeleted) {
      if (seen.has(element.id)) byKind.delete.push(element)
      continue
    }
    next.set(element.id, element.version)
    const before = seen.get(element.id)
    if (before === undefined) byKind.add.push(element)
    else if (before !== element.version) byKind.update.push(element)
  }
  // Gone without a tombstone (removed from the scene outright).
  for (const id of seen.keys()) {
    if (!next.has(id) && !byKind.delete.some((e) => e.id === id)) {
      byKind.delete.push({ id, version: 0 })
    }
  }

  const events: BoardChange[] = []
  for (const kind of ['add', 'update', 'delete'] as const) {
    for (const element of byKind[kind]) {
      const event: BoardChange = { at: element.updated ?? now, shapeIds: [element.id], kind }
      if (element.type) event.shape = element.type
      const words = element.text?.trim()
      if (words) event.text = words
      events.push(event)
    }
  }
  events.sort((a, b) => a.at - b.at)
  return { events, seen: next }
}

/**
 * Add `event` to `timeline`, folding it into the previous one when it is the
 * same stroke still being drawn: an update to exactly the shapes the last event
 * added or updated.
 */
export function appendEvent(timeline: BoardChange[], event: BoardChange): void {
  const last = timeline[timeline.length - 1]
  const sameShapes =
    last !== undefined &&
    last.shapeIds.length === event.shapeIds.length &&
    last.shapeIds.every((id, i) => id === event.shapeIds[i])
  if (sameShapes && event.kind === 'update' && (last.kind === 'add' || last.kind === 'update')) {
    // Same stroke, or the same text being typed: keep when it began, but take
    // the words as they stand now. Text is created empty and filled in letter
    // by letter, so the first event alone would say nothing was written.
    if (event.text !== undefined) last.text = event.text
    return
  }
  timeline.push(event)
}
