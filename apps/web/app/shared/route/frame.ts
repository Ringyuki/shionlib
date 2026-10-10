import { useMatches } from 'react-router'
import { asksForCanvas } from './frame.schema'

export type Frame = 'page' | 'canvas'

export const canvasFrame = { frame: 'canvas' } as const

export function useFrame(): Frame {
  return useMatches().some(match => asksForCanvas(match.handle)) ? 'canvas' : 'page'
}
