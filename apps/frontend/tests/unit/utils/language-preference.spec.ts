import { describe, expect, it } from 'vitest'
import { normalizeLocale } from '../../../utils/language-preference'

describe('utils/language-preference (unit)', () => {
  it('normalizes supported locales and regional tags', () => {
    expect(normalizeLocale('en')).toBe('en')
    expect(normalizeLocale('ja-JP')).toBe('ja')
    expect(normalizeLocale('zh_CN')).toBe('zh')
  })

  it('falls back to en for unsupported or empty locale', () => {
    expect(normalizeLocale('fr')).toBe('en')
    expect(normalizeLocale('')).toBe('en')
    expect(normalizeLocale(undefined)).toBe('en')
  })
})
