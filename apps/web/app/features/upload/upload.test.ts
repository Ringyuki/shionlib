import { describe, expect, it } from 'vitest'
import {
  admit,
  matchFiles,
  chunkLength,
  sameFile,
  totals,
  uploadedBytes,
  type Allowance,
  type Upload,
} from './upload'

const allowance: Allowance = {
  tier: 'new',
  approved: 0,
  trusted: false,
  frozen_until: null,
  stored: 40,
  stored_limit: 100,
  in_flight: 10,
  in_flight_limit: 50,
  max_file_size: 30,
}

describe('upload rules', () => {
  it('matches a chosen file by name, size and, when known, modification time', () => {
    const known = { name: 'game.7z', size: 10, lastModified: 5 }
    expect(sameFile({ ...known }, known)).toBe(true)
    expect(sameFile({ ...known, lastModified: 6 }, known)).toBe(false)
    expect(sameFile({ ...known, lastModified: 6 }, { ...known, lastModified: 0 })).toBe(true)
    expect(sameFile({ ...known, size: 11 }, known)).toBe(false)
  })

  it('admits files that fit the allowance', () => {
    expect(admit(allowance, [20, 30])).toBe(undefined)
    expect(admit(allowance, [0, 3])).toBe('empty')
    expect(admit(allowance, [31])).toBe('tooLarge')
    expect(admit(allowance, [30, 30])).toBe('overQuota')
    expect(admit({ ...allowance, max_file_size: null, stored_limit: null }, [500])).toBe(undefined)
  })

  it('measures chunks, the last one shorter', () => {
    const session = { id: 1, chunkSize: 4, totalChunks: 3 }
    expect(chunkLength(session, 10, 2)).toBe(2)
    expect(uploadedBytes(session, 10, [0, 2])).toBe(6)
  })

  it('leaves failed uploads out of the totals', () => {
    const base = { submission: 's', sent: 5, speed: 0, phase: { name: 'running' } } as const
    const uploads: Upload[] = [
      { ...base, id: 'a', file: { name: 'a', size: 10, lastModified: 0 } },
      {
        ...base,
        id: 'b',
        file: { name: 'b', size: 10, lastModified: 0 },
        phase: { name: 'failed', reason: 'expired' },
      },
    ]
    expect(totals(uploads)).toEqual({ size: 10, sent: 5, ratio: 0.5 })
  })

  it('pairs chosen files with the uploads waiting for them', () => {
    const base = { submission: 's', sent: 0, speed: 0 } as const
    const uploads: Upload[] = [
      {
        ...base,
        id: 'a',
        file: { name: 'a.rar', size: 4, lastModified: 1 },
        phase: { name: 'needsFile' },
      },
      {
        ...base,
        id: 'b',
        file: { name: 'b.rar', size: 4, lastModified: 0 },
        phase: { name: 'needsFile' },
      },
      {
        ...base,
        id: 'c',
        file: { name: 'c.rar', size: 4, lastModified: 1 },
        phase: { name: 'running' },
      },
    ]
    const file = (name: string, lastModified: number) => new File(['data'], name, { lastModified })
    const chosen = [file('a.rar', 1), file('b.rar', 9), file('c.rar', 1), file('a.rar', 2)]
    const { matches, unmatched } = matchFiles(uploads, chosen)
    expect([...matches.keys()]).toEqual(['a', 'b'])
    expect(unmatched.map(entry => entry.name)).toEqual(['c.rar', 'a.rar'])
  })
})
