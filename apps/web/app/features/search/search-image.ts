import type { ApiData } from '~/shared/api/types'

export type ImageFindings = ApiData<'/search/image', 'post'>

export type ImageSource = ApiData<'/search/image/source', 'get'>

export type Sighting = NonNullable<ImageFindings['characters']>[number]

export type Box = Sighting['box']

export type Frame = { x: number; y: number; width: number; height: number }

export type Size = { width: number; height: number }

export type Shot = { src: string; ratio: number }

export type ImageSearch =
  | { phase: 'off' }
  | { phase: 'choosing' }
  | { phase: 'reading'; shot: Shot }
  | { phase: 'done'; shot: Shot; findings: ImageFindings; crops: readonly string[] }

export const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export const cropRatio = 3 / 4

export const cropMargin = 1.2

export const cropHeight = 96

export const fallbackRatio = 4 / 3

export const shotHeightRem = 3

export function shotWidthRem(ratio: number): number {
  return Math.min(Math.max(ratio, 1 / 2), 5 / 2) * shotHeightRem
}

export function cropFrame(box: Box, size: Size): Frame {
  const left = box.left * size.width
  const right = box.right * size.width
  const top = box.top * size.height
  const bottom = box.bottom * size.height
  const height = Math.min(
    Math.max(bottom - top, (right - left) / cropRatio) * cropMargin,
    size.height,
    size.width / cropRatio,
  )
  const width = height * cropRatio
  const x = Math.min(Math.max((left + right) / 2 - width / 2, 0), size.width - width)
  const y = Math.min(Math.max((top + bottom) / 2 - height / 2, 0), size.height - height)
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  }
}

export function isImageType(type: string): boolean {
  return imageTypes.some(accepted => accepted === type)
}

type PastedItem = { kind: string; type: string; getAsFile: () => File | null }

export function pastedImage(items: Iterable<PastedItem>): File | undefined {
  for (const item of items) {
    const file = item.kind === 'file' && isImageType(item.type) ? item.getAsFile() : null
    if (file !== null) {
      return file
    }
  }
  return undefined
}

export function gameOf<Game extends { id: number }>(
  games: readonly Game[] | null,
  gameId: number | null,
): Game | undefined {
  return (games ?? []).find(game => game.id === gameId)
}

export type Listed = { sighting: Sighting; index: number }

export function listedSightings(sightings: readonly Sighting[] | null): Listed[] {
  const seen = new Set<string>()
  return (sightings ?? []).flatMap((sighting, index) => {
    const key =
      sighting.character === null
        ? `name:${sighting.name}\u0000${sighting.work}`
        : `character:${sighting.character.id}`
    if (seen.has(key)) {
      return []
    }
    seen.add(key)
    return [{ sighting, index }]
  })
}

export function urlsOf(search: ImageSearch): string[] {
  if (search.phase === 'reading') {
    return [search.shot.src]
  }
  if (search.phase === 'done') {
    return [search.shot.src, ...search.crops.filter(url => url !== '')]
  }
  return []
}
