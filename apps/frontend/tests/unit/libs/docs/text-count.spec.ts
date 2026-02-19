import { describe, expect, it } from 'vitest'
import { calcTextCount } from '../../../../libs/docs/helpers/text-count'
import { markdownToText } from '../../../../utils/markdown-to-text'

describe('libs/docs/helpers/text-count (unit)', () => {
  it('returns markdown plain-text length when no frontmatter is provided', () => {
    const markdown = '# Title\n\nHello **world**!'

    expect(calcTextCount(markdown)).toBe(markdownToText(markdown).length)
  })

  it('subtracts frontmatter text length and clamps at zero', () => {
    const text = 'hello world'
    const withoutFrontmatter = calcTextCount(text)
    const withFrontmatter = calcTextCount(text, {
      title: 'hello world',
      tags: ['tag-a', 'tag-b'],
      meta: { section: 'guide' },
    })

    expect(withFrontmatter).toBeLessThan(withoutFrontmatter)
    expect(calcTextCount('x', { long: 'a'.repeat(200) })).toBe(0)
  })

  it('handles frontmatter stringification failures gracefully', () => {
    const value: Record<string, unknown> = {}
    Object.defineProperty(value, 'boom', {
      enumerable: true,
      get() {
        throw new Error('broken getter')
      },
    })

    const text = 'plain body'
    expect(calcTextCount(text, { bad: value } as any)).toBe(markdownToText(text).length)
  })
})
