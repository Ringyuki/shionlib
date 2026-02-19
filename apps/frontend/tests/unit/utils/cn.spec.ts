import { describe, expect, it } from 'vitest'
import { cn } from '../../../utils/cn'

describe('utils/cn (unit)', () => {
  it('merges classes and resolves tailwind conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })

  it('ignores falsy values while keeping valid classes', () => {
    expect(cn('font-bold', false && 'hidden', undefined, null, 'tracking-wide')).toBe(
      'font-bold tracking-wide',
    )
  })
})
