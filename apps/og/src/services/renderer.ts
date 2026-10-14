import { Renderer } from '@takumi-rs/core'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ASSETS_DIR = fileURLToPath(new URL('../../assets', import.meta.url))
const BRAND_COLOR = '#34a2d5'

export const brandImages = {
  logo: 'brand:logo',
  wordmark: 'brand:wordmark',
  wordmarkZh: 'brand:wordmark-zh',
} as const

let renderer: Renderer | null = null

const asset = (path: string) => readFile(join(ASSETS_DIR, path))

async function wordmark(file: string): Promise<Buffer> {
  const svg = await readFile(join(ASSETS_DIR, 'brand', file), 'utf8')
  return Buffer.from(svg.replaceAll('currentColor', BRAND_COLOR))
}

export async function loadRenderer(): Promise<Renderer> {
  if (renderer) {
    return renderer
  }
  const [sans, sansSc, logo, latinMark, chineseMark] = await Promise.all([
    asset('fonts/NotoSans-VariableFont_wdth,wght.ttf'),
    asset('fonts/NotoSansSC-VariableFont_wght.ttf'),
    asset('brand/logo.png'),
    wordmark('wordmark.svg'),
    wordmark('wordmark-zh.svg'),
  ])
  const loaded = new Renderer({
    fonts: [
      { name: 'Noto Sans', data: sans },
      { name: 'Noto Sans SC', data: sansSc },
    ],
    loadDefaultFonts: false,
  })
  await Promise.all([
    loaded.putPersistentImage(brandImages.logo, logo),
    loaded.putPersistentImage(brandImages.wordmark, latinMark),
    loaded.putPersistentImage(brandImages.wordmarkZh, chineseMark),
  ])
  renderer = loaded
  return loaded
}

export function getRenderer(): Renderer {
  if (!renderer) {
    throw new Error('Renderer not initialized. Call loadRenderer() first.')
  }
  return renderer
}
