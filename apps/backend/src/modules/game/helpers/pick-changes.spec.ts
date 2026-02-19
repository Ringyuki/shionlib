import { pickChanges } from './pick-changes'

describe('pickChanges', () => {
  it('ignores nullish fields and date-equivalent values', () => {
    const original = {
      title: 'old-title',
      release_date: new Date('2024-01-01T00:00:00.000Z'),
      tags: ['a'],
      ignored: 'present',
      nullValue: 'present',
    }
    const dto = {
      title: 'new-title',
      release_date: '2024-01-01T00:00:00.000Z',
      tags: ['a'],
      ignored: undefined,
      nullValue: null,
    }

    const result = pickChanges(dto, original)

    expect(result.field_changes).toEqual(['title'])
    expect(result.before).toEqual({ title: 'old-title' })
    expect(result.after).toEqual({ title: 'new-title' })
  })

  it('marks changed top-level field for nested array/object differences', () => {
    const original = {
      extra_info: [{ key: 'homepage', value: 'https://old.example' }],
    }
    const dto = {
      extra_info: [{ key: 'homepage', value: 'https://new.example' }],
    }

    const result = pickChanges(dto, original)

    expect(result.field_changes).toEqual(['extra_info'])
    expect(result.before).toEqual(original)
    expect(result.after).toEqual(dto)
  })
})
