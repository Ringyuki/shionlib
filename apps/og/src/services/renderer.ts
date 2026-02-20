import { Renderer } from '@takumi-rs/core'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ASSETS_DIR = join(fileURLToPath(new URL('../../assets', import.meta.url)))
let _renderer: Renderer | null = null
let _fallbackImageKey: string | null = null
export const FALLBACK_IMAGE_KEY = 'fallback'

export async function loadRenderer(): Promise<Renderer> {
  if (_renderer) return _renderer

  const [cinzelBold, notoSans, notoSansSC, notoSansJP, fallbackPng] = await Promise.all([
    readFile(join(ASSETS_DIR, 'fonts/Cinzel-Bold.ttf')),
    readFile(join(ASSETS_DIR, 'fonts/NotoSans-Regular.ttf')),
    readFile(join(ASSETS_DIR, 'fonts/NotoSansSC-Regular.ttf')),
    readFile(join(ASSETS_DIR, 'fonts/NotoSansJP-Regular.ttf')),
    readFile(join(ASSETS_DIR, 'images/fallback.png')),
  ])

  const fonts: { name: string; data: Buffer }[] = [
    { name: 'Cinzel', data: cinzelBold },
    { name: 'NotoSans', data: notoSans },
    { name: 'NotoSansSC', data: notoSansSC },
    { name: 'NotoSansJP', data: notoSansJP },
  ]

  const renderer = new Renderer({
    fonts,
    // Disable default Geist fonts — we bring our own
    loadDefaultFonts: false,
  })

  // Preload fallback image to avoid repeated decoding on every request
  await renderer.putPersistentImage(FALLBACK_IMAGE_KEY, fallbackPng)
  _fallbackImageKey = FALLBACK_IMAGE_KEY

  _renderer = renderer
  return renderer
}

export function getRenderer(): Renderer {
  if (!_renderer) throw new Error('Renderer not initialized. Call loadRenderer() first.')
  return _renderer
}

export function getFallbackImageKey(): string {
  if (!_fallbackImageKey) throw new Error('Renderer not initialized.')
  return _fallbackImageKey
}
