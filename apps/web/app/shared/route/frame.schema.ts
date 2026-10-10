import * as v from 'valibot'

const canvas = v.object({ frame: v.literal('canvas') })

export function asksForCanvas(handle: unknown): boolean {
  return v.is(canvas, handle)
}
