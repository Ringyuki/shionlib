import type { ImageResolver } from '@hina-ui/react'

const passThrough = /^(https?:|data:|blob:|\/)/

export function imageResolver(base: string): ImageResolver {
  return src => (src === '' || passThrough.test(src) ? src : `${base}/${src}`)
}
