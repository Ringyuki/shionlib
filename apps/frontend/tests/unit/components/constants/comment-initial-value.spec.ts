import { describe, expect, it } from 'vitest'
import { initialValue } from '../../../../components/common/comment/constants/initialValue'

describe('components/common/comment/constants/initialValue (unit)', () => {
  it('provides an empty lexical root paragraph', () => {
    const root = (initialValue as any).root

    expect(root.type).toBe('root')
    expect(Array.isArray(root.children)).toBe(true)
    expect(root.children[0]?.type).toBe('paragraph')
    expect(root.children[0]?.children[0]?.text).toBe('')
  })
})
