import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Root } from 'hast'
import { imageSize } from 'image-size'
import { visit } from 'unist-util-visit'
import type { VFile } from 'vfile'

export type PictureSize = {
  width: number
  height: number
}

const densities = [
  { mark: '@3x.', density: 3 },
  { mark: '@2x.', density: 2 },
]

export function densityOf(src: string): number {
  return densities.find(({ mark }) => src.includes(mark))?.density ?? 1
}

export function shownSize(src: string, pixels: PictureSize): PictureSize {
  const density = densityOf(src)
  return {
    width: Math.round(pixels.width / density),
    height: Math.round(pixels.height / density),
  }
}

function measured(root: string, src: string): PictureSize | undefined {
  if (!src.startsWith('/') || src.startsWith('//')) {
    return undefined
  }
  try {
    return shownSize(src, imageSize(readFileSync(join(root, decodeURI(src)))))
  } catch {
    return undefined
  }
}

export function pictures({ root }: { root: string }) {
  return (tree: Root, file: VFile) => {
    visit(tree, 'element', picture => {
      if (picture.tagName !== 'img') {
        return
      }
      const src = String(picture.properties.src ?? '')
      const size = measured(root, src)
      if (size === undefined) {
        file.fail(
          `The picture ${src} is not a file under public/, so the page cannot keep its place before it loads`,
          picture,
        )
      }
      picture.properties.width = size.width
      picture.properties.height = size.height
    })
  }
}
