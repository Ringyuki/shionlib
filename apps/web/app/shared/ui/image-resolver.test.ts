import { describe, expect, it } from 'vitest'
import { imageResolver } from './image-resolver'

const resolve = imageResolver('https://t.shionlib.com')

describe('imageResolver', () => {
  it('prefixes stored keys with the image host', () => {
    expect(resolve('game/1/cover/a.webp', 'image')).toBe(
      'https://t.shionlib.com/game/1/cover/a.webp',
    )
  })

  it('keeps absolute, inline and site sources', () => {
    expect(resolve('https://cdn.example/x.png', 'image')).toBe('https://cdn.example/x.png')
    expect(resolve('blob:abc', 'preview')).toBe('blob:abc')
    expect(resolve('/brand/logo.png', 'image')).toBe('/brand/logo.png')
  })
})
