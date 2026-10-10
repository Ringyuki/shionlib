import { pictureWidths } from '~/shared/richtext/rich-text.schema'

export const leastPercent = pictureWidths.least

export const fullPercent = pictureWidths.whole

export const snapPoints: readonly number[] = [25, 33, 50, 66, 75, fullPercent]

export type PictureSize = 'small' | 'medium' | 'large'

export const pictureSizes: readonly { id: PictureSize; percent: number }[] = [
  { id: 'small', percent: 33 },
  { id: 'medium', percent: 66 },
  { id: 'large', percent: fullPercent },
]

const snapTolerance = 3

export function widestPercent(naturalWidth: number, columnWidth: number): number {
  if (naturalWidth <= 0 || columnWidth <= 0 || naturalWidth >= columnWidth) {
    return fullPercent
  }
  return Math.max(leastPercent, Math.floor((naturalWidth / columnWidth) * 100))
}

export function initialPercent(naturalWidth: number, columnWidth: number): number {
  if (naturalWidth <= 0 || columnWidth <= 0 || naturalWidth >= columnWidth) {
    return fullPercent
  }
  const share = (naturalWidth / columnWidth) * 100
  return snapPoints.find(point => share <= point) ?? fullPercent
}

export function snappedPercent(percent: number, widest: number): number {
  const bounded = Math.min(widest, Math.max(leastPercent, percent))
  const near = snapPoints.find(
    point => point <= widest && Math.abs(bounded - point) < snapTolerance,
  )
  return near ?? Math.round(bounded)
}

export function resizedPercent(
  startPercent: number,
  pointerShift: number,
  columnWidth: number,
  widest: number,
): number {
  if (columnWidth <= 0) {
    return startPercent
  }
  return snappedPercent(startPercent + ((pointerShift * 2) / columnWidth) * 100, widest)
}

export function shownWidth(percent: number, naturalWidth: number): string {
  return naturalWidth > 0 ? `min(${percent}%, ${naturalWidth}px)` : `${percent}%`
}
