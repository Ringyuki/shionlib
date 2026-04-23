import {
  createFieldSyncCandidate,
  createFieldSyncPreview,
  createScalarGroupCandidate,
  isEmptyValue,
  pickDefined,
  pickNonEmpty,
  stableEqual,
  uniqueStrings,
} from './field-sync'

describe('field-sync helpers', () => {
  it('creates public previews without internal apply payloads', () => {
    const candidate = createFieldSyncCandidate('titles', 'update', 'remote-title', {
      source: 'bangumi',
      title: 'Titles',
      confidence: 'exact',
      defaultSelected: true,
      local: { title: '' },
      remote: { title: 'Remote' },
      apply: { scalar: { title: 'Remote' } },
    })

    const preview = createFieldSyncPreview('titles', [
      candidate,
      createFieldSyncCandidate('titles', 'add', 'alias', {
        source: 'vndb',
        title: 'Alias',
        confidence: 'high',
        defaultSelected: true,
        applicable: false,
      }),
      createFieldSyncCandidate('titles', 'unmatched', 'local-only', {
        source: 'merged',
        title: 'Local only',
        confidence: 'low',
        defaultSelected: false,
      }),
    ])

    expect(preview.summary).toMatchObject({
      total: 3,
      add: 1,
      update: 1,
      unmatched: 1,
      defaultSelected: 1,
    })
    expect(preview.candidates[0]).not.toHaveProperty('apply')
  })

  it('builds scalar group candidates only when remote has meaningful changes', () => {
    expect(
      createScalarGroupCandidate(1, 'aliases', 'vndb', {
        local: { aliases: [] },
        remote: { aliases: [] },
        title: 'Aliases',
        skipEmptyRemote: true,
      }),
    ).toEqual([])
    expect(
      createScalarGroupCandidate(1, 'names', 'vndb', {
        local: { name: 'Remote' },
        remote: { name: 'Remote', ignored: undefined },
        title: 'Name',
      }),
    ).toEqual([])

    const [candidate] = createScalarGroupCandidate(1, 'names', 'vndb', {
      local: { name: '' },
      remote: { name: 'Remote' },
      title: 'Name',
    })

    expect(candidate).toMatchObject({
      action: 'update',
      defaultSelected: true,
      apply: { scalar: { name: 'Remote' } },
    })
  })

  it('normalises scalar helper values', () => {
    expect(pickDefined({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null })
    expect(pickNonEmpty({ a: '', b: null, c: [], d: 0, e: 'x' })).toEqual({ d: 0, e: 'x' })
    expect([undefined, null, '', []].every(value => isEmptyValue(value))).toBe(true)
    expect(isEmptyValue(['value'])).toBe(false)
    expect(stableEqual({ b: 2, a: { d: 4, c: 3 } }, { a: { c: 3, d: 4 }, b: 2 })).toBe(true)
    expect(uniqueStrings([' Alpha ', 'Alpha', '', null, undefined, 'Beta'])).toEqual([
      'Alpha',
      'Beta',
    ])
  })
})
