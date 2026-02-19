import { describe, expect, it } from 'vitest'
import { pickChanges } from '../../../utils/pick-changes'

describe('utils/pick-changes (unit)', () => {
  it('ignores nullish fields and date-equivalent values', () => {
    const original = {
      title: 'old',
      release_date: new Date('2024-01-01T00:00:00.000Z'),
      tags: ['a'],
      ignored: 'x',
    }
    const dto = {
      title: 'new',
      release_date: '2024-01-01T00:00:00.000Z',
      tags: ['a'],
      ignored: undefined,
      nullValue: null,
    }

    const result = pickChanges(dto, original)

    expect(result.field_changes).toEqual(['title'])
    expect(result.before).toEqual({ title: 'old' })
    expect(result.after).toEqual({ title: 'new' })
  })

  it('marks top-level field when nested values change', () => {
    const original = { extra_info: [{ key: 'homepage', value: 'old' }] }
    const dto = { extra_info: [{ key: 'homepage', value: 'new' }] }

    const result = pickChanges(dto, original)

    expect(result.field_changes).toEqual(['extra_info'])
    expect(result.before).toEqual(original)
    expect(result.after).toEqual(dto)
  })
})
