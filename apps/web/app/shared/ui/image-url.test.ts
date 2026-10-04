import { describe, expect, it } from 'vitest'
import { imageUrl } from './image-url'

describe('imageUrl', () => {
  it('prefixes stored keys with the image host', () => {
    expect(imageUrl('https://t.shionlib.com', 'game/1/cover/a.webp')).toBe(
      'https://t.shionlib.com/game/1/cover/a.webp',
    )
    expect(imageUrl('https://t.shionlib.com', '/avatar/b.webp')).toBe(
      'https://t.shionlib.com/avatar/b.webp',
    )
  })

  it('keeps absolute and inline sources', () => {
    expect(imageUrl('https://t.shionlib.com', 'https://cdn.example/x.png')).toBe(
      'https://cdn.example/x.png',
    )
    expect(imageUrl('https://t.shionlib.com', 'blob:abc')).toBe('blob:abc')
  })

  it('returns nothing for missing images', () => {
    expect(imageUrl('https://t.shionlib.com', null)).toBeUndefined()
    expect(imageUrl('https://t.shionlib.com', '')).toBeUndefined()
  })
})
