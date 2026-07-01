import { forwardRef, lazy, Suspense } from 'react'
import type { WhiteboardHandle, WhiteboardProps } from './whiteboardTypes'

export type { WhiteboardHandle } from './whiteboardTypes'

// Which whiteboard engine to bundle/render, chosen at BUILD time:
//   - tldraw     → local development on localhost (tldraw's free dev mode)
//   - excalidraw → production on a real HTTPS domain, where tldraw would demand a
//                  paid license and blank the canvas. Excalidraw is MIT with no
//                  license/domain enforcement, so it's the safe production choice.
// Set VITE_WHITEBOARD=excalidraw for the production build (see Dockerfile). Unset
// defaults to tldraw, so `npm run dev` on localhost keeps tldraw automatically.
const ENGINE = (import.meta.env.VITE_WHITEBOARD as string | undefined) ?? 'tldraw'

// Lazy so only the selected engine's chunk is ever fetched — the production
// bundle never runs tldraw's license code, and dev never loads Excalidraw.
const TldrawWhiteboard = lazy(() => import('./TldrawWhiteboard'))
const ExcalidrawWhiteboard = lazy(() => import('./ExcalidrawWhiteboard'))

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function Whiteboard(props, ref) {
  const Engine = ENGINE === 'excalidraw' ? ExcalidrawWhiteboard : TldrawWhiteboard
  return (
    <Suspense fallback={null}>
      <Engine ref={ref} {...props} />
    </Suspense>
  )
})
