import { describe, expect, it } from 'vitest'
import { normalizeAspectRatio } from '../../../../components/common/shared/helpers/aspect-ratio'

describe('components/common/shared/helpers/aspect-ratio (unit)', () => {
  it('normalizes slash ratio input', () => {
    expect(normalizeAspectRatio(' 16 / 9 ')).toBe('16 / 9')
    expect(normalizeAspectRatio('1/1')).toBe('1 / 1')
  })

  it('normalizes numeric ratio input', () => {
    expect(normalizeAspectRatio('1.5')).toBe('1.5 / 1')
  })

  it('returns undefined for invalid ratio input', () => {
    expect(normalizeAspectRatio()).toBeUndefined()
    expect(normalizeAspectRatio('')).toBeUndefined()
    expect(normalizeAspectRatio('0/2')).toBeUndefined()
    expect(normalizeAspectRatio('abc')).toBeUndefined()
  })
})
