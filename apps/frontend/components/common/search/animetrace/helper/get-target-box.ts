export async function prepareBitmap(file: File): Promise<ImageBitmap> {
  return await createImageBitmap(file)
}

export function getTargetBox(
  box: number[],
  bmp: ImageBitmap,
  mime: 'image/png' | 'image/jpeg' = 'image/png',
  quality = 0.92,
): string {
  let [x1, y1, x2, y2] = box

  if (x1 > x2) [x1, x2] = [x2, x1]
  if (y1 > y2) [y1, y2] = [y2, y1]
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
  x1 = clamp01(x1)
  y1 = clamp01(y1)
  x2 = clamp01(x2)
  y2 = clamp01(y2)

  const W = bmp.width,
    H = bmp.height
  const sx = Math.floor(x1 * W)
  const sy = Math.floor(y1 * H)
  const sw = Math.max(1, Math.floor((x2 - x1) * W))
  const sh = Math.max(1, Math.floor((y2 - y1) * H))

  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh)

  return canvas.toDataURL(mime, quality)
}
