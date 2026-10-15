import {
  cropFrame,
  cropHeight,
  cropRatio,
  fallbackRatio,
  type Box,
  type Frame,
  type Shot,
} from './search-image'

export async function shotOf(file: Blob): Promise<Shot> {
  const url = URL.createObjectURL(file)
  try {
    const bitmap = await createImageBitmap(file)
    const ratio = bitmap.width / bitmap.height
    bitmap.close()
    return { src: url, ratio }
  } catch {
    return { src: url, ratio: fallbackRatio }
  }
}

export async function cropsOf(file: Blob, boxes: readonly Box[]): Promise<string[]> {
  if (boxes.length === 0) {
    return []
  }
  try {
    const bitmap = await createImageBitmap(file)
    try {
      const size = { width: bitmap.width, height: bitmap.height }
      return await Promise.all(boxes.map(box => crop(bitmap, cropFrame(box, size))))
    } finally {
      bitmap.close()
    }
  } catch {
    return boxes.map(() => '')
  }
}

async function crop(bitmap: ImageBitmap, frame: Frame): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.height = cropHeight
  canvas.width = Math.round(cropHeight * cropRatio)
  const context = canvas.getContext('2d')
  if (context === null) {
    return ''
  }
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    bitmap,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.9))
  return blob === null ? '' : URL.createObjectURL(blob)
}
