import { forwardRef } from 'react'
import type { WhiteboardHandle, WhiteboardProps } from './whiteboardTypes'
import ExcalidrawWhiteboard from './ExcalidrawWhiteboard'

export type { WhiteboardHandle } from './whiteboardTypes'

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function Whiteboard(props, ref) {
  return <ExcalidrawWhiteboard ref={ref} {...props} />
})
