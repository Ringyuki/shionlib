import type { Cover } from '@/services/catalog'

export type ShownCover = { src: string; dims: number[]; masked: boolean }

export function showable(cover: Cover): boolean {
  return cover.masked || (cover.sexual === 0 && cover.violence === 0)
}

export function coverOf(covers: Cover[]): ShownCover | undefined {
  const candidates = covers.filter(showable)
  const chosen = candidates.find(cover => cover.type === 'pkgfront') ?? candidates[0]
  return chosen && { src: chosen.url, dims: chosen.dims, masked: chosen.masked }
}
